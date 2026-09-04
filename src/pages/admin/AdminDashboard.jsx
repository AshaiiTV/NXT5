import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Check, Clock3, Gamepad2, Loader2, RefreshCw, ShieldCheck, UserCheck, Users } from "lucide-react";
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
  if (!points.length) return <EmptyState icon={BarChart3} title="Pas encore de tendance" text="Les données quotidiennes apparaîtront ici dès la première activité." />;
  return <div>
    <div className="flex h-52 items-end gap-1 sm:gap-1.5" aria-label="Activité quotidienne sur 30 jours">
      {points.map((row, index) => {
        const total = Number(row.users || 0) + Number(row.teams || 0) + Number(row.matches || 0);
        const height = Math.max(2, (total / max) * 100);
        const verticalPosition = height > 62 ? "top-2" : "bottom-[calc(100%+8px)]";
        const horizontalPosition = index === 0 ? "left-0" : index === points.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
        return <div key={row.date} className="group relative flex min-w-0 flex-1 items-end" style={{ height: `${height}%` }} title={`${formatDate(row.date)} : ${total} événements`}><div className="h-full min-h-[3px] w-full rounded-t-sm bg-gradient-to-t from-cyan-500 via-blue-500 to-fuchsia-400 opacity-75 transition group-hover:opacity-100 group-focus-within:opacity-100" /><div className={cx("pointer-events-none absolute z-30 hidden w-40 rounded-xl border border-cyan-100/25 bg-[#030712]/[0.98] p-3 text-xs leading-5 text-white shadow-[0_16px_45px_rgba(0,0,0,.8),0_0_22px_rgba(34,211,238,.16)] backdrop-blur-xl group-hover:block", verticalPosition, horizontalPosition)}><p className="font-black text-cyan-50">{formatDate(row.date)}</p><p className="mt-1 font-semibold text-slate-100">{row.users || 0} comptes · {row.teams || 0} équipes · {row.matches || 0} games</p></div></div>;
      })}
    </div>
    <div className="mt-3 flex justify-between text-[0.62rem] font-bold uppercase tracking-wider text-slate-500"><span>{formatDate(points[0]?.date)}</span><span>{formatDate(points.at(-1)?.date)}</span></div>
  </div>;
}

function TableShell({ children }) {
  return <div className="mt-4 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[720px] text-left text-sm">{children}</table></div>;
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDashboard(await apiFetch("admin-dashboard", { timeoutMs: 20000 })); }
    catch (err) { setError(err.message || "Impossible de charger le dashboard administrateur."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

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
  return <div>
    <PageHeader eyebrow="Administration privée" title="Vue d’ensemble plateforme" subtitle="Indicateurs globaux NXT5 en lecture seule. Cet espace est réservé à l’administrateur plateforme."><Button variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={load}>{loading ? "Actualisation…" : "Actualiser"}</Button></PageHeader>
    {error && <div className="mb-4 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([icon, label, value, g7, g30, tone]) => <KpiCard key={label} icon={icon} label={label} value={value} growth7={g7} growth30={g30} tone={tone} />)}</div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
      <Surface glow><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">30 derniers jours</p><h3 className="mt-1 text-xl font-black text-white">Activité quotidienne</h3></div><Activity className="h-5 w-5 text-cyan-200" /></div><div className="mt-5"><DailyChart rows={dashboard?.daily} /></div></Surface>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Surface><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Activité</p><div className="mt-4 grid grid-cols-2 gap-3">{[["Utilisateurs · 7 j", activity.activeUsers7d],["Utilisateurs · 30 j", activity.activeUsers30d],["Équipes · 7 j", activity.activeTeams7d],["Équipes · 30 j", activity.activeTeams30d]].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xl font-black text-white">{number.format(Number(value || 0))}</p><p className="mt-1 text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">{label}</p></div>)}</div><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-100"><Check className="h-4 w-4" />{number.format(Number(activity.verifiedUsers || 0))} comptes vérifiés</div></Surface>
        <Surface><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Moyennes par équipe</p><div className="mt-4 space-y-3">{[["Membres", averages.membersPerTeam],["Joueurs", averages.playersPerTeam],["Games", averages.matchesPerTeam]].map(([label,value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 last:border-0 last:pb-0"><span className="text-sm font-semibold text-slate-300">{label}</span><strong className="text-lg text-white">{decimal.format(Number(value || 0))}</strong></div>)}</div>{dashboard?.teamsByRegion?.length > 0 && <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-500">Régions principales</p><div className="mt-2 flex flex-wrap gap-2">{dashboard.teamsByRegion.slice(0, 5).map((row) => <Badge key={row.region} tone="slate">{row.region || "Autre"} · {number.format(Number(row.count || 0))}</Badge>)}</div></div>}</Surface>
      </div>
    </div>

    <Surface className="mt-4"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-200" /><h3 className="text-lg font-black text-white">Points d’attention</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Sans membre", attention.teamsWithoutMembers],["Sans joueur", attention.teamsWithoutPlayers],["Sans game", attention.teamsWithoutMatches]].map(([label,value]) => <div key={label} className={cx("rounded-xl border p-3", Number(value) ? "border-amber-300/20 bg-amber-400/[0.07]" : "border-emerald-300/15 bg-emerald-400/[0.05]")}><p className="text-2xl font-black text-white">{number.format(Number(value || 0))}</p><p className="mt-1 text-xs font-bold text-slate-300">Équipes {label.toLowerCase()}</p></div>)}</div></Surface>

    <div className="mt-4 grid gap-4 2xl:grid-cols-2">
      <Surface><div className="flex items-center justify-between"><h3 className="text-lg font-black text-white">Équipes récentes</h3><Badge tone="cyan">{dashboard?.recentTeams?.length || 0}</Badge></div><TableShell><thead className="bg-white/[0.035] text-[0.62rem] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-3">Équipe</th><th className="px-3 py-3">Propriétaire</th><th className="px-3 py-3">Volume</th><th className="px-3 py-3">Création</th><th className="px-3 py-3">Dernière game</th></tr></thead><tbody className="divide-y divide-white/10">{(dashboard?.recentTeams || []).map((team) => <tr key={team.id} className="text-slate-300"><td className="px-3 py-3"><strong className="block text-white">{team.name}</strong><span className="text-xs">{team.tag || "—"} · {team.region || "—"}</span></td><td className="px-3 py-3">{team.ownerName || "—"}</td><td className="px-3 py-3 text-xs">{team.memberCount || 0} membres<br />{team.playerCount || 0} joueurs · {team.matchCount || 0} games</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(team.createdAt)}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(team.lastMatchAt)}</td></tr>)}</tbody></TableShell>{!dashboard?.recentTeams?.length && <p className="mt-4 text-sm text-slate-400">Aucune équipe.</p>}</Surface>
      <Surface><div className="flex items-center justify-between"><h3 className="text-lg font-black text-white">Comptes récents</h3><Badge tone="purple">{dashboard?.recentUsers?.length || 0}</Badge></div><TableShell><thead className="bg-white/[0.035] text-[0.62rem] uppercase tracking-wider text-slate-400"><tr><th className="px-3 py-3">Compte</th><th className="px-3 py-3">État</th><th className="px-3 py-3">Équipes</th><th className="px-3 py-3">Création</th><th className="px-3 py-3">Dernière activité</th></tr></thead><tbody className="divide-y divide-white/10">{(dashboard?.recentUsers || []).map((row) => <tr key={row.id} className="text-slate-300"><td className="px-3 py-3"><strong className="block text-white">{row.name || row.accountName || "Compte"}</strong>{row.name && <span className="text-xs">@{row.accountName}</span>}</td><td className="px-3 py-3"><Badge tone={row.emailVerified ? "green" : "yellow"}>{row.emailVerified ? "Vérifié" : "À vérifier"}</Badge></td><td className="px-3 py-3">{row.teamCount || 0}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(row.createdAt)}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(row.lastSeenAt, true)}</td></tr>)}</tbody></TableShell>{!dashboard?.recentUsers?.length && <p className="mt-4 text-sm text-slate-400">Aucun compte.</p>}</Surface>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.68rem] font-semibold text-slate-500"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Lecture seule · aucune donnée sensible exposée</span><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Généré le {formatDate(dashboard?.generatedAt, true)}</span></div>
  </div>;
}
