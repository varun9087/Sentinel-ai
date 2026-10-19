from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.security import decode_access_token, hash_api_key
from backend.app.models import ApiKey, Project, User, Workspace

security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate JWT token and return active user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    stmt = select(User).where(User.id == user_id, User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


async def get_project_for_user(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """
    Enforce workspace and project boundary authorization.
    Verifies that the requested project belongs to a workspace owned by current_user.
    Prevents cross-workspace data access!
    """
    stmt = (
        select(Project)
        .join(Workspace, Project.workspace_id == Workspace.id)
        .where(Project.id == project_id, Workspace.owner_id == current_user.id)
    )
    result = await db.execute(stmt)
    project = result.scalars().first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied",
        )
    return project


async def verify_ingest_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """
    Authenticate an ingestion event via high-entropy API key.
    Accepts X-API-Key header or Authorization: Bearer sentinel_...
    Validates SHA-256 hash against database.
    Updates last_used_at.
    """
    raw_key = None
    if x_api_key:
        raw_key = x_api_key.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        raw_key = authorization[7:].strip()

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide via X-API-Key header or Bearer token.",
        )

    # Hash incoming key
    key_hash = hash_api_key(raw_key)
    stmt = select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active == True)
    result = await db.execute(stmt)
    api_key_obj = result.scalars().first()

    if not api_key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )

    # Update last_used_at timestamp
    api_key_obj.last_used_at = datetime.now(timezone.utc)
    await db.flush()

    # Load project
    project_stmt = select(Project).where(Project.id == api_key_obj.project_id)
    project_res = await db.execute(project_stmt)
    project = project_res.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project associated with API key not found",
        )

    return project
