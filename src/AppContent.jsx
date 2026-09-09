import React, { startTransition, useCallback, useEffect, useState, Suspense, useMemo, lazy } from "react";
import { apiFetch, API_BASE } from "./api/client.js";
import { NAV } from "./app/constants.jsx";
import { PERFORMANCE_MODE_STORAGE_KEY, configurePerformanceMode } from "./app/performance.js";
import { authModeFromPath, buildLoginRedirect, gameWorkspaceSectionFromPath, gameWorkspaceSectionLabel, isAdminPath, isAppPath, profileViewFromPath, profileViewLabel, readRoute, isKnownPath, pageFromPath, pathFromPage } from "./app/routing.js";
import { ToastStack, Surface, Badge, Button, SkeletonRows, TextInput } from "./components/ui/Core.jsx";
import { AuthPage, ForgotPasswordPage, HomeScreen, LEGAL_PAGES, LegalPage, NotFoundPage, ResetPasswordPage, LegalLinks } from "./pages/public/PublicPages.jsx";
import { Loader2, ArrowRight, LogOut, MessageCircleQuestion, X, Lock, Mail, AlertTriangle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { AmbientBackground, ApiBanner, BeginnerCompass, Sidebar, Topbar } from "./components/layout/AppChrome.jsx";
import { Nxt5Wordmark, ResponsiveImage } from "./components/brand/BrandAssets.jsx";
import { cx, preciseErrorText } from "./app/helpers.js";
import { createPlanningStore, upsertAvailability } from "./utils/planning-store.js";
import { useTeamData } from "./hooks/useTeamData.js";
import { useAppLoading } from "./components/loading/AppLoadingProvider.jsx";
import { matchDisplayName } from "./utils/matches.js";
import { roleLabel } from "./pages/workspace/shell-shared.jsx";
import PassFeatureGate from "./components/subscriptions/PassFeatureGate.jsx";
import { isPassFeatureLocked } from "./app/pass-access.js";
const Teams = lazy(() => import("./pages/workspace/Teams.jsx").then((module) => ({ default: module.Teams })));
const PlayerUltimateProfile = lazy(() => import("./pages/workspace/PlayerUltimateProfile.jsx").then((module) => ({ default: module.PlayerUltimateProfile })));
const TrendsPage = lazy(() => import("./pages/workspace/TrendsPage.jsx").then((module) => ({ default: module.TrendsPage })));
const GameWorkspace = lazy(() => import("./pages/workspace/GameWorkspace.jsx").then((module) => ({ default: module.GameWorkspace })));
const Planning = lazy(() => import("./pages/workspace/Planning.jsx").then((module) => ({ default: module.Planning })));
const AccountSettings = lazy(() => import("./pages/workspace/AccountSettings.jsx").then((module) => ({ default: module.AccountSettings })));
const DraftWorkspace = lazy(() => import("./pages/workspace/DraftWorkspace.jsx").then((module) => ({ default: module.DraftWorkspace })));

const AssistantPanel = lazy(() => import("./components/assistant/AssistantPanel.jsx"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AccessRequestsPage = lazy(() => import("./pages/admin/AccessRequestsPage.jsx"));
const AccountSubscriptionsPage = lazy(() => import("./pages/admin/AccountSubscriptionsPage.jsx"));
const PricingPage = lazy(() => import("./pages/public/PricingPage.jsx"));

const GuidePage = lazy(() => import("./pages/GuidePage.jsx"));

function VerifyEmailPage() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search || "").get("token") || "";
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    window.location.replace(`${API_BASE}/verify-email${query}`);
  }, []);

  return <div className="relative min-h-screen text-white"><AmbientBackground /><main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-10"><Surface glow className="w-full p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100"><Loader2 className="h-6 w-6 animate-spin" /></div><h1 className="mt-5 text-3xl font-black text-white">Vérification en cours</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-300">On confirme ton adresse e-mail et on te redirige automatiquement.</p></Surface></main></div>;
}

function VerifiedPage({ navigate }) {
  const params = new URLSearchParams(window.location.search || "");
  const success = params.get("success") === "true";
  const error = params.get("error");
  const copy = success
    ? ["Email vérifié !", "Tu peux maintenant recevoir les notifications.", "green"]
    : error === "expired"
      ? ["Lien expiré", "Ce lien a expiré. Renvoie un email de vérification depuis tes paramètres.", "yellow"]
      : ["Lien invalide", "Lien invalide ou déjà utilisé.", "red"];
  const [title, text, tone] = copy;
  return <div className="relative min-h-screen text-white"><AmbientBackground /><main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-10"><Surface glow className="w-full p-6 text-center"><Badge tone={tone}>{success ? "Vérifié" : "Vérification"}</Badge><h1 className="mt-5 text-3xl font-black text-white">{title}</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{text}</p><div className="mt-6 flex justify-center"><Button icon={ArrowRight} onClick={() => navigate("/parametres")}>{success ? "Ouvrir mes paramètres" : "Retour aux paramètres"}</Button></div></Surface></main></div>;
}

function MissingEmailModal({ user, onUserUpdate, pushToast }) {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch("auth-update-profile", { method: "POST", body: JSON.stringify({ name: user?.name || user?.account_name || "Compte NXT5", email, currentPassword }) });
      setCurrentPassword("");
      onUserUpdate(result.user);
      pushToast({ type: "green", title: "E-mail ajouté", text: "Un lien de vérification vient de t’être envoyé." });
    } catch (err) {
      setError(err.message || "Impossible d’ajouter cet e-mail.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 px-4 text-white backdrop-blur-xl">
      <div className="nxt5-enter w-full max-w-xl overflow-hidden rounded-[1.65rem] border border-cyan-300/25 bg-[#090d1a]/95 p-6 shadow-2xl shadow-black/50">
        <Badge tone="orange">Action requise</Badge>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-white">Ajoute ton e-mail de récupération</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Les anciens comptes n’avaient pas d’e-mail. Ajoute le tien maintenant pour recevoir les liens de mot de passe oublié.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <TextInput label="E-mail de récupération" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" required icon={Mail} />
          <TextInput label="Mot de passe actuel" value={currentPassword} onChange={setCurrentPassword} type="password" required icon={Lock} />
          {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
          <Button type="submit" disabled={saving || !email.trim() || !currentPassword} icon={saving ?Loader2 : Mail} className="w-full py-4">{saving ?"Enregistrement..." : "Enregistrer l’e-mail"}</Button>
        </form>
      </div>
    </div>
  );
}

function EmailVerificationRequiredModal({ user, onUserUpdate, pushToast }) {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setSending(true);
    setError("");
    try {
      const result = await apiFetch("resend-verify-email", { method: "POST" });
      onUserUpdate?.(result.user);
      setSent(true);
      pushToast?.({ type: "green", title: "Lien envoyé", text: "Ouvre ta boîte mail puis clique sur le lien de vérification." });
    } catch (err) {
      setError(preciseErrorText(err, "email-verification"));
    } finally {
      setSending(false);
    }
  }

  async function refreshStatus() {
    setChecking(true);
    setError("");
    try {
      const result = await apiFetch("auth-me");
      onUserUpdate?.(result.user);
      if (result.user?.email_verified) {
        pushToast?.({ type: "green", title: "Email vérifié", text: "Ton profil est validé." });
      } else {
        setError("Ton email n'est pas encore vérifié. Clique sur le lien reçu par mail, puis réessaie.");
      }
    } catch (err) {
      setError(err.message || "Impossible de vérifier ton statut.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/78 px-4 text-white backdrop-blur-2xl">
      <div className="nxt5-enter w-full max-w-xl overflow-hidden rounded-[1.65rem] border border-amber-300/28 bg-[#090d1a]/96 p-6 shadow-2xl shadow-black/55">
        <Badge tone="orange">Vérification obligatoire</Badge>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-white">Vérifie ton profil</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Ton compte utilise l'adresse <span className="font-black text-white">{user?.email}</span>. Pour continuer à recevoir les notifications NXT5, confirme cette adresse avec le lien envoyé par e-mail.</p>
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />Profil non vérifié</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-50/80">Les notifications restent bloquées tant que l'e-mail n'est pas confirmé.</p>
        </div>
        {sent && <div className="mt-4 rounded-2xl border border-emerald-300/22 bg-emerald-400/10 p-3 text-sm font-bold leading-6 text-emerald-100">Lien envoyé. Clique dessus dans ta boîte mail, puis reviens ici vérifier le statut.</div>}
        {error && <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold leading-6 text-rose-100">{error}</div>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" icon={sending ? Loader2 : Mail} onClick={resend} disabled={sending || checking} className="w-full py-4">{sending ? "Envoi..." : sent ? "Renvoyer le lien" : "M'envoyer le lien"}</Button>
          <Button type="button" variant="ghost" icon={checking ? Loader2 : RefreshCw} onClick={refreshStatus} disabled={sending || checking} className="w-full py-4">{checking ? "Vérification..." : "J'ai vérifié mon email"}</Button>
        </div>
      </div>
    </div>
  );
}

function InactivityReturnModal({ user, onUserUpdate, pushToast, navigate }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function acknowledge(destination = "") {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch("/api/user/inactivity-notice", { method: "POST" });
      onUserUpdate?.(result.user);
      if (destination) navigate(destination);
    } catch (requestError) {
      setError(requestError?.message || "Impossible de fermer ce message pour le moment.");
      pushToast?.({ type: "red", title: "Action non enregistrée", text: "Réessaie dans quelques instants." });
    } finally {
      setSaving(false);
    }
  }

  if (!user?.inactivity_notice) return null;
  return <div className="nxt5-fade-in fixed inset-0 z-[210] flex items-end justify-center bg-[#020511]/82 p-3 text-white backdrop-blur-xl sm:items-center sm:p-5">
    <section role="dialog" aria-modal="true" aria-labelledby="inactivity-return-title" className="nxt5-enter nxt5-panel nxt5-premium-panel relative w-full max-w-2xl overflow-hidden border border-cyan-200/26 bg-[#050814]/98 p-5 shadow-[0_32px_110px_rgba(0,0,0,.78),0_0_46px_rgba(34,211,238,.15)] sm:p-7">
      <button type="button" onClick={() => acknowledge()} disabled={saving} aria-label="Fermer le message" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/28 bg-gradient-to-br from-cyan-400/18 to-fuchsia-400/14 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,.15)]"><Sparkles className="h-7 w-7" /></div>
      <Badge tone="cyan" className="mt-5">Bon retour</Badge>
      <h2 id="inactivity-return-title" className="mt-3 pr-12 text-3xl font-black tracking-tight text-white sm:text-4xl">Content de te revoir sur NXT5</h2>
      <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">Ton compte n'avait pas été actif depuis au moins trois mois. Tes équipes et tes données sont toujours disponibles : tu peux reprendre exactement là où tu t'étais arrêté.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200/16 bg-emerald-300/[0.055] p-4"><p className="flex items-center gap-2 text-sm font-black text-emerald-100"><ShieldCheck className="h-4 w-4" />Données préservées</p><p className="mt-1.5 text-xs font-semibold leading-5 text-slate-300">Ce message n'affiche aucun détail sur tes équipes, tes games ou leurs membres.</p></div>
        <div className="rounded-2xl border border-cyan-200/16 bg-cyan-300/[0.055] p-4"><p className="flex items-center gap-2 text-sm font-black text-cyan-100"><Mail className="h-4 w-4" />Rappel maîtrisé</p><p className="mt-1.5 text-xs font-semibold leading-5 text-slate-300">L'e-mail de retour peut être désactivé à tout moment dans les paramètres.</p></div>
      </div>
      {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300/24 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => acknowledge()} disabled={saving} className="sm:min-w-36">Rester ici</Button>
        <Button type="button" icon={saving ? Loader2 : ArrowRight} onClick={() => acknowledge("/equipes")} disabled={saving} className="sm:min-w-48">{saving ? "Ouverture..." : "Voir mes équipes"}</Button>
      </div>
    </section>
  </div>;
}

function assistantEntityForRoute(route, data, selectedTeamId) {
  const params = new URLSearchParams(route?.search || "");
  const teamMatches = (data.matches || []).filter((item) => String(item.team_id || "") === String(selectedTeamId || ""));
  const teamReports = (data.reports || []).filter((item) => String(item.team_id || "") === String(selectedTeamId || ""));
  const teamPlayers = (data.players || []).filter((item) => String(item.team_id || "") === String(selectedTeamId || ""));
  const matchId = params.get("match");
  const reportId = params.get("report");
  const playerId = params.get("player");
  const candidates = route?.path === "/rapports"
    ? [
        { type: "report", id: reportId, items: teamReports, label: (item) => item.title || "Review sélectionnée" },
        { type: "match", id: matchId, items: teamMatches, label: matchDisplayName },
        { type: "player", id: playerId, items: teamPlayers, label: (item) => item.name || "Profil sélectionné" },
      ]
    : [
        { type: "match", id: matchId, items: teamMatches, label: matchDisplayName },
        { type: "player", id: playerId, items: teamPlayers, label: (item) => item.name || "Profil sélectionné" },
        { type: "report", id: reportId, items: teamReports, label: (item) => item.title || "Review sélectionnée" },
      ];
  for (const candidate of candidates) {
    if (!candidate.id) continue;
    const item = candidate.items.find((entry) => String(entry.id || "") === String(candidate.id));
    if (item) return { type: candidate.type, id: String(item.id), label: String(candidate.label(item) || "").slice(0, 120) };
  }
  return null;
}

function MainApp({ user, onLogout, onUserUpdate, pushToast, navigate, route }) {
  const isPlatformAdmin = user?.is_platform_admin === true;
  const initialPage = new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path);
  const [active, setActiveState] = useState(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [planningStore] = useState(() => createPlanningStore({
    save: async (body) => {
      const result = await apiFetch("player-availability-manage", { method: "POST", body: JSON.stringify(body) });
      return result?.availability;
    },
    onSaved: (row) => setData((current) => ({ ...current, availability: upsertAvailability(current.availability || [], row) })),
    onError: (error) => pushToast({ type: "red", title: "Enregistrement impossible", text: error.message }),
  }));
  useEffect(() => { planningStore.resume(); return () => planningStore.pause(); }, [planningStore]);
  const { data, setData, selectedTeamId, setSelectedTeamId, loading, loadingProgress, bootstrapped, bootstrapReady, apiError, refreshAll } = useTeamData(planningStore);
  const independentAccountPage = active === "account-subscriptions" || active === "account-settings";
  const waitingForBootstrap = !independentAccountPage && !bootstrapReady && (!bootstrapped || loading);
  useAppLoading(waitingForBootstrap && isAppPath(route.path) ? "bootstrap" : null, loadingProgress);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [beginnerCompassHidden, setBeginnerCompassHidden] = useState(() => {
    try { return window.localStorage.getItem("nxt5_beginner_compass_hidden") === "1"; }
    catch { return false; }
  });

  function setActive(pageId) {
    startTransition(() => setActiveState(pageId));
    const keepInvite = pageId === "teams" && new URLSearchParams(window.location.search).has("invite");
    navigate(`${pathFromPage(pageId)}${keepInvite ?window.location.search : ""}`);
  }

  function openTeamCreation() {
    navigate("/equipes?create=1");
  }

  function openTeamManagement() {
    navigate("/gestion-equipe");
  }

  function openAssistant(prompt = "") {
    setAssistantPrompt(typeof prompt === "string" ? prompt : "");
    setAssistantOpen(true);
  }

  function hideBeginnerCompass() {
    setBeginnerCompassHidden(true);
    try { window.localStorage.setItem("nxt5_beginner_compass_hidden", "1"); } catch {}
  }

  async function logout() { try { await apiFetch("auth-logout", { method: "POST" }); } catch {} pushToast({ type: "cyan", title: "Déconnecté", text: "Tu es bien déconnecté." }); navigate("/connexion", { replace: true }); onLogout(); }
  useEffect(() => { startTransition(() => setActiveState(new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path))); }, [route.path, route.search]);
  useEffect(() => {
    if (route.path === "/champion-pool" || route.path === "/draft") navigate("/draft/pool", { replace: true });
    if (route.path === "/compositions-types") navigate("/draft/compositions", { replace: true });
  }, [route.path, navigate]);

  const currentTeam = data.teams.find((team) => team.id === selectedTeamId) || data.teams[0] || null;
  const currentMember = currentTeam ?(data.teamMembers || []).find((member) => member.team_id === currentTeam.id && member.user_id === user.id) : null;
  const assistantSelectedEntity = assistantEntityForRoute(route, data, currentTeam?.id || selectedTeamId);
  // The launch switch stays off. Team entitlements must come from the server at launch;
  // manual subscriptions on a personal profile are not team access rights.
  const workspaceLocked = Boolean(currentTeam) && isPassFeatureLocked("workspace");
  const teamSetupOnly = active === "teams" && workspaceLocked && (new URLSearchParams(route.search).get("create") === "1" || new URLSearchParams(route.search).has("invite"));
  const workspacePage = ["teams", "team-management", "matches", "reports", "trends", "planning", "draft", "profile"].includes(active) && !teamSetupOnly;

  const page = useMemo(() => {
    if (active === "teams") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} setupOnly={teamSetupOnly} />;
    if (active === "team-management") return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} managementOnly />;
    if (active === "matches" || active === "reports") return <GameWorkspace data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} route={route} />;
    if (active === "trends") return <TrendsPage data={data} selectedTeamId={selectedTeamId} />;
    if (active === "planning") return <Planning data={data} selectedTeamId={selectedTeamId} planningStore={planningStore} currentMember={currentMember} user={user} />;
    if (active === "draft") return <DraftWorkspace data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} route={route} navigate={navigate} />;
    if (active === "profile") return <PlayerUltimateProfile data={data} selectedTeamId={selectedTeamId} currentMember={currentMember} user={user} refreshAll={refreshAll} pushToast={pushToast} route={route} navigate={navigate} />;
    if (active === "guide") return <GuidePage route={route} navigate={navigate} onOpenAssistant={openAssistant} />;
    if (active === "account-settings") return <AccountSettings user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />;
    if (active === "admin" && isPlatformAdmin) return <AdminDashboard navigate={navigate} />;
    if (active === "access-requests" && isPlatformAdmin) return <AccessRequestsPage navigate={navigate} />;
    if (active === "account-subscriptions" && isPlatformAdmin) return <AccountSubscriptionsPage navigate={navigate} initialUserId={new URLSearchParams(route.search).get("userId") || ""} />;
    return <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />;
  }, [active, data, selectedTeamId, currentMember, route.path, route.search, pushToast, user, onUserUpdate, navigate, isPlatformAdmin, planningStore, teamSetupOnly]);
  const guardedPage = workspacePage ? <PassFeatureGate feature="workspace" onSubscribe={() => navigate("/tarifs")}>{page}</PassFeatureGate> : page;

  const linkedPlayer = currentTeam ?(data.players || []).find((player) => player.team_id === currentTeam.id && player.user_id === user.id) : null;
  const currentTeamMatches = currentTeam ? (data.matches || []).filter((match) => match.team_id === currentTeam.id) : [];
  const showBeginnerCompass = Boolean(currentTeam && !workspaceLocked && !beginnerCompassHidden && currentTeamMatches.length < 5);
  const assistantWidget = !workspaceLocked && <>
    <button type="button" onClick={() => assistantOpen ? setAssistantOpen(false) : openAssistant()} aria-label={assistantOpen ? "Fermer l'assistant NXT5" : "Ouvrir l'assistant NXT5"} aria-haspopup="dialog" aria-expanded={assistantOpen} className={cx("group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[80] h-14 items-center gap-2 rounded-2xl border border-cyan-200/30 bg-[#071120]/95 px-4 text-sm font-black text-white shadow-[0_18px_50px_rgba(0,0,0,.55),0_0_28px_rgba(34,211,238,.16)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-cyan-100/55 hover:bg-[#0a1a2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/75 sm:right-5 lg:right-6", assistantOpen ? "hidden sm:inline-flex" : "inline-flex")}>
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/22 bg-cyan-400/12 text-cyan-100 transition group-hover:bg-cyan-300/18">{assistantOpen ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}</span>
      <span className="hidden sm:inline">{assistantOpen ? "Fermer" : "Assistant"}</span>
    </button>
    <Suspense fallback={null}><AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} route={route} selectedTeamId={currentTeam?.id || selectedTeamId || null} selectedEntity={assistantSelectedEntity} initialPrompt={assistantPrompt} navigate={navigate} /></Suspense>
  </>;
  const inactivityReturnModal = user?.email_verified && user?.inactivity_notice
    ? <InactivityReturnModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} navigate={navigate} />
    : null;
  if (waitingForBootstrap) return null;
  if (!bootstrapReady && !independentAccountPage) return <div className="relative min-h-screen text-white">
    <AmbientBackground />
    <main className="relative z-10 mx-auto max-w-3xl px-4 py-12">
      <p role="status" className="mb-4 font-semibold">{loading ? "Chargement de toutes les games…" : "L’historique complet n’a pas pu être chargé."}</p>
      <ApiBanner error={apiError} onRetry={refreshAll} retrying={loading} />
      <Button variant="ghost" icon={LogOut} onClick={logout}>Déconnexion</Button>
    </main>
  </div>;
  if (!data.teams.length && active !== "guide" && !independentAccountPage && !(["admin", "access-requests"].includes(active) && isPlatformAdmin)) return <>
    <div className="relative min-h-screen text-white">
      <AmbientBackground />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ResponsiveImage src="/assets/nxt5-mark.png?v=8" sources={[{ srcSet: "/assets/nxt5-mark-160.webp" }]} alt="NXT5" width="512" height="512" decoding="async" className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_22px_rgba(34,211,238,.45)] sm:h-14 sm:w-14" />
            <div className="min-w-0"><Nxt5Wordmark className="h-11 w-[13rem] max-w-[52vw] object-left sm:h-12 sm:w-[15rem]" /><p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-100/55 sm:tracking-[0.24em]">Team access</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/parametres")}>Paramètres</Button>
            {isPlatformAdmin && <Button variant="ghost" onClick={() => navigate("/admin/abonnements")}>Profils et abonnements</Button>}
            <Button variant="ghost" icon={LogOut} onClick={logout} className="px-3 sm:px-4" aria-label="Déconnexion"><span className="hidden sm:inline">Déconnexion</span></Button>
          </div>
        </div>
        <ApiBanner error={apiError} onRetry={refreshAll} retrying={loading} />
        <Teams data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />
      </main>
      <LegalLinks navigate={navigate} />
      {!user?.email && <MissingEmailModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}
      {user?.email && user.email_verified === false && <EmailVerificationRequiredModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}
    </div>
    {assistantWidget}
    {inactivityReturnModal}
  </>;
  return (
    <div className="relative min-h-screen text-white">
      <AmbientBackground />
      <Sidebar
        active={active}
        setActive={setActive}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        user={user}
        currentMember={currentMember}
        linkedPlayer={linkedPlayer}
        onLogout={logout}
        roleLabel={roleLabel}
        isPlatformAdmin={isPlatformAdmin}
      />
      <div
        className={cx("nxt5-app-shell relative z-10 min-w-0 transition-all duration-300", sidebarCollapsed ? "is-sidebar-collapsed" : "is-sidebar-expanded")}
        style={{ "--nxt5-sidebar-space": sidebarCollapsed ? "8.5rem" : "19rem" }}
      >
        <Topbar
          active={active}
          setOpen={setSidebarOpen}
          currentTeam={currentTeam}
          teams={data.teams}
          onSelectTeam={setSelectedTeamId}
          onCreateTeam={openTeamCreation}
          onManageTeam={openTeamManagement}
        />
        <main className="mx-auto w-full min-w-0 max-w-[1720px] px-3 py-5 sm:px-4 sm:py-7 lg:px-8 xl:px-10 2xl:px-12">
          <ApiBanner error={apiError} onRetry={refreshAll} retrying={loading} />
          {showBeginnerCompass && <BeginnerCompass active={active} data={data} currentTeam={currentTeam} onNavigate={setActive} onImport={() => navigate("/games?import=1")} onClose={hideBeginnerCompass} />}
          <React.Fragment>
            <div key={active} className="nxt5-fade-in min-w-0">
              <Suspense fallback={<div className="py-8"><SkeletonRows rows={4} /></div>}>{independentAccountPage || data.selectedTeamId === selectedTeamId ? guardedPage : <div role="status" className="py-8">Chargement de l’équipe…</div>}</Suspense>
            </div>
          </React.Fragment>
        </main>
        <LegalLinks navigate={navigate} />
      </div>
      {assistantWidget}
      {inactivityReturnModal}
      {!user?.email && <MissingEmailModal user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />}
      {user?.email && user.email_verified === false && <EmailVerificationRequiredModal user={user} pushToast={pushToast} onUserUpdate={onUserUpdate} />}
    </div>
  );
}

const RoutedAppContent = React.memo(function RoutedAppContent({ checkingSession, user, route, navigate, pushToast, onAuth, onLogout, onUserUpdate }) {
  const inviteMode = new URLSearchParams(route.search).has("invite") ?"register" : null;
  const mode = authModeFromPath(route.path) || inviteMode;
  const routeIsPrivate = isAppPath(route.path);
  const unknownRoute = !isKnownPath(route.path);
  const forbiddenAdminRoute = isAdminPath(route.path) && (!user || user.is_platform_admin !== true);

  const rendersWorkspace = user && !unknownRoute && !forbiddenAdminRoute && !LEGAL_PAGES[route.path] && !["/tarifs", "/verify-email", "/verified"].includes(route.path);
  useAppLoading(checkingSession && routeIsPrivate ? "session" : rendersWorkspace ? undefined : null);

  // Public pages render during the session check. The shared screen remains
  // mounted while a private route passes from session checking to bootstrap.
  if (checkingSession && routeIsPrivate) return null;
  if (unknownRoute) return <NotFoundPage navigate={navigate} />;
  if (!checkingSession && forbiddenAdminRoute) return <NotFoundPage navigate={navigate} />;
  if (route.path === "/tarifs") return <Suspense fallback={<div className="p-6 text-slate-200" role="status">Chargement des tarifs…</div>}><PricingPage navigate={navigate} user={user} /></Suspense>;
  if (LEGAL_PAGES[route.path]) return <LegalPage route={route} navigate={navigate} user={user} />;
  if (route.path === "/verify-email") return <VerifyEmailPage />;
  if (route.path === "/verified") return <VerifiedPage navigate={navigate} />;
  if (user) return <MainApp user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} pushToast={pushToast} navigate={navigate} route={route} />;
  if (route.path === "/mot-de-passe-oublie") return <ForgotPasswordPage navigate={navigate} />;
  if (route.path === "/reinitialiser-mot-de-passe") return <ResetPasswordPage navigate={navigate} />;
  if (mode) return <AuthPage mode={mode} onAuth={onAuth} pushToast={pushToast} navigate={navigate} />;
  if (routeIsPrivate) return <AuthPage mode="login" onAuth={onAuth} pushToast={pushToast} navigate={navigate} />;
  return <HomeScreen navigate={navigate} />;
});

export default function NXT5() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [route, setRoute] = useState(readRoute);

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
    setUser(nextUser);
  }, []);
  const handleLogout = useCallback(() => setUser(null), []);

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
    apiFetch("auth-me").then((result) => { if (mounted) setUser(result.user); }).catch(() => { if (mounted) setUser(null); }).finally(() => { if (mounted) setCheckingSession(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const navTitle = route.path === "/profil" || route.path.startsWith("/profil/") || route.path === "/mon-profil" || route.path.startsWith("/mon-profil/")
      ? `Profil > ${profileViewLabel(profileViewFromPath(route.path))}`
      : ["/games", "/integration", "/statistiques", "/rapports"].includes(route.path)
        ? gameWorkspaceSectionLabel(gameWorkspaceSectionFromPath(route.path))
      : NAV.find((item) => item.path === route.path)?.label;
    const publicTitles = {
      "/": "NXT5",
      "/tarifs": "Tarifs — NXT5",
      "/connexion": "Connexion — NXT5",
      "/creer-un-compte": "Créer un compte — NXT5",
      "/inscription": "Créer un compte — NXT5",
      "/mot-de-passe-oublie": "Mot de passe oublié — NXT5",
      "/reinitialiser-mot-de-passe": "Réinitialiser le mot de passe — NXT5",
      "/verify-email": "Vérification e-mail — NXT5",
      "/verified": "E-mail vérifié — NXT5",
      "/mentions-legales": "Mentions légales — NXT5",
      "/confidentialite": "Confidentialité — NXT5",
      "/cookies": "Cookies — NXT5",
      "/conditions": "Conditions générales d’utilisation — NXT5",
      "/reglement": "Règlement — NXT5",
      "/contact": "Contact — NXT5",
    };
    document.title = publicTitles[route.path] || (navTitle ?`${navTitle} — NXT5` : "NXT5");
  }, [route.path]);

  useEffect(() => {
    if (!checkingSession && user && (route.path === "/" || authModeFromPath(route.path))) {
      navigate("/equipes", { replace: true });
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

  return <><RoutedAppContent checkingSession={checkingSession} user={user} route={route} navigate={navigate} pushToast={pushToast} onAuth={handleAuth} onLogout={handleLogout} onUserUpdate={handleAuth} /><ToastStack toasts={toasts} removeToast={removeToast} /></>;
}
