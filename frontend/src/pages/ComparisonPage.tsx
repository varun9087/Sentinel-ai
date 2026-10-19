import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  GitCompare,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { Badge } from "../components/Badge";
import { useAuth } from "../context/AuthContext";

interface RunOption {
  id: string;
  name: string;
  model_name: string;
  created_at: string;
}

interface MetricDiff {
  baseline_value: number;
  candidate_value: number;
  absolute_diff: number;
  percentage_change: number;
}

interface ExampleDiff {
  example_id: string | null;
  input_text: string;
  expected_output: string | null;
  baseline_output: string | null;
  candidate_output: string | null;
  baseline_scores: Record<string, number>;
  candidate_scores: Record<string, number>;
  delta_score: number;
  status: "improved" | "degraded" | "unchanged";
}

interface ComparisonData {
  baseline_run: any;
  candidate_run: any;
  metric_diffs: Record<string, MetricDiff>;
  latency_diff: MetricDiff;
  token_diff: MetricDiff;
  cost_diff: MetricDiff;
  improved_count: number;
  degraded_count: number;
  unchanged_count: number;
  regressions: ExampleDiff[];
  improvements: ExampleDiff[];
}

export const ComparisonPage: React.FC = () => {
  const { activeProject } = useAuth();
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [baselineId, setBaselineId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"regressions" | "improvements" | "all">("regressions");

  useEffect(() => {
    const fetchRuns = async () => {
      if (!activeProject) return;
      try {
        const list = await apiFetch<any[]>(`/projects/${activeProject.id}/evaluations`);
        setRuns(list);
        if (list.length >= 2) {
          setBaselineId(list[1].id);
          setCandidateId(list[0].id);
        } else if (list.length === 1) {
          setBaselineId(list[0].id);
          setCandidateId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load runs for comparison:", err);
      }
    };
    fetchRuns();
  }, [activeProject]);

  const handleCompare = async () => {
    if (!activeProject || !baselineId || !candidateId) return;
    setLoading(true);
    try {
      const data = await apiFetch<ComparisonData>(
        `/projects/${activeProject.id}/evaluations/compare/${baselineId}/${candidateId}`
      );
      setComparison(data);
    } catch (err: any) {
      alert(err.message || "Failed to compare evaluation runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (baselineId && candidateId && baselineId !== candidateId) {
      handleCompare();
    }
  }, [baselineId, candidateId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Model & Prompt Comparison</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Analyze regressions, improvements, latency tradeoffs, and cost differences across runs.
          </p>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-5 flex flex-col md:flex-row items-center gap-4">
        {/* Baseline Selector */}
        <div className="flex-1 w-full space-y-1">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Baseline Run (Reference)
          </label>
          <select
            value={baselineId}
            onChange={(e) => setBaselineId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
          >
            <option value="" disabled>Select baseline run...</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.model_name})
              </option>
            ))}
          </select>
        </div>

        <div className="text-zinc-500 hidden md:block pt-4">
          <ArrowRight className="w-5 h-5 text-orange-400" />
        </div>

        {/* Candidate Selector */}
        <div className="flex-1 w-full space-y-1">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Candidate Run (New Model / Prompt)
          </label>
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
          >
            <option value="" disabled>Select candidate run...</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.model_name})
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4 w-full md:w-auto">
          <button
            onClick={handleCompare}
            disabled={loading || !baselineId || !candidateId}
            className="w-full md:w-auto px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Comparing..." : "Re-Compare"}
          </button>
        </div>
      </div>

      {runs.length < 2 && (
        <div className="bg-[#12141c] border border-dashed border-zinc-800 rounded-xl p-8 text-center text-xs text-zinc-400">
          <GitCompare className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          You need at least two evaluation runs to perform side-by-side comparison.
        </div>
      )}

      {/* Comparison Metrics Diffs */}
      {comparison && (
        <div className="space-y-6">
          {/* Summary Stat Diffs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
              <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                F1 Score Delta
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-white">
                  {comparison.metric_diffs?.token_f1?.candidate_value ?? "—"}
                </span>
                {comparison.metric_diffs?.token_f1 && (
                  <span
                    className={`text-xs font-semibold ${
                      comparison.metric_diffs.token_f1.absolute_diff >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {comparison.metric_diffs.token_f1.absolute_diff >= 0 ? "+" : ""}
                    {comparison.metric_diffs.token_f1.absolute_diff}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-zinc-400">
                Baseline: {comparison.metric_diffs?.token_f1?.baseline_value ?? "—"}
              </span>
            </div>

            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
              <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                Latency Delta
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-white">
                  {comparison.latency_diff.candidate_value} ms
                </span>
                <span
                  className={`text-xs font-semibold ${
                    comparison.latency_diff.absolute_diff <= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {comparison.latency_diff.absolute_diff >= 0 ? "+" : ""}
                  {comparison.latency_diff.absolute_diff} ms
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">
                Baseline: {comparison.latency_diff.baseline_value} ms
              </span>
            </div>

            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
              <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                Cost Delta
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-white">
                  ${comparison.cost_diff.candidate_value.toFixed(5)}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    comparison.cost_diff.absolute_diff <= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {comparison.cost_diff.absolute_diff >= 0 ? "+" : ""}
                  ${comparison.cost_diff.absolute_diff.toFixed(5)}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">
                Tokens: {comparison.token_diff.absolute_diff >= 0 ? "+" : ""}
                {comparison.token_diff.absolute_diff}
              </span>
            </div>

            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-4">
              <span className="text-zinc-400 text-[10px] uppercase font-semibold">
                Regression Breakdown
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-semibold text-emerald-400">
                  +{comparison.improved_count} improved
                </span>
                <span className="text-zinc-600">/</span>
                <span className="text-sm font-semibold text-rose-400">
                  -{comparison.degraded_count} degraded
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">
                {comparison.unchanged_count} unchanged examples
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3 text-xs">
            <button
              onClick={() => setActiveTab("regressions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === "regressions"
                  ? "bg-rose-950/60 text-rose-400 border border-rose-800/60"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Regressions ({comparison.degraded_count})
            </button>
            <button
              onClick={() => setActiveTab("improvements")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === "improvements"
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Improvements ({comparison.improved_count})
            </button>
          </div>

          {/* Detailed Side-by-Side Example Comparison */}
          <div className="space-y-3">
            {activeTab === "regressions" && comparison.regressions.length === 0 && (
              <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-8 text-center text-xs text-zinc-400">
                Zero regressions detected! Candidate matched or outperformed baseline on all items.
              </div>
            )}

            {activeTab === "improvements" && comparison.improvements.length === 0 && (
              <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-8 text-center text-xs text-zinc-400">
                No significant metric improvements detected over the baseline run.
              </div>
            )}

            {(activeTab === "regressions" ? comparison.regressions : comparison.improvements).map(
              (item, idx) => (
                <div
                  key={idx}
                  className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-5 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400">
                        Input Prompt
                      </span>
                      <h4 className="text-sm font-semibold text-white mt-0.5">{item.input_text}</h4>
                    </div>
                    <Badge variant={item.status === "improved" ? "success" : "error"}>
                      Score Delta: {item.delta_score > 0 ? "+" : ""}
                      {item.delta_score}
                    </Badge>
                  </div>

                  {item.expected_output && (
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-zinc-300">
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold block mb-0.5">
                        Expected Ground Truth:
                      </span>
                      {item.expected_output}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Baseline Output */}
                    <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-400">Baseline Output</span>
                        <span className="font-mono text-zinc-400">
                          F1: {item.baseline_scores?.token_f1 ?? "—"}
                        </span>
                      </div>
                      <p className="text-zinc-300 font-sans">{item.baseline_output || "—"}</p>
                    </div>

                    {/* Candidate Output */}
                    <div className="p-3 rounded-lg bg-zinc-900/80 border border-orange-500/30 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-orange-400">Candidate Output</span>
                        <span className="font-mono text-orange-300">
                          F1: {item.candidate_scores?.token_f1 ?? "—"}
                        </span>
                      </div>
                      <p className="text-white font-sans">{item.candidate_output || "—"}</p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
