import pytest
from httpx import AsyncClient
from sentinel_ai import Sentinel


@pytest.mark.asyncio
async def test_api_key_and_trace_ingestion(client: AsyncClient, auth_headers: dict):
    # 1. Get default project
    proj_resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert proj_resp.status_code == 200
    projects = proj_resp.json()
    assert len(projects) > 0
    project_id = projects[0]["id"]

    # 2. Create high-entropy ingestion API key
    key_resp = await client.post(
        f"/api/v1/projects/{project_id}/keys",
        json={"name": "Production Ingestion Key"},
        headers=auth_headers,
    )
    assert key_resp.status_code == 201
    key_data = key_resp.json()
    assert "raw_key" in key_data
    raw_key = key_data["raw_key"]
    assert raw_key.startswith("sentinel_")

    # Verify subsequent GET never returns the raw secret
    keys_list = await client.get(f"/api/v1/projects/{project_id}/keys", headers=auth_headers)
    assert keys_list.status_code == 200
    for k in keys_list.json():
        assert "raw_key" not in k
        assert "key_hash" not in k

    # 3. Ingest trace via X-API-Key
    trace_payload = {
        "name": "support_chat_generation",
        "operation_type": "generation",
        "model": "gpt-4o",
        "provider": "openai",
        "status": "success",
        "latency_ms": 320.5,
        "input_tokens": 150,
        "output_tokens": 75,
        "input_payload": "How do I reset my password?",
        "output_payload": "Click on Forgot Password on the sign in page.",
        "spans": [
            {
                "span_id": "spn_retrieval_1",
                "name": "vector_retrieval",
                "span_type": "retrieval",
                "duration_ms": 45.2,
            },
            {
                "span_id": "spn_llm_1",
                "name": "openai_completion",
                "span_type": "llm",
                "duration_ms": 275.3,
            }
        ]
    }

    ingest_resp = await client.post(
        "/api/v1/traces/ingest",
        json=trace_payload,
        headers={"X-API-Key": raw_key},
    )
    assert ingest_resp.status_code == 201
    trace_data = ingest_resp.json()
    assert trace_data["model"] == "gpt-4o"
    assert trace_data["total_tokens"] == 225
    assert trace_data["estimated_cost"] > 0.0

    # Ingest an error trace
    error_payload = {
        "name": "failed_call",
        "operation_type": "generation",
        "model": "gpt-4o",
        "status": "error",
        "latency_ms": 120.0,
        "input_tokens": 50,
        "output_tokens": 0,
        "error_message": "Rate limit exceeded on external provider",
    }
    err_resp = await client.post(
        "/api/v1/traces/ingest",
        json=error_payload,
        headers={"X-API-Key": raw_key},
    )
    assert err_resp.status_code == 201

    # 4. Query traces list
    list_resp = await client.get(f"/api/v1/projects/{project_id}/traces", headers=auth_headers)
    assert list_resp.status_code == 200
    traces_page = list_resp.json()
    assert traces_page["total"] == 2
    assert len(traces_page["items"]) == 2

    # 5. Query detailed trace with spans
    trace_id = trace_data["id"]
    detail_resp = await client.get(f"/api/v1/projects/{project_id}/traces/{trace_id}", headers=auth_headers)
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert len(detail_data["spans"]) == 2

    # 6. Verify Dashboard Metrics calculation
    dash_resp = await client.get(f"/api/v1/projects/{project_id}/dashboard", headers=auth_headers)
    assert dash_resp.status_code == 200
    metrics = dash_resp.json()
    assert metrics["total_requests"] == 2
    assert metrics["successful_requests"] == 1
    assert metrics["error_requests"] == 1
    assert metrics["error_rate"] == 50.0
    assert metrics["total_tokens"] == 275
    assert len(metrics["recent_failed_traces"]) == 1
    assert len(metrics["model_breakdown"]) >= 1

    # 7. Test Revocation
    key_id = key_data["id"]
    rev_resp = await client.delete(f"/api/v1/projects/{project_id}/keys/{key_id}", headers=auth_headers)
    assert rev_resp.status_code == 200
    assert rev_resp.json()["is_active"] is False

    # Attempt to ingest with revoked key -> 401
    bad_ingest = await client.post(
        "/api/v1/traces/ingest",
        json=trace_payload,
        headers={"X-API-Key": raw_key},
    )
    assert bad_ingest.status_code == 401
