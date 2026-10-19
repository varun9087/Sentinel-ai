import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Coins,
  Database,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../context/AuthContext";

interface DashboardMetrics {
  total_requests: number;
  successful_requests: number;
  error_requests: number;
  error_rate: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  estimated_total_cost: number;
  model_breakdown: Array<{
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  volume_over_time: Array<{
    date: string;
    requests: number;
    errors: number;
  }>;
  recent_failed_traces: Array<{
    id: string;
    trace_id: string;
    model: string;
    latency_ms: number;
    error_message: string;
    created_at: string;
  }>;
}

export const DashboardPage: React.FC = () => {
  const { activeProject } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchMetrics = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const data = await apiFetch<DashboardMetrics>(`/projects/${activeProject.id}/dashboard?days=7`);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [activeProject]);

  const handleSeedDemoData = async () => {
    if (!activeProject) return;
    setSeeding(true);
    try {
      // Create a demo key if needed or call API directly
      const keys = await apiFetch<any[]>(`/projects/${activeProject.id}/keys`);
      let rawKey = "";
      if (keys.length === 0) {
        const newKey = await apiFetch<any>(`/projects/${activeProject.id}/keys`, {
          method: "POST",
          body: JSON.stringify({ name: "Demo Ingestion Key" }),
        });
        rawKey = newKey.raw_key;
      }

      // Ingest 5 diverse demo traces (successes & failures across models)
      const sampleEvents = [
        {
          name: "customer_support_rag",
          operation_type: "rag",
          model: "gpt-4o",
          latency_ms: 380,
          input_tokens: 210,
          output_tokens: 95,
          status: "success",
          input_payload: "How do I upgrade to the Enterprise Sentinel plan?",
          output_payload: "You can upgrade directly from your Workspace billing dashboard or contact sales.",
        },
        {
          name: "doc_retrieval_generation",
          operation_type: "generation",
          model: "gpt-4o-mini",
          latency_ms: 195,
          input_tokens: 140,
          output_tokens: 60,
          status: "success",
          input_payload: "What is the timeout for ingestion requests?",
          output_payload: "Default ingestion timeout is 5000ms with non-blocking async dispatch available.",
        },
        {
          name: "policy_compliance_check",
          operation_type: "generation",
          model: "gpt-4o",
          latency_ms: 450,
          input_tokens: 310,
          output_tokens: 120,
          status: "success",
          input_payload: "Review refund policy compliance for order #8491.",
          output_payload: "Order falls cleanly within the 30-day refund window. Approved.",
        },
        {
          name: "token_limit_exceeded_error",
          operation_type: "generation",
          model: "claude-3-5-sonnet",
          latency_ms: 120,
          input_tokens: 1800,
          output_tokens: 0,
          status: "error",
          error_message: "ContextWindowExceeded: Maximum prompt token limit reached (4096 tokens).",
          input_payload: "Analyze this 20,000 word raw dump...",
        },
        {
          name: "provider_rate_limit_error",
          operation_type: "generation",
          model: "gpt-4o",
          latency_ms: 85,
          input_tokens: 95,
          output_tokens: 0,
          status: "error",
          error_message: "RateLimitError: 429 Too Many Requests from OpenAI upstream cluster.",
          input_payload: "Generate real-time sentiment analysis for batch stream.",
        },
      ];

      // Ingest via direct backend API or temporary key
      for (const ev of sampleEvents) {
        await apiFetch("/traces/ingest", {
          method: "POST",
          headers: rawKey ? { "X-API-Key": rawKey } : undefined,
          body: JSON.stringify(ev),
        });
      }

      await fetchMetrics();
    } catch (err: any) {
      alert("Demo seeding completed or encountered note: " + (err.message || err));
      await fetchMetrics();
    } finally {
      setSeeding(false);
    }
  };

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Database className="w-12 h-12 text-zinc-600 mb-3" />
        <h2 className="text-lg font-semibold text-white">No Active Project Selected</h2>
        <p className="text-sm text-zinc-400 mt-1 max-w-sm">
          Please select or create a project from the top navigation bar to view observability metrics.
        </p>
      </div>
    );
  }

  const maxVolume = metrics?.volume_over_time?.reduce((max, d) => Math.max(max, d.requests), 1) || 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Observability Overview</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time LLM telemetry, latency distribution, token usage, and cost estimation for{" "}
            <span className="text-orange-400 font-medium">{activeProject.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={handleSeedDemoData}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {seeding ? "Generating..." : "Seed Demo Traces"}
          </button>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total LLM Requests"
          value={loading ? "..." : (metrics ? metrics.total_requests.toLocaleString() : "0")}
          subtitle={`${metrics?.successful_requests || 0} succeeded, ${metrics?.error_requests || 0} failed`}
          icon={Activity}
        />
        <StatCard
          title="Error Rate"
          value={loading ? "..." : (metrics ? `${metrics.error_rate}%` : "0%")}
          subtitle="Requests resulting in error status"
          icon={AlertTriangle}
          trend={metrics && metrics.error_rate > 10 ? "Elevated" : undefined}
          trendUp={false}
        />
        <StatCard
          title="Latency (P95 / Avg)"
          value={loading ? "..." : (metrics ? `${metrics.p95_latency_ms} ms` : "0 ms")}
          subtitle={`Average: ${metrics?.avg_latency_ms || 0} ms | P99: ${metrics?.p99_latency_ms || 0} ms`}
          icon={Clock}
        />
        <StatCard
          title="Estimated Cost"
          value={loading ? "..." : (metrics ? `$${metrics.estimated_total_cost.toFixed(4)}` : "$0.00")}
          subtitle={`Total Tokens: ${metrics?.total_tokens.toLocaleString() || 0}`}
          icon={Coins}
        />
      </div>

      {/* Honest Empty State Check */}
      {metrics && metrics.total_requests === 0 && (
        <div className="bg-[#12141c] border border-dashed border-zinc-800 rounded-xl p-10 text-center">
          <Activity className="w-10 h-10 text-orange-400/60 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Telemetry Events Recorded Yet</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
            This project has not received any LLM traces yet. You can instrument your application using
            the Sentinel Python SDK, submit an event via the Ingestion API, or click "Seed Demo Traces"
            above to populate sample metrics.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              to="/keys"
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Get Ingestion API Key
            </Link>
            <button
              onClick={handleSeedDemoData}
              disabled={seeding}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
            >
              {seeding ? "Generating..." : "Generate Sample Traces"}
            </button>
          </div>
        </div>
      )}

      {/* Main Visualizations Row: Request Volume & Model Usage */}
      {metrics && metrics.total_requests > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request Volume Chart (Past 7 Days) */}
          <div className="lg:col-span-2 bg-[#12141c] border border-zinc-800/80 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Request Volume Over Time</h3>
                <p className="text-xs text-zinc-400">Daily request volume and error frequency</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500"></span> Total
                </span>
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Errors
                </span>
              </div>
            </div>

            {/* Volume Bar Chart */}
            <div className="h-48 flex items-end gap-3 pt-4 border-b border-zinc-800/80">
              {metrics.volume_over_time.map((d, i) => {
                const totalHeight = Math.max(8, (d.requests / maxVolume) * 100);
                const errorHeight = d.requests > 0 ? (d.errors / d.requests) * totalHeight : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="w-full max-w-[40px] flex flex-col justify-end rounded-t overflow-hidden relative">
                      {/* Total Bar */}
                      <div
                        style={{ height: `${totalHeight}%` }}
                        className="w-full bg-orange-500/80 group-hover:bg-orange-400 transition-all rounded-t relative flex flex-col justify-start"
                      >
                        {d.errors > 0 && (
                          <div
                            style={{ height: `${errorHeight}%` }}
                            className="w-full bg-rose-500/90"
                            title={`${d.errors} errors`}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-400 truncate w-full text-center">
                      {d.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400 mt-2">
              <span>7 days ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Model Breakdown */}
          <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-1">Model Distribution</h3>
            <p className="text-xs text-zinc-400 mb-4">Request distribution & cost per model</p>

            <div className="space-y-4">
              {metrics.model_breakdown.map((m, idx) => {
                const pct = Math.round((m.requests / metrics.total_requests) * 100);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200">{m.model}</span>
                      <span className="text-zinc-400">
                        {m.requests} reqs ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>{m.tokens.toLocaleString()} tokens</span>
                      <span>${m.cost.toFixed(4)} est.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent Failed Requests Table */}
      {metrics && metrics.recent_failed_traces.length > 0 && (
        <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Recent Failed Requests
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Requests flagged with error status for rapid diagnosis
              </p>
            </div>
            <Link
              to="/traces?status=error"
              className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1"
            >
              View All Failed Traces <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#0e1017] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Trace ID</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Error Diagnostics</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {metrics.recent_failed_traces.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 text-orange-400 font-medium">
                      <Link to={`/traces?search=${t.trace_id}`} className="hover:underline">
                        {t.trace_id}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-zinc-200">{t.model}</td>
                    <td className="py-3 px-4 text-zinc-400">{t.latency_ms} ms</td>
                    <td className="py-3 px-4 text-rose-400 max-w-md truncate font-sans">
                      {t.error_message || "Execution failed without message"}
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400 font-sans">
                      {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
