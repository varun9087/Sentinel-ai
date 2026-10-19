import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Layers,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";

interface Dataset {
  id: string;
  name: string;
  example_count: number;
}

interface EvaluationResult {
  id: string;
  input_text: string;
  expected_output: string | null;
  generated_output: string | null;
  context: string | null;
  scores: Record<string, number>;
  passed: boolean;
  latency_ms: number;
  token_count: number;
  error_message: string | null;
}

interface EvaluationRun {
  id: string;
  dataset_id: string;
  name: string;
  status: string;
  model_name: string;
  prompt_template: string | null;
  selected_metrics: string[];
  total_examples: number;
  completed_examples: number;
  error_count: number;
  avg_latency_ms: number;
  total_tokens: number;
  estimated_cost: number;
  summary_scores: Record<string, number> | null;
  created_at: string;
  completed_at: string | null;
  results?: EvaluationResult[];
}

export const EvaluationsPage: React.FC = () => {
  const { activeProject } = useAuth();
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(true);

  // New Eval Modal
  const [isNewEvalOpen, setIsNewEvalOpen] = useState(false);
  const [evalName, setEvalName] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [modelName, setModelName] = useState("local-evaluator");
  const [promptTemplate, setPromptTemplate] = useState("Answer accurately: {input}");
  const [metrics, setMetrics] = useState<string[]>([
    "exact_match",
    "token_f1",
    "answer_relevance",
    "faithfulness",
    "latency",
  ]);
  const [running, setRunning] = useState(false);

  // Filter in detailed view
  const [filterFailuresOnly, setFilterFailuresOnly] = useState(false);

  const fetchRunsAndDatasets = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const [runsList, dsList] = await Promise.all([
        apiFetch<EvaluationRun[]>(`/projects/${activeProject.id}/evaluations`),
        apiFetch<Dataset[]>(`/projects/${activeProject.id}/datasets`),
      ]);
      setRuns(runsList);
      setDatasets(dsList);
      if (dsList.length > 0 && !datasetId) {
        setDatasetId(dsList[0].id);
      }
      if (runsList.length > 0 && !selectedRun) {
        loadRunDetail(runsList[0].id);
      } else if (selectedRun) {
        loadRunDetail(selectedRun.id);
      }
    } catch (err) {
      console.error("Failed to load evaluations:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRunDetail = async (runId: string) => {
    if (!activeProject) return;
    try {
      const detailed = await apiFetch<EvaluationRun>(
        `/projects/${activeProject.id}/evaluations/${runId}`
      );
      setSelectedRun(detailed);
    } catch (err) {
      console.error("Failed to load evaluation detail:", err);
    }
  };

  useEffect(() => {
    fetchRunsAndDatasets();
  }, [activeProject]);

  const handleLaunchEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !evalName.trim() || !datasetId) return;
    setRunning(true);
    try {
      const run = await apiFetch<EvaluationRun>(`/projects/${activeProject.id}/evaluations`, {
        method: "POST",
        body: JSON.stringify({
          name: evalName.trim(),
          dataset_id: datasetId,
          model_name: modelName,
          prompt_template: promptTemplate,
          selected_metrics: metrics,
        }),
      });
      await fetchRunsAndDatasets();
      setSelectedRun(run);
      setIsNewEvalOpen(false);
      setEvalName("");
    } catch (err: any) {
      alert(err.message || "Failed to execute evaluation");
    } finally {
      setRunning(false);
    }
  };

  const toggleMetric = (m: string) => {
    if (metrics.includes(m)) {
      if (metrics.length > 1) setMetrics(metrics.filter((x) => x !== m));
    } else {
      setMetrics([...metrics, m]);
    }
  };

  const availableMetrics = [
    { id: "exact_match", label: "Exact Match" },
    { id: "token_f1", label: "Token F1 Score" },
    { id: "answer_relevance", label: "Answer Relevance" },
    { id: "faithfulness", label: "Faithfulness / Groundedness" },
    { id: "context_recall", label: "Context Recall" },
    { id: "context_precision", label: "Context Precision" },
    { id: "latency", label: "Latency (ms)" },
  ];

  const filteredResults =
    selectedRun?.results?.filter((r) => (!filterFailuresOnly ? true : !r.passed)) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Evaluation Engine</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Execute reproducible benchmark runs with deterministic local metrics and model judges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRunsAndDatasets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setIsNewEvalOpen(true)}
            disabled={datasets.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Launch Evaluation
          </button>
        </div>
      </div>

      {datasets.length === 0 && (
        <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 flex items-center justify-between text-xs text-amber-200">
          <span>You need at least one dataset with examples before launching an evaluation run.</span>
          <a href="/datasets" className="text-orange-400 font-medium hover:underline">
            Go to Datasets &rarr;
          </a>
        </div>
      )}

      {/* Main Layout: Left Run List, Right Run Detail & per-example scores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Runs List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
            <span>Runs ({runs.length})</span>
          </div>

          {loading && runs.length === 0 ? (
            <div className="bg-[#12141c] border border-zinc-800 rounded-xl p-8 text-center text-xs text-zinc-500">
              Loading evaluation runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="bg-[#12141c] border border-dashed border-zinc-800 rounded-xl p-8 text-center">
              <Layers className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">No evaluation runs recorded yet.</p>
              {datasets.length > 0 && (
                <button
                  onClick={() => setIsNewEvalOpen(true)}
                  className="mt-3 text-xs text-orange-400 hover:underline"
                >
                  Start your first evaluation
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => {
                const isSelected = selectedRun?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => loadRunDetail(r.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#181b26] border-orange-500/50 shadow-sm"
                        : "bg-[#12141c] border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-semibold text-white tracking-tight">{r.name}</h4>
                      <Badge variant={r.status === "completed" ? "success" : "orange"}>
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 font-mono">{r.model_name}</p>

                    {/* Summary score pills */}
                    {r.summary_scores && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {r.summary_scores.token_f1 !== undefined && (
                          <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                            F1: <strong className="text-white">{r.summary_scores.token_f1}</strong>
                          </span>
                        )}
                        {r.summary_scores.faithfulness !== undefined && (
                          <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                            Faithful:{" "}
                            <strong className="text-white">{r.summary_scores.faithfulness}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-3 pt-2 border-t border-zinc-800/60">
                      <span>{r.completed_examples} examples</span>
                      <span>{r.avg_latency_ms} ms avg</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed Run View & Per-example results */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedRun ? (
            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-12 text-center text-zinc-500 text-xs">
              Select an evaluation run on the left to inspect scores and results.
            </div>
          ) : (
            <>
              {/* Summary Score Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
                  <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                    Token F1 Score
                  </span>
                  <p className="text-xl font-bold text-white mt-1">
                    {selectedRun.summary_scores?.token_f1 ?? "—"}
                  </p>
                </div>
                <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
                  <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                    Faithfulness
                  </span>
                  <p className="text-xl font-bold text-white mt-1">
                    {selectedRun.summary_scores?.faithfulness ?? "—"}
                  </p>
                </div>
                <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
                  <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                    Relevance
                  </span>
                  <p className="text-xl font-bold text-white mt-1">
                    {selectedRun.summary_scores?.answer_relevance ?? "—"}
                  </p>
                </div>
                <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
                  <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                    Latency / Cost
                  </span>
                  <p className="text-sm font-bold text-zinc-200 mt-1">
                    {selectedRun.avg_latency_ms} ms
                  </p>
                  <p className="text-[11px] text-emerald-400">
                    ${selectedRun.estimated_cost.toFixed(5)}
                  </p>
                </div>
              </div>

              {/* Per-Example Inspection Table */}
              <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Per-Example Benchmark Results</h3>
                    <p className="text-xs text-zinc-400">
                      Comparing generated responses against ground truth
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterFailuresOnly}
                      onChange={(e) => setFilterFailuresOnly(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-orange-500 focus:ring-0"
                    />
                    <span>Show Failures Only</span>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-[#0e1017] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="py-3 px-4 w-12">Status</th>
                        <th className="py-3 px-4">Prompt Input</th>
                        <th className="py-3 px-4">Expected Ground Truth</th>
                        <th className="py-3 px-4">Model Output</th>
                        <th className="py-3 px-4">Scores</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {filteredResults.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-zinc-500 font-sans">
                            {filterFailuresOnly
                              ? "All examples passed your benchmark criteria!"
                              : "No example records found."}
                          </td>
                        </tr>
                      ) : (
                        filteredResults.map((res) => (
                          <tr key={res.id} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="py-3 px-4">
                              {res.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400" />
                              )}
                            </td>
                            <td className="py-3 px-4 font-sans text-zinc-200 max-w-xs truncate">
                              {res.input_text}
                            </td>
                            <td className="py-3 px-4 font-sans text-emerald-400 max-w-xs truncate">
                              {res.expected_output || "—"}
                            </td>
                            <td className="py-3 px-4 font-sans text-zinc-300 max-w-xs truncate">
                              {res.generated_output || "—"}
                            </td>
                            <td className="py-3 px-4 font-sans">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(res.scores)
                                  .filter(([k]) => k !== "latency" && k !== "token_usage")
                                  .map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300"
                                    >
                                      {k.replace("token_", "")}: <strong>{v}</strong>
                                    </span>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Launch Evaluation Modal */}
      <Modal
        isOpen={isNewEvalOpen}
        onClose={() => setIsNewEvalOpen(false)}
        title="Launch Evaluation Run"
        description="Run an evaluation job against a selected dataset using deterministic metrics."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleLaunchEvaluation} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Run Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Prompt v2 - Zero Shot Benchmark"
              value={evalName}
              onChange={(e) => setEvalName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Target Dataset</label>
              <select
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.example_count} items)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Model / Evaluator</label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                <option value="local-evaluator">Deterministic Local Simulator (Zero API cost)</option>
                <option value="gpt-4o-mini">OpenAI gpt-4o-mini (Requires API Key)</option>
                <option value="gpt-4o">OpenAI gpt-4o (Requires API Key)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Prompt Template (Use <code className="text-orange-400">{"{input}"}</code> variable)
            </label>
            <textarea
              rows={2}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">Metrics to Compute</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableMetrics.map((m) => {
                const checked = metrics.includes(m.id);
                return (
                  <label
                    key={m.id}
                    onClick={() => toggleMetric(m.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      checked
                        ? "bg-orange-500/10 border-orange-500/40 text-orange-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="rounded bg-zinc-900 border-zinc-700 text-orange-500"
                    />
                    <span>{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsNewEvalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={running}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
            >
              {running ? "Evaluating Examples..." : "Launch Evaluation"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
