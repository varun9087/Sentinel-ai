import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_complete_e2e_platform_lifecycle(client: AsyncClient):
    """
    Complete End-to-End Workflow Verification:
    1. Start the application / enter supported development environment.
    2. Register user account.
    3. Verify and create project.
    4. Generate high-entropy ingestion API key (retrieve raw key once).
    5. Submit an LLM trace with spans through documented Ingestion API.
    6. Verify trace and calculated aggregates appear in the dashboard.
    7. Import an evaluation dataset with ground-truth records.
    8. Run an evaluation run with selected metrics.
    9. Inspect individual per-example scores and results.
    10. Run candidate evaluation and compare the two runs (diffs, regressions).
    11. Verify multi-tenant authorization prevents access to another workspace.
    """

    # --- Step 1 & 2: Register user ---
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "e2e_engineer@sentinel.ai",
            "password": "MasterE2EPassword2026!",
            "full_name": "E2E Lead Engineer"
        }
    )
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
    auth_data = reg_resp.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # --- Step 3: Create a project ---
    proj_resp = await client.post(
        "/api/v1/projects",
        json={
            "name": "Customer Support Copilot v2",
            "description": "Production LLM service for customer assistance"
        },
        headers=headers
    )
    assert proj_resp.status_code == 201
    project = proj_resp.json()
    project_id = project["id"]
    assert project["name"] == "Customer Support Copilot v2"

    # --- Step 4: Generate ingestion API key ---
    key_resp = await client.post(
        f"/api/v1/projects/{project_id}/keys",
        json={"name": "E2E Production Key"},
        headers=headers
    )
    assert key_resp.status_code == 201
    key_data = key_resp.json()
    assert "raw_key" in key_data
    raw_key = key_data["raw_key"]
    assert raw_key.startswith("sentinel_")

    # --- Step 5: Submit a trace through documented API with spans ---
    trace_payload = {
        "name": "support_chat_resolution",
        "operation_type": "rag",
        "model": "gpt-4o",
        "provider": "openai",
        "status": "success",
        "latency_ms": 340.2,
        "input_tokens": 180,
        "output_tokens": 85,
        "input_payload": "How do I update payment methods for annual subscriptions?",
        "output_payload": "Navigate to Workspace Settings -> Billing -> Payment Methods to update credit cards.",
        "spans": [
            {
                "span_id": "span_retrieval_1",
                "name": "kb_retrieval",
                "span_type": "retrieval",
                "duration_ms": 52.0
            },
            {
                "span_id": "span_llm_1",
                "name": "gpt4o_completion",
                "span_type": "llm",
                "duration_ms": 288.2
            }
        ]
    }
    ingest_resp = await client.post(
        "/api/v1/traces/ingest",
        json=trace_payload,
        headers={"X-API-Key": raw_key}
    )
    assert ingest_resp.status_code == 201
    ingested_trace = ingest_resp.json()
    assert ingested_trace["model"] == "gpt-4o"
    assert ingested_trace["total_tokens"] == 265
    assert ingested_trace["estimated_cost"] > 0

    # --- Step 6: Verify trace appears in Dashboard and Trace List ---
    traces_list_resp = await client.get(
        f"/api/v1/projects/{project_id}/traces",
        headers=headers
    )
    assert traces_list_resp.status_code == 200
    traces_list = traces_list_resp.json()
    assert traces_list["total"] == 1
    assert traces_list["items"][0]["trace_id"] == ingested_trace["trace_id"]

    dashboard_resp = await client.get(
        f"/api/v1/projects/{project_id}/dashboard",
        headers=headers
    )
    assert dashboard_resp.status_code == 200
    dash_metrics = dashboard_resp.json()
    assert dash_metrics["total_requests"] == 1
    assert dash_metrics["successful_requests"] == 1
    assert dash_metrics["error_rate"] == 0.0
    assert dash_metrics["total_tokens"] == 265
    assert len(dash_metrics["model_breakdown"]) == 1

    # --- Step 7: Create and import an evaluation dataset ---
    ds_resp = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={
            "name": "Support Q&A Benchmark",
            "description": "Golden reference set for customer support queries",
            "initial_examples": [
                {
                    "input_text": "What is the return policy?",
                    "expected_output": "Items can be returned within 30 days of purchase for a full refund.",
                    "context": "Return Policy: Items can be returned within 30 days of purchase for a full refund."
                },
                {
                    "input_text": "Where is the billing dashboard located?",
                    "expected_output": "The billing dashboard is located under Workspace Settings.",
                    "context": "Billing Information: The billing dashboard is located under Workspace Settings."
                }
            ]
        },
        headers=headers
    )
    assert ds_resp.status_code == 201
    dataset = ds_resp.json()
    dataset_id = dataset["id"]
    assert dataset["example_count"] == 2

    # --- Step 8: Run an evaluation run ---
    eval_resp = await client.post(
        f"/api/v1/projects/{project_id}/evaluations",
        json={
            "name": "Run #1 - Baseline Prompt",
            "dataset_id": dataset_id,
            "model_name": "local-evaluator",
            "prompt_template": "Answer using the context: {input}",
            "selected_metrics": ["exact_match", "token_f1", "answer_relevance", "faithfulness", "latency"]
        },
        headers=headers
    )
    assert eval_resp.status_code == 201
    run1 = eval_resp.json()
    assert run1["status"] == "completed"
    assert run1["total_examples"] == 2
    assert run1["completed_examples"] == 2
    assert run1["summary_scores"]["token_f1"] is not None

    # --- Step 9: Inspect individual per-example results ---
    run1_detail = await client.get(
        f"/api/v1/projects/{project_id}/evaluations/{run1['id']}",
        headers=headers
    )
    assert run1_detail.status_code == 200
    detail_data = run1_detail.json()
    assert len(detail_data["results"]) == 2
    first_result = detail_data["results"][0]
    assert "token_f1" in first_result["scores"]
    assert "faithfulness" in first_result["scores"]

    # --- Step 10: Run second evaluation and compare runs ---
    eval2_resp = await client.post(
        f"/api/v1/projects/{project_id}/evaluations",
        json={
            "name": "Run #2 - Candidate Prompt",
            "dataset_id": dataset_id,
            "model_name": "local-evaluator",
            "prompt_template": "Provide an exact, grounded answer: {input}",
            "selected_metrics": ["exact_match", "token_f1", "answer_relevance", "faithfulness", "latency"]
        },
        headers=headers
    )
    assert eval2_resp.status_code == 201
    run2 = eval2_resp.json()

    comp_resp = await client.get(
        f"/api/v1/projects/{project_id}/evaluations/compare/{run1['id']}/{run2['id']}",
        headers=headers
    )
    assert comp_resp.status_code == 200
    comparison = comp_resp.json()
    assert "metric_diffs" in comparison
    assert "latency_diff" in comparison
    assert "cost_diff" in comparison
    assert "regressions" in comparison
    assert "improvements" in comparison

    # --- Step 11: Verify multi-tenant authorization boundary ---
    # Register an attacker / another tenant user
    other_user_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "external_attacker@othercompany.com",
            "password": "AttackerPassword123!",
            "full_name": "External User"
        }
    )
    other_token = other_user_res.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # Attempt to access project_id -> Must be 404 / Forbidden
    stolen_project = await client.get(f"/api/v1/projects/{project_id}", headers=other_headers)
    assert stolen_project.status_code == 404

    # Attempt to access traces -> Must be 404
    stolen_traces = await client.get(f"/api/v1/projects/{project_id}/traces", headers=other_headers)
    assert stolen_traces.status_code == 404

    # Attempt to access API keys -> Must be 404
    stolen_keys = await client.get(f"/api/v1/projects/{project_id}/keys", headers=other_headers)
    assert stolen_keys.status_code == 404

    # Attempt to access evaluation runs -> Must be 404
    stolen_evals = await client.get(f"/api/v1/projects/{project_id}/evaluations", headers=other_headers)
    assert stolen_evals.status_code == 404
