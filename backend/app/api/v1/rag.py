import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.deps import get_project_for_user
from backend.app.models import Project, RagChunk, RagCollection, RagDocument
from backend.app.schemas import (
    RagCollectionCreate,
    RagCollectionResponse,
    RagDocumentCreate,
    RagDocumentResponse,
    RagQueryRequest,
    RagQueryResponse,
    RetrievedChunk,
)
from backend.app.services.eval_service import (
    calculate_answer_relevance,
    calculate_faithfulness,
    generate_model_output,
)
from backend.app.services.rag_service import DeterministicTfidfRetriever, chunk_text

router = APIRouter(prefix="/projects/{project_id}/rag", tags=["RAG Playground"])


@router.get("/collections", response_model=List[RagCollectionResponse])
async def list_collections(
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """List RAG document collections in project."""
    stmt = (
        select(RagCollection)
        .where(RagCollection.project_id == project.id)
        .order_by(desc(RagCollection.created_at))
    )
    res = await db.execute(stmt)
    collections = res.scalars().all()

    output = []
    for c in collections:
        doc_count = len(c.documents) if c.documents else 0
        chunk_count = len(c.chunks) if c.chunks else 0
        item = RagCollectionResponse(
            id=c.id,
            project_id=c.project_id,
            name=c.name,
            description=c.description,
            chunk_size=c.chunk_size,
            chunk_overlap=c.chunk_overlap,
            total_documents=doc_count,
            total_chunks=chunk_count,
            created_at=c.created_at,
        )
        output.append(item)
    return output


@router.post("/collections", response_model=RagCollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    col_in: RagCollectionCreate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new RAG knowledge collection."""
    collection = RagCollection(
        project_id=project.id,
        name=col_in.name,
        description=col_in.description,
        chunk_size=col_in.chunk_size,
        chunk_overlap=col_in.chunk_overlap,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return RagCollectionResponse(
        id=collection.id,
        project_id=collection.project_id,
        name=collection.name,
        description=collection.description,
        chunk_size=collection.chunk_size,
        chunk_overlap=collection.chunk_overlap,
        total_documents=0,
        total_chunks=0,
        created_at=collection.created_at,
    )


@router.post("/collections/{collection_id}/documents", response_model=RagDocumentResponse, status_code=status.HTTP_201_CREATED)
async def add_document(
    collection_id: str,
    doc_in: RagDocumentCreate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Add a document to the collection.
    Automatically segments the content into overlapping chunks based on collection parameters.
    """
    stmt = select(RagCollection).where(RagCollection.id == collection_id, RagCollection.project_id == project.id)
    res = await db.execute(stmt)
    collection = res.scalars().first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    document = RagDocument(
        collection_id=collection.id,
        title=doc_in.title,
        content=doc_in.content,
    )
    db.add(document)
    await db.flush()

    raw_chunks = chunk_text(doc_in.content, collection.chunk_size, collection.chunk_overlap)
    chunks = []
    for idx, text in enumerate(raw_chunks):
        chunk = RagChunk(
            collection_id=collection.id,
            document_id=document.id,
            chunk_index=idx,
            content=text,
            token_count=len(text.split()),
        )
        db.add(chunk)
        chunks.append(chunk)

    await db.commit()
    await db.refresh(document)
    return RagDocumentResponse.model_validate(document)


@router.post("/collections/{collection_id}/query", response_model=RagQueryResponse)
async def query_collection(
    collection_id: str,
    query_in: RagQueryRequest,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Query the RAG collection:
    1. Vector Retrieval: searches index using Deterministic TF-IDF Cosine similarity.
    2. Answer Generation: produces context-grounded response.
    3. Evaluation: calculates Answer Relevance and Faithfulness against retrieved chunks.
    """
    start_time = time.perf_counter()

    c_stmt = select(RagCollection).where(RagCollection.id == collection_id, RagCollection.project_id == project.id)
    c_res = await db.execute(c_stmt)
    collection = c_res.scalars().first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Fetch all chunks in this collection
    chunks_stmt = (
        select(RagChunk, RagDocument.title)
        .join(RagDocument, RagChunk.document_id == RagDocument.id)
        .where(RagChunk.collection_id == collection.id)
    )
    res = await db.execute(chunks_stmt)
    rows = res.all()

    if not rows:
        raise HTTPException(status_code=400, detail="Collection has no documents or chunks to query.")

    chunks_data = [row[0] for row in rows]
    titles_data = [row[1] for row in rows]
    corpus_texts = [c.content for c in chunks_data]

    # Deterministic Vector Retrieval
    retriever = DeterministicTfidfRetriever(corpus_texts)
    matches = retriever.query(query_in.query, top_k=query_in.top_k)

    retrieved_chunks = []
    combined_context = []

    for rank, (idx, score) in enumerate(matches, start=1):
        chunk_obj = chunks_data[idx]
        title = titles_data[idx]
        retrieved_chunks.append(
            RetrievedChunk(
                chunk_id=chunk_obj.id,
                document_title=title,
                content=chunk_obj.content,
                similarity_score=score,
                rank=rank,
            )
        )
        combined_context.append(chunk_obj.content)

    full_context_str = "\n\n---\n\n".join(combined_context)

    generated_answer = None
    if query_in.generate_answer:
        generated_answer, _, _ = await generate_model_output(
            model_name=query_in.model,
            prompt=query_in.query,
            context=full_context_str,
        )

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    faithfulness = calculate_faithfulness(generated_answer or "", full_context_str)
    relevance = calculate_answer_relevance(query_in.query, generated_answer or "")

    return RagQueryResponse(
        query=query_in.query,
        retrieved_chunks=retrieved_chunks,
        generated_answer=generated_answer,
        faithfulness_score=faithfulness,
        relevance_score=relevance,
        latency_ms=latency_ms,
        retrieval_method="TF-IDF + Cosine Similarity (Deterministic Local Fallback)",
    )
