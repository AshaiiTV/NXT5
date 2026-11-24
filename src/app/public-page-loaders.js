import { isGuidePath, isLegalPath } from "./public-paths.js";

// Chunks of the lazily loaded public pages. Shared by the router registry
// (public-pages.jsx) and the boot sequence, which starts the download of a
// prerendered page in parallel with the router.
export const PUBLIC_PAGE_LOADERS = {
  home: () => import("../pages/public/HomePage.jsx"),
  features: () => import("../pages/public/FeaturesPage.jsx"),
  guide: () => import("../pages/public/PublicGuides.jsx"),
  social: () => import("../pages/public/SocialPage.jsx"),
  support: () => import("../pages/public/SupportPage.jsx"),
  legal: () => import("../pages/public/LegalPage.jsx"),
};

/** Key of the lazily loaded page rendered for a public path, if any. */
export function publicPageKey(path) {
  if (path === "/") return "home";
  if (path === "/fonctionnalites") return "features";
  if (path === "/reseaux") return "social";
  if (path === "/soutenir") return "support";
  if (isGuidePath(path)) return "guide";
  if (isLegalPath(path)) return "legal";
  return null;
}
