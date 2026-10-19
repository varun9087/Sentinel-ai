from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.deps import get_current_user, get_project_for_user
from backend.app.models import Project, User, Workspace
from backend.app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all projects across user's authorized workspaces."""
    stmt = (
        select(Project)
        .join(Workspace, Project.workspace_id == Workspace.id)
        .where(Workspace.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    result = await db.execute(stmt)
    projects = result.scalars().all()
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project in the user's primary workspace."""
    ws_stmt = select(Workspace).where(Workspace.owner_id == current_user.id)
    ws_res = await db.execute(ws_stmt)
    workspace = ws_res.scalars().first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace available for this user.",
        )

    project = Project(
        workspace_id=workspace.id,
        name=project_in.name,
        description=project_in.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project: Project = Depends(get_project_for_user),
):
    """Get project details."""
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete project and associated resources."""
    await db.delete(project)
    await db.commit()
    return None
