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
  deaths: { label: "Morts / game", unit: "", decimals: 0, defaultOperator: "lte", defaultTarget: 3.5, group: "Combat" },
  kp: { label: "Kill participation", unit: "%", decimals: 0, defaultOperator: "gte", defaultTarget: 60, group: "Combat" },
  kda: { label: "KDA", unit: "", decimals: 1, defaultOperator: "gte", defaultTarget: 3, group: "Combat" },
  damage_share: { label: "Part des dégâts de l’équipe", unit: "%", decimals: 0, defaultOperator: "gte", defaultTarget: 25, group: "Combat" },
  dpm: { label: "Dégâts aux champions par minute", unit: "", decimals: 0, defaultOperator: "gte", defaultTarget: 600, group: "Combat" },
  cs10: { label: "CS à 10 minutes", unit: "", decimals: 0, defaultOperator: "gte", defaultTarget: 75, group: "Ressources" },
  cs15: { label: "CS à 15 minutes", unit: "", decimals: 0, defaultOperator: "gte", defaultTarget: 115, group: "Ressources" },
  cs_min: { label: "CS par minute", unit: "", decimals: 1, defaultOperator: "gte", defaultTarget: 7.5, group: "Ressources" },
  gold_min: { label: "Or par minute", unit: "", decimals: 0, defaultOperator: "gte", defaultTarget: 400, group: "Ressources" },
  vision: { label: "Vision / game", unit: "", decimals: 0, defaultOperator: "gte", defaultTarget: 30, group: "Vision" },
  vision_min: { label: "Score de vision par minute", unit: "", decimals: 1, defaultOperator: "gte", defaultTarget: 1.5, group: "Vision" },
  control_wards: { label: "Balises de contrôle posées", unit: "", decimals: 0, defaultOperator: "gte", defaultTarget: 3, group: "Vision" },
};
const GOAL_METRIC_LABELS = {
  deaths: "Morts par partie",
  kp: "Participation aux éliminations (KP)",
  kda: "Ratio KDA",
  damage_share: "Part des dégâts de l’équipe",
  dpm: "Dégâts aux champions par minute",
  cs10: "Sbires et monstres à 10 minutes (CS)",
  cs15: "Sbires et monstres à 15 minutes (CS)",
  cs_min: "Sbires et monstres par minute (CS/min)",
  gold_min: "Or gagné par minute",
  vision: "Score de vision par partie",
  vision_min: "Score de vision par minute",
  control_wards: "Balises de contrôle posées",
};
const GOAL_SUGGESTIONS = {
  TOP: [
    { metric: "cs10", operator: "gte", targetValue: 70, title: "Tenir la vague jusqu’à 10 minutes" },
    { metric: "deaths", operator: "lte", targetValue: 4, title: "Survivre en side lane" },
    { metric: "damage_share", operator: "gte", targetValue: 22, title: "Peser dans les combats" },
  ],
  JGL: [
    { metric: "kp", operator: "gte", targetValue: 65, title: "Être présent sur la carte" },
    { metric: "control_wards", operator: "gte", targetValue: 3, title: "Contrôler la vision des objectifs" },
    { metric: "deaths", operator: "lte", targetValue: 4, title: "Limiter les morts en invade" },
  ],
  MID: [
    { metric: "cs_min", operator: "gte", targetValue: 8, title: "Farmer entre les rotations" },
    { metric: "kp", operator: "gte", targetValue: 60, title: "Suivre les rotations" },
    { metric: "dpm", operator: "gte", targetValue: 600, title: "Mettre la pression en dégâts" },
  ],
  ADC: [
    { metric: "cs_min", operator: "gte", targetValue: 8.5, title: "Optimiser le farm" },
    { metric: "deaths", operator: "lte", targetValue: 3, title: "Rester en vie en teamfight" },
    { metric: "damage_share", operator: "gte", targetValue: 27, title: "Porter les dégâts de l’équipe" },
  ],
  SUP: [
    { metric: "vision_min", operator: "gte", targetValue: 2.5, title: "Éclairer la carte" },
    { metric: "control_wards", operator: "gte", targetValue: 4, title: "Investir dans les balises de contrôle" },
    { metric: "kp", operator: "gte", targetValue: 65, title: "Accompagner chaque action" },
  ],
  DEFAULT: [
    { metric: "deaths", operator: "lte", targetValue: 3.5, title: "Limiter les morts" },
    { metric: "kp", operator: "gte", targetValue: 60, title: "Participer aux combats" },
    { metric: "cs_min", operator: "gte", targetValue: 7.5, title: "Régulariser le farm" },
  ],
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
  return <Badge tone={tone === "amber" ? "warning" : tone}>{children}</Badge>;
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
    ...missingRoles.map((role) => ({ id: `role-${role}`, title: `Poste ${role} absent`, detail: "L’effectif principal est incomplet.", path: "/gestion-equipe", icon: Users })),
    ...linkGaps.map(({ player, count }) => ({ id: `link-${player.id}`, title: `${player.name} : ${count}/${expected} games liées`, detail: "Une ou plusieurs parties n’apparaissent pas dans ce profil.", path: `/mon-profil?player=${encodeURIComponent(player.id)}`, icon: RefreshCw })),
    ...(incomplete.length ? [{ id: "participants", title: `${incomplete.length} import${incomplete.length > 1 ? "s" : ""} incomplet${incomplete.length > 1 ? "s" : ""}`, detail: "Il manque un participant allié ou adverse.", path: `/games?match=${encodeURIComponent(incomplete[0].id)}`, icon: AlertTriangle }] : []),
    ...(missingTimeline.length ? [{ id: "timeline", title: `${missingTimeline.length} timeline${missingTimeline.length > 1 ? "s" : ""} absente${missingTimeline.length > 1 ? "s" : ""}`, detail: "Les statistiques de fin de partie sont disponibles. L’absence de chronologie limite l’analyse du déroulement.", path: "/games", icon: Clock3 }] : []),
    ...(duplicateIds.length ? [{ id: "duplicates", title: `${duplicateIds.length} Game ID en double`, detail: "Ces imports doivent être vérifiés.", path: "/games", icon: Database }] : []),
  ];
  const checks = 4 + ROLES.length;
  const score = Math.round(((checks - Math.min(checks, issues.length)) / checks) * 100);
  return <Panel>
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="team-data-health-summary flex w-full items-center gap-4 p-4 text-left sm:p-5">
      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", issues.length ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100")}><ShieldCheck className="h-5 w-5" /></span>
      <span className="team-data-health-copy min-w-0 flex-1"><span className="block text-sm font-black text-white">{t("Vérification des données")}</span><span className="mt-1 block text-xs font-semibold text-slate-400">{issues.length ? t("{0} point{1} à vérifier avant de tirer des conclusions.", [issues.length, issues.length > 1 ? "s" : ""]) : t("Aucun problème détecté dans l’effectif, les profils et les imports.")}</span></span>
      <span className="team-data-health-score text-right"><span className={cx("block text-2xl font-black", score === 100 ? "text-emerald-200" : "text-amber-100")}>{score}%</span><span className="block text-xs font-semibold text-slate-500">{t("contrôles réussis")}</span></span>
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
    <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><Label tone={showDone ? "green" : queue.length ? "amber" : "green"}>{showDone ? t("Historique") : t("Débriefs à faire")}</Label><h3 className="mt-3 text-2xl font-black text-white">{showDone ? t("{0} review{1} terminée{2}", [doneMatches.length, doneMatches.length > 1 ? "s" : "", doneMatches.length > 1 ? "s" : ""]) : queue.length ? t("{0} game{1} à traiter", [queue.length, queue.length > 1 ? "s" : ""]) : t("File à jour")}</h3><p className="mt-1 text-sm font-semibold text-slate-400">{showDone ? t("Tu peux remettre une partie dans la liste des débriefs à faire.") : t("Ouvre une partie, prépare son débrief, puis marque-la comme traitée.")}</p></div><ActionButton variant="ghost" icon={showDone ? ArrowRight : ClipboardCheck} onClick={() => setShowDone((value) => !value)}>{showDone ? t("Retour à la file") : t("{0} terminée{1}", [doneMatches.length, doneMatches.length > 1 ? "s" : ""])}</ActionButton></div>
    {visibleMatches.length ? <div className="divide-y divide-white/[0.07]">{visibleMatches.slice(0, 8).map((match) => {
      const linkedReport = reports.find((report) => [report.match_id, ...(Array.isArray(report.match_ids) ? report.match_ids : [])].some((id) => String(id || "") === String(match.id)));
      return <div key={match.id} className="grid gap-3 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><button type="button" onClick={() => openRoute(`/games?match=${encodeURIComponent(match.id)}`)} className="min-w-0 text-left"><span className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-black text-white">{matchName(match)}</span><Label tone={match.result === "Victoire" ? "green" : "red"}>{t(match.result) || t("Analyse")}</Label>{linkedReport && <span className="text-xs font-semibold text-cyan-100">{t("Débrief créé")}</span>}</span><span className="mt-1 block text-xs font-semibold text-slate-400">{showDone ? t("Terminée {0}", [formatDate(match.reviewed_at || match.created_at)]) : `${t(reviewReason(match))} · ${formatDate(match.created_at)}`}</span></button><div className="flex flex-wrap gap-2"><ActionButton variant="ghost" icon={Eye} onClick={() => openRoute(`/games?match=${encodeURIComponent(match.id)}`)}>{t("Source")}</ActionButton><ActionButton variant="ghost" icon={linkedReport ? ArrowRight : FileText} onClick={() => linkedReport ? onOpenReview?.(linkedReport) : onStartReview(match)}>{linkedReport ? t("Ouvrir le débrief") : t("Créer le débrief")}</ActionButton><ActionButton variant="ghost" icon={busyId === match.id ? RefreshCw : showDone ? RefreshCw : Check} disabled={Boolean(busyId)} onClick={() => setStatus(match, showDone ? "todo" : "done")}>{showDone ? t("Rouvrir") : t("Terminé")}</ActionButton></div></div>;
    })}</div> : <div className="flex items-center gap-3 p-5 text-sm font-semibold text-emerald-100"><ClipboardCheck className="h-5 w-5" /> {showDone ? t("Aucun débrief terminé.") : t("Toutes les parties importées ont été traitées.")}</div>}
  </Panel>;
}


function goalDurationMinutes(row) {
  const match = row?.match;
  const seconds = Number(match?.raw?.info?.gameDuration || match?.game_duration || row?.raw?.timePlayed || 0);
  if (seconds > 0) return seconds / 60;
  const parts = String(match?.duration || "").match(/^(\d+):(\d{2})$/);
  return parts ? Number(parts[1]) + Number(parts[2]) / 60 : null;
}

function perMinute(value, row) {
  const minutes = goalDurationMinutes(row);
  return Number.isFinite(value) && minutes > 0 ? value / minutes : null;
}

export function goalMetricValue(row, metric) {
  const raw = row?.raw || {};
  const challenges = raw.challenges || {};
  if (metric === "deaths" || metric === "vision") return availableNumber(row[metric]);
  if (metric === "kp") return parsePercent(row.kill_participation ?? row.kp);
  if (metric === "kda") {
    const values = [row.kills, row.assists, row.deaths].map(availableNumber);
    return values.every(Number.isFinite) ? (values[0] + values[1]) / Math.max(1, values[2]) : null;
  }
  if (metric === "cs10") return csAtMinute(row, 10);
  if (metric === "cs15") return csAtMinute(row, 15);
  if (metric === "cs_min") {
    const direct = availableNumber(row.cs_per_min);
    if (Number.isFinite(direct)) return direct;
    const fromRaw = [raw.totalMinionsKilled, raw.neutralMinionsKilled].map(availableNumber);
    const cs = availableNumber(row.cs) ?? (fromRaw.every(Number.isFinite) ? fromRaw[0] + fromRaw[1] : null);
    return perMinute(cs, row);
  }
  if (metric === "gold_min") return availableNumber(challenges.goldPerMinute) ?? perMinute(availableNumber(row.gold ?? raw.goldEarned), row);
  if (metric === "dpm") return availableNumber(challenges.damagePerMinute) ?? perMinute(availableNumber(row.damage ?? raw.totalDamageDealtToChampions), row);
  if (metric === "vision_min") return availableNumber(challenges.visionScorePerMinute) ?? perMinute(availableNumber(row.vision ?? raw.visionScore), row);
  if (metric === "damage_share") {
    const share = availableNumber(challenges.teamDamagePercentage);
    return Number.isFinite(share) ? share * 100 : null;
  }
  if (metric === "control_wards") return availableNumber(challenges.controlWardsPlaced) ?? availableNumber(raw.visionWardsBoughtInGame);
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

function goalTargetText(goal, metric) {
  return `${goal.operator === "lte" ? "≤" : "≥"}\u00a0${Number(goal.target_value ?? goal.targetValue)}${metric.unit}`;
}

function goalStatus(result) {
  if (result.complete) return { tone: "green", label: "Validé", key: "complete" };
  if (result.impossible) return { tone: "red", label: "À ajuster", key: "impossible" };
  if (result.inconclusive) return { tone: "slate", label: "Données insuffisantes pour conclure", key: "inconclusive" };
  return { tone: "cyan", label: "En cours", key: "active" };
}

export function PlayerGoalsPanel({ goals = [], rows = [], player, selectedTeamId, canManage, refreshAll, pushToast }) {
  useLanguage();
  const activeGoals = goals.filter((goal) => goal.player_id === player?.id && goal.status !== "archived");
  const role = normalizeRole(player?.role);
  const suggestions = GOAL_SUGGESTIONS[role] || GOAL_SUGGESTIONS.DEFAULT;
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", metric: "deaths", operator: "lte", targetValue: 3.5, sampleSize: 3, requiredSuccesses: 2 });
  const evaluated = activeGoals.map((goal) => ({ goal, result: evaluateGoal(goal, rows) }));
  const completed = evaluated.filter(({ result }) => result.complete).length;
  const inProgress = evaluated.filter(({ result }) => !result.complete && !result.impossible && !result.inconclusive).length;
  function setMetric(metric) {
    const config = METRICS[metric];
    setForm((current) => ({ ...current, metric, operator: config.defaultOperator, targetValue: config.defaultTarget, title: "" }));
  }
  function setSampleSize(value) {
    const sampleSize = Number(value);
    setForm((current) => ({ ...current, sampleSize, requiredSuccesses: Math.min(sampleSize, Math.max(1, Math.ceil(sampleSize * 2 / 3))) }));
  }
  function applySuggestion(suggestion) {
    setForm((current) => ({ ...current, ...suggestion, title: t(suggestion.title) }));
    setCreating(true);
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
  const groups = Object.entries(METRICS).reduce((map, [id, item]) => ({ ...map, [item.group]: [...(map[item.group] || []), id] }), {});
  const formMetric = METRICS[form.metric];
  const suggestionList = (compact) => <div className={cx("profile-goal-suggestions", compact && "is-compact")}>
    {suggestions.map((suggestion) => {
      const metric = METRICS[suggestion.metric];
      return <button key={`${suggestion.metric}-${suggestion.title}`} type="button" className="profile-goal-suggestion" onClick={() => applySuggestion(suggestion)}>
        <span className="profile-goal-suggestion-icon" aria-hidden="true"><Target /></span>
        <span className="profile-goal-suggestion-copy"><strong>{t(suggestion.title)}</strong><small>{t(GOAL_METRIC_LABELS[suggestion.metric])} {goalTargetText({ operator: suggestion.operator, target_value: suggestion.targetValue }, metric)}</small></span>
        <Plus className="profile-goal-suggestion-add" aria-hidden="true" />
      </button>;
    })}
  </div>;
  return <Panel className="profile-goal-panel">
    <header className="profile-goal-heading">
      <div><p className="profile-goal-eyebrow">{t("Suivi joueur")}</p><h3>{t("Objectifs mesurés sur les prochaines parties")}</h3><p>{t("Le suivi de chaque objectif compte uniquement les parties importées après sa date de début.")}</p></div>
      {canManage && <ActionButton variant={creating ? "ghost" : "primary"} icon={creating ? X : Plus} onClick={() => setCreating((value) => !value)}>{creating ? t("Fermer") : t("Nouvel objectif")}</ActionButton>}
      {activeGoals.length > 0 && <dl className="profile-goal-summary">
        <div><dt>{t("Actifs")}</dt><dd>{activeGoals.length}</dd></div>
        <div className="is-active"><dt>{t("En cours")}</dt><dd>{inProgress}</dd></div>
        <div className="is-success"><dt>{t("Réussis")}</dt><dd>{completed}</dd></div>
      </dl>}
    </header>
    {creating && <form onSubmit={create} className="profile-goal-form">
      <div className="profile-goal-form-presets"><p>{role && GOAL_SUGGESTIONS[role] ? t("Suggestions pour le poste {0}", [role]) : t("Suggestions")}</p>{suggestionList(true)}</div>
      <SelectInput label={t("Mesure à suivre")} value={form.metric} onChange={setMetric}>{Object.entries(groups).map(([group, ids]) => <optgroup key={group} label={t(group)}>{ids.map((id) => <option key={id} value={id}>{t(GOAL_METRIC_LABELS[id])}</option>)}</optgroup>)}</SelectInput>
      <TextInput label={t("Nom")} value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder={t("Ex. Mieux préparer les objectifs")} />
      <TextInput label={form.operator === "lte" ? t("Maximum par partie") : t("Minimum par partie")} type="number" step={formMetric.decimals ? "0.1" : "1"} value={form.targetValue} onChange={(value) => setForm({ ...form, targetValue: Number(value) })} />
      <div className="profile-goal-form-pair">
        <SelectInput label={t("Parties suivies")} value={form.sampleSize} onChange={setSampleSize}>{[3, 5].map((size) => <option key={size} value={size}>{size}</option>)}</SelectInput>
        <SelectInput label={t("Parties où atteindre la cible")} value={form.requiredSuccesses} onChange={(value) => setForm({ ...form, requiredSuccesses: Number(value) })}>{Array.from({ length: form.sampleSize }, (_, index) => <option key={index} value={index + 1}>{index + 1} / {form.sampleSize}</option>)}</SelectInput>
      </div>
      <div className="profile-goal-form-action"><p><Target aria-hidden="true" /><span>{t(GOAL_METRIC_LABELS[form.metric])} <strong>{goalTargetText({ operator: form.operator, target_value: form.targetValue }, formMetric)}</strong> {t("sur {0} des {1} prochaines parties.", [form.requiredSuccesses, form.sampleSize])}</span></p><ActionButton type="submit" icon={saving ? RefreshCw : Target} disabled={saving}>{saving ? t("Lancement…") : t("Lancer")}</ActionButton></div>
    </form>}
    {activeGoals.length ? <div className="profile-goal-list">{evaluated.map(({ goal, result }) => {
      const metric = METRICS[goal.metric] || METRICS.deaths;
      const status = goalStatus(result);
      const required = Math.max(1, result.required);
      return <article key={goal.id} className={cx("profile-goal-row", `is-${status.key}`)}>
        <div className="profile-goal-identity">
          <div className="profile-goal-status"><Label tone={status.tone}>{t(status.label)}</Label><span>{result.successes}/{result.required}{t(" réussites")}</span></div>
          <h4>{goal.title}</h4>
          <p><span className="profile-goal-metric">{t(GOAL_METRIC_LABELS[goal.metric]) || t(metric.label)}</span> <strong className="profile-goal-target">{goalTargetText(goal, metric)}</strong> · {goal.required_successes}/{goal.sample_size}{t(" parties")}</p>
          <div className="profile-goal-meter" role="progressbar" aria-label={t("Progression de l’objectif")} aria-valuemin={0} aria-valuemax={required} aria-valuenow={Math.min(result.successes, required)}><span style={{ width: `${Math.min(100, (result.successes / required) * 100)}%` }} /></div>
        </div>
        <div className="profile-goal-progress"><div className="profile-goal-samples">{Array.from({ length: Number(goal.sample_size || 3) }, (_, index) => {
          const value = result.values[index];
          const success = Number.isFinite(value) && (goal.operator === "lte" ? value <= Number(goal.target_value) : value >= Number(goal.target_value));
          return <div key={index} className={cx("profile-goal-sample", !Number.isFinite(value) ? "is-pending" : success ? "is-success" : "is-missed")}><span>{t("Partie ")}{index + 1}</span><strong>{!Number.isFinite(value) ? "—" : `${Number(value).toFixed(metric.decimals ?? 1)}${metric.unit}`}</strong><small>{value === undefined ? t("À jouer") : value === null ? t("Indisponible") : success ? t("Cible atteinte") : t("Hors cible")}</small></div>;
        })}</div><p>{t("Parties depuis le ")}{formatDate(goal.starts_at || goal.created_at)}</p></div>
        {canManage && <IconButton icon={Trash2} label={t("Archiver l'objectif")} danger disabled={saving} onClick={() => archive(goal)} />}
      </article>;
    })}</div> : <div className="profile-goal-empty">
      <div className="profile-goal-empty-copy"><CircleDot aria-hidden="true" /><div><h4>{t("Aucun objectif actif pour ce profil.")}</h4><p>{canManage ? t("Crée une cible mesurable pour suivre les prochaines parties du joueur.") : t("Les objectifs définis par les responsables de l’équipe apparaîtront ici.")}</p></div></div>
      {canManage && !creating && <div className="profile-goal-empty-presets"><p>{role && GOAL_SUGGESTIONS[role] ? t("Pour démarrer, objectifs adaptés au poste {0}", [role]) : t("Pour démarrer")}</p>{suggestionList(false)}</div>}
    </div>}
  </Panel>;
}

export const workflowTestables = { blockMatches, blockSnapshot, blockOverlapCount, blockDateRange, blockDelta, evaluateGoal, hasTimeline, reviewReason };
