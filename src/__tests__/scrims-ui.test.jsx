import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../api/client.js", () => ({ apiFetch: api.fetch, API_BASE: "/.netlify/functions" }));

import { Button, SelectInput, TextAreaInput } from "../components/ui/Core.jsx";
import ScrimFinder, { ScrimOfferForm, levelRange } from "../pages/workspace/ScrimFinder.jsx";

let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.clearAllMocks(); });
async function mount(component) { await act(async () => { renderer = TestRenderer.create(component); }); await act(async () => {}); }
const text = () => JSON.stringify(renderer.toJSON());
const button = (label) => renderer.root.findAllByType(Button).find((node) => node.props.children === label);
const soon = (hours) => new Date(Date.now() + hours * 3600_000).toISOString();
const data = { teams: [{ id: "team-a", name: "Alpha" }] };
const listing = (overrides = {}) => ({
  canManage: true,
  offers: [{ id: "offer-b", teamId: "team-b", teamName: "Beta", teamTag: "BTA", startsAt: soon(30), durationMinutes: 120, games: 3, levelMin: "emerald", levelMax: "diamond", note: "Draft classique.", status: "open", mine: false, requestCount: 1, myRequest: null, revision: 1 }],
  mine: [{ id: "offer-a", teamId: "team-a", teamName: "Alpha", startsAt: soon(48), durationMinutes: 90, games: 2, levelMin: "gold", levelMax: "gold", note: "", status: "open", mine: true, revision: 1, requestCount: 1, requests: [{ id: "req-c", teamName: "Gamma", teamTag: "GMA", message: "On est dispo.", status: "pending" }] }],
  requests: [],
  matched: [],
  ...overrides,
});

describe("scrim finder page", () => {
  beforeEach(() => { api.fetch.mockReset(); });

  it("loads the team listing and lets the staff answer, confirm and publish", async () => {
    api.fetch.mockImplementation(async (path, options) => options?.method === "POST" ? { ok: true } : listing());
    const pushToast = vi.fn();
    const refreshAll = vi.fn(async () => {});
    await mount(<ScrimFinder data={data} selectedTeamId="team-a" currentMember={{ role: "captain" }} user={{ id: "u1" }} pushToast={pushToast} refreshAll={refreshAll} />);
    expect(api.fetch.mock.calls[0][0]).toBe("scrims-manage?teamId=team-a");
    expect(text()).toContain("Beta");
    expect(text()).toContain("Émeraude à Diamant");
    expect(text()).toContain("Gamma");

    act(() => button("Répondre").props.onClick());
    act(() => renderer.root.findAllByType(TextAreaInput).find((node) => node.props.label === "Message pour l’équipe").props.onChange("Dispo mardi."));
    await act(async () => { renderer.root.findAllByType("form").find((form) => form.props.className === "scrim-reply").props.onSubmit({ preventDefault() {} }); });
    const respond = api.fetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(respond[1].body)).toEqual({ teamId: "team-a", action: "respond", offerId: "offer-b", message: "Dispo mardi." });
    expect(pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "green", title: "Réponse envoyée" }));

    await act(async () => { button("Confirmer").props.onClick(); });
    const accept = api.fetch.mock.calls.filter(([, options]) => options?.method === "POST").at(-1);
    expect(JSON.parse(accept[1].body)).toMatchObject({ action: "accept", requestId: "req-c", expectedRevision: 1 });
    expect(refreshAll).toHaveBeenCalledTimes(1);

    act(() => renderer.root.findAllByType(SelectInput).find((node) => node.props.label === "Nombre de games").props.onChange("5"));
    await act(async () => { renderer.root.findAllByType("form").find((form) => form.props.className === "scrim-form").props.onSubmit({ preventDefault() {} }); });
    const create = api.fetch.mock.calls.filter(([, options]) => options?.method === "POST").at(-1);
    expect(JSON.parse(create[1].body)).toMatchObject({ action: "create", games: 5, levelMin: "emerald", levelMax: "diamond", durationMinutes: 120 });
  });

  it("keeps players read-only and reports a failed action without hiding the listing", async () => {
    api.fetch.mockImplementation(async (path, options) => {
      if (options?.method === "POST") throw Object.assign(new Error("Cette proposition n’est plus ouverte."), { status: 409 });
      return listing({ canManage: false, mine: [] });
    });
    const pushToast = vi.fn();
    await mount(<ScrimFinder data={data} selectedTeamId="team-a" currentMember={{ role: "player" }} user={{ id: "u2" }} pushToast={pushToast} />);
    expect(button("Répondre")).toBeUndefined();
    expect(button("Publier la proposition")).toBeUndefined();
    expect(text()).toContain("Seul le staff de l’équipe publie et confirme les scrims.");
  });

  it("shows the confirmed session and the error state with a retry", async () => {
    api.fetch.mockRejectedValueOnce(new Error("Impossible de joindre NXT5 pour le moment."));
    await mount(<ScrimFinder data={data} selectedTeamId="team-a" currentMember={{ role: "captain" }} user={{ id: "u1" }} pushToast={vi.fn()} />);
    expect(text()).toContain("Impossible de joindre NXT5 pour le moment.");
    api.fetch.mockResolvedValue(listing({ offers: [], mine: [], matched: [{ id: "offer-b", teamId: "team-b", teamName: "Beta", startsAt: soon(30), durationMinutes: 120, games: 3, levelMin: "gold", levelMax: "platinum", note: "", status: "matched", mine: false, requests: [{ id: "r", teamName: "Alpha", status: "accepted", message: "" }] }] }));
    await act(async () => { button("Réessayer").props.onClick(); });
    expect(text()).toContain("Scrims confirmés");
    expect(text()).toContain("Ta réponse a été acceptée.");
    expect(text()).toContain("Aucune proposition ouverte pour le moment");
  });

  it("refuses an inverted level range before sending", async () => {
    const onSubmit = vi.fn(async () => true);
    await mount(<ScrimOfferForm onSubmit={onSubmit} busy={false} />);
    act(() => renderer.root.findAllByType(SelectInput).find((node) => node.props.label === "Niveau minimum").props.onChange("master"));
    expect(text()).toContain("Le niveau minimum dépasse le niveau maximum.");
    act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(levelRange({ levelMin: "gold", levelMax: "gold" })).toBe("Or");
  });
});
