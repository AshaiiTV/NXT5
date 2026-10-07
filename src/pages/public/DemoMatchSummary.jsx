import React from "react";
import { ArrowRight } from "lucide-react";
import { Badge, Button, ReadingDetails, Surface } from "../../components/ui/Core.jsx";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { buildTrendSeries } from "../../utils/trends.js";
import { matchDisplayName } from "../../utils/matches.js";
import { DEMO_MATCHES, DEMO_TEAM } from "./demo-data.js";
import "./public-demo.css";

const number = (value) => value === null ? "—" : value.toLocaleString("fr-FR");

export function DemoMatchSummary({ match = DEMO_MATCHES[2], compact = false, onOpenReview }) {
  const gold = buildTrendSeries([match], "gold").points[0].value;
  const vision = buildTrendSeries([match], "vision").points[0].value;
  const deaths = buildTrendSeries([match], "deaths").points[0].value;
  const signed = (value) => `${value > 0 ? "+" : ""}${number(value)}`;
  return <Surface glow={compact} className={`demo-match-summary${compact ? " is-compact" : ""}`}>
    <div className="demo-match-heading"><p>Données fictives · Lecture seule</p><Badge tone={match.result === "Victoire" ? "green" : "red"}>{match.result}</Badge></div>
    <h2>{matchDisplayName(match)}</h2>
    <p className="demo-match-context">{DEMO_TEAM} · {Math.floor(match.duration_seconds / 60)} min</p>
    <dl className="demo-match-metrics demo-match-primary">
      <div><dt>Écart d’or final</dt><dd>{signed(gold)} <span>or</span></dd></div>
    </dl>
    <p className="demo-data-note">Notre équipe − adversaires. Un écart final ne suffit pas à expliquer le résultat.</p>
    <div className="demo-coach-question"><p>La question du débrief</p><strong>{match.demoReview.question}</strong></div>
    {onOpenReview && <div className="demo-review-action"><Button type="button" icon={ArrowRight} onClick={onOpenReview}>Lire le débrief</Button></div>}
    <ReadingDetails key={match.id} title={compact ? "Autre indicateur" : "Statistiques et joueurs"} description={compact ? "Écart de vision" : "Vision, morts et résultats des cinq joueurs"} className="demo-match-details">
      <dl className="demo-match-metrics">
        <div><dt>Écart de vision</dt><dd>{signed(vision)} <span>points</span></dd></div>
        {!compact && <div><dt>Morts de l’équipe</dt><dd>{number(deaths)}</dd></div>}
      </dl>
      {!compact && <ul className="demo-player-list" aria-label="Les cinq joueurs fictifs">{match.participants.filter((row) => row.team_key === "ALLY").map((row) => <li key={row.id}><RoleIcon role={row.role} className="h-7 w-7" /><span><strong>{row.summoner_name}</strong><span>{row.champion}</span></span><span className="demo-kda"><strong>{row.kills} / {row.deaths} / {row.assists}</strong><span>Éliminations / morts / assistances</span></span></li>)}</ul>}
    </ReadingDetails>
  </Surface>;
}
