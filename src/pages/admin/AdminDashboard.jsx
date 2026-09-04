import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Check, Clock3, Gamepad2, Loader2, RefreshCw, Search, ShieldCheck, UserCheck, Users } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { cx } from "../../app/helpers.js";
import { Badge, Button, EmptyState, PageHeader, SkeletonRows, Surface } from "../../components/ui/Core.jsx";

const number = new Intl.NumberFormat("fr-FR");
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function formatDate(value, withTime = false) {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function KpiCard({ icon: Icon, label, value, growth7, growth30, tone = "cyan" }) {
  const styles = tone === "purple" ? "border-fuchsia-200/20 bg-fuchsia-400/10 text-fuchsia-100" : tone === "green" ? "border-emerald-200/20 bg-emerald-400/10 text-emerald-100" : "border-cyan-200/20 bg-cyan-400/10 text-cyan-100";
  return <Surface className="min-h-[150px] p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-white sm:text-4xl">{number.format(Number(value || 0))}</p></div><span className={cx("rounded-xl border p-2.5", styles)}><Icon className="h-5 w-5" /></span></div>
    <div className="mt-5 flex flex-wrap gap-2"><Badge tone={growth7 ? "green" : "slate"}>+{number.format(Number(growth7 || 0))} · 7 j</Badge><Badge tone={growth30 ? "cyan" : "slate"}>+{number.format(Number(growth30 || 0))} · 30 j</Badge></div>
  </Surface>;
}

function DailyChart({ rows = [] }) {
  const points = rows.slice(-30);
  const max = Math.max(1, ...points.map((row) => Number(row.users || 0) + Number(row.teams || 0) + Number(row.matches || 0)));
  const [hovered, setHovered] = useState(null);
  if (!points.length) return <EmptyState icon={BarChart3} title="Pas encore de tendance" text="Les données quotidiennes apparaîtront ici dès la première activité." />;
  return <div>
    <div className="mb-3 flex min-h-14 items-center rounded-xl border border-cyan-100/15 bg-[#030712]/80 px-4 py-2 text-xs shadow-inner shadow-black/30">
      {hovered ? <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1"><strong className="text-cyan-50">{formatDate(hovered.date)}</strong><span className="font-semibold text-slate-100">{hovered.users || 0} comptes · {hovered.teams || 0} équipes · {hovered.matches || 0} games</span></div> : <span className="font-semibold text-slate-400">Survole une barre pour afficher le détail de la journée.</span>}
    </div>
    <div className="flex h-44 items-end gap-1 sm:gap-1.5" aria-label="Activité quotidienne sur 30 jours" onMouseLeave={() => setHovered(null)}>
      {points.map((row) => {
        const total = Number(row.users || 0) + Number(row.teams || 0) + Number(row.matches || 0);
        const height = Math.max(2, (total / max) * 100);
        return <button type="button" key={row.date} className="group relative flex min-w-0 flex-1 items-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80" style={{ height: `${height}%` }} aria-label={`${formatDate(row.date)} : ${total} événements`} onMouseEnter={() => setHovered(row)} onFocus={() => setHovered(row)}><span className="h-full min-h-[3px] w-full rounded-t-sm bg-gradient-to-t from-cyan-500 via-blue-500 to-fuchsia-400 opacity-75 transition group-hover:opacity-100 group-focus-visible:opacity-100" /></button>;
      })}
    </div>
    <div className="mt-3 flex justify-between text-[0.62rem] font-bold uppercase tracking-wider text-slate-500"><span>{formatDate(points[0]?.date)}</span><span>{formatDate(points.at(-1)?.date)}</span></div>
  </div>;
}

function TableShell({ children }) {
  return <div className="mt-4 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[720px] text-left text-sm">{children}</table></div>;
}

function percent(value, total) {
  return total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;
}

function ProgressRow({ label, value, total, suffix = "équipes" }) {
  const rate = percent(value, total);
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-300">{label}</span><strong className="text-white">{number.format(Number(value || 0))} <span className="font-semibold text-slate-500">{suffix} · {rate}%</span></strong></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-400" style={{ width: `${Math.min(100, rate)}%` }} /></div></div>;
}

function WeeklyChart({ rows = [] }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.matches || 0)));
  return <div className="mt-4 grid grid-cols-12 items-end gap-1.5" aria-label="Volume hebdomadaire des games">{rows.map((row) => <div key={row.date} className="flex min-w-0 flex-col items-center gap-2"><span className="text-[0.58rem] font-black text-slate-500">{row.matches || 0}</span><div className="h-24 w-full rounded-t-md bg-white/[0.05] flex items-end overflow-hidden" title={`${formatDate(row.date)} · ${row.matches || 0} games · ${row.activeUsers || 0} utilisateurs actifs`}><div className="w-full rounded-t-md bg-gradient-to-t from-cyan-500 to-fuchsia-400" style={{ height: `${Math.max(3, (Number(row.matches || 0) / max) * 100)}%` }} /></div></div>)}</div>;
}

function TeamMatchChart({ rows = [] }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.matches || 0)));
  return <div className="flex h-24 items-end gap-1" aria-label="Imports de cette équipe sur 30 jours">{rows.map((row) => <div key={row.date} className="min-w-0 flex-1 rounded-t-sm bg-gradient-to-t from-cyan-500 to-fuchsia-400" title={`${formatDate(row.date)} · ${row.matches || 0} games`} style={{ height: `${Math.max(3, (Number(row.matches || 0) / max) * 100)}%` }} />)}</div>;
}

function BenchmarkMetric({ label, value, median, suffix = "" }) {
  const delta = Number(value || 0) - Number(median || 0);
  return <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-400">{label}</p><div className="mt-2 flex items-end justify-between gap-2"><strong className="text-2xl text-white">{number.format(Number(value || 0))}{suffix}</strong><span className={cx("text-xs font-black", delta > 0 ? "text-emerald-200" : delta < 0 ? "text-amber-200" : "text-slate-400")}>{delta > 0 ? "+" : ""}{decimal.format(delta)} vs médiane</span></div></div>;
}

function HealthScore({ score = 0 }) {
  const toneClass = score >= 75 ? "text-emerald-200" : score >= 50 ? "text-cyan-200" : score >= 25 ? "text-amber-200" : "text-rose-200";
  const label = score >= 75 ? "Solide" : score >= 50 ? "En progression" : score >= 25 ? "Fragile" : "À activer";
  return <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/25 p-4"><div className={cx("grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-current bg-black/25", toneClass)}><span className="text-2xl font-black">{score}</span></div><div><p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-400">Indice d’activation</p><p className={cx("mt-1 text-xl font-black", toneClass)}>{label}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Roster 25 · liaison 15 · activité 25 · workflow 20 · qualité 15</p></div></div>;
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamDetail, setTeamDetail] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDashboard(await apiFetch("admin-dashboard", { timeoutMs: 20000 })); }
    catch (err) { setError(err.message || "Impossible de charger le dashboard administrateur."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!selectedTeamId) return undefined;
    let mounted = true;
    setTeamLoading(true); setTeamError("");
    apiFetch(`admin-dashboard?view=team&teamId=${encodeURIComponent(selectedTeamId)}`, { timeoutMs: 20000 })
      .then((result) => { if (mounted) setTeamDetail(result); })
      .catch((err) => { if (mounted) { setTeamDetail(null); setTeamError(err.message || "Impossible de charger cette équipe."); } })
      .finally(() => { if (mounted) setTeamLoading(false); });
    return () => { mounted = false; };
  }, [selectedTeamId]);
  useEffect(() => {
    if (!selectedTeamId && dashboard?.teamDirectory?.[0]?.id) setSelectedTeamId(dashboard.teamDirectory[0].id);
  }, [dashboard, selectedTeamId]);

  const kpis = useMemo(() => [
    [Users, "Équipes", dashboard?.totals?.teams, dashboard?.growth?.days7?.teams, dashboard?.growth?.days30?.teams, "cyan"],
    [UserCheck, "Comptes", dashboard?.totals?.users, dashboard?.growth?.days7?.users, dashboard?.growth?.days30?.users, "purple"],
    [ShieldCheck, "Joueurs", dashboard?.totals?.players, dashboard?.growth?.days7?.players, dashboard?.growth?.days30?.players, "green"],
    [Gamepad2, "Games", dashboard?.totals?.matches, dashboard?.growth?.days7?.matches, dashboard?.growth?.days30?.matches, "cyan"],
  ], [dashboard]);

  if (loading && !dashboard) return <><PageHeader eyebrow="Administration" title="Vue d’ensemble plateforme" subtitle="Chargement des indicateurs globaux…" /><SkeletonRows count={5} /></>;
  if (error && !dashboard) return <><PageHeader eyebrow="Administration" title="Vue d’ensemble plateforme" /><Surface><EmptyState icon={AlertTriangle} title="Dashboard indisponible" text={error} action={<Button icon={RefreshCw} onClick={load}>Réessayer</Button>} /></Surface></>;

  const activity = dashboard?.activity || {};
  const averages = dashboard?.averages || {};
  const attention = dashboard?.attention || {};
  const adoption = dashboard?.adoption || {};
  const accountFunnel = dashboard?.accountFunnel || {};
  const matchHealth = dashboard?.matchHealth || {};
  const rosterHealth = dashboard?.rosterHealth || {};
  const totalTeams = Number(dashboard?.totals?.teams || 0);
  const totalUsers = Number(dashboard?.totals?.users || 0);
  const totalPlayers = Number(dashboard?.totals?.players || 0);
  const totalMatches = Number(dashboard?.totals?.matches || 0);
  const filteredTeams = (dashboard?.teamDirectory || []).filter((team) => `${team.name} ${team.tag} ${team.region}`.toLowerCase().includes(teamSearch.trim().toLowerCase()));
  const teamTotals = teamDetail?.totals || {};
  const teamMatches = teamDetail?.matches || {};
  const teamPlayers = Number(teamTotals.players || 0);
  return <div>
    <PageHeader eyebrow="Administration privée" title="Vue d’ensemble plateforme" subtitle="Indicateurs globaux NXT5 en lecture seule. Cet espace est réservé à l’administrateur plateforme."><Button variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={load}>{loading ? "Actualisation…" : "Actualiser"}</Button></PageHeader>
    {error && <div className="mb-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([icon, label, value, g7, g30, tone]) => <KpiCard key={label} icon={icon} label={label} value={value} growth7={g7} growth30={g30} tone={tone} />)}</div>

    <Surface className="mt-4" glow>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100/70">Analyse par équipe</p><h3 className="mt-1 text-2xl font-black text-white">Données détaillées et anonymisées</h3><p className="mt-2 text-sm font-semibold text-slate-400">Volumes et usage produit sans afficher les joueurs, leurs identifiants ou les contenus du staff.</p></div><div className="grid w-full gap-2 sm:grid-cols-[1fr_1.2fr] lg:max-w-2xl"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Rechercher une équipe" className="nxt5-input-shell w-full rounded-xl border border-white/10 bg-black/25 py-3 pl-10 pr-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/50" /></label><select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="nxt5-input-shell w-full rounded-xl border border-white/10 bg-[#071221] px-3 py-3 text-sm font-black text-white outline-none focus:border-cyan-300/50">{filteredTeams.map((team) => <option key={team.id} value={team.id}>{team.name} [{team.tag}] · {team.players} joueurs · {team.matches} games</option>)}</select></div></div>
      {teamLoading ? <div className="py-8"><SkeletonRows count={3} /></div> : teamError ? <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">{teamError}</div> : teamDetail && <div className="mt-6 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-2xl font-black text-white">{teamDetail.team.name} <span className="text-cyan-200">[{teamDetail.team.tag}]</span></h4><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{teamDetail.team.region} · créée le {formatDate(teamDetail.team.createdAt)} · dernière game {formatDate(teamDetail.team.lastMatchAt)}</p></div><div className="flex flex-wrap gap-2"><Badge tone="cyan">{teamTotals.mainRolesCovered || 0}/5 rôles</Badge><Badge tone="purple">{teamTotals.playersPlannedCurrentWeek || 0} dispos cette semaine</Badge><Badge tone="green">{teamMatches.last30d || 0} games · 30 j</Badge></div></div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[.8fr_1.2fr]"><HealthScore score={teamDetail.health?.score || 0} /><div className="grid gap-3 sm:grid-cols-3"><BenchmarkMetric label="Joueurs" value={teamTotals.players} median={teamDetail.benchmark?.medianPlayers} /><BenchmarkMetric label="Games totales" value={teamTotals.matches} median={teamDetail.benchmark?.medianMatches} /><BenchmarkMetric label="Games · 30 j" value={teamMatches.last30d} median={teamDetail.benchmark?.medianMatches30d} /></div></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Rythme réel</p><p className="mt-1 text-sm font-semibold text-slate-300">Imports des 30 derniers jours</p></div><div className="text-right"><p className="text-2xl font-black text-white">{teamMatches.last30d || 0}</p><p className="text-xs font-semibold text-slate-500">{teamMatches.last7d || 0} cette semaine</p></div></div><div className="mt-4"><TeamMatchChart rows={teamDetail.daily || []} /></div></div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Signaux prioritaires</p><div className="mt-3 space-y-2">{(teamDetail.health?.signals || []).length ? teamDetail.health.signals.map((signal) => <div key={signal.title} className={cx("rounded-xl border p-3", signal.level === "critical" ? "border-rose-300/20 bg-rose-400/[0.07]" : signal.level === "warning" ? "border-amber-300/20 bg-amber-400/[0.07]" : signal.level === "positive" ? "border-emerald-300/20 bg-emerald-400/[0.07]" : "border-cyan-300/20 bg-cyan-400/[0.07]")}><p className="text-sm font-black text-white">{signal.title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{signal.detail}</p></div>) : <p className="text-sm font-semibold text-slate-400">Pas encore assez de données pour produire un signal fiable.</p>}</div></div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Complétude opérationnelle</p><div className="mt-4 space-y-3"><ProgressRow label="Rôles titulaires couverts" value={teamTotals.mainRolesCovered} total={5} suffix="rôles" /><ProgressRow label="Profils liés" value={teamTotals.linkedPlayers} total={teamPlayers} suffix="joueurs" /><ProgressRow label="Patch renseigné" value={teamMatches.withPatch} total={Number(teamTotals.matches || 0)} suffix="games" /><ProgressRow label="Durée exploitable" value={teamMatches.withDuration} total={Number(teamTotals.matches || 0)} suffix="games" /></div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Workflow staff</p><div className="mt-3 grid grid-cols-2 gap-2">{[["Reviews",teamTotals.reports,teamDetail.benchmark?.medianReports],["Compositions",teamTotals.compositions,teamDetail.benchmark?.medianCompositions],["Joueurs planifiés",teamTotals.playersPlannedCurrentWeek,null],["Objectifs",teamTotals.goals,null]].map(([label,value,median]) => <div key={label} className="rounded-lg bg-white/[0.04] p-3"><strong className="text-xl text-white">{value || 0}</strong><p className="mt-1 text-[0.62rem] font-bold uppercase text-slate-400">{label}</p>{median !== null && <p className="mt-1 text-[0.62rem] font-semibold text-cyan-200">Médiane : {decimal.format(Number(median || 0))}</p>}</div>)}</div></div></div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-black uppercase tracking-wider text-slate-500">Roster</span>{(teamDetail.roster || []).map((row) => <Badge key={`${row.role}-${row.status}`} tone={row.status === "MAIN" ? "green" : row.status === "SUB" ? "cyan" : "slate"}>{row.role} · {row.status} · {row.count}</Badge>)}</div>
      </div>}
    </Surface>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
      <Surface glow><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">30 derniers jours</p><h3 className="mt-1 text-xl font-black text-white">Activité quotidienne</h3></div><Activity className="h-5 w-5 text-cyan-200" /></div><div className="mt-5"><DailyChart rows={dashboard?.daily} /></div></Surface>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Surface><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Activité</p><div className="mt-4 grid grid-cols-2 gap-3">{[["Utilisateurs · 7 j", activity.activeUsers7d],["Utilisateurs · 30 j", activity.activeUsers30d],["Équipes · 7 j", activity.activeTeams7d],["Équipes · 30 j", activity.activeTeams30d]].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xl font-black text-white">{number.format(Number(value || 0))}</p><p className="mt-1 text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">{label}</p></div>)}</div><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-100"><Check className="h-4 w-4" />{number.format(Number(activity.verifiedUsers || 0))} comptes vérifiés</div></Surface>
        <Surface><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Moyennes par équipe</p><div className="mt-4 space-y-3">{[["Membres", averages.membersPerTeam],["Joueurs", averages.playersPerTeam],["Games", averages.matchesPerTeam]].map(([label,value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 last:border-0 last:pb-0"><span className="text-sm font-semibold text-slate-300">{label}</span><strong className="text-lg text-white">{decimal.format(Number(value || 0))}</strong></div>)}</div>{dashboard?.teamsByRegion?.length > 0 && <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-500">Régions principales</p><div className="mt-2 flex flex-wrap gap-2">{dashboard.teamsByRegion.slice(0, 5).map((row) => <Badge key={row.region} tone="slate">{row.region || "Autre"} · {number.format(Number(row.count || 0))}</Badge>)}</div></div>}</Surface>
      </div>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Surface><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">Adoption produit</p><h3 className="mt-1 text-xl font-black text-white">Fonctionnalités utilisées</h3></div><BarChart3 className="h-5 w-5 text-cyan-200" /></div><div className="mt-5 space-y-4">{[["Roster", adoption.roster],["Import de games", adoption.matches],["Champion pool", adoption.championPool],["Compositions", adoption.compositions],["Reviews", adoption.reports],["Planning", adoption.planning],["Objectifs joueurs", adoption.goals],["Archives", adoption.archives]].map(([label,value]) => <ProgressRow key={label} label={label} value={value} total={totalTeams} />)}</div></Surface>
      <Surface><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100/70">Parcours compte</p><h3 className="mt-1 text-xl font-black text-white">Activation et fidélité</h3></div><UserCheck className="h-5 w-5 text-fuchsia-200" /></div><div className="mt-5 space-y-4">{[["Emails vérifiés", accountFunnel.verified],["Membres d’une équipe", accountFunnel.usersInTeam],["Profils joueur liés", accountFunnel.usersLinkedToPlayer],["Vus sur 30 jours", accountFunnel.seen30d],["Anciens comptes revenus", accountFunnel.returning30d]].map(([label,value]) => <ProgressRow key={label} label={label} value={value} total={totalUsers} suffix="comptes" />)}</div><p className="mt-5 text-xs font-semibold leading-5 text-slate-500">Mesures agrégées uniquement : aucune adresse email, IP ou donnée de session n’est affichée.</p></Surface>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Surface><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">12 dernières semaines</p><h3 className="mt-1 text-xl font-black text-white">Rythme des imports</h3></div><Gamepad2 className="h-5 w-5 text-cyan-200" /></div><WeeklyChart rows={dashboard?.weekly || []} /><div className="mt-3 flex justify-between text-[0.62rem] font-bold uppercase tracking-wider text-slate-500"><span>{formatDate(dashboard?.weekly?.[0]?.date)}</span><span>{formatDate(dashboard?.weekly?.at(-1)?.date)}</span></div></Surface>
      <Surface><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Santé des données de game</p><div className="mt-4 grid grid-cols-2 gap-3">{[["Imports · 24 h", matchHealth.imports24h],["Imports · 7 j", matchHealth.imports7d],["Équipes actives · 30 j", matchHealth.importingTeams30d],["Durée moyenne", matchHealth.averageDurationSeconds ? `${Math.round(matchHealth.averageDurationSeconds / 60)} min` : "—"]].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xl font-black text-white">{typeof value === "number" ? number.format(value) : value}</p><p className="mt-1 text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">{label}</p></div>)}</div><div className="mt-4 space-y-3"><ProgressRow label="Patch renseigné" value={matchHealth.matchesWithPatch} total={totalMatches} suffix="games" /><ProgressRow label="Durée exploitable" value={matchHealth.matchesWithDuration} total={totalMatches} suffix="games" /></div><div className="mt-4 flex flex-wrap gap-2"><Badge tone="green">{matchHealth.wins || 0} victoires</Badge><Badge tone="red">{matchHealth.losses || 0} défaites</Badge><Badge tone="slate">{matchHealth.analyses || 0} analyses</Badge></div></Surface>
    </div>

    <Surface className="mt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Structure des effectifs</p><h3 className="mt-1 text-xl font-black text-white">Qualité des rosters</h3></div><Users className="h-5 w-5 text-cyan-200" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Compétiteurs", rosterHealth.competitors],["Staff", rosterHealth.staff],["Profils liés", rosterHealth.linked],["Riot ID configurés", rosterHealth.riotConfigured]].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-2xl font-black text-white">{number.format(Number(value || 0))}</p><p className="mt-1 text-xs font-bold text-slate-300">{label} · {percent(value, totalPlayers)}%</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Badge tone="green">{rosterHealth.main || 0} titulaires</Badge><Badge tone="cyan">{rosterHealth.substitutes || 0} remplaçants</Badge><Badge tone="slate">{rosterHealth.inactive || 0} inactifs</Badge></div></Surface>

    <Surface className="mt-4"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-200" /><h3 className="text-lg font-black text-white">Points d’attention</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Sans membre", attention.teamsWithoutMembers],["Sans joueur", attention.teamsWithoutPlayers],["Sans game", attention.teamsWithoutMatches]].map(([label,value]) => <div key={label} className={cx("rounded-xl border p-3", Number(value) ? "border-amber-300/20 bg-amber-400/[0.07]" : "border-emerald-300/15 bg-emerald-400/[0.05]")}><p className="text-2xl font-black text-white">{number.format(Number(value || 0))}</p><p className="mt-1 text-xs font-bold text-slate-300">Équipes {label.toLowerCase()}</p></div>)}</div></Surface>

    <div className="mt-4 grid gap-4 2xl:grid-cols-2">
      <Surface><div className="flex items-center justify-between"><h3 className="text-lg font-black text-white">Équipes récentes</h3><Badge tone="cyan">{dashboard?.recentTeams?.length || 0}</Badge></div><TableShell><thead className="bg-white/[0.035] text-[0.62rem] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-3">Équipe</th><th className="px-3 py-3">Propriétaire</th><th className="px-3 py-3">Volume</th><th className="px-3 py-3">Création</th><th className="px-3 py-3">Dernière game</th></tr></thead><tbody className="divide-y divide-white/10">{(dashboard?.recentTeams || []).map((team) => <tr key={team.id} className="text-slate-300"><td className="px-3 py-3"><strong className="block text-white">{team.name}</strong><span className="text-xs">{team.tag || "—"} · {team.region || "—"}</span></td><td className="px-3 py-3">{team.ownerName || "—"}</td><td className="px-3 py-3 text-xs">{team.memberCount || 0} membres<br />{team.playerCount || 0} joueurs · {team.matchCount || 0} games</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(team.createdAt)}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(team.lastMatchAt)}</td></tr>)}</tbody></TableShell>{!dashboard?.recentTeams?.length && <p className="mt-4 text-sm text-slate-400">Aucune équipe.</p>}</Surface>
      <Surface><div className="flex items-center justify-between"><h3 className="text-lg font-black text-white">Comptes récents</h3><Badge tone="purple">{dashboard?.recentUsers?.length || 0}</Badge></div><TableShell><thead className="bg-white/[0.035] text-[0.62rem] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-3">Compte</th><th className="px-3 py-3">État</th><th className="px-3 py-3">Équipes</th><th className="px-3 py-3">Création</th><th className="px-3 py-3">Dernière activité</th></tr></thead><tbody className="divide-y divide-white/10">{(dashboard?.recentUsers || []).map((row) => <tr key={row.id} className="text-slate-300"><td className="px-3 py-3"><strong className="block text-white">{row.name || row.accountName || "Compte"}</strong>{row.name && <span className="text-xs">@{row.accountName}</span>}</td><td className="px-3 py-3"><Badge tone={row.emailVerified ? "green" : "yellow"}>{row.emailVerified ? "Vérifié" : "À vérifier"}</Badge></td><td className="px-3 py-3">{row.teamCount || 0}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(row.createdAt)}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(row.lastSeenAt, true)}</td></tr>)}</tbody></TableShell>{!dashboard?.recentUsers?.length && <p className="mt-4 text-sm text-slate-400">Aucun compte.</p>}</Surface>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-semibold text-slate-500"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Lecture seule · aucune donnée sensible exposée</span><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Généré le {formatDate(dashboard?.generatedAt, true)}</span></div>
  </div>;
}
