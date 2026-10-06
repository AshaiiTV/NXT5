import React, { startTransition, useEffect, useState, Suspense, useMemo, useRef, lazy } from "react";
import { apiFetch } from "./api/client.js";
import { adminPageFromRoute } from "./app/admin-navigation.js";
import { gameWorkspaceSectionFromPath, isAppPath, pageFromPath, pathFromPage } from "./app/routing.js";
import { ModalDialog } from "./components/ui/ModalDialog.jsx";
import { Surface, Badge, Button, SkeletonRows, TextInput } from "./components/ui/Core.jsx";
import { LegalLinks, SiteHeader } from "./pages/public/PublicPages.jsx";
import { Loader2, ArrowRight, LogOut, MessageCircleQuestion, X, Lock, Mail, AlertTriangle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { AmbientBackground, ApiBanner, Sidebar, Topbar } from "./components/layout/AppChrome.jsx";
import { Nxt5Wordmark, ResponsiveImage } from "./components/brand/BrandAssets.jsx";
import { cx, preciseErrorText } from "./app/helpers.js";
import { createPlanningStore, upsertAvailability } from "./utils/planning-store.js";
import { useTeamCreation } from "./hooks/useTeamCreation.js";
import { WorkspaceErrorBoundary } from "./components/ui/WorkspaceErrorBoundary.jsx";
import { useTeamData } from "./hooks/useTeamData.js";
import { useAppLoading } from "./components/loading/AppLoadingProvider.jsx";
import { matchDisplayName } from "./utils/matches.js";
import { getOnboardingSteps } from "./utils/onboarding.js";
import { useOnboarding } from "./hooks/useOnboarding.js";
import HomeWorkspace from "./pages/workspace/HomeWorkspace.jsx";
import { roleLabel } from "./pages/workspace/shell-shared.jsx";
import PassFeatureGate from "./components/subscriptions/PassFeatureGate.jsx";
import { isPassFeatureLocked } from "./app/pass-access.js";
const Teams = lazy(() => import("./pages/workspace/Teams.jsx").then((module) => ({ default: module.Teams })));
const DiscordWorkspace = lazy(() => import("./pages/workspace/DiscordWorkspace.jsx"));
const PlayerUltimateProfile = lazy(() => import("./pages/workspace/PlayerUltimateProfile.jsx").then((module) => ({ default: module.PlayerUltimateProfile })));
const TrendsPage = lazy(() => import("./pages/workspace/TrendsPage.jsx").then((module) => ({ default: module.TrendsPage })));
const GameWorkspace = lazy(() => import("./pages/workspace/GameWorkspace.jsx").then((module) => ({ default: module.GameWorkspace })));
const Planning = lazy(() => import("./pages/workspace/Planning.jsx").then((module) => ({ default: module.Planning })));
const AccountSettings = lazy(() => import("./pages/workspace/AccountSettings.jsx").then((module) => ({ default: module.AccountSettings })));
const DraftWorkspace = lazy(() => import("./pages/workspace/DraftWorkspace.jsx").then((module) => ({ default: module.DraftWorkspace })));

const AssistantPanel = lazy(() => import("./components/assistant/AssistantPanel.jsx"));

const AdministrationPage = lazy(() => import("./pages/admin/AdministrationPage.jsx"));

const GuidePage = lazy(() => import("./pages/GuidePage.jsx"));

export function MissingEmailModal({ user, onUserUpdate, pushToast, onLogout }) {
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
    <ModalDialog dismissable={false} busy={saving} aria-labelledby="missing-email-title" className="nxt5-account-dialog nxt5-enter w-full max-w-xl border border-cyan-300/25 p-6">
        <Badge tone="orange">Action requise</Badge>
        <h2 id="missing-email-title" className="mt-5 text-3xl font-black tracking-tight text-white">Ajoute ton e-mail de récupération</h2>
        <p className="mt-3 text-sm font-normal leading-6 text-slate-300">Les anciens comptes n’avaient pas d’e-mail. Ajoute le tien maintenant pour recevoir les liens de mot de passe oublié.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <TextInput label="E-mail de récupération" value={email} onChange={setEmail} placeholder="joueur@exemple.com" type="email" required icon={Mail} autoFocus autoComplete="email" />
          <TextInput label="Mot de passe actuel" value={currentPassword} onChange={setCurrentPassword} type="password" required icon={Lock} />
          {error && <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
          <Button type="submit" disabled={saving || !email.trim() || !currentPassword} icon={saving ?Loader2 : Mail} className="w-full py-4">{saving ?"Enregistrement..." : "Enregistrer l’e-mail"}</Button>
        </form>
        <Button type="button" variant="ghost" icon={LogOut} onClick={onLogout} disabled={saving} className="mt-4 w-full">Se déconnecter</Button>
    </ModalDialog>
  );
}

export function EmailVerificationRequiredModal({ user, onUserUpdate, pushToast, onLogout }) {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const busy = saving || sending || checking;
  useEffect(() => {
    let active = true;
    setHasPassword(null);
    apiFetch("auth-social-status").then((result) => {
      if (active) setHasPassword(result.hasPassword === true);
    }).catch((err) => { if (active) setError(err.message || "Options de sécurité indisponibles. Reconnecte-toi pour réessayer."); });
    return () => { active = false; };
  }, [user?.id]);

  async function correctEmail(event) {
    event.preventDefault();
    if (busy || hasPassword !== true) return;
    if (email.trim().toLowerCase() === String(user?.email || "").trim().toLowerCase()) {
      setError("Cette adresse est déjà celle de ton compte. Utilise « M’envoyer le lien » pour recevoir un nouveau lien.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch("auth-update-profile", { method: "POST", body: JSON.stringify({ name: user?.name || user?.account_name || "Compte NXT5", email, currentPassword }) });
      setCurrentPassword("");
      setEmail("");
      onUserUpdate?.(result.user);
      setSent(true);
      pushToast?.({ type: "green", title: "E-mail corrigé", text: "Un lien de vérification vient de t’être envoyé." });
    } catch (err) {
      setError(err.message || "Impossible de corriger cet e-mail.");
    } finally {
      setSaving(false);
    }
  }

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
    <ModalDialog dismissable={false} busy={busy} aria-labelledby="verify-email-title" className="nxt5-account-dialog nxt5-enter w-full max-w-xl border border-amber-300/28 p-6">
        <Badge tone="orange">Vérification obligatoire</Badge>
        <h2 id="verify-email-title" className="mt-5 text-3xl font-black tracking-tight text-white">Vérifie ton e-mail</h2>
        <p className="mt-3 text-sm font-normal leading-6 text-slate-300">Ton compte utilise l'adresse <span className="break-all font-black text-white">{user?.email}</span>. Confirme cette adresse avec le lien envoyé par e-mail pour accéder à ton espace NXT5.</p>
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />Profil non vérifié</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-50/80">L’accès aux équipes et les notifications restent bloqués tant que l’e-mail n’est pas confirmé.</p>
        </div>
        {sent && <div role="status" className="mt-4 rounded-2xl border border-emerald-300/22 bg-emerald-400/10 p-3 text-sm font-bold leading-6 text-emerald-100">Lien envoyé. Clique dessus dans ta boîte mail, puis reviens ici vérifier le statut.</div>}
        {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm font-bold leading-6 text-rose-100">{error}</div>}
        {hasPassword === null && !error && <p role="status" className="mt-4 text-sm text-slate-300">Chargement des options de récupération…</p>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button type="button" autoFocus icon={sending ? Loader2 : Mail} onClick={resend} disabled={busy} className="w-full py-4">{sending ? "Envoi..." : sent ? "Renvoyer le lien" : "M'envoyer le lien"}</Button>
          <Button type="button" variant="ghost" icon={checking ? Loader2 : RefreshCw} onClick={refreshStatus} disabled={busy} className="w-full py-4">{checking ? "Vérification..." : "J'ai vérifié mon email"}</Button>
        </div>
        {hasPassword === true && <form onSubmit={correctEmail} className="mt-6 space-y-4 border-t border-white/10 pt-5">
          <h3 className="text-lg font-bold text-white">Corriger mon adresse</h3>
          <TextInput label="Nouvel e-mail" type="email" autoComplete="email" value={email} onChange={setEmail} required disabled={busy} icon={Mail} />
          <TextInput label="Mot de passe actuel" type="password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} required disabled={busy} icon={Lock} />
          <Button type="submit" disabled={busy || !email.trim() || !currentPassword} icon={saving ? Loader2 : Mail} className="w-full">{saving ? "Enregistrement…" : "Corriger mon adresse"}</Button>
        </form>}
        {hasPassword === false && <p className="mt-5 text-sm leading-6 text-slate-300">Ce compte utilise une connexion sociale et n’a pas de mot de passe NXT5. La correction de l’adresse nécessite une réauthentification par mot de passe. Déconnecte-toi pour utiliser un autre compte ou contacte le support si cette adresse est incorrecte.</p>}
        <Button type="button" variant="ghost" icon={LogOut} onClick={onLogout} disabled={busy} className="mt-4 w-full">Se déconnecter</Button>
    </ModalDialog>
  );
}

export function InactivityReturnModal({ user, onUserUpdate, pushToast, navigate }) {
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
  return <ModalDialog onClose={() => acknowledge()} busy={saving} aria-labelledby="inactivity-return-title" className="nxt5-account-dialog nxt5-enter relative w-full max-w-2xl border border-cyan-200/26 p-5 sm:p-7">
      <button type="button" onClick={() => acknowledge()} disabled={saving} autoFocus aria-label="Fermer le message" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/28 bg-gradient-to-br from-cyan-400/18 to-fuchsia-400/14 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,.15)]"><Sparkles className="h-7 w-7" /></div>
      <Badge tone="cyan" className="mt-5">Bon retour</Badge>
      <h2 id="inactivity-return-title" className="mt-3 pr-12 text-2xl font-bold tracking-tight text-white">Content de te revoir sur NXT5</h2>
      <p className="mt-3 max-w-xl text-sm font-normal leading-6 text-slate-300 sm:text-base">Ton compte n'avait pas été actif depuis au moins trois mois. Tes équipes et tes données sont toujours disponibles : tu peux reprendre exactement là où tu t'étais arrêté.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200/16 bg-emerald-300/[0.055] p-4"><p className="flex items-center gap-2 text-sm font-black text-emerald-100"><ShieldCheck className="h-4 w-4" />Données préservées</p><p className="mt-1.5 text-xs font-semibold leading-5 text-slate-300">Ce message n'affiche aucun détail sur tes équipes, tes games ou leurs membres.</p></div>
        <div className="rounded-2xl border border-cyan-200/16 bg-cyan-300/[0.055] p-4"><p className="flex items-center gap-2 text-sm font-black text-cyan-100"><Mail className="h-4 w-4" />Rappel maîtrisé</p><p className="mt-1.5 text-xs font-semibold leading-5 text-slate-300">L'e-mail de retour peut être désactivé à tout moment dans les paramètres.</p></div>
      </div>
      {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300/24 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">{error}</div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => acknowledge()} disabled={saving} className="sm:min-w-36">Rester ici</Button>
        <Button type="button" icon={saving ? Loader2 : ArrowRight} onClick={() => acknowledge("/equipes")} disabled={saving} className="sm:min-w-48">{saving ? "Ouverture..." : "Voir mes équipes"}</Button>
      </div>
  </ModalDialog>;
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

export function MainApp({ user, onLogout, onUserUpdate, pushToast, navigate, route }) {
  if (!user?.email || user.email_verified !== true) return <EmailVerificationGate user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} pushToast={pushToast} />;
  return <VerifiedMainApp user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} pushToast={pushToast} navigate={navigate} route={route} />;
}

function EmailVerificationGate({ user, onLogout, onUserUpdate, pushToast }) {
  useAppLoading(null);
  const Dialog = user?.email ? EmailVerificationRequiredModal : MissingEmailModal;
  return <div className="nxt5-entry-page nxt5-auth-page"><AmbientBackground /><SiteHeader /><Dialog user={user} onLogout={() => onLogout()} onUserUpdate={onUserUpdate} pushToast={pushToast} /></div>;
}

function VerifiedMainApp({ user, onLogout, onUserUpdate, pushToast, navigate, route }) {
  const isPlatformAdmin = user?.is_platform_admin === true;
  const initialPage = new URLSearchParams(route.search).get("invite") ?"teams" : pageFromPath(route.path);
  const [active, setActiveState] = useState(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const previousPage = useRef(active);
  useEffect(() => {
    if (previousPage.current !== active && !document.querySelector?.("dialog[open]")) {
      const target = document.querySelector?.("[data-workspace-error]") || document.getElementById?.("workspace-content");
      target?.focus({ preventScroll: true });
    }
    previousPage.current = active;
  }, [active]);
  const [planningStore] = useState(() => createPlanningStore({
    save: async (body) => {
      const result = await apiFetch("player-availability-manage", { method: "POST", body: JSON.stringify(body) });
      return result?.availability;
    },
    onSaved: (row) => setData((current) => ({ ...current, availability: upsertAvailability(current.availability || [], row) })),
    onError: (error) => pushToast({ type: "red", title: "Enregistrement impossible", text: error.message }),
  }));
  useEffect(() => { planningStore.resume(); return () => planningStore.pause(); }, [planningStore]);
  const { data, setData, selectedTeamId, setSelectedTeamId, loading, loadingProgress, bootstrapped, bootstrapReady, apiError, refreshAll } = useTeamData(planningStore, route.search);
  const teamCreation = useTeamCreation({ setSelectedTeamId, refreshAll, pushToast });
  const independentAccountPage = active === "account-settings";
  const waitingForBootstrap = !independentAccountPage && !bootstrapReady && (!bootstrapped || loading);
  useAppLoading(waitingForBootstrap && isAppPath(route.path) ? "bootstrap" : null, loadingProgress);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");

  function setActive(pageId) {
    startTransition(() => setActiveState(pageId));
    const keepInvite = pageId === "teams" && new URLSearchParams(window.location.search).has("invite");
    navigate(`${pathFromPage(pageId)}${keepInvite ?window.location.search : ""}`);
  }

  function openTeamCreation() {
    navigate("/equipes?setup=1");
  }

  function openTeamManagement() {
    navigate("/gestion-equipe");
  }

  function openAssistant(prompt = "") {
    setAssistantPrompt(typeof prompt === "string" ? prompt : "");
    setAssistantOpen(true);
  }

  const logout = () => onLogout(() => planningStore.prepareLogout());
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
  const setupParams = new URLSearchParams(route.search);
  const isTeamSetup = active === "teams" && (["create", "setup", "join"].some(key => setupParams.get(key) === "1") || setupParams.has("invite"));
  const teamSetupOnly = workspaceLocked && isTeamSetup;
  const workspacePage = ["home", "teams", "team-management", "bot-discord", "matches", "reports", "trends", "planning", "draft", "profile"].includes(active) && !teamSetupOnly;

  const page = useMemo(() => {
    if (active === "bot-discord") return <DiscordWorkspace data={data} selectedTeamId={selectedTeamId} currentMember={currentMember} user={user} />;
    if (active === "teams") return <Teams teamCreation={teamCreation} data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} setupOnly={teamSetupOnly} />;
    if (active === "team-management") return <Teams teamCreation={teamCreation} data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} managementOnly />;
    if (active === "matches" || active === "reports") return <GameWorkspace data={data} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} route={route} />;
    if (active === "trends") return <TrendsPage data={data} selectedTeamId={selectedTeamId} />;
    if (active === "planning") return <Planning data={data} selectedTeamId={selectedTeamId} planningStore={planningStore} currentMember={currentMember} user={user} />;
    if (active === "draft") return <DraftWorkspace data={data} setData={setData} selectedTeamId={selectedTeamId} refreshAll={refreshAll} pushToast={pushToast} currentMember={currentMember} user={user} route={route} navigate={navigate} />;
    if (active === "profile") return <PlayerUltimateProfile data={data} selectedTeamId={selectedTeamId} currentMember={currentMember} user={user} refreshAll={refreshAll} pushToast={pushToast} route={route} navigate={navigate} />;
    if (active === "guide") return <GuidePage route={route} navigate={navigate} onOpenAssistant={openAssistant} />;
    if (active === "account-settings") return <AccountSettings user={user} onUserUpdate={onUserUpdate} pushToast={pushToast} />;
    return <Teams teamCreation={teamCreation} data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />;
  }, [active, data, selectedTeamId, currentMember, route.path, route.search, pushToast, user, onUserUpdate, navigate, isPlatformAdmin, planningStore, teamSetupOnly, teamCreation]);
  const linkedPlayer = currentTeam ?(data.players || []).find((player) => player.team_id === currentTeam.id && player.user_id === user.id) : null;
  const onboardingReady = Boolean(bootstrapReady && currentTeam && data.selectedTeamId === currentTeam.id && !workspaceLocked && !apiError);
  const onboarding = useOnboarding({ user, currentTeam, data, route, ready: onboardingReady });
  const onboardingSteps = getOnboardingSteps({ data, currentTeam, currentMember, user, discovered: onboarding.discovered });
  const nextStep = onboardingSteps.find(step => !step.done && !step.disabled);
  const showStartReturn = onboardingReady && !onboarding.dismissed && onboardingSteps.some(step => !step.done) && !isTeamSetup && ["teams", "team-management", "matches", "reports", "planning", "profile"].includes(active);
  const helpSection = { home: "getting-started", teams: "teams-and-roster", "team-management": "teams-and-roster", matches: setupParams.get("import") === "1" ? "imports-and-games" : "statistics", reports: "reviews", profile: "player-profile", planning: "planning", trends: "trends", draft: "champion-pool" }[active] || "getting-started";
  const currentPage = active === "home" && currentTeam ? <HomeWorkspace data={data} currentTeam={currentTeam} currentMember={currentMember} user={user} steps={onboardingSteps} onboarding={onboarding} navigate={navigate} /> : page;
  const guardedPage = workspacePage ? <PassFeatureGate feature="workspace" onSubscribe={() => navigate("/tarifs")}>{currentPage}</PassFeatureGate> : currentPage;
  const assistantWidget = !workspaceLocked && <>
    {active !== "home" && data.teams.length > 0 && <button type="button" onClick={() => assistantOpen ? setAssistantOpen(false) : openAssistant()} aria-label={assistantOpen ? "Fermer l'assistant NXT5" : "Ouvrir l'assistant NXT5"} aria-haspopup="dialog" aria-expanded={assistantOpen} className={cx("nxt5-assistant-launcher", assistantOpen && "is-open")}>
      <span aria-hidden="true">{assistantOpen ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}</span>
      <span className="hidden sm:inline">{assistantOpen ? "Fermer" : "Assistant"}</span>
    </button>}
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
  if (!data.teams.length && active !== "guide" && active !== "bot-discord" && !independentAccountPage) return <>
    <div className="relative min-h-screen text-white">
      <AmbientBackground />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ResponsiveImage src="/assets/nxt5-loader-favicon.png" sources={[{ srcSet: "/assets/nxt5-loader-favicon-256.webp" }]} alt="NXT5" width="512" height="512" decoding="async" className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14" />
            <div className="min-w-0"><Nxt5Wordmark className="h-auto w-[8.5rem] max-w-[40vw] object-left" /><p className="mt-1 text-xs font-medium text-slate-400">Ton espace équipe</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/parametres")}>Paramètres</Button>
            {isPlatformAdmin && <Button variant="ghost" onClick={() => navigate("/admin/abonnements")}>Comptes et abonnements</Button>}
            <Button variant="ghost" icon={LogOut} onClick={logout} className="px-3 sm:px-4" aria-label="Déconnexion"><span className="hidden sm:inline">Déconnexion</span></Button>
          </div>
        </div>
        <ApiBanner error={apiError} onRetry={refreshAll} retrying={loading} />
        <WorkspaceErrorBoundary key={active}>
          <Teams teamCreation={teamCreation} data={data} refreshAll={refreshAll} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} currentMember={currentMember} routeSearch={route.search} pushToast={pushToast} user={user} />
        </WorkspaceErrorBoundary>
      </main>
      <LegalLinks navigate={navigate} />
    </div>
    {assistantWidget}
    {inactivityReturnModal}
  </>;
  return (
    <div className="relative min-h-screen text-white">
      <AmbientBackground />
      <a className="nxt5-workspace-skip" href="#workspace-content">Aller au contenu</a>
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
        className={cx("nxt5-app-shell relative z-10 min-w-0", sidebarCollapsed ? "is-sidebar-collapsed" : "is-sidebar-expanded")}
        style={{ "--nxt5-sidebar-space": sidebarCollapsed ? "5rem" : "16.5rem" }}
      >
        <Topbar
          active={active}
          setOpen={setSidebarOpen}
          currentTeam={currentTeam}
          teams={data.teams}
          onSelectTeam={setSelectedTeamId}
          onCreateTeam={openTeamCreation}
          onManageTeam={openTeamManagement}
          onHelp={() => navigate(`/guide?section=${helpSection}`)}
        />
        <main id="workspace-content" tabIndex={-1} className="nxt5-workspace-main">
          <WorkspaceErrorBoundary key={active}>
            <ApiBanner error={apiError} onRetry={refreshAll} retrying={loading} />
            {showStartReturn && <div className="nxt5-start-return"><button type="button" onClick={() => navigate("/accueil")}>← Mon accueil</button><span>{nextStep ? `Prochaine étape : ${nextStep.label.toLowerCase()}` : onboardingSteps.every(step => step.done) ? "Tes premiers repères sont en place" : "Ton équipe prépare la suite"}</span></div>}
            <div key={active} className="nxt5-fade-in min-w-0">
              <Suspense fallback={<div className="py-8"><SkeletonRows rows={4} /></div>}>{independentAccountPage || data.selectedTeamId === selectedTeamId ? guardedPage : <div role="status" className="py-8">Chargement de l’équipe…</div>}</Suspense>
            </div>
          </WorkspaceErrorBoundary>
        </main>
        <LegalLinks navigate={navigate} />
      </div>
      {assistantWidget}
      {inactivityReturnModal}
    </div>
  );
}

export default function PrivateApp({ user, route, navigate, pushToast, onLogout, onUserUpdate }) {
  const adminPage = adminPageFromRoute(route);
  useAppLoading(adminPage ? null : undefined);
  if (adminPage && (!user?.email || user.email_verified !== true)) return <EmailVerificationGate user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} pushToast={pushToast} />;
  if (adminPage) return <Suspense fallback={<div className="p-6 text-slate-200" role="status" aria-label="Chargement de l’administration"><SkeletonRows count={3} /></div>}><AdministrationPage route={route} navigate={navigate} user={user} onLogout={onLogout} /></Suspense>;
  return <MainApp user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} pushToast={pushToast} navigate={navigate} route={route} />;
}
