import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge, Button, ReadingDetails, Surface } from "../../components/ui/Core.jsx";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { buildTrendSeries } from "../../utils/trends.js";
import { matchDisplayName } from "../../utils/matches.js";
import { DEMO_MATCHES, DEMO_TEAM } from "./demo-data.js";
import { formatGoldDifference, formatMatchTime, goldAtTime, GoldTimelineChart } from "../home/GoldTimelineChart.jsx";
import { DemoRoleDuels } from "./DemoTeamViews.jsx";
import "./public-demo.css";

const number = (value) => value === null ? "—" : value.toLocaleString(getLocale());

// Fictional per-game curve with its Dragon and Baron Nashor markers.
function DemoGoldTimeline({ match }) {
  useLanguage();
  const duration = match.duration_seconds;
  const [seconds, setSeconds] = useState(duration);
  const gold = Math.round(goldAtTime(match.goldTimeline, seconds) / 10) * 10;
  const objective = match.objectives.find((item) => item.seconds === seconds);
  const final = match.goldTimeline[match.goldTimeline.length - 1][1];
  return <div className="demo-gold-timeline">
    <div className="ps-match-facts" id="demo-selected-gold" aria-live="polite">
      <div>
        <strong>{formatGoldDifference(gold)} <span>{t("or")}</span></strong>
        <span>{objective ? t("{0} pris par {1}", [t(objective.name), objective.takenBy]) : t(seconds === duration ? "Écart final avec l’adversaire" : "Écart avec l’adversaire à cet instant")}</span>
      </div>
      <span className="ps-duration"><time>{formatMatchTime(seconds)}</time></span>
    </div>
    <GoldTimelineChart timeline={match.goldTimeline} durationSeconds={duration} objectives={match.objectives} seconds={seconds}
      onSecondsChange={setSeconds} idPrefix="demo" controls="demo-selected-gold" zeroLine
      ariaLabel={t("Courbe fictive de l’écart d’or, de 0 à {0} or en fin de partie.", [formatGoldDifference(final)])} />
  </div>;
}

export function DemoMatchSummary({ match = DEMO_MATCHES[2], compact = false, onOpenReview, timeline = false, detailsOpen = false, duels = false, titleTag: Title = "h2" }) {
  useLanguage();
  const gold = buildTrendSeries([match], "gold").points[0].value;
  const vision = buildTrendSeries([match], "vision").points[0].value;
  const deaths = buildTrendSeries([match], "deaths").points[0].value;
  const signed = (value) => `${value > 0 ? "+" : ""}${number(value)}`;
  return <Surface glow={compact} className={`demo-match-summary${compact ? " is-compact" : ""}`}>
    <div className="demo-match-heading"><p>{t("Données fictives · Lecture seule")}</p><Badge tone={match.result === "Victoire" ? "green" : "red"}>{t(match.result)}</Badge></div>
    <Title>{matchDisplayName(match)}</Title>
    <p className="demo-match-context">{t(DEMO_TEAM)} · {Math.floor(match.duration_seconds / 60)}{t(" min")}</p>
    {timeline && match.goldTimeline ? <DemoGoldTimeline key={`gold-${match.id}`} match={match} /> : <dl className="demo-match-metrics demo-match-primary">
      <div><dt>{t("Écart d’or final")}</dt><dd>{signed(gold)} <span>{t("or")}</span></dd></div>
    </dl>}
    <p className="demo-data-note">{t("Notre équipe − adversaires. Un écart final ne suffit pas à expliquer le résultat.")}</p>
    <div className="demo-coach-question"><p>{t("La question du débrief")}</p><strong>{t(match.demoReview.question)}</strong></div>
    {onOpenReview && <div className="demo-review-action"><Button type="button" icon={ArrowRight} onClick={onOpenReview}>{t("Lire le débrief")}</Button></div>}
    <ReadingDetails key={`details-${match.id}`} title={compact ? t("Autre indicateur") : t("Statistiques et joueurs")} description={compact ? t("Écart de vision") : t(duels ? "Vision, morts, joueurs et duels par poste" : "Vision, morts et résultats des cinq joueurs")} className="demo-match-details" open={detailsOpen || undefined}>
      <dl className="demo-match-metrics">
        <div><dt>{t("Écart de vision")}</dt><dd>{signed(vision)} <span>{t("points")}</span></dd></div>
        {!compact && <div><dt>{t("Morts de l’équipe")}</dt><dd>{number(deaths)}</dd></div>}
      </dl>
      {!compact && <ul className="demo-player-list" aria-label={t("Les cinq joueurs fictifs")}>{match.participants.filter((row) => row.team_key === "ALLY").map((row) => <li key={row.id}><RoleIcon role={row.role} className="h-7 w-7" /><span><strong>{row.summoner_name}</strong><span>{row.champion}</span></span><span className="demo-kda"><strong>{row.kills} / {row.deaths} / {row.assists}</strong><span>{t("Éliminations / morts / assistances")}</span></span></li>)}</ul>}
      {!compact && duels && <DemoRoleDuels match={match} />}
    </ReadingDetails>
  </Surface>;
}
