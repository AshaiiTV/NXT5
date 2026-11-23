import { lazyPage } from "./lazy-page.jsx";
import { PUBLIC_PAGE_LOADERS, publicPageKey } from "./public-page-loaders.js";

// Public marketing and information pages, each in its own chunk. A visitor
// downloads the router plus the page they asked for; prerendered pages are
// preloaded before hydration (main.jsx) and provided synchronously to the
// server render (seo/render.jsx), so the hydrated tree matches the snapshot.
export const PUBLIC_PAGES = {
  home: lazyPage(PUBLIC_PAGE_LOADERS.home, module => module.HomeScreen),
  features: lazyPage(PUBLIC_PAGE_LOADERS.features, module => module.FeaturesPage),
  guide: lazyPage(PUBLIC_PAGE_LOADERS.guide, module => module.PublicGuidePage),
  social: lazyPage(PUBLIC_PAGE_LOADERS.social),
  support: lazyPage(PUBLIC_PAGE_LOADERS.support, module => module.SupportPage),
  legal: lazyPage(PUBLIC_PAGE_LOADERS.legal, module => module.LegalPage),
};

/** The lazy public page a prerendered path renders for a visitor, if any. */
export function publicPageForPath(path) {
  const key = publicPageKey(path);
  return key ? PUBLIC_PAGES[key] : null;
}

export function preloadPublicPage(path) {
  return publicPageForPath(path)?.preload() ?? null;
}
