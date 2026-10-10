import React from "react";
import "./helpers/i18n.js";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "../i18n/locale.js";
import { t } from "../i18n/translate.js";
import { ImportedGames } from "../components/games/ImportedGames.jsx";
import { SocialNotice } from "../components/account/SocialAccounts.jsx";
import { AppErrorBoundary } from "../components/ui/AppErrorBoundary.jsx";
import { PageHeader } from "../components/ui/Core.jsx";
import AppLoadingScreen from "../components/loading/AppLoadingScreen.jsx";
import AssistantPanel from "../components/assistant/AssistantPanel.jsx";
import { apiFetch } from "../api/client.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
let renderer;
const content = (node) => node == null ? "" : typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(content).join("") : content(node.children);

beforeEach(() => {
  setLanguage("fr");
  vi.stubGlobal("window", {
    addEventListener: vi.fn(), removeEventListener: vi.fn(), setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false }),
    location: { search: "?provider=discord", reload: vi.fn(), assign: vi.fn() },
  });
  vi.stubGlobal("document", { activeElement: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), documentElement: { classList: { contains: () => false } } });
  apiFetch.mockReset().mockResolvedValue({ answer: "Answer kept exactly as returned.", actions: [], suggestions: [] });
});

afterEach(() => {
  act(() => { renderer?.unmount(); });
  renderer = null;
  setLanguage("fr");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("language changes in interactive components", () => {
  it("keeps team names intact in page headings, timeline events and lane comparisons", async () => {
    const { TimelineEventCard, LaneComparisonPanel, timelineTeamLabel } = await import("../pages/workspace/GameWorkspace.jsx");
    const match = { side: "blue", participants: [] };
    const event = { kind: "fight", teamKey: "ALLY", timestamp: 60000, time: "1:00", title: "Fight échangé" };
    await act(async () => { renderer = TestRenderer.create(<>
      <PageHeader eyebrow="Paramètres" title="Titre utilisateur" />
      <TimelineEventCard event={event} index={0} kills={[]} match={match} teamName="Paramètres" />
      <LaneComparisonPanel match={match} role="MID" teamName="Paramètres" />
    </>); });
    for (const language of ["en", "es"]) {
      await act(async () => setLanguage(language));
      expect(t("Paramètres")).not.toBe("Paramètres");
      expect(content(renderer.root.findByProps({ className: "nxt5-page-eyebrow" }))).toBe("Paramètres");
      expect(content(renderer.root.findByType(TimelineEventCard))).toContain("Paramètres");
      expect(renderer.root.findByType(LaneComparisonPanel).findByProps({ title: "Paramètres" }).children).toEqual(["Paramètres"]);
      expect(timelineTeamLabel("ALLY", "Paramètres")).toBe("Paramètres");
      expect(timelineTeamLabel("ENEMY")).toBe(t("Adversaire"));
      expect(timelineTeamLabel("ALLY")).toBe(t("Notre équipe"));
    }
  });

  it("updates game counts and dates while preserving names and the stored result filter", async () => {
    const matches = [
      { id: "one", result: "Victoire", game_date: "2026-09-23T18:00:00Z", raw: { nxt5Label: "Paramètres" }, category_ids: ["category"], participants: [] },
      { id: "two", result: "Défaite", game_date: "2026-09-24T18:00:00Z", raw: { nxt5Label: "Connexion" }, category_ids: ["category"], participants: [] },
    ];
    const onSelect = vi.fn();
    await act(async () => { renderer = TestRenderer.create(<ImportedGames matches={matches} categories={[{ id: "category", name: "Déconnexion" }]} showCategoryFilter onSelectMatch={onSelect} dateTimeZone="UTC" />); });
    const resultSelect = () => renderer.root.findAllByType("select").find(node => node.findAllByProps({ value: "Victoire" }).length);
    await act(async () => resultSelect().props.onChange({ target: { value: "Victoire" } }));
    for (const [language, count] of [["en", "1 game out of 2"], ["es", "1 partida de 2"]]) {
      await act(async () => setLanguage(language));
      expect(content(renderer.toJSON())).toContain(count);
      expect(resultSelect().props.value).toBe("Victoire");
      const game = renderer.root.findByProps({ "data-match-id": "one" });
      expect(content(game)).toContain("Paramètres");
      expect(content(game)).toContain("Déconnexion");
      expect(game.props["aria-label"]).toContain("Paramètres");
      expect(game.props["aria-label"]).not.toContain("Sélectionner");
      expect(renderer.root.findByType("time").children.join("")).toBe(new Intl.DateTimeFormat(language === "en" ? "en-GB" : "es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(matches[0].game_date)));
      await act(async () => game.props.onClick());
    }
    expect(onSelect.mock.calls).toEqual([["one"], ["one"]]);
    expect(matches[0].result).toBe("Victoire");
  });

  it("updates memoised assistant prompts and sends the selected language without translating a user draft", async () => {
    await act(async () => { renderer = TestRenderer.create(<AssistantPanel open route={{ path: "/equipes" }} onClose={vi.fn()} />); });
    await act(async () => setLanguage("en"));
    const question = t("Comment ajouter un joueur ?");
    expect(question).not.toBe("Comment ajouter un joueur ?");
    const button = renderer.root.findAllByType("button").find(node => content(node) === question);
    await act(async () => button.props.onClick());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ language: "en", message: question });
    await act(async () => renderer.root.findByType("textarea").props.onChange({ target: { value: "Paramètres" } }));
    await act(async () => setLanguage("es"));
    expect(renderer.root.findByType("textarea").props.value).toBe("Paramètres");
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(JSON.parse(apiFetch.mock.calls.at(-1)[1].body)).toMatchObject({ language: "es", message: "Paramètres" });
    expect(content(renderer.toJSON())).toContain("Answer kept exactly as returned.");
  });

  it("updates a class error boundary even after its child tree has failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken() { throw new Error("private details"); }
    await act(async () => { renderer = TestRenderer.create(<AppErrorBoundary><Broken /></AppErrorBoundary>); });
    for (const language of ["en", "es"]) {
      await act(async () => setLanguage(language));
      const heading = renderer.root.findByType("h1").children.join("");
      expect(heading).toBe(t("NXT5 n’a pas pu afficher cette page."));
      expect(heading).not.toBe("NXT5 n’a pas pu afficher cette page.");
      expect(content(renderer.toJSON())).not.toContain("private details");
    }
  });

  it("translates dynamic loading statuses and punctuated text", async () => {
    await act(async () => { renderer = TestRenderer.create(<AppLoadingScreen phase="bootstrap" />); });
    const original = content(renderer.root.findByProps({ role: "status" }));
    for (const language of ["en", "es"]) {
      await act(async () => setLanguage(language));
      expect(content(renderer.root.findByProps({ role: "status" }))).not.toBe(original);
    }
    expect(content(renderer.root.findByType("h1"))).toContain("dirección.");
  });

  it("translates provider feedback with its brand name intact", async () => {
    await act(async () => { renderer = TestRenderer.create(<SocialNotice status="linked" />); });
    for (const language of ["en", "es"]) {
      await act(async () => setLanguage(language));
      expect(content(renderer.toJSON())).toContain("Discord");
      expect(content(renderer.toJSON())).not.toContain("Ton compte");
    }
  });
});
