import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.deps import get_project_for_user
from backend.app.models import Dataset, DatasetExample, Project
from backend.app.schemas import (
    DatasetCreate,
    DatasetDetailResponse,
    DatasetExampleCreate,
    DatasetExampleResponse,
    DatasetResponse,
)

router = APIRouter(prefix="/projects/{project_id}/datasets", tags=["Datasets"])


SAMPLE_DATASET_ROWS = [
    {
        "input_text": "What is the refund window for annual enterprise subscriptions?",
        "expected_output": "Annual enterprise subscriptions are eligible for a full refund within 30 days of initial purchase.",
        "context": "Sentinel AI Billing Terms: Monthly plans may be cancelled anytime. Annual enterprise subscriptions are eligible for a full refund within 30 days of initial purchase.",
        "metadata": {"category": "billing", "difficulty": "easy"}
    },
    {
        "input_text": "How do I revoke an ingestion API key in Sentinel AI?",
        "expected_output": "You can revoke an ingestion API key from the Project Settings -> API Keys dashboard by clicking the revoke button next to the key.",
        "context": "Sentinel AI Key Security: Ingestion keys can be created, rotated, or revoked instantly in Project Settings -> API Keys without restarting your services.",
        "metadata": {"category": "security", "difficulty": "medium"}
    },
    {
        "input_text": "Does Sentinel AI require a paid third-party LLM provider to compute local evaluation metrics?",
        "expected_output": "No, Sentinel AI implements deterministic local evaluation algorithms for exact match, token F1, answer relevance, and faithfulness without requiring paid APIs.",
        "context": "Sentinel AI Evaluation Engine: All core metrics including exact match, token precision/recall/F1, answer relevance, context recall, and faithfulness operate deterministically locally.",
        "metadata": {"category": "evaluation", "difficulty": "medium"}
    },
    {
        "input_text": "What hashing algorithm is used to secure stored ingestion API keys?",
        "expected_output": "Sentinel AI hashes raw API keys using cryptographic SHA-256 and only displays the raw secret once upon creation.",
        "context": "Key Storage: Raw secrets are never saved in the database. Sentinel AI hashes keys using SHA-256 for deterministic, constant-time verification.",
        "metadata": {"category": "security", "difficulty": "hard"}
    },
    {
        "input_text": "Which metrics are calculated to evaluate RAG retrieval performance?",
        "expected_output": "RAG retrieval performance is evaluated using Context Precision and Context Recall alongside Answer Faithfulness.",
        "context": "RAG Evaluation Suite: Retrieval quality is measured through Context Precision (noise ratio) and Context Recall (ground truth capture), while output quality is evaluated through Faithfulness.",
        "metadata": {"category": "rag", "difficulty": "hard"}
    }
]


@router.get("", response_model=List[DatasetResponse])
async def list_datasets(
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """List all evaluation datasets in the project."""
    stmt = (
        select(Dataset)
        .where(Dataset.project_id == project.id)
        .order_by(desc(Dataset.created_at))
    )
    res = await db.execute(stmt)
    datasets = res.scalars().all()
    return [DatasetResponse.model_validate(d) for d in datasets]


@router.post("", response_model=DatasetDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_dataset(
    dataset_in: DatasetCreate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new dataset and optionally insert initial examples."""
    dataset = Dataset(
        project_id=project.id,
        name=dataset_in.name,
        description=dataset_in.description,
        version=1,
        example_count=len(dataset_in.initial_examples or []),
    )
    db.add(dataset)
    await db.flush()

    examples = []
    if dataset_in.initial_examples:
        for ex in dataset_in.initial_examples:
            meta_str = json.dumps(ex.metadata) if ex.metadata else None
            example = DatasetExample(
                dataset_id=dataset.id,
                input_text=ex.input_text,
                expected_output=ex.expected_output,
                context=ex.context,
                metadata_json=meta_str,
            )
            db.add(example)
            examples.append(example)

    await db.commit()
    await db.refresh(dataset)

    resp = DatasetDetailResponse.model_validate(dataset)
    resp.examples = [DatasetExampleResponse.model_validate(e) for e in examples]
    return resp


@router.get("/sample-dataset", response_class=PlainTextResponse)
async def get_sample_dataset_jsonl():
    """Download a pre-configured sample evaluation dataset in JSONL format."""
    lines = [json.dumps(row) for row in SAMPLE_DATASET_ROWS]
    return PlainTextResponse(content="\n".join(lines), media_type="application/x-jsonlines")


@router.get("/{dataset_id}", response_model=DatasetDetailResponse)
async def get_dataset(
    dataset_id: str,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dataset and its stored test examples."""
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.project_id == project.id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    ex_stmt = select(DatasetExample).where(DatasetExample.dataset_id == dataset.id).order_by(DatasetExample.created_at.asc())
    ex_res = await db.execute(ex_stmt)
    examples = ex_res.scalars().all()

    resp = DatasetDetailResponse.model_validate(dataset)
    resp.examples = [DatasetExampleResponse.model_validate(e) for e in examples]
    return resp


@router.post("/{dataset_id}/examples", response_model=DatasetExampleResponse, status_code=status.HTTP_201_CREATED)
async def add_example(
    dataset_id: str,
    example_in: DatasetExampleCreate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a single example to the dataset and increment example count."""
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.project_id == project.id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    meta_str = json.dumps(example_in.metadata) if example_in.metadata else None
    example = DatasetExample(
        dataset_id=dataset.id,
        input_text=example_in.input_text,
        expected_output=example_in.expected_output,
        context=example_in.context,
        metadata_json=meta_str,
    )
    db.add(example)
    dataset.example_count += 1
    dataset.version += 1
    await db.commit()
    await db.refresh(example)
    return DatasetExampleResponse.model_validate(example)


@router.post("/{dataset_id}/import-jsonl", response_model=DatasetDetailResponse)
async def import_jsonl(
    dataset_id: str,
    file: UploadFile,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Import JSONL records into dataset.
    Performs rigorous schema validation with line-specific errors.
    """
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.project_id == project.id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    content_bytes = await file.read()
    content_text = content_bytes.decode("utf-8")
    lines = content_text.splitlines()

    imported_examples = []
    errors = []

    for idx, line in enumerate(lines, start=1):
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
            if not isinstance(data, dict):
                errors.append(f"Line {idx}: Record must be a JSON object")
                continue
            input_text = data.get("input_text") or data.get("input") or data.get("prompt")
            if not input_text or not str(input_text).strip():
                errors.append(f"Line {idx}: Missing required 'input_text' field")
                continue
            expected_output = data.get("expected_output") or data.get("output") or data.get("target")
            context = data.get("context")
            metadata = data.get("metadata")

            meta_str = json.dumps(metadata) if metadata else None
            ex = DatasetExample(
                dataset_id=dataset.id,
                input_text=str(input_text).strip(),
                expected_output=str(expected_output).strip() if expected_output else None,
                context=str(context).strip() if context else None,
                metadata_json=meta_str,
            )
            imported_examples.append(ex)
        except json.JSONDecodeError as e:
            errors.append(f"Line {idx}: Malformed JSON syntax - {str(e)}")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Failed to import JSONL dataset due to validation errors", "errors": errors[:20]},
        )

    for ex in imported_examples:
        db.add(ex)

    dataset.example_count += len(imported_examples)
    dataset.version += 1
    await db.commit()
    await db.refresh(dataset)

    # Return updated dataset
    ex_stmt = select(DatasetExample).where(DatasetExample.dataset_id == dataset.id)
    ex_res = await db.execute(ex_stmt)
    examples = ex_res.scalars().all()

    resp = DatasetDetailResponse.model_validate(dataset)
    resp.examples = [DatasetExampleResponse.model_validate(e) for e in examples]
    return resp


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: str,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a dataset and all associated examples."""
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.project_id == project.id)
    res = await db.execute(stmt)
    dataset = res.scalars().first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    await db.delete(dataset)
    await db.commit()
    return None
