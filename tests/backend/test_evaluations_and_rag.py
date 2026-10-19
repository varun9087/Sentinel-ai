import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dataset_evaluation_and_comparison(client: AsyncClient, auth_headers: dict):
    # 1. Get project
    proj_resp = await client.get("/api/v1/projects", headers=auth_headers)
    project_id = proj_resp.json()[0]["id"]

    # 2. Create dataset
    ds_resp = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={
            "name": "Customer Support FAQ",
            "description": "Evaluation set for customer helpdesk queries",
            "initial_examples": [
                {
                    "input_text": "What is the return policy?",
                    "expected_output": "Products can be returned within 30 days of delivery.",
                    "context": "Return Policy: Products can be returned within 30 days of delivery for a full refund."
                },
                {
                    "input_text": "How do I contact support?",
                    "expected_output": "You can reach support by email at support@company.com.",
                    "context": "Support channels: You can reach support by email at support@company.com or phone at 1-800-555."
                }
            ]
        },
        headers=auth_headers,
    )
    assert ds_resp.status_code == 201
    dataset = ds_resp.json()
    dataset_id = dataset["id"]
    assert dataset["example_count"] == 2

    # 3. Launch Baseline Evaluation Run
    run1_resp = await client.post(
        f"/api/v1/projects/{project_id}/evaluations",
        json={
            "name": "Baseline Model Run",
            "dataset_id": dataset_id,
            "model_name": "local-evaluator",
            "prompt_template": "Answer this customer query: {input}",
            "selected_metrics": ["exact_match", "token_f1", "answer_relevance", "faithfulness", "latency"]
        },
        headers=auth_headers,
    )
    assert run1_resp.status_code == 201
    run1 = run1_resp.json()
    assert run1["status"] == "completed"
    assert run1["completed_examples"] == 2
    assert "token_f1" in run1["summary_scores"]
    assert "faithfulness" in run1["summary_scores"]
    assert len(run1["results"]) == 2

    # 4. Launch Candidate Evaluation Run (e.g. improved prompt or model)
    run2_resp = await client.post(
        f"/api/v1/projects/{project_id}/evaluations",
        json={
            "name": "Candidate Prompt v2",
            "dataset_id": dataset_id,
            "model_name": "local-evaluator",
            "prompt_template": "You are a customer assistant. Respond accurately based on context: {input}",
            "selected_metrics": ["exact_match", "token_f1", "answer_relevance", "faithfulness", "latency"]
        },
        headers=auth_headers,
    )
    assert run2_resp.status_code == 201
    run2 = run2_resp.json()
    assert run2["status"] == "completed"

    # 5. Compare the two evaluation runs
    comp_resp = await client.get(
        f"/api/v1/projects/{project_id}/evaluations/compare/{run1['id']}/{run2['id']}",
        headers=auth_headers,
    )
    assert comp_resp.status_code == 200
    comp_data = comp_resp.json()
    assert "metric_diffs" in comp_data
    assert "latency_diff" in comp_data
    assert "cost_diff" in comp_data
    assert "regressions" in comp_data
    assert "improvements" in comp_data


@pytest.mark.asyncio
async def test_rag_playground_workflow(client: AsyncClient, auth_headers: dict):
    # 1. Get project
    proj_resp = await client.get("/api/v1/projects", headers=auth_headers)
    project_id = proj_resp.json()[0]["id"]

    # 2. Create RAG collection
    col_resp = await client.post(
        f"/api/v1/projects/{project_id}/rag/collections",
        json={
            "name": "Product Documentation",
            "description": "Knowledge base for company knowledge",
            "chunk_size": 100,
            "chunk_overlap": 20
        },
        headers=auth_headers,
    )
    assert col_resp.status_code == 201
    collection = col_resp.json()
    collection_id = collection["id"]

    # 3. Add Document
    doc_resp = await client.post(
        f"/api/v1/projects/{project_id}/rag/collections/{collection_id}/documents",
        json={
            "title": "Authentication & API Key Guide",
            "content": (
                "Sentinel AI generates 32-byte cryptographic API keys prefixed with sentinel_. "
                "Keys are securely hashed using SHA-256 before storage. "
                "Users must store the raw key safely as it is only displayed once upon creation. "
                "Key revocation takes effect immediately across all ingestion endpoints."
            )
        },
        headers=auth_headers,
    )
    assert doc_resp.status_code == 201
    doc_data = doc_resp.json()
    assert len(doc_data["chunks"]) > 0

    # 4. Query RAG Collection
    query_resp = await client.post(
        f"/api/v1/projects/{project_id}/rag/collections/{collection_id}/query",
        json={
            "query": "How are API keys hashed in Sentinel AI?",
            "top_k": 2,
            "generate_answer": True
        },
        headers=auth_headers,
    )
    assert query_resp.status_code == 200
    query_data = query_resp.json()
    assert len(query_data["retrieved_chunks"]) > 0
    assert query_data["retrieved_chunks"][0]["similarity_score"] > 0.0
    assert query_data["faithfulness_score"] >= 0.0
    assert query_data["relevance_score"] >= 0.0
    assert query_data["generated_answer"] is not None
