import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Planning } from "../pages/workspace/Planning.jsx";
import { createPlanningStore, upsertAvailability } from "../utils/planning-store.js";

const CURRENT_WEEK = "2026-09-07";
const NEXT_WEEK = "2026-09-14";
const players = [
  { id: "top", team_id: "team", user_id: "top-user", name: "Alex", role: "TOP", roster_status: "MAIN" },
  { id: "mid", team_id: "team", user_id: "mid-user", name: "Camille", role: "MID", roster_status: "MAIN" },
];
let renderer;
let store;

beforeEach(() => {
  renderer = null;
  store = null;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
    store?.pause();
  });
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function row(playerId, notes, overrides = {}) {
  return {
    id: `row-${playerId}`, team_id: "team", player_id: playerId,
    week_start: CURRENT_WEEK, notes, slots: {}, updated_at: "2026-09-08T12:00:00Z",
    ...overrides,
  };
}

function savedRow(body) {
  return row(body.playerId, body.notes, {
    team_id: body.teamId, week_start: body.weekStart, slots: body.slots,
    updated_at: "2026-09-08T12:00:01Z",
  });
}

function textContent(node) {
  return typeof node === "string" ? node : (node.children || []).map(textContent).join("");
}

function mountPlanning({ availability = [], roster = players, userId = "top-user", memberRole = "player", save: saveImpl, refreshAll } = {}) {
  let setRows;
  const save = vi.fn(saveImpl || (async body => savedRow(body)));
  const onSaved = vi.fn(saved => setRows(current => upsertAvailability(current, saved)));
  store = createPlanningStore({ save, onSaved });
  function PlanningWithSavedRows(props) {
    const [rows, updateRows] = useState(availability);
    setRows = updateRows;
    return <Planning
      data={{ players: roster, availability: rows }}
      selectedTeamId={props.teamId}
      user={{ id: props.userId }}
      currentMember={{ role: props.memberRole }}
      planningStore={store}
      refreshAll={refreshAll}
    />;
  }
  let props = { teamId: "team", userId, memberRole };
  act(() => { renderer = TestRenderer.create(<PlanningWithSavedRows {...props} />); });
  return {
    save,
    onSaved,
    update(next) {
      props = { ...props, ...next };
      act(() => renderer.update(<PlanningWithSavedRows {...props} />));
    },
    edit(notes) {
      act(() => renderer.root.findByProps({ id: "planning-note" }).props.onChange({ target: { value: notes } }));
    },
  };
}

const notesSection = () => renderer.root.findByProps({ "aria-labelledby": "planning-team-notes-title" });
const noteTexts = () => notesSection().findAll(node => node.type === "p" && node.props.className?.split(" ").includes("nxt5-planning-note-text")).map(textContent);
const buttonNamed = name => renderer.root.findAllByType("button").find(node => textContent(node) === name || node.props["aria-label"] === name);

describe("shared weekly planning notes", () => {
  it.each(["top-user", "mid-user"])("shows both players' saved notes to %s with their names and roles", userId => {
    mountPlanning({ userId, availability: [row("top", "Disponible après 20 h"), row("mid", "Retard jeudi")] });

    expect(textContent(renderer.root.findByProps({ id: "planning-team-notes-title" }))).toBe("Précisions de l’équipe");
    expect(noteTexts()).toEqual(["Disponible après 20 h", "Retard jeudi"]);
    const entries = notesSection().findByType("ul").findAllByType("li");
    expect(textContent(entries[0])).toContain("Alex");
    expect(textContent(entries[0])).toContain("Top");
    expect(textContent(entries[1])).toContain("Camille");
    expect(textContent(entries[1])).toContain("Mid");
    expect(notesSection().findAllByType("details")).toHaveLength(0);
    expect(renderer.root.findByProps({ id: "planning-note" }).props.maxLength).toBe(500);
    expect(textContent(renderer.root.findByProps({ htmlFor: "planning-note" }))).toBe("Précisions sur tes disponibilités");
  });

  it("lets an unlinked team member read all notes without an unusable editor", () => {
    mountPlanning({ userId: "viewer", memberRole: "member", availability: [row("top", "Pas avant 21 h"), row("mid", "Libre mercredi")] });

    expect(noteTexts()).toEqual(["Pas avant 21 h", "Libre mercredi"]);
    expect(renderer.root.findAllByType("textarea")).toHaveLength(0);
  });

  it("filters notes by team and selected week, omits blank and unknown profiles, and includes substitutes", () => {
    const roster = [
      ...players,
      { id: "sub", team_id: "team", user_id: "sub-user", name: "Sam", role: "SUB" },
      { id: "other", team_id: "other-team", user_id: "top-user", name: "Autre top", role: "TOP" },
    ];
    const app = mountPlanning({ roster, availability: [
      row("top", "Cette semaine"),
      row("mid", " \n\t "),
      row("sub", "Disponible en remplacement"),
      row("missing-player", "Profil supprimé"),
      row("top", "Semaine prochaine", { id: "next-top", week_start: NEXT_WEEK }),
      row("other", "Autre équipe", { team_id: "other-team", week_start: NEXT_WEEK }),
      row("top", "Mauvaise équipe", { team_id: "other-team" }),
    ] });

    expect(noteTexts()).toEqual(["Cette semaine", "Disponible en remplacement"]);
    const nextWeek = renderer.root.findAllByType("button").find(node => textContent(node).includes("Semaine d’après"));
    act(() => nextWeek.props.onClick());
    expect(noteTexts()).toEqual(["Semaine prochaine"]);
    expect(renderer.root.findByProps({ id: "planning-note" }).props.value).toBe("Semaine prochaine");

    app.update({ teamId: "other-team" });
    expect(noteTexts()).toEqual(["Autre équipe"]);
    expect(renderer.root.findByProps({ id: "planning-note" }).props.value).toBe("Autre équipe");
  });

  it.each(["coach-user", "assistant-user"])("uses the shared Encadrement note for %s while keeping older staff notes visible", userId => {
    const roster = [
      ...players,
      { id: "coach", team_id: "team", user_id: "coach-user", name: "Robin", role: "COACH" },
      { id: "assistant", team_id: "team", user_id: "assistant-user", name: "Charlie", role: "ASSISTANT" },
    ];
    mountPlanning({ roster, userId, memberRole: "coach", availability: [
      row("coach", "Staff présent à 20 h"),
      row("assistant", "Ancienne précision assistant"),
    ] });

    expect(noteTexts()).toEqual(expect.arrayContaining(["Staff présent à 20 h", "Ancienne précision assistant"]));
    const entries = notesSection().findByType("ul").findAllByType("li");
    const shared = entries.find(node => textContent(node).includes("Staff présent à 20 h"));
    const legacy = entries.find(node => textContent(node).includes("Ancienne précision assistant"));
    expect(textContent(shared)).toContain("Encadrement");
    expect(textContent(legacy)).toContain("Charlie");
    expect(textContent(legacy)).toContain("Assistant coach");
    expect(renderer.root.findByProps({ id: "planning-note" }).props.value).toBe("Staff présent à 20 h");
    expect(textContent(renderer.root.findByProps({ htmlFor: "planning-note" }))).toBe("Précisions de l’encadrement");
  });

  it("renders multiline notes and markup as literal text", () => {
    const note = 'Disponible mardi\n<img src=x onerror="alert(1)">\nhttps://example.com/dispos';
    mountPlanning({ availability: [row("top", note)] });

    expect(noteTexts()).toEqual([note]);
    const entry = notesSection().findByType("ul").findByType("li");
    const paragraph = entry.findAllByType("p").find(node => textContent(node) === note);
    expect(paragraph.children).toEqual([note]);
    expect(paragraph.props.dangerouslySetInnerHTML).toBeUndefined();
  });

  it("debounces edits and shares the confirmed note only after saving", async () => {
    let confirm;
    const app = mountPlanning({
      availability: [row("top", "Ancienne précision"), row("mid", "Disponible jeudi")],
      save: body => new Promise(resolve => { confirm = () => resolve(savedRow(body)); }),
    });

    app.edit("Nouveau brouillon");
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    app.edit("Disponible après 21 h");
    await act(async () => { await vi.advanceTimersByTimeAsync(649); });
    expect(app.save).not.toHaveBeenCalled();
    expect(noteTexts()).toEqual(["Ancienne précision", "Disponible jeudi"]);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(app.save).toHaveBeenCalledOnce();
    expect(app.save.mock.calls[0][0]).toMatchObject({ teamId: "team", playerId: "top", weekStart: CURRENT_WEEK, notes: "Disponible après 21 h" });
    expect(noteTexts()).toEqual(["Ancienne précision", "Disponible jeudi"]);
    await act(async () => { confirm(); });
    expect(app.onSaved).toHaveBeenCalledOnce();
    expect(noteTexts()).toEqual(["Disponible après 21 h", "Disponible jeudi"]);

    app.update({ userId: "mid-user" });
    expect(noteTexts()).toEqual(["Disponible après 21 h", "Disponible jeudi"]);
    expect(renderer.root.findByProps({ id: "planning-note" }).props.value).toBe("Disponible jeudi");
  });

  it("keeps a failed edit private and preserves it for retry without refreshing away the draft", async () => {
    let attempts = 0;
    const refreshAll = vi.fn();
    const app = mountPlanning({
      availability: [row("top", "Précision enregistrée", { slots: { MON: ["20:00"] } })],
      refreshAll,
      save: async body => {
        attempts += 1;
        if (attempts < 3) throw new Error("Réseau indisponible");
        return savedRow(body);
      },
    });

    app.edit("Précision à conserver");
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(noteTexts()).toEqual(["Précision enregistrée"]);
    expect(renderer.root.findByProps({ id: "planning-note" }).props.value).toBe("Précision à conserver");
    expect(textContent(renderer.root.findByProps({ role: "status" }))).toContain("Enregistrement impossible");

    await act(async () => { await buttonNamed("Actualiser les précisions").props.onClick(); });
    expect(refreshAll).not.toHaveBeenCalled();
    expect(app.onSaved).not.toHaveBeenCalled();
    expect(noteTexts()).toEqual(["Précision enregistrée"]);
    expect(renderer.root.findByProps({ id: "planning-note" }).props.value).toBe("Précision à conserver");

    await act(async () => { await buttonNamed("Réessayer").props.onClick(); });
    expect(app.save).toHaveBeenCalledTimes(3);
    expect(app.save.mock.calls[2][0]).toMatchObject({ notes: "Précision à conserver", slots: { MON: ["20:00"] } });
    expect(noteTexts()).toEqual(["Précision à conserver"]);
  });

  it("removes a cleared note only after autosave confirms it and shows the current week's empty state", async () => {
    let confirm;
    const app = mountPlanning({
      availability: [
        row("top", "Précision à supprimer"),
        row("mid", "Précision de la semaine prochaine", { id: "next-mid", week_start: NEXT_WEEK }),
      ],
      save: body => new Promise(resolve => { confirm = () => resolve(savedRow(body)); }),
    });

    app.edit("");
    expect(noteTexts()).toEqual(["Précision à supprimer"]);
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(app.save).toHaveBeenCalledOnce();
    expect(app.save.mock.calls[0][0]).toMatchObject({ playerId: "top", weekStart: CURRENT_WEEK, notes: "" });
    expect(noteTexts()).toEqual(["Précision à supprimer"]);

    await act(async () => { confirm(); });
    expect(app.onSaved).toHaveBeenCalledOnce();
    expect(noteTexts()).toEqual([]);
    expect(notesSection().findAllByType("ul")).toHaveLength(0);
    expect(textContent(notesSection())).toContain("Aucune précision partagée pour cette semaine.");
    expect(textContent(notesSection())).not.toContain("Précision de la semaine prochaine");
  });

  it("waits for pending notes to save before refreshing the team's latest notes", async () => {
    let confirm;
    const refreshAll = vi.fn(async () => {});
    const app = mountPlanning({
      availability: [row("top", "Ancienne précision")],
      refreshAll,
      save: body => new Promise(resolve => { confirm = () => resolve(savedRow(body)); }),
    });
    app.edit("À enregistrer avant actualisation");
    const refreshButton = buttonNamed("Actualiser les précisions");
    let refresh;
    await act(async () => { refresh = refreshButton.props.onClick(); });

    expect(app.save).toHaveBeenCalledOnce();
    expect(refreshAll).not.toHaveBeenCalled();
    expect(refreshButton.props.disabled).toBe(true);
    expect(noteTexts()).toEqual(["Ancienne précision"]);

    await act(async () => { confirm(); await refresh; });
    expect(app.onSaved).toHaveBeenCalledOnce();
    expect(refreshAll).toHaveBeenCalledOnce();
    expect(app.onSaved.mock.invocationCallOrder[0]).toBeLessThan(refreshAll.mock.invocationCallOrder[0]);
    expect(noteTexts()).toEqual(["À enregistrer avant actualisation"]);
    expect(buttonNamed("Actualiser les précisions").props.disabled).toBe(false);
  });
});
