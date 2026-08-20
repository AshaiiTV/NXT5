import { AUTH_PATHS, AUTH_ROUTES, NAV, PROFILE_VIEW_ROUTES, PUBLIC_ROUTES } from "./constants.jsx";

export function normalizePath(pathname = "/") {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function pageFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path === "/statistiques" || path === "/rapports") return "matches";
  if (path === "/profil" || path.startsWith("/profil/") || path === "/mon-profil" || path.startsWith("/mon-profil/")) return "profile";
  return NAV.find((item) => item.path === path)?.id || "teams";
}

export function pathFromPage(pageId) {
  return NAV.find((item) => item.id === pageId)?.path || "/equipes";
}

export function profileViewFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path !== "/profil" && !path.startsWith("/profil/") && path !== "/mon-profil" && !path.startsWith("/mon-profil/")) return "overview";
  const slug = path.replace(/^\/(?:mon-)?profil\/?/, "").split("/").filter(Boolean)[0] || "";
  if (["builds", "matchups"].includes(slug)) return "champions";
  return PROFILE_VIEW_ROUTES.find((item) => item.path === slug)?.id || "overview";
}

export function profilePathFromView(viewId = "overview") {
  const view = PROFILE_VIEW_ROUTES.find((item) => item.id === viewId) || PROFILE_VIEW_ROUTES[0];
  return view.path ? `/mon-profil/${view.path}` : "/mon-profil";
}

export function profileViewLabel(viewId = "overview") {
  return PROFILE_VIEW_ROUTES.find((item) => item.id === viewId)?.label || PROFILE_VIEW_ROUTES[0].label;
}

export function gameWorkspaceSectionFromPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path === "/statistiques") return "stats";
  if (path === "/rapports") return "review";
  return "import";
}

export function gameWorkspaceSectionLabel(sectionId = "import") {
  return { import: "Importer", stats: "Stats", review: "Review" }[sectionId] || "Importer";
}

export function authModeFromPath(pathname = window.location.pathname) {
  return AUTH_ROUTES[normalizePath(pathname)] || null;
}

export function isAppPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  if (path === "/profil" || path.startsWith("/profil/") || path === "/mon-profil" || path.startsWith("/mon-profil/")) return true;
  return NAV.some((item) => item.path === path);
}

export function isKnownPath(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  return PUBLIC_ROUTES.includes(path) || AUTH_PATHS.includes(path) || isAppPath(path);
}

export function isSafeInternalPath(path = "") {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function buildLoginRedirect(path, search = "") {
  const target = `${path}${search || ""}`;
  return `/connexion?next=${encodeURIComponent(target)}`;
}

export function readRoute() {
  return { path: normalizePath(window.location.pathname), search: window.location.search };
}

export function openAppPath(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
