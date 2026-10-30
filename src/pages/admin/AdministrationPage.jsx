import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, BarChart3, Bot, FileImage, History, LayoutDashboard, LogOut, Mail, Megaphone, Plug, Search, ShieldCheck, Users } from "lucide-react";
import { ADMIN_GROUPS, adminPageFromRoute } from "../../app/admin-navigation.js";
import { AdminNavigationContext } from "../../components/admin/AdminNavigationContext.jsx";
import { Nxt5Wordmark } from "../../components/brand/BrandAssets.jsx";
import { Button, PageHeader, SkeletonRows } from "../../components/ui/Core.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./administration-shell.css";
import "./admin-directory.css";

const GlobalStatsPage = lazy(() => import("./GlobalStatsPage.jsx"));
const AdminTeamTools = lazy(() => import("./AdminTeamTools.jsx"));
const AdminDirectory = lazy(() => import("./AdminDirectory.jsx"));
const AdminDashboard = lazy(() => import("./AdminDashboard.jsx"));
const AudiencePage = lazy(() => import("./AudiencePage.jsx"));
const BotAnalyticsPage = lazy(() => import("./BotAnalyticsPage.jsx"));
const BotPublicationsPage = lazy(() => import("./BotPublicationsPage.jsx"));
const IntegrationsPage = lazy(() => import("./IntegrationsPage.jsx"));
const ExportsPage = lazy(() => import("./ExportsPage.jsx"));

const ICONS = { "global-stats": BarChart3, overview: LayoutDashboard, accounts: Users, teams: Users, usage: Activity, audience: BarChart3, bot: Bot, "bot-publications": Megaphone, journal: History, reminders: Mail, integrations: Plug, exports: FileImage };

function AdminContent({ page, route, navigate, user }) {
  useLanguage();
  if (page.id === "global-stats") return <GlobalStatsPage />;
  if (page.id === "accounts" || page.id === "journal") return <AdminDirectory key={page.id} journal={page.id === "journal"} route={route} navigate={navigate} user={user} />;
  if (page.id === "teams") return <AdminTeamTools route={route} navigate={navigate} />;
  if (["overview", "usage", "reminders"].includes(page.id)) return <AdminDashboard view={page.id} teamFilter={new URLSearchParams(route.search).get("filtre") || "all"} onNavigate={navigate} initialTeamId={new URLSearchParams(route.search).get("teamId") || ""} />;
  if (page.id === "audience") return <AudiencePage />;
  if (page.id === "bot") return <BotAnalyticsPage route={route} navigate={navigate} />;
  if (page.id === "bot-publications") return <BotPublicationsPage />;
  if (page.id === "integrations") return <IntegrationsPage navigate={navigate} />;
  if (page.id === "exports") return <ExportsPage />;
  return null;
}

export default function AdministrationPage({ route, navigate, user, onLogout }) {
  useLanguage();
  const page = adminPageFromRoute(route);
  const [globalSearch, setGlobalSearch] = useState("");
  const content = useRef(null);
  const confirmation = useRef(null);
  const navigationSource = useRef(null);
  const [guard, setGuard] = useState({ dirty: false, disabled: false });
  const [pending, setPending] = useState(null);
  const previousPage = useRef(page?.id);
  useEffect(() => {
    if (previousPage.current !== page?.id) content.current?.focus({ preventScroll: true });
    previousPage.current = page?.id;
  }, [page?.id]);
  useEffect(() => { if (pending) confirmation.current?.focus(); }, [pending]);
  useEffect(() => { if (!guard.dirty) setPending(null); }, [guard.dirty]);
  useEffect(() => {
    if (!guard.dirty && !guard.disabled) return;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [guard.dirty, guard.disabled]);
  if (!page) return null;

  function go(path) {
    if (guard.disabled) return;
    if (path === `${route.path}${route.search || ""}`) return;
    if (guard.dirty) {
      navigationSource.current = document.activeElement;
      setPending({ path });
    } else navigate(path);
  }

  function logout() {
    if (guard.disabled) return;
    if (guard.dirty) {
      navigationSource.current = document.activeElement;
      setPending({ logout: true });
    } else onLogout?.();
  }

  function stay() {
    setPending(null);
    navigationSource.current?.focus?.();
  }

  function follow(event, path) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(path);
  }

  return <AdminNavigationContext.Provider value={setGuard}><div className="administration-shell">
    <a className="administration-skip" href="#administration-content">{t("Aller au contenu")}</a>
    <header className="administration-header">
      <div className="administration-brand"><a href="/admin" aria-label={t("Accueil de l’administration NXT5")} onClick={event => follow(event, "/admin")}><Nxt5Wordmark className="h-9 w-28 object-contain" /></a><h1>{t("Administration")}</h1></div>
      <form className="administration-global-search" role="search" onSubmit={event => { event.preventDefault(); go(`/admin/comptes?q=${encodeURIComponent(globalSearch.trim())}`); }}><Search size={18} aria-hidden="true" /><input aria-label={t("Rechercher un compte ou un profil")} placeholder={t("Rechercher un compte…")} value={globalSearch} onChange={event=>setGlobalSearch(event.target.value)} maxLength={120} disabled={guard.disabled} /><button type="submit" disabled={guard.disabled}>{t("Rechercher")}</button></form>
      <div className="administration-header-actions"><LinkButton href="/mon-equipe" navigate={go} variant="ghost" icon={ArrowLeft}>{t("Retour à l’app")}</LinkButton><LanguageSwitcher /></div>
    </header>
    <div className="administration-layout">
      <aside className="administration-sidebar">
        <div className="administration-mode"><ShieldCheck size={18} aria-hidden="true" /><span>{t("Espace administrateur")}</span></div>
        <nav aria-label={t("Rubriques de l’administration")}>
          {ADMIN_GROUPS.map(group => <div className="administration-nav-group" key={group.label}><p>{t(group.label)}</p>{group.pages.map(item => { const Icon = ICONS[item.id]; return <a key={item.id} href={item.path} aria-current={item.id === page.id ? "page" : undefined} aria-disabled={guard.disabled || undefined} onClick={event => follow(event, item.path)}><Icon size={18} aria-hidden="true" /><span>{t(item.label)}</span></a>; })}</div>)}
        </nav>
        <div className="administration-account"><span>{t("Connecté en tant que")}</span><strong>{user?.name || t("Administrateur")}</strong>{onLogout && <Button type="button" variant="ghost" icon={LogOut} disabled={guard.disabled} onClick={logout}>{t("Déconnexion")}</Button>}</div>
      </aside>
      <div className="administration-workspace">
        <label className="administration-mobile-menu">{t("Rubrique")}<select aria-label={t("Rubrique")} disabled={guard.disabled} value={page.path} onChange={event => go(event.target.value)}>{ADMIN_GROUPS.map(group => <optgroup key={group.label} label={t(group.label)}>{group.pages.map(item => <option key={item.id} value={item.path}>{t(item.label)}</option>)}</optgroup>)}</select></label>
        {pending && <div className="administration-leave-confirmation" ref={confirmation} tabIndex={-1} role="alert"><strong>{t("Modifications non enregistrées")}</strong><p>{t("Quitter cette rubrique abandonnera tes modifications.")}</p><div><Button type="button" variant="ghost" disabled={guard.disabled} onClick={stay}>{t("Rester sur cette page")}</Button><Button type="button" variant="ghost" disabled={guard.disabled} onClick={() => { if (guard.disabled) return; const target = pending; setPending(null); if (target.logout) onLogout?.(); else navigate(target.path); }}>{t("Quitter sans enregistrer")}</Button></div></div>}
        <div className="administration-breadcrumb"><span>NXT5</span><span aria-hidden="true">/</span><span>{t(page.group)}</span><span aria-hidden="true">/</span><strong>{t(page.label)}</strong></div>
        <main id="administration-content" className="nxt5-data-dense administration-page" ref={content} tabIndex={-1} aria-label={t(page.label)}>
          <Suspense fallback={<div role="status" aria-label={t("Chargement : {0}", [t(page.label)])}><SkeletonRows count={3} /></div>}><AdminContent page={page} route={route} navigate={go} user={user} /></Suspense>
        </main>
        {onLogout && <div className="administration-mobile-account"><span>{user?.name || t("Administrateur")}</span><Button type="button" variant="ghost" icon={LogOut} disabled={guard.disabled} onClick={logout}>{t("Déconnexion")}</Button></div>}
      </div>
    </div>
  </div></AdminNavigationContext.Provider>;
}
