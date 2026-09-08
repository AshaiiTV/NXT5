// Launch proposals for commercial validation. These values do not start a trial or change access.
const TEAM_FEATURES = [
  "1 équipe · jusqu’à 15 membres",
  "Imports, statistiques et reviews",
  "Planning, champion pools et compositions",
  "Historique complet et export des données",
  "Rôles et accès du staff · assistance standard",
];

export const PROPOSED_PLANS = [
  {
    code: "free",
    name: "Découverte",
    price: "0 €",
    period: "pendant 30 jours",
    description: "30 jours d’accès complet pour tester NXT5 avec ton équipe.",
    terms: "Sans carte bancaire · sans passage automatique au payant",
    features: TEAM_FEATURES,
  },
  {
    code: "team_monthly",
    name: "Pass Équipe",
    price: "9,90 €",
    period: "TTC / mois / équipe",
    description: "Pour continuer à organiser tes sessions et suivre ton roster après l’essai.",
    terms: "Mensuel · résiliable à tout moment",
    features: TEAM_FEATURES,
  },
];

export const PROPOSED_PLAN_OPTIONS = [
  ...PROPOSED_PLANS.map((plan) => ({
    value: plan.code,
    label: `${plan.name} — ${plan.price} ${plan.period}`,
  })),
  { value: "structure", label: "Plusieurs équipes — parlons de tes besoins" },
];
