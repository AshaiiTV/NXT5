import React from "react";
import "./helpers/i18n.js";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "../i18n/locale.js";
import { messages, t } from "../i18n/translate.js";
import { analysisCopy } from "../components/trends/analysis-copy.js";
import { DEFAULT_DATA } from "../app/constants.jsx";
import HomeWorkspace from "../pages/workspace/HomeWorkspace.jsx";
import { PlayerUltimateProfile } from "../pages/workspace/PlayerUltimateProfile.jsx";
import { MatchDataPanel, GameMetricSignals, GameSummaryPanel } from "../pages/workspace/GameWorkspace.jsx";
import { DraftTrendsModule, buildDraftTrendModel } from "../components/trends/DraftTrends.jsx";
import { DraftTrendDetails } from "../components/trends/DraftTrendDetails.jsx";
import { ProgressionObjectives } from "../components/trends/ProgressionObjectives.jsx";
import { TrendEvolution } from "../components/trends/TrendEvolution.jsx";
import { BlockComparisonPanel } from "../NextPhase.jsx";
import { resultLabel } from "../utils/statistics.js";

afterEach(() => { setLanguage("fr"); vi.unstubAllGlobals(); });

const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const champions = ["Ornn", "Sejuani", "Ahri", "Jinx", "Lulu"];
function fixture() {
  const user = { id: "me" };
  const currentTeam = { id: "team", name: "Accueil", owner_id: user.id };
  const currentMember = { team_id: "team", user_id: user.id, role: "captain" };
  const players = roles.map((role, index) => ({ id: `p${index}`, team_id: "team", role, name: index === 2 ? "Victoire" : `Player ${index}`, ...(index === 2 ? { user_id: user.id } : {}) }));
  const matches = Array.from({ length: 3 }, (_, index) => ({
    id: `match-${index}`, team_id: "team", game_id: `EUW1_${index}`, game_date: `2026-10-0${index + 4}T18:00:00Z`, result: "Victoire", duration: "24:30", patch: "16.19", side: "blue", review_status: "todo", raw: { nxt5Label: "Session personnelle" },
    participants: ["ALLY", "ENEMY"].flatMap((teamKey, side) => roles.map((role, i) => ({ id: `${teamKey}-${i}`, player_id: side ? null : players[i].id, team_key: teamKey, role, champion: champions[i], summoner_name: side ? `Opponent ${i}` : players[i].name, kills: 3, deaths: 2, assists: 7, damage: 12000, vision: 20, gold: 10000, kill_participation: 60, raw: { participantId: side * 5 + i + 1, teamId: side ? 200 : 100 } }))),
  }));
  return { user, currentTeam, currentMember, matches, data: { ...DEFAULT_DATA, selectedTeamId: "team", historyComplete: true, teams: [currentTeam], teamMembers: [currentMember], players, matches } };
}

const text = html => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("translated workspace rendering", () => {
  it.each(["en", "es"])("renders populated views in %s while preserving user names and match titles", language => {
    setLanguage(language);
    vi.stubGlobal("window", { location: new URL("https://nxt5.test/mon-profil?player=p2") });
    const props = fixture();
    const model = buildDraftTrendModel(props.matches);
    const outputs = {
      home: renderToStaticMarkup(<HomeWorkspace {...props} onboarding={{ dismissed: true }} now="2026-10-07T12:00:00Z" />),
      profile: renderToStaticMarkup(<PlayerUltimateProfile {...props} selectedTeamId="team" route={{ path: "/mon-profil", search: "?player=p2" }} />),
      match: renderToStaticMarkup(<MatchDataPanel match={props.matches[0]} teamName={props.currentTeam.name} />),
      signals: renderToStaticMarkup(<GameMetricSignals match={props.matches[0]} />),
      summary: renderToStaticMarkup(<GameSummaryPanel match={props.matches[0]} />),
      draft: renderToStaticMarkup(<DraftTrendsModule model={model} />),
      details: renderToStaticMarkup(<DraftTrendDetails sectionId="roles" model={model} />),
      objectives: renderToStaticMarkup(<ProgressionObjectives teamObjective={{ title: "Vision", why: "À vérifier", target: "Vision diff positive sur le prochain bloc", current: "-5", sourceGames: [] }} roleObjectives={[]} gamesCount={3} />),
      evolution: renderToStaticMarkup(<TrendEvolution matches={props.matches} />),
      comparison: renderToStaticMarkup(<BlockComparisonPanel matches={props.matches} />),
    };
    expect(outputs.home).toContain("Session personnelle");
    expect(outputs.profile).toContain("Victoire");
    expect(outputs.match).toContain("Session personnelle");
    expect(outputs.profile).toContain(t("Les résultats en un regard"));
    expect(outputs.objectives).toContain(t("Objectifs de la prochaine session"));
    expect(text(outputs.details)).toContain(t("champions"));
    expect(text(outputs.home)).toContain(language === "en" ? "3 recent matches" : "3 partidas recientes");
    expect(text(outputs.signals)).toContain(language === "en" ? "2 deaths · Ornn" : "2 muertes · Ornn");
    expect(resultLabel({ wins: 3, losses: 1, unknown: 2 })).toBe(language === "en" ? "3 wins · 1 loss · 2 results unavailable" : "3 victorias · 1 derrota · 2 resultados no disponibles");
    for (const html of Object.values(outputs)) {
      expect(html).not.toMatch(/matchs\b|campeóns\b|jugadors\b/);
      expect(html).not.toContain("{0}");
      const rawProductLabels = html.split(/<[^>]*>/g).map(value => value.trim()).filter(value => !["Accueil", "Victoire", ...champions].includes(value) && messages[language][value] && messages[language][value] !== value);
      expect(rawProductLabels).toEqual([]);
    }
    if (process.env.NXT5_TRANSLATION_AUDIT) for (const [page, html] of Object.entries(outputs)) {
      const fragments = html.split(/<[^>]*>/g).map(value => value.trim()).filter(value => !["Accueil", "Victoire"].includes(value) && ((messages[language][value] && messages[language][value] !== value) || /\b(?:renseigné|renseignées|aucun|aucune|sélection|parties|joueurs|équipe|victoires|connus|écart|morts)\b/i.test(value)));
      console.log(language, page, JSON.stringify([...new Set(fragments)].map(source => ({ source, translated: t(source), missingTranslation: t(source) === source }))));
    }
  });

  it.each(["en", "es"])("translates generated observations in %s without losing their factual cautions", language => {
    setLanguage(language);
    const source = "Les deaths montent trop haut pour transformer les bons plans en games contrôlées.";
    const cautious = "Le nombre de morts est élevé dans cette sélection. Ouvre les parties sources pour vérifier les situations à mieux préparer.";
    expect(analysisCopy(source)).toBe(t(cautious));
    expect(analysisCopy("Réduire les morts gratuites")).toBe(t("Revoir les situations de mort"));
    expect(analysisCopy("Vision diff positive sur le prochain bloc")).toBe(t("Vision diff positive sur le prochain bloc"));
    expect(source).toBe("Les deaths montent trop haut pour transformer les bons plans en games contrôlées.");
  });
});
