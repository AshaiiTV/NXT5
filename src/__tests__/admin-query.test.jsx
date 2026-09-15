import React, { StrictMode } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { AdminQueryProvider, useAdminQuery } from "../hooks/useAdminQuery.js";
import AdminDashboard from "../pages/admin/AdminDashboard.jsx";
import { Button } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
let renderer;
let latest;
function Probe({ path = "admin-dashboard?view=overview" }) {
  latest = useAdminQuery(path);
  return <p>{latest.data?.label || "loading"}</p>;
}
function tree(children, account = "admin-a") {
  return <StrictMode><AdminQueryProvider key={account}>{children}</AdminQueryProvider></StrictMode>;
}
async function render(children = <Probe />, account) {
  await act(async () => {
    if (renderer) renderer.update(tree(children, account));
    else renderer = TestRenderer.create(tree(children, account));
  });
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("administration data lifecycle", () => {
  it("reuses a fresh snapshot when returning to a page without another request", async () => {
    apiFetch.mockResolvedValue({ label: "snapshot" });
    await render();
    await render(null);
    await render();
    expect(latest.data.label).toBe("snapshot");
    expect(latest.loading).toBe(false);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps an expired snapshot visible while revalidating, including on failure", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
    apiFetch.mockResolvedValueOnce({ label: "last success" });
    await render();
    await render(null);
    now.mockReturnValue(130_001);
    const update = deferred();
    apiFetch.mockReturnValueOnce(update.promise);
    await render();
    expect(latest.data.label).toBe("last success");
    expect(latest.loading).toBe(true);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    await act(async () => update.reject(new Error("Connection lost")));
    expect(latest.data.label).toBe("last success");
    expect(latest.error).toBe("Connection lost");
    expect(latest.loading).toBe(false);
  });

  it("deduplicates concurrent readers and only cancels after the last reader leaves", async () => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await render(<><Probe key="a" /><Probe key="b" /></>);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const signal = apiFetch.mock.calls[0][1].signal;
    await render(<><Probe key="a" /></>);
    expect(signal.aborted).toBe(false);
    await render(null);
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve({ label: "obsolete" }));
    apiFetch.mockResolvedValueOnce({ label: "new" });
    await render();
    expect(latest.data.label).toBe("new");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("never shows one filter's results for another filter or accepts a late response", async () => {
    apiFetch.mockResolvedValueOnce({ label: "all devices" });
    await render(<Probe path="admin-audience?device=all" />);
    const mobile = deferred();
    apiFetch.mockReturnValueOnce(mobile.promise);
    await render(<Probe path="admin-audience?device=mobile" />);
    expect(latest.data).toBe(null);
    await render(<Probe path="admin-audience?device=all" />);
    expect(latest.data.label).toBe("all devices");
    await act(async () => mobile.resolve({ label: "late mobile" }));
    expect(latest.data.label).toBe("all devices");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("invalidates sibling filters after a mutation and rejects the pre-mutation response", async () => {
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    await render(<Probe path="admin-access-requests?page=1" />);
    const oldSignal = apiFetch.mock.calls[0][1].signal;
    apiFetch.mockResolvedValueOnce({ label: "saved" });
    await act(async () => {
      latest.invalidate("admin-access-requests");
      await latest.refresh();
    });
    expect(oldSignal.aborted).toBe(true);
    expect(latest.data.label).toBe("saved");
    await act(async () => pending.resolve({ label: "before save" }));
    expect(latest.data.label).toBe("saved");
  });

  it("makes manual refresh bypass the freshness interval", async () => {
    apiFetch.mockResolvedValueOnce({ label: "old" }).mockResolvedValueOnce({ label: "new" });
    await render();
    await act(async () => latest.refresh());
    expect(latest.data.label).toBe("new");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])("clears all cached pages after HTTP %s", async status => {
    apiFetch.mockResolvedValueOnce({ label: "private-a" }).mockResolvedValueOnce({ label: "private-b" });
    await render(<Probe path="admin-a" />);
    await render(<Probe path="admin-b" />);
    const failure = Object.assign(new Error("Access denied"), { status });
    apiFetch.mockRejectedValue(failure);
    await act(async () => { await latest.refresh().catch(() => {}); });
    expect(latest.data).toBe(null);
    await render(<Probe path="admin-a" />);
    expect(latest.data).toBe(null);
    expect(JSON.stringify(renderer.toJSON())).not.toContain("private");
  });

  it("starts with a separate empty cache for a different account", async () => {
    apiFetch.mockResolvedValueOnce({ label: "admin a" });
    await render();
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    await render(<Probe />, "admin-b");
    expect(latest.data).toBe(null);
    await act(async () => pending.resolve({ label: "admin b" }));
    expect(latest.data.label).toBe("admin b");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});

describe("dashboard view loading", () => {
  const snapshot = { generatedAt: "2026-09-15T12:00:00Z", totals: { users: 7, teams: 2, matches: 9 }, daily: [], adoption: {}, activity: {}, growth: {}, teamDirectory: [] };
  it("requests only the visible view and restores it immediately on return", async () => {
    apiFetch.mockResolvedValue(snapshot);
    await render(<AdminDashboard />);
    await render(<AdminDashboard view="teams" />);
    await render(<AdminDashboard view="usage" />);
    await render(<AdminDashboard />);
    expect(apiFetch.mock.calls.map(([path]) => path)).toEqual([
      "admin-dashboard?view=overview", "admin-dashboard?view=teams", "admin-dashboard?view=usage",
    ]);
    expect(renderer.root.findAllByProps({ className: "admin-metric" })).toHaveLength(4);
  });

  it("leaves figures visible during manual refresh and after a network failure", async () => {
    apiFetch.mockResolvedValueOnce(snapshot);
    await render(<AdminDashboard />);
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise);
    const refresh = renderer.root.findAllByType(Button).find(node => node.props.children === "Actualiser");
    await act(async () => refresh.props.onClick());
    expect(renderer.root.findAllByProps({ className: "admin-metric" })).toHaveLength(4);
    await act(async () => pending.reject(new Error("Network interrupted")));
    expect(renderer.root.findAllByProps({ className: "admin-metric" })).toHaveLength(4);
    expect(JSON.stringify(renderer.toJSON())).toContain("dernière actualisation réussie");
  });

  it("refreshes a pending team detail even if the directory refresh fails", async () => {
    const pending = deferred();
    apiFetch.mockResolvedValueOnce({ ...snapshot, teamDirectory: [{ id: "team-a", name: "Equipe test", matches: 0, players: 0 }] })
      .mockReturnValueOnce(pending.promise);
    await render(<AdminDashboard view="teams" />);
    await act(async () => renderer.root.findByProps({ "aria-label": "Voir les données de Equipe test" }).props.onClick());
    const originalSignal = apiFetch.mock.calls[1][1].signal;
    apiFetch.mockImplementation(path => path === "admin-dashboard?view=teams"
      ? Promise.reject(new Error("Directory unavailable"))
      : Promise.resolve({ team: { name: "Equipe actualisée" }, totals: {}, matches: {}, daily: [] }));
    const refresh = renderer.root.findAllByType(Button).find(node => node.props.children === "Actualiser");
    await act(async () => refresh.props.onClick());
    expect(originalSignal.aborted).toBe(true);
    expect(apiFetch.mock.calls.filter(([path]) => path === "admin-dashboard?view=team&teamId=team-a")).toHaveLength(2);
    expect(JSON.stringify(renderer.toJSON())).toContain("Equipe actualisée");
    expect(JSON.stringify(renderer.toJSON())).toContain("Directory unavailable");
    await act(async () => pending.resolve({ team: { name: "Obsolete" } }));
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Obsolete");
  });
});
