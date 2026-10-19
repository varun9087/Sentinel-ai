import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cross_workspace_isolation(client: AsyncClient):
    # 1. Register User A (Workspace A)
    user_a_res = await client.post(
        "/api/v1/auth/register",
        json={"email": "tenant_a@sentinel.ai", "password": "TenantPasswordA1!", "full_name": "Tenant A"}
    )
    token_a = user_a_res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User A's project
    proj_a_res = await client.get("/api/v1/projects", headers=headers_a)
    proj_a_id = proj_a_res.json()[0]["id"]

    # 2. Register User B (Workspace B)
    user_b_res = await client.post(
        "/api/v1/auth/register",
        json={"email": "tenant_b@sentinel.ai", "password": "TenantPasswordB1!", "full_name": "Tenant B"}
    )
    token_b = user_b_res.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. User B attempts to access User A's project -> Must be rejected (404/Not Found or Access Denied)
    breach_proj = await client.get(f"/api/v1/projects/{proj_a_id}", headers=headers_b)
    assert breach_proj.status_code == 404

    # 4. User B attempts to view User A's traces -> Must be rejected (404)
    breach_traces = await client.get(f"/api/v1/projects/{proj_a_id}/traces", headers=headers_b)
    assert breach_traces.status_code == 404

    # 5. User B attempts to view User A's API keys -> Must be rejected (404)
    breach_keys = await client.get(f"/api/v1/projects/{proj_a_id}/keys", headers=headers_b)
    assert breach_keys.status_code == 404

    # 6. User B attempts to view User A's datasets -> Must be rejected (404)
    breach_datasets = await client.get(f"/api/v1/projects/{proj_a_id}/datasets", headers=headers_b)
    assert breach_datasets.status_code == 404
