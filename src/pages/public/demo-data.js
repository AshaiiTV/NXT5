// Synthetic, public fixtures only. Never load an account, team or private match here.
export const DEMO_TEAM = "Équipe Horizon · fictive";
const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];
const champions = ["Gnar", "Vi", "Ahri", "Jinx", "Braum"];
const opponents = ["Ornn", "Viego", "Orianna", "Ezreal", "Leona"];

function demoMatch(index, { result, opponent, gold, vision, deaths, review }) {
  return {
    id: `demo-${index}`, game_id: `DEMO_${index}`, title: `Scrim ${index} · ${opponent}`,
    opponent, raw: { nxt5Label: `Scrim ${index} · ${opponent}` }, result, game_date: `2026-09-${String(20 + index).padStart(2, "0")}T18:00:00.000Z`,
    duration_seconds: 1800 + index * 75, side: index === 2 ? "red" : "blue",
    team_id: "public-demo", review_status: "done", categories: [],
    participants: ["ALLY", "ENEMY"].flatMap((team) => roles.map((role, i) => ({
      id: `${index}-${team}-${role}`, role, team_key: team,
      summoner_name: team === "ALLY" ? `Horizon ${role}` : `Adversaire ${role}`,
      champion: (team === "ALLY" ? champions : opponents)[i],
      gold: 11000 + i * 500 + (team === "ALLY" ? gold / 5 : 0),
      vision: 20 + i * 4 + (team === "ALLY" ? vision / 5 : 0),
      kills: team === "ALLY" ? [3, 4, 6, 7, 1][i] : deaths[i],
      deaths: team === "ALLY" ? deaths[i] : [3, 4, 6, 7, 1][i],
      assists: team === "ALLY" ? [5, 9, 7, 8, 16][i] : [4, 6, 8, 9, 12][i],
    }))),
    demoReview: review,
  };
}

export const DEMO_MATCHES = [
  demoMatch(1, { result: "Défaite", opponent: "Aurore", gold: -3500, vision: -10, deaths: [5, 6, 4, 5, 7], review: {
    observation: "L’équipe termine avec 3 500 or de moins que son adversaire.",
    question: "À quels moments avons-nous perdu l’accès aux vagues et aux ressources de la carte ?",
    action: "Au débrief, revoir ensemble une rotation choisie dans le replay et noter qui devait récupérer chaque vague.",
  } }),
  demoMatch(2, { result: "Victoire", opponent: "Orbite", gold: 1500, vision: 5, deaths: [3, 4, 2, 3, 4], review: {
    observation: "L’équipe termine avec 1 500 or de plus et 16 morts cumulées.",
    question: "Quelles décisions avons-nous réussi à coordonner, même lorsque l’écart restait faible ?",
    action: "Choisir une séquence réussie avec les cinq joueurs et en conserver une consigne commune.",
  } }),
  demoMatch(3, { result: "Victoire", opponent: "Aurore", gold: 4000, vision: 20, deaths: [2, 3, 2, 2, 3], review: {
    observation: "L’équipe termine avec 4 000 or de plus et un écart de vision de +20.",
    question: "La vision a-t-elle facilité nos décisions, ou reflète-t-elle surtout notre avance ?",
    action: "Revoir le contexte d’un objectif dans le replay avant de choisir une consigne pour le prochain entraînement.",
  } }),
];
