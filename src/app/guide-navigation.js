import { draftViewFromPath, normalizePath, pageFromPath, profileViewFromPath } from "./routing.js";
import { readTrendsRoute } from "./trends-navigation.js";

/** Keep contextual Help aligned with the view actually selected by the router. */
export function guideSectionForRoute(route = {}) {
  const path = normalizePath(route.path || "/accueil");
  const params = new URLSearchParams(route.search || "");
  const page = pageFromPath(path);
  if (page === "guide") return params.get("section") || "getting-started";
  if (page === "draft") return draftViewFromPath(path) === "compositions" ? "compositions" : "champion-pool";
  if (page === "profile") {
    return { champions: "player-champions", showcase: "player-showcase", pool: "champion-pool" }[profileViewFromPath(path)] || "player-profile";
  }
  if (page === "trends") return readTrendsRoute(route).panel === "draft" ? "champion-analysis" : "trends";
  if (page === "matches") return path === "/integration" || params.get("import") === "1" ? "imports-and-games" : "statistics";
  return {
    home: "getting-started",
    teams: "teams-and-roster",
    "team-management": "teams-and-roster",
    reports: "reviews",
    planning: "planning",
    "bot-discord": "discord",
    "account-settings": "permissions-and-account",
  }[page] || "getting-started";
}
