import os
import sys

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set testing environment
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_sentinel.db"

from backend.app.core.config import settings
from backend.app.core.database import Base, get_db
from backend.app.main import app

# Test database engine
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_sentinel.db"
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
TestingSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True, scope="function")
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    """Fixture that registers a user and returns authentication headers."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "tester@sentinel.ai", "password": "SecureTestPassword123!", "full_name": "Test Engineer"}
    )
    assert resp.status_code == 201
    data = resp.json()
    token = data["access_token"]
    return {"Authorization": f"Bearer {token}"}
