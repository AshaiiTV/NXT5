import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Button } from "../components/ui/Core.jsx";
import { Reports, ReportPreview, buildRetroactiveCoachContent, buildGameReviewContent, stripGeneratedReportContent, REPORT_REWRITE_MARKER, matchPlayerCoachReads } from "../pages/workspace/GameWorkspace.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), apiUploadJson: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("react-dom", () => ({ createPortal: (children) => children }));
const cleanups = [];
const game = (id) => ({
  id, team_id: "team", game_id: `EUW1_${id}`, result: "Victoire", side: "BLUE", duration: "25:00",
  raw: { nxt5Label: `Game ${id}` },
  participants: [
    { role: "ADC", team_key: "ALLY", summoner_name: `Player ${id}`, champion: "Jinx", kills: 3, deaths: 2, assists: 4, gold: 10000, damage: 20000, vision: 15, raw: { participantId: 1, teamId: 100 } },
    { role: "ADC", team_key: "ENEMY", summoner_name: "Opponent", champion: "Ashe", kills: 2, deaths: 3, assists: 1, gold: 8000, damage: 17000, vision: 12, raw: { participantId: 6, teamId: 200 } },
  ],
});
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/rapports"), history: { replaceState: vi.fn((_state, _unused, url) => { window.location = new URL(url, "https://nxt5.test"); }) } });
  vi.stubGlobal("document", { body: { style: {} }, documentElement: { style: {} }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.resetAllMocks(); vi.unstubAllGlobals(); });
async function mount({ reports = [], matches = [] } = {}) {
  const props = { data: { reports, matches }, selectedTeamId: "team", currentMember: { role: "player" }, user: { id: "user" }, refreshAll: vi.fn(), pushToast: vi.fn() };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<Reports {...props} />); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
const button = (renderer, label) => renderer.root.findAllByType(Button).find((item) => item.props.children === label);
const output = (renderer) => JSON.stringify(renderer.toJSON());

describe("complete automatic coaching", () => {
  it("preserves unmarked historical content verbatim, including headings and whitespace", () => {
    const notes = "  Notes staff\nDécision manuelle\n\n/KDA \"ADC\"  \n";
    const content = buildRetroactiveCoachContent({ content: notes, match_ids: ["one"] }, [game("one")]);
    expect(content).toContain("VERDICT COACH");
    expect(content).toContain("LECTURE PAR JOUEUR");
    expect(stripGeneratedReportContent(content)).toBe(notes);
    expect(stripGeneratedReportContent(notes)).toBe(notes);
  });
  it("preserves corrections made anywhere in a legacy V2 review on upgrade", () => {
    const legacy = "VERDICT COACH\nCorrection écrite par le staff dans le verdict\n\n[NXT5_REPORT_V2]\nNotes staff\nDécision manuelle  \n";
    const upgraded = buildRetroactiveCoachContent({ content: legacy, match_ids: ["one"] }, [game("one")]);
    const preservedText = legacy.replace("[NXT5_REPORT_V2]\n", "");
    expect(stripGeneratedReportContent(upgraded)).toBe(preservedText);
    expect(stripGeneratedReportContent(legacy)).toBe(preservedText);
    expect(buildRetroactiveCoachContent({ content: upgraded, match_ids: ["one"] }, [game("one")])).toBe(upgraded);
  });
  it("refreshes a generated review without duplicating coaching or losing a marker in staff notes", () => {
    const notes = `  Conserver cette séquence\n${REPORT_REWRITE_MARKER}\nExemple cité par le coach\n`;
    const first = buildRetroactiveCoachContent({ content: "", match_ids: ["one"] }, [game("one")], notes);
    const second = buildRetroactiveCoachContent({ content: first, match_ids: ["one"] }, [game("one")]);
    expect(second).toBe(first);
    expect(stripGeneratedReportContent(second)).toBe(notes);
  });
  it("includes each game's complete coaching in source order for a group", () => {
    const content = buildRetroactiveCoachContent({ title: "Bloc", content: "Décision staff", match_ids: ["two", "one"] }, [game("one"), game("two")]);
    expect(content).toContain("GAME 1 · Game two");
    expect(content).toContain("GAME 2 · Game one");
    expect(content).toContain("ADC · Player one");
    expect(content).toContain("ADC · Player two");
    expect(content.match(/LECTURE PAR JOUEUR/g)).toHaveLength(2);
    expect(stripGeneratedReportContent(content)).toBe("Décision staff");
  });
  it("keeps saved content if even one linked game is unavailable", () => {
    expect(buildRetroactiveCoachContent({ content: "Bilan complet enregistré", match_ids: ["one", "missing"] }, [game("one")])).toBe("Bilan complet enregistré");
    expect(buildRetroactiveCoachContent({ content: "Review libre", match_ids: [] }, [])).toBe("Review libre");
  });
  it("does not mistake unavailable death timings for zero deaths", () => {
    const reads = matchPlayerCoachReads(game("one"));
    expect(reads[0].catchText).toContain("Timings des morts indisponibles");
    expect(reads[0].goodText).toContain("Événements de combat indisponibles");
  });
  it("hides the internal generated marker in the rendered review", () => {
    const html = renderToStaticMarkup(<ReportPreview content={buildGameReviewContent(game("one"))} rows={[]} />);
    expect(html).not.toContain(REPORT_REWRITE_MARKER);
    expect(html).toContain("Notes staff");
  });
});

describe("automatic reviews in the workspace", () => {
  it("loads old reviews outside the match page and enriches them for a read-only member without writing", async () => {
    const requests = [];
    apiFetch.mockImplementation((_path, options) => new Promise((resolve) => requests.push({ resolve, ids: JSON.parse(options.body).matchIds })));
    const renderer = await mount({ reports: [{ id: "old", team_id: "team", match_ids: ["one", "two"], title: "Old", content: "Notes historiques", created_by: "someone-else" }] });
    expect(output(renderer)).toContain("Préparation automatique");
    expect(output(renderer)).not.toContain("Re-coacher");
    expect(requests.flatMap((request) => request.ids)).toEqual(["one", "two"]);
    expect(apiFetch.mock.calls.every(([, options]) => JSON.parse(options.body).teamId === "team")).toBe(true);
    await act(async () => requests.forEach((request) => request.resolve({ matches: request.ids.map(game) })));
    expect(output(renderer)).toContain("LECTURE PAR JOUEUR");
    expect(output(renderer)).toContain("Notes historiques");
    expect(output(renderer)).not.toContain("Préparation automatique");
    expect(apiFetch.mock.calls.every(([path]) => path === "match-details")).toBe(true);
  });
  it("keeps staff typing while details arrive, updates analysis on selection and saves the complete review", async () => {
    const requests = [];
    apiFetch.mockImplementation((_path, options) => new Promise((resolve) => requests.push({ resolve, ids: JSON.parse(options.body).matchIds })));
    const renderer = await mount({ matches: [game("one"), game("two")] });
    act(() => button(renderer, "Créer une review").props.onClick());
    act(() => button(renderer, "Tout lier").props.onClick());
    const notes = "  Conserver ce call\n";
    act(() => renderer.root.findByType("textarea").props.onChange({ target: { value: notes } }));
    expect(button(renderer, "Créer").props.disabled).toBe(true);
    await act(async () => requests.forEach((request) => request.resolve({ matches: request.ids.map(game) })));
    expect(renderer.root.findByType("textarea").props.value).toBe(notes);
    expect(output(renderer)).toContain("GAME 2 · Game two");
    expect(button(renderer, "Créer").props.disabled).toBe(false);
    const gameTwo = renderer.root.findAllByType("button").find((item) => item.findAllByType("p").some((p) => p.children.join("") === "Game two"));
    await act(async () => gameTwo.props.onClick());
    expect(output(renderer)).not.toContain("GAME 2 · Game two");
    expect(renderer.root.findByType("textarea").props.value).toBe(notes);
    apiFetch.mockResolvedValueOnce({ report: { id: "new" } });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: vi.fn() }));
    const saved = JSON.parse(apiFetch.mock.calls.find(([path]) => path === "reports-manage")[1].body);
    expect(saved.matchIds).toEqual(["one"]);
    expect(saved.content).toContain("VERDICT COACH");
    expect(stripGeneratedReportContent(saved.content)).toBe(notes);
  });
  it("allows a linked review without staff notes and keeps generated text out of the editor", async () => {
    apiFetch.mockResolvedValue({ matches: [game("one")] });
    const renderer = await mount({ reports: [{ id: "old", team_id: "team", match_ids: ["one"], content: buildGameReviewContent(game("one")), created_by: "user" }] });
    await act(async () => button(renderer, "Éditer").props.onClick());
    expect(renderer.root.findByType("textarea").props.value).toBe("");
    expect(renderer.root.findByType("textarea").props.required).toBe(false);
    expect(button(renderer, "Enregistrer").props.disabled).toBe(false);
    expect(output(renderer)).toContain("LECTURE PAR JOUEUR");
  });
  it("preserves the saved review and permits retry after a failed automatic load", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Connexion interrompue"));
    const renderer = await mount({ reports: [{ id: "old", team_id: "team", match_ids: ["one"], content: "Bilan et notes conservés" }] });
    expect(output(renderer)).toContain("Connexion interrompue");
    expect(output(renderer)).toContain("Bilan et notes conservés");
    apiFetch.mockResolvedValueOnce({ matches: [game("one")] });
    await act(async () => button(renderer, "Réessayer").props.onClick());
    expect(output(renderer)).toContain("LECTURE PAR JOUEUR");
    expect(output(renderer)).not.toContain("Connexion interrompue");
  });
});
