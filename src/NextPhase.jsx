import { useLanguage } from "./i18n/useLanguage.js";
import { t } from "./i18n/translate.js";
import { getLocale } from "./i18n/locale.js";
import { availableNumber, resultSummary, resultLabel, sideResults } from "./utils/statistics.js";
import { csAtMinute } from "./utils/match-timeline.js";
import { importedGameSide } from "./utils/imported-games.js";
import { normalizeRole } from "../shared/roles.js";
import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Crown,
  Database,
  Eye,
  FileText,
  Gauge,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "./api/client.js";
import { Badge, Button, SelectInput, Surface, TextInput } from "./components/ui/Core.jsx";
import { RoleIcon } from "./components/brand/BrandAssets.jsx";
import "./components/trends/block-comparison.css";
import "./pages/workspace/profile-goals.css";
import { sortTrendMatches, trendMatchTimestamp } from "./utils/trends.js";

const ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const METRICS = {
  deaths: { label: "Morts / game", unit: "", defaultOperator: "lte", defaultTarget: 3.5 },
  kp: { label: "Kill participation", unit: "%", defaultOperator: "gte", defaultTarget: 60 },
  kda: { label: "KDA", unit: "", defaultOperator: "gte", defaultTarget: 3 },
  vision: { label: "Vision / game", unit: "", defaultOperator: "gte", defaultTarget: 30 },
  cs10: { label: "CS à 10 minutes", unit: "", defaultOperator: "gte", defaultTarget: 75 },
};

function cx(...values) {
  return values.filter(Boolean).join(" ");
}

function openRoute(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function parsePercent(value) {
  const percent = typeof value === "string" && value.includes("%");
  const number = availableNumber(percent ? value.replace("%", "") : value);
  return number === null ? null : percent || number > 1 ? number : number * 100;
}

function matchName(match) {
  return match?.raw?.nxt5Label || match?.opponent || match?.game_id || "Game";
}

function formatDate(value, withTime = false) {
  if (!value) return "Date à définir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date à définir";
  return date.toLocaleString(getLocale(), withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function teamRows(match, teamKey = "ALLY") {
  return (match?.participants || []).filter((row) => row.team_key === teamKey);
}

function sum(rows, key) {
  const values = rows.map((row) => availableNumber(row?.[key]));
  return rows.length === 5 && values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;
}

function matchDiff(match, key) {
  const ally = sum(teamRows(match), key);
  const enemy = sum(teamRows(match, "ENEMY"), key);
  return ally === null || enemy === null ? null : ally - enemy;
}

function hasTimeline(match) {
  const raw = match?.raw || {};
  const candidates = [raw.timeline?.info?.frames, raw.metadata?.timeline?.info?.frames, raw.timeline?.frames, raw.timelineFrames, raw.info?.timeline?.frames, raw.frames];
  return candidates.some((frames) => Array.isArray(frames) && frames.length > 0)
    || Boolean(raw.nxt5?.timelineSummary?.available)
    || Boolean(raw.nxt5?.timelineEvents?.length);
}

function toneForDelta(value, inverse = false) {
  if (!value) return "text-slate-400";
  const good = inverse ? value < 0 : value > 0;
  return good ? "text-emerald-200" : "text-rose-200";
}

function signed(value, suffix = "") {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${Number.isInteger(number) ? number : number.toFixed(1)}${suffix}`;
}

function Panel({ children, className = "" }) {
  useLanguage();
  return <Surface className={cx("!p-0", className)}>{children}</Surface>;
}

function Label({ children, tone = "cyan" }) {
  useLanguage();
  return <Badge tone={tone === "amber" ? "yellow" : tone}>{children}</Badge>;
}

function IconButton({ icon: Icon, label, onClick, danger = false, disabled = false }) {
  useLanguage();
  return <Button type="button" icon={Icon} title={t(label)} aria-label={t(label)} onClick={onClick} disabled={disabled} variant={danger ? "danger" : "ghost"} className="h-11 w-11 shrink-0 !px-0" />;
}

function ActionButton({ children, onClick, icon: Icon = ArrowRight, variant = "primary", disabled = false, type = "button", className = "" }) {
  useLanguage();
  return <Button type={type} onClick={onClick} disabled={disabled} variant={variant} icon={Icon} className={className}>{children}</Button>;
}

export function TeamDataHealthPanel({ team, players = [], matches = [] }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const teamPlayers = players.filter((player) => player.team_id === team?.id && ROLES.includes(normalizeRole(player.role)));
  const teamMatches = matches.filter((match) => match.team_id === team?.id);
  const counts = teamPlayers.map((player) => ({
    player,
    count: teamMatches.filter((match) => teamRows(match).some((row) => String(row.player_id || "") === String(player.id || ""))).length,
  }));
  const expected = Math.max(0, ...counts.map((item) => item.count));
  const missingRoles = ROLES.filter((role) => !teamPlayers.some((player) => normalizeRole(player.role) === role));
  const linkGaps = expected > 0 ? counts.filter((item) => item.count < expected) : [];
  const incomplete = teamMatches.filter((match) => teamRows(match).length !== 5 || teamRows(match, "ENEMY").length !== 5);
  const missingTimeline = teamMatches.filter((match) => !hasTimeline(match));
  const duplicateIds = Array.from(teamMatches.reduce((map, match) => {
    const key = String(match.game_id || "").trim();
    if (key) map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map()).entries()).filter(([, count]) => count > 1);
  const issues = [
    ...missingRoles.map((role) => ({ id: `role-${role}`, title: `Poste ${role} absent`, detail: "Le roster principal est incomplet.", path: "/gestion-equipe", icon: Users })),
    ...linkGaps.map(({ player, count }) => ({ id: `link-${player.id}`, title: `${player.name} : ${count}/${expected} games liées`, detail: "Une ou plusieurs games ne remontent pas dans ce profil.", path: `/mon-profil?player=${encodeURIComponent(player.id)}`, icon: RefreshCw })),
    ...(incomplete.length ? [{ id: "participants", title: `${incomplete.length} import${incomplete.length > 1 ? "s" : ""} incomplet${incomplete.length > 1 ? "s" : ""}`, detail: "Il manque un participant allié ou adverse.", path: `/games?match=${encodeURIComponent(incomplete[0].id)}`, icon: AlertTriangle }] : []),
    ...(missingTimeline.length ? [{ id: "timeline", title: `${missingTimeline.length} timeline${missingTimeline.length > 1 ? "s" : ""} absente${missingTimeline.length > 1 ? "s" : ""}`, detail: "Les stats finales restent lisibles, mais l’analyse temporelle est limitée.", path: "/games", icon: Clock3 }] : []),
    ...(duplicateIds.length ? [{ id: "duplicates", title: `${duplicateIds.length} Game ID en double`, detail: "Ces imports doivent être vérifiés.", path: "/games", icon: Database }] : []),
  ];
  const checks = 4 + ROLES.length;
  const score = Math.round(((checks - Math.min(checks, issues.length)) / checks) * 100);
  return <Panel>
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", issues.length ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100")}><ShieldCheck className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-black text-white">{t("Santé des données")}</span><span className="mt-1 block text-xs font-semibold text-slate-400">{issues.length ? t("{0} point{1} à vérifier avant de tirer des conclusions.", [issues.length, issues.length > 1 ? "s" : ""]) : t("Roster, profils et imports sont cohérents.")}</span></span>
      <span className="text-right"><span className={cx("block text-2xl font-black", score === 100 ? "text-emerald-200" : "text-amber-100")}>{score}%</span><span className="block text-xs font-semibold text-slate-500">{t("fiabilité")}</span></span>
      <ChevronRight className={cx("h-5 w-5 shrink-0 text-slate-400 transition", open && "rotate-90")} />
    </button>
    {open && <div className="border-t border-white/10 px-4 py-2 sm:px-5">
      {issues.length ? issues.map((issue) => <button key={issue.id} type="button" onClick={() => openRoute(issue.path)} className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.07] py-3 text-left last:border-b-0 hover:text-cyan-100">
        <issue.icon className="h-4 w-4 text-amber-100" /><span className="min-w-0"><span className="block text-sm font-black text-white">{t(issue.title)}</span><span className="mt-0.5 block text-xs font-semibold text-slate-400">{t(issue.detail)}</span></span><ArrowRight className="h-4 w-4 text-cyan-100" />
      </button>) : <div className="flex items-center gap-3 py-4 text-sm font-semibold text-emerald-100"><Check className="h-5 w-5" />{t(" Aucun correctif nécessaire.")}</div>}
    </div>}
  </Panel>;
}

function blockMatches(allMatches, categories, key) {
  const sorted = sortTrendMatches(allMatches);
  if (key === "recent") return sorted.slice(0, 5);
  if (key === "previous") return sorted.slice(5, 10);
  if (key === "all") return sorted;
  if (key.startsWith("category:")) {
    const id = key.slice(9);
    return sorted.filter((match) => [...(Array.isArray(match.category_ids) ? match.category_ids : []), match.category_id].some((value) => String(value || "") === id));
  }
  return sorted;
}

function blockSnapshot(matches) {
  const results = resultSummary(matches);
  const allyRows = matches.flatMap((match) => teamRows(match));
  const average = (values) => {
    const available = values.filter((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)));
    return available.length ? available.reduce((total, value) => total + Number(value), 0) / available.length : null;
  };
  const sides = sideResults(matches);
  const side = (name) => sides.find((item) => item.side === name)?.winrate ?? null;
  const roles = ROLES.map((role) => {
    const rows = allyRows.filter((row) => normalizeRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition) === role);
    return { role, games: rows.length, kp: average(rows.map((row) => {
      const value = row.kill_participation ?? row.kp;
      return value === null || value === undefined || value === "" ? null : parsePercent(value);
    })), deaths: average(rows.map((row) => row.deaths)), cs: average(rows.map((row) => row.cs)) };
  });
  return {
    ...results,
    wr: results.winrate,
    blue: side("blue"),
    red: side("red"),
    gold: average(matches.map((match) => matchDiff(match, "gold"))),
    damage: average(matches.map((match) => matchDiff(match, "damage"))),
    vision: average(matches.map((match) => matchDiff(match, "vision"))),
    deaths: average(matches.map((match) => sum(teamRows(match), "deaths"))),
    roles,
  };
}

function blockOverlapCount(leftMatches, rightMatches) {
  const key = (match) => String(match.game_id || match.match_id || match.id || "") || match;
  const leftKeys = new Set(leftMatches.map(key));
  return new Set(rightMatches.map(key).filter((id) => leftKeys.has(id))).size;
}

function blockDateRange(matches) {
  const timestamps = matches.map(trendMatchTimestamp).filter(Number.isFinite);
  if (!timestamps.length) return "Dates indisponibles";
  const first = formatDate(Math.min(...timestamps));
  const last = formatDate(Math.max(...timestamps));
  const range = first === last ? first : `${first} → ${last}`;
  const missing = matches.length - timestamps.length;
  return missing ? `${range} · ${t(missing > 1 ? "{0} dates inconnues" : "{0} date inconnue", [missing])}` : range;
}

function blockMetric(value, suffix = "", digits = 0) {
  return Number.isFinite(value) ? `${Number(value.toFixed(digits)).toLocaleString(getLocale())}${t(suffix)}` : "—";
}

function blockDelta(before, after) {
  return Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
}

function BlockComparisonRows({ rows }) {
  useLanguage();
  return <div className="block-comparison-rows">
    <div className="block-comparison-columns" aria-hidden="true"><span>{t("Repère")}</span><span>{t("Référence")}</span><span>{t("Observé")}</span><span>{t("Évolution")}</span></div>
    {rows.map(({ label, detail, before, after, suffix = "", digits = 0, deltaSuffix = "", delta: rawDelta, inverse = false, role, beforeDetail, afterDetail }) => {
      const roundedBefore = Number.isFinite(before) ? Number(before.toFixed(digits)) : null;
      const roundedAfter = Number.isFinite(after) ? Number(after.toFixed(digits)) : null;
      const delta = rawDelta !== undefined ? rawDelta : blockDelta(roundedBefore, roundedAfter);
      const change = Number.isFinite(delta) ? delta === 0 ? "Stable" : (inverse ? delta < 0 : delta > 0) ? "Favorable" : "Défavorable" : "Indisponible";
      return <div key={label} className="block-comparison-row">
        <div className="block-comparison-metric">
          {role && <span aria-hidden="true"><RoleIcon role={role} className="h-6 w-6" lightweight /></span>}
          <div><h5>{t(label)}</h5>{detail && <p>{t(detail)}</p>}</div>
        </div>
        <dl className="block-comparison-values">
          <div><dt>{t("Référence")}</dt><dd>{blockMetric(before, suffix, digits)}{beforeDetail && <small>{t(beforeDetail)}</small>}</dd></div>
          <div><dt>{t("Observé")}</dt><dd className="block-comparison-observed">{blockMetric(after, suffix, digits)}{afterDetail && <small>{t(afterDetail)}</small>}</dd></div>
          <div><dt>{t("Évolution")}</dt><dd className={toneForDelta(delta, inverse)}>{Number.isFinite(delta) ? `${delta > 0 ? "+" : ""}${blockMetric(delta, deltaSuffix, digits)}` : "—"}<small>{t(change)}</small></dd></div>
        </dl>
      </div>;
    })}
  </div>;
}

export function BlockComparisonPanel({ matches = [], categories = [] }) {
  useLanguage();
  const [leftKey, setLeftKey] = useState("previous");
  const [rightKey, setRightKey] = useState("recent");
  const options = [{ value: "previous", label: "5 parties précédentes" }, { value: "recent", label: "5 dernières parties" }, { value: "all", label: "Toutes les parties" }, ...categories.map((category) => ({ value: `category:${category.id}`, label: category.name }))];
  const referenceKey = options.some((option) => option.value === leftKey) ? leftKey : "previous";
  const observedKey = options.some((option) => option.value === rightKey) ? rightKey : "recent";
  const leftMatches = blockMatches(matches, categories, referenceKey);
  const rightMatches = blockMatches(matches, categories, observedKey);
  const left = blockSnapshot(leftMatches);
  const right = blockSnapshot(rightMatches);
  const overlap = blockOverlapCount(leftMatches, rightMatches);
  const gameCount = (count) => t(count > 1 ? "{0} parties" : "{0} partie", [count]);
  const sideCount = (games, side) => resultLabel(resultSummary(games.filter((match) => importedGameSide(match) === side)));
  const metrics = [
    { label: "Taux de victoire", detail: "Victoires / résultats connus", beforeDetail: resultLabel(left), afterDetail: resultLabel(right), before: left.wr, after: right.wr, suffix: "%", deltaSuffix: " pts" },
    { label: "Écart d’or moyen", detail: "Notre équipe − adversaire · or / partie", before: left.gold, after: right.gold, deltaSuffix: " or" },
    { label: "Écart de dégâts moyen", detail: "Notre équipe − adversaire · dégâts / partie", before: left.damage, after: right.damage, deltaSuffix: " dég." },
    { label: "Écart de vision moyen", detail: "Notre équipe − adversaire · score / partie", before: left.vision, after: right.vision, deltaSuffix: " pts" },
    { label: "Morts de l’équipe", detail: "Moyenne / partie · moins est favorable", before: left.deaths, after: right.deaths, inverse: true, digits: 1 },
  ];
  const roleMetrics = right.roles.map((role) => {
    const previous = left.roles.find((item) => item.role === role.role);
    return { label: role.role, role: role.role, before: previous?.kp, after: role.kp, suffix: "%", digits: 1, deltaSuffix: " pts", delta: blockDelta(previous?.kp, role.kp), beforeDetail: gameCount(previous?.games || 0), afterDetail: gameCount(role.games) };
  });
  const sideMetrics = [
    { label: "Côté bleu", before: left.blue, after: right.blue, suffix: "%", deltaSuffix: " pts", beforeDetail: sideCount(leftMatches, "blue"), afterDetail: sideCount(rightMatches, "blue") },
    { label: "Côté rouge", before: left.red, after: right.red, suffix: "%", deltaSuffix: " pts", beforeDetail: sideCount(leftMatches, "red"), afterDetail: sideCount(rightMatches, "red") },
  ];
  return <Panel className="block-comparison">
    <div className="block-comparison-heading">
      <h3>{t("Ce qui change entre deux sélections")}</h3>
      <p>{t("Choisis une référence à gauche, puis les parties à observer à droite. Les filtres de période et de catégorie des autres rubriques ne s’appliquent pas ici.")}</p>
    </div>
    <div className="block-comparison-selection">
      {[{ label: "Bloc de référence", key: referenceKey, setKey: setLeftKey, games: leftMatches, snapshot: left }, { label: "Bloc observé", key: observedKey, setKey: setRightKey, games: rightMatches, snapshot: right }].map(({ label, key, setKey, games, snapshot }) => <div key={label} className="block-comparison-selector">
        <SelectInput label={t(label)} value={key} onChange={setKey}>{options.map((option) => <option key={option.value} value={option.value}>{option.value.startsWith("category:") ? option.label : t(option.label)}</option>)}</SelectInput>
        <p className="block-comparison-sample"><strong>{t(gameCount(snapshot.games))}</strong><span>{games.length ? blockDateRange(games) : t("Aucune partie dans ce bloc")}</span></p>
      </div>)}
      <Button type="button" variant="ghost" icon={RefreshCw} onClick={() => { setLeftKey(observedKey); setRightKey(referenceKey); }} className="block-comparison-swap">{t("Inverser les blocs")}</Button>
    </div>
    <div className="block-comparison-context" aria-live="polite">
      {(!left.games || !right.games) ? <p className="block-comparison-notice"><AlertTriangle aria-hidden="true" /><span>{t("Sélectionne deux blocs non vides pour calculer les écarts.")}{(referenceKey === "previous" && !left.games) || (observedKey === "previous" && !right.games) ? t(" Le bloc précédent apparaît à partir de la 6e partie.") : ""}</span></p> : overlap > 0 ? <p className="block-comparison-notice"><AlertTriangle aria-hidden="true" /><span>{overlap}{t(overlap > 1 ? " parties" : " partie")}{t(overlap > 1 ? " communes" : " commune")}{t(" aux deux blocs : les échantillons se recouvrent.")}</span></p> : <p>{t("Aucune partie commune aux deux blocs.")}</p>}
      <p><strong>{t("Évolution = bloc observé − référence.")}</strong>{t(" Les taux évoluent en points de pourcentage. Les parties sont classées par date de jeu.")}</p>
    </div>
    <div className="block-comparison-section">
      <h4>{t("Résultats de l’équipe")}</h4>
      <p className="block-comparison-description">{t("Les écarts d’or, de dégâts et de vision mesurent l’avance sur l’adversaire en fin de partie.")}</p>
      <BlockComparisonRows rows={metrics} />
    </div>
    <div className="block-comparison-secondary">
      <section className="block-comparison-section block-comparison-roles">
        <h4>{t("Participation aux kills par rôle")}</h4>
        <p className="block-comparison-description">{t("Part des éliminations de l’équipe auxquelles le joueur participe (KP), en moyenne. Le nombre de parties précise l’échantillon de chaque rôle.")}</p>
        <BlockComparisonRows rows={roleMetrics} />
      </section>
      <section className="block-comparison-section block-comparison-sides">
        <h4>{t("Taux de victoire par côté")}</h4>
        <p className="block-comparison-description">{t("Compare les résultats sur le côté bleu et sur le côté rouge.")}</p>
        <BlockComparisonRows rows={sideMetrics} />
      </section>
    </div>
    <p className="block-comparison-footnote">{t("— : donnée indisponible. « Favorable » indique le sens de la variation ; tiens compte du nombre de parties et des adversaires avant de conclure.")}</p>
  </Panel>;
}

function reviewReason(match) {
  const deaths = sum(teamRows(match), "deaths");
  const gold = matchDiff(match, "gold");
  if (match.result === "Défaite" && gold < -3000) return `Défaite · ${Math.abs(Math.round(gold / 100) * 100).toLocaleString(getLocale())} or de retard`;
  if (deaths >= 20) return `${deaths} morts alliées à classer`;
  if (!hasTimeline(match)) return "Timeline absente · lecture finale uniquement";
  return match.result === "Défaite" ? "Défaite à revoir" : "Victoire à revoir";
}

export function ReviewQueuePanel({ matches = [], reports = [], selectedTeamId, refreshAll, pushToast, onStartReview, onOpenReview }) {
  useLanguage();
  const [busyId, setBusyId] = useState("");
  const [showDone, setShowDone] = useState(false);
  const queue = [...matches].filter((match) => String(match.review_status || "todo") !== "done").sort((a, b) => (a.result === "Défaite" ? -1 : 1) - (b.result === "Défaite" ? -1 : 1) || new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const doneMatches = [...matches].filter((match) => String(match.review_status || "todo") === "done").sort((a, b) => new Date(b.reviewed_at || b.created_at || 0) - new Date(a.reviewed_at || a.created_at || 0));
  const visibleMatches = showDone ? doneMatches : queue;
  async function setStatus(match, status) {
    setBusyId(match.id);
    try {
      await apiFetch("matches-manage", { method: "POST", body: JSON.stringify({ action: "review-status", teamId: selectedTeamId, matchId: match.id, status }) });
      await refreshAll();
      pushToast?.({ type: "green", title: status === "done" ? "Review terminée" : "Game rouverte", text: matchName(match) });
    } catch (error) {
      pushToast?.({ type: "red", title: "Mise à jour impossible", text: error.message });
    } finally {
      setBusyId("");
    }
  }
  return <Panel className="mb-5">
    <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><Label tone={showDone ? "green" : queue.length ? "amber" : "green"}>{showDone ? t("Historique") : t("File de review")}</Label><h3 className="mt-3 text-2xl font-black text-white">{showDone ? t("{0} review{1} terminée{2}", [doneMatches.length, doneMatches.length > 1 ? "s" : "", doneMatches.length > 1 ? "s" : ""]) : queue.length ? t("{0} game{1} à traiter", [queue.length, queue.length > 1 ? "s" : ""]) : t("File à jour")}</h3><p className="mt-1 text-sm font-semibold text-slate-400">{showDone ? t("Une erreur de classement reste réversible.") : t("Ouvre la source, prends une décision, puis marque-la terminée.")}</p></div><ActionButton variant="ghost" icon={showDone ? ArrowRight : ClipboardCheck} onClick={() => setShowDone((value) => !value)}>{showDone ? t("Retour à la file") : t("{0} terminée{1}", [doneMatches.length, doneMatches.length > 1 ? "s" : ""])}</ActionButton></div>
    {visibleMatches.length ? <div className="divide-y divide-white/[0.07]">{visibleMatches.slice(0, 8).map((match) => {
      const linkedReport = reports.find((report) => [report.match_id, ...(Array.isArray(report.match_ids) ? report.match_ids : [])].some((id) => String(id || "") === String(match.id)));
      return <div key={match.id} className="grid gap-3 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><button type="button" onClick={() => openRoute(`/games?match=${encodeURIComponent(match.id)}`)} className="min-w-0 text-left"><span className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-black text-white">{matchName(match)}</span><Label tone={match.result === "Victoire" ? "green" : "red"}>{t(match.result) || t("Analyse")}</Label>{linkedReport && <span className="text-xs font-semibold text-cyan-100">{t("Review créée")}</span>}</span><span className="mt-1 block text-xs font-semibold text-slate-400">{showDone ? t("Terminée {0}", [formatDate(match.reviewed_at || match.created_at)]) : `${t(reviewReason(match))} · ${formatDate(match.created_at)}`}</span></button><div className="flex flex-wrap gap-2"><ActionButton variant="ghost" icon={Eye} onClick={() => openRoute(`/games?match=${encodeURIComponent(match.id)}`)}>{t("Source")}</ActionButton><ActionButton variant="ghost" icon={linkedReport ? ArrowRight : FileText} onClick={() => linkedReport ? onOpenReview?.(linkedReport) : onStartReview(match)}>{linkedReport ? t("Ouvrir la review") : t("Créer la review")}</ActionButton><ActionButton variant="ghost" icon={busyId === match.id ? RefreshCw : showDone ? RefreshCw : Check} disabled={Boolean(busyId)} onClick={() => setStatus(match, showDone ? "todo" : "done")}>{showDone ? t("Rouvrir") : t("Terminé")}</ActionButton></div></div>;
    })}</div> : <div className="flex items-center gap-3 p-5 text-sm font-semibold text-emerald-100"><ClipboardCheck className="h-5 w-5" /> {showDone ? t("Aucune review terminée.") : t("Toutes les games importées ont été traitées.")}</div>}
  </Panel>;
}


export function goalMetricValue(row, metric) {
  if (metric === "deaths" || metric === "vision") return availableNumber(row[metric]);
  if (metric === "kp") return parsePercent(row.kill_participation ?? row.kp);
  if (metric === "kda") {
    const values = [row.kills, row.assists, row.deaths].map(availableNumber);
    return values.every(Number.isFinite) ? (values[0] + values[1]) / Math.max(1, values[2]) : null;
  }
  if (metric === "cs10") return csAtMinute(row, 10);
  return null;
}

export function evaluateGoal(goal, rows) {
  const started = new Date(goal.starts_at || goal.created_at || 0).getTime();
  const unique = Array.from(rows.reduce((map, row) => {
    const key = String(row.match?.id || row.match?.game_id || "");
    const time = new Date(row.match?.created_at || 0).getTime();
    if (key && time >= started && !map.has(key)) map.set(key, row);
    return map;
  }, new Map()).values()).sort((a, b) => new Date(a.match?.created_at || 0) - new Date(b.match?.created_at || 0)).slice(0, Number(goal.sample_size || 3));
  const values = unique.map((row) => goalMetricValue(row, goal.metric));
  const successes = values.filter((value) => Number.isFinite(value) && (goal.operator === "lte" ? value <= Number(goal.target_value) : value >= Number(goal.target_value))).length;
  const required = Number(goal.required_successes || 2);
  const pending = Number(goal.sample_size || 3) - values.length;
  const missing = values.filter(value => !Number.isFinite(value)).length;
  const complete = successes >= required;
  const impossible = successes + pending + missing < required;
  return { rows: unique, values, successes, required, pending, missing, complete, impossible,
    inconclusive: pending === 0 && !complete && !impossible };
}

export function PlayerGoalsPanel({ goals = [], rows = [], player, selectedTeamId, canManage, refreshAll, pushToast }) {
  useLanguage();
  const metricLabels = { deaths: "Morts par partie", kp: "Participation aux éliminations (KP)", kda: "Ratio KDA", vision: "Score de vision par partie", cs10: "Sbires et monstres à 10 minutes (CS)" };
  const activeGoals = goals.filter((goal) => goal.player_id === player?.id && goal.status !== "archived");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", metric: "deaths", operator: "lte", targetValue: 3.5, sampleSize: 3, requiredSuccesses: 2 });
  function setMetric(metric) {
    const config = METRICS[metric];
    setForm((current) => ({ ...current, metric, operator: config.defaultOperator, targetValue: config.defaultTarget, title: "" }));
  }
  async function create(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const metric = METRICS[form.metric];
      const title = form.title.trim() || `${form.operator === "lte" ? "Limiter" : "Atteindre"} ${metric.label.toLowerCase()}`;
      await apiFetch("player-goals-manage", { method: "POST", body: JSON.stringify({ action: "create", teamId: selectedTeamId, playerId: player.id, ...form, title }) });
      await refreshAll(); setCreating(false); pushToast?.({ type: "green", title: "Objectif lancé", text: `Suivi sur les ${form.sampleSize} prochaines parties.` });
    } catch (error) { pushToast?.({ type: "red", title: "Création impossible", text: error.message }); }
    finally { setSaving(false); }
  }
  async function archive(goal) {
    setSaving(true);
    try { await apiFetch("player-goals-manage", { method: "POST", body: JSON.stringify({ action: "archive", teamId: selectedTeamId, goalId: goal.id }) }); await refreshAll(); }
    catch (error) { pushToast?.({ type: "red", title: "Archivage impossible", text: error.message }); }
    finally { setSaving(false); }
  }
  return <Panel className="profile-goal-panel">
    <header className="profile-goal-heading">
      <div><p className="profile-goal-eyebrow">{t("Suivi joueur")}</p><h3>{t("Objectifs mesurés sur les prochaines parties")}</h3><p>{t("Les parties importées permettent de suivre chaque cible. Seules les parties importées après le début de l’objectif sont comptées.")}</p></div>
      {canManage && <ActionButton variant={creating ? "ghost" : "primary"} icon={creating ? X : Plus} onClick={() => setCreating((value) => !value)}>{creating ? t("Fermer") : t("Nouvel objectif")}</ActionButton>}
    </header>
    {creating && <form onSubmit={create} className="profile-goal-form">
      <SelectInput label={t("Mesure à suivre")} value={form.metric} onChange={setMetric}>{Object.entries(METRICS).map(([id, item]) => <option key={id} value={id}>{t(metricLabels[id]) || t(item.label)}</option>)}</SelectInput>
      <TextInput label={t("Nom")} value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder={t("Ex. Mieux préparer les objectifs")} />
      <TextInput label={form.operator === "lte" ? t("Maximum par partie") : t("Minimum par partie")} type="number" step="0.1" value={form.targetValue} onChange={(value) => setForm({ ...form, targetValue: Number(value) })} />
      <SelectInput label={t("Parties où atteindre la cible")} value={form.requiredSuccesses} onChange={(value) => setForm({ ...form, requiredSuccesses: Number(value) })}><option value="1">1 / 3</option><option value="2">2 / 3</option><option value="3">3 / 3</option></SelectInput>
      <div className="profile-goal-form-action"><p>{t("La cible sera évaluée sur les ")}{form.sampleSize}{t(" prochaines parties.")}</p><ActionButton type="submit" icon={saving ? RefreshCw : Target} disabled={saving}>{saving ? t("Lancement…") : t("Lancer")}</ActionButton></div>
    </form>}
    {activeGoals.length ? <div className="profile-goal-list">{activeGoals.map((goal) => {
      const result = evaluateGoal(goal, rows);
      const metric = METRICS[goal.metric] || METRICS.deaths;
      return <article key={goal.id} className="profile-goal-row">
        <div className="profile-goal-identity"><div className="profile-goal-status"><Label tone={result.complete ? "green" : result.impossible ? "red" : result.inconclusive ? "slate" : "cyan"}>{result.complete ? t("Validé") : result.impossible ? t("À ajuster") : result.inconclusive ? t("Non concluable (données manquantes)") : t("En cours")}</Label><span>{result.successes}/{result.required}{t(" réussites")}</span></div><h4>{goal.title}</h4><p>{t(metricLabels[goal.metric]) || t(metric.label)} {goal.operator === "lte" ? "≤" : "≥"} {Number(goal.target_value)}{metric.unit} · {goal.required_successes}/{goal.sample_size}{t(" parties")}</p></div>
        <div className="profile-goal-progress"><div className="profile-goal-samples">{Array.from({ length: Number(goal.sample_size || 3) }, (_, index) => {
          const value = result.values[index];
          const success = Number.isFinite(value) && (goal.operator === "lte" ? value <= Number(goal.target_value) : value >= Number(goal.target_value));
          return <div key={index} className={cx("profile-goal-sample", !Number.isFinite(value) ? "is-pending" : success ? "is-success" : "is-missed")}><span>{t("Partie ")}{index + 1}</span><strong>{!Number.isFinite(value) ? "—" : `${Number(value).toFixed(goal.metric === "deaths" || goal.metric === "vision" || goal.metric === "cs10" ? 0 : 1)}${metric.unit}`}</strong><small>{value === undefined ? t("À jouer") : value === null ? t("Indisponible") : success ? t("Cible atteinte") : t("Hors cible")}</small></div>;
        })}</div><p>{t("Parties depuis le ")}{formatDate(goal.starts_at || goal.created_at)}</p></div>
        {canManage && <IconButton icon={Trash2} label={t("Archiver l'objectif")} danger disabled={saving} onClick={() => archive(goal)} />}
      </article>;
    })}</div> : <div className="profile-goal-empty"><CircleDot aria-hidden="true" /><div><h4>{t("Aucun objectif actif pour ce profil.")}</h4><p>{canManage ? t("Crée une cible mesurable pour suivre les prochaines parties du joueur.") : t("Les objectifs définis par les responsables de l’équipe apparaîtront ici.")}</p></div></div>}
  </Panel>;
}

export const workflowTestables = { blockMatches, blockSnapshot, blockOverlapCount, blockDateRange, blockDelta, evaluateGoal, hasTimeline, reviewReason };
