from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.api.v1.api_keys import router as api_keys_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.datasets import router as datasets_router
from backend.app.api.v1.evaluations import router as evaluations_router
from backend.app.api.v1.projects import router as projects_router
from backend.app.api.v1.rag import router as rag_router
from backend.app.api.v1.system import router as system_router
from backend.app.api.v1.traces import router as traces_router
from backend.app.core.config import settings
from backend.app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Sentinel AI — Enterprise LLM Observability, Evaluation, and Reliability Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(projects_router, prefix=settings.API_V1_STR)
app.include_router(api_keys_router, prefix=settings.API_V1_STR)
app.include_router(traces_router, prefix=settings.API_V1_STR)
app.include_router(datasets_router, prefix=settings.API_V1_STR)
app.include_router(evaluations_router, prefix=settings.API_V1_STR)
app.include_router(rag_router, prefix=settings.API_V1_STR)
app.include_router(system_router, prefix=settings.API_V1_STR)
app.include_router(system_router)  # root /health


@app.get("/")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "tagline": "Monitor. Evaluate. Trust your AI.",
        "documentation": "/api/docs",
        "health": "/health",
    }
