# Sentinel AI System Architecture

## Overview
Sentinel AI is an enterprise-grade LLM Observability, Evaluation, and Reliability platform. The platform is architected around a high-throughput trace ingestion pipeline, an isolated multi-tenant data model, a deterministic evaluation engine, and a vector-grounded RAG playground.

```mermaid
graph TD
    subgraph Client Application
        App[External AI Application] -->|HTTP / JSON| SDK[sentinel_ai Python SDK]
    end

    subgraph Sentinel Ingestion & API Gateway
        SDK -->|X-API-Key Ingest| IngestAPI["/api/v1/traces/ingest"]
        Frontend[Vite React UI] -->|JWT Bearer| CoreAPI["/api/v1/* (Projects, Datasets, Evals)"]
    end

    subgraph Security & Tenant Boundaries
        CoreAPI --> AuthGuard[JWT & Tenant Boundary Guard]
        IngestAPI --> KeyHasher[SHA-256 API Key Verifier]
    end

    subgraph Service Engines
        AuthGuard --> TraceService[Trace & Analytics Engine]
        AuthGuard --> EvalEngine[Evaluation Engine]
        AuthGuard --> RagEngine[RAG Vector Playground]
        
        EvalEngine --> ExactMatch[Exact Match & Token F1]
        EvalEngine --> Relevance[Answer Relevance]
        EvalEngine --> Faithfulness[Faithfulness & Groundedness]
        EvalEngine --> ModelJudge[OpenAI Compatible / Local Fallback]
        
        RagEngine --> Chunker[Overlapping Word Chunker]
        RagEngine --> Retriever[Deterministic TF-IDF Vector Index]
    end

    subgraph Storage Layer
        TraceService --> DB[(PostgreSQL / SQLite Async)]
        EvalEngine --> DB
        RagEngine --> DB
        KeyHasher --> DB
    end
```

## Architectural Modules

### 1. Ingestion Pipeline
- **Endpoint**: `/api/v1/traces/ingest`
- **Authentication**: High-entropy API key passed via `X-API-Key` or `Authorization: Bearer sentinel_...`.
- **Payload Validation**: Strict Pydantic models validate model identifiers, operation categories, token counts, execution latency, metadata JSON, and child span trees.
- **Cost Estimation**: Calculates dollar expenditure per request based on published token rates for models (GPT-4o, Claude 3.5 Sonnet, Llama-3, etc.) while cleanly separating estimated cost from provider-reported invoices.

### 2. Evaluation Engine
- **Deterministic Metrics**:
  - **Exact Match**: Normalized, case-insensitive string equality.
  - **Token Precision, Recall, F1**: Multiset token intersection.
  - **Answer Relevance**: Documented query keyword density and token coverage ratio.
  - **Faithfulness / Groundedness**: Ratio of generated claim tokens directly grounded in retrieved context sentences.
  - **Context Precision & Recall**: Retrieval signal-to-noise ratio and ground-truth capture rate.
- **Provider Abstraction**:
  - Automatically switches between external LLM providers (when `OPENAI_API_KEY` is supplied) and deterministic local simulation fallback (guaranteeing zero paid external API requirements).

### 3. RAG Knowledge Playground
- **Document Chunking**: Configurable sliding window tokenizer preserving word boundaries with user-specified `chunk_size` and `chunk_overlap`.
- **Retrieval Engine**: Deterministic TF-IDF Vector Retriever with L2-normalized cosine similarity scoring. Runs locally without requiring heavyweight binary C extensions or external paid embedding services.
- **Scoring**: Computes real-time Answer Faithfulness and Query Relevance for every test query.

### 4. Multi-Tenant Security & Isolation
- Every database query strictly filters by `workspace.owner_id == current_user.id` or `api_key.project_id == project.id`.
- Foreign key cascading deletes clean up child datasets, examples, runs, results, and chunks when a parent entity is deleted.
