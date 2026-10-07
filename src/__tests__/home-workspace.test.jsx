import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DATA } from "../app/constants.jsx";
import { BeginnerCompass } from "../components/layout/AppChrome.jsx";
import { getOnboardingSteps } from "../utils/onboarding.js";
import HomeWorkspace from "../pages/workspace/HomeWorkspace.jsx";

const NOW = new Date("2026-10-07T12:00:00Z");
const cleanups = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture({ teamId = "team", manager = true, matches = [], reports = [], players = [], availability = [], botEvents = [], discovered = [], dismissed = false } = {}) {
  const user = { id: "me" };
  const currentTeam = { id: teamId, name: teamId === "team" ? "Équipe actuelle" : "Autre équipe", owner_id: manager ? user.id : "owner" };
  const currentMember = { team_id: teamId, user_id: user.id, role: manager ? "captain" : "player" };
  const data = { ...DEFAULT_DATA, selectedTeamId: teamId, historyComplete: true, teams: [currentTeam], teamMembers: [currentMember], matches, reports, players, availability, botEvents };
  return {
    data, currentTeam, currentMember, user,
    steps: getOnboardingSteps({ data, currentTeam, currentMember, user, discovered }),
    onboarding: { discovered, dismissed, dismiss: vi.fn(), resume: vi.fn() },
    navigate: vi.fn(),
  };
}

const match = (overrides = {}) => ({ id: "match", team_id: "team", game_date: "2026-10-06T18:00:00Z", result: "Victoire", review_status: "todo", raw: { nxt5Label: "Scrim Equinox" }, ...overrides });
const text = (node) => typeof node === "string" ? node : (node?.children || []).map(text).join("");
const button = (renderer, label) => renderer.root.findAllByType("button").find((node) => text(node) === label);
const links = (renderer) => renderer.root.findAllByType("a");
const homeState = (renderer) => renderer.root.findByProps({ className: "nxt5-home" }).props["data-home-state"];

function follow(link) {
  const event = { button: 0, preventDefault: vi.fn() };
  act(() => link.props.onClick(event));
  expect(event.preventDefault).toHaveBeenCalledOnce();
}

async function render(props, options) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<HomeWorkspace {...props} />, options); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}

describe("adaptive team home", () => {
  it("starts an empty team with its role-aware onboarding and a real import action", async () => {
    const props = fixture();
    const renderer = await render(props);
    const compass = renderer.root.findByType(BeginnerCompass);
    expect(compass.props.manager).toBe(true);
    act(() => button(renderer, "Importer une partie").props.onClick());
    expect(props.navigate).toHaveBeenCalledWith("/games?import=1");
  });

  it("gives an unlinked player a useful team destination without offering import", async () => {
    const props = fixture({ manager: false });
    const renderer = await render(props);
    expect(renderer.root.findByType(BeginnerCompass).props.manager).toBe(false);
    expect(button(renderer, "Importer une partie")).toBeUndefined();
    expect(links(renderer).some((link) => link.props.href.includes("import=1"))).toBe(false);
    act(() => button(renderer, "Voir mon équipe").props.onClick());
    expect(props.navigate).toHaveBeenCalledWith("/equipes");
  });

  it("respects the player's permissions after the empty-team guide has been dismissed", async () => {
    const renderer = await render(fixture({ manager: false, dismissed: true }));
    expect(renderer.root.findAllByType(BeginnerCompass)).toHaveLength(0);
    expect(links(renderer).some((link) => link.props.href.includes("import=1"))).toBe(false);
    expect(links(renderer).some((link) => link.props.href === "/equipes")).toBe(true);
  });

  it("keeps recent team activity visible while an unfinished personal guide is opened and closed", async () => {
    const props = fixture({ matches: [match()] });
    const focus = vi.fn();
    const renderer = await render(props, { createNodeMock: (element) => element.type === "button" && element.props["aria-controls"] === "nxt5-home-learning-content" ? { focus } : null });
    expect(renderer.root.findAllByType(BeginnerCompass)).toHaveLength(0);
    expect(text(renderer.toJSON())).toContain("Scrim Equinox");
    const trigger = button(renderer, "Reprendre le démarrage");
    expect(trigger.props["aria-expanded"]).toBe(false);
    act(() => trigger.props.onClick());
    expect(button(renderer, "Masquer le démarrage")).toBe(trigger);
    expect(trigger.props["aria-expanded"]).toBe(true);
    expect(renderer.root.findByProps({ id: trigger.props["aria-controls"] })).toBeDefined();
    expect(renderer.root.findAllByType(BeginnerCompass)).toHaveLength(1);
    expect(text(renderer.toJSON())).toContain("Scrim Equinox");
    act(() => renderer.root.findByType(BeginnerCompass).props.onClose());
    expect(renderer.root.findAllByType(BeginnerCompass)).toHaveLength(0);
    expect(text(renderer.toJSON())).toContain("Scrim Equinox");
    expect(trigger.props["aria-expanded"]).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
  });

  it("opens the review composer for the recent game using its encoded identifier", async () => {
    const props = fixture({ matches: [match({ id: "match / équipe" })] });
    const renderer = await render(props);
    expect(homeState(renderer)).toBe("review");
    const action = links(renderer).find((link) => text(link) === "Préparer le débrief");
    const destination = "/rapports?match=match%20%2F%20%C3%A9quipe&compose=1";
    expect(action.props.href).toBe(destination);
    follow(action);
    expect(props.navigate).toHaveBeenCalledWith(destination);
  });

  it("reopens the saved review when recent games have already been reviewed", async () => {
    const props = fixture({ matches: [match()], reports: [{ id: "report", team_id: "team", title: "Nos points à travailler", match_ids: ["match"], created_at: "2026-10-06T20:00:00Z" }] });
    const renderer = await render(props);
    expect(homeState(renderer)).toBe("active");
    const action = links(renderer).find((link) => text(link) === "Relire le débrief");
    expect(action.props.href).toBe("/rapports?report=report");
    follow(action);
    expect(props.navigate).toHaveBeenCalledWith("/rapports?report=report");
    expect(links(renderer).some((link) => link.props.href.includes("compose=1"))).toBe(false);
  });

  it("marks staff review drafts clearly and keeps them out of a player's home", async () => {
    const snapshot = { matches: [match()], reports: [{ id: "draft", team_id: "team", title: "Brouillon privé du staff", match_ids: ["match"], discord_status: "draft", created_at: "2026-10-06T20:00:00Z" }] };
    const props = fixture(snapshot);
    const renderer = await render(props);
    expect(homeState(renderer)).toBe("active");
    expect(text(renderer.toJSON())).toContain("Brouillon · staff uniquement");
    expect(text(renderer.toJSON())).toContain("Brouillon de débrief");
    expect(text(renderer.toJSON())).not.toContain("Débrief disponible");
    const action = links(renderer).find((link) => text(link) === "Reprendre le débrief");
    expect(action.props.href).toBe("/rapports?report=draft");
    follow(action);
    expect(props.navigate).toHaveBeenCalledWith("/rapports?report=draft");
    await act(async () => renderer.update(<HomeWorkspace {...fixture({ ...snapshot, manager: false })} />));
    expect(homeState(renderer)).toBe("review");
    expect(text(renderer.toJSON())).not.toContain("Brouillon privé du staff");
    expect(text(renderer.toJSON())).not.toContain("Brouillon · staff uniquement");
    expect(links(renderer).some((link) => link.props.href === "/rapports?report=draft")).toBe(false);
  });

  it("counts gameplay profiles including substitutes without counting staff or another team's players", async () => {
    const renderer = await render(fixture({ dismissed: true, players: [
      { id: "mid", team_id: "team", role: "MID" },
      { id: "sub", team_id: "team", role: "SUB" },
      { id: "coach", team_id: "team", role: "COACH" },
      { id: "manager", team_id: "team", role: "MANAGER" },
      { id: "other", team_id: "other", role: "TOP" },
    ] }));
    expect(text(renderer.toJSON())).toContain("2 joueurs dans l’effectif");
    const shortcut = links(renderer).find((link) => link.props.className === "nxt5-home-shortcut" && link.props.href === "/equipes");
    expect(text(shortcut)).toContain("2 joueurs · retrouver l’effectif et le staff");
  });

  it("brings a nearby scheduled session forward and opens the planning", async () => {
    const props = fixture({ matches: [match()], botEvents: [{ id: "event", team_id: "team", title: "Scrim du soir", status: "scheduled", starts_at: "2026-10-07T18:00:00Z", duration_minutes: 120, timezone: "Europe/Paris" }] });
    const renderer = await render(props);
    expect(homeState(renderer)).toBe("session");
    expect(text(renderer.toJSON())).toContain("Scrim du soir");
    const action = links(renderer).find((link) => text(link) === "Ouvrir le planning");
    follow(action);
    expect(props.navigate).toHaveBeenCalledWith("/planning");
  });

  it("keeps a session readable with an absent title and an invalid saved timezone", async () => {
    const renderer = await render(fixture({ matches: [match()], botEvents: [{ id: "event", team_id: "team", title: "", status: "scheduled", starts_at: "2026-10-07T18:00:00Z", duration_minutes: 120, timezone: "Unknown/Invalid" }] }));
    expect(homeState(renderer)).toBe("session");
    expect(text(renderer.toJSON())).toContain("Séance de l’équipe");
    const date = text(renderer.root.findByProps({ className: "nxt5-home-focus-description" }));
    expect(date).toContain("2026");
    expect(date).not.toContain("Date non renseignée");
    expect(date).not.toContain("Invalid");
    expect(links(renderer).find((link) => text(link) === "Ouvrir le planning").props.href).toBe("/planning");
  });

  it("offers a fresh start for old played games even when they were just imported", async () => {
    const renderer = await render(fixture({ matches: [match({ game_date: "2026-09-01T18:00:00Z", created_at: NOW.toISOString() })] }));
    expect(homeState(renderer)).toBe("quiet");
    expect(text(renderer.toJSON())).toContain("Aucune partie récente");
    expect(links(renderer).find((link) => text(link) === "Importer une partie").props.href).toBe("/games?import=1");
    expect(links(renderer).some((link) => link.props.href === "/games?match=match")).toBe(true);
  });

  it("updates time-sensitive priorities while the home remains open", async () => {
    const props = fixture({ matches: [match()], botEvents: [{ id: "event", team_id: "team", title: "Prochaine séance", status: "scheduled", starts_at: new Date(NOW.getTime() + 48 * 60 * 60 * 1000 + 30_000).toISOString(), duration_minutes: 60 }] });
    const renderer = await render(props);
    expect(homeState(renderer)).toBe("review");
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(homeState(renderer)).toBe("session");
  });

  it("identifies refreshing or stale data while retaining the last loaded team activity", async () => {
    const props = fixture({ matches: [match()] });
    const renderer = await render({ ...props, loading: true });
    expect(text(renderer.root.findByProps({ role: "status" }))).toBe("Actualisation de l’équipe…");
    expect(text(renderer.toJSON())).toContain("Scrim Equinox");
    await act(async () => renderer.update(<HomeWorkspace {...props} apiError="Réseau indisponible" />));
    expect(text(renderer.root.findByProps({ role: "status" }))).toContain("dernières données chargées");
    expect(text(renderer.toJSON())).toContain("Scrim Equinox");
    expect(homeState(renderer)).toBe("review");
  });

  it("replaces activity and resets the open guide when the selected team changes", async () => {
    const renderer = await render(fixture({ matches: [match()] }));
    act(() => button(renderer, "Reprendre le démarrage").props.onClick());
    expect(renderer.root.findAllByType(BeginnerCompass)).toHaveLength(1);
    const other = match({ id: "other-match", team_id: "other", raw: { nxt5Label: "Scrim Solaris" } });
    await act(async () => renderer.update(<HomeWorkspace {...fixture({ teamId: "other", matches: [match(), other] })} />));
    expect(renderer.root.findAllByType(BeginnerCompass)).toHaveLength(0);
    expect(text(renderer.toJSON())).toContain("Scrim Solaris");
    expect(text(renderer.toJSON())).not.toContain("Scrim Equinox");
    expect(links(renderer).some((link) => /[?&]match=match(?:&|$)/.test(link.props.href))).toBe(false);
  });
});
