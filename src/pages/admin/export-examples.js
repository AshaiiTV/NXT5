// The catalogue only uses local, synthetic examples. Renderers and the CSV
// serializer are shared with the actual exports so this page follows changes
// to the product's templates without maintaining separate mock layouts.
export const EXPORT_TEMPLATES = Object.freeze([
  {
    id: "game", title: "Statistiques d’une game", source: "Games · Statistiques", format: "PNG",
    description: "Le bilan complet d’une game : les deux équipes, les dix joueurs et les objectifs.",
    uses: ["Résultat, durée, côté et patch", "Statistiques et équipement des dix joueurs", "Objectifs et écarts entre les équipes", "Bilan détaillé téléchargé depuis Games"],
  },
  {
    id: "discord-game", title: "Synthèse Discord", source: "Bot Discord · Publication d’une game", format: "PNG",
    description: "L’essentiel d’une game pour le salon Discord : résultat, écarts collectifs et cinq joueurs de l’équipe.",
    uses: ["Résultat, adversaire et durée", "Kills et écart d’or final", "Tours, dragons et Nashors", "K/D/A, dégâts et participation des cinq joueurs"],
  },
  {
    id: "group", title: "Groupe de games", source: "Games · Groupe de games", format: "PNG",
    description: "La synthèse d’une sélection de games, réunie dans une seule image.",
    uses: ["Victoires et moyennes de la sélection", "Comparaison équipe et adversaires", "Liste complète des games", "Champions joués et nombre de picks"],
  },
  {
    id: "trends", title: "Tendances d’équipe", source: "Tendances · Exporter la synthèse", format: "PNG",
    description: "Les résultats et les repères collectifs de la catégorie et de la période choisies.",
    uses: ["Taux de victoire et écarts d’or", "Résultats par côté", "Moyennes par rôle", "Champions les plus joués"],
  },
  {
    id: "profile", title: "Profil joueur", source: "Profils · Exporter le résumé", format: "PNG",
    description: "Les statistiques d’un joueur sur les games reliées à son profil.",
    uses: ["Games analysées, victoires et KDA", "Moyennes par game et couverture des données", "CS à 10 et 20 minutes", "Résultats par champion"],
  },
  {
    id: "pool", title: "Pool de champions déclaré", source: "Profils · Pool déclaré / Champion Pool", format: "PNG",
    description: "Les champions déclarés par le joueur ou le staff, regroupés par niveau de préparation.",
    uses: ["Picks de confiance", "Picks situationnels", "Picks en validation et en entraînement", "Games et taux de victoire disponibles"],
  },
  {
    id: "audience", title: "Fréquentation du site", source: "Administration · Fréquentation", format: "CSV",
    description: "Le fichier de données du tableau de bord d’audience, prêt à ouvrir dans un tableur.",
    uses: ["Période, comparaison et filtres", "Pages, acquisition et campagnes UTM", "Appareils, navigateurs, pays et objectifs", "Évolution quotidienne, activité horaire et temps réel"],
  },
]);

const ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const TEAM = { id: "export-demo-team", name: "Équipe Démo · données fictives" };
const CATEGORY = { id: "export-demo-scrims", name: "Scrims · exemple fictif", team_id: TEAM.id };
const PLAYER = { id: "export-demo-player-MID", name: "Demo Mid · profil fictif", role: "MID", riot_id: "DemoMid#DEMO" };
const MATCH_SETTINGS = [
  { date: "2026-09-14T18:00:00Z", side: "Blue", win: true, seconds: 1848, allies: ["Ornn", "JarvanIV", "Orianna", "Jinx", "Rakan"], enemies: ["Gnar", "Vi", "Viktor", "Ashe", "Leona"] },
  { date: "2026-09-16T18:00:00Z", side: "Red", win: false, seconds: 2036, allies: ["Renekton", "Sejuani", "Ahri", "Xayah", "Nautilus"], enemies: ["Kennen", "Wukong", "Taliyah", "Ezreal", "Alistar"] },
  { date: "2026-09-18T18:00:00Z", side: "Red", win: true, seconds: 1764, allies: ["Ornn", "JarvanIV", "Ahri", "Jinx", "Rakan"], enemies: ["Gnar", "Vi", "Viktor", "Ashe", "Leona"] },
  { date: "2026-09-20T18:00:00Z", side: "Blue", win: true, seconds: 1982, allies: ["Renekton", "Sejuani", "Syndra", "Xayah", "Nautilus"], enemies: ["Kennen", "Wukong", "Taliyah", "Ezreal", "Alistar"] },
];

function demoMatch(settings, index) {
  const id = `export-demo-game-${index + 1}`;
  const allyTeamId = settings.side === "Blue" ? 100 : 200;
  const winningKills = [3, 4, 6, 8, 1];
  const losingKills = [3, 2, 4, 2, 1];
  const winningDeaths = [2, 3, 1, 2, 4];
  const losingDeaths = [4, 4, 5, 5, 4];
  const participants = ["ALLY", "ENEMY"].flatMap((teamKey, sideIndex) => {
    const won = sideIndex === 0 ? settings.win : !settings.win;
    return ROLES.map((role, roleIndex) => {
      const participantId = sideIndex * 5 + roleIndex + 1;
      const cs = [232, 184, 251, 268, 38][roleIndex] + index * 4 + (won ? 8 : 0);
      const gold = [12600, 11100, 14300, 15800, 8500][roleIndex] + index * 180 + (won ? 950 : 0);
      const damage = [17900, 15100, 28400, 31900, 7100][roleIndex] + index * 420 + (won ? 1200 : 0);
      const vision = [27, 39, 25, 21, 81][roleIndex] + index * 2;
      const towerDamage = [5400, 1300, 4600, 6900, 650][roleIndex] + (won ? 850 : 0);
      const name = `${sideIndex ? "Rival" : "Demo"} ${role}`;
      const items = [
        [3047, 3068, 3075, 3083, 0, 0], [3111, 3071, 3053, 0, 0, 0],
        [3020, 6655, 3089, 3157, 0, 0], [3006, 3031, 3085, 3036, 0, 0], [3117, 3190, 3109, 0, 0, 0],
      ][roleIndex];
      return {
        id: `${id}-participant-${participantId}`, match_id: id, player_id: sideIndex ? null : `export-demo-player-${role}`,
        team_key: teamKey, role, champion: (sideIndex ? settings.enemies : settings.allies)[roleIndex],
        player_name: name, summoner_name: name, riot_id: `${name.replace(/ /g, "")}#DEMO`,
        kills: (won ? winningKills : losingKills)[roleIndex], deaths: (won ? winningDeaths : losingDeaths)[roleIndex], assists: 0,
        gold, damage, vision, cs, cs_per_min: cs / (settings.seconds / 60), damage_to_turrets: towerDamage,
        raw: {
          participantId, teamId: sideIndex ? 300 - allyTeamId : allyTeamId,
          teamPosition: ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][roleIndex],
          totalMinionsKilled: roleIndex === 1 ? 32 : cs, neutralMinionsKilled: roleIndex === 1 ? cs - 32 : 0,
          goldEarned: gold, totalDamageDealtToChampions: damage, visionScore: vision, damageDealtToTurrets: towerDamage,
          ...Object.fromEntries(items.map((item, slot) => [`item${slot}`, item])), item6: roleIndex === 4 ? 3364 : 3340,
          summoner1Id: 4, summoner2Id: roleIndex === 1 ? 11 : roleIndex === 0 ? 12 : roleIndex === 4 ? 14 : 7,
          timePlayed: settings.seconds,
        },
      };
    });
  });

  // Derive assists and participation from these synthetic events. Kills and
  // opposing deaths have matching totals, including the losing example.
  const eventsByTeam = ["ALLY", "ENEMY"].map((teamKey) => {
    const own = participants.filter((row) => row.team_key === teamKey);
    const enemies = participants.filter((row) => row.team_key !== teamKey);
    const killers = own.flatMap((row) => Array.from({ length: row.kills }, () => row));
    const victims = enemies.flatMap((row) => Array.from({ length: row.deaths }, () => row));
    return killers.map((killer, eventIndex) => {
      const assistants = own.filter((row) => row !== killer).filter((_, assistIndex) => (assistIndex + eventIndex) % 3 !== 0);
      assistants.forEach((row) => { row.assists += 1; });
      return { type: "CHAMPION_KILL", killerId: killer.raw.participantId, victimId: victims[eventIndex].raw.participantId, assistingParticipantIds: assistants.map((row) => row.raw.participantId) };
    });
  });
  const events = Array.from({ length: Math.max(...eventsByTeam.map((list) => list.length)) }, (_, eventIndex) => eventsByTeam.flatMap((list) => list[eventIndex] ? [list[eventIndex]] : [])).flat();
  events.forEach((event, eventIndex) => {
    event.timestamp = Math.round((180 + eventIndex / Math.max(1, events.length - 1) * (settings.seconds - 270)) * 1000);
  });
  participants.forEach((row) => {
    const teamKills = participants.filter((entry) => entry.team_key === row.team_key).reduce((sum, entry) => sum + entry.kills, 0);
    row.kill_participation = (row.kills + row.assists) / teamKills;
    Object.assign(row.raw, { kills: row.kills, deaths: row.deaths, assists: row.assists });
  });
  const teams = [100, 200].map((teamId) => {
    const won = teamId === allyTeamId ? settings.win : !settings.win;
    return { teamId, win: won, objectives: { dragon: { kills: won ? 3 : 1 }, baron: { kills: won ? 1 : 0 }, tower: { kills: won ? 9 : 3 }, riftHerald: { kills: won ? 1 : 0 }, horde: { kills: 3 } } };
  });
  const csMilestones = Object.fromEntries(participants.map((row, participantIndex) => {
    const roleIndex = participantIndex % 5;
    const cs10 = [78, 64, 88, 91, 14][roleIndex] + index + (row.team_key === "ALLY" ? 2 : 0);
    return [String(row.raw.participantId), { cs10, cs20: Math.min(row.cs, cs10 * 2 + 12) }];
  }));
  return {
    id, team_id: TEAM.id, game_id: `DEMO_${index + 1}`, opponent: `Rivaux Démo ${index + 1}`,
    result: settings.win ? "Victoire" : "Défaite", side: settings.side, patch: "16.18",
    duration: `${Math.floor(settings.seconds / 60)}:${String(settings.seconds % 60).padStart(2, "0")}`,
    played_at: settings.date, game_date: settings.date, category_id: CATEGORY.id, category_ids: [CATEGORY.id], participants,
    raw: {
      nxt5Label: `Scrim fictif ${index + 1} · Rivaux Démo`,
      info: { gameStartTimestamp: Date.parse(settings.date), gameDuration: settings.seconds, gameVersion: "16.18", teams },
      nxt5: { timelineEvents: events, timelineSummary: { available: true, csMilestones } },
    },
  };
}

function demoAudienceReport() {
  return {
    generatedAt: "2026-09-20T20:00:00Z",
    period: { from: "2026-09-14", to: "2026-09-20", days: 7 },
    comparison: { from: "2026-09-07", to: "2026-09-13", days: 7 },
    totals: { visitors: 180, sessions: 240, pageviews: 720, engagedSessions: 180, engagementRate: 75, avgDurationSeconds: 152, pagesPerSession: 3, conversions: 24, conversionRate: 10, bounceRate: 25, returningVisitors: 45 },
    previous: { visitors: 160, sessions: 200, pageviews: 560, engagedSessions: 140, engagementRate: 70, avgDurationSeconds: 139, pagesPerSession: 2.8, conversions: 16, conversionRate: 8, bounceRate: 30, returningVisitors: 35 },
    timeseries: [
      ["2026-09-14", 26, 30, 84, 2], ["2026-09-15", 28, 34, 102, 3], ["2026-09-16", 24, 29, 87, 3],
      ["2026-09-17", 31, 36, 108, 4], ["2026-09-18", 35, 42, 126, 5], ["2026-09-19", 30, 36, 108, 4], ["2026-09-20", 28, 33, 105, 3],
    ].map(([date, visitors, sessions, pageviews, conversions]) => ({ date, visitors, sessions, pageviews, conversions })),
    pages: [
      { path: "/", views: 280, visitors: 150, avgDurationSeconds: 36, exits: 70 },
      { path: "/decouverte", views: 180, visitors: 120, avgDurationSeconds: 51, exits: 60 },
      { path: "/tarifs", views: 160, visitors: 105, avgDurationSeconds: 69, exits: 60 },
      { path: "/connexion", views: 100, visitors: 80, avgDurationSeconds: 61.8, exits: 50 },
    ],
    sources: [{ source: "direct", sessions: 120, visitors: 100, conversions: 12 }, { source: "organic", sessions: 72, visitors: 61, conversions: 8 }, { source: "social", sessions: 48, visitors: 44, conversions: 4 }],
    campaigns: [{ source: "social", medium: "publication", campaign: "Exemple fictif · septembre", sessions: 24, conversions: 3 }],
    devices: [{ device: "desktop", sessions: 150 }, { device: "mobile", sessions: 84 }, { device: "tablet", sessions: 6 }],
    browsers: [{ browser: "Chrome", sessions: 144 }, { browser: "Safari", sessions: 60 }, { browser: "Firefox", sessions: 36 }],
    countries: [{ country: "FR", sessions: 192 }, { country: "BE", sessions: 24 }, { country: "CH", sessions: 24 }],
    goals: [{ name: "signup", events: 18, sessions: 18, conversionRate: 7.5 }, { name: "access_request", events: 6, sessions: 6, conversionRate: 2.5 }, { name: "pricing_view", events: 160, sessions: 120, conversionRate: 50 }],
    heatmap: [[1, 18, 84], [2, 18, 102], [3, 18, 87], [4, 19, 108], [5, 19, 126], [6, 17, 108], [0, 17, 105]].map(([weekday, hour, pageviews]) => ({ weekday, hour, pageviews })),
    realtime: { windowMinutes: 5, visitors: 3 },
  };
}

export async function createExportExample(id) {
  if (!EXPORT_TEMPLATES.some((template) => template.id === id)) throw new Error("Ce modèle d’export n’existe pas.");
  if (id === "audience") {
    const { audienceCsv } = await import("./audience-metrics.js");
    const csvText = audienceCsv(demoAudienceReport(), { device: "all", source: "all" });
    return { blob: new Blob([csvText], { type: "text/csv;charset=utf-8;" }), filename: "nxt5-exemple-fictif-frequentation-7j.csv", csvText };
  }

  const matches = MATCH_SETTINGS.map(demoMatch);
  const { pngPagesBlob } = await import("../../utils/png-report.js");
  let canvases;
  if (id === "discord-game") {
    const { buildGamePublicationSnapshot } = await import("../../../shared/publications/game-publication.js");
    const { renderGamePublicationPng } = await import("../../../shared/publications/game-publication-browser.js");
    const snapshot = buildGamePublicationSnapshot({ team: TEAM, match: matches[0], categories: [CATEGORY] });
    canvases = [await renderGamePublicationPng(snapshot, { layout: "discord" })];
  } else if (id === "game" || id === "group") {
    const { renderStatsPng } = await import("../workspace/GameWorkspace.jsx");
    canvases = await renderStatsPng({
      title: "Bloc de scrims · exemple fictif", subtitle: CATEGORY.name,
      matches: id === "game" ? matches.slice(0, 1) : matches,
      team: TEAM, teamName: TEAM.name, categories: [CATEGORY], group: id === "group",
    });
  } else if (id === "trends") {
    const { renderTrendsPng } = await import("../workspace/TrendsPage.jsx");
    canvases = [await renderTrendsPng({ matches, teamName: TEAM.name, categoryName: CATEGORY.name, periodLabel: "4 games de démonstration" })];
  } else if (id === "profile") {
    const { renderPlayerProfilePng } = await import("../workspace/PlayerUltimateProfile.jsx");
    const rows = matches.flatMap((match) => match.participants.filter((row) => row.player_id === PLAYER.id).map((row) => ({ ...row, match })));
    canvases = [await renderPlayerProfilePng({ player: PLAYER, rows, category: CATEGORY.name, teamName: TEAM.name, selectedMatches: matches })];
  } else {
    const { renderChampionTierListPng, championPoolPngPages } = await import("../workspace/workspace-shared.jsx");
    const rows = [["Ahri", "lock"], ["Orianna", "lock"], ["Syndra", "pocket"], ["Viktor", "work"], ["Taliyah", "work"], ["Azir", "danger"]].map(([champion, status]) => {
      const played = matches.filter((match) => match.participants.some((row) => row.player_id === PLAYER.id && row.champion === champion));
      const wins = played.filter((match) => match.result === "Victoire").length;
      return { champion, status, games: played.length, knownResults: played.length, winrate: played.length ? wins / played.length * 100 : null, stats_available: true };
    });
    canvases = [];
    for (let pageIndex = 0; pageIndex < championPoolPngPages({ rows }).pageCount; pageIndex += 1) {
      canvases.push(await renderChampionTierListPng({ player: PLAYER, rows, category: CATEGORY.name, matches, pageIndex }));
    }
  }
  try {
    const width = Math.max(...canvases.map((canvas) => canvas.width));
    const height = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
    return { blob: await pngPagesBlob(canvases), filename: `nxt5-exemple-fictif-${id}.png`, width, height };
  } finally {
    // The browser preview keeps the encoded Blob, so release the much larger
    // Canvas pixel buffers as soon as encoding is complete.
    canvases.forEach((canvas) => { canvas.width = 0; canvas.height = 0; });
  }
}
