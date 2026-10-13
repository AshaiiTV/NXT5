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

function fixture({ teamId = "team", userId = "me", manager = true, matches = [], reports = [], matchArchives = [], players = [], availability = [], botEvents = [], discovered = [], dismissed = false } = {}) {
  const user = { id: userId };
  const currentTeam = { id: teamId, name: teamId === "team" ? "Équipe actuelle" : "Autre équipe", owner_id: manager ? user.id : "owner" };
  const currentMember = { team_id: teamId, user_id: user.id, role: manager ? "captain" : "player" };
  const data = { ...DEFAULT_DATA, selectedTeamId: teamId, historyComplete: true, teams: [currentTeam], teamMembers: [currentMember], matches, reports, matchArchives, players, availability, botEvents };
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
const personalDebrief = (renderer) => renderer.root.findByProps({ "aria-labelledby": "nxt5-home-player-debrief-title" });

function personalFixture({ teamId = "team", ...options } = {}) {
  const player = { id: `${teamId}-mid`, team_id: teamId, user_id: "me", name: "Lumen", riot_id: "Lumen#EUW", role: "MID" };
  const teammate = { id: `${teamId}-top`, team_id: teamId, user_id: "teammate-user", name: "Orion", role: "TOP" };
  const gameId = `${teamId}-match`;
  return fixture({
    teamId, manager: false,
    players: [player, teammate],
    matches: [match({ id: gameId, team_id: teamId, participants: [
      { player_id: player.id, team_key: "ALLY", role: "MID", summoner_name: player.name, riot_id: player.riot_id },
      { player_id: teammate.id, team_key: "ALLY", role: "TOP", summoner_name: teammate.name },
      { team_key: "ENEMY", role: "MID", summoner_name: "Rival" },
    ] })],
    matchArchives: [{ id: `${teamId}-group`, team_id: teamId, name: "Alterna Scrim", match_ids: [gameId], created_at: "2026-10-06T19:00:00Z" }],
    reports: [{ id: `${teamId}-report`, team_id: teamId, title: "Alterna Scrim", match_ids: [gameId], created_at: "2026-10-06T20:00:00Z", content: `## GAME 1 · Scrim
LECTURE PAR JOUEUR
### MID · Lumen
- Catch : Revois ton déplacement à 14:20.
- Lane : Conserve la priorité.
### TOP · Orion
- Observation réservée à Orion.
### MID · Rival
- Observation réservée à l’adversaire.
PLAN D’EXÉCUTION
- Consigne collective.
[NXT5_REPORT_V3]
Notes staff
### Lumen
- Annonce ton reset avant le dragon.
### Orion
- Note personnelle d’Orion.` }],
    ...options,
  });
}

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
  it.each(["totals", "pagination"])("uses the server's historical total from %s when only the latest page is loaded", async (source) => {
    const props = fixture({ matches: [match()] });
    props.data.historyComplete = false;
    props.data[source] = source === "totals" ? { games: 1000 } : { total: 1000, hasMore: true };
    const renderer = await render(props);
    const shortcut = links(renderer).find((link) => link.props.className === "nxt5-home-shortcut" && link.props.href === "/games");
    expect(text(shortcut)).toContain("1000 parties dans votre historique");
    expect(text(renderer.toJSON())).not.toContain("sur les 14 derniers jours");
    expect(text(renderer.toJSON())).not.toContain("1 partie récente sans débrief enregistré.");
    expect(text(renderer.toJSON())).toContain("Scrim Equinox");
  });

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
    expect(props.navigate).toHaveBeenCalledWith("/mon-equipe");
  });

  it("respects the player's permissions after the empty-team guide has been dismissed", async () => {
    const renderer = await render(fixture({ manager: false, dismissed: true }));
    expect(renderer.root.findAllByType(BeginnerCompass)).toHaveLength(0);
    expect(links(renderer).some((link) => link.props.href.includes("import=1"))).toBe(false);
    expect(links(renderer).some((link) => link.props.href === "/mon-equipe")).toBe(true);
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
    const shortcut = links(renderer).find((link) => link.props.className === "nxt5-home-shortcut" && link.props.href === "/mon-equipe");
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

  it("does not infer inactivity from old games on a partial page ordered by import date", async () => {
    const props = fixture({ matches: [match({ game_date: "2026-09-01T18:00:00Z", created_at: NOW.toISOString() })] });
    props.data.historyComplete = false;
    const renderer = await render(props);
    expect(homeState(renderer)).toBe("active");
    expect(text(renderer.toJSON())).not.toContain("Aucune partie récente");
    expect(text(renderer.toJSON())).not.toContain("Revoir la dernière partie");
    expect(text(renderer.root.findByProps({ id: "nxt5-home-games-title" }))).toBe("Parties");
    expect(links(renderer).find((link) => text(link) === "Voir la partie").props.href).toBe("/games?match=match");
    await act(async () => renderer.update(<HomeWorkspace {...props} data={{ ...props.data, historyComplete: true }} />));
    expect(homeState(renderer)).toBe("quiet");
    expect(text(renderer.toJSON())).toContain("Aucune partie récente dans l’espace de l’équipe sur les 14 derniers jours.");
  });

  it("does not present a loaded recent game's review as the team's latest review before history is complete", async () => {
    const props = fixture({ matches: [match()], reports: [{ id: "report", team_id: "team", title: "Débrief enregistré", match_ids: ["match"] }] });
    props.data.historyComplete = false;
    const renderer = await render(props);
    expect(text(renderer.toJSON())).not.toContain("Reprends le dernier débrief de ton équipe.");
    expect(text(renderer.toJSON())).not.toContain("Retrouve le débrief de votre dernière partie");
    expect(text(renderer.toJSON())).toContain("Ton espace équipe");
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

describe("personal home debrief", () => {
  it.each([[false, 2], [true, 2], [false, 101]])("withholds personal attribution when a group game is outside the loaded page (serialized: %s, games: %s)", async (serialized, count) => {
    const props = personalFixture();
    props.data.historyComplete = false;
    const originalGame = props.data.matches[0];
    const groupIds = [originalGame.id, ...Array.from({ length: count - 1 }, (_, index) => `older-group-game-${index}`)];
    const groupGames = groupIds.map(id => ({ ...originalGame, id }));
    props.data.matches = groupGames.slice(0, -1);
    props.data.matchArchives[0].match_ids = serialized ? JSON.stringify(groupIds) : groupIds;
    props.data.reports[0].match_ids = groupIds;
    const renderer = await render(props);
    let panel = personalDebrief(renderer);
    expect(text(panel)).toContain("Historique complet à charger");
    expect(text(panel)).not.toContain("Annonce ton reset avant le dragon.");
    expect(text(panel)).not.toContain("Ce débrief ne contient pas encore de passage attribuable à ton profil.");
    expect(panel.findAllByType("details")).toHaveLength(0);
    expect(panel.findByType("a").props.href).toBe("/rapports?report=team-report");
    // The rest of the team history may remain partial once this group is whole.
    await act(async () => renderer.update(<HomeWorkspace {...props} data={{ ...props.data, matches: groupGames }} />));
    panel = personalDebrief(renderer);
    expect(text(panel)).toContain("Annonce ton reset avant le dragon.");
    expect(text(panel)).not.toContain("Historique complet à charger");
  });

  it("shows only the linked player's saved observations and notes, with their source and group", async () => {
    const props = personalFixture();
    const renderer = await render(props);
    const panel = personalDebrief(renderer);
    expect(text(panel)).toContain("Pour Lumen");
    expect(text(panel)).toContain("Alterna Scrim");
    expect(text(panel)).toContain("Revois ton déplacement à 14:20.");
    expect(text(panel)).toContain("Conserve la priorité.");
    expect(text(panel)).toContain("Annonce ton reset avant le dragon.");
    expect(text(panel)).not.toContain("Observation réservée à Orion");
    expect(text(panel)).not.toContain("Note personnelle d’Orion");
    expect(text(panel)).not.toContain("Observation réservée à l’adversaire");
    expect(text(panel)).not.toContain("Consigne collective");
    const details = panel.findAllByType("details");
    expect(details).toHaveLength(2);
    expect(text(details[0].findByType("summary"))).toContain("Notes de l’équipe");
    expect(details.map(detail => Boolean(detail.props.open))).toEqual([false, false]);
    const action = panel.findByType("a");
    expect(action.props.href).toBe("/rapports?report=team-report");
    follow(action);
    expect(props.navigate).toHaveBeenCalledWith("/rapports?report=team-report");
  });

  it("removes the preparation panel for a coach who also has a gameplay profile", async () => {
    const props = personalFixture();
    props.currentMember = { ...props.currentMember, role: "coach" };
    const renderer = await render(props);
    expect(renderer.root.findAllByProps({ "aria-labelledby": "nxt5-home-player-debrief-title" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "aria-labelledby": "nxt5-home-next-title" })).toHaveLength(0);
    expect(renderer.root.findByProps({ className: "nxt5-home-overview nxt5-home-overview--wide" })
      .findByProps({ "aria-labelledby": "nxt5-home-games-title" })).toBeDefined();
    expect(text(renderer.toJSON())).not.toContain("Annonce ton reset avant le dragon.");
  });

  it("recognizes a linked coach profile even before membership has loaded", async () => {
    const props = personalFixture({ players: [{ id: "coach", team_id: "team", user_id: "me", name: "Coach", role: "COACH" }] });
    props.currentMember = null;
    const renderer = await render(props);
    expect(renderer.root.findAllByProps({ "aria-labelledby": "nxt5-home-player-debrief-title" })).toHaveLength(0);
    expect(renderer.root.findByProps({ className: "nxt5-home-overview nxt5-home-overview--wide" })).toBeDefined();
  });

  it("keeps a captain's personal notes when their account is linked to a player", async () => {
    const renderer = await render(personalFixture({ manager: true }));
    expect(text(personalDebrief(renderer))).toContain("Annonce ton reset avant le dragon.");
  });

  it("asks an unlinked player to link their profile instead of showing another player's notes", async () => {
    const renderer = await render(personalFixture({ userId: "unlinked" }));
    const panel = personalDebrief(renderer);
    expect(text(panel)).toContain("relier ton compte à ton profil joueur");
    expect(text(panel)).not.toContain("Lumen");
    expect(panel.findAllByType("details")).toHaveLength(0);
    expect(panel.findByType("a").props.href).toBe("/mon-equipe");
  });

  it("keeps an unpublished staff draft out of a linked player's personal panel", async () => {
    const props = personalFixture();
    props.data.reports[0] = { ...props.data.reports[0], discord_status: "draft" };
    const renderer = await render(props);
    const panel = personalDebrief(renderer);
    expect(text(panel)).toContain("Le débrief de ce groupe n’est pas encore disponible.");
    expect(text(panel)).not.toContain("Annonce ton reset avant le dragon.");
    expect(panel.findAllByType("details")).toHaveLength(0);
    expect(panel.findAllByType("a")).toHaveLength(0);
  });

  it.each([
    [{ matchArchives: [] }, "Aucun groupe de parties n’est encore disponible."],
    [{ reports: [] }, "Le débrief de ce groupe n’est pas encore disponible."],
    [{ emptyReport: true }, "Ce débrief ne contient pas encore de passage attribuable à ton profil."],
  ])("explains unavailable personal content without inventing observations", async (options, message) => {
    const props = personalFixture(options);
    if (options.emptyReport) props.data.reports[0] = { ...props.data.reports[0], content: "Consigne collective." };
    const renderer = await render(props);
    const panel = personalDebrief(renderer);
    expect(text(panel)).toContain(message);
    expect(panel.findAllByType("details")).toHaveLength(0);
    expect(text(panel)).not.toContain("Consigne collective");
  });

  it("replaces personal observations when the account changes, then isolates them to the selected team", async () => {
    const props = personalFixture();
    const renderer = await render(props);
    expect(text(personalDebrief(renderer))).toContain("Annonce ton reset avant le dragon.");
    const nextAccount = { ...props, user: { id: "teammate-user" }, currentMember: { ...props.currentMember, user_id: "teammate-user" } };
    await act(async () => renderer.update(<HomeWorkspace {...nextAccount} />));
    expect(text(personalDebrief(renderer))).toContain("Pour Orion");
    expect(text(personalDebrief(renderer))).toContain("Note personnelle d’Orion");
    expect(text(personalDebrief(renderer))).not.toContain("Annonce ton reset avant le dragon.");
    const nextTeam = fixture({ teamId: "other", manager: false, userId: "teammate-user", players: props.data.players,
      reports: props.data.reports, matchArchives: props.data.matchArchives, matches: props.data.matches });
    await act(async () => renderer.update(<HomeWorkspace {...nextTeam} />));
    expect(text(personalDebrief(renderer))).toContain("relier ton compte à ton profil joueur");
    expect(text(personalDebrief(renderer))).not.toContain("Alterna Scrim");
    expect(text(personalDebrief(renderer))).not.toContain("Note personnelle d’Orion");
  });
});
