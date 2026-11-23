import React from "react";
import { ExternalLink } from "lucide-react";
import { t } from "../../i18n/translate.js";
import "./source-link.css";

// Shared by the opponents workspace and the Trends drafter analysis: kept apart
// so Trends does not download the whole opponents workspace for one link.
function sourceHref(snapshot) {
  try {
    const url = new URL(snapshot.sourceUrl);
    return url.protocol === "https:" && url.hostname === "drafter.lol" && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export function SourceLink({ snapshot }) {
  if (snapshot?.source === "nxt5" && /^[0-9a-f-]{36}$/.test(snapshot.sourceDraftId)) {
    const series = /^[0-9a-f-]{36}$/.test(snapshot.seriesId) && Number.isInteger(snapshot.gameNumber);
    const room = series ? `${snapshot.seriesId}&game=${snapshot.gameNumber}` : snapshot.sourceDraftId;
    return <a className="opponents-source" href={`/draft/salle?room=${room}`}>{t("Revoir la salle")}<ExternalLink size={16} aria-hidden="true" /></a>;
  }
  const href = sourceHref(snapshot);
  return href ? <a className="opponents-source" href={href} target="_blank" rel="noopener noreferrer">{t("Ouvrir sur Drafter")}<ExternalLink size={16} aria-hidden="true" /></a> : null;
}
