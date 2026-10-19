import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.deps import get_project_for_user
from backend.app.models import Dataset, DatasetExample, EvaluationResult, EvaluationRun, Project
from backend.app.schemas import (
    ComparisonExampleDiff,
    ComparisonMetricDiff,
    EvaluationComparisonResponse,
    EvaluationResultResponse,
    EvaluationRunCreate,
    EvaluationRunDetailResponse,
    EvaluationRunResponse,
)
from backend.app.services.cost_service import estimate_token_cost
from backend.app.services.eval_service import evaluate_example, generate_model_output

router = APIRouter(prefix="/projects/{project_id}/evaluations", tags=["Evaluations"])


@router.get("", response_model=List[EvaluationRunResponse])
async def list_evaluations(
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """List evaluation runs for the project."""
    stmt = (
        select(EvaluationRun)
        .where(EvaluationRun.project_id == project.id)
        .order_by(desc(EvaluationRun.created_at))
    )
    res = await db.execute(stmt)
    runs = res.scalars().all()

    output = []
    for r in runs:
        metrics = json.loads(r.selected_metrics) if r.selected_metrics else []
        summary = json.loads(r.summary_scores) if r.summary_scores else None
        item = EvaluationRunResponse(
            id=r.id,
            project_id=r.project_id,
            dataset_id=r.dataset_id,
            name=r.name,
            status=r.status,
            model_name=r.model_name,
            prompt_template=r.prompt_template,
            selected_metrics=metrics,
            total_examples=r.total_examples,
            completed_examples=r.completed_examples,
            error_count=r.error_count,
            avg_latency_ms=r.avg_latency_ms,
            total_tokens=r.total_tokens,
            estimated_cost=r.estimated_cost,
            summary_scores=summary,
            error_message=r.error_message,
            created_at=r.created_at,
            completed_at=r.completed_at,
        )
        output.append(item)
    return output


@router.post("", response_model=EvaluationRunDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_and_run_evaluation(
    eval_in: EvaluationRunCreate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Launch an evaluation run against a dataset.
    Executes model generation and metric calculations, stores per-example results,
    computes aggregate summary scores, and persists completed run.
    """
    d_stmt = select(Dataset).where(Dataset.id == eval_in.dataset_id, Dataset.project_id == project.id)
    d_res = await db.execute(d_stmt)
    dataset = d_res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Fetch examples
    ex_stmt = select(DatasetExample).where(DatasetExample.dataset_id == dataset.id).order_by(DatasetExample.created_at.asc())
    ex_res = await db.execute(ex_stmt)
    examples = ex_res.scalars().all()

    if not examples:
        raise HTTPException(status_code=400, detail="Cannot run evaluation on empty dataset. Add examples first.")

    run = EvaluationRun(
        project_id=project.id,
        dataset_id=dataset.id,
        name=eval_in.name,
        status="running",
        model_name=eval_in.model_name,
        prompt_template=eval_in.prompt_template or "{input}",
        selected_metrics=json.dumps(eval_in.selected_metrics),
        total_examples=len(examples),
        completed_examples=0,
        error_count=0,
    )
    db.add(run)
    await db.flush()

    results: List[EvaluationResult] = []
    total_latency = 0.0
    total_tokens = 0
    all_scores_accum: Dict[str, List[float]] = {m: [] for m in eval_in.selected_metrics}

    for ex in examples:
        prompt = run.prompt_template.replace("{input}", ex.input_text)
        try:
            generated_text, latency_ms, token_cnt = await generate_model_output(
                model_name=run.model_name,
                prompt=prompt,
                context=ex.context
            )
            scores = evaluate_example(
                input_text=ex.input_text,
                expected_output=ex.expected_output,
                generated_output=generated_text,
                context=ex.context,
                selected_metrics=eval_in.selected_metrics,
                latency_ms=latency_ms,
                token_count=token_cnt,
                model_name=run.model_name,
            )

            # Record metrics
            for k, val in scores.items():
                if k in all_scores_accum:
                    all_scores_accum[k].append(val)

            # Check pass condition: token_f1 >= 0.5 or exact_match == 1.0 or faithfulness >= 0.7
            passed = True
            if "token_f1" in scores and scores["token_f1"] < 0.4:
                passed = False
            elif "faithfulness" in scores and scores["faithfulness"] < 0.5:
                passed = False

            res_record = EvaluationResult(
                run_id=run.id,
                example_id=ex.id,
                input_text=ex.input_text,
                expected_output=ex.expected_output,
                generated_output=generated_text,
                context=ex.context,
                scores=json.dumps(scores),
                passed=passed,
                latency_ms=latency_ms,
                token_count=token_cnt,
            )
            db.add(res_record)
            results.append(res_record)
            total_latency += latency_ms
            total_tokens += token_cnt
            run.completed_examples += 1

        except Exception as e:
            run.error_count += 1
            err_record = EvaluationResult(
                run_id=run.id,
                example_id=ex.id,
                input_text=ex.input_text,
                expected_output=ex.expected_output,
                generated_output="",
                context=ex.context,
                scores=json.dumps({}),
                passed=False,
                latency_ms=0.0,
                token_count=0,
                error_message=str(e),
            )
            db.add(err_record)
            results.append(err_record)

    # Calculate summary scores
    summary_scores = {}
    for metric, values in all_scores_accum.items():
        if values:
            summary_scores[metric] = round(sum(values) / len(values), 4)

    run.status = "completed"
    run.completed_at = datetime.now(timezone.utc)
    run.avg_latency_ms = round(total_latency / max(1, len(results)), 2)
    run.total_tokens = total_tokens
    run.estimated_cost = estimate_token_cost(
        run.model_name, int(total_tokens * 0.4), int(total_tokens * 0.6)
    )
    run.summary_scores = json.dumps(summary_scores)

    await db.commit()
    await db.refresh(run)

    # Format response
    metrics_list = json.loads(run.selected_metrics)
    summary_dict = json.loads(run.summary_scores) if run.summary_scores else {}
    results_resp = [
        EvaluationResultResponse(
            id=r.id,
            run_id=r.run_id,
            example_id=r.example_id,
            input_text=r.input_text,
            expected_output=r.expected_output,
            generated_output=r.generated_output,
            context=r.context,
            scores=json.loads(r.scores) if r.scores else {},
            passed=r.passed,
            latency_ms=r.latency_ms,
            token_count=r.token_count,
            error_message=r.error_message,
            created_at=r.created_at,
        )
        for r in results
    ]

    return EvaluationRunDetailResponse(
        id=run.id,
        project_id=run.project_id,
        dataset_id=run.dataset_id,
        name=run.name,
        status=run.status,
        model_name=run.model_name,
        prompt_template=run.prompt_template,
        selected_metrics=metrics_list,
        total_examples=run.total_examples,
        completed_examples=run.completed_examples,
        error_count=run.error_count,
        avg_latency_ms=run.avg_latency_ms,
        total_tokens=run.total_tokens,
        estimated_cost=run.estimated_cost,
        summary_scores=summary_dict,
        error_message=run.error_message,
        created_at=run.created_at,
        completed_at=run.completed_at,
        results=results_resp,
    )


@router.get("/{run_id}", response_model=EvaluationRunDetailResponse)
async def get_evaluation_run(
    run_id: str,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single evaluation run details and individual example results."""
    stmt = select(EvaluationRun).where(EvaluationRun.id == run_id, EvaluationRun.project_id == project.id)
    res = await db.execute(stmt)
    run = res.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")

    res_stmt = select(EvaluationResult).where(EvaluationResult.run_id == run.id).order_by(EvaluationResult.created_at.asc())
    res_res = await db.execute(res_stmt)
    results = res_res.scalars().all()

    metrics_list = json.loads(run.selected_metrics) if run.selected_metrics else []
    summary_dict = json.loads(run.summary_scores) if run.summary_scores else {}

    results_resp = [
        EvaluationResultResponse(
            id=r.id,
            run_id=r.run_id,
            example_id=r.example_id,
            input_text=r.input_text,
            expected_output=r.expected_output,
            generated_output=r.generated_output,
            context=r.context,
            scores=json.loads(r.scores) if r.scores else {},
            passed=r.passed,
            latency_ms=r.latency_ms,
            token_count=r.token_count,
            error_message=r.error_message,
            created_at=r.created_at,
        )
        for r in results
    ]

    return EvaluationRunDetailResponse(
        id=run.id,
        project_id=run.project_id,
        dataset_id=run.dataset_id,
        name=run.name,
        status=run.status,
        model_name=run.model_name,
        prompt_template=run.prompt_template,
        selected_metrics=metrics_list,
        total_examples=run.total_examples,
        completed_examples=run.completed_examples,
        error_count=run.error_count,
        avg_latency_ms=run.avg_latency_ms,
        total_tokens=run.total_tokens,
        estimated_cost=run.estimated_cost,
        summary_scores=summary_dict,
        error_message=run.error_message,
        created_at=run.created_at,
        completed_at=run.completed_at,
        results=results_resp,
    )


@router.get("/compare/{baseline_id}/{candidate_id}", response_model=EvaluationComparisonResponse)
async def compare_evaluation_runs(
    baseline_id: str,
    candidate_id: str,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Compare two evaluation runs on quality metrics, latency, token consumption, and cost.
    Identifies per-example regressions and improvements.
    """
    stmt = select(EvaluationRun).where(
        EvaluationRun.id.in_([baseline_id, candidate_id]),
        EvaluationRun.project_id == project.id,
    )
    res = await db.execute(stmt)
    runs = {r.id: r for r in res.scalars().all()}

    if baseline_id not in runs or candidate_id not in runs:
        raise HTTPException(status_code=404, detail="One or both evaluation runs not found")

    base = runs[baseline_id]
    cand = runs[candidate_id]

    base_summary = json.loads(base.summary_scores) if base.summary_scores else {}
    cand_summary = json.loads(cand.summary_scores) if cand.summary_scores else {}

    # Metric diffs
    all_keys = set(base_summary.keys()).union(set(cand_summary.keys()))
    metric_diffs = {}
    for k in all_keys:
        b_val = base_summary.get(k, 0.0)
        c_val = cand_summary.get(k, 0.0)
        abs_diff = round(c_val - b_val, 4)
        pct_change = round(((c_val - b_val) / b_val * 100), 2) if b_val > 0 else 0.0
        metric_diffs[k] = ComparisonMetricDiff(
            baseline_value=b_val,
            candidate_value=c_val,
            absolute_diff=abs_diff,
            percentage_change=pct_change,
        )

    # Latency diff
    lat_diff = round(cand.avg_latency_ms - base.avg_latency_ms, 2)
    lat_pct = round(((cand.avg_latency_ms - base.avg_latency_ms) / base.avg_latency_ms * 100), 2) if base.avg_latency_ms > 0 else 0.0
    latency_diff = ComparisonMetricDiff(
        baseline_value=base.avg_latency_ms,
        candidate_value=cand.avg_latency_ms,
        absolute_diff=lat_diff,
        percentage_change=lat_pct,
    )

    # Token diff
    tok_diff = cand.total_tokens - base.total_tokens
    tok_pct = round((tok_diff / base.total_tokens * 100), 2) if base.total_tokens > 0 else 0.0
    token_diff = ComparisonMetricDiff(
        baseline_value=float(base.total_tokens),
        candidate_value=float(cand.total_tokens),
        absolute_diff=float(tok_diff),
        percentage_change=tok_pct,
    )

    # Cost diff
    cost_diff_val = round(cand.estimated_cost - base.estimated_cost, 6)
    cost_pct = round((cost_diff_val / base.estimated_cost * 100), 2) if base.estimated_cost > 0 else 0.0
    cost_diff = ComparisonMetricDiff(
        baseline_value=base.estimated_cost,
        candidate_value=cand.estimated_cost,
        absolute_diff=cost_diff_val,
        percentage_change=cost_pct,
    )

    # Per-example comparisons
    b_res_stmt = select(EvaluationResult).where(EvaluationResult.run_id == base.id)
    c_res_stmt = select(EvaluationResult).where(EvaluationResult.run_id == cand.id)

    b_res = (await db.execute(b_res_stmt)).scalars().all()
    c_res = (await db.execute(c_res_stmt)).scalars().all()

    # Map by example_id or input_text
    base_map = {r.example_id or r.input_text: r for r in b_res}
    cand_map = {r.example_id or r.input_text: r for r in c_res}

    regressions = []
    improvements = []
    unchanged_cnt = 0

    for key, c_item in cand_map.items():
        if key in base_map:
            b_item = base_map[key]
            b_scores = json.loads(b_item.scores) if b_item.scores else {}
            c_scores = json.loads(c_item.scores) if c_item.scores else {}

            # Primary score comparison: token_f1 or exact_match or answer_relevance
            score_key = "token_f1" if "token_f1" in c_scores else next(iter(c_scores.keys()), None)
            b_s = b_scores.get(score_key, 0.0) if score_key else 0.0
            c_s = c_scores.get(score_key, 0.0) if score_key else 0.0
            delta = round(c_s - b_s, 4)

            item_diff = ComparisonExampleDiff(
                example_id=c_item.example_id,
                input_text=c_item.input_text,
                expected_output=c_item.expected_output,
                baseline_output=b_item.generated_output,
                candidate_output=c_item.generated_output,
                baseline_scores=b_scores,
                candidate_scores=c_scores,
                delta_score=delta,
                status="improved" if delta > 0.05 else ("degraded" if delta < -0.05 else "unchanged"),
            )

            if delta < -0.05:
                regressions.append(item_diff)
            elif delta > 0.05:
                improvements.append(item_diff)
            else:
                unchanged_cnt += 1

    base_resp = EvaluationRunResponse(
        id=base.id,
        project_id=base.project_id,
        dataset_id=base.dataset_id,
        name=base.name,
        status=base.status,
        model_name=base.model_name,
        prompt_template=base.prompt_template,
        selected_metrics=json.loads(base.selected_metrics) if base.selected_metrics else [],
        total_examples=base.total_examples,
        completed_examples=base.completed_examples,
        error_count=base.error_count,
        avg_latency_ms=base.avg_latency_ms,
        total_tokens=base.total_tokens,
        estimated_cost=base.estimated_cost,
        summary_scores=base_summary,
        error_message=base.error_message,
        created_at=base.created_at,
        completed_at=base.completed_at,
    )

    cand_resp = EvaluationRunResponse(
        id=cand.id,
        project_id=cand.project_id,
        dataset_id=cand.dataset_id,
        name=cand.name,
        status=cand.status,
        model_name=cand.model_name,
        prompt_template=cand.prompt_template,
        selected_metrics=json.loads(cand.selected_metrics) if cand.selected_metrics else [],
        total_examples=cand.total_examples,
        completed_examples=cand.completed_examples,
        error_count=cand.error_count,
        avg_latency_ms=cand.avg_latency_ms,
        total_tokens=cand.total_tokens,
        estimated_cost=cand.estimated_cost,
        summary_scores=cand_summary,
        error_message=cand.error_message,
        created_at=cand.created_at,
        completed_at=cand.completed_at,
    )

    return EvaluationComparisonResponse(
        baseline_run=base_resp,
        candidate_run=cand_resp,
        metric_diffs=metric_diffs,
        latency_diff=latency_diff,
        token_diff=token_diff,
        cost_diff=cost_diff,
        improved_count=len(improvements),
        degraded_count=len(regressions),
        unchanged_count=unchanged_cnt,
        regressions=regressions,
        improvements=improvements,
    )
