// Read-only views of the public demo, derived from the fictional DEMO_MATCHES only.
// No account, team, API call or external asset is involved.
import { DEMO_MATCHES } from "./demo-data.js";

export const DEMO_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const CHAMPION_NAMES = { LeeSin: "Lee Sin" };
export const championName = (id) => CHAMPION_NAMES[id] || id;
const won = (match) => match.result === "Victoire";
const rate = (wins, games) => games ? Math.round((wins / games) * 100) : null;

export function teamRecord(matches = DEMO_MATCHES) {
  const wins = matches.filter(won).length;
  return { games: matches.length, wins, losses: matches.length - wins, rate: rate(wins, matches.length) };
}

const side = (match, team) => match.participants.filter((row) => row.team_key === team);
const byRole = (match, team, role) => side(match, team).find((row) => row.role === role);

/** Ally and enemy of the same position, in role order. */
export function roleDuels(match) {
  return DEMO_ROLES.map((role) => ({ role, ally: byRole(match, "ALLY", role), enemy: byRole(match, "ENEMY", role) }));
}

function tally(entries) {
  const groups = new Map();
  for (const { key, champion, role, win, match } of entries) {
    const group = groups.get(key) || { key, champion, role, games: 0, wins: 0, matches: [] };
    group.games += 1;
    group.wins += win ? 1 : 0;
    group.matches.push(match);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, rate: rate(group.wins, group.games) }))
    .sort((a, b) => b.games - a.games || championName(a.champion).localeCompare(championName(b.champion)));
}

/** Champions played by each Horizon position, with games and wins. */
export function championPool(matches = DEMO_MATCHES) {
  return DEMO_ROLES.map((role) => ({
    role,
    player: byRole(matches[0], "ALLY", role).summoner_name,
    champions: tally(matches.map((match) => {
      const row = byRole(match, "ALLY", role);
      return { key: row.champion, champion: row.champion, role, win: won(match), match };
    })),
  }));
}

/** Opposing champions, with the result of the opponent who played them. */
export function opponentChampions(matches = DEMO_MATCHES) {
  return tally(matches.flatMap((match) => side(match, "ENEMY").map((row) => ({ key: row.champion, champion: row.champion, role: row.role, win: !won(match), match }))));
}

/** One Horizon position across every demo game, oldest first. */
export function playerHistory(role, matches = DEMO_MATCHES) {
  const games = [...matches].sort((a, b) => Date.parse(a.game_date) - Date.parse(b.game_date)).map((match) => {
    const row = byRole(match, "ALLY", role);
    return { match, row, opponent: byRole(match, "ENEMY", role) };
  });
  const sum = (field) => games.reduce((total, { row }) => total + row[field], 0);
  return { role, player: games[0].row.summoner_name, games, kills: sum("kills"), deaths: sum("deaths"), assists: sum("assists"), record: teamRecord(games.map(({ match }) => match)) };
}

/** Lane duels between one Horizon champion and one opposing champion. */
export function matchupGames(role, champion, opponent, matches = DEMO_MATCHES) {
  return matches.filter((match) => byRole(match, "ALLY", role).champion === champion && byRole(match, "ENEMY", role).champion === opponent)
    .map((match) => ({ match, ally: byRole(match, "ALLY", role), enemy: byRole(match, "ENEMY", role) }));
}

// Written for the demo: the kind of notes a team keeps in its matchup notebook.
export const DEMO_MATCHUP = {
  role: "MID", champion: "Syndra", opponent: "Ahri", status: "Plan renseigné",
  plan: [
    ["Plan de départ", "Pousser les deux premières vagues pour arriver la première sur la rivière."],
    ["Points de vigilance", "Le charme d’Ahri : garder un sbire entre elle et Syndra avant de lancer l’étourdissement."],
    ["À conserver", "Prévenir la jungle quand le charme est utilisé : c’est la fenêtre pour jouer à deux."],
  ],
  experiment: { status: "À tester", text: "Au prochain scrim, noter le minutage du premier retour à la base." },
};

// A fictional week, built from the actions written in the demo notes.
export const DEMO_PLANNING = {
  events: [
    { id: "review", day: "Mardi", time: "19:30", title: "Revue vidéo du Scrim 1 · Aurore", detail: "Revoir une rotation et noter qui devait récupérer chaque vague.", source: "DEMO_1" },
    { id: "scrim", day: "Mercredi", time: "20:00", title: "Scrim 4 contre Aurore", detail: "Trois parties. Appliquer la consigne choisie au débrief.", source: null },
    { id: "draft", day: "Vendredi", time: "19:00", title: "Préparation de draft", detail: "Revoir les choix d’Aurore au poste TOP, dont Renekton.", source: "DEMO_3" },
  ],
  slots: ["Mardi 19:30", "Mercredi 20:00", "Vendredi 19:00"],
  availability: {
    TOP: ["yes", "yes", "maybe"],
    JGL: ["yes", "yes", "yes"],
    MID: ["maybe", "yes", "yes"],
    ADC: ["yes", "yes", "no"],
    SUP: ["yes", "yes", "yes"],
  },
};
