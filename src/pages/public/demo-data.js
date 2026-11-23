// Synthetic, public fixtures only. Never load an account, team or private match here.
export const DEMO_TEAM = "Équipe Horizon · fictive";
const roles = ["TOP", "JGL", "MID", "ADC", "SUP"];

// Fictional gold-difference timelines ([seconds, our team − opponents]). Each one
// ends on the final gold difference derived from the participants below.
const objective = (id, seconds, takenBy) => ({
  id, seconds, takenBy, name: id === "baron" ? "Baron Nashor" : "Dragon", label: id === "baron" ? "Nashor" : "Dragon",
  time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
});

function demoMatch(index, { result, opponent, allies, enemies, gold, vision, deaths, review, goldTimeline, objectives }) {
  return {
    id: `demo-${index}`, game_id: `DEMO_${index}`, title: `Scrim ${index} · ${opponent}`,
    opponent, raw: { nxt5Label: `Scrim ${index} · ${opponent}` }, result, game_date: `2026-09-${String(20 + index).padStart(2, "0")}T18:00:00.000Z`,
    duration_seconds: 1800 + index * 75, side: index === 2 ? "red" : "blue",
    team_id: "public-demo", review_status: "done", categories: [],
    participants: ["ALLY", "ENEMY"].flatMap((team) => roles.map((role, i) => ({
      id: `${index}-${team}-${role}`, role, team_key: team,
      summoner_name: team === "ALLY" ? `Horizon ${role}` : `Adversaire ${role}`,
      champion: (team === "ALLY" ? allies : enemies)[i],
      gold: 11000 + i * 500 + (team === "ALLY" ? gold / 5 : 0),
      vision: 20 + i * 4 + (team === "ALLY" ? vision / 5 : 0),
      kills: team === "ALLY" ? [3, 4, 6, 7, 1][i] : deaths[i],
      deaths: team === "ALLY" ? deaths[i] : [3, 4, 6, 7, 1][i],
      assists: team === "ALLY" ? [5, 9, 7, 8, 16][i] : [4, 6, 8, 9, 12][i],
    }))),
    demoReview: review,
    goldTimeline,
    objectives: objectives.map(([id, seconds, ally]) => objective(id, seconds, ally ? "Horizon" : opponent)),
  };
}

export const DEMO_MATCHES = [
  demoMatch(1, { result: "Défaite", opponent: "Aurore",
    allies: ["Gnar", "Vi", "Ahri", "Jinx", "Braum"],
    enemies: ["Ornn", "Viego", "Orianna", "Ezreal", "Leona"],
    gold: -3500, vision: -10, deaths: [5, 6, 4, 5, 7],
    goldTimeline: [
      [0, 0], [120, 150], [240, -150], [360, 100], [480, -300], [600, -650], [720, -400], [840, -900], [960, -1300],
      [1080, -1100], [1200, -1700], [1320, -2100], [1440, -1800], [1560, -2600], [1680, -2900], [1800, -3200], [1875, -3500],
    ],
    objectives: [["dragon", 1200, false], ["baron", 1560, false]],
    review: {
    observation: "L’équipe termine avec 3 500 or de moins que son adversaire.",
    question: "À quels moments avons-nous perdu l’accès aux vagues et aux ressources de la carte ?",
    action: "Au débrief, revoir ensemble une rotation choisie dans le replay et noter qui devait récupérer chaque vague.",
  } }),
  demoMatch(2, { result: "Victoire", opponent: "Orbite",
    allies: ["Ornn", "Vi", "Syndra", "Caitlyn", "Nautilus"],
    enemies: ["Gnar", "LeeSin", "Ahri", "Xayah", "Rakan"],
    gold: 1500, vision: 5, deaths: [3, 4, 2, 3, 4],
    goldTimeline: [
      [0, 0], [120, -100], [240, 200], [360, 350], [480, 100], [600, -250], [720, -500], [840, -200], [960, 300],
      [1080, 600], [1200, 250], [1320, 900], [1440, 700], [1560, 1200], [1680, 1600], [1800, 1100], [1950, 1500],
    ],
    objectives: [["dragon", 1080, true], ["baron", 1680, true]],
    review: {
    observation: "L’équipe termine avec 1 500 or de plus et 16 morts cumulées.",
    question: "Quelles décisions avons-nous réussi à coordonner, même lorsque l’écart restait faible ?",
    action: "Choisir une séquence réussie avec les cinq joueurs et en conserver une consigne commune.",
  } }),
  demoMatch(3, { result: "Victoire", opponent: "Aurore",
    allies: ["Gnar", "Sejuani", "Orianna", "Jinx", "Lulu"],
    enemies: ["Renekton", "Viego", "Ahri", "Ezreal", "Braum"],
    gold: 4000, vision: 20, deaths: [2, 3, 2, 2, 3],
    // Also drives the illustrative curve of the homepage analysis scene.
    goldTimeline: [
      [0, 0], [120, 200], [225, -200], [345, 450], [450, 250],
      [560, 650], [720, 250], [840, -400], [945, 100], [1065, -100],
      [1170, 700], [1260, 1300], [1380, 1000], [1500, 2200],
      [1605, 1700], [1710, 2800], [1845, 2600], [2025, 4000],
    ],
    objectives: [["dragon", 1200, true], ["baron", 1710, true]],
    review: {
    observation: "L’équipe termine avec 4 000 or de plus et un écart de vision de +20.",
    question: "La vision a-t-elle facilité nos décisions, ou reflète-t-elle surtout notre avance ?",
    action: "Revoir le contexte d’un objectif dans le replay avant de choisir une consigne pour le prochain entraînement.",
  } }),
];
