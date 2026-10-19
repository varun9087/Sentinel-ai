from datetime import datetime, timezone
import uuid
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan", lazy="selectin")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    owner = relationship("User", back_populates="workspaces", lazy="selectin")
    projects = relationship("Project", back_populates="workspace", cascade="all, delete-orphan", lazy="selectin")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    workspace = relationship("Workspace", back_populates="projects", lazy="selectin")
    api_keys = relationship("ApiKey", back_populates="project", cascade="all, delete-orphan", lazy="selectin")
    traces = relationship("Trace", back_populates="project", cascade="all, delete-orphan", lazy="selectin")
    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan", lazy="selectin")
    evaluation_runs = relationship("EvaluationRun", back_populates="project", cascade="all, delete-orphan", lazy="selectin")
    rag_collections = relationship("RagCollection", back_populates="project", cascade="all, delete-orphan", lazy="selectin")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    key_prefix = Column(String(32), nullable=False)
    key_hash = Column(String(64), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="api_keys", lazy="selectin")


class Trace(Base):
    __tablename__ = "traces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    trace_id = Column(String(128), index=True, nullable=False)
    name = Column(String(255), default="llm_request", nullable=False)
    operation_type = Column(String(64), default="generation", nullable=False, index=True)  # generation, embedding, rag, tool
    model = Column(String(128), default="unknown", nullable=False, index=True)
    provider = Column(String(64), default="custom", nullable=False)
    status = Column(String(32), default="success", nullable=False, index=True)  # success, error, running
    latency_ms = Column(Float, default=0.0, nullable=False)
    input_tokens = Column(Integer, default=0, nullable=False)
    output_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    estimated_cost = Column(Float, default=0.0, nullable=False)
    input_payload = Column(Text, nullable=True)
    output_payload = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    project = relationship("Project", back_populates="traces", lazy="selectin")
    spans = relationship("Span", back_populates="trace", cascade="all, delete-orphan", lazy="selectin")


class Span(Base):
    __tablename__ = "spans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    trace_id = Column(String(36), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, index=True)
    span_id = Column(String(128), nullable=False)
    parent_span_id = Column(String(128), nullable=True)
    name = Column(String(255), nullable=False)
    span_type = Column(String(64), default="llm", nullable=False)  # llm, retrieval, tool, chain
    duration_ms = Column(Float, default=0.0, nullable=False)
    input_payload = Column(Text, nullable=True)
    output_payload = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    trace = relationship("Trace", back_populates="spans", lazy="selectin")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    example_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    project = relationship("Project", back_populates="datasets", lazy="selectin")
    examples = relationship("DatasetExample", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin")
    evaluations = relationship("EvaluationRun", back_populates="dataset", lazy="selectin")


class DatasetExample(Base):
    __tablename__ = "dataset_examples"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    input_text = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=True)
    context = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    dataset = relationship("Dataset", back_populates="examples", lazy="selectin")


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(32), default="pending", nullable=False, index=True)  # pending, running, completed, failed
    model_name = Column(String(128), default="local-evaluator", nullable=False)
    prompt_template = Column(Text, nullable=True)
    selected_metrics = Column(Text, nullable=False)  # JSON string list
    total_examples = Column(Integer, default=0, nullable=False)
    completed_examples = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    avg_latency_ms = Column(Float, default=0.0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    estimated_cost = Column(Float, default=0.0, nullable=False)
    summary_scores = Column(Text, nullable=True)  # JSON dict of aggregate metric averages
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="evaluation_runs", lazy="selectin")
    dataset = relationship("Dataset", back_populates="evaluations", lazy="selectin")
    results = relationship("EvaluationResult", back_populates="run", cascade="all, delete-orphan", lazy="selectin")


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("evaluation_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    example_id = Column(String(36), ForeignKey("dataset_examples.id", ondelete="SET NULL"), nullable=True)
    input_text = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=True)
    generated_output = Column(Text, nullable=True)
    context = Column(Text, nullable=True)
    scores = Column(Text, nullable=False)  # JSON dict of metric scores for this row
    passed = Column(Boolean, default=True, nullable=False)
    latency_ms = Column(Float, default=0.0, nullable=False)
    token_count = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    run = relationship("EvaluationRun", back_populates="results", lazy="selectin")


class RagCollection(Base):
    __tablename__ = "rag_collections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    chunk_size = Column(Integer, default=500, nullable=False)
    chunk_overlap = Column(Integer, default=50, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    project = relationship("Project", back_populates="rag_collections", lazy="selectin")
    documents = relationship("RagDocument", back_populates="collection", cascade="all, delete-orphan", lazy="selectin")
    chunks = relationship("RagChunk", back_populates="collection", cascade="all, delete-orphan", lazy="selectin")


class RagDocument(Base):
    __tablename__ = "rag_documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    collection_id = Column(String(36), ForeignKey("rag_collections.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    collection = relationship("RagCollection", back_populates="documents", lazy="selectin")
    chunks = relationship("RagChunk", back_populates="document", cascade="all, delete-orphan", lazy="selectin")


class RagChunk(Base):
    __tablename__ = "rag_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    collection_id = Column(String(36), ForeignKey("rag_collections.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("rag_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # JSON array of floats or sparse vector
    token_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    collection = relationship("RagCollection", back_populates="chunks", lazy="selectin")
    document = relationship("RagDocument", back_populates="chunks", lazy="selectin")
