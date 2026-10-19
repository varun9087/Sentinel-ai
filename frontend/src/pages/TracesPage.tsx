import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Copy,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";

interface Span {
  id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  span_type: string;
  duration_ms: number;
  input_payload: string | null;
  output_payload: string | null;
  metadata_json: string | null;
}

interface Trace {
  id: string;
  project_id: string;
  trace_id: string;
  name: string;
  operation_type: string;
  model: string;
  provider: string;
  status: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  input_payload: string | null;
  output_payload: string | null;
  error_message: string | null;
  metadata_json: string | null;
  created_at: string;
  spans?: Span[];
}

interface TraceListResponse {
  items: Trace[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const TracesPage: React.FC = () => {
  const { activeProject } = useAuth();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Trace Detail Modal
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  const fetchTraces = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        status: statusFilter,
        operation_type: operationFilter,
        search: search.trim(),
      });
      const data = await apiFetch<TraceListResponse>(
        `/projects/${activeProject.id}/traces?${queryParams.toString()}`
      );
      setTraces(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error("Failed to load traces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, [activeProject, page, statusFilter, operationFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTraces();
  };

  const handleOpenDetail = async (trace: Trace) => {
    if (!activeProject) return;
    setSelectedTrace(trace);
    try {
      const detailed = await apiFetch<Trace>(
        `/projects/${activeProject.id}/traces/${trace.id}`
      );
      setSelectedTrace(detailed);
    } catch (err) {
      console.error("Failed to fetch trace spans:", err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Trace Explorer</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Deep execution traces, spans, payloads, latencies, and token diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTraces}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search prompt, output, error, or trace ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300">
            <span className="text-zinc-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900">All Statuses</option>
              <option value="success" className="bg-zinc-900">Success</option>
              <option value="error" className="bg-zinc-900">Error</option>
            </select>
          </div>

          {/* Operation Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300">
            <span className="text-zinc-400">Op:</span>
            <select
              value={operationFilter}
              onChange={(e) => {
                setOperationFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900">All Types</option>
              <option value="generation" className="bg-zinc-900">Generation</option>
              <option value="rag" className="bg-zinc-900">RAG</option>
              <option value="embedding" className="bg-zinc-900">Embedding</option>
              <option value="tool" className="bg-zinc-900">Tool</option>
            </select>
          </div>
        </div>
      </div>

      {/* Traces Table */}
      <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#0e1017] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Trace ID</th>
                <th className="py-3 px-4">Operation</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Tokens (In / Out)</th>
                <th className="py-3 px-4">Est. Cost</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {loading && traces.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500 font-sans">
                    Loading trace events...
                  </td>
                </tr>
              ) : traces.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 font-sans">
                    No traces found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                traces.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => handleOpenDetail(t)}
                    className="hover:bg-zinc-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      {t.status === "success" ? (
                        <Badge variant="success">200 OK</Badge>
                      ) : (
                        <Badge variant="error">ERROR</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-orange-400 font-medium">
                      {t.trace_id}
                    </td>
                    <td className="py-3 px-4 text-zinc-300 font-sans capitalize">
                      {t.operation_type}
                    </td>
                    <td className="py-3 px-4 text-zinc-200">{t.model}</td>
                    <td className="py-3 px-4 text-zinc-300">{t.latency_ms} ms</td>
                    <td className="py-3 px-4 text-zinc-400">
                      {t.total_tokens.toLocaleString()}{" "}
                      <span className="text-[10px] text-zinc-400">
                        ({t.input_tokens}/{t.output_tokens})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      ${t.estimated_cost.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400 font-sans">
                      {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(t);
                        }}
                        className="text-xs text-orange-400 hover:text-orange-300 hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Showing {traces.length} of {total} traces
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 disabled:opacity-40 hover:bg-zinc-800 text-white"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 disabled:opacity-40 hover:bg-zinc-800 text-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trace Detail & Span Timeline Modal */}
      <Modal
        isOpen={!!selectedTrace}
        onClose={() => setSelectedTrace(null)}
        title={`Trace: ${selectedTrace?.trace_id || ""}`}
        description={`Execution diagnostics for ${selectedTrace?.name || "llm_request"}`}
        maxWidth="max-w-3xl"
      >
        {selectedTrace && (
          <div className="space-y-6 text-xs text-zinc-300">
            {/* Metadata Summary Pill Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                <span className="text-zinc-400 text-[10px] uppercase font-semibold">Model</span>
                <p className="text-sm font-semibold text-white mt-0.5">{selectedTrace.model}</p>
              </div>
              <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                <span className="text-zinc-400 text-[10px] uppercase font-semibold">Latency</span>
                <p className="text-sm font-semibold text-white mt-0.5">{selectedTrace.latency_ms} ms</p>
              </div>
              <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                <span className="text-zinc-400 text-[10px] uppercase font-semibold">Tokens</span>
                <p className="text-sm font-semibold text-white mt-0.5">
                  {selectedTrace.total_tokens}{" "}
                  <span className="text-xs text-zinc-400">({selectedTrace.input_tokens} in / {selectedTrace.output_tokens} out)</span>
                </p>
              </div>
              <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                <span className="text-zinc-400 text-[10px] uppercase font-semibold">Est. Cost</span>
                <p className="text-sm font-semibold text-emerald-400 mt-0.5">${selectedTrace.estimated_cost.toFixed(6)}</p>
              </div>
            </div>

            {/* Error Banner */}
            {selectedTrace.status === "error" && (
              <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/80 flex items-start gap-3 text-rose-300">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-200 text-xs">Execution Error</h4>
                  <p className="mt-1 text-xs font-mono">{selectedTrace.error_message || "Unknown error encountered"}</p>
                </div>
              </div>
            )}

            {/* Spans Waterfall Timeline */}
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                Execution Spans Timeline ({selectedTrace.spans?.length || 0})
              </h4>
              {!selectedTrace.spans || selectedTrace.spans.length === 0 ? (
                <div className="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/60 text-zinc-500 text-center font-sans">
                  No fine-grained sub-spans recorded for this single-stage request.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedTrace.spans.map((s, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="orange">{s.span_type}</Badge>
                          <span className="font-medium text-white font-mono">{s.name}</span>
                        </div>
                        <span className="font-mono text-zinc-400">{s.duration_ms} ms</span>
                      </div>
                      {/* Visual Timeline Bar */}
                      <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(10, (s.duration_ms / selectedTrace.latency_ms) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt Payload */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Input Prompt Payload
                </span>
                {selectedTrace.input_payload && (
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedTrace.input_payload || "")}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
              <pre className="bg-[#090a0f] border border-zinc-800 rounded-lg p-3 text-zinc-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-48">
                {selectedTrace.input_payload || "No prompt payload stored"}
              </pre>
            </div>

            {/* Output Payload */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Generated Output Payload
                </span>
                {selectedTrace.output_payload && (
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedTrace.output_payload || "")}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
              <pre className="bg-[#090a0f] border border-zinc-800 rounded-lg p-3 text-zinc-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-48">
                {selectedTrace.output_payload || "No output payload generated"}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
