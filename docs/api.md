# Sentinel AI API Reference

Base URL: `http://localhost:8000/api/v1`  
Interactive OpenAPI UI: `http://localhost:8000/api/docs`

---

## Authentication Endpoints

### 1. Register User
`POST /auth/register`
```json
{
  "email": "user@company.com",
  "password": "SecurePassword123!",
  "full_name": "Dev User"
}
```
**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": {
    "id": "uuid-...",
    "email": "user@company.com",
    "full_name": "Dev User",
    "is_active": true,
    "created_at": "2026-10-19T10:00:00Z"
  },
  "active_workspace_id": "ws-uuid-..."
}
```

### 2. Login User
`POST /auth/login`
```json
{
  "email": "user@company.com",
  "password": "SecurePassword123!"
}
```

### 3. Demo Quick Login
`POST /auth/demo-login`
Automatically provisions and logs in as `demo@sentinel.ai` for zero-setup evaluation.

---

## Trace Ingestion Endpoints

### 1. Ingest LLM Trace & Spans
`POST /traces/ingest`  
**Headers**: `X-API-Key: sentinel_live_...` or `Authorization: Bearer sentinel_live_...`

```json
{
  "name": "support_copilot_request",
  "operation_type": "rag",
  "model": "gpt-4o",
  "provider": "openai",
  "status": "success",
  "latency_ms": 320.5,
  "input_tokens": 140,
  "output_tokens": 65,
  "input_payload": "How do I upgrade to the Enterprise Sentinel tier?",
  "output_payload": "You can upgrade from Workspace Settings -> Billing.",
  "metadata": {
    "user_id": "usr_9918",
    "environment": "production"
  },
  "spans": [
    {
      "span_id": "span_retrieval_01",
      "name": "knowledge_retrieval",
      "span_type": "retrieval",
      "duration_ms": 45.2
    },
    {
      "span_id": "span_llm_01",
      "name": "gpt4o_completion",
      "span_type": "llm",
      "duration_ms": 275.3
    }
  ]
}
```
**Response (201 Created):**
```json
{
  "id": "uuid-...",
  "trace_id": "trc_4f8a12...",
  "name": "support_copilot_request",
  "operation_type": "rag",
  "model": "gpt-4o",
  "status": "success",
  "latency_ms": 320.5,
  "input_tokens": 140,
  "output_tokens": 65,
  "total_tokens": 205,
  "estimated_cost": 0.001000,
  "created_at": "2026-10-19T10:00:00Z"
}
```

### 2. Query Dashboard Analytics
`GET /projects/{project_id}/dashboard?days=7`  
**Headers**: `Authorization: Bearer <jwt_token>`  
**Response:**
```json
{
  "total_requests": 1480,
  "successful_requests": 1452,
  "error_requests": 28,
  "error_rate": 1.89,
  "avg_latency_ms": 285.4,
  "p95_latency_ms": 480.2,
  "p99_latency_ms": 720.0,
  "total_input_tokens": 210000,
  "total_output_tokens": 98500,
  "total_tokens": 308500,
  "estimated_total_cost": 1.4520,
  "model_breakdown": [
    { "model": "gpt-4o", "requests": 950, "tokens": 210000, "cost": 1.2500 },
    { "model": "gpt-4o-mini", "requests": 530, "tokens": 98500, "cost": 0.2020 }
  ],
  "volume_over_time": [ ... ],
  "recent_failed_traces": [ ... ]
}
```

---

## Evaluation Engine Endpoints

### 1. Launch Evaluation Run
`POST /projects/{project_id}/evaluations`
```json
{
  "name": "Zero-Shot Support Benchmark",
  "dataset_id": "dataset-uuid-...",
  "model_name": "local-evaluator",
  "prompt_template": "Answer using the context: {input}",
  "selected_metrics": ["exact_match", "token_f1", "answer_relevance", "faithfulness", "latency"]
}
```

### 2. Compare Two Evaluation Runs
`GET /projects/{project_id}/evaluations/compare/{baseline_id}/{candidate_id}`
Returns quality differences, latency differences, cost differences, and classified per-example regressions and improvements.

---

## RAG Playground Endpoints

### 1. Query Collection & Benchmark Retrieval
`POST /projects/{project_id}/rag/collections/{collection_id}/query`
```json
{
  "query": "What is the token limit for ingestion?",
  "top_k": 3,
  "generate_answer": true
}
```
**Response:**
```json
{
  "query": "What is the token limit for ingestion?",
  "retrieved_chunks": [
    {
      "chunk_id": "chunk-uuid-...",
      "document_title": "API Specification",
      "content": "...",
      "similarity_score": 0.8845,
      "rank": 1
    }
  ],
  "generated_answer": "...",
  "faithfulness_score": 0.9412,
  "relevance_score": 0.8500,
  "latency_ms": 48.2,
  "retrieval_method": "TF-IDF + Cosine Similarity (Deterministic Local Fallback)"
}
```
