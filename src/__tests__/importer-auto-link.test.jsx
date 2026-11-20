import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../api/client.js", () => ({ apiFetch: api.fetch, API_BASE: "/.netlify/functions" }));

import { Button } from "../components/ui/Core.jsx";
import { ImporterAutoLink } from "../components/importer/ImporterAutoLink.jsx";

let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.clearAllMocks(); });
async function mount(component) { await act(async () => { renderer = TestRenderer.create(component); }); await act(async () => {}); }
const text = () => JSON.stringify(renderer.toJSON());
const button = (label) => renderer.root.findAllByType(Button).find((node) => node.props.children === label);
const listing = (overrides = {}) => ({
  canManage: true, minRoster: 4,
  links: [{ id: "link-1", label: "PC de Coach", status: "connected", connectedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 80 * 86400_000).toISOString() }],
  submissions: [
    { id: "sub-1", gameId: "EUW1_8035280010", status: "imported", reason: "", createdAt: new Date().toISOString() },
    { id: "sub-2", gameId: "EUW1_8035280011", status: "pending", reason: "Les postes de l’équipe adverse n’ont pas pu être reconnus automatiquement.", createdAt: new Date().toISOString() },
    { id: "sub-3", gameId: "EUW1_8035280012", status: "skipped" },
    { id: "sub-4", gameId: "EUW1_8035280013", status: "receiving" },
  ],
  ...overrides,
});

describe("automatic import panel", () => {
  beforeEach(() => { api.fetch.mockReset(); });

  it("shows only pending games, generates a code and opens the import form to finalise a game", async () => {
    const payload = { match: { metadata: { matchId: "EUW1_8035280011" } } };
    api.fetch.mockImplementation(async (path, options) => {
      if (!options?.method) return listing();
      const body = JSON.parse(options.body);
      if (body.action === "create") return { code: "ABCD-1234-EF56-7890-AB12-CD34", expiresAt: new Date(Date.now() + 900_000).toISOString() };
      if (body.action === "pending") return { submissionId: body.submissionId, payload };
      return { ok: true };
    });
    const onFinalize = vi.fn(async () => {});
    const pushToast = vi.fn();
    await mount(<ImporterAutoLink teamId="team-a" categories={[{ id: "c1", name: "Scrim" }, { id: "c2", name: "Tournoi" }]} canManage pushToast={pushToast} onFinalize={onFinalize} />);
    expect(api.fetch.mock.calls[0][0]).toBe("team-import-link?teamId=team-a");
    expect(text()).toContain("PC de Coach");
    expect(text()).toContain("Parties à finaliser");
    expect(text()).toContain("EUW1_8035280011");
    for (const id of ["EUW1_8035280010", "EUW1_8035280012", "EUW1_8035280013"]) expect(text()).not.toContain(id);

    await act(async () => { button("Lier un autre ordinateur").props.onClick(); });
    expect(JSON.parse(api.fetch.mock.calls.find(([, options]) => options?.method)[1].body)).toEqual({ teamId: "team-a", action: "create" });
    expect(text()).toContain("ABCD-1234-EF56-7890-AB12-CD34");

    await act(async () => { button("Finaliser").props.onClick(); });
    expect(onFinalize).toHaveBeenCalledWith(payload, expect.objectContaining({ id: "sub-2" }));
    expect(text()).toContain("EUW1_8035280011");

    await act(async () => { button("Révoquer").props.onClick(); });
    const revoke = api.fetch.mock.calls.filter(([, options]) => options?.method).at(-1);
    expect(JSON.parse(revoke[1].body)).toEqual({ teamId: "team-a", action: "revoke", linkId: "link-1" });
    expect(pushToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Liaison révoquée" }));
  });

  it.each(["imported", "skipped"])("removes the last game when it becomes %s", async (status) => {
    api.fetch.mockResolvedValue(listing());
    await mount(<ImporterAutoLink teamId="team-a" canManage refreshKey={0} />);
    const updated = listing();
    updated.submissions[1].status = status;
    api.fetch.mockResolvedValue(updated);
    if (status === "skipped") {
      await act(async () => { await button("Ignorer").props.onClick(); });
      expect(JSON.parse(api.fetch.mock.calls.find(([, options]) => options?.method)[1].body)).toEqual({ teamId: "team-a", action: "dismiss", submissionId: "sub-2" });
    } else {
      await act(async () => { renderer.update(<ImporterAutoLink teamId="team-a" canManage refreshKey={1} />); });
    }
    expect(text()).toContain("Aucune partie à finaliser.");
    expect(text()).not.toContain("EUW1_");
    expect(text()).not.toContain("Parties à finaliser");
    expect(button("Lier un autre ordinateur")).toBeDefined();
  });

  it("keeps players read-only and reports a loading failure with a retry", async () => {
    api.fetch.mockRejectedValueOnce(new Error("Impossible de joindre NXT5 pour le moment."));
    await mount(<ImporterAutoLink teamId="team-a" canManage={false} pushToast={vi.fn()} />);
    expect(text()).toContain("Impossible de joindre NXT5 pour le moment.");
    expect(text()).not.toContain("Aucune partie à finaliser.");
    api.fetch.mockResolvedValue(listing({ canManage: false, links: [] }));
    await act(async () => { button("Réessayer").props.onClick(); });
    expect(button("Lier NXT5 Importer")).toBeUndefined();
    expect(button("Finaliser")).toBeUndefined();
    expect(text()).toContain("Aucune liaison active.");
  });
});
