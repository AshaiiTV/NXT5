import React from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, BookOpen, Check, ChevronDown, ChevronRight, FileText, LogOut, Menu, Plus, RefreshCw, Settings, Upload, Users, X } from "lucide-react";
import { MORE_NAV_IDS, NAV, PRIMARY_NAV_IDS } from "../../app/constants.jsx";
import { gameWorkspaceSectionFromPath, gameWorkspaceSectionLabel, profileViewFromPath, profileViewLabel } from "../../app/routing.js";
import { cx, profileStatusLabel, profileStatusTone } from "../../app/helpers.js";
import { Nxt5Wordmark, RoleIcon, TeamAvatar } from "../brand/BrandAssets.jsx";
import { Badge, Button } from "../ui/Core.jsx";

export function AmbientBackground() {
  return (
    <div className="nxt5-ambient-bg pointer-events-none fixed inset-0 overflow-hidden bg-[#020511]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(0,216,255,.24),transparent_28%),radial-gradient(circle_at_84%_8%,rgba(217,0,255,.19),transparent_30%),linear-gradient(118deg,rgba(16,76,190,.22)_0%,transparent_24%,transparent_66%,rgba(0,238,255,.14)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.048)_1px,transparent_1px)] bg-[size:54px_54px] opacity-[0.22]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(123deg,transparent_0,transparent_132px,rgba(0,216,255,.15)_133px,transparent_136px),repeating-linear-gradient(123deg,transparent_0,transparent_214px,rgba(217,0,255,.13)_215px,transparent_218px)]" />
      <div className="absolute left-[7%] top-[12%] h-[42rem] w-[42rem] rounded-full border border-cyan-300/10 shadow-[0_0_110px_rgba(0,216,255,.14)]" />
      <div className="absolute right-[9%] top-[10%] h-[31rem] w-[31rem] rounded-full border border-fuchsia-300/10 shadow-[0_0_110px_rgba(217,0,255,.12)]" />
      <div className="absolute left-[-12%] top-[30%] h-px w-[130%] rotate-[-13deg] bg-gradient-to-r from-transparent via-cyan-200/18 to-transparent" />
      <div className="absolute left-[-12%] top-[72%] h-px w-[130%] rotate-[-13deg] bg-gradient-to-r from-transparent via-fuchsia-200/16 to-transparent" />
      <motion.div animate={{ x: ["-14%", "118%"] }} transition={{ duration: 7.2, repeat: Infinity, repeatDelay: 2.8, ease: "easeInOut" }} className="absolute top-[17%] h-px w-[42vw] rotate-[-13deg] bg-gradient-to-r from-transparent via-cyan-100 to-transparent shadow-[0_0_34px_rgba(34,211,238,.82)]" />
      <motion.div animate={{ x: ["118%", "-18%"] }} transition={{ duration: 8.6, repeat: Infinity, repeatDelay: 3.6, ease: "easeInOut" }} className="absolute top-[61%] h-px w-[48vw] rotate-[-13deg] bg-gradient-to-r from-transparent via-fuchsia-100 to-transparent shadow-[0_0_34px_rgba(217,70,239,.76)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(2,5,17,.08)_42%,rgba(2,5,17,.94)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/80 to-fuchsia-100/70" />
    </div>
  );
}

export function BeginnerCompass({ active, data, currentTeam, onNavigate, onClose }) {
  if (!currentTeam) return null;
  const teamMatches = (data.matches || []).filter((match) => match.team_id === currentTeam.id);
  const teamPlayers = (data.players || []).filter((player) => player.team_id === currentTeam.id);
  const teamReports = (data.reports || []).filter((report) => report.team_id === currentTeam.id);
  const doneCount = [
    teamPlayers.length >= 5,
    teamMatches.length >= 1,
    teamMatches.length >= 3,
    teamReports.length >= 1,
  ].filter(Boolean).length;
  const steps = [
    { id: "teams", icon: Users, label: "Roster", text: teamPlayers.length >= 5 ? "Base prête" : "Ajoute les 5 joueurs", done: teamPlayers.length >= 5 },
    { id: "matches", icon: Upload, label: "Importer", text: teamMatches.length ? `${teamMatches.length} game${teamMatches.length > 1 ? "s" : ""}` : "Ajoute une game", done: teamMatches.length >= 1 },
    { id: "trends", icon: Activity, label: "Comprendre", text: teamMatches.length >= 3 ? "Tendances fiables" : "Lis les répétitions", done: teamMatches.length >= 3 },
    { id: "reports", icon: FileText, label: "Décider", text: teamReports.length ? `${teamReports.length} review${teamReports.length > 1 ? "s" : ""}` : "Écris une review", done: teamReports.length >= 1 },
  ];
  const nextStep = steps.find((step) => !step.done) || steps[2];
  return <section className="mb-4 overflow-hidden rounded-2xl border border-cyan-200/16 bg-[linear-gradient(135deg,rgba(8,18,31,.88),rgba(5,10,25,.68))] p-3 shadow-[0_12px_34px_rgba(0,0,0,.18)]">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="cyan">Démarrage guidé</Badge><Badge tone={doneCount >= 3 ? "green" : "orange"}>{doneCount}/4</Badge></div>
        <h2 className="mt-2 text-lg font-black text-white">Le chemin simple pour rendre NXT5 utile</h2>
        <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-300">Pas besoin de tout ouvrir. Suis ces quatre étapes : structure, import, compréhension, décision.</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" icon={nextStep.icon} onClick={() => onNavigate(nextStep.id)} className="px-3 py-2 text-xs">Continuer : {nextStep.label}</Button>
        <Button type="button" variant="ghost" icon={X} onClick={onClose} className="px-3 py-2 text-xs">Masquer</Button>
      </div>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const selected = active === step.id || (step.id === "matches" && active === "stats");
        return <button key={step.id} type="button" onClick={() => onNavigate(step.id)} className={cx("flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition", selected ? "border-cyan-200/32 bg-cyan-300/10" : step.done ? "border-emerald-200/16 bg-emerald-300/[0.045]" : "border-white/10 bg-white/[0.028] hover:border-cyan-200/20 hover:bg-cyan-300/[0.055]")}>
          <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-black", step.done ? "border-emerald-200/24 bg-emerald-300/10 text-emerald-100" : "border-cyan-200/18 bg-cyan-300/10 text-cyan-100")}>{step.done ? <Check className="h-4 w-4" /> : `0${index + 1}`}</span>
          <span className="min-w-0"><span className="flex items-center gap-1.5 truncate text-xs font-black text-white"><Icon className="h-3.5 w-3.5 shrink-0" />{step.label}</span><span className="mt-0.5 block truncate text-[0.64rem] font-semibold text-slate-400">{step.text}</span></span>
        </button>;
      })}
    </div>
  </section>;
}

export function ApiBanner({ error, onRetry, retrying = false }) {
  if (!error) return null;
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-3xl border border-amber-300/25 bg-amber-500/10 p-4 text-amber-100 shadow-xl shadow-amber-950/10"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-200/10 p-2"><AlertTriangle className="h-5 w-5" /></div><div><p className="font-black">Endpoint/API non disponible</p><p className="mt-1 text-sm leading-6 text-amber-100/75">{error}</p></div></div>{onRetry && <Button type="button" variant="ghost" icon={retrying ? Upload : RefreshCw} disabled={retrying} onClick={onRetry} className="shrink-0 border-amber-200/20 bg-amber-200/10 text-amber-50 hover:border-amber-200/45 hover:bg-amber-200/15">{retrying ? "Chargement..." : "Réessayer"}</Button>}</div></motion.div>;
}

export function Sidebar({ active, setActive, open, setOpen, collapsed, setCollapsed, user, onLogout, currentMember, linkedPlayer, roleLabel }) {
  const status = profileStatusLabel(currentMember);
  const navItems = NAV.filter((item) => PRIMARY_NAV_IDS.includes(item.id) && !item.hidden);
  const moreItems = NAV.filter((item) => MORE_NAV_IDS.includes(item.id) && !item.hidden);
  const profileRole = linkedPlayer?.role || currentMember?.role || "";
  const go = (pageId) => {
    setActive(pageId);
    setOpen(false);
  };
  return (
    <>
      <React.Fragment>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/65 backdrop-blur-sm lg:hidden" />}</React.Fragment>
      <aside className={cx("nxt5-sidebar fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-cyan-200/18 bg-[#050917]/90 p-3 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl transition-all duration-300 lg:translate-x-0", collapsed ? "is-collapsed lg:w-24" : "lg:w-[19rem]", open ? "translate-x-0 w-[19rem] max-w-[calc(100vw-1rem)]" : "-translate-x-full w-[19rem] max-w-[calc(100vw-1rem)]")}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(34,211,238,.12),transparent_28%,rgba(217,70,239,.10)_72%,transparent),repeating-linear-gradient(90deg,transparent_0_46px,rgba(255,255,255,.025)_47px,transparent_48px)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-200/65 to-fuchsia-200/30" />
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="absolute -right-4 top-6 hidden h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/18 bg-[#070d1d] text-cyan-100 shadow-xl shadow-black/40 transition hover:border-cyan-300/45 hover:bg-cyan-400/10 lg:flex" title={collapsed ? "Afficher le menu" : "Cacher le menu"}>
          <ChevronRight className={cx("h-5 w-5 transition", !collapsed && "rotate-180")} />
        </button>
        <div className={cx("relative z-10 mb-5 flex min-h-20 items-center", collapsed ? "justify-center" : "justify-between")}>
          <div className="flex min-w-0 flex-1 justify-center"><Nxt5Wordmark className={cx("w-full object-contain object-center transition-all duration-300", collapsed ? "h-[4.75rem] max-w-[15rem] lg:h-8 lg:max-w-[4.25rem]" : "h-[4.75rem] max-w-[15rem]")} /></div>
          <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="relative z-10 flex-1 space-y-1.5 overflow-y-auto pr-1">
          <p className={cx("px-3 pb-1 text-[0.56rem] font-black uppercase tracking-[0.18em] text-cyan-100/50", collapsed && "lg:hidden")}>Essentiel</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return <button key={item.id} onClick={() => go(item.id)} title={item.label} className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ? "justify-center px-2 lg:justify-center" : "px-3", selected ? "border-cyan-200/26 bg-gradient-to-r from-cyan-500/26 via-blue-500/14 to-fuchsia-500/18 text-white shadow-[0_0_26px_rgba(34,211,238,.10)]" : "border-transparent text-slate-400 hover:border-cyan-200/16 hover:bg-white/[0.055] hover:text-white")}>
              <Icon className={cx("h-5 w-5 shrink-0 transition", selected ? "text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.45)]" : "text-slate-300 group-hover:text-cyan-200")} />
              <span className={cx("min-w-0", collapsed && "lg:hidden")}><span className="block truncate">{item.label}</span>{item.hint && <span className="mt-0.5 block truncate text-[0.64rem] font-semibold text-slate-500 group-hover:text-slate-300">{item.hint}</span>}</span>
            </button>;
          })}
          {!!moreItems.length && <div className="pt-1">
            <div className={cx("mb-1 border-t border-cyan-200/10", collapsed && "lg:mx-2")} />
            <div className={cx("space-y-1", !collapsed && "pt-1")}>
              <p className={cx("px-3 pb-1 text-[0.56rem] font-black uppercase tracking-[0.18em] text-slate-500", collapsed && "lg:hidden")}>Avancé</p>
              {moreItems.map((item) => {
                const Icon = item.icon;
                const selected = active === item.id;
                return <button key={item.id} type="button" onClick={() => go(item.id)} title={item.label} className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ? "justify-center px-2 lg:justify-center" : "px-3", selected ? "border-cyan-200/26 bg-gradient-to-r from-cyan-500/20 via-blue-500/12 to-fuchsia-500/16 text-white shadow-[0_0_22px_rgba(34,211,238,.09)]" : "border-transparent text-slate-400 hover:border-cyan-200/16 hover:bg-white/[0.055] hover:text-white")}>
                  <Icon className={cx("h-5 w-5 shrink-0 transition", selected ? "text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.35)]" : "text-slate-300 group-hover:text-cyan-200")} />
                  <span className={cx("min-w-0", collapsed && "lg:hidden")}><span className="block truncate">{item.label}</span>{item.hint && <span className="mt-0.5 block truncate text-[0.64rem] font-semibold text-slate-500 group-hover:text-slate-300">{item.hint}</span>}</span>
                </button>;
              })}
            </div>
          </div>}
        </nav>
        <div className="relative z-10 shrink-0 space-y-3 pt-3">
          <button type="button" onClick={() => go("guide")} title="Guide" className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ? "justify-center px-2 lg:justify-center" : "px-3", active === "guide" ? "border-cyan-300/35 bg-cyan-400/[0.075] text-white shadow-[0_0_22px_rgba(34,211,238,.10)]" : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.055] hover:text-white")}><BookOpen className={cx("h-5 w-5 shrink-0 transition", active === "guide" ? "text-cyan-100" : "text-slate-300 group-hover:text-cyan-200")} /><span className={cx("truncate", collapsed && "lg:hidden")}>Guide</span></button>
          <div className={cx("nxt5-panel nxt5-premium-panel relative w-full max-w-full overflow-hidden border border-cyan-200/16 text-left backdrop-blur-2xl", collapsed ? "p-2" : "p-2.5")}><div className="relative z-10"><div className={cx("flex items-center gap-3", collapsed && "lg:justify-center")}><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/18 bg-cyan-400/10 text-cyan-200"><RoleIcon role={profileRole} className="h-5 w-5" /></div><div className={cx("min-w-0", collapsed && "lg:hidden")}><p className="truncate text-sm font-black text-white">{user?.name || "Coach"}</p><p className="truncate text-xs font-semibold text-slate-300">{linkedPlayer ? `${roleLabel(linkedPlayer.role)} · ${linkedPlayer.name}` : status}</p></div></div><div className={cx("mt-2 flex flex-wrap gap-1.5", collapsed && "lg:hidden")}><Badge tone={profileStatusTone(currentMember)}>{status}</Badge>{linkedPlayer && <Badge tone="cyan">Profil lié</Badge>}</div></div></div>
          <button type="button" onClick={() => go("account-settings")} title="Paramètres" className={cx("group flex w-full items-center gap-3 rounded-xl border py-2.5 text-left text-sm font-black transition duration-200", collapsed ? "justify-center px-2 lg:justify-center" : "px-3", active === "account-settings" ? "border-cyan-300/35 bg-cyan-400/[0.075] text-white shadow-[0_0_22px_rgba(34,211,238,.10)]" : "border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.055] hover:text-white")}><Settings className={cx("h-5 w-5 shrink-0 transition", active === "account-settings" ? "text-cyan-100" : "text-slate-300 group-hover:text-cyan-200")} /><span className={cx("truncate", collapsed && "lg:hidden")}>Paramètres</span></button>
          <Button variant="ghost" icon={LogOut} onClick={onLogout} className={cx("w-full", collapsed ? "justify-center px-0" : "justify-start")}><span className={cx(collapsed && "lg:hidden")}>Déconnexion</span></Button>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ active, setOpen, currentTeam, teams, onSelectTeam, onCreateTeam, onManageTeam }) {
  const nav = NAV.find((item) => item.id === active) || NAV[0];
  const navLabel = active === "profile" ? `${nav.label} > ${profileViewLabel(profileViewFromPath(window.location.pathname))}` : active === "matches" ? `${nav.label} > ${gameWorkspaceSectionLabel(gameWorkspaceSectionFromPath(window.location.pathname))}` : nav.label;
  const [teamMenuOpen, setTeamMenuOpen] = React.useState(false);
  return <header className="sticky top-0 z-20 border-b border-cyan-200/14 bg-[#030714]/82 px-3 py-3 text-white shadow-[0_12px_40px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:px-4 sm:py-4 lg:px-8"><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,.09),transparent_34%,rgba(217,70,239,.08))]" /><div className="relative flex flex-wrap items-center justify-between gap-2 sm:gap-3"><div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"><button onClick={() => setOpen(true)} className="shrink-0 rounded-xl border border-cyan-100/14 bg-white/[0.045] p-2 lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden md:block"><TeamAvatar team={currentTeam} /></div><div className="relative min-w-0"><p className="truncate text-[0.62rem] font-black uppercase tracking-[0.2em] text-cyan-100/75 sm:text-[0.68rem] sm:tracking-[0.26em]">{navLabel}</p><button onClick={() => setTeamMenuOpen((open) => !open)} className="mt-0.5 flex max-w-[48vw] items-center gap-1 rounded-xl px-0 py-0 text-left transition hover:text-cyan-100 sm:max-w-[58vw] sm:gap-2"><h1 className="nxt5-metal-text truncate text-lg font-black tracking-tight sm:text-xl md:text-2xl">{currentTeam?.name || nav.label}</h1><ChevronDown className="h-4 w-4 shrink-0 text-cyan-200 sm:h-5 sm:w-5" /></button><React.Fragment>{teamMenuOpen && <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="nxt5-panel absolute left-0 top-[calc(100%+0.6rem)] z-50 w-[min(92vw,380px)] overflow-hidden border border-cyan-200/30 bg-[#050814] p-2 shadow-[0_30px_80px_rgba(0,0,0,.72),0_0_36px_rgba(34,211,238,.16)] ring-1 ring-white/10"><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,.12),rgba(5,8,20,.96)_42%,rgba(217,70,239,.10))]" /> <div className="relative z-10">{teams.map((team) => <button key={team.id} onClick={() => { onSelectTeam(team.id); setTeamMenuOpen(false); }} className={cx("flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition", currentTeam?.id === team.id ? "border-cyan-200/25 bg-cyan-400/14 text-white shadow-[0_0_22px_rgba(34,211,238,.10)]" : "border-transparent bg-[#070d1c] text-slate-200 hover:border-cyan-200/18 hover:bg-[#0b1428] hover:text-white")}><span className="flex min-w-0 items-center gap-3"><TeamAvatar team={team} className="h-9 w-9 shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-black">{team.name}</span><span className="mt-1 block text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-300">{team.tag || "TEAM"} · {team.region || "EUW"}</span></span></span>{currentTeam?.id === team.id && <Check className="h-4 w-4 shrink-0 text-cyan-200" />}</button>)}<button onClick={() => { onCreateTeam(); setTeamMenuOpen(false); }} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-cyan-100/22 bg-[#071221] px-4 py-3 text-left text-sm font-black text-cyan-100 transition hover:border-cyan-200/35 hover:bg-cyan-400/12"><Plus className="h-4 w-4" />Créer une nouvelle team</button></div></motion.div>}</React.Fragment></div></div>{currentTeam && active !== "team-management" && <Button variant="ghost" icon={Settings} onClick={onManageTeam} className="shrink-0 px-3 sm:px-4"><span className="hidden sm:inline">Gestion</span></Button>}</div></header>;
}
