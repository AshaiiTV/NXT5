import React, { useState } from "react";
import { AlertTriangle, Check, CircleCheck, Eye, MessageCircleQuestion, Route, Sparkles, Target, UserRound, Users } from "lucide-react";
import { ReadingDetails } from "../ui/Core.jsx";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import "./auto-debrief.css";

/** Plain wording for coach texts generated from match data. */
export function plainCoachText(value) {
  return String(value || "")
    .replace(/\bVOD\b/g, "vidéo de la partie")
    .replace(/\bun setup\b/gi, "une préparation")
    .replace(/\ble setup\b/gi, "la préparation")
    .replace(/\bsetup\b/gi, "préparation")
    .replace(/\bgames\b/gi, "parties")
    .replace(/\bgame\b/gi, "partie")
    .replace(/\breview\b/gi, "débrief")
    .replace(/\bla débrief\b/g, "le débrief")
    .replace(/\bune débrief\b/g, "un débrief")
    .replace(/\bde or\b/g, "d’or")
    .replace(/Écart final : (.+?) en or final entre/g, "Écart d’or final : $1 entre");
}

/** The import creates this statistics dump; the automatic debrief shows the same data. */
export function isGeneratedImportReport(report) {
  return report?.source === "auto" && /^\s*## Review —/.test(String(report.content || ""));
}

const SIGNAL_LABELS = { Économie: "Écart d’or final", Dégâts: "Écart de dégâts aux champions", Vision: "Écart de score de vision" };
const PLAN_STEPS = ["Avant", "Pendant", "Après"];

/** Catalogue translation of a generated coach text, plain French wording otherwise. */
function coachText(value) {
  const raw = String(value || "");
  const translated = t(raw);
  return translated === raw ? plainCoachText(raw) : translated;
}
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const number = (value) => finite(value) ? value.toLocaleString(getLocale(), { maximumFractionDigits: 0 }) : "—";
const compact = (value) => !finite(value) ? "—" : Math.abs(value) >= 1000
  ? `${(value / 1000).toLocaleString(getLocale(), { maximumFractionDigits: 1 })}k` : number(value);
const signed = (value) => !finite(value) ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${compact(Math.abs(value))}`;
const toneOf = (value) => !finite(value) || value === 0 ? "neutral" : value > 0 ? "positive" : "negative";

function catchSummary(text) {
  const found = /^(\d+) mort\(s\)[^:]*: ([^.]+)\./.exec(String(text || ""));
  return found ? { count: Number(found[1]), times: found[2] } : null;
}

function PlayerCard({ row, enemy, read }) {
  const champion = row.champion ? championDisplayName(row.champion) : "";
  const goldDiff = enemy && finite(row.gold) && finite(enemy.gold) ? row.gold - enemy.gold : null;
  const catches = catchSummary(read?.catchText);
  return <li className="ad-player">
    <div className="ad-player-head">
      <span className="ad-player-portrait" aria-hidden="true">
        {champion ? <ChampionPortrait champion={row.champion} alt="" /> : <UserRound />}
        {row.role && <span className="ad-player-role"><RoleIcon role={row.role} /></span>}
      </span>
      <span className="ad-player-name"><strong>{row.name}</strong><span>{champion || t("Champion inconnu")}</span></span>
      <span className="ad-player-kda" aria-label={t("Éliminations / morts / assistances")}>
        {number(row.kills)}<i>/</i><b>{number(row.deaths)}</b><i>/</i>{number(row.assists)}
      </span>
    </div>
    <dl className="ad-player-stats">
      <div><dt>{t("Or")}</dt><dd>{compact(row.gold)}</dd></div>
      <div><dt>{t("Dégâts")}</dt><dd>{compact(row.damage)}</dd></div>
      <div><dt>{t("Vision")}</dt><dd>{number(row.vision)}</dd></div>
      <div><dt>{t("Sbires")}</dt><dd>{number(row.cs)}</dd></div>
    </dl>
    <div className="ad-player-foot">
      {enemy && <span className="ad-chip" data-tone={toneOf(goldDiff)}>
        <span className="ad-chip-portrait" aria-hidden="true">{enemy.champion ? <ChampionPortrait champion={enemy.champion} alt="" /> : <UserRound />}</span>
        {t("Or face à son adversaire")} <strong>{signed(goldDiff)}</strong>
      </span>}
      {catches && catches.count > 0 && <span className="ad-chip" data-tone="negative" title={catches.times}>
        <AlertTriangle aria-hidden="true" />{t("Morts sans échange")} <strong>{catches.count}</strong>
      </span>}
    </div>
  </li>;
}

function DebriefContent({ snapshot }) {
  const coach = snapshot.coach;
  const allies = snapshot.participants.filter((row) => row.teamKey === "ALLY");
  const enemies = snapshot.participants.filter((row) => row.teamKey === "ENEMY");
  const hasSignal = ["gold", "damage", "vision"].some((key) => finite(snapshot.facts[key]?.diff));
  const calls = [
    { id: "keep", Icon: Check, title: "À garder", text: coach.keep },
    { id: "fix", Icon: AlertTriangle, title: "À corriger", text: coach.correct },
    { id: "standard", Icon: Target, title: "Standard attendu", text: coach.standard },
  ];
  return <div className="ad-content">
    <section className="ad-verdict" data-tone={coach.mainSignal.toneName}>
      {hasSignal ? <div className="ad-signal">
        <span>{t(SIGNAL_LABELS[coach.mainSignal.label] || "Écart d’or final")}</span>
        <strong>{coach.mainSignal.value}</strong>
        <small>{t("Notre équipe − adversaires")}</small>
      </div> : <div className="ad-signal"><span>{t("Statistiques incomplètes")}</span></div>}
      <p>{coachText(coach.action)}</p>
    </section>

    <ul className="ad-calls">
      {calls.map(({ id, Icon, title, text }) => <li key={id} data-tone={id}>
        <h5><span aria-hidden="true"><Icon /></span>{t(title)}</h5>
        <p>{coachText(text)}</p>
      </li>)}
    </ul>

    {allies.length > 0 && <section className="ad-section">
      <h5 className="ad-heading"><Users aria-hidden="true" />{t("Nos joueurs")}</h5>
      <ol className="ad-players">
        {allies.map((row, index) => <PlayerCard key={`${row.participantId}-${index}`} row={row}
          enemy={row.role ? enemies.find((item) => item.role === row.role) : null}
          read={coach.playerReads.find((item) => item.name === row.name && item.role === (row.role || "Rôle inconnu"))} />)}
      </ol>
    </section>}

    <div className="ad-review">
      <section className="ad-section">
        <h5 className="ad-heading"><Eye aria-hidden="true" />{t("À revoir en vidéo")}</h5>
        <ol className="ad-checkpoints">{coach.vodCheckpoints.map((item) => <li key={item}>{coachText(item)}</li>)}</ol>
      </section>
      <section className="ad-section">
        <h5 className="ad-heading"><Route aria-hidden="true" />{t("Plan d’exécution")}</h5>
        <ol className="ad-plan">{coach.executionPlan.map((item, index) => {
          const text = coachText(item);
          const split = /^[^:]{2,24}?\s?:\s*(.+)$/s.exec(text);
          const body = split ? split[1].charAt(0).toUpperCase() + split[1].slice(1) : text;
          return <li key={item}><span className="ad-plan-step">{PLAN_STEPS[index] ? t(PLAN_STEPS[index]) : index + 1}</span><p>{body}</p></li>;
        })}</ol>
      </section>
    </div>

    <section className="ad-section">
      <h5 className="ad-heading"><MessageCircleQuestion aria-hidden="true" />{t("Questions pour le débrief")}</h5>
      <ul className="ad-questions">{coach.coachQuestions.map((item) => <li key={item}>{coachText(item)}</li>)}</ul>
    </section>
    <p className="ad-validation"><CircleCheck aria-hidden="true" />{coachText(coach.validation)}</p>
  </div>;
}

/** One automatic debrief per game: the coaching read and the imported player data together. */
export default function AutoDebrief({ snapshot, report }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const date = new Date(report?.created_at || "");
  const description = [
    Number.isFinite(date.getTime()) && date.toLocaleDateString(getLocale()),
    t("Analyse automatique"),
  ].filter(Boolean).join(" · ");
  return <ReadingDetails className="auto-debrief" onToggle={(event) => setOpen(event.currentTarget.open)}
    title={<span className="ad-title"><Sparkles aria-hidden="true" />{t("Débrief automatique de la partie")}</span>} description={description}>
    {open && <DebriefContent snapshot={snapshot} />}
  </ReadingDetails>;
}
