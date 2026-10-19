import React, { useEffect, useState } from "react";
import {
  BookOpen,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";

interface RagCollection {
  id: string;
  name: string;
  description: string | null;
  chunk_size: number;
  chunk_overlap: number;
  total_documents: number;
  total_chunks: number;
  created_at: string;
}

interface RetrievedChunk {
  chunk_id: string;
  document_title: string;
  content: string;
  similarity_score: number;
  rank: number;
}

interface RagQueryResponse {
  query: string;
  retrieved_chunks: RetrievedChunk[];
  generated_answer: string | null;
  faithfulness_score: number;
  relevance_score: number;
  latency_ms: number;
  retrieval_method: string;
}

export const RagPlaygroundPage: React.FC = () => {
  const { activeProject } = useAuth();
  const [collections, setCollections] = useState<RagCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateColOpen, setIsCreateColOpen] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);

  // Create Collection Form
  const [colName, setColName] = useState("");
  const [colDesc, setColDesc] = useState("");
  const [chunkSize, setChunkSize] = useState(300);
  const [chunkOverlap, setChunkOverlap] = useState(50);

  // Add Document Form
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");

  // Query Playground
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(3);
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<RagQueryResponse | null>(null);

  const fetchCollections = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const list = await apiFetch<RagCollection[]>(`/projects/${activeProject.id}/rag/collections`);
      setCollections(list);
      if (list.length > 0 && !selectedCollectionId) {
        setSelectedCollectionId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load RAG collections:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, [activeProject]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !colName.trim()) return;
    try {
      const created = await apiFetch<RagCollection>(`/projects/${activeProject.id}/rag/collections`, {
        method: "POST",
        body: JSON.stringify({
          name: colName.trim(),
          description: colDesc.trim() || null,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
        }),
      });
      await fetchCollections();
      setSelectedCollectionId(created.id);
      setIsCreateColOpen(false);
      setColName("");
      setColDesc("");
    } catch (err: any) {
      alert(err.message || "Failed to create collection");
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !selectedCollectionId || !docTitle.trim() || !docContent.trim()) return;
    try {
      await apiFetch(`/projects/${activeProject.id}/rag/collections/${selectedCollectionId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          title: docTitle.trim(),
          content: docContent.trim(),
        }),
      });
      await fetchCollections();
      setIsAddDocOpen(false);
      setDocTitle("");
      setDocContent("");
    } catch (err: any) {
      alert(err.message || "Failed to add document");
    }
  };

  const handleRunQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !selectedCollectionId || !query.trim()) return;
    setQuerying(true);
    try {
      const res = await apiFetch<RagQueryResponse>(
        `/projects/${activeProject.id}/rag/collections/${selectedCollectionId}/query`,
        {
          method: "POST",
          body: JSON.stringify({
            query: query.trim(),
            top_k: topK,
            generate_answer: true,
          }),
        }
      );
      setQueryResult(res);
    } catch (err: any) {
      alert(err.message || "Failed to query collection");
    } finally {
      setQuerying(false);
    }
  };

  const selectedCol = collections.find((c) => c.id === selectedCollectionId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">RAG Evaluation Playground</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Test vector retrieval similarity, inspect chunks, and measure context faithfulness & relevance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddDocOpen(true)}
            disabled={!selectedCol}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> Add Knowledge Document
          </button>
          <button
            onClick={() => setIsCreateColOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New Collection
          </button>
        </div>
      </div>

      {/* Collection Switcher & Parameter Card */}
      <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider shrink-0">
            Active Collection:
          </label>
          <select
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 w-full sm:w-64"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedCol && (
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span>
              Chunk Size: <strong className="text-white">{selectedCol.chunk_size} words</strong>
            </span>
            <span>
              Overlap: <strong className="text-white">{selectedCol.chunk_overlap} words</strong>
            </span>
          </div>
        )}
      </div>

      {loading && collections.length === 0 ? (
        <div className="bg-[#12141c] border border-zinc-800 rounded-xl p-12 text-center text-xs text-zinc-500">
          Loading RAG collections...
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-[#12141c] border border-dashed border-zinc-800 rounded-xl p-12 text-center text-xs text-zinc-400">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-white">No RAG Collections Initialized</h3>
          <p className="mt-1">
            Create a knowledge collection to upload documents, test chunking, and benchmark retrieval accuracy.
          </p>
          <button
            onClick={() => setIsCreateColOpen(true)}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500"
          >
            Create Collection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Query Interface */}
          <div className="space-y-4">
            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Interactive Query Runner</h3>
              <form onSubmit={handleRunQuery} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    User Query / Question
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. How does key revocation take effect in Sentinel AI?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400 font-medium">Top-K Chunks:</label>
                    <select
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={querying || !query.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {querying ? "Searching & Evaluating..." : "Retrieve & Evaluate"}
                  </button>
                </div>
              </form>
            </div>

            {/* Generated Answer & RAG Scores Card */}
            {queryResult && (
              <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Generated Answer
                  </h4>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {queryResult.latency_ms} ms
                  </span>
                </div>

                <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-200">
                  {queryResult.generated_answer || "No response generated"}
                </div>

                {/* Score Pill Cards */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400">
                      Faithfulness Score
                    </span>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {queryResult.faithfulness_score}
                    </p>
                    <span className="text-[10px] text-zinc-400">
                      Fraction of statements supported by retrieved context
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400">
                      Answer Relevance
                    </span>
                    <p className="text-lg font-bold text-orange-400 mt-0.5">
                      {queryResult.relevance_score}
                    </p>
                    <span className="text-[10px] text-zinc-400">
                      Lexical coverage of query in generated response
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 italic">
                  Retrieval Engine: {queryResult.retrieval_method}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Retrieved Chunks Inspection */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
              Retrieved Context Chunks ({queryResult?.retrieved_chunks.length || 0})
            </h3>

            {!queryResult ? (
              <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-12 text-center text-xs text-zinc-500">
                Execute a query on the left to inspect retrieved document chunks and similarity rankings.
              </div>
            ) : queryResult.retrieved_chunks.length === 0 ? (
              <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-8 text-center text-xs text-zinc-400">
                No chunks scored above the similarity threshold for this query.
              </div>
            ) : (
              <div className="space-y-3">
                {queryResult.retrieved_chunks.map((chunk) => (
                  <div
                    key={chunk.chunk_id}
                    className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="orange">Rank #{chunk.rank}</Badge>
                        <span className="text-xs font-semibold text-white">
                          {chunk.document_title}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-semibold">
                        Sim: {(chunk.similarity_score * 100).toFixed(1)}%
                      </span>
                    </div>

                    {/* Similarity Bar */}
                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, chunk.similarity_score * 100))}%` }}
                      />
                    </div>

                    <p className="text-xs text-zinc-300 font-mono bg-zinc-950 p-2.5 rounded border border-zinc-800/60 whitespace-pre-wrap">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Collection Modal */}
      <Modal
        isOpen={isCreateColOpen}
        onClose={() => setIsCreateColOpen(false)}
        title="Create RAG Knowledge Collection"
        description="Set vector chunking parameters for document ingestion."
      >
        <form onSubmit={handleCreateCollection} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Collection Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Help Center Documentation"
              value={colName}
              onChange={(e) => setColName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={colDesc}
              onChange={(e) => setColDesc(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Chunk Size (Words)</label>
              <input
                type="number"
                min={50}
                max={2000}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Chunk Overlap (Words)</label>
              <input
                type="number"
                min={0}
                max={500}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateColOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500"
            >
              Create Collection
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Document Modal */}
      <Modal
        isOpen={isAddDocOpen}
        onClose={() => setIsAddDocOpen(false)}
        title="Add Knowledge Document"
        description="Text will be segmented into overlapping chunks based on collection configuration."
      >
        <form onSubmit={handleAddDocument} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Document Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Authentication & API Security Manual"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Document Body Content</label>
            <textarea
              rows={6}
              required
              placeholder="Paste article, guide, or knowledge text here..."
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddDocOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500"
            >
              Chunk & Index Document
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
