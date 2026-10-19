from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Sentinel AI"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database
    # Default to local SQLite with async driver for zero-setup local dev/test,
    # easily overridden with PostgreSQL: postgresql+asyncpg://user:pass@localhost:5432/sentinel
    DATABASE_URL: str = "sqlite+aiosqlite:///./sentinel.db"

    # Security & Auth
    SECRET_KEY: str = "sentinel-super-secret-development-key-change-in-production-32bytes!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Optional External AI Provider
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    DEFAULT_EVAL_MODEL: str = "gpt-4o-mini"


settings = Settings()
