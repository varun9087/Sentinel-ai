import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Coins,
  Database,
  FlaskConical,
  Layers,
  RefreshCw,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";

interface Metrics {
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
  model_breakdown: {
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }[];
  volume_over_time: { date: string; requests: number; errors: number }[];
  recent_failed_traces: {
    id: string;
    trace_id: string;
    model: string;
    latency_ms: number;
    error_message: string;
    created_at: string;
  }[];
}
interface Trace {
  id: string;
  trace_id: string;
  name: string;
  model: string;
  status: string;
  latency_ms: number;
  total_tokens: number;
  estimated_cost: number;
  created_at: string;
}
export const DashboardPage = () => {
  const { activeProject } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!activeProject) {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setMetrics(null);
    setTraces([]);
    Promise.all([
      apiFetch<Metrics>(
        `/projects/${activeProject.id}/dashboard?days=${days}`,
        { signal: abort.signal },
      ),
      apiFetch<{ items: Trace[] }>(
        `/projects/${activeProject.id}/traces?limit=5`,
        { signal: abort.signal },
      ),
    ])
      .then(([data, recent]) => {
        if (!abort.signal.aborted) {
          setMetrics(data);
          setTraces(recent.items);
        }
      })
      .catch((err) => {
        if (!abort.signal.aborted)
          setError(
            err instanceof Error ? err.message : "Could not load telemetry.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [activeProject, days, revision]);
  if (!activeProject)
    return (
      <div className="empty-project">
        <span className="empty-icon">
          <Layers size={28} />
        </span>
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>Your AI deserves a control room.</h1>
        <p>
          Create a project using the + beside your workspace to start collecting
          traces and running evaluations.
        </p>
      </div>
    );
  const number = (value?: number) => value?.toLocaleString() || "0";
  const cards = [
    {
      title: "Total requests",
      value: number(metrics?.total_requests),
      icon: Activity,
      detail: `${number(metrics?.successful_requests)} successful requests`,
      note: "VOLUME",
    },
    {
      title: "P95 latency",
      value: number(metrics?.p95_latency_ms),
      unit: "ms",
      icon: Clock3,
      detail: `${number(metrics?.avg_latency_ms)} ms average latency`,
      note: "PERFORMANCE",
    },
    {
      title: "Error rate",
      value: (metrics?.error_rate || 0).toFixed(1),
      unit: "%",
      icon: TriangleAlert,
      detail: `${number(metrics?.error_requests)} requests with errors`,
      note: "RELIABILITY",
    },
    {
      title: "Estimated cost",
      value: `$${(metrics?.estimated_total_cost || 0).toFixed(4)}`,
      icon: Coins,
      detail: "Calculated from model pricing",
      note: "SPEND",
    },
  ];
  const max = Math.max(
    4,
    ...(metrics?.volume_over_time.map((point) => point.requests) || []),
  );
  return (
    <div className="overview-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow heading-eyebrow">
            <span className="orange-line" /> THE OBSERVABILITY WORKSPACE
          </div>
          <h1>
            See the signal.
            <span className="heading-muted"> Own the outcome.</span>
          </h1>
          <p>
            Your AI in focus. Every request, every evaluation, every decision.
          </p>
        </div>
        <div className="heading-actions">
          <select
            aria-label="Dashboard date range"
            className="button-secondary"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            className="button-secondary icon-only"
            aria-label="Refresh dashboard"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <Link to="/evaluations" className="button-primary">
            <PlusIcon /> Run evaluation
          </Link>
        </div>
      </div>
      <div className="overview-tabs">
        <span className="selected">Project overview</span>
        <Link to="/traces">
          Trace explorer <ArrowUpRight size={12} />
        </Link>
        <span className="data-label">
          {activeProject.name} <span className="text-zinc-600">/</span> Database
          telemetry
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="error-notice flex items-center justify-between gap-3"
        >
          <span>Telemetry unavailable: {error}</span>
          <button onClick={refresh} className="button-secondary">
            Try again
          </button>
        </div>
      )}
      <div className="metric-grid" aria-busy={loading}>
        {cards.map((card) => (
          <section key={card.title} className="metric-panel">
            <div className="metric-top">
              <span>{card.title}</span>
              <card.icon size={16} />
            </div>
            <div className={`metric-value ${loading ? "loading-value" : ""}`}>
              {loading ? "—" : error ? "—" : card.value}
              <small>{!loading && !error && card.unit}</small>
            </div>
            <div className="metric-bottom">
              <span>{error ? "Awaiting connection" : card.detail}</span>
              <span className="metric-index">{card.note}</span>
            </div>
          </section>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="surface volume-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Request activity <span className="subtle-tag">{days}D</span>
              </h2>
              <p>Traffic and failures across your models</p>
            </div>
            <div className="chart-legend">
              <span>
                <i /> Requests
              </span>
              <span>
                <i className="error-dot" /> Errors
              </span>
            </div>
          </div>
          <div className="volume-chart" aria-label="Request volume by day">
            <div className="chart-grid">
              {[1, 0.75, 0.5, 0.25, 0].map((scale) => (
                <div key={scale}>
                  <span>{Math.round(max * scale)}</span>
                  <i />
                </div>
              ))}
            </div>
            {metrics && metrics.total_requests > 0 ? (
              <div className="chart-bars">
                {metrics.volume_over_time.map((point) => (
                  <div className="bar-group" key={point.date}>
                    <div
                      className="bar-track"
                      title={`${point.date}: ${point.requests} requests, ${point.errors} errors`}
                    >
                      <div
                        className="request-bar"
                        style={{ height: `${(point.requests / max) * 100}%` }}
                      />
                      <div
                        className="error-bar"
                        style={{ height: `${(point.errors / max) * 100}%` }}
                      />
                    </div>
                    <span>
                      {new Date(
                        `${point.date.slice(0, 10)}T12:00:00`,
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chart-empty">
                <Activity size={25} />
                <strong>
                  {loading
                    ? "Loading request activity"
                    : error
                      ? "Activity unavailable"
                      : "Your next request starts the story"}
                </strong>
                <p>
                  {error
                    ? "Retry the connection to view stored events."
                    : "Connect your application to see real traffic here."}
                </p>
                {!loading && !error && (
                  <Link to="/keys">
                    Connect application <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="chart-footer">
            <span>
              AGGREGATED DAILY ·{" "}
              {days === "1" ? "PAST 24 HOURS" : `PAST ${days} DAYS`}
            </span>
            <Link to="/traces">
              Explore traces <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
        <section className="surface models-panel">
          <div className="panel-heading">
            <div>
              <h2>Model distribution</h2>
              <p>Understand where your traffic goes</p>
            </div>
            <Layers size={17} className="text-zinc-500" />
          </div>
          <div className="model-list">
            {metrics && metrics.model_breakdown.length > 0 ? (
              metrics.model_breakdown.map((model, index) => (
                <div className="model-row" key={model.model}>
                  <div className="flex items-center gap-2">
                    <span className={`model-symbol model-${index % 3}`}>
                      {model.model.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>{model.model}</strong>
                    <span className="ml-auto text-zinc-400">
                      {Math.round(
                        (model.requests / metrics.total_requests) * 100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="model-meter">
                    <span
                      style={{
                        width: `${(model.requests / metrics.total_requests) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-zinc-500 text-xs">
                    <span>{number(model.requests)} requests</span>
                    <span>${model.cost.toFixed(4)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="model-empty">
                <Layers size={28} />
                <strong>
                  {loading ? "Loading models..." : error ? "Model activity unavailable" : "No model activity yet"}
                </strong>
                <p>Model usage appears as traces arrive.</p>
              </div>
            )}
          </div>
          <div className="token-summary">
            <div>
              <ArrowDownLeft size={14} />
              <span>Input tokens</span>
              <strong>
                {error ? "—" : number(metrics?.total_input_tokens)}
              </strong>
            </div>
            <div>
              <ArrowUpRight size={14} />
              <span>Output tokens</span>
              <strong>
                {error ? "—" : number(metrics?.total_output_tokens)}
              </strong>
            </div>
          </div>
        </section>
      </div>
      <section className="surface recent-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Recent traces <span className="subtle-tag">LATEST 5</span>
            </h2>
            <p>
              A closer look at your application's latest requests · all time
            </p>
          </div>
          <Link to="/traces" className="text-link">
            View all traces <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="telemetry-table">
            <thead>
              <tr>
                <th>TRACE / OPERATION</th>
                <th>MODEL</th>
                <th>STATUS</th>
                <th>LATENCY</th>
                <th>TOKENS</th>
                <th className="text-right">EST. COST</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((trace) => (
                <tr key={trace.id}>
                  <td>
                    <Link
                      to={`/traces?search=${encodeURIComponent(trace.trace_id)}`}
                      className="trace-name"
                    >
                      <span className="trace-symbol">
                        <Activity size={14} />
                      </span>
                      <span>
                        {trace.name || trace.trace_id}
                        <small>{trace.trace_id}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="model-pill">{trace.model}</span>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${trace.status === "success" ? "success" : "failure"}`}
                    >
                      {trace.status === "success" ? (
                        <Check size={11} />
                      ) : (
                        <TriangleAlert size={11} />
                      )}
                      {trace.status}
                    </span>
                  </td>
                  <td className="tabular-nums">
                    {number(trace.latency_ms)}{" "}
                    <span className="text-zinc-600">ms</span>
                  </td>
                  <td className="tabular-nums">{number(trace.total_tokens)}</td>
                  <td className="text-right font-mono">
                    ${trace.estimated_cost.toFixed(4)}
                  </td>
                </tr>
              ))}
              {!traces.length && (
                <tr>
                  <td colSpan={6} className="empty-table">
                    {loading
                      ? "Loading recent traces..."
                      : error
                        ? "Could not load recent traces."
                        : "No traces yet. Instrument your application to inspect its first request."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="workflow-grid">
        {[
          {
            number: "01",
            icon: Terminal,
            title: "Connect your stack",
            detail: "From your application to your first trace.",
            to: "/keys",
            action: "Set up integration",
          },
          {
            number: "02",
            icon: Database,
            title: "Define what good looks like",
            detail: "Turn real examples into a quality benchmark.",
            to: "/datasets",
            action: "Explore datasets",
          },
          {
            number: "03",
            icon: FlaskConical,
            title: "Ship with evidence",
            detail: "Evaluate, compare, and catch regressions.",
            to: "/evaluations",
            action: "Open evaluations",
          },
        ].map((item) => (
          <Link to={item.to} className="workflow-card" key={item.number}>
            <div className="flex justify-between">
              <item.icon size={19} />
              <span className="workflow-number">{item.number}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <span className="workflow-action">
              {item.action}
              <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
function PlusIcon() {
  return (
    <span aria-hidden="true" className="text-lg leading-none">
      +
    </span>
  );
}
