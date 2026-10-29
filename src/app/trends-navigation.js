export const TREND_PANEL_IDS = ["coach", "evolution", "comparison", "statistics", "draft", "drafts", "playstyle"];
export const DRAFT_DETAIL_IDS = ["pick-repere", "confort", "profil", "compositions", "duos", "a-revoir", "roles"];

function canonicalTrendPanel(panel) {
  const canonical = panel === "ai-objectives" ? "playstyle" : panel;
  return TREND_PANEL_IDS.includes(canonical) ? canonical : "coach";
}

export function isTrendDetailPath(path = "") {
  return DRAFT_DETAIL_IDS.some((id) => path.replace(/\/+$/, "") === `/tendances/draft/${id}`);
}

export function readTrendsRoute(route = {}) {
  const params = new URLSearchParams(route.search || "");
  const detail = isTrendDetailPath(route.path) ? route.path.replace(/\/+$/, "").split("/").at(-1) : "";
  return {
    detail,
    panel: detail ? "draft" : canonicalTrendPanel(params.get("rubrique")),
    category: params.get("contexte") || "",
    period: ["5", "10", "20"].includes(params.get("periode")) ? params.get("periode") : "all",
  };
}

export function trendsPath({ detail = "", panel = "coach", category = "", period = "all" } = {}) {
  const hasDetail = DRAFT_DETAIL_IDS.includes(detail);
  const canonicalPanel = canonicalTrendPanel(panel);
  const params = new URLSearchParams();
  if (!hasDetail && canonicalPanel !== "coach") params.set("rubrique", canonicalPanel);
  if (category) params.set("contexte", category);
  if (["5", "10", "20"].includes(period)) params.set("periode", period);
  const query = params.toString();
  return `${hasDetail ? `/tendances/draft/${detail}` : "/tendances"}${query ? `?${query}` : ""}`;
}
