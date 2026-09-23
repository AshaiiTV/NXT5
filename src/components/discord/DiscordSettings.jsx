import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageSquare, Pause, Play, Plus, RefreshCw, Unplug, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import { DiscordFeedback, DiscordHistory, DiscordLink, DiscordPreview, discordPost, discordQuery, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";
import DiscordRoleAccess from "./DiscordRoleAccess.jsx";

export default function DiscordSettings({ teamId, teamName, canManage = false, canPublish = false }) {
  if (!teamId || (!canManage && !canPublish)) return null;
  return <DiscordSettingsContent key={teamId} {...{ teamId, teamName, canManage, canPublish }} />;
}

export function discordConnectionState(status, { loading = false, error = "", routes = [] } = {}) {
  if (!status) return [loading ? "Vérification en cours" : error ? "Vérification impossible" : "Non connecté", error ? "red" : "slate"];
  if (!status.configured) return ["Service indisponible", "slate"];
  if (error || status.connectionError || status.health?.verified === false && status.connection?.guildId && status.connection.status !== "disconnected") return ["Connexion à vérifier", "red"];
  if (!status.connection?.guildId || status.connection.status === "disconnected") return ["À connecter", "slate"];
  if (status.enabled === false) return ["Service NXT5 suspendu", "yellow"];
  if (status.connection.paused) return ["Équipe en pause", "yellow"];
  if (!routes.some((route) => route.enabled)) return ["Diffusion manuelle", "cyan"];
  return ["Diffusion active", "green"];
}

function DiscordSettingsContent({ teamId, teamName, canManage, canPublish }) {
  const [revision, setRevision] = useState(0);
  const [link, setLink] = useState(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const [invitationOpened, setInvitationOpened] = useState(false);
  const [watchingLink, setWatchingLink] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [routesSnapshot, setRoutesSnapshot] = useState(null);
  const [routesDirty, setRoutesDirty] = useState(false);
  const [routesRefreshing, setRoutesRefreshing] = useState(true);
  const [testPassed, setTestPassed] = useState(false);
  const [selectedView, setSelectedView] = useState(null);
  const [accessOpened, setAccessOpened] = useState(false);
  const stepTabs = useRef([]);
  const stepsId = useId();
  const resource = useDiscordResource(discordQuery("team-discord-connection", { teamId }), revision, { keepPreviousData: true });
  const action = useDiscordAction();
  const status = resource.data;
  const connection = status?.connection;
  const connected = Boolean(connection?.guildId) && connection.status !== "disconnected";
  const verified = connected && !resource.error && !status.connectionError && status.health?.verified !== false;
  const reload = useCallback(() => { setRoutesRefreshing(true); setRevision((value) => value + 1); }, []);
  const established = connected && (Boolean(connection.enabledAt) || !connection.paused);
  const [statusLabel, statusTone] = discordConnectionState(status, { loading: resource.loading, error: resource.error, routes: savedRoutes });
  const command = link?.code ? `/nxt connecter code:${link.code}` : "";
  const currentDestinations = connected && routesSnapshot?.guildId === connection.guildId && String(routesSnapshot?.configVersion) === String(connection.configVersion);
  const routesReady = currentDestinations && savedRoutes.length > 0 && !routesDirty;
  const active = established && !connection.paused && status.enabled !== false && verified;
  const view = selectedView ?? (!canManage || established ? "overview" : !connected ? "connect" : routesReady ? "activate" : "salons");
  const activeStep = ["connect", "salons", "activate"].indexOf(view);
  const selectStep = (index, focus = false) => {
    setSelectedView(["connect", "salons", "activate"][index]);
    if (focus) stepTabs.current[index]?.focus();
  };
  const openView = (next) => {
    if (next === "access") setAccessOpened(true);
    setSelectedView(next);
  };

  useEffect(() => {
    setLinkExpired(false);
    if (!link?.expiresAt) return undefined;
    const remaining = new Date(link.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) { setLinkExpired(true); return undefined; }
    const timeout = setTimeout(() => setLinkExpired(true), Math.min(remaining, 2147483647));
    return () => clearTimeout(timeout);
  }, [link]);

  // Poll only while a fresh link is awaiting confirmation; focus and manual
  // refresh remain available after the two-minute automatic checking window.
  useEffect(() => {
    if (!link?.code || linkExpired || connected) { setWatchingLink(false); return undefined; }
    setWatchingLink(true);
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      reload();
      if (attempts >= 24) { clearInterval(timer); setWatchingLink(false); }
    }, 5000);
    return () => clearInterval(timer);
  }, [link?.code, linkExpired, connected, reload]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  useEffect(() => {
    if (connected) {
      if (link?.code) setSelectedView("salons");
      setLink(null);
      setCopyNotice("");
    }
  }, [connected]);

  async function copyCommand() {
    if (linkExpired) return;
    try { await navigator.clipboard.writeText(command); setCopyNotice("Commande copiée. Colle-la dans le serveur Discord de l’équipe."); }
    catch { setCopyNotice("Sélectionne la commande affichée pour la copier."); }
  }

  const progress = <InstallationProgress connected={connected} routesReady={routesReady} active={active} selectedStep={activeStep} onSelect={selectStep} tabsRef={stepTabs} idPrefix={stepsId} />;
  const nextAction = !connected ? ["Connecter le serveur", 0] : !routesReady ? ["Choisir un salon", 1] : !established ? ["Tester et activer", 2] : connection.paused ? ["Reprendre les envois", 2] : ["Gérer les salons", 1];
  const routeNames = savedRoutes.map((route) => `#${route.channelName || status?.channels?.find((channel) => channel.id === route.channelId)?.name || route.channelId}`);
  return <Surface className="discord-panel discord-dashboard">
    <div className="discord-heading discord-dashboard-status">
      <div><p className="discord-eyebrow">Bot Discord · équipe</p><h3><MessageSquare aria-hidden="true" className="h-5 w-5" />{teamName || "Ton équipe"}</h3><p className="discord-server">Serveur : <strong>{connected ? connection.guildName || connection.guildId : "aucun serveur relié"}</strong></p></div>
      <Badge tone={statusTone}>{statusLabel}</Badge>
    </div>
    <DiscordFeedback loading={resource.loading && !status} error={resource.error || action.error || status?.connectionError} notice={action.notice} />
    {status?.configured === false && <p className="discord-feedback">Le bot Discord n’est pas encore disponible. Un administrateur NXT5 doit terminer sa configuration.</p>}
    {status?.configured && status.enabled === false && <p className="discord-feedback">Les envois Discord sont suspendus pour toutes les équipes par NXT5. Les réglages restent disponibles ; le test et l’activation attendent la reprise du service.</p>}
    {!canManage && <p className="discord-help">Seuls le propriétaire et les capitaines peuvent configurer le bot pour cette équipe. Tu peux consulter son activité et partager les games selon tes droits.</p>}
    {status?.configured && <>
      {view === "overview" && <section className="discord-section discord-overview" aria-label="Aperçu du bot Discord">
        <div className="discord-overview-main"><div><p className="discord-step-kicker">{canManage ? active ? "Action rapide" : "Prochaine étape" : "Configuration de l’équipe"}</p><h4>{canManage ? active ? "Le bot est prêt" : nextAction[0] : connected ? "Suivre les publications" : "Serveur à connecter"}</h4><p>{!connected ? "Le propriétaire ou un capitaine doit relier l’équipe à son serveur Discord." : !routesReady ? "Ajoute un salon pour préparer la publication des games." : connection.paused ? "Les envois de cette équipe sont en pause." : "Les games de cette équipe peuvent être publiées dans ses salons Discord."}</p></div>{canManage && <Button type="button" onClick={() => selectStep(nextAction[1])}>{nextAction[0]}</Button>}</div>
        <dl className="discord-overview-facts"><div><dt>Salons</dt><dd>{!connected ? "À configurer" : routesRefreshing ? "Chargement…" : routeNames.length ? routeNames.join(", ") : "Aucun salon enregistré"}</dd></div><div><dt>Publication</dt><dd>{statusLabel}</dd></div></dl>
        <div className="discord-overview-links">{canManage && <Button type="button" variant="ghost" onClick={() => openView("access")}>Accès aux commandes</Button>}<Button type="button" variant="ghost" onClick={() => openView("activity")}>Activité</Button><Button type="button" variant="ghost" onClick={() => openView("settings")}>Aide et réglages</Button></div>
        <p className="discord-help">Les réglages et les rôles de cette équipe ne changent pas ceux des autres équipes. Ton compte Discord personnel se lie séparément, plus bas sur la page.</p>
      </section>}
      <section hidden={activeStep < 0} className="discord-section discord-configuration" aria-label="Configuration du bot">
        <div className="discord-heading"><p className="discord-step-kicker">{established ? "Modifier la configuration" : "Mise en route"}</p>{established && <Button type="button" variant="ghost" onClick={() => openView("overview")}>Retour à l’aperçu</Button>}</div>
        <p className="discord-help">Avance à ton rythme : changer d’étape n’enregistre rien et n’envoie aucun message.</p>
        {progress}
        <div className="discord-step-panels">
          <section id={`${stepsId}-panel-0`} role="tabpanel" aria-labelledby={`${stepsId}-tab-0`} hidden={activeStep !== 0} tabIndex={0} className="discord-step-panel discord-setup-step">
            <span className="discord-step-kicker">Étape 1</span><h4>Connecter le serveur</h4>
            {connected ? <><Badge tone={verified ? "cyan" : "yellow"}>{verified ? "Équipe et serveur associés" : "Connexion à vérifier"}</Badge><p><strong>{teamName || "Ton équipe"}</strong> est reliée à <strong>{connection.guildName || connection.guildId}</strong>.</p><DiscordPermissionUpdate installUrl={status.installUrl} guildId={connection.guildId} canManage={canManage} /><Button type="button" variant="ghost" onClick={() => selectStep(1, true)}>Choisir les salons</Button></> : <>
              <p>1. Invite NXT5 sur ton serveur Discord. Si le bot y est déjà présent, passe directement au code de liaison.</p>
              {canManage && <DiscordLink className="discord-invite-button nxt5-button-primary" href={status.installUrl || link?.installUrl} onClick={() => setInvitationOpened(true)}>Ajouter à Discord</DiscordLink>}
              <p className="discord-help">L’invitation demande l’autorisation Administrateur, qui donne tous les droits au bot sur ce serveur, y compris dans les salons privés. Un responsable du serveur doit la valider dans Discord. L’ouverture de l’invitation ne confirme pas l’installation.</p>
              {invitationOpened && <p role="status" className="discord-help">Invitation ouverte. Termine l’autorisation dans Discord, puis utilise le code ci-dessous.</p>}
              <p>2. Crée un code propre à cette équipe et colle la commande dans le serveur où le bot est présent. Chaque équipe crée son propre code, même sur un serveur partagé.</p>
              {canManage && <Button type="button" icon={action.busy ? Loader2 : Link2} disabled={action.busy} onClick={() => { setCopyNotice(""); action.run("team-discord-connection", { teamId, action: "create-link" }, setLink); }}>{link ? "Créer un nouveau code" : "Créer le code de liaison"}</Button>}
              {link?.code && <div className="discord-link-code"><p>Commande de liaison à usage unique</p><code>{command}</code><p className="discord-help">{linkExpired ? "Ce code a expiré. Crée un nouveau code." : `Valable jusqu’au ${new Date(link.expiresAt).toLocaleString("fr-FR")}. Un nouveau code remplace le précédent.`}</p><div className="discord-actions"><Button type="button" icon={Copy} variant="ghost" disabled={linkExpired || action.busy} onClick={copyCommand}>Copier la commande</Button><Button type="button" icon={RefreshCw} variant="ghost" disabled={action.busy || resource.loading} onClick={reload}>Vérifier la connexion</Button></div>{copyNotice && <p role="status">{copyNotice}</p>}<p className="discord-help" role="status">{watchingLink ? "Vérification automatique de la liaison pendant deux minutes…" : "Tu peux vérifier la connexion ici ou revenir sur cet onglet après la commande."}</p></div>}
              <DiscordExample teamId={teamId} />
            </>}
          </section>
          <section id={`${stepsId}-panel-1`} role="tabpanel" aria-labelledby={`${stepsId}-tab-1`} hidden={activeStep !== 1} tabIndex={0} className="discord-step-panel">
            {connected ? <><DiscordRoutes key={connection.guildId} teamId={teamId} metadata={status} channelsLoading={resource.loading} channelsError={resource.error || status.connectionError || (status.health?.verified === false ? "La connexion au serveur Discord doit être vérifiée." : "")} canManage={canManage} revision={revision} onSaved={reload} onRoutes={setSavedRoutes} onSnapshot={setRoutesSnapshot} onDirty={setRoutesDirty} onRefreshing={setRoutesRefreshing} /><div className="discord-actions"><Button type="button" variant="ghost" onClick={() => selectStep(2, true)}>Passer au test et à l’activation</Button></div></> : <DiscordStepPrerequisite title="Choisir les salons" onLink={() => selectStep(0, true)} />}
          </section>
          <section id={`${stepsId}-panel-2`} role="tabpanel" aria-labelledby={`${stepsId}-tab-2`} hidden={activeStep !== 2} tabIndex={0} className="discord-step-panel">
            {connected ? <DiscordActivation key={connection.guildId} {...{ teamId, teamName, canManage, status, savedRoutes, routesSnapshot, routesDirty, routesRefreshing, verified, revision, established }} connectionRefreshing={resource.loading} onChanged={reload} onActivated={() => setSelectedView(null)} onTestPassed={setTestPassed} /> : <DiscordStepPrerequisite title="Tester et activer" onLink={() => selectStep(0, true)} />}
          </section>
        </div>
        <div className="discord-overview-links discord-setup-links">{connected && canManage && <Button type="button" variant="ghost" onClick={() => openView("access")}>Accès aux commandes</Button>}<Button type="button" variant="ghost" onClick={() => openView("activity")}>Activité</Button><Button type="button" variant="ghost" onClick={() => openView("settings")}>Aide et réglages</Button></div>
      </section>
      {view === "access" && <div className="discord-section"><Button type="button" variant="ghost" onClick={() => openView("overview")}>Retour à l’aperçu</Button></div>}
      {connected && accessOpened && <div hidden={view !== "access"} className="discord-secondary-panel"><DiscordRoleAccess key={connection.guildId} teamId={teamId} metadata={status} canManage={canManage} revision={revision} /></div>}
      {view === "activity" && <section className="discord-section"><Button type="button" variant="ghost" onClick={() => openView("overview")}>Retour à l’aperçu</Button><DiscordHistory teamId={teamId} canPublish={canPublish || canManage} revision={revision} showSummary={connected} /></section>}
      {view === "settings" && <section className="discord-section discord-secondary-panel"><Button type="button" variant="ghost" onClick={() => openView("overview")}>Retour à l’aperçu</Button><h4>Aide et réglages</h4><details className="discord-guide"><summary>Comment ça marche ?</summary><ConnectionHelp /></details><details className="discord-guide"><summary>Résoudre un problème</summary><h4>Le salon n’apparaît pas ou l’envoi échoue ?</h4><p>Un responsable peut ouvrir « Mettre à jour les autorisations » dans Connecter le serveur ou Choisir les salons, puis valider l’autorisation Administrateur dans Discord. Reviens ensuite dans Choisir les salons et clique sur « Actualiser les salons ».</p><h4>Que reçoivent les membres du salon ?</h4><p>Le résultat, les statistiques et le visuel de la game. Les notes privées du staff ne sont pas incluses. Le message et son image sont lisibles dans Discord ; ouvrir la game dans NXT5 exige toujours les droits de l’équipe.</p><h4>Un message est « à vérifier » ?</h4><p>Consulte le salon avant toute action. L’historique permet d’associer le message déjà envoyé ; un envoi incertain n’est pas renvoyé automatiquement.</p></details>{status?.health?.checkedAt && <p className="discord-help">Dernière vérification : {new Date(status.health.checkedAt).toLocaleString("fr-FR")}.</p>}{connected && canManage && !connection.paused && <div className="discord-actions"><Button type="button" variant="ghost" icon={Pause} disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "pause" }, reload, "La diffusion de l’équipe est en pause.")}>Mettre en pause</Button><p className="discord-help">La pause arrête les publications de cette équipe. Les messages déjà envoyés restent visibles.</p></div>}</section>}
    </>}
    <div className="discord-actions discord-section"><Button type="button" variant="ghost" icon={RefreshCw} disabled={resource.loading || action.busy} onClick={reload}>Actualiser Discord</Button>{view === "settings" && connected && canManage && !confirmDisconnect && <Button type="button" icon={Unplug} variant="danger" disabled={action.busy} onClick={() => setConfirmDisconnect(true)}>Délier cette équipe</Button>}</div>
    {view === "settings" && confirmDisconnect && <div className="discord-confirm"><p>Délier <strong>{teamName || "cette équipe"}</strong> de <strong>{connection?.guildName || "ce serveur"}</strong> arrête uniquement ses publications. Le bot reste sur le serveur et les autres équipes gardent leurs liaisons, leurs réglages et leurs envois. Les messages déjà publiés par cette équipe restent visibles et peuvent être retirés depuis son historique.</p><div className="discord-actions"><Button type="button" variant="danger" disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "disconnect" }, () => { setConfirmDisconnect(false); setSelectedView(null); setLink(null); setSavedRoutes([]); setTestPassed(false); reload(); }, "Cette équipe a été déliée du serveur. Les autres équipes restent connectées.")}>Confirmer la déliaison</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmDisconnect(false)}>Annuler</Button></div></div>}
  </Surface>;
}

function discordPermissionsUrl(installUrl, guildId) {
  if (typeof guildId !== "string" || !/^\d{17,20}$/.test(guildId)) return null;
  try {
    const url = new URL(installUrl);
    if (url.origin !== "https://discord.com" || url.pathname !== "/oauth2/authorize" || url.username || url.password) return null;
    url.searchParams.set("guild_id", guildId);
    url.searchParams.set("disable_guild_select", "true");
    return url.href;
  } catch { return null; }
}

function DiscordPermissionUpdate({ installUrl, guildId, canManage }) {
  const url = canManage ? discordPermissionsUrl(installUrl, guildId) : null;
  if (!url) return null;
  return <div className="discord-permission-update"><DiscordLink href={url}>Mettre à jour les autorisations</DiscordLink><p className="discord-help">Administrateur donne tous les droits au bot sur ce serveur. Un responsable doit valider cette autorisation dans Discord, puis revenir cliquer sur « Actualiser les salons ». Le bot reste installé et les liaisons des équipes sont conservées.</p></div>;
}

function InstallationProgress({ connected, routesReady, active, selectedStep, onSelect, tabsRef, idPrefix }) {
  const steps = [
    ["Connecter le serveur", connected],
    ["Choisir les salons", routesReady],
    ["Tester et activer", active],
  ];
  function onKeyDown(event, index) {
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % steps.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + steps.length - 1) % steps.length
      : event.key === "Home" ? 0 : event.key === "End" ? steps.length - 1 : null;
    if (next == null) return;
    event.preventDefault();
    onSelect(next, true);
  }
  return <div className="discord-install-progress" role="tablist" aria-label="Étapes de configuration Discord">{steps.map(([title, done], index) => <button type="button" key={title} ref={(node) => { tabsRef.current[index] = node; }} id={`${idPrefix}-tab-${index}`} role="tab" aria-label={title} aria-selected={selectedStep === index} aria-controls={`${idPrefix}-panel-${index}`} tabIndex={selectedStep === index ? 0 : -1} className={`discord-step-tab${done ? " is-complete" : ""}${selectedStep === index ? " is-selected" : ""}`} onClick={() => onSelect(index)} onKeyDown={(event) => onKeyDown(event, index)}><span className="discord-progress-number" aria-hidden="true">{done ? <Check size={17} /> : index + 1}</span><span className="discord-step-label"><strong>{title}</strong><span className="sr-only">. {done ? "Étape terminée." : "Étape à terminer."}</span></span></button>)}</div>;
}

function DiscordStepPrerequisite({ title, onLink }) {
  return <div className="discord-setup-step"><h4>{title}</h4><p>Relie d’abord ton équipe à son serveur Discord. Ses salons seront ensuite disponibles pour préparer et tester la diffusion.</p><Button type="button" variant="ghost" icon={Link2} onClick={onLink}>Connecter le serveur</Button></div>;
}

function ConnectionHelp() {
  return <ol className="discord-steps"><li>Dans « Connecter le serveur », invite NXT5 une seule fois avec « Ajouter à Discord » et valide l’autorisation Administrateur dans Discord. Si le bot est déjà présent, crée directement le code de liaison ; ses autorisations peuvent être mises à jour sans le retirer du serveur.</li><li>Colle la commande <code>/nxt connecter code:…</code> dans ce serveur avec un compte autorisé à le gérer. Chaque équipe utilise son propre code.</li><li>Enregistre les salons de cette équipe. Les catégories et mentions sont facultatives. Une équipe reste reliée à un seul serveur ; plusieurs équipes peuvent partager ce serveur, avec leurs propres règles.</li><li>Envoie explicitement l’exemple fictif dans un salon, vérifie sa réception, puis active la diffusion. L’installation ne republie pas les anciennes games.</li></ol>;
}

function DiscordExample({ teamId }) {
  const preview = useDiscordResource(discordQuery("team-discord-test", { teamId }));
  return <details className="discord-guide discord-section"><summary>Voir un exemple de message et de visuel</summary><DiscordFeedback loading={preview.loading} error={preview.error} /><DiscordPreview preview={preview.data} fictitious /></details>;
}

function testFailureHelp(code) {
  if (code === "DISCORD_RATE_LIMITED") return "Discord demande de patienter. Attends quelques instants avant de lancer un nouveau test.";
  if (code === "DISCORD_UNAUTHORIZED" || code === "DISCORD_NOT_CONFIGURED") return "La connexion centrale du bot doit être rétablie par NXT5. Les réglages de ton équipe sont conservés.";
  if (code === "DISCORD_NOT_FOUND") return "Le salon est introuvable. Choisis un salon disponible, enregistre-le, puis relance le test.";
  if (code === "DISCORD_TEST_CONFIG_CHANGED") return "Les salons ont changé pendant le test. Actualise Discord, puis vérifie la configuration actuelle.";
  if (code === "DISCORD_FORBIDDEN") return "Autorise le bot à voir le salon, envoyer des messages et images, intégrer des liens et lire l’historique, puis actualise Discord.";
  return "Le test n’a pas pu être envoyé. Actualise Discord et vérifie les autorisations du salon avant un nouveau test.";
}

function DiscordActivation({ teamId, teamName, canManage, status, savedRoutes, routesSnapshot, routesDirty, routesRefreshing, connectionRefreshing, verified, revision, established, onChanged, onActivated, onTestPassed }) {
  const resource = useDiscordResource(discordQuery("team-discord-test", { teamId }), revision, { keepPreviousData: true });
  const [routeId, setRouteId] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmActivation, setConfirmActivation] = useState(false);
  const request = useRef(null);
  const attempts = useRef(new Map());
  const action = useDiscordAction();
  const connection = status.connection;
  const latestTest = receipt || resource.data?.latestTest;
  const selectedRoute = savedRoutes.find((route) => route.id === routeId);
  const destinationKey = `${connection.guildId}:${selectedRoute?.channelId || ""}`;
  const receiptForDestination = latestTest?.guildId === connection.guildId && latestTest?.channelId === selectedRoute?.channelId;
  const pendingReceipt = receiptForDestination && ["sending", "uncertain"].includes(latestTest?.status) ? latestTest : resource.data?.pendingTests?.find((test) => test.guildId === connection.guildId && test.channelId === selectedRoute?.channelId && ["sending", "uncertain"].includes(test.status));
  const pending = busy || pendingReceipt || Boolean(attempts.current.get(destinationKey));
  const currentReceipt = latestTest?.guildId === connection.guildId && String(latestTest?.configVersion) === String(connection.configVersion) && savedRoutes.some((route) => route.id === latestTest?.routeId && route.channelId === latestTest?.channelId);
  const testPassed = currentReceipt && latestTest?.status === "succeeded";
  const snapshotsMatch = routesSnapshot?.guildId === connection.guildId && routesSnapshot?.configVersion != null && String(routesSnapshot.configVersion) === String(connection.configVersion);
  const serviceReady = status.enabled !== false && verified;
  const testReady = canManage && serviceReady && !routesDirty && Boolean(selectedRoute) && Boolean(resource.data?.message) && !resource.loading && !resource.error;
  const canActivate = canManage && serviceReady && snapshotsMatch && !routesDirty && !routesRefreshing && !connectionRefreshing && !busy && savedRoutes.length > 0 && (established || testPassed);
  const automaticRoutes = savedRoutes.filter((route) => route.enabled);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { onTestPassed(Boolean(testPassed)); }, [testPassed, onTestPassed]);
  useEffect(() => { setConfirmActivation(false); }, [connection.configVersion, connection.guildId]);
  useEffect(() => {
    if (!savedRoutes.some((route) => route.id === routeId)) setRouteId(savedRoutes[0]?.id || "");
  }, [savedRoutes, routeId]);
  useEffect(() => {
    for (const test of resource.data?.pendingTests || []) {
      if (test.guildId === connection.guildId && ["sending", "uncertain"].includes(test.status)) attempts.current.set(`${test.guildId}:${test.channelId}`, { requestId: test.requestId, routeId: test.routeId });
    }
    if (resource.data?.latestTest) {
      const test = resource.data.latestTest;
      setReceipt(test);
      const key = `${test.guildId}:${test.channelId}`;
      if (test.guildId === connection.guildId && ["sending", "uncertain"].includes(test.status)) attempts.current.set(key, { requestId: test.requestId, routeId: test.routeId });
      else if (attempts.current.get(key)?.requestId === test.requestId) attempts.current.delete(key);
    }
  }, [resource.data, connection.guildId]);

  async function sendTest() {
    if (request.current || !canManage || !serviceReady || routesDirty || !selectedRoute || (!pending && !testReady)) return;
    const key = destinationKey;
    const attempt = pendingReceipt ? { requestId: pendingReceipt.requestId, routeId: pendingReceipt.routeId } : attempts.current.get(key) || { requestId: globalThis.crypto.randomUUID(), routeId };
    attempts.current.set(key, attempt);
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setRequestError("");
    try {
      const result = await apiFetch("team-discord-test", { ...discordPost({ teamId, ...attempt }), signal: controller.signal, timeoutMs: 55000 });
      if (!controller.signal.aborted) {
        if (["succeeded", "failed"].includes(result.test?.status)) attempts.current.delete(key);
        else if (result.test?.requestId) attempts.current.set(key, { requestId: result.test.requestId, routeId: result.test.routeId });
        setReceipt(result.test); onChanged();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const refused = error.status >= 400 && error.status < 500 && error.status !== 408 && error.code !== "DISCORD_TEST_PENDING";
        if (refused) attempts.current.delete(key);
        setRequestError(refused ? error.message : `${error.message} Vérifie l’état de ce même test avant de tenter un nouvel envoi.`); onChanged();
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  }

  const testContent = <>
    <p>Envoie un exemple fictif pour vérifier le message et son PNG. Aucun joueur ni rôle n’est mentionné. Ce test reste possible lorsque ton équipe est en pause.</p>
    <DiscordFeedback error={resource.error || requestError} loading={resource.loading && !resource.data} />
    <details className="discord-guide discord-example"><summary>Prévisualiser l’exemple fictif</summary><DiscordPreview preview={resource.data} fictitious /></details>
    {!!savedRoutes.length && <SelectInput label="Salon du message de test" value={routeId} onChange={(value) => { setRouteId(value); setRequestError(""); }} disabled={!canManage || busy || routesDirty}>{savedRoutes.map((route) => <option key={route.id} value={route.id}>#{route.channelName || status.channels?.find((channel) => channel.id === route.channelId)?.name || route.channelId}</option>)}</SelectInput>}
    {routesDirty && <p className="discord-feedback">Enregistre tes salons avant de tester ou d’activer la diffusion.</p>}
    {!savedRoutes.length && <p className="discord-help">Enregistre au moins un salon pour choisir où envoyer le test.</p>}
    {latestTest && <div className="discord-test-receipt" role="status"><Badge tone={latestTest.status === "succeeded" ? "green" : latestTest.status === "failed" ? "red" : "yellow"}>{latestTest.status === "succeeded" ? "Test reçu sur Discord" : latestTest.status === "failed" ? "Test non envoyé" : "Réception du test à vérifier"}</Badge><p>{latestTest.status === "succeeded" ? "Le bot a confirmé la publication du message de test." : latestTest.status === "failed" ? testFailureHelp(latestTest.errorCode) : "Consulte le salon. La vérification recherche le message existant et ne le renvoie pas."}</p>{!currentReceipt && <p className="discord-help">Ce test concerne une ancienne configuration. Un nouveau test validera les salons actuels.</p>}<DiscordLink href={latestTest.messageUrl}>Voir le message de test</DiscordLink></div>}
    {canManage && <div className="discord-actions"><Button type="button" variant={testPassed ? "ghost" : "primary"} icon={busy ? Loader2 : pending ? RefreshCw : MessageSquare} disabled={busy || action.busy || !serviceReady || routesDirty || (!pending && !testReady)} onClick={sendTest}>{busy ? "Vérification du test…" : pending ? "Vérifier ce même test" : latestTest ? "Envoyer un nouveau test" : "Envoyer le message de test"}</Button></div>}
    <p className="discord-help">Ce bouton publie un message visible par les membres du salon sélectionné. L’aperçu seul n’envoie rien.</p>
  </>;
  return <section className="discord-section discord-activation" aria-label="Test et activation">
    {!snapshotsMatch && !routesRefreshing && !connectionRefreshing && <p className="discord-feedback">La connexion et les salons ont changé pendant leur chargement. Actualise Discord avant l’activation.</p>}
    <span className="discord-step-kicker">Étape 3</span><h4>Vérifier et activer</h4>{testContent}
    {connection.paused && canManage && <>
      {!established && !testPassed && <p className="discord-help">La première activation sera disponible après la confirmation du test.</p>}
      {canActivate && !confirmActivation && <Button type="button" icon={Play} disabled={action.busy} onClick={() => setConfirmActivation(true)}>{established ? "Reprendre les envois" : "Activer la diffusion"}</Button>}
      {confirmActivation && <div className="discord-confirm" role="region" aria-label="Confirmer la diffusion"><h4>{established ? "Reprendre" : "Activer"} pour {teamName || "ton équipe"}</h4><p>Serveur : <strong>{connection.guildName || connection.guildId}</strong>.</p><ul className="discord-steps">{savedRoutes.map((route) => <li key={route.id}><strong>#{route.channelName || status.channels?.find((channel) => channel.id === route.channelId)?.name || route.channelId}</strong> · {route.enabled ? "nouvelles games automatiques" : "partages manuels"} · {route.categoryIds?.length ? route.categoryIds.map((id) => status.categories?.find((category) => category.id === id)?.name || "Catégorie supprimée").join(", ") : "toutes les catégories"}{route.mentionRoleId ? ` · mention @${status.roles?.find((role) => role.id === route.mentionRoleId)?.name || "rôle configuré"}` : " · aucune mention"}</li>)}</ul><p>Toute personne ayant accès à ces salons pourra lire les messages et leurs visuels. Les anciennes games ne sont pas republiées automatiquement.</p>{!automaticRoutes.length && <p>Les salons sont réglés sur le partage manuel. Aucune nouvelle game ne sera envoyée automatiquement.</p>}<div className="discord-actions"><Button type="button" icon={action.busy ? Loader2 : Play} disabled={!canActivate || action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "resume", expectedConfigVersion: routesSnapshot.configVersion, expectedGuildId: routesSnapshot.guildId }, () => { setConfirmActivation(false); onChanged(); onActivated(); }, "La diffusion de l’équipe a repris.")}>Confirmer l’activation</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmActivation(false)}>Annuler l’activation</Button></div></div>}
    </>}
    <DiscordFeedback error={action.error} notice={action.notice} />
  </section>;
}
function DiscordRoutes({ teamId, metadata, channelsLoading, channelsError, canManage, onSaved, revision, onRoutes, onSnapshot, onDirty, onRefreshing }) {
  const resource = useDiscordResource(discordQuery("team-discord-routes", { teamId }), revision, { keepPreviousData: true });
  useEffect(() => { onRefreshing(resource.loading || Boolean(resource.error)); }, [resource.loading, resource.error, onRefreshing]);
  useEffect(() => { if (resource.data) { onRoutes(resource.data.routes || []); onSnapshot(resource.data); } }, [resource.data, onRoutes, onSnapshot]);
  if (!resource.data) return <section className="discord-section"><h4>Salons de publication</h4><DiscordFeedback loading={resource.loading} error={resource.error} /><p className="discord-help">Chargement des salons enregistrés…</p><Button type="button" variant="ghost" icon={RefreshCw} disabled={resource.loading || channelsLoading} onClick={onSaved}>Actualiser les salons</Button></section>;
  return <><DiscordFeedback error={resource.error} /><DiscordRoutesEditor {...{ teamId, metadata, channelsLoading, channelsError, canManage, onSaved, onDirty }} routesLoading={resource.loading} routesError={resource.error} initialRoutes={resource.data.routes || []} /></>;
}

function DiscordRoutesEditor({ teamId, metadata, channelsLoading, channelsError, routesLoading, routesError, canManage, onSaved, onDirty, initialRoutes }) {
  const normalize = (route) => ({ ...route, channelId: route.channelId || "", categoryIds: route.categoryIds || [], includeHints: route.includeHints === true, mentionRoleId: route.mentionRoleId || "", enabled: route.enabled !== false });
  const [routes, setRoutes] = useState(() => initialRoutes.map(normalize));
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [dirty, setDirty] = useState(false);
  const action = useDiscordAction();
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { if (!dirty) setRoutes(initialRoutes.map(normalize)); }, [initialRoutes]); // Keep an unsaved draft during status refreshes.
  useEffect(() => {
    if (!dirty || typeof window === "undefined") return undefined;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const hasChannelList = Array.isArray(metadata.channels);
  const channels = hasChannelList ? metadata.channels : [], roles = metadata.roles || [], categories = metadata.categories || [];
  const channelError = channelsError || (!channelsLoading && !hasChannelList ? "La liste des salons n’a pas pu être chargée. Actualise les salons pour réessayer." : "");
  const refreshing = channelsLoading || routesLoading;
  const channelsReady = hasChannelList && !refreshing && !channelError && !routesError;
  const patch = (index, values) => { setRoutes((current) => current.map((route, i) => i === index ? { ...route, ...values } : route)); setDirty(true); };
  const availableChannels = channels.filter((channel) => channel.canSend === true && !routes.some((route) => route.channelId === channel.id));
  const canAdd = canManage && channelsReady && !action.busy && routes.length < 10 && availableChannels.some((channel) => channel.id === selectedChannelId);
  const canSave = channelsReady && new Set(routes.map((route) => route.channelId)).size === routes.length && routes.every((route) => route.channelId && channels.some((channel) => channel.id === route.channelId && channel.canSend === true));
  function addChannel() {
    if (!canAdd) return;
    setRoutes((current) => current.length >= 10 || current.some((route) => route.channelId === selectedChannelId) ? current : [...current, normalize({ channelId: selectedChannelId, enabled: true })]);
    setSelectedChannelId("");
    setDirty(true);
  }
  function save(event) {
    event.preventDefault();
    if (!canManage || !dirty || !canSave || action.busy) return;
    action.run("team-discord-routes", { teamId, routes: routes.map(({ id, channelId, categoryIds, includeHints, mentionRoleId, enabled }) => ({ ...(id ? { id } : {}), channelId, categoryIds, includeHints, mentionRoleId: mentionRoleId || null, enabled })) }, () => { setDirty(false); onSaved(); }, "Salons enregistrés.");
  }
  return <form className="discord-section" onSubmit={save}>
    <span className="discord-step-kicker">Étape 2</span><h4>Salons de publication</h4>
    <p>Ces salons et leurs réglages s’appliquent uniquement à cette équipe, même si le serveur accueille d’autres équipes NXT5.</p>
    <p>Toute personne ayant accès au salon pourra lire le message et son visuel, même sans compte NXT5. Les liens vers les games conservent les droits d’accès NXT5.</p>
    <section className="discord-channel-selection" aria-label="Salons disponibles sur le serveur">
      <div className="discord-channel-picker">
        {canManage && <SelectInput label="Choisir un salon du serveur" value={selectedChannelId} onChange={setSelectedChannelId} disabled={refreshing || action.busy || !channelsReady || routes.length >= 10}>
          <option value="">Sélectionner un salon</option>
          {selectedChannelId && !channels.some((channel) => channel.id === selectedChannelId) && <option value={selectedChannelId} disabled>Salon indisponible</option>}
          {channels.map((channel) => { const added = routes.some((route) => route.channelId === channel.id); return <option key={channel.id} value={channel.id} disabled={channel.canSend !== true || added}>#{channel.name}{channel.canSend !== true ? " · autorisation manquante" : ""}{added ? " · déjà ajouté" : ""}</option>; })}
        </SelectInput>}
        <div className="discord-actions">{canManage && <Button type="button" variant="ghost" icon={Plus} disabled={!canAdd} onClick={addChannel}>Ajouter ce salon</Button>}<Button type="button" variant="ghost" icon={refreshing ? Loader2 : RefreshCw} disabled={refreshing || action.busy} onClick={onSaved}>Actualiser les salons</Button></div>
      </div>
      <DiscordPermissionUpdate installUrl={metadata.installUrl} guildId={metadata.connection?.guildId} canManage={canManage} />
      {refreshing && <p role="status" className="discord-loading"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />Actualisation des salons du serveur…</p>}
      <DiscordFeedback error={channelError} />
      {channelsReady && !channels.length && <p className="discord-feedback">Aucun salon disponible sur ce serveur. Vérifie les droits du bot dans Discord, puis actualise les salons.</p>}
      {channelsReady && channels.length > 0 && !channels.some((channel) => channel.canSend === true) && <p className="discord-feedback">Aucun salon ne permet l’envoi. Autorise le bot à voir le salon, envoyer des messages et images, intégrer des liens et lire l’historique, puis actualise les salons.</p>}
      {canManage && routes.length >= 10 ? <p className="discord-help">Limite atteinte : dix salons par équipe. Supprime un salon pour en ajouter un autre.</p> : canManage && channelsReady && channels.some((channel) => channel.canSend === true) && !availableChannels.length && <p className="discord-help">Tous les salons utilisables sont déjà ajoutés.</p>}
      {canManage && <p className="discord-help">Choisis un salon, ajoute-le, puis enregistre tes salons. Aucun message n’est envoyé à cette étape.</p>}
    </section>
    {!routes.length && <p>{canManage ? `${dirty ? "Aucun salon dans le brouillon." : "Aucun salon enregistré."} Choisis un salon ci-dessus pour préparer la diffusion.` : "Aucun salon n’est configuré pour cette équipe."}</p>}
    <div className="discord-routes">{routes.map((route, index) => {
      const channel = channels.find((item) => item.id === route.channelId);
      const channelName = channel?.name || route.channelName || "Salon indisponible";
      const mentionName = roles.find((role) => role.id === route.mentionRoleId)?.name || "rôle indisponible";
      return <fieldset key={route.id || `new-${index}`} className="discord-route" disabled={!canManage || action.busy}>
        <legend>#{channelName}</legend>
        <label className="discord-check"><input type="checkbox" checked={route.enabled} onChange={(event) => patch(index, { enabled: event.target.checked })} />Diffuser automatiquement les nouvelles games correspondantes</label>
        <p className="discord-help">{route.categoryIds.length ? `${route.categoryIds.length} catégorie${route.categoryIds.length > 1 ? "s" : ""}` : "Toutes les catégories"}{route.mentionRoleId ? ` · Mention @${mentionName}` : ""}{route.includeHints ? " · Pistes de review" : ""}</p>
        <details className="discord-guide">
          <summary>Options du salon <span className="sr-only">#{channelName}</span></summary>
          <div className="discord-form-grid"><SelectInput label={`Salon Discord · destination ${index + 1}`} value={route.channelId} onChange={(value) => patch(index, { channelId: value, mentionRoleId: "" })} required><option value="">Choisir un salon</option>{route.channelId && !channels.some((item) => item.id === route.channelId) && <option value={route.channelId} disabled>Salon indisponible</option>}{channels.map((item) => <option key={item.id} value={item.id} disabled={item.canSend === false || routes.some((other, i) => i !== index && other.channelId === item.id)}>#{item.name}{item.canSend === false ? " · autorisation manquante" : ""}</option>)}</SelectInput>
            <SelectInput label={`Mention · destination ${index + 1}`} value={route.mentionRoleId} onChange={(value) => patch(index, { mentionRoleId: value })}><option value="">Aucune mention</option>{route.mentionRoleId && !roles.some((role) => role.id === route.mentionRoleId) && <option value={route.mentionRoleId} disabled>Rôle indisponible</option>}{roles.map((role) => <option key={role.id} value={role.id} disabled={role.mentionable === false && !channel?.canMentionRoles}>@{role.name}</option>)}</SelectInput></div>
          <fieldset className="discord-categories"><legend>Catégorie · destination {index + 1}</legend><label className="discord-check"><input type="checkbox" checked={!route.categoryIds.length} onChange={(event) => patch(index, { categoryIds: event.target.checked ? [] : categories[0] ? [categories[0].id] : [] })} />Toutes les catégories, y compris les games non classées</label>{categories.map((category) => <label key={category.id} className="discord-check"><input type="checkbox" checked={route.categoryIds.includes(category.id)} onChange={(event) => patch(index, { categoryIds: event.target.checked ? [...route.categoryIds, category.id] : route.categoryIds.filter((id) => id !== category.id) })} />{category.name}</label>)}</fieldset>
          <label className="discord-check"><input type="checkbox" checked={route.includeHints} onChange={(event) => patch(index, { includeHints: event.target.checked })} />Ajouter les pistes de review au message</label>
          <p className="discord-help">Les corrections actualisent la publication existante. Les notes privées du staff ne sont pas incluses.</p>
          {canManage && <Button type="button" variant="ghost" icon={X} onClick={() => { setRoutes((current) => current.filter((_, i) => index !== i)); setDirty(true); }}>Supprimer cette destination</Button>}
        </details>
      </fieldset>;
    })}</div>
    <DiscordFeedback error={action.error} notice={action.notice} />
    {canManage && <div className="discord-actions"><Button type="submit" icon={action.busy ? Loader2 : Check} disabled={action.busy || !dirty || !canSave}>Enregistrer les salons</Button>{dirty && <p className="discord-help" role="status">Modifications non enregistrées.</p>}</div>}
  </form>;
}

export function DiscordAdminStatus() {
  const [revision, setRevision] = useState(0);
  const resource = useDiscordResource("admin-discord", revision);
  const status = resource.data;
  return <Surface className="discord-panel"><div className="discord-heading"><h3><MessageSquare aria-hidden="true" className="h-5 w-5" />Discord</h3><Badge tone={status?.enabled && status?.configured ? "cyan" : "slate"}>{resource.loading ? "Chargement" : !status?.configured ? "À configurer" : status.enabled ? "En service" : "Envois suspendus"}</Badge></div><p>Les destinations et les autorisations de publication se règlent dans la gestion de chaque équipe.</p><DiscordFeedback error={resource.error} loading={resource.loading} />{status && <><dl className="discord-health">{[["Équipes connectées", status.connectionsCount], ["En attente", status.queuedCount], ["En échec", status.failedCount], ["Envois à vérifier", status.unknownCount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>{status.oldestPendingAt && <p className="discord-help">Plus ancienne publication en attente : {new Date(status.oldestPendingAt).toLocaleString("fr-FR")}.</p>}{!!status.issues?.length && <ul className="discord-steps">{status.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}<p className="discord-help">La configuration du bot et la suspension globale des envois se gèrent sur le serveur NXT5.</p></>}<Button type="button" icon={RefreshCw} variant="ghost" disabled={resource.loading} onClick={() => setRevision((value) => value + 1)}>Actualiser Discord</Button></Surface>;
}
