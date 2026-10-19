from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.deps import get_project_for_user
from backend.app.core.security import generate_api_key_secret
from backend.app.models import ApiKey, Project
from backend.app.schemas import ApiKeyCreate, ApiKeyCreatedResponse, ApiKeyResponse

router = APIRouter(prefix="/projects/{project_id}/keys", tags=["API Keys"])


@router.get("", response_model=List[ApiKeyResponse])
async def list_api_keys(
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List ingestion API keys for a project.
    Security: Never exposes raw secret keys or stored hashes.
    """
    stmt = (
        select(ApiKey)
        .where(ApiKey.project_id == project.id)
        .order_by(ApiKey.created_at.desc())
    )
    result = await db.execute(stmt)
    keys = result.scalars().all()
    return [ApiKeyResponse.model_validate(k) for k in keys]


@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    key_in: ApiKeyCreate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate high-entropy ingestion API key.
    Security: The `raw_key` is displayed ONLY ONCE in this response.
    Only the SHA-256 hash is persisted in the database.
    """
    raw_key, key_hash, key_prefix = generate_api_key_secret(prefix="sentinel_")

    api_key = ApiKey(
        project_id=project.id,
        name=key_in.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        is_active=True,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    resp_dict = {
        "id": api_key.id,
        "project_id": api_key.project_id,
        "name": api_key.name,
        "key_prefix": api_key.key_prefix,
        "is_active": api_key.is_active,
        "created_at": api_key.created_at,
        "revoked_at": api_key.revoked_at,
        "last_used_at": api_key.last_used_at,
        "raw_key": raw_key,
    }
    return ApiKeyCreatedResponse(**resp_dict)


@router.delete("/{key_id}", response_model=ApiKeyResponse)
async def revoke_api_key(
    key_id: str,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an active API key immediately."""
    stmt = select(ApiKey).where(ApiKey.id == key_id, ApiKey.project_id == project.id)
    result = await db.execute(stmt)
    api_key = result.scalars().first()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    api_key.is_active = False
    api_key.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(api_key)
    return ApiKeyResponse.model_validate(api_key)
