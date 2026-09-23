import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, BarChart3, Bot, ClipboardList, FileCheck2, FileImage, LayoutDashboard, LogOut, Mail, Plug, ShoppingBag, Tag, Users } from "lucide-react";
import { ADMIN_GROUPS, adminPageFromRoute } from "../../app/admin-navigation.js";
import { AdminNavigationContext } from "../../components/admin/AdminNavigationContext.jsx";
import { Nxt5Wordmark } from "../../components/brand/BrandAssets.jsx";
import { Button, PageHeader, SkeletonRows } from "../../components/ui/Core.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import "./administration.css";

const AdminDashboard = lazy(() => import("./AdminDashboard.jsx"));
const AudiencePage = lazy(() => import("./AudiencePage.jsx"));
const BotAnalyticsPage = lazy(() => import("./BotAnalyticsPage.jsx"));
const AccessRequestsPage = lazy(() => import("./AccessRequestsPage.jsx"));
const AccountSubscriptionsPage = lazy(() => import("./AccountSubscriptionsPage.jsx"));
const PricingPage = lazy(() => import("../public/PricingPage.jsx"));
const IntegrationsPage = lazy(() => import("./IntegrationsPage.jsx"));
const ExportsPage = lazy(() => import("./ExportsPage.jsx"));
const LegalReadinessPage = lazy(() => import("./IntegrationsPage.jsx").then(module => ({ default: module.LegalReadinessPage })));
const PurchaseHistory = lazy(() => import("./Purchases.jsx").then(module => ({ default: module.PurchaseHistory })));
const PurchaseOverview = lazy(() => import("./Purchases.jsx").then(module => ({ default: module.PurchaseOverview })));

const ICONS = { overview: LayoutDashboard, teams: Users, usage: Activity, audience: BarChart3, bot: Bot, purchases: ShoppingBag, requests: ClipboardList, subscriptions: Users, pricing: Tag, launch: FileCheck2, reminders: Mail, integrations: Plug, exports: FileImage };

function AdminContent({ page, route, navigate, user }) {
  if (["overview", "teams", "usage", "reminders"].includes(page.id)) return <AdminDashboard view={page.id} teamFilter={new URLSearchParams(route.search).get("filtre") || "all"} onNavigate={navigate} />;
  if (page.id === "audience") return <AudiencePage />;
  if (page.id === "bot") return <BotAnalyticsPage route={route} navigate={navigate} />;
  if (page.id === "requests") return <AccessRequestsPage navigate={navigate} embedded />;
  if (page.id === "subscriptions") return <AccountSubscriptionsPage navigate={navigate} embedded initialUserId={new URLSearchParams(route.search).get("userId") || ""} />;
  if (page.id === "pricing") return <PricingPage navigate={navigate} user={user} embedded />;
  if (page.id === "integrations") return <IntegrationsPage navigate={navigate} />;
  if (page.id === "exports") return <ExportsPage />;
  if (page.id === "launch") return <LegalReadinessPage />;
  return <PurchasesPage />;
}

function PurchasesPage() {
  const [showSummary, setShowSummary] = useState(false);
  return <div className="administration-purchases">
    <PageHeader eyebrow="Ventes et accès" title="Achats" subtitle="Retrouve les commandes, les paiements et le bilan commercial au même endroit." />
    <PurchaseHistory />
    <details className="administration-purchase-summary" onToggle={event => { if (event.currentTarget.open) setShowSummary(true); }}><summary><BarChart3 size={18} aria-hidden="true" /><span>Bilan des achats<small>Chiffres clés et évolution des commandes</small></span></summary>{showSummary && <Suspense fallback={<div role="status"><SkeletonRows count={2} /></div>}><PurchaseOverview /></Suspense>}</details>
  </div>;
}

export default function AdministrationPage({ route, navigate, user, onLogout }) {
  const page = adminPageFromRoute(route);
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
    <a className="administration-skip" href="#administration-content">Aller au contenu</a>
    <header className="administration-header">
      <div className="administration-brand"><a href="/admin" aria-label="Accueil de l’administration NXT5" onClick={event => follow(event, "/admin")}><Nxt5Wordmark className="h-9 w-28 object-contain" /></a><h1>Administration</h1></div>
      <LinkButton href="/equipes" navigate={go} variant="ghost" icon={ArrowLeft}>Retour à l’app</LinkButton>
    </header>
    <div className="administration-layout">
      <aside className="administration-sidebar">
        <nav aria-label="Rubriques de l’administration">
          {ADMIN_GROUPS.map(group => <div className="administration-nav-group" key={group.label}><p>{group.label}</p>{group.pages.map(item => { const Icon = ICONS[item.id]; return <a key={item.id} href={item.path} aria-current={item.id === page.id ? "page" : undefined} aria-disabled={guard.disabled || undefined} onClick={event => follow(event, item.path)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span></a>; })}</div>)}
        </nav>
        <div className="administration-account"><span>Connecté en tant que</span><strong>{user?.name || "Administrateur"}</strong>{onLogout && <Button type="button" variant="ghost" icon={LogOut} disabled={guard.disabled} onClick={logout}>Déconnexion</Button>}</div>
      </aside>
      <div className="administration-workspace">
        <label className="administration-mobile-menu">Rubrique<select aria-label="Rubrique" disabled={guard.disabled} value={page.path} onChange={event => go(event.target.value)}>{ADMIN_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.pages.map(item => <option key={item.id} value={item.path}>{item.label}</option>)}</optgroup>)}</select></label>
        {pending && <div className="administration-leave-confirmation" ref={confirmation} tabIndex={-1} role="alert"><strong>Modifications non enregistrées</strong><p>Quitter cette rubrique abandonnera tes modifications.</p><div><Button type="button" variant="ghost" disabled={guard.disabled} onClick={stay}>Rester sur cette page</Button><Button type="button" variant="ghost" disabled={guard.disabled} onClick={() => { if (guard.disabled) return; const target = pending; setPending(null); if (target.logout) onLogout?.(); else navigate(target.path); }}>Quitter sans enregistrer</Button></div></div>}
        <main id="administration-content" className="nxt5-data-dense administration-page" ref={content} tabIndex={-1} aria-label={page.label}>
          <Suspense fallback={<div role="status" aria-label={`Chargement : ${page.label}`}><SkeletonRows count={3} /></div>}><AdminContent page={page} route={route} navigate={go} user={user} /></Suspense>
        </main>
        {onLogout && <div className="administration-mobile-account"><span>{user?.name || "Administrateur"}</span><Button type="button" variant="ghost" icon={LogOut} disabled={guard.disabled} onClick={logout}>Déconnexion</Button></div>}
      </div>
    </div>
  </div></AdminNavigationContext.Provider>;
}
