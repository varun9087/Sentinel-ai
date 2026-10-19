import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_registration_and_login(client: AsyncClient):
    # 1. Register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "alice@sentinel.ai", "password": "Password123!", "full_name": "Alice Developer"}
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@sentinel.ai"
    assert data["active_workspace_id"] is not None

    # 2. Duplicate registration rejected
    dup_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "alice@sentinel.ai", "password": "Password123!"}
    )
    assert dup_resp.status_code == 400

    # 3. Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice@sentinel.ai", "password": "Password123!"}
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

    # 4. Invalid login rejected
    bad_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice@sentinel.ai", "password": "WrongPassword!"}
    )
    assert bad_login.status_code == 401

    # 5. Access protected /me
    token = login_resp.json()["access_token"]
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "alice@sentinel.ai"


@pytest.mark.asyncio
async def test_demo_login(client: AsyncClient):
    resp = await client.post("/api/v1/auth/demo-login")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "demo@sentinel.ai"
    assert "access_token" in data
