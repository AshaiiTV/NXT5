// Commercial proposal only. No trial clock or billing entitlement is activated here.
export const DISCOVERY_TRIAL_DAYS = 14;

// Keep disabled until team entitlements, server authorization and billing are launched.
// Deliberately not controlled by environment variables, browser storage or URL parameters.
export const SUBSCRIPTION_RESTRICTIONS_ENABLED = false;

export const PASS_FEATURES = {
  workspace: { label: "Tous les outils", benefit: "utiliser tous les outils de ton équipe" },
  reviews: { label: "Reviews", benefit: "retrouver tes reviews et préparer les prochaines sessions" },
  imports: { label: "Imports", benefit: "importer tes games et suivre tes sessions" },
  exports: { label: "Exports", benefit: "exporter les analyses de ton équipe" },
  trends: { label: "Tendances", benefit: "suivre les tendances de ton équipe" },
  compositions: { label: "Compositions", benefit: "préparer et retrouver tes compositions" },
  champion_pool: { label: "Champion Pool", benefit: "faire évoluer les champion pools de ton équipe" },
  planning: { label: "Planning", benefit: "organiser les sessions de ton équipe" },
  statistics: { label: "Statistiques", benefit: "consulter les statistiques de tes games" },
  roster: { label: "Roster", benefit: "suivre et organiser ton roster" },
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
