import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../pages/DashboardPage";
import { apiFetch } from "../api/client";
vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ activeProject: project }),
}));
const project = { id: "project-a", name: "Test project" };
const emptyMetrics = {
  total_requests: 0,
  successful_requests: 0,
  error_requests: 0,
  error_rate: 0,
  avg_latency_ms: 0,
  p95_latency_ms: 0,
  p99_latency_ms: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_tokens: 0,
  estimated_total_cost: 0,
  model_breakdown: [],
  volume_over_time: [],
  recent_failed_traces: [],
};
const api = vi.mocked(apiFetch);
function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async (endpoint) =>
    endpoint.includes("/dashboard") ? emptyMetrics : { items: [] },
  );
});
afterEach(cleanup);
describe("Dashboard telemetry", () => {
  it("shows an honest empty state and a connection route", async () => {
    renderDashboard();
    expect(
      await screen.findByText("Your next request starts the story"),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Connect application" })
        .getAttribute("href"),
    ).toBe("/keys");
  });
  it("requests the selected date range", async () => {
    renderDashboard();
    await screen.findByText("Your next request starts the story");
    fireEvent.change(
      screen.getByRole("combobox", { name: "Dashboard date range" }),
      { target: { value: "30" } },
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/projects/project-a/dashboard?days=30",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });
  it("does not disguise a failed API request as an empty project, and supports retry", async () => {
    api.mockRejectedValue(new Error("Service unavailable"));
    renderDashboard();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Service unavailable",
    );
    expect(screen.queryByText("Your next request starts the story")).toBeNull();
    api.mockImplementation(async (endpoint) =>
      endpoint.includes("/dashboard") ? emptyMetrics : { items: [] },
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Your next request starts the story");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("renders stored traces with an encoded trace-explorer link", async () => {
    api.mockImplementation(async (endpoint) =>
      endpoint.includes("/dashboard")
        ? { ...emptyMetrics, total_requests: 1, successful_requests: 1 }
        : {
            items: [
              {
                id: "1",
                trace_id: "trace/sample",
                name: "Observed request",
                model: "local",
                status: "success",
                latency_ms: 42,
                total_tokens: 20,
                estimated_cost: 0,
                created_at: "2026-10-19",
              },
            ],
          },
    );
    renderDashboard();
    const link = await screen.findByRole("link", { name: /Observed request/ });
    expect(link.getAttribute("href")).toBe("/traces?search=trace%2Fsample");
    expect(screen.getByText("success")).toBeDefined();
  });
});
