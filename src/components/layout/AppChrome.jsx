import React from "react";
import { Activity, ArrowRight, AlertTriangle, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, FileText, LogOut, Menu, Plus, RefreshCw, Settings, ShieldCheck, Upload, Users, X } from "lucide-react";
import { MORE_NAV_IDS, NAV, PRIMARY_NAV_IDS } from "../../app/constants.jsx";
import { draftViewFromPath, draftViewLabel, pathFromPage, profileViewFromPath, profileViewLabel } from "../../app/routing.js";
import { cx, profileStatusLabel } from "../../app/helpers.js";
import { Nxt5Wordmark, ResponsiveImage, RoleIcon, TeamAvatar } from "../brand/BrandAssets.jsx";
import { Button, Surface } from "../ui/Core.jsx";
import AccountSubscription from "../account/AccountSubscription.jsx";
import "./app-chrome.css";

export function AmbientBackground() {
  return <div className="nxt5-ambient-bg nxt5-ambient-calm" aria-hidden="true"><div className="nxt5-ambient-light" /></div>;
}

const COMPASS_ICONS = { profile: Users, matches: Upload, reading: Activity, reports: FileText, planning: CalendarDays, "team-review": FileText };

export function BeginnerCompass({ steps = [], onNavigate, onClose, manager = true }) {
  const doneCount = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done && !step.disabled) || steps.find((step) => !step.done);
  if (!nextStep) return null;
  const Icon = COMPASS_ICONS[nextStep.id] || Users;
  return <section className="nxt5-start" aria-labelledby="nxt5-start-title">
    <Surface glow className="nxt5-start-surface">
      <div className="nxt5-start-meta"><span>{manager ? "Ton premier débrief" : "Tes premiers repères"}</span><span aria-live="polite">{doneCount} / {steps.length} terminées</span></div>
      <ol className="nxt5-start-progress" aria-label="Progression du démarrage">
        {steps.map((step, index) => <li key={step.id} className={cx(step.done && "is-done", nextStep.id === step.id && "is-current")} aria-current={nextStep.id === step.id ? "step" : undefined}>
          <span aria-hidden="true">{step.done ? <Check size={16} /> : `0${index + 1}`}</span><span>{step.label}<span className="sr-only">{step.done ? " : terminée" : step.disabled ? " : en attente" : " : à découvrir"}</span></span>
        </li>)}
      </ol>
      <div className="nxt5-start-focus">
        <span className="nxt5-start-icon" aria-hidden="true"><Icon size={30} /></span>
        <p className="nxt5-start-eyebrow">{nextStep.disabled ? "En attendant ton équipe" : "Ta prochaine action"}</p>
        <h2 id="nxt5-start-title">{nextStep.disabled ? "Ton espace se prépare" : nextStep.title}</h2>
        <p id="nxt5-start-description">{nextStep.disabled ? nextStep.reason : nextStep.description}</p>
        <Button type="button" icon={ArrowRight} aria-describedby="nxt5-start-description" onClick={() => onNavigate(nextStep.disabled ? "/equipes" : nextStep.path)}>{nextStep.disabled ? "Voir mon équipe" : nextStep.action}</Button>
        {!nextStep.disabled && <p className="nxt5-start-detail">{nextStep.detail}</p>}
      </div>
      <div className="nxt5-start-footer">
        <button type="button" onClick={() => onNavigate(`/guide?section=${nextStep.help}`)}><BookOpen size={16} aria-hidden="true" />Besoin d’aide pour cette étape ?</button>
        <button type="button" onClick={onClose}>Explorer librement<ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </Surface>
    <p className="nxt5-start-reassurance">Retrouve ce parcours à tout moment dans Accueil. Tu avances à ton rythme.</p>
  </section>;
}

export function ApiBanner({ error, onRetry, retrying = false }) {
  if (!error) return null;
  return <div className="nxt5-api-banner" role="alert">
    <AlertTriangle size={20} aria-hidden="true" />
    <div><p>Les données n’ont pas pu être actualisées</p><p>{error}</p></div>
    {onRetry && <Button type="button" variant="ghost" icon={RefreshCw} disabled={retrying} onClick={onRetry}>{retrying ? "Chargement…" : "Réessayer"}</Button>}
  </div>;
}

export function Sidebar({ active, setActive, open, setOpen, collapsed, setCollapsed, user, onLogout, currentMember, linkedPlayer, roleLabel, isPlatformAdmin = false }) {
  const status = profileStatusLabel(currentMember);
  const navItems = NAV.filter((item) => PRIMARY_NAV_IDS.includes(item.id) && !item.hidden);
  const moreItems = NAV.filter((item) => MORE_NAV_IDS.includes(item.id) && !item.hidden);
  const profileRole = linkedPlayer?.role || currentMember?.role || "";
  const sidebarRef = React.useRef(null);
  const closeRef = React.useRef(null);
  const [isDesktop, setIsDesktop] = React.useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    if (!open || isDesktop) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Visibility changes immediately: focusing a still-hidden drawer is ignored.
    closeRef.current?.focus({ preventScroll: true });
    const background = [...document.querySelectorAll(".nxt5-app-shell, .nxt5-assistant-launcher, .nxt5-workspace-skip")];
    const previousInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab") return;
      const controls = [...sidebarRef.current.querySelectorAll("button, a[href], [tabindex='0']")].filter((node) => !node.disabled && node.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!sidebarRef.current.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, isDesktop, setOpen]);

  const go = (event, pageId) => {
    const link = event.currentTarget;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    event.preventDefault();
    setActive(pageId);
    setOpen(false);
  };
  const renderNavItem = (item, showHint = true) => {
    const Icon = item.icon;
    const selected = active === item.id;
    const hintId = item.hint && showHint ? `nxt5-nav-${item.id}-hint` : undefined;
    return <a key={item.id} href={pathFromPage(item.id)} onClick={(event) => go(event, item.id)} aria-label={item.label} aria-describedby={hintId} aria-current={selected ? "page" : undefined} title={item.hint ? `${item.label} · ${item.hint}` : item.label} className={cx("nxt5-sidebar-link", selected && "is-active")}>
      <Icon size={19} aria-hidden="true" /><span className="nxt5-sidebar-label nxt5-sidebar-link-copy"><span>{item.label}</span>{hintId && <span id={hintId} className="nxt5-sidebar-hint">{item.hint}</span>}</span>
    </a>;
  };
  return <>
    {open && <div onClick={() => setOpen(false)} className="nxt5-sidebar-scrim" aria-hidden="true" />}
    <aside ref={sidebarRef} id="nxt5-sidebar" className={cx("nxt5-sidebar", collapsed && "is-collapsed", open && "is-open")} role={!isDesktop && open ? "dialog" : undefined} aria-modal={!isDesktop && open ? true : undefined} aria-label="Navigation NXT5" aria-hidden={!isDesktop && !open ? true : undefined}>
      <div className="nxt5-sidebar-brand">
        <div className="nxt5-sidebar-wordmark"><Nxt5Wordmark className="nxt5-sidebar-wordmark-image" /></div>
        <div className="nxt5-sidebar-symbol"><ResponsiveImage src="/assets/nxt5-loader-favicon.png" sources={[{ srcSet: "/assets/nxt5-loader-favicon-256.webp" }]} alt="NXT5" width="512" height="512" className="nxt5-sidebar-symbol-image" /></div>
        <button ref={closeRef} type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="nxt5-chrome-icon-button nxt5-sidebar-close"><X size={20} aria-hidden="true" /></button>
      </div>
      <nav className="nxt5-sidebar-navigation" aria-label="Espace équipe">
        <div className="nxt5-sidebar-group"><p className="nxt5-sidebar-group-label">Au quotidien</p>{navItems.map((item) => renderNavItem(item, false))}</div>
        {!!moreItems.length && <details className="nxt5-sidebar-group nxt5-sidebar-more" open={MORE_NAV_IDS.includes(active) ? true : undefined}><summary title="Préparation et partage"><ChevronDown size={17} aria-hidden="true" /><span className="nxt5-sidebar-label">Préparation et partage</span></summary>{moreItems.map((item) => renderNavItem(item, false))}</details>}
      </nav>
      <div className="nxt5-sidebar-footer">
        {isPlatformAdmin && <a href={pathFromPage("admin")} onClick={(event) => go(event, "admin")} aria-label="Administration" title="Administration" aria-current={["admin", "access-requests", "account-subscriptions"].includes(active) ? "page" : undefined} className={cx("nxt5-sidebar-link nxt5-sidebar-admin", ["admin", "access-requests", "account-subscriptions"].includes(active) && "is-active")}><ShieldCheck size={19} aria-hidden="true" /><span className="nxt5-sidebar-label">Administration</span></a>}
        <div className="nxt5-sidebar-account">
          <div className="nxt5-sidebar-account-identity"><span className="nxt5-sidebar-avatar"><RoleIcon role={profileRole} className="h-5 w-5" /></span><div className="nxt5-sidebar-label"><p title={user?.name || "Coach"}>{user?.name || "Coach"}</p><span title={linkedPlayer ? `${roleLabel(linkedPlayer.role)} · ${linkedPlayer.name}` : status}>{linkedPlayer ? `${roleLabel(linkedPlayer.role)} · ${linkedPlayer.name}` : status}</span></div></div>
          <div className="nxt5-sidebar-subscription nxt5-sidebar-label"><AccountSubscription key={user?.id} compact /></div>
        </div>
        {renderNavItem({ id: "account-settings", label: "Paramètres", icon: Settings })}
        <button type="button" className="nxt5-sidebar-link nxt5-sidebar-logout" aria-label="Déconnexion" title="Déconnexion" onClick={onLogout}><LogOut size={19} aria-hidden="true" /><span className="nxt5-sidebar-label">Déconnexion</span></button>
        <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Développer le menu" : "Réduire le menu"} aria-expanded={!collapsed} className="nxt5-sidebar-link nxt5-sidebar-collapse" title={collapsed ? "Développer le menu" : "Réduire le menu"}><ChevronRight size={18} className={collapsed ? "" : "rotate-180"} aria-hidden="true" /><span className="nxt5-sidebar-label">Réduire le menu</span></button>
      </div>
    </aside>
  </>;
}

export function Topbar({ active, setOpen, currentTeam, teams, onSelectTeam, onCreateTeam, onManageTeam, onHelp }) {
  const nav = NAV.find((item) => item.id === active) || NAV[0];
  const detailLabel = active === "profile" ? profileViewLabel(profileViewFromPath(window.location.pathname)) : active === "draft" ? draftViewLabel(draftViewFromPath(window.location.pathname)) : "";
  const [teamMenuOpen, setTeamMenuOpen] = React.useState(false);
  const teamPickerRef = React.useRef(null);
  const teamTriggerRef = React.useRef(null);
  const isAdmin = ["admin", "access-requests", "account-subscriptions"].includes(active);

  React.useEffect(() => {
    if (!teamMenuOpen) return undefined;
    const onPointerDown = (event) => { if (!teamPickerRef.current?.contains(event.target)) setTeamMenuOpen(false); };
    const onKeyDown = (event) => { if (event.key === "Escape") { setTeamMenuOpen(false); teamTriggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [teamMenuOpen]);

  return <header className="nxt5-topbar">
    <div className="nxt5-topbar-location">
      <button type="button" aria-label="Ouvrir le menu" aria-controls="nxt5-sidebar" onClick={() => setOpen(true)} className="nxt5-chrome-icon-button nxt5-topbar-menu"><Menu size={20} aria-hidden="true" /></button>
      <div className="nxt5-topbar-breadcrumb"><h1>{nav.label}</h1>{detailLabel && <><ChevronRight size={14} aria-hidden="true" /><span>{detailLabel}</span></>}</div>
    </div>
    {isAdmin ? <span className="nxt5-topbar-admin"><ShieldCheck size={16} aria-hidden="true" />Administration</span> : <div className="nxt5-topbar-actions">
      <div ref={teamPickerRef} className="nxt5-team-picker" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setTeamMenuOpen(false);
      }}>
        <button ref={teamTriggerRef} type="button" aria-expanded={teamMenuOpen} aria-controls="nxt5-team-picker-menu" aria-label={`Choisir une équipe : ${currentTeam?.name || "Aucune équipe"}`} title={currentTeam?.name || "Choisir une équipe"} onClick={() => setTeamMenuOpen((value) => !value)} className="nxt5-team-trigger">
          <span className="nxt5-team-trigger-avatar" aria-hidden="true"><TeamAvatar team={currentTeam} className="h-8 w-8" /></span><span>{currentTeam?.name || "Choisir une équipe"}</span><ChevronDown size={16} aria-hidden="true" />
        </button>
        {teamMenuOpen && <div className="nxt5-team-menu nxt5-enter-fast" id="nxt5-team-picker-menu">
          <p className="nxt5-team-menu-label">Mes équipes</p>
          <div className="nxt5-team-menu-list">{teams.map((team) => <button key={team.id} type="button" onClick={() => { onSelectTeam(team.id); setTeamMenuOpen(false); teamTriggerRef.current?.focus(); }} aria-pressed={currentTeam?.id === team.id} className={cx("nxt5-team-option", currentTeam?.id === team.id && "is-selected")}>
            <span aria-hidden="true"><TeamAvatar team={team} className="h-9 w-9 shrink-0" /></span><span className="nxt5-team-option-copy"><strong>{team.name}</strong><span>{team.tag || "TEAM"} · {team.region || "EUW"}</span></span>{currentTeam?.id === team.id && <Check size={16} aria-hidden="true" />}
          </button>)}</div>
          <button type="button" onClick={() => { onCreateTeam(); setTeamMenuOpen(false); }} className="nxt5-team-create"><Plus size={17} aria-hidden="true" />Créer ou rejoindre une équipe</button>
        </div>}
      </div>
      {onHelp && <button type="button" onClick={onHelp} className="nxt5-topbar-help" aria-label="Besoin d’aide ?"><BookOpen size={18} aria-hidden="true" /><span>Aide</span></button>}
      {currentTeam && !["home", "team-management"].includes(active) && <button type="button" onClick={onManageTeam} aria-label="Gestion de l’équipe" title="Gestion de l’équipe" className="nxt5-chrome-icon-button"><Settings size={18} aria-hidden="true" /></button>}
    </div>}
  </header>;
}
