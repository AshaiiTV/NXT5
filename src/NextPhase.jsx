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
  if (typeof value === "string" && value.includes("%")) return Number(value.replace("%", "")) || 0;
  const number = Number(value || 0);
  return number <= 1 ? number * 100 : number;
}

function normalizeRole(value) {
  const role = String(value || "").toUpperCase();
  return { JUNGLE: "JGL", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUP", SUPPORT: "SUP" }[role] || role;
}

function matchName(match) {
  return match?.raw?.nxt5Label || match?.opponent || match?.game_id || "Game";
}

function formatDate(value, withTime = false) {
  if (!value) return "Date à définir";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date à définir";
  return date.toLocaleString("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function teamRows(match, teamKey = "ALLY") {
  return (match?.participants || []).filter((row) => row.team_key === teamKey);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row?.[key] || 0), 0);
}

function matchDiff(match, key) {
  return sum(teamRows(match), key) - sum(teamRows(match, "ENEMY"), key);
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
  return <section className={cx("overflow-hidden rounded-2xl border border-white/10 bg-[#070b17]/88 shadow-[0_22px_70px_rgba(0,0,0,.22)]", className)}>{children}</section>;
}

function Label({ children, tone = "cyan" }) {
  const colors = tone === "green" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : tone === "red" ? "border-rose-300/25 bg-rose-300/10 text-rose-100" : tone === "amber" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em]", colors)}>{children}</span>;
}

function IconButton({ icon: Icon, label, onClick, danger = false, disabled = false }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40", danger ? "border-rose-300/20 bg-rose-300/[0.07] text-rose-100 hover:bg-rose-300/15" : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-300/25 hover:text-cyan-100")}><Icon className="h-4 w-4" /></button>;
}

function ActionButton({ children, onClick, icon: Icon = ArrowRight, variant = "primary", disabled = false, type = "button", className = "" }) {
  const styles = variant === "ghost" ? "border-white/10 bg-white/[0.04] text-slate-100 hover:border-cyan-300/25 hover:bg-cyan-300/[0.07]" : variant === "danger" ? "border-rose-300/25 bg-rose-300/10 text-rose-50 hover:bg-rose-300/18" : "border-cyan-200/30 bg-cyan-300 text-slate-950 hover:bg-cyan-200";
  return <button type={type} onClick={onClick} disabled={disabled} className={cx("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45", styles, className)}>{Icon && <Icon className="h-4 w-4" />}{children}</button>;
}

export function TeamDataHealthPanel({ team, players = [], matches = [] }) {
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
    ...(incomplete.length ? [{ id: "participants", title: `${incomplete.length} import${incomplete.length > 1 ? "s" : ""} incomplet${incomplete.length > 1 ? "s" : ""}`, detail: "Il manque un participant allié ou adverse.", path: `/statistiques?match=${encodeURIComponent(incomplete[0].id)}`, icon: AlertTriangle }] : []),
    ...(missingTimeline.length ? [{ id: "timeline", title: `${missingTimeline.length} timeline${missingTimeline.length > 1 ? "s" : ""} absente${missingTimeline.length > 1 ? "s" : ""}`, detail: "Les stats finales restent lisibles, mais l’analyse temporelle est limitée.", path: "/integration", icon: Clock3 }] : []),
    ...(duplicateIds.length ? [{ id: "duplicates", title: `${duplicateIds.length} Game ID en double`, detail: "Ces imports doivent être vérifiés.", path: "/integration", icon: Database }] : []),
  ];
  const checks = 4 + ROLES.length;
  const score = Math.round(((checks - Math.min(checks, issues.length)) / checks) * 100);
  return <Panel>
    <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-4 p-4 text-left sm:p-5">
      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", issues.length ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100")}><ShieldCheck className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-black text-white">Santé des données</span><span className="mt-1 block text-xs font-semibold text-slate-400">{issues.length ? `${issues.length} point${issues.length > 1 ? "s" : ""} à vérifier avant de tirer des conclusions.` : "Roster, profils et imports sont cohérents."}</span></span>
      <span className="text-right"><span className={cx("block text-2xl font-black", score === 100 ? "text-emerald-200" : "text-amber-100")}>{score}%</span><span className="block text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">fiabilité</span></span>
      <ChevronRight className={cx("h-5 w-5 shrink-0 text-slate-400 transition", open && "rotate-90")} />
    </button>
    {open && <div className="border-t border-white/10 px-4 py-2 sm:px-5">
      {issues.length ? issues.map((issue) => <button key={issue.id} type="button" onClick={() => openRoute(issue.path)} className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.07] py-3 text-left last:border-b-0 hover:text-cyan-100">
        <issue.icon className="h-4 w-4 text-amber-100" /><span className="min-w-0"><span className="block text-sm font-black text-white">{issue.title}</span><span className="mt-0.5 block text-xs font-semibold text-slate-400">{issue.detail}</span></span><ArrowRight className="h-4 w-4 text-cyan-100" />
      </button>) : <div className="flex items-center gap-3 py-4 text-sm font-semibold text-emerald-100"><Check className="h-5 w-5" /> Aucun correctif nécessaire.</div>}
    </div>}
  </Panel>;
}

function blockMatches(allMatches, categories, key) {
  const sorted = [...allMatches].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
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
  const wins = matches.filter((match) => match.result === "Victoire").length;
  const allyRows = matches.flatMap((match) => teamRows(match));
  const average = (values) => values.reduce((total, value) => total + Number(value || 0), 0) / Math.max(1, values.length);
  const side = (name) => {
    const scoped = matches.filter((match) => String(match.side || "").toLowerCase().includes(name));
    const sideWins = scoped.filter((match) => match.result === "Victoire").length;
    return scoped.length ? Math.round((sideWins / scoped.length) * 100) : null;
  };
  const roles = ROLES.map((role) => {
    const rows = allyRows.filter((row) => normalizeRole(row.role || row.raw?.teamPosition || row.raw?.individualPosition) === role);
    return { role, games: rows.length, kp: average(rows.map((row) => parsePercent(row.kill_participation ?? row.kp))), deaths: average(rows.map((row) => row.deaths)), cs: average(rows.map((row) => row.cs)) };
  });
  return {
    games: matches.length,
    wr: matches.length ? Math.round((wins / matches.length) * 100) : 0,
    blue: side("blue"),
    red: side("red"),
    gold: average(matches.map((match) => matchDiff(match, "gold"))),
    damage: average(matches.map((match) => matchDiff(match, "damage"))),
    vision: average(matches.map((match) => matchDiff(match, "vision"))),
    deaths: average(matches.map((match) => sum(teamRows(match), "deaths"))),
    roles,
  };
}

export function BlockComparisonPanel({ matches = [], categories = [] }) {
  const [leftKey, setLeftKey] = useState("previous");
  const [rightKey, setRightKey] = useState("recent");
  const options = [{ value: "previous", label: "5 précédentes" }, { value: "recent", label: "5 dernières" }, { value: "all", label: "Toutes les games" }, ...categories.map((category) => ({ value: `category:${category.id}`, label: category.name }))];
  const leftMatches = blockMatches(matches, categories, leftKey);
  const rightMatches = blockMatches(matches, categories, rightKey);
  const left = blockSnapshot(leftMatches);
  const right = blockSnapshot(rightMatches);
  const metrics = [
    ["Winrate", left.wr, right.wr, "%", false],
    ["Écart d'or moyen", Math.round(left.gold), Math.round(right.gold), "", false],
    ["Écart dégâts moyen", Math.round(left.damage), Math.round(right.damage), "", false],
    ["Écart vision moyen", Math.round(left.vision), Math.round(right.vision), "", false],
    ["Morts équipe", Number(left.deaths.toFixed(1)), Number(right.deaths.toFixed(1)), "", true],
  ];
  return <Panel>
    <div className="border-b border-white/10 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><Label>Comparaison</Label><h3 className="mt-3 text-2xl font-black text-white">Ce qui a réellement changé</h3><p className="mt-1 text-sm font-semibold text-slate-400">Deux blocs, les mêmes repères, aucun score opaque.</p></div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_auto_minmax(0,14rem)] sm:items-end">
          <label className="block"><span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.12em] text-slate-400">Avant</span><select value={leftKey} onChange={(event) => setLeftKey(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0a1020] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-300/35">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <ArrowRight className="mb-3 hidden h-4 w-4 text-slate-500 sm:block" />
          <label className="block"><span className="mb-1 block text-[0.6rem] font-black uppercase tracking-[0.12em] text-slate-400">Après</span><select value={rightKey} onChange={(event) => setRightKey(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0a1020] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-300/35">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
      </div>
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(21rem,.8fr)]">
      <div className="min-w-0 p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(8rem,1fr)_5rem_5rem_5rem] gap-2 border-b border-white/10 pb-2 text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500"><span>Repère</span><span className="text-right">Avant</span><span className="text-right">Après</span><span className="text-right">Écart</span></div>
        {metrics.map(([label, before, after, suffix, inverse]) => {
          const delta = Number(after) - Number(before);
          return <div key={label} className="grid grid-cols-[minmax(8rem,1fr)_5rem_5rem_5rem] items-center gap-2 border-b border-white/[0.07] py-3 last:border-b-0"><span className="text-sm font-bold text-slate-200">{label}</span><span className="text-right text-sm font-black text-slate-400">{before}{suffix}</span><span className="text-right text-sm font-black text-white">{after}{suffix}</span><span className={cx("text-right text-sm font-black", toneForDelta(delta, inverse))}>{signed(delta, suffix)}</span></div>;
        })}
      </div>
      <div className="border-t border-white/10 bg-white/[0.025] p-4 sm:p-5 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Sides</p><p className="mt-1 text-sm font-semibold text-slate-300">WR du bloc après</p></div><Trophy className="h-5 w-5 text-cyan-100" /></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-xs font-black text-cyan-100">Blue side</p><p className="mt-1 text-2xl font-black text-white">{right.blue ?? "-"}{right.blue !== null ? "%" : ""}</p></div><div><p className="text-xs font-black text-fuchsia-100">Red side</p><p className="mt-1 text-2xl font-black text-white">{right.red ?? "-"}{right.red !== null ? "%" : ""}</p></div></div>
        <div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Par rôle</p>{right.roles.map((role) => { const previous = left.roles.find((item) => item.role === role.role); const delta = role.kp - Number(previous?.kp || 0); return <div key={role.role} className="mt-3 grid grid-cols-[3rem_1fr_auto] items-center gap-3"><span className="text-xs font-black text-white">{role.role}</span><span className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, role.kp))}%` }} /></span><span className={cx("text-xs font-black", toneForDelta(delta))}>{signed(delta, "% KP")}</span></div>; })}</div>
      </div>
    </div>
  </Panel>;
}

function reviewReason(match) {
  const deaths = sum(teamRows(match), "deaths");
  const gold = matchDiff(match, "gold");
  if (match.result === "Défaite" && gold < -3000) return `Défaite · ${Math.abs(Math.round(gold / 100) * 100).toLocaleString("fr-FR")} or de retard`;
  if (deaths >= 20) return `${deaths} morts alliées à classer`;
  if (!hasTimeline(match)) return "Timeline absente · lecture finale uniquement";
  return match.result === "Défaite" ? "Défaite à transformer en décision" : "Game à consolider dans le plan";
}

export function ReviewQueuePanel({ matches = [], reports = [], selectedTeamId, refreshAll, pushToast, onStartReview, onOpenReview }) {
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
    <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><Label tone={showDone ? "green" : queue.length ? "amber" : "green"}>{showDone ? "Historique" : "File de review"}</Label><h3 className="mt-3 text-2xl font-black text-white">{showDone ? `${doneMatches.length} review${doneMatches.length > 1 ? "s" : ""} terminée${doneMatches.length > 1 ? "s" : ""}` : queue.length ? `${queue.length} game${queue.length > 1 ? "s" : ""} à traiter` : "File à jour"}</h3><p className="mt-1 text-sm font-semibold text-slate-400">{showDone ? "Une erreur de classement reste réversible." : "Ouvre la source, prends une décision, puis marque-la terminée."}</p></div><ActionButton variant="ghost" icon={showDone ? ArrowRight : ClipboardCheck} onClick={() => setShowDone((value) => !value)}>{showDone ? "Retour à la file" : `${doneMatches.length} terminée${doneMatches.length > 1 ? "s" : ""}`}</ActionButton></div>
    {visibleMatches.length ? <div className="divide-y divide-white/[0.07]">{visibleMatches.slice(0, 8).map((match) => {
      const linkedReport = reports.find((report) => [report.match_id, ...(Array.isArray(report.match_ids) ? report.match_ids : [])].some((id) => String(id || "") === String(match.id)));
      return <div key={match.id} className="grid gap-3 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><button type="button" onClick={() => openRoute(`/statistiques?match=${encodeURIComponent(match.id)}`)} className="min-w-0 text-left"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-black text-white">{matchName(match)}</span><Label tone={match.result === "Victoire" ? "green" : "red"}>{match.result || "Analyse"}</Label>{linkedReport && <span className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-cyan-100">Review créée</span>}</span><span className="mt-1 block text-xs font-semibold text-slate-400">{showDone ? `Terminée ${formatDate(match.reviewed_at || match.created_at)}` : `${reviewReason(match)} · ${formatDate(match.created_at)}`}</span></button><div className="flex flex-wrap gap-2"><ActionButton variant="ghost" icon={Eye} onClick={() => openRoute(`/statistiques?match=${encodeURIComponent(match.id)}`)}>Source</ActionButton><ActionButton variant="ghost" icon={linkedReport ? ArrowRight : FileText} onClick={() => linkedReport ? onOpenReview?.(linkedReport) : onStartReview(match)}>{linkedReport ? "Ouvrir la review" : "Créer la review"}</ActionButton><ActionButton variant={showDone ? "ghost" : "primary"} icon={busyId === match.id ? RefreshCw : showDone ? RefreshCw : Check} disabled={Boolean(busyId)} onClick={() => setStatus(match, showDone ? "todo" : "done")}>{showDone ? "Rouvrir" : "Terminé"}</ActionButton></div></div>;
    })}</div> : <div className="flex items-center gap-3 p-5 text-sm font-semibold text-emerald-100"><ClipboardCheck className="h-5 w-5" /> {showDone ? "Aucune review terminée." : "Toutes les games importées ont été traitées."}</div>}
  </Panel>;
}


function goalMetricValue(row, metric) {
  if (metric === "deaths") return Number(row.deaths || 0);
  if (metric === "kp") return parsePercent(row.kill_participation ?? row.kp);
  if (metric === "kda") return (Number(row.kills || 0) + Number(row.assists || 0)) / Math.max(1, Number(row.deaths || 0));
  if (metric === "vision") return Number(row.vision || 0);
  if (metric === "cs10") {
    const direct = row.raw?.challenges?.laneMinionsFirst10Minutes ?? row.raw?.csAt10;
    const rate = row.raw?.timeline?.creepsPerMinDeltas?.["0-10"];
    return Number(direct ?? (Number.isFinite(Number(rate)) ? Number(rate) * 10 : 0));
  }
  return 0;
}

function evaluateGoal(goal, rows) {
  const started = new Date(goal.starts_at || goal.created_at || 0).getTime();
  const unique = Array.from(rows.reduce((map, row) => {
    const key = String(row.match?.id || row.match?.game_id || "");
    const time = new Date(row.match?.created_at || 0).getTime();
    if (key && time >= started && !map.has(key)) map.set(key, row);
    return map;
  }, new Map()).values()).sort((a, b) => new Date(a.match?.created_at || 0) - new Date(b.match?.created_at || 0)).slice(0, Number(goal.sample_size || 3));
  const values = unique.map((row) => goalMetricValue(row, goal.metric));
  const successes = values.filter((value) => goal.operator === "lte" ? value <= Number(goal.target_value) : value >= Number(goal.target_value)).length;
  const required = Number(goal.required_successes || 2);
  return { rows: unique, values, successes, required, complete: successes >= required, impossible: values.length >= Number(goal.sample_size || 3) && successes < required };
}

export function PlayerGoalsPanel({ goals = [], rows = [], player, selectedTeamId, canManage, refreshAll, pushToast }) {
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
      await refreshAll(); setCreating(false); pushToast?.({ type: "green", title: "Objectif lancé", text: `Suivi sur les ${form.sampleSize} prochaines games.` });
    } catch (error) { pushToast?.({ type: "red", title: "Création impossible", text: error.message }); }
    finally { setSaving(false); }
  }
  async function archive(goal) {
    setSaving(true);
    try { await apiFetch("player-goals-manage", { method: "POST", body: JSON.stringify({ action: "archive", teamId: selectedTeamId, goalId: goal.id }) }); await refreshAll(); }
    catch (error) { pushToast?.({ type: "red", title: "Archivage impossible", text: error.message }); }
    finally { setSaving(false); }
  }
  return <Panel className="mb-5">
    <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><Label tone={activeGoals.length ? "cyan" : "amber"}>Suivi joueur</Label><h3 className="mt-3 text-xl font-black text-white">Objectifs mesurés sur les prochaines games</h3><p className="mt-1 text-sm font-semibold text-slate-400">Le progrès se valide directement avec les imports, pas avec une impression.</p></div>{canManage && <ActionButton variant={creating ? "ghost" : "primary"} icon={creating ? X : Plus} onClick={() => setCreating((value) => !value)}>{creating ? "Fermer" : "Nouvel objectif"}</ActionButton>}</div>
    {creating && <form onSubmit={create} className="grid gap-3 border-b border-white/10 bg-white/[0.025] p-4 sm:p-5 lg:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.4fr)_7rem_7rem_auto] lg:items-end"><label><span className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">Métrique</span><select value={form.metric} onChange={(event) => setMetric(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0a1020] px-3 py-2.5 text-sm font-bold text-white outline-none">{Object.entries(METRICS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><label><span className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">Nom</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex. Réduire les morts gratuites" className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-bold text-white outline-none" /></label><label><span className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">Cible</span><input type="number" step="0.1" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: Number(event.target.value) })} className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-bold text-white outline-none" /></label><label><span className="mb-1 block text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">Réussites</span><select value={form.requiredSuccesses} onChange={(event) => setForm({ ...form, requiredSuccesses: Number(event.target.value) })} className="w-full rounded-lg border border-white/10 bg-[#0a1020] px-3 py-2.5 text-sm font-bold text-white outline-none"><option value="1">1 / 3</option><option value="2">2 / 3</option><option value="3">3 / 3</option></select></label><ActionButton type="submit" icon={saving ? RefreshCw : Target} disabled={saving}>Lancer</ActionButton></form>}
    {activeGoals.length ? <div className="divide-y divide-white/[0.07]">{activeGoals.map((goal) => {
      const result = evaluateGoal(goal, rows);
      const metric = METRICS[goal.metric] || METRICS.deaths;
      return <div key={goal.id} className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.7fr)_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Label tone={result.complete ? "green" : result.impossible ? "red" : "cyan"}>{result.complete ? "Validé" : result.impossible ? "À ajuster" : "En cours"}</Label><span className="text-xs font-black text-slate-400">{result.successes}/{result.required} réussites</span></div><h4 className="mt-2 break-words text-lg font-black text-white">{goal.title}</h4><p className="mt-1 text-xs font-semibold text-slate-400">{metric.label} {goal.operator === "lte" ? "≤" : "≥"} {Number(goal.target_value)}{metric.unit} · {goal.required_successes}/{goal.sample_size} games</p></div><div><div className="flex gap-2">{Array.from({ length: Number(goal.sample_size || 3) }, (_, index) => { const value = result.values[index]; const success = value !== undefined && (goal.operator === "lte" ? value <= Number(goal.target_value) : value >= Number(goal.target_value)); return <span key={index} className={cx("grid h-10 min-w-10 flex-1 place-items-center rounded-lg border text-xs font-black", value === undefined ? "border-white/10 bg-white/[0.025] text-slate-600" : success ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100")}>{value === undefined ? "–" : `${Number(value).toFixed(goal.metric === "deaths" || goal.metric === "vision" || goal.metric === "cs10" ? 0 : 1)}${metric.unit}`}</span>; })}</div><p className="mt-2 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-500">Games depuis le {formatDate(goal.starts_at || goal.created_at)}</p></div>{canManage && <IconButton icon={Trash2} label="Archiver l'objectif" danger disabled={saving} onClick={() => archive(goal)} />}</div>;
    })}</div> : <div className="flex items-center gap-3 p-5 text-sm font-semibold text-slate-400"><CircleDot className="h-5 w-5 text-cyan-100" /> Aucun objectif actif pour ce profil.</div>}
  </Panel>;
}

export function HomeActionSummary({ matches = [], alerts = [] }) {
  const latest = [...matches].sort((a, b) => new Date(b.imported_at || b.created_at || 0) - new Date(a.imported_at || a.created_at || 0))[0];
  const review = matches.find((match) => String(match.review_status || "todo") !== "done" && match.result === "Défaite") || matches.find((match) => String(match.review_status || "todo") !== "done");
  const items = [
    { label: "Dernier import", value: latest ? matchName(latest) : "Aucune game importée", detail: latest ? `${latest.result || "À analyser"} · ${formatDate(latest.imported_at || latest.created_at)}` : "Commence par intégrer une game.", icon: Clock3, path: latest ? `/statistiques?match=${encodeURIComponent(latest.id)}` : "/integration" },
    { label: "Priorité du bloc", value: alerts[0]?.title || "Choisir un axe", detail: alerts[0]?.action || "Une seule priorité avant le prochain bloc.", icon: Target, path: "/tendances" },
    { label: "Review à ouvrir", value: review ? matchName(review) : "File à jour", detail: review ? reviewReason(review) : "Aucune game en attente.", icon: FileText, path: review ? `/statistiques?match=${encodeURIComponent(review.id)}` : "/rapports" },
  ];
  return <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3">{items.map((item) => <button key={item.label} type="button" onClick={() => openRoute(item.path)} className="group grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 bg-[#080d1a] p-4 text-left transition hover:bg-cyan-300/[0.06]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-cyan-100"><item.icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-[0.58rem] font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</span><span className="mt-1 block truncate text-sm font-black text-white">{item.value}</span><span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{item.detail}</span></span><ArrowRight className="mt-2 h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-100" /></button>)}</div>;
}

export const workflowTestables = { blockSnapshot, evaluateGoal, hasTimeline, reviewReason };
