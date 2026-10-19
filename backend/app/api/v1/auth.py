from datetime import datetime, timezone
import re
import secrets
from backend.app.core.config import settings
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_user
from backend.app.core.security import create_access_token, hash_password, verify_password
from backend.app.models import Project, User, Workspace
from backend.app.schemas import Token, UserCreate, UserLogin, UserResponse, WorkspaceResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[-\s]+", "-", text)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account and bootstrap their initial workspace and project."""
    stmt = select(User).where(User.email == user_in.email.lower())
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create User
    user = User(
        email=user_in.email.lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name or user_in.email.split("@")[0].capitalize(),
    )
    db.add(user)
    await db.flush()

    # Create Default Workspace
    ws_name = f"{user.full_name}'s Workspace"
    base_slug = slugify(user.full_name or "workspace")
    slug = f"{base_slug}-{user.id[:8]}"
    workspace = Workspace(name=ws_name, slug=slug, owner_id=user.id)
    db.add(workspace)
    await db.flush()

    # Create Default Project
    project = Project(
        workspace_id=workspace.id,
        name="Production LLM",
        description="Default production AI application monitoring and evaluation project.",
    )
    db.add(project)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        active_workspace_id=workspace.id,
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate with email and password."""
    stmt = select(User).where(User.email == credentials.email.lower())
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive",
        )

    # Get active workspace
    ws_stmt = select(Workspace).where(Workspace.owner_id == user.id)
    ws_res = await db.execute(ws_stmt)
    workspace = ws_res.scalars().first()

    token = create_access_token(user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        active_workspace_id=workspace.id if workspace else None,
    )


@router.post("/demo-login", response_model=Token)
async def demo_login(db: AsyncSession = Depends(get_db)):
    """
    Convenient one-click demo login for evaluators and reviewers.
    Creates or logs in as the demo user with pre-seeded demo environment.
    """
    if settings.ENVIRONMENT != "development":
        raise HTTPException(status_code=404, detail="Demo access is only available in development")
    demo_email = "demo@sentinel.ai"
    stmt = select(User).where(User.email == demo_email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        user = User(
            email=demo_email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name="Sentinel Demo User",
        )
        db.add(user)
        await db.flush()

        workspace = Workspace(
            name="Sentinel AI Labs",
            slug=f"sentinel-demo-{user.id[:8]}",
            owner_id=user.id,
        )
        db.add(workspace)
        await db.flush()

        project = Project(
            workspace_id=workspace.id,
            name="Customer Copilot LLM",
            description="Production customer support assistant and RAG pipeline.",
        )
        db.add(project)
        await db.commit()
        await db.refresh(user)
    else:
        ws_stmt = select(Workspace).where(Workspace.owner_id == user.id)
        ws_res = await db.execute(ws_stmt)
        workspace = ws_res.scalars().first()

    token = create_access_token(user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
        active_workspace_id=workspace.id if workspace else None,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return profile for the currently authenticated user."""
    return UserResponse.model_validate(current_user)
