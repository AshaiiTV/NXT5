import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { emptyNotebook, useMatchupNotebooks, useMatchupStatRows, useNotebookDraft } from "../hooks/useMatchupNotebooks.js";
import { notebookStats } from "../utils/matchup-notebook.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const cleanups = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function mountHook(hook, props) {
  let state, renderer;
  function View(input) { state = hook(input); return null; }
  const mount = (input) => act(() => { renderer = TestRenderer.create(<View {...input} />); });
  mount(props);
  cleanups.push(() => act(() => renderer.unmount()));
  return {
    get state() { return state; },
    update(input) { act(() => renderer.update(<View {...input} />)); },
    remount(input = props) { act(() => renderer.unmount()); mount(input); },
  };
}

function pendingRequests() {
  const requests = [];
  apiFetch.mockImplementation((url, options) => new Promise((resolve, reject) => requests.push({ url, options, body: JSON.parse(options.body), resolve, reject })));
  return requests;
}
const resolve = async (request, value) => { await act(async () => request.resolve(value)); };
const list = (notebooks = [], canEdit = true) => ({ notebooks, canEdit });
const note = (overrides = {}) => ({ ...emptyNotebook(), opponentChampion: "syndra", role: "MID", revision: 1, ...overrides });
const collectionHook = ({ team = "team-a", player = "player-a", champion = "orianna", version = "" }) => useMatchupNotebooks(team, player, champion, version);

describe("matchup notebook collection lifecycle", () => {
  it("isolates teams and profiles from late list responses and clears access while loading", async () => {
    const requests = pendingRequests();
    const app = mountHook(collectionHook, {});
    await resolve(requests[0], list([note()]));
    expect(app.state.canEdit).toBe(true);
    app.update({ team: "team-b", player: "player-b" });
    expect(app.state).toMatchObject({ notebooks: [], canEdit: false, loading: true });
    app.update({ team: "team-c", player: "player-c" });
    expect(requests[1].options.signal.aborted).toBe(true);
    await resolve(requests[2], list([note({ opponentChampion: "ahri" })], false));
    await resolve(requests[1], list([note({ opponentChampion: "lux" })], true));
    expect(app.state.notebooks.map((item) => item.opponentChampion)).toEqual(["ahri"]);
    expect(app.state.canEdit).toBe(false);
    app.update({ team: "", player: "" });
    expect(app.state).toMatchObject({ notebooks: [], canEdit: false, loading: false });
  });

  it("sends the duel identity and expected revision and does not apply an old team's save to a new profile", async () => {
    const requests = pendingRequests();
    const app = mountHook(collectionHook, {});
    await resolve(requests[0], list([note()]));
    const draft = { ...emptyNotebook(), plan: { lanePlan: "Préparer la wave", vigilance: "Niveau 6", toKeep: "" } };
    let saving;
    act(() => { saving = app.state.save({ opponentChampion: "syndra", role: "MID" }, draft, 1); });
    expect(requests[1].body).toEqual({ action: "save", teamId: "team-a", playerId: "player-a", champion: "orianna", opponentChampion: "syndra", role: "MID", ...draft, expectedRevision: 1 });
    app.update({ team: "team-b", player: "player-b" });
    await resolve(requests[2], list([note({ opponentChampion: "ahri" })], false));
    await act(async () => { requests[1].resolve({ notebook: note({ ...draft, revision: 2 }) }); await saving; });
    expect(app.state.notebooks.map((item) => item.opponentChampion)).toEqual(["ahri"]);
    expect(app.state.canEdit).toBe(false);
  });

  it("rejects an incomplete list and retries with fresh permissions", async () => {
    const requests = pendingRequests();
    const app = mountHook(collectionHook, {});
    await resolve(requests[0], { notebooks: [] });
    expect(app.state).toMatchObject({ loading: false, canEdit: false, error: "Réponse du carnet incomplète." });
    act(() => app.state.retry());
    await resolve(requests[1], list([], true));
    expect(app.state).toMatchObject({ loading: false, canEdit: true, error: "" });
    app.update({ version: 2 });
    expect(app.state.loading).toBe(true);
    expect(requests).toHaveLength(3);
  });

  it("does not roll a recently loaded revision back when an earlier save resolves after A → B → A", async () => {
    const requests = pendingRequests();
    const app = mountHook(collectionHook, {});
    await resolve(requests[0], list([note({ revision: 1 })]));
    let saving;
    act(() => { saving = app.state.save({ opponentChampion: "syndra", role: "MID" }, emptyNotebook(), 1); });
    app.update({ team: "team-b" });
    await resolve(requests[2], list());
    app.update({ team: "team-a" });
    const latest = note({ revision: 3, plan: { lanePlan: "Dernière version du coach", vigilance: "", toKeep: "" } });
    await resolve(requests[3], list([latest]));
    await act(async () => { requests[1].resolve({ notebook: note({ revision: 2 }) }); await saving; });
    expect(app.state.notebooks).toEqual([latest]);
  });
});

describe("shared notebook drafts", () => {
  it("preserves a failed save across navigation and scopes drafts to their account and duel", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Connexion interrompue"));
    const base = note({ revision: 4 });
    const props = { keyName: "failure|account-a|MID|syndra", notebook: base, save };
    const hook = ({ keyName, notebook, save }) => useNotebookDraft(keyName, notebook, save);
    const app = mountHook(hook, props);
    const changed = { ...emptyNotebook(), plan: { lanePlan: "Acheter tôt", vigilance: "", toKeep: "" } };
    act(() => app.state.change(changed));
    await act(async () => { expect(await app.state.submit()).toBe(false); });
    expect(app.state).toMatchObject({ value: changed, dirty: true, busy: false, error: "Connexion interrompue" });
    expect(save).toHaveBeenCalledWith(changed, 4);
    app.remount({ ...props, keyName: "failure|account-b|MID|syndra" });
    expect(app.state).toMatchObject({ dirty: false, value: emptyNotebook() });
    app.remount(props);
    expect(app.state).toMatchObject({ dirty: true, value: changed, revision: 4 });
    act(() => app.state.discard());
  });

  it("keeps a conflict draft and its original revision when a newer server notebook arrives", async () => {
    const failure = Object.assign(new Error("Conflict"), { code: "NOTEBOOK_REVISION_CONFLICT" });
    const save = vi.fn().mockRejectedValue(failure);
    const props = { keyName: "conflict|MID|syndra", notebook: note({ revision: 2 }), save };
    const hook = ({ keyName, notebook, save }) => useNotebookDraft(keyName, notebook, save);
    const app = mountHook(hook, props);
    const changed = { ...emptyNotebook(), plan: { lanePlan: "Mon plan local", vigilance: "", toKeep: "" } };
    act(() => app.state.change(changed));
    await act(async () => app.state.submit());
    expect(app.state.error).toContain("modifié par une autre personne");
    expect(app.state.dirty).toBe(true);
    const latest = note({ revision: 3, plan: { lanePlan: "Plan du coach", vigilance: "", toKeep: "" } });
    app.update({ ...props, notebook: latest });
    expect(app.state).toMatchObject({ value: changed, revision: 2, dirty: true });
    act(() => app.state.discard());
    expect(app.state).toMatchObject({ value: { plan: latest.plan, experiments: [] }, revision: 3, dirty: false });
  });

  it("removes the navigation draft only after a confirmed save", async () => {
    const changed = { ...emptyNotebook(), plan: { lanePlan: "Version validée", vigilance: "", toKeep: "" } };
    const saved = note({ ...changed, revision: 5 });
    const save = vi.fn().mockResolvedValue(saved);
    const props = { keyName: "success|MID|syndra", notebook: note({ revision: 4 }), save };
    const hook = ({ keyName, notebook, save }) => useNotebookDraft(keyName, notebook, save);
    const app = mountHook(hook, props);
    act(() => app.state.change(changed));
    await act(async () => { expect(await app.state.submit()).toBe(true); });
    expect(app.state).toMatchObject({ value: changed, dirty: false, saved: true, revision: 5 });
    app.update({ ...props, notebook: saved });
    expect(app.state).toMatchObject({ value: changed, dirty: false, saved: true, revision: 5 });
    app.remount({ ...props, notebook: saved });
    expect(app.state).toMatchObject({ value: changed, dirty: false, saved: false, revision: 5 });
  });

  it("preserves a newer draft entered after navigating back while the previous save was still pending", async () => {
    let resolveSave;
    const save = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    const props = { keyName: "navigation-save-race|MID|syndra", notebook: note({ revision: 4 }), save };
    const hook = ({ keyName, notebook, save }) => useNotebookDraft(keyName, notebook, save);
    const app = mountHook(hook, props);
    const initial = { ...emptyNotebook(), plan: { lanePlan: "Première version", vigilance: "", toKeep: "" } };
    const newer = { ...emptyNotebook(), plan: { lanePlan: "Complément après navigation", vigilance: "", toKeep: "" } };
    act(() => app.state.change(initial));
    let saving;
    act(() => { saving = app.state.submit(); });
    app.remount();
    act(() => app.state.change(newer));
    const saved = note({ ...initial, revision: 5 });
    await act(async () => { resolveSave(saved); await saving; });
    app.update({ ...props, notebook: saved });
    expect(app.state).toMatchObject({ value: newer, dirty: true });
    app.remount({ ...props, notebook: saved });
    expect(app.state).toMatchObject({ value: newer, dirty: true });
    act(() => app.state.discard());
  });

  it("ignores a previous key's save result after the same instance returns A → B → A", async () => {
    let resolveSave;
    const save = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    const props = { keyName: "same-instance-a|MID|syndra", notebook: note({ revision: 4 }), save };
    const hook = ({ keyName, notebook, save }) => useNotebookDraft(keyName, notebook, save);
    const app = mountHook(hook, props);
    const initial = { ...emptyNotebook(), plan: { lanePlan: "Version soumise", vigilance: "", toKeep: "" } };
    const newer = { ...emptyNotebook(), plan: { lanePlan: "Nouvelle version", vigilance: "", toKeep: "" } };
    act(() => app.state.change(initial));
    let saving;
    act(() => { saving = app.state.submit(); });
    app.update({ ...props, keyName: "same-instance-b|MID|syndra" });
    app.update(props);
    act(() => app.state.change(newer));
    await act(async () => { resolveSave(note({ ...initial, revision: 5 })); await saving; });
    expect(app.state).toMatchObject({ value: newer, dirty: true, saved: false, busy: false });
    act(() => app.state.discard());
  });

  it("releases the busy state when changing keys and keeps it released when the old save settles", async () => {
    let resolveSave;
    const save = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    const props = { keyName: "busy-instance-a|MID|syndra", notebook: note({ revision: 4 }), save };
    const hook = ({ keyName, notebook, save }) => useNotebookDraft(keyName, notebook, save);
    const app = mountHook(hook, props);
    act(() => app.state.change({ ...emptyNotebook(), plan: { lanePlan: "Version soumise", vigilance: "", toKeep: "" } }));
    let saving;
    act(() => { saving = app.state.submit(); });
    expect(app.state.busy).toBe(true);
    app.update({ ...props, keyName: "busy-instance-b|MID|syndra" });
    expect(app.state.busy).toBe(false);
    await act(async () => { resolveSave(note({ revision: 5 })); await saving; });
    expect(app.state).toMatchObject({ busy: false, dirty: false, saved: false, revision: 4 });
    app.update(props);
    act(() => app.state.discard());
  });
});

const own = { id: "own", role: "MID", champion: "Orianna", team_key: "ALLY", raw: { participantId: 1 } };
const enemy = { id: "enemy", role: "MID", champion: "Syndra", team_key: "ENEMY", raw: { participantId: 6 } };
const row = (id, raw = {}) => ({ ...own, match: { id, team_id: "team-a", duration: "25:00", participants: [own, enemy], raw } });
const detail = (id, raw, team = "team-a") => ({ ...row(id).match, team_id: team, raw });
const frame = (timestamp = 600000, ownGold = 3000) => ({ timestamp, participantFrames: {
  1: { participantId: 1, minionsKilled: 70, jungleMinionsKilled: 0, totalGold: ownGold, xp: 4000 },
  6: { participantId: 6, minionsKilled: 60, jungleMinionsKilled: 0, totalGold: 2800, xp: null },
} });
const statsHook = ({ rows, team = "team-a", version = 0 }) => useMatchupStatRows(team, rows, version);

describe("matchup lane detail loading", () => {
  it("keeps unknown XP unavailable and uses full detail gold while preserving compact CS before loading", async () => {
    const requests = pendingRequests();
    const compact = row("one", { nxt5: { timelineSummary: { csMilestones: { 1: { cs10: 70 }, 6: { cs10: 60 } } } } });
    const app = mountHook(statsHook, { rows: [compact] });
    expect(notebookStats(app.state.rows).milestones[0]).toMatchObject({ cs: { value: 10, count: 1 }, gold: { value: null, count: 0 } });
    await resolve(requests[0], { matches: [detail("one", { timeline: { info: { frames: [frame()] } } })] });
    expect(notebookStats(app.state.rows).milestones[0]).toMatchObject({ cs: { value: 10, count: 1 }, gold: { value: 200, count: 1 }, xp: { value: null, count: 0 } });
    expect(app.state).toMatchObject({ loading: false, loaded: 1, total: 1 });
  });

  it("does not apply late detail data after a team switch", async () => {
    const requests = pendingRequests();
    const rows = [row("one")];
    const app = mountHook(statsHook, { rows });
    app.update({ rows, team: "team-b" });
    await resolve(requests[1], { matches: [detail("one", { timeline: { info: { frames: [frame(600000, 3100)] } } }, "team-b")] });
    await resolve(requests[0], { matches: [detail("one", { timeline: { info: { frames: [frame(600000, 9000)] } } })] });
    expect(requests[0].options.signal.aborted).toBe(true);
    expect(app.state.rows[0].match.team_id).toBe("team-b");
    expect(notebookStats(app.state.rows).milestones[0].gold.value).toBe(300);
  });

  it("keeps successful earlier batches and exposes missing games without inventing zero measurements", async () => {
    const requests = pendingRequests();
    const rows = Array.from({ length: 6 }, (_, index) => row(`game-${index}`));
    const app = mountHook(statsHook, { rows });
    expect(requests[0].body.matchIds).toHaveLength(5);
    await resolve(requests[0], { matches: rows.slice(0, 5).map((item) => detail(item.match.id, { timeline: { info: { frames: [frame()] } } })) });
    expect(requests[1].body.matchIds).toEqual(["game-5"]);
    await resolve(requests[1], { matches: [] });
    expect(app.state).toMatchObject({ loaded: 5, total: 6, loading: false });
    expect(app.state.error).toContain("Certaines games ne sont plus disponibles");
    expect(notebookStats(app.state.rows).milestones[0].gold).toEqual({ value: 200, count: 5 });
  });

  it("retains legacy timelineFrames when fetching the full match", async () => {
    const requests = pendingRequests();
    const app = mountHook(statsHook, { rows: [row("legacy")] });
    const raw = { timelineFrames: [frame()] };
    expect(notebookStats([row("legacy", raw)]).milestones[0].gold.value).toBe(200);
    await resolve(requests[0], { matches: [detail("legacy", raw)] });
    expect(notebookStats(app.state.rows).milestones[0].gold).toEqual({ value: 200, count: 1 });
  });

  it("retains the earliest observation in the window even when source frames are unordered", async () => {
    const requests = pendingRequests();
    const app = mountHook(statsHook, { rows: [row("unordered")] });
    const raw = { timeline: { info: { frames: [frame(660000, 3500), frame(600000, 3000)] } } };
    expect(notebookStats([row("unordered", raw)]).milestones[0].gold.value).toBe(200);
    await resolve(requests[0], { matches: [detail("unordered", raw)] });
    expect(notebookStats(app.state.rows).milestones[0].gold).toEqual({ value: 200, count: 1 });
  });
});
