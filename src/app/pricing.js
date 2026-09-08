// Public proposals for commercial validation. These values do not grant or limit access.
export const PROPOSED_PLANS = [
  {
    code: "free",
    name: "Découverte",
    price: "0 €",
    period: "gratuit",
    description: "Pour prendre tes repères avec une première équipe.",
    terms: "Sans carte bancaire",
    features: [
      "1 équipe · jusqu’à 10 membres",
      "5 imports de games au total",
      "Statistiques essentielles",
      "1 composition et 3 reviews",
      "Un compte personnel pour rejoindre ton équipe",
    ],
  },
  {
    code: "team_monthly",
    name: "Pass Équipe",
    price: "29 €",
    period: "TTC / mois / équipe",
    description: "Pour organiser les sessions et suivre la progression du roster.",
    terms: "Mensuel · résiliable à tout moment",
    features: [
      "1 équipe · jusqu’à 15 membres",
      "Imports, statistiques et reviews",
      "Planning, champion pools et compositions",
      "Historique complet et export des données",
      "Rôles et accès du staff · assistance standard",
    ],
  },
  {
    code: "team_season",
    name: "Pass Saison",
    price: "169 €",
    period: "TTC / 6 mois / équipe",
    description: "Pour préparer un split avec une durée définie dès le départ.",
    terms: "Paiement unique · sans renouvellement automatique",
    features: [
      "1 équipe · jusqu’à 15 membres",
      "Tous les outils du Pass Équipe",
      "Imports, statistiques et reviews",
      "Planning, champion pools et compositions",
      "Historique, export et accès du staff",
    ],
  },
];

export const PROPOSED_PLAN_OPTIONS = PROPOSED_PLANS.map((plan) => ({
  value: plan.code,
  label: `${plan.name} — ${plan.price} ${plan.period}`,
}));
