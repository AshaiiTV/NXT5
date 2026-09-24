// Commercial proposal only. No trial clock or billing entitlement is activated here.
export const DISCOVERY_TRIAL_DAYS = 14;

// Keep disabled until team entitlements, server authorization and billing are launched.
// Deliberately not controlled by environment variables, browser storage or URL parameters.
export const SUBSCRIPTION_RESTRICTIONS_ENABLED = false;

export const PASS_FEATURES = {
  workspace: { label: "Tous les outils", benefit: "utiliser tous les outils de ton équipe" },
  reviews: { label: "Débriefs", benefit: "retrouver tes débriefs et préparer les prochaines séances" },
  imports: { label: "Imports", benefit: "importer tes parties et suivre tes séances" },
  exports: { label: "Exports", benefit: "exporter les analyses de ton équipe" },
  trends: { label: "Analyses", benefit: "comparer les parties de ton équipe" },
  compositions: { label: "Compositions", benefit: "préparer et retrouver tes compositions" },
  champion_pool: { label: "Champions des joueurs", benefit: "préparer les champions de ton équipe" },
  planning: { label: "Planning", benefit: "organiser les séances de ton équipe" },
  statistics: { label: "Statistiques", benefit: "consulter les statistiques de tes parties" },
  roster: { label: "Effectif", benefit: "suivre et organiser les joueurs de ton équipe" },
  profiles: { label: "Profils joueurs", benefit: "suivre la progression de tes joueurs" },
};

// Planned policy for isolated previews/tests. This does not read or start a trial.
// Every workspace tool follows the same rule: complete trial, then a team Pass.
export function getPlannedPassFeatureAccess(feature, { hasTeamPass = false, hasActiveTrial = false } = {}) {
  const allowed = hasTeamPass === true || hasActiveTrial === true;
  return { allowed, requiresPass: !allowed, reason: hasTeamPass === true ? "team_pass" : hasActiveTrial === true ? "discovery_trial" : "pass_required" };
}

export function getPassFeatureAccess(feature, context = {}) {
  if (!SUBSCRIPTION_RESTRICTIONS_ENABLED) return { allowed: true, requiresPass: false, reason: "prelaunch" };
  return getPlannedPassFeatureAccess(feature, context);
}

export function isPassFeatureLocked(feature, context = {}) {
  return !getPassFeatureAccess(feature, context).allowed;
}
