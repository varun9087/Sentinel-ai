from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import get_db

router = APIRouter(tags=["System"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Operational health endpoint.
    Verifies database connectivity and provider configuration status without leaking secret values.
    """
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    provider_status = "configured" if settings.OPENAI_API_KEY else "local_deterministic_fallback"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "app_name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "database": db_status,
        "database_backend": "sqlite" if "sqlite" in settings.DATABASE_URL else "postgresql",
        "ai_provider_mode": provider_status,
        "deterministic_evaluation": "active",
    }
