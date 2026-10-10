import { useLanguage } from "./i18n/useLanguage.js";
import { t } from "./i18n/translate.js";
import React, { startTransition, useCallback, useEffect, useState, Suspense, useRef, lazy } from "react";
import { apiFetch, API_BASE } from "./api/client.js";
import { NAV } from "./app/constants.jsx";
import { adminPageFromRoute } from "./app/admin-navigation.js";
import { PERFORMANCE_MODE_STORAGE_KEY, configurePerformanceMode } from "./app/performance.js";
import { authModeFromPath, buildLoginRedirect, gameWorkspaceSectionFromPath, gameWorkspaceSectionLabel, isAdminPath, isAppPath, profileViewFromPath, profileViewLabel, readRoute, isKnownPath } from "./app/routing.js";
import CookieConsent from "./components/privacy/CookieConsent.jsx";
import { reviewDrafts } from "./utils/review-drafts.js";
import { ToastStack, Surface, Badge, Button } from "./components/ui/Core.jsx";
import { AuthPage, ForgotPasswordPage, HomeScreen, LEGAL_PAGES, LegalPage, NotFoundPage, ResetPasswordPage, SiteHeader } from "./pages/public/PublicPages.jsx";
import { FeaturesPage } from "./pages/public/FeaturesPage.jsx";
import { PublicGuidePage, PUBLIC_GUIDES } from "./pages/public/PublicGuides.jsx";
import SocialPage from "./pages/public/SocialPage.jsx";
import { SupportPage } from "./pages/public/SupportPage.jsx";
import { applyDocumentMetadata } from "./seo/metadata.js";
import { Loader2, ArrowRight } from "lucide-react";
import { AmbientBackground } from "./components/layout/AppChrome.jsx";
import { useAppLoading } from "./components/loading/AppLoadingProvider.jsx";

// The session, navigation and consent lifecycle stays mounted across both sides
// of this boundary. No workspace module is requested for a public visitor.
const PrivateApp = lazy(() => import("./AppContent.jsx"));
const DemoPage = lazy(() => import("./pages/public/DemoPage.jsx").then((module) => ({ default: module.DemoPage })));

function PrivateModuleLoading() {
  useLanguage();
  useAppLoading("app");
  return null;
}

function PrivateRoute(props) {
  useLanguage();
  return <Suspense fallback={<PrivateModuleLoading />}><PrivateApp {...props} /></Suspense>;
}

function VerifyEmailPage() {
  useLanguage();
  useEffect(() => {
    const token = new URLSearchParams(window.location.search || "").get("token") || "";
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    window.location.replace(`${API_BASE}/verify-email${query}`);
  }, []);

  return <div className="nxt5-entry-page nxt5-auth-page"><AmbientBackground /><SiteHeader /><main className="nxt5-entry-main nxt5-recovery-main"><Surface className="nxt5-auth-card text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"><Loader2 className="h-6 w-6 animate-spin" /></div><h1 className="mt-5 text-3xl font-black text-white">{t("Vérification en cours")}</h1><p className="mt-3 text-sm font-normal leading-6 text-slate-300">{t("On confirme ton adresse e-mail et on te redirige automatiquement.")}</p></Surface></main></div>;
}

function VerifiedPage({ navigate }) {
  useLanguage();
  const params = new URLSearchParams(window.location.search || "");
  const success = params.get("success") === "true";
  const error = params.get("error");
  const copy = success
    ? [t("Email vérifié !"), t("Tu peux maintenant accéder à ton espace NXT5 et recevoir les notifications."), "green"]
    : error === "expired"
      ? [t("Lien expiré"), t("Ce lien a expiré. Renvoie un email de vérification depuis tes paramètres."), "yellow"]
      : [t("Lien invalide"), t("Lien invalide ou déjà utilisé."), "red"];
  const [title, text, tone] = copy;
  return <div className="nxt5-entry-page nxt5-auth-page"><AmbientBackground /><SiteHeader /><main className="nxt5-entry-main nxt5-recovery-main"><Surface className="nxt5-auth-card text-center"><Badge tone={tone}>{success ? t("Vérifié") : t("Vérification")}</Badge><h1 className="mt-5 text-3xl font-black text-white">{title}</h1><p className="mt-3 text-sm font-normal leading-6 text-slate-300">{text}</p><div className="mt-6 flex justify-center"><Button icon={ArrowRight} onClick={() => navigate("/parametres")}>{success ? t("Ouvrir mes paramètres") : t("Retour aux paramètres")}</Button></div></Surface></main></div>;
}

const RoutedAppContent = React.memo(function RoutedAppContent({ checkingSession, user, route, navigate, pushToast, onAuth, onLogout, onUserUpdate, initialDemoPage }) {
  useLanguage();
  const inviteMode = new URLSearchParams(route.search).has("invite") ?"register" : null;
  const mode = authModeFromPath(route.path) || inviteMode;
  const routeIsPrivate = isAppPath(route.path);
  const unknownRoute = !isKnownPath(route.path);
  const forbiddenAdminRoute = isAdminPath(route.path) && (!user || user.is_platform_admin !== true);
  const adminPage = adminPageFromRoute(route);
  const DemoComponent = initialDemoPage || DemoPage;

  const rendersPrivateApp = user && !unknownRoute && !forbiddenAdminRoute && !LEGAL_PAGES[route.path] && !PUBLIC_GUIDES[route.path] && !["/fonctionnalites", "/demo", "/reseaux", "/soutenir", "/verify-email", "/verified", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe"].includes(route.path);
  // Once authorized, the private module (including its download fallback)
  // owns the shared loader. Public routes always release it.
  useAppLoading(checkingSession && routeIsPrivate ? "session" : rendersPrivateApp ? undefined : null);

  // Public pages render during the session check. The shared screen remains
  // mounted while a private route passes from session checking to bootstrap.
  if (checkingSession && routeIsPrivate) return null;
  if (unknownRoute) return <NotFoundPage navigate={navigate} />;
  if (!checkingSession && forbiddenAdminRoute) return <NotFoundPage navigate={navigate} />;
  if (route.path === "/fonctionnalites") return <FeaturesPage navigate={navigate} user={user} />;
  if (route.path === "/demo") return <Suspense fallback={<div role="status" className="p-6 text-slate-200">{t("Chargement de la démo…")}</div>}><DemoComponent navigate={navigate} user={user} /></Suspense>;
  if (PUBLIC_GUIDES[route.path]) return <PublicGuidePage path={route.path} navigate={navigate} user={user} />;
  if (adminPage) return <PrivateRoute user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} pushToast={pushToast} navigate={navigate} route={route} />;
  if (route.path === "/reseaux") return <SocialPage navigate={navigate} user={user} />;
  if (route.path === "/soutenir") return <SupportPage navigate={navigate} user={user} />;
  if (LEGAL_PAGES[route.path]) return <LegalPage route={route} navigate={navigate} user={user} />;
  if (route.path === "/verify-email") return <VerifyEmailPage />;
  if (route.path === "/verified") return <VerifiedPage navigate={navigate} />;
  if (route.path === "/mot-de-passe-oublie") return <ForgotPasswordPage navigate={navigate} />;
  if (route.path === "/reinitialiser-mot-de-passe") return <ResetPasswordPage navigate={navigate} onAuth={onAuth} />;
  if (user) return <PrivateRoute user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} pushToast={pushToast} navigate={navigate} route={route} />;
  if (mode) return <AuthPage mode={mode} onAuth={onAuth} pushToast={pushToast} navigate={navigate} />;
  if (routeIsPrivate) return <AuthPage mode="login" onAuth={onAuth} pushToast={pushToast} navigate={navigate} />;
  return <HomeScreen navigate={navigate} />;
});

export default function NXT5({ initialRoute, initialDemoPage } = {}) {
  const language = useLanguage();
  const authGeneration = useRef(0);
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [route, setRoute] = useState(() => initialRoute || readRoute());

  // Hydrate the exact build-time route first, then apply browser-only query
  // parameters (invitations, campaigns) and the requested path of a real 404.
  useEffect(() => {
    if (!initialRoute) return;
    const current = readRoute();
    if (current.path !== initialRoute.path || current.search !== initialRoute.search) setRoute(current);
  }, []);

  const navigate = useCallback((path, options = {}) => {
    const method = options.replace ?"replaceState" : "pushState";
    window.history[method]({}, "", path);
    startTransition(() => setRoute(readRoute()));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const pushToast = useCallback((toast) => {
    const id = crypto.randomUUID ?crypto.randomUUID() : String(Date.now() + Math.random());
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);
  const removeToast = useCallback((id) => { setToasts((current) => current.filter((item) => item.id !== id)); }, []);
  const handleAuth = useCallback((nextUser) => {
    authGeneration.current += 1;
    setCheckingSession(false);
    setUser(nextUser);
  }, []);
  const handleLogout = useCallback(async (beforeLogout) => {
    if (reviewDrafts.hasDrafts() && !window.confirm(t("Te déconnecter supprimera les brouillons de débrief non enregistrés de cette session. Continuer ?"))) return;
    if (typeof beforeLogout === "function" && !await beforeLogout()) {
      pushToast({ type: "red", title: "Déconnexion interrompue", text: "Le planning n’a pas pu être enregistré. Réessaie avant de te déconnecter." });
      return;
    }
    authGeneration.current += 1;
    try { await apiFetch("auth-logout", { method: "POST" }); }
    catch {
      pushToast({ type: "red", title: "Déconnexion impossible", text: "La session n’a pas pu être fermée. Réessaie." });
      return;
    }
    reviewDrafts.clear();
    setUser(null);
    navigate("/connexion", { replace: true });
    pushToast({ type: "cyan", title: "Déconnecté", text: "Tu es bien déconnecté." });
  }, [navigate, pushToast]);

  useEffect(() => {
    configurePerformanceMode();
    const onStorage = (event) => {
      if (event.key === PERFORMANCE_MODE_STORAGE_KEY) configurePerformanceMode();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let mounted = true;
    const generation = authGeneration.current;
    apiFetch("auth-me").then((result) => { if (mounted && authGeneration.current === generation) setUser(result.user); }).catch(() => { if (mounted && authGeneration.current === generation) setUser(null); }).finally(() => { if (mounted) setCheckingSession(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const navTitle = route.path === "/profil" || route.path.startsWith("/profil/") || route.path === "/mon-profil" || route.path.startsWith("/mon-profil/")
      ? `Profil > ${profileViewLabel(profileViewFromPath(route.path))}`
      : ["/games", "/integration", "/statistiques", "/rapports"].includes(route.path)
        ? gameWorkspaceSectionLabel(gameWorkspaceSectionFromPath(route.path))
      : NAV.find((item) => item.path === route.path)?.label;
    const adminPage = adminPageFromRoute(route);
    const title = adminPage ? `${adminPage.label} · Administration — NXT5` : navTitle ? `${navTitle} — NXT5` : undefined;
    applyDocumentMetadata(isKnownPath(route.path) ? route.path : "/404", { title });
  }, [route.path, route.search, language]);

  useEffect(() => {
    if (!checkingSession && user && (route.path === "/" || authModeFromPath(route.path))) {
      navigate("/accueil", { replace: true });
    }
  }, [checkingSession, user, route.path]);

  useEffect(() => {
    if (checkingSession || user || !isAppPath(route.path)) return;
    const params = new URLSearchParams(route.search);
    if (route.path === "/equipes" && params.has("invite")) {
      navigate(`/creer-un-compte?invite=${encodeURIComponent(params.get("invite"))}`, { replace: true });
      return;
    }
    navigate(buildLoginRedirect(route.path, route.search), { replace: true });
  }, [checkingSession, user, route.path, route.search]);

  return <><RoutedAppContent checkingSession={checkingSession} user={user} route={route} navigate={navigate} pushToast={pushToast} onAuth={handleAuth} onLogout={handleLogout} onUserUpdate={handleAuth} initialDemoPage={initialDemoPage} /><CookieConsent route={route} ready={!checkingSession} excluded={user?.is_platform_admin === true || isAdminPath(route.path)} /><ToastStack toasts={toasts} removeToast={removeToast} /></>;
}
