// Routing data for the lazily loaded public pages. The router only needs the
// paths; the page contents (LEGAL_PAGES, PUBLIC_GUIDES) stay in their chunks.
// A test keeps these lists in sync with the page modules.
export const LEGAL_PATHS = ["/mentions-legales", "/confidentialite", "/cookies", "/conditions", "/reglement", "/contact"];
export const GUIDE_PATHS = ["/guides/importer-premier-scrim", "/guides/preparer-debrief"];

export const isLegalPath = path => LEGAL_PATHS.includes(path);
export const isGuidePath = path => GUIDE_PATHS.includes(path);
