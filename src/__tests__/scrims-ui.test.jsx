import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../api/client.js", () => ({ apiFetch: api.fetch, API_BASE: "/.netlify/functions" }));

import { Button, SelectInput, TabNav, TextAreaInput, TextInput } from "../components/ui/Core.jsx";
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
  offers: [{ id: "offer-b", teamId: "team-b", teamName: "Beta", teamTag: "BTA", startsAt: soon(30), durationMinutes: 120, games: 3, series: "bo3", format: "bo3", levelMin: "emerald", levelMax: "diamond", note: "Draft classique.", status: "open", mine: false, requestCount: 1, myRequest: null, revision: 1 }],
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
    expect(text()).toContain("BO3");
    expect(text()).not.toContain("Gamma");

    act(() => button("Répondre").props.onClick());
    act(() => renderer.root.findAllByType(TextAreaInput).find((node) => node.props.label === "Message pour l’équipe").props.onChange("Dispo mardi."));
    await act(async () => { renderer.root.findAllByType("form").find((form) => form.props.className === "scrim-reply").props.onSubmit({ preventDefault() {} }); });
    const respond = api.fetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(respond[1].body)).toEqual({ teamId: "team-a", action: "respond", offerId: "offer-b", message: "Dispo mardi." });
    expect(pushToast).toHaveBeenCalledWith(expect.objectContaining({ type: "green", title: "Réponse envoyée" }));

    act(() => renderer.root.findByType(TabNav).props.onChange("mine"));
    expect(text()).toContain("Gamma");
    await act(async () => { button("Confirmer").props.onClick(); });
    const accept = api.fetch.mock.calls.filter(([, options]) => options?.method === "POST").at(-1);
    expect(JSON.parse(accept[1].body)).toMatchObject({ action: "accept", requestId: "req-c", expectedRevision: 1 });
    expect(refreshAll).toHaveBeenCalledTimes(1);

    const formatSelect = renderer.root.findAllByType(SelectInput).find((node) => node.props.label === "Nombre de games");
    expect(formatSelect.props.children.map((option) => option.props.value)).toEqual(["1", "2", "3", "4", "5", "bo3", "bo5"]);
    act(() => formatSelect.props.onChange("bo5"));
    await act(async () => { renderer.root.findAllByType("form").find((form) => form.props.className === "scrim-form").props.onSubmit({ preventDefault() {} }); });
    const create = api.fetch.mock.calls.filter(([, options]) => options?.method === "POST").at(-1);
    expect(JSON.parse(create[1].body)).toMatchObject({ action: "create", format: "bo5", levelMin: "emerald", levelMax: "diamond" });
    expect(JSON.parse(create[1].body)).not.toHaveProperty("durationMinutes");
  });

  it("keeps players read-only and reports a failed action without hiding the listing", async () => {
    api.fetch.mockImplementation(async (path, options) => {
      if (options?.method === "POST") throw Object.assign(new Error("Cette proposition n’est plus ouverte."), { status: 409 });
      return listing({ canManage: false, mine: [] });
    });
    const pushToast = vi.fn();
    await mount(<ScrimFinder data={data} selectedTeamId="team-a" currentMember={{ role: "player" }} user={{ id: "u2" }} pushToast={pushToast} />);
    expect(button("Répondre")).toBeUndefined();
    act(() => renderer.root.findByType(TabNav).props.onChange("mine"));
    expect(button("Publier la proposition")).toBeUndefined();
    expect(text()).toContain("Seul le staff de l’équipe publie et confirme les scrims.");
  });

  it("shows the confirmed session and the error state with a retry", async () => {
    api.fetch.mockRejectedValueOnce(new Error("Impossible de joindre NXT5 pour le moment."));
    await mount(<ScrimFinder data={data} selectedTeamId="team-a" currentMember={{ role: "captain" }} user={{ id: "u1" }} pushToast={vi.fn()} />);
    expect(text()).toContain("Impossible de joindre NXT5 pour le moment.");
    api.fetch.mockResolvedValue(listing({ offers: [], mine: [], matched: [{ id: "offer-b", teamId: "team-b", teamName: "Beta", startsAt: soon(30), durationMinutes: 120, games: 3, levelMin: "gold", levelMax: "platinum", note: "", status: "matched", mine: false, requests: [{ id: "r", teamName: "Alpha", status: "accepted", message: "" }] }] }));
    await act(async () => { button("Réessayer").props.onClick(); });
    expect(text()).toContain("Aucune proposition ouverte pour le moment");
    act(() => renderer.root.findByType(TabNav).props.onChange("mine"));
    expect(text()).toContain("Scrims confirmés");
    expect(text()).toContain("La séance est dans vos deux plannings.");
  });

  it("keeps the previous listing under a refresh error instead of an empty state", async () => {
    api.fetch.mockResolvedValueOnce(listing());
    await mount(<ScrimFinder data={data} selectedTeamId="team-a" currentMember={{ role: "captain" }} user={{ id: "u1" }} pushToast={vi.fn()} />);
    expect(text()).toContain("Beta");
    api.fetch.mockRejectedValueOnce(new Error("Impossible de joindre NXT5 pour le moment."));
    await act(async () => { button("Actualiser").props.onClick(); });
    expect(text()).toContain("Impossible de joindre NXT5 pour le moment.");
    expect(text()).toContain("Beta");
    expect(text()).not.toContain("Aucune proposition ouverte pour le moment");
  });

  it("shows no empty state when the first load fails", async () => {
    api.fetch.mockRejectedValueOnce(new Error("Impossible de joindre NXT5 pour le moment."));
    await mount(<ScrimFinder data={data} selectedTeamId="team-a" currentMember={{ role: "captain" }} user={{ id: "u1" }} pushToast={vi.fn()} />);
    expect(text()).toContain("Impossible de joindre NXT5 pour le moment.");
    expect(text()).not.toContain("Aucune proposition ouverte pour le moment");
  });

  it("ignores a late listing of the previously selected team", async () => {
    const two = { teams: [{ id: "team-a", name: "Alpha" }, { id: "team-b", name: "Beta" }] };
    const pending = [];
    api.fetch.mockImplementation((path, options) => new Promise((resolve) => pending.push({ path, signal: options?.signal, resolve })));
    await mount(<ScrimFinder data={two} selectedTeamId="team-a" currentMember={{ role: "captain" }} user={{ id: "u1" }} pushToast={vi.fn()} />);
    await act(async () => { button("Actualiser").props.onClick(); });
    expect(pending.map((call) => call.path)).toEqual(["scrims-manage?teamId=team-a", "scrims-manage?teamId=team-a"]);
    expect(pending[0].signal.aborted).toBe(true);
    await act(async () => { renderer.update(<ScrimFinder data={two} selectedTeamId="team-b" currentMember={{ role: "captain" }} user={{ id: "u1" }} pushToast={vi.fn()} />); });
    expect(pending[1].signal.aborted).toBe(true);
    expect(pending.at(-1).path).toBe("scrims-manage?teamId=team-b");
    await act(async () => { pending.at(-1).resolve(listing({ offers: [{ ...listing().offers[0], id: "offer-x", teamName: "Gamma" }] })); });
    await act(async () => { pending[1].resolve(listing({ offers: [{ ...listing().offers[0], id: "offer-y", teamName: "Delta" }] })); });
    expect(text()).toContain("Gamma");
    expect(text()).not.toContain("Delta");
  });

  it("disables publishing while another action runs and refuses a past date", async () => {
    const onSubmit = vi.fn(async () => true);
    await mount(<ScrimOfferForm onSubmit={onSubmit} busy />);
    expect(renderer.root.findAllByType(Button).find((node) => node.props.type === "submit").props.disabled).toBe(true);
    act(() => renderer.update(<ScrimOfferForm onSubmit={onSubmit} busy={false} />));
    const date = () => renderer.root.findAllByType(TextInput).find((node) => node.props.label === "Date et heure");
    expect(date().props.min).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    act(() => date().props.onChange("2020-01-01T21:00"));
    act(() => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(text()).toContain("Choisis une date et une heure à venir.");
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
