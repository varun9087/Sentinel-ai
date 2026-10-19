from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ==========================================
# AUTH & USER SCHEMAS
# ==========================================
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    active_workspace_id: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


# ==========================================
# WORKSPACE & PROJECT SCHEMAS
# ==========================================
class WorkspaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceResponse(WorkspaceBase):
    id: str
    slug: str
    owner_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: str
    workspace_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# API KEY SCHEMAS
# ==========================================
class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ApiKeyResponse(BaseModel):
    id: str
    project_id: str
    name: str
    key_prefix: str
    is_active: bool
    created_at: datetime
    revoked_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApiKeyCreatedResponse(ApiKeyResponse):
    raw_key: str  # Only returned upon initial generation!


# ==========================================
# TRACE & OBSERVABILITY SCHEMAS
# ==========================================
class SpanCreate(BaseModel):
    span_id: str
    parent_span_id: Optional[str] = None
    name: str
    span_type: str = "llm"  # llm, retrieval, tool, chain
    duration_ms: float = 0.0
    input_payload: Optional[str] = None
    output_payload: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SpanResponse(BaseModel):
    id: str
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    name: str
    span_type: str
    duration_ms: float
    input_payload: Optional[str] = None
    output_payload: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TraceIngestRequest(BaseModel):
    trace_id: Optional[str] = None
    name: str = "llm_request"
    operation_type: str = "generation"  # generation, embedding, rag, tool
    model: str = "unknown"
    provider: str = "custom"
    status: str = "success"  # success, error, running
    latency_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost: Optional[float] = None
    input_payload: Optional[str] = None
    output_payload: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    spans: Optional[List[SpanCreate]] = None


class TraceResponse(BaseModel):
    id: str
    project_id: str
    trace_id: str
    name: str
    operation_type: str
    model: str
    provider: str
    status: str
    latency_ms: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost: float
    input_payload: Optional[str] = None
    output_payload: Optional[str] = None
    error_message: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime
    spans: List[SpanResponse] = []

    class Config:
        from_attributes = True


class TraceListResponse(BaseModel):
    items: List[TraceResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class DashboardMetricsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    error_requests: int
    error_rate: float
    avg_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    estimated_total_cost: float
    model_breakdown: List[Dict[str, Any]]
    volume_over_time: List[Dict[str, Any]]
    recent_failed_traces: List[TraceResponse]


# ==========================================
# DATASET SCHEMAS
# ==========================================
class DatasetExampleCreate(BaseModel):
    input_text: str = Field(..., min_length=1)
    expected_output: Optional[str] = None
    context: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DatasetExampleResponse(BaseModel):
    id: str
    dataset_id: str
    input_text: str
    expected_output: Optional[str] = None
    context: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    initial_examples: Optional[List[DatasetExampleCreate]] = None


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DatasetResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    version: int
    example_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DatasetDetailResponse(DatasetResponse):
    examples: List[DatasetExampleResponse] = []


# ==========================================
# EVALUATION SCHEMAS
# ==========================================
class EvaluationRunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    dataset_id: str
    model_name: str = "local-evaluator"  # e.g. local-evaluator, gpt-4o, gpt-4o-mini, mock-v2
    prompt_template: Optional[str] = "{input}"
    selected_metrics: List[str] = Field(
        default=["exact_match", "token_f1", "answer_relevance", "faithfulness", "latency"]
    )


class EvaluationResultResponse(BaseModel):
    id: str
    run_id: str
    example_id: Optional[str] = None
    input_text: str
    expected_output: Optional[str] = None
    generated_output: Optional[str] = None
    context: Optional[str] = None
    scores: Dict[str, float]
    passed: bool
    latency_ms: float
    token_count: int
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EvaluationRunResponse(BaseModel):
    id: str
    project_id: str
    dataset_id: str
    name: str
    status: str
    model_name: str
    prompt_template: Optional[str] = None
    selected_metrics: List[str]
    total_examples: int
    completed_examples: int
    error_count: int
    avg_latency_ms: float
    total_tokens: int
    estimated_cost: float
    summary_scores: Optional[Dict[str, float]] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EvaluationRunDetailResponse(EvaluationRunResponse):
    results: List[EvaluationResultResponse] = []


class ComparisonMetricDiff(BaseModel):
    baseline_value: float
    candidate_value: float
    absolute_diff: float
    percentage_change: float


class ComparisonExampleDiff(BaseModel):
    example_id: Optional[str]
    input_text: str
    expected_output: Optional[str]
    baseline_output: Optional[str]
    candidate_output: Optional[str]
    baseline_scores: Dict[str, float]
    candidate_scores: Dict[str, float]
    delta_score: float  # e.g. Candidate F1 - Baseline F1
    status: str  # improved, degraded, unchanged


class EvaluationComparisonResponse(BaseModel):
    baseline_run: EvaluationRunResponse
    candidate_run: EvaluationRunResponse
    metric_diffs: Dict[str, ComparisonMetricDiff]
    latency_diff: ComparisonMetricDiff
    token_diff: ComparisonMetricDiff
    cost_diff: ComparisonMetricDiff
    improved_count: int
    degraded_count: int
    unchanged_count: int
    regressions: List[ComparisonExampleDiff]
    improvements: List[ComparisonExampleDiff]


# ==========================================
# RAG PLAYGROUND SCHEMAS
# ==========================================
class RagCollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    chunk_size: int = Field(default=300, ge=50, le=2000)
    chunk_overlap: int = Field(default=50, ge=0, le=500)


class RagDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)


class RagChunkResponse(BaseModel):
    id: str
    collection_id: str
    document_id: str
    chunk_index: int
    content: str
    token_count: int

    class Config:
        from_attributes = True


class RagDocumentResponse(BaseModel):
    id: str
    collection_id: str
    title: str
    content: str
    created_at: datetime
    chunks: List[RagChunkResponse] = []

    class Config:
        from_attributes = True


class RagCollectionResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    chunk_size: int
    chunk_overlap: int
    total_documents: int = 0
    total_chunks: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class RagQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=3, ge=1, le=10)
    generate_answer: bool = True
    model: str = "local-generator"


class RetrievedChunk(BaseModel):
    chunk_id: str
    document_title: str
    content: str
    similarity_score: float
    rank: int


class RagQueryResponse(BaseModel):
    query: str
    retrieved_chunks: List[RetrievedChunk]
    generated_answer: Optional[str] = None
    faithfulness_score: float
    relevance_score: float
    latency_ms: float
    retrieval_method: str  # "TF-IDF + Cosine (Deterministic Local Fallback)" or "Dense Embeddings"
