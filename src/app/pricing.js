import { DISCOVERY_TRIAL_DAYS } from "./pass-access.js";

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
    days: DISCOVERY_TRIAL_DAYS,
    price: "0 €",
    period: `pendant ${DISCOVERY_TRIAL_DAYS} jours`,
    description: `${DISCOVERY_TRIAL_DAYS} jours pour découvrir les outils NXT5, puis un Pass Équipe pour continuer.`,
    terms: "Sans carte bancaire · sans passage automatique au payant",
    features: TEAM_FEATURES,
  },
  {
    code: "team_monthly",
    name: "Pass Équipe",
    months: 1,
    price: "9,90 €",
    period: "TTC / mois / équipe",
    description: "Pour continuer après l’essai, avec le bot Discord pour publier les games de ton équipe.",
    terms: "Mensuel · résiliable à tout moment",
    features: [...TEAM_FEATURES, "Bot Discord · publication des games"],
  },
];

export const PROPOSED_PLAN_OPTIONS = PROPOSED_PLANS.map((plan) => ({
  value: plan.code,
  label: `${plan.name} — ${plan.price} ${plan.period}`,
}));
