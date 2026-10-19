import json
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.deps import get_project_for_user, verify_ingest_key
from backend.app.models import Project, Span, Trace
from backend.app.schemas import (
    DashboardMetricsResponse,
    SpanResponse,
    TraceIngestRequest,
    TraceListResponse,
    TraceResponse,
)
from backend.app.services.cost_service import estimate_token_cost

router = APIRouter(tags=["Tracing & Observability"])


@router.post("/traces/ingest", response_model=TraceResponse, status_code=status.HTTP_201_CREATED)
async def ingest_trace(
    payload: TraceIngestRequest,
    project: Project = Depends(verify_ingest_key),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingestion API endpoint for SDK and external applications.
    Authenticates via X-API-Key or Bearer token.
    Validates payload, enforces boundaries, computes costs, and stores traces + spans.
    """
    trace_uuid = str(uuid.uuid4())
    public_trace_id = payload.trace_id or f"trc_{trace_uuid[:12]}"

    total_tokens = payload.input_tokens + payload.output_tokens
    cost = payload.estimated_cost
    if cost is None:
        cost = estimate_token_cost(payload.model, payload.input_tokens, payload.output_tokens)

    meta_str = json.dumps(payload.metadata) if payload.metadata else None

    trace = Trace(
        id=trace_uuid,
        project_id=project.id,
        trace_id=public_trace_id,
        name=payload.name,
        operation_type=payload.operation_type,
        model=payload.model,
        provider=payload.provider,
        status=payload.status,
        latency_ms=payload.latency_ms,
        input_tokens=payload.input_tokens,
        output_tokens=payload.output_tokens,
        total_tokens=total_tokens,
        estimated_cost=cost,
        input_payload=payload.input_payload,
        output_payload=payload.output_payload,
        error_message=payload.error_message,
        metadata_json=meta_str,
    )
    db.add(trace)

    if payload.spans:
        for span_in in payload.spans:
            s_meta = json.dumps(span_in.metadata) if span_in.metadata else None
            span = Span(
                trace_id=trace.id,
                span_id=span_in.span_id,
                parent_span_id=span_in.parent_span_id,
                name=span_in.name,
                span_type=span_in.span_type,
                duration_ms=span_in.duration_ms,
                input_payload=span_in.input_payload,
                output_payload=span_in.output_payload,
                metadata_json=s_meta,
            )
            db.add(span)

    await db.commit()
    await db.refresh(trace)
    return TraceResponse.model_validate(trace)


@router.get("/projects/{project_id}/traces", response_model=TraceListResponse)
async def list_traces(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    operation_type: Optional[str] = None,
    model: Optional[str] = None,
    search: Optional[str] = None,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Search and filter traces with pagination.
    """
    query = select(Trace).where(Trace.project_id == project.id)

    if status and status != "all":
        query = query.where(Trace.status == status)
    if operation_type and operation_type != "all":
        query = query.where(Trace.operation_type == operation_type)
    if model and model != "all":
        query = query.where(Trace.model.ilike(f"%{model}%"))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            (Trace.trace_id.ilike(term))
            | (Trace.input_payload.ilike(term))
            | (Trace.output_payload.ilike(term))
            | (Trace.error_message.ilike(term))
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_query)
    total = count_res.scalar_one()

    # Apply pagination and sorting
    offset = (page - 1) * limit
    paged_query = query.order_by(desc(Trace.created_at)).offset(offset).limit(limit)
    res = await db.execute(paged_query)
    items = res.scalars().all()

    total_pages = math.ceil(total / limit) if total > 0 else 1

    return TraceListResponse(
        items=[TraceResponse.model_validate(t) for t in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get("/projects/{project_id}/traces/{trace_id}", response_model=TraceResponse)
async def get_trace_detail(
    trace_id: str,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Get single trace with its associated execution timeline spans."""
    stmt = (
        select(Trace)
        .where(Trace.project_id == project.id, (Trace.id == trace_id) | (Trace.trace_id == trace_id))
    )
    res = await db.execute(stmt)
    trace = res.scalars().first()
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")

    spans_stmt = select(Span).where(Span.trace_id == trace.id).order_by(Span.created_at.asc())
    spans_res = await db.execute(spans_stmt)
    spans = spans_res.scalars().all()

    resp = TraceResponse.model_validate(trace)
    resp.spans = [SpanResponse.model_validate(s) for s in spans]
    return resp


@router.get("/projects/{project_id}/dashboard", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    days: int = Query(7, ge=1, le=90),
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Real database-backed dashboard metrics.
    Computes aggregates, percentiles, model breakdown, and recent failed requests.
    Returns honest zero values if empty.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    stmt = select(Trace).where(Trace.project_id == project.id, Trace.created_at >= cutoff)
    res = await db.execute(stmt)
    traces = res.scalars().all()

    total_requests = len(traces)
    if total_requests == 0:
        return DashboardMetricsResponse(
            total_requests=0,
            successful_requests=0,
            error_requests=0,
            error_rate=0.0,
            avg_latency_ms=0.0,
            p95_latency_ms=0.0,
            p99_latency_ms=0.0,
            total_input_tokens=0,
            total_output_tokens=0,
            total_tokens=0,
            estimated_total_cost=0.0,
            model_breakdown=[],
            volume_over_time=[],
            recent_failed_traces=[],
        )

    successful = [t for t in traces if t.status == "success"]
    errors = [t for t in traces if t.status == "error"]

    error_rate = round((len(errors) / total_requests) * 100, 2)

    latencies = sorted([t.latency_ms for t in traces])
    avg_latency = round(sum(latencies) / len(latencies), 2)
    p95_idx = int(0.95 * len(latencies))
    p99_idx = int(0.99 * len(latencies))
    p95_latency = round(latencies[min(p95_idx, len(latencies) - 1)], 2)
    p99_latency = round(latencies[min(p99_idx, len(latencies) - 1)], 2)

    total_input = sum(t.input_tokens for t in traces)
    total_output = sum(t.output_tokens for t in traces)
    total_tokens = sum(t.total_tokens for t in traces)
    estimated_cost = round(sum(t.estimated_cost for t in traces), 4)

    # Model breakdown
    model_counts = {}
    for t in traces:
        m = t.model
        if m not in model_counts:
            model_counts[m] = {"model": m, "requests": 0, "tokens": 0, "cost": 0.0}
        model_counts[m]["requests"] += 1
        model_counts[m]["tokens"] += t.total_tokens
        model_counts[m]["cost"] = round(model_counts[m]["cost"] + t.estimated_cost, 4)
    model_breakdown = sorted(list(model_counts.values()), key=lambda x: x["requests"], reverse=True)

    # Volume over time (grouped by day)
    day_counts = {}
    for i in range(days):
        d_str = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        day_counts[d_str] = {"date": d_str, "requests": 0, "errors": 0}

    for t in traces:
        d_str = t.created_at.strftime("%Y-%m-%d")
        if d_str in day_counts:
            day_counts[d_str]["requests"] += 1
            if t.status == "error":
                day_counts[d_str]["errors"] += 1

    volume_over_time = list(day_counts.values())

    # Recent failed traces
    recent_failed = sorted(errors, key=lambda x: x.created_at, reverse=True)[:5]

    return DashboardMetricsResponse(
        total_requests=total_requests,
        successful_requests=len(successful),
        error_requests=len(errors),
        error_rate=error_rate,
        avg_latency_ms=avg_latency,
        p95_latency_ms=p95_latency,
        p99_latency_ms=p99_latency,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        total_tokens=total_tokens,
        estimated_total_cost=estimated_cost,
        model_breakdown=model_breakdown,
        volume_over_time=volume_over_time,
        recent_failed_traces=[TraceResponse.model_validate(f) for f in recent_failed],
    )
