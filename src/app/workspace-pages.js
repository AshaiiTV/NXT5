// Page chunks of the private workspace, keyed by the page id of
// routing.pageFromPath(). Shared by AppContent (React.lazy), the boot sequence
// and sidebar prefetching; repeated import() calls reuse the same module.
export const WORKSPACE_PAGE_LOADERS = {
  teams: () => import("../pages/workspace/Teams.jsx"),
  "team-management": () => import("../pages/workspace/Teams.jsx"),
  "bot-discord": () => import("../pages/workspace/DiscordWorkspace.jsx"),
  profile: () => import("../pages/workspace/PlayerUltimateProfile.jsx"),
  trends: () => import("../pages/workspace/TrendsPage.jsx"),
  matches: () => import("../pages/workspace/GameWorkspace.jsx"),
  reports: () => import("../pages/workspace/GameWorkspace.jsx"),
  planning: () => import("../pages/workspace/Planning.jsx"),
  scrims: () => import("../pages/workspace/ScrimFinder.jsx"),
  "account-settings": () => import("../pages/workspace/AccountSettings.jsx"),
  draft: () => import("../pages/workspace/DraftWorkspace.jsx"),
  guide: () => import("../pages/GuidePage.jsx"),
};

const prefetched = new Set();

/** Start downloading a workspace page; idempotent and silent on failure (the
 * page's own lazy boundary reports errors when it actually renders). */
export function prefetchWorkspacePage(pageId) {
  const load = WORKSPACE_PAGE_LOADERS[pageId];
  if (!load || prefetched.has(pageId)) return;
  prefetched.add(pageId);
  load().catch(() => prefetched.delete(pageId));
}
