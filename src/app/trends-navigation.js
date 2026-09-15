export const TREND_PANEL_IDS = ["coach", "evolution", "comparison", "draft", "ai-objectives"];
export const DRAFT_DETAIL_IDS = ["pick-repere", "confort", "profil", "compositions", "duos", "a-revoir", "roles"];

export function isTrendDetailPath(path = "") {
  return DRAFT_DETAIL_IDS.some((id) => path.replace(/\/+$/, "") === `/tendances/draft/${id}`);
}

export function readTrendsRoute(route = {}) {
  const params = new URLSearchParams(route.search || "");
  const detail = isTrendDetailPath(route.path) ? route.path.replace(/\/+$/, "").split("/").at(-1) : "";
  return {
    detail,
    panel: detail ? "draft" : TREND_PANEL_IDS.includes(params.get("rubrique")) ? params.get("rubrique") : "coach",
    category: params.get("contexte") || "",
    period: ["5", "10", "20"].includes(params.get("periode")) ? params.get("periode") : "all",
  };
}

export function trendsPath({ detail = "", panel = "coach", category = "", period = "all" } = {}) {
  const hasDetail = DRAFT_DETAIL_IDS.includes(detail);
  const params = new URLSearchParams();
  if (!hasDetail && TREND_PANEL_IDS.includes(panel) && panel !== "coach") params.set("rubrique", panel);
  if (category) params.set("contexte", category);
  if (["5", "10", "20"].includes(period)) params.set("periode", period);
  const query = params.toString();
  return `${hasDetail ? `/tendances/draft/${detail}` : "/tendances"}${query ? `?${query}` : ""}`;
}
