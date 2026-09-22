import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageSquare, Pause, Play, Plus, RefreshCw, Unplug, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import { DiscordFeedback, DiscordHistory, DiscordLink, DiscordPreview, discordPost, discordQuery, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";

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
  const [selectedStep, setSelectedStep] = useState(null);
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
  const activeStep = selectedStep ?? (connected ? 2 : 0);
  const selectStep = (index, focus = false) => {
    setSelectedStep(index);
    if (focus) stepTabs.current[index]?.focus();
  };

  useEffect(() => {
    if (status?.configured) setSelectedStep((current) => current ?? (connected ? 2 : 0));
  }, [status?.configured, connected]);

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

  useEffect(() => { if (connected) { setLink(null); setCopyNotice(""); } }, [connected]);

  async function copyCommand() {
    if (linkExpired) return;
    try { await navigator.clipboard.writeText(command); setCopyNotice("Commande copiée. Colle-la dans le serveur Discord de l’équipe."); }
    catch { setCopyNotice("Sélectionne la commande affichée pour la copier."); }
  }

  const currentDestinations = connected && routesSnapshot?.guildId === connection.guildId && String(routesSnapshot?.configVersion) === String(connection.configVersion);
  const progress = <InstallationProgress connected={connected} invitationOpened={invitationOpened} routesReady={currentDestinations && savedRoutes.length > 0 && !routesDirty} testPassed={currentDestinations && testPassed} active={established && !connection.paused && status.enabled !== false && verified} selectedStep={activeStep} onSelect={selectStep} tabsRef={stepTabs} idPrefix={stepsId} />;
  return <Surface className="discord-panel discord-dashboard">
    <div className="discord-heading discord-dashboard-status">
      <div><p className="discord-eyebrow">Espace Discord de l’équipe</p><h3><MessageSquare aria-hidden="true" className="h-5 w-5" />{teamName || "Ton équipe"}</h3><p className="discord-server">Serveur : <strong>{connected ? connection.guildName || connection.guildId : "aucun serveur relié"}</strong></p></div>
      <Badge tone={statusTone}>{statusLabel}</Badge>
    </div>
    <DiscordFeedback loading={resource.loading && !status} error={resource.error || action.error || status?.connectionError} notice={action.notice} />
    {status?.health?.checkedAt && <p className="discord-help">Dernière vérification : {new Date(status.health.checkedAt).toLocaleString("fr-FR")}.</p>}
    {status?.configured === false && <p className="discord-feedback">Le bot Discord n’est pas encore disponible. Un administrateur NXT5 doit terminer sa configuration.</p>}
    {status?.configured && status.enabled === false && <p className="discord-feedback">Les envois Discord sont suspendus pour toutes les équipes par NXT5. Les réglages restent disponibles ; le test et l’activation attendent la reprise du service.</p>}
    {!canManage && <p className="discord-help">Seuls le propriétaire et les capitaines peuvent relier cette équipe au serveur, modifier ses destinations, tester et activer ses envois. Tu peux consulter l’historique et partager les games selon tes droits.</p>}
    {status?.configured && <>
      <section className="discord-section discord-configuration" aria-label="Configuration du bot">
        <h4>{established ? "Gérer le bot de l’équipe" : "Ton équipe, ses games, ses salons."}</h4>
        <p>{established ? "Choisis une rubrique pour consulter ou modifier sa configuration." : "Choisis une étape pour afficher son contenu. La première connexion reste en pause jusqu’à ton activation."}</p>
        {progress}
        <div className="discord-step-panels">
          <section id={`${stepsId}-panel-0`} role="tabpanel" aria-labelledby={`${stepsId}-tab-0`} hidden={activeStep !== 0} tabIndex={0} className="discord-step-panel discord-setup-step">
            <span className="discord-step-kicker">Étape 1</span><h4>Inviter le bot</h4>
            {connected ? <><Badge tone={verified ? "cyan" : "yellow"}>{verified ? "Installation vérifiée" : "Serveur associé · connexion à vérifier"}</Badge><p>NXT5 a été associé à <strong>{connection.guildName || connection.guildId}</strong>. L’état de la connexion reste visible en haut de cette page.</p><DiscordPermissionUpdate installUrl={status.installUrl} guildId={connection.guildId} canManage={canManage} /><Button type="button" variant="ghost" onClick={() => selectStep(1, true)}>Voir la liaison de l’équipe</Button></> : <>
              <p>Invite NXT5 une seule fois sur le serveur. Plusieurs équipes NXT5 peuvent ensuite partager ce serveur, chacune avec sa propre liaison.</p>
              {canManage && <DiscordLink className="discord-invite-button nxt5-button-primary" href={status.installUrl || link?.installUrl} onClick={() => setInvitationOpened(true)}>Ajouter à Discord</DiscordLink>}
              <p>L’invitation demande l’autorisation Administrateur. Administrateur donne tous les droits au bot sur ce serveur. Un responsable du serveur doit la valider dans Discord.</p>
              <p className="discord-help">Si le bot est déjà présent, passe directement à Relier. Tu dois pouvoir gérer ce serveur Discord. L’ouverture de l’invitation ne confirme pas l’installation : la liaison la vérifiera.</p>
              {invitationOpened && <p role="status" className="discord-help">Invitation ouverte. Termine l’autorisation dans Discord, puis relie ton équipe.</p>}
              <div className="discord-actions"><Button type="button" variant="ghost" icon={Link2} onClick={() => selectStep(1, true)}>Passer à Relier</Button></div>
              <DiscordExample teamId={teamId} />
            </>}
          </section>
          <section id={`${stepsId}-panel-1`} role="tabpanel" aria-labelledby={`${stepsId}-tab-1`} hidden={activeStep !== 1} tabIndex={0} className="discord-step-panel discord-setup-step">
            <span className="discord-step-kicker">Étape 2</span><h4>Relier {teamName || "mon équipe"}</h4>
            {connected ? <><Badge tone="cyan">Équipe et serveur associés</Badge><p><strong>{teamName || "Ton équipe"}</strong> est reliée à <strong>{connection.guildName || connection.guildId}</strong>. Les salons et catégories de cette équipe se règlent à l’étape suivante, indépendamment des autres équipes du serveur.</p><Button type="button" variant="ghost" onClick={() => selectStep(2, true)}>Choisir les destinations</Button></> : <>
              <p>Crée un code propre à cette équipe, puis colle la commande dans un salon du serveur où le bot est présent. Chaque équipe crée son propre code, même sur un serveur déjà relié à une autre équipe.</p>
              {canManage && <Button type="button" icon={action.busy ? Loader2 : Link2} disabled={action.busy} onClick={() => { setCopyNotice(""); action.run("team-discord-connection", { teamId, action: "create-link" }, setLink); }}>{link ? "Créer un nouveau code" : "Créer le code de liaison"}</Button>}
              {link?.code && <div className="discord-link-code"><p>Commande de liaison à usage unique</p><code>{command}</code><p className="discord-help">{linkExpired ? "Ce code a expiré. Crée un nouveau code." : `Valable jusqu’au ${new Date(link.expiresAt).toLocaleString("fr-FR")}. Un nouveau code remplace le précédent.`}</p><div className="discord-actions"><Button type="button" icon={Copy} variant="ghost" disabled={linkExpired || action.busy} onClick={copyCommand}>Copier la commande</Button><Button type="button" icon={RefreshCw} variant="ghost" disabled={action.busy || resource.loading} onClick={reload}>Vérifier la connexion</Button></div>{copyNotice && <p role="status">{copyNotice}</p>}<p className="discord-help" role="status">{watchingLink ? "Vérification automatique de la liaison pendant deux minutes…" : "Tu peux vérifier la connexion ici ou revenir sur cet onglet après la commande."}</p></div>}
            </>}
          </section>
          <section id={`${stepsId}-panel-2`} role="tabpanel" aria-labelledby={`${stepsId}-tab-2`} hidden={activeStep !== 2} tabIndex={0} className="discord-step-panel">
            {connected ? <><DiscordRoutes key={connection.guildId} teamId={teamId} metadata={status} channelsLoading={resource.loading} channelsError={resource.error || status.connectionError || (status.health?.verified === false ? "La connexion au serveur Discord doit être vérifiée." : "")} canManage={canManage} revision={revision} onSaved={reload} onRoutes={setSavedRoutes} onSnapshot={setRoutesSnapshot} onDirty={setRoutesDirty} onRefreshing={setRoutesRefreshing} /><div className="discord-actions"><Button type="button" variant="ghost" onClick={() => selectStep(3, true)}>Passer au test et à l’activation</Button></div></> : <DiscordStepPrerequisite title="Choisir les salons" onLink={() => selectStep(1, true)} />}
          </section>
          <section id={`${stepsId}-panel-3`} role="tabpanel" aria-labelledby={`${stepsId}-tab-3`} hidden={activeStep !== 3} tabIndex={0} className="discord-step-panel">
            {connected ? <DiscordActivation key={connection.guildId} {...{ teamId, teamName, canManage, status, savedRoutes, routesSnapshot, routesDirty, routesRefreshing, verified, revision, established }} connectionRefreshing={resource.loading} onChanged={reload} onTestPassed={setTestPassed} /> : <DiscordStepPrerequisite title="Tester et activer" onLink={() => selectStep(1, true)} />}
          </section>
        </div>
      </section>
      {connected && canManage && !connection.paused && <div className="discord-actions"><Button type="button" variant="ghost" icon={Pause} disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "pause" }, reload, "La diffusion de l’équipe est en pause.")}>Mettre en pause</Button><p className="discord-help">La pause arrête les publications de cette équipe. Les messages déjà envoyés restent visibles.</p></div>}
      <DiscordHistory teamId={teamId} canPublish={canPublish || canManage} revision={revision} showSummary={connected} />
      <details className="discord-guide discord-section"><summary>Aide et résolution des problèmes</summary><ConnectionHelp /><h4>Le salon n’apparaît pas ou l’envoi échoue ?</h4><p>Un responsable peut ouvrir « Mettre à jour les autorisations » dans Inviter ou Choisir les salons, puis valider l’autorisation Administrateur dans Discord. Reviens ensuite dans Choisir les salons et clique sur « Actualiser les salons ».</p><h4>Que reçoivent les membres du salon ?</h4><p>Le résultat, les statistiques et le visuel de la game. Les notes privées du staff ne sont pas incluses. Le message et son image sont lisibles dans Discord ; ouvrir la game dans NXT5 exige toujours les droits de l’équipe.</p><h4>Un message est « à vérifier » ?</h4><p>Consulte le salon avant toute action. L’historique permet d’associer le message déjà envoyé ; un envoi incertain n’est pas renvoyé automatiquement.</p></details>
    </>}
    <div className="discord-actions discord-section"><Button type="button" variant="ghost" icon={RefreshCw} disabled={resource.loading || action.busy} onClick={reload}>Actualiser Discord</Button>{connected && canManage && !confirmDisconnect && <Button type="button" icon={Unplug} variant="danger" disabled={action.busy} onClick={() => setConfirmDisconnect(true)}>Délier cette équipe</Button>}</div>
    {confirmDisconnect && <div className="discord-confirm"><p>Délier <strong>{teamName || "cette équipe"}</strong> de <strong>{connection?.guildName || "ce serveur"}</strong> arrête uniquement ses publications. Le bot reste sur le serveur et les autres équipes gardent leurs liaisons, leurs réglages et leurs envois. Les messages déjà publiés par cette équipe restent visibles et peuvent être retirés depuis son historique.</p><div className="discord-actions"><Button type="button" variant="danger" disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "disconnect" }, () => { setConfirmDisconnect(false); setLink(null); setSavedRoutes([]); setTestPassed(false); reload(); }, "Cette équipe a été déliée du serveur. Les autres équipes restent connectées.")}>Confirmer la déliaison</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmDisconnect(false)}>Annuler</Button></div></div>}
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

function InstallationProgress({ connected, invitationOpened, routesReady, testPassed, active, selectedStep, onSelect, tabsRef, idPrefix }) {
  const steps = [
    ["Inviter", connected, connected ? "Bot relié au serveur" : invitationOpened ? "Invitation ouverte · à confirmer" : "Choisis ton serveur"],
    ["Relier", connected, connected ? "Équipe et serveur associés" : "Commande /nxt connecter"],
    ["Choisir les salons", routesReady, routesReady ? "Destinations enregistrées" : "Salons et catégories"],
    ["Tester et activer", active, active ? "Diffusion activée" : testPassed ? "Test confirmé · activation à faire" : "Un exemple, puis ton accord"],
  ];
  function onKeyDown(event, index) {
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % steps.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + steps.length - 1) % steps.length
      : event.key === "Home" ? 0 : event.key === "End" ? steps.length - 1 : null;
    if (next == null) return;
    event.preventDefault();
    onSelect(next, true);
  }
  return <div className="discord-install-progress" role="tablist" aria-label="Étapes de configuration Discord">{steps.map(([title, done, detail], index) => <button type="button" key={title} ref={(node) => { tabsRef.current[index] = node; }} id={`${idPrefix}-tab-${index}`} role="tab" aria-label={title} aria-selected={selectedStep === index} aria-controls={`${idPrefix}-panel-${index}`} aria-describedby={`${idPrefix}-step-description-${index}`} tabIndex={selectedStep === index ? 0 : -1} className={`discord-step-tab${done ? " is-complete" : ""}${selectedStep === index ? " is-selected" : ""}`} onClick={() => onSelect(index)} onKeyDown={(event) => onKeyDown(event, index)}><span className="discord-progress-number" aria-hidden="true">{done ? <Check size={17} /> : index + 1}</span><span className="discord-step-label"><strong>{title}</strong><span id={`${idPrefix}-step-description-${index}`}>{detail}<span className="sr-only">. {done ? "Étape terminée." : "Étape à terminer."}</span></span></span></button>)}</div>;
}

function DiscordStepPrerequisite({ title, onLink }) {
  return <div className="discord-setup-step"><h4>{title}</h4><p>Relie d’abord ton équipe à son serveur Discord. Ses salons seront ensuite disponibles pour préparer et tester la diffusion.</p><Button type="button" variant="ghost" icon={Link2} onClick={onLink}>Aller à Relier</Button></div>;
}

function ConnectionHelp() {
  return <ol className="discord-steps"><li>Invite NXT5 une seule fois sur le serveur avec « Ajouter à Discord » et valide l’autorisation Administrateur dans Discord. Si le bot est déjà présent, passe à Relier ; ses autorisations peuvent être mises à jour sans le retirer du serveur.</li><li>Crée le code de liaison propre à ton équipe et colle la commande <code>/nxt connecter code:…</code> dans ce serveur avec un compte autorisé à le gérer.</li><li>Enregistre les salons, catégories et mentions de cette équipe. Une équipe reste reliée à un seul serveur ; plusieurs équipes peuvent partager ce serveur. Chacune gère ses propres règles et jusqu’à dix salons.</li><li>Envoie explicitement l’exemple fictif dans un salon, vérifie sa réception, puis active la diffusion. L’installation ne republie pas les anciennes games.</li></ol>;
}

function DiscordExample({ teamId }) {
  const preview = useDiscordResource(discordQuery("team-discord-test", { teamId }));
  return <details className="discord-guide discord-section"><summary>Voir un exemple de message et de visuel</summary><DiscordFeedback loading={preview.loading} error={preview.error} /><DiscordPreview preview={preview.data} fictitious /></details>;
}

function testFailureHelp(code) {
  if (code === "DISCORD_RATE_LIMITED") return "Discord demande de patienter. Attends quelques instants avant de lancer un nouveau test.";
  if (code === "DISCORD_UNAUTHORIZED" || code === "DISCORD_NOT_CONFIGURED") return "La connexion centrale du bot doit être rétablie par NXT5. Les réglages de ton équipe sont conservés.";
  if (code === "DISCORD_NOT_FOUND") return "Le salon est introuvable. Choisis une destination disponible, enregistre-la, puis relance le test.";
  if (code === "DISCORD_TEST_CONFIG_CHANGED") return "Les destinations ont changé pendant le test. Actualise Discord, puis vérifie la configuration actuelle.";
  if (code === "DISCORD_FORBIDDEN") return "Autorise le bot à voir le salon, envoyer des messages et images, intégrer des liens et lire l’historique, puis actualise Discord.";
  return "Le test n’a pas pu être envoyé. Actualise Discord et vérifie les autorisations du salon avant un nouveau test.";
}

function DiscordActivation({ teamId, teamName, canManage, status, savedRoutes, routesSnapshot, routesDirty, routesRefreshing, connectionRefreshing, verified, revision, established, onChanged, onTestPassed }) {
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
    {routesDirty && <p className="discord-feedback">Enregistre tes destinations avant de tester ou d’activer la diffusion.</p>}
    {!savedRoutes.length && <p className="discord-help">Enregistre au moins une destination pour choisir le salon du test.</p>}
    {latestTest && <div className="discord-test-receipt" role="status"><Badge tone={latestTest.status === "succeeded" ? "green" : latestTest.status === "failed" ? "red" : "yellow"}>{latestTest.status === "succeeded" ? "Test reçu sur Discord" : latestTest.status === "failed" ? "Test non envoyé" : "Réception du test à vérifier"}</Badge><p>{latestTest.status === "succeeded" ? "Le bot a confirmé la publication du message de test." : latestTest.status === "failed" ? testFailureHelp(latestTest.errorCode) : "Consulte le salon. La vérification recherche le message existant et ne le renvoie pas."}</p>{!currentReceipt && <p className="discord-help">Ce test concerne une ancienne configuration. Un nouveau test validera les destinations actuelles.</p>}<DiscordLink href={latestTest.messageUrl}>Voir le message de test</DiscordLink></div>}
    {canManage && <div className="discord-actions"><Button type="button" variant={testPassed ? "ghost" : "primary"} icon={busy ? Loader2 : pending ? RefreshCw : MessageSquare} disabled={busy || action.busy || !serviceReady || routesDirty || (!pending && !testReady)} onClick={sendTest}>{busy ? "Vérification du test…" : pending ? "Vérifier ce même test" : latestTest ? "Envoyer un nouveau test" : "Envoyer le message de test"}</Button></div>}
    <p className="discord-help">Ce bouton publie un message visible par les membres du salon sélectionné. L’aperçu seul n’envoie rien.</p>
  </>;
  return <section className="discord-section discord-activation" aria-label="Test et activation">
    {!snapshotsMatch && !routesRefreshing && !connectionRefreshing && <p className="discord-feedback">La connexion et les destinations ont changé pendant leur chargement. Actualise Discord avant l’activation.</p>}
    <span className="discord-step-kicker">Étape 4</span><h4>Vérifier et activer</h4>{testContent}
    {connection.paused && canManage && <>
      {!established && !testPassed && <p className="discord-help">La première activation sera disponible après la confirmation du test.</p>}
      {canActivate && !confirmActivation && <Button type="button" icon={Play} disabled={action.busy} onClick={() => setConfirmActivation(true)}>{established ? "Reprendre les envois" : "Activer la diffusion"}</Button>}
      {confirmActivation && <div className="discord-confirm" role="region" aria-label="Confirmer la diffusion"><h4>{established ? "Reprendre" : "Activer"} pour {teamName || "ton équipe"}</h4><p>Serveur : <strong>{connection.guildName || connection.guildId}</strong>.</p><ul className="discord-steps">{savedRoutes.map((route) => <li key={route.id}><strong>#{route.channelName || status.channels?.find((channel) => channel.id === route.channelId)?.name || route.channelId}</strong> · {route.enabled ? "nouvelles games automatiques" : "partages manuels"} · {route.categoryIds?.length ? route.categoryIds.map((id) => status.categories?.find((category) => category.id === id)?.name || "Catégorie supprimée").join(", ") : "toutes les catégories"}{route.mentionRoleId ? ` · mention @${status.roles?.find((role) => role.id === route.mentionRoleId)?.name || "rôle configuré"}` : " · aucune mention"}</li>)}</ul><p>Toute personne ayant accès à ces salons pourra lire les messages et leurs visuels. Les anciennes games ne sont pas republiées automatiquement.</p>{!automaticRoutes.length && <p>Les destinations sont réglées sur le partage manuel. Aucune nouvelle game ne sera envoyée automatiquement.</p>}<div className="discord-actions"><Button type="button" icon={action.busy ? Loader2 : Play} disabled={!canActivate || action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "resume", expectedConfigVersion: routesSnapshot.configVersion, expectedGuildId: routesSnapshot.guildId }, () => { setConfirmActivation(false); onChanged(); }, "La diffusion de l’équipe a repris.")}>Confirmer l’activation</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmActivation(false)}>Annuler l’activation</Button></div></div>}
    </>}
    <DiscordFeedback error={action.error} notice={action.notice} />
  </section>;
}
function DiscordRoutes({ teamId, metadata, channelsLoading, channelsError, canManage, onSaved, revision, onRoutes, onSnapshot, onDirty, onRefreshing }) {
  const resource = useDiscordResource(discordQuery("team-discord-routes", { teamId }), revision, { keepPreviousData: true });
  useEffect(() => { onRefreshing(resource.loading || Boolean(resource.error)); }, [resource.loading, resource.error, onRefreshing]);
  useEffect(() => { if (resource.data) { onRoutes(resource.data.routes || []); onSnapshot(resource.data); } }, [resource.data, onRoutes, onSnapshot]);
  if (!resource.data) return <section className="discord-section"><h4>Destinations des games</h4><DiscordFeedback loading={resource.loading} error={resource.error} /><p className="discord-help">Les destinations enregistrées doivent être chargées avant de choisir un salon.</p><Button type="button" variant="ghost" icon={RefreshCw} disabled={resource.loading || channelsLoading} onClick={onSaved}>Actualiser les salons</Button></section>;
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
    action.run("team-discord-routes", { teamId, routes: routes.map(({ id, channelId, categoryIds, includeHints, mentionRoleId, enabled }) => ({ ...(id ? { id } : {}), channelId, categoryIds, includeHints, mentionRoleId: mentionRoleId || null, enabled })) }, () => { setDirty(false); onSaved(); }, "Destinations enregistrées.");
  }
  return <form className="discord-section" onSubmit={save}>
    <span className="discord-step-kicker">Salons et règles de diffusion</span><h4>Destinations des games</h4>
    <p>Ces destinations et leurs règles s’appliquent uniquement à cette équipe, même si le serveur accueille d’autres équipes NXT5.</p>
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
      {canManage && routes.length >= 10 ? <p className="discord-help">Limite atteinte : dix destinations par équipe. Supprime une destination pour ajouter un autre salon.</p> : canManage && channelsReady && channels.some((channel) => channel.canSend === true) && !availableChannels.length && <p className="discord-help">Tous les salons utilisables sont déjà ajoutés.</p>}
      {canManage && <p className="discord-help">Choisis un salon, ajoute-le au brouillon, puis enregistre les destinations. Aucun envoi n’est déclenché par ce choix.</p>}
    </section>
    {!routes.length && <p>{canManage ? `${dirty ? "Aucune destination dans le brouillon." : "Aucune destination enregistrée."} Choisis un salon ci-dessus pour préparer la diffusion.` : "Aucune destination n’est configurée pour cette équipe."}</p>}
    <div className="discord-routes">{routes.map((route, index) => <fieldset key={route.id || `new-${index}`} className="discord-route" disabled={!canManage || action.busy}>
      <legend>Destination {index + 1}</legend>
      <div className="discord-form-grid"><SelectInput label={`Salon Discord · destination ${index + 1}`} value={route.channelId} onChange={(value) => patch(index, { channelId: value, mentionRoleId: "" })} required><option value="">Choisir un salon</option>{route.channelId && !channels.some((channel) => channel.id === route.channelId) && <option value={route.channelId} disabled>Salon indisponible</option>}{channels.map((channel) => <option key={channel.id} value={channel.id} disabled={channel.canSend === false || routes.some((other, i) => i !== index && other.channelId === channel.id)}>#{channel.name}{channel.canSend === false ? " · autorisation manquante" : ""}</option>)}</SelectInput>
      <SelectInput label={`Mention · destination ${index + 1}`} value={route.mentionRoleId} onChange={(value) => patch(index, { mentionRoleId: value })}><option value="">Aucune mention</option>{route.mentionRoleId && !roles.some((role) => role.id === route.mentionRoleId) && <option value={route.mentionRoleId} disabled>Rôle indisponible</option>}{roles.map((role) => <option key={role.id} value={role.id} disabled={role.mentionable === false && !channels.find((channel) => channel.id === route.channelId)?.canMentionRoles}>@{role.name}</option>)}</SelectInput></div>
      <fieldset className="discord-categories"><legend>Catégorie · destination {index + 1}</legend><label className="discord-check"><input type="checkbox" checked={!route.categoryIds.length} onChange={(event) => patch(index, { categoryIds: event.target.checked ? [] : categories[0] ? [categories[0].id] : [] })} />Toutes les catégories, y compris les games non classées</label>{categories.map((category) => <label key={category.id} className="discord-check"><input type="checkbox" checked={route.categoryIds.includes(category.id)} onChange={(event) => patch(index, { categoryIds: event.target.checked ? [...route.categoryIds, category.id] : route.categoryIds.filter((id) => id !== category.id) })} />{category.name}</label>)}</fieldset>
      <label className="discord-check"><input type="checkbox" checked={route.includeHints} onChange={(event) => patch(index, { includeHints: event.target.checked })} />Ajouter les pistes de review au message</label>
      <label className="discord-check"><input type="checkbox" checked={route.enabled} onChange={(event) => patch(index, { enabled: event.target.checked })} />Diffuser automatiquement les nouvelles games correspondantes</label>
      <p className="discord-help">Les corrections actualisent la publication existante. Les notes privées du staff ne sont pas incluses.</p>
      {canManage && <Button type="button" variant="ghost" icon={X} onClick={() => { setRoutes((current) => current.filter((_, i) => index !== i)); setDirty(true); }}>Supprimer cette destination</Button>}
    </fieldset>)}</div>
    <DiscordFeedback error={action.error} notice={action.notice} />
    {canManage && <div className="discord-actions"><Button type="submit" icon={action.busy ? Loader2 : Check} disabled={action.busy || !dirty || !canSave}>Enregistrer les destinations</Button>{dirty && <p className="discord-help" role="status">Modifications non enregistrées.</p>}</div>}
  </form>;
}

export function DiscordAdminStatus() {
  const [revision, setRevision] = useState(0);
  const resource = useDiscordResource("admin-discord", revision);
  const status = resource.data;
  return <Surface className="discord-panel"><div className="discord-heading"><h3><MessageSquare aria-hidden="true" className="h-5 w-5" />Discord</h3><Badge tone={status?.enabled && status?.configured ? "cyan" : "slate"}>{resource.loading ? "Chargement" : !status?.configured ? "À configurer" : status.enabled ? "En service" : "Envois suspendus"}</Badge></div><p>Les destinations et les autorisations de publication se règlent dans la gestion de chaque équipe.</p><DiscordFeedback error={resource.error} loading={resource.loading} />{status && <><dl className="discord-health">{[["Équipes connectées", status.connectionsCount], ["En attente", status.queuedCount], ["En échec", status.failedCount], ["Envois à vérifier", status.unknownCount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>{status.oldestPendingAt && <p className="discord-help">Plus ancienne publication en attente : {new Date(status.oldestPendingAt).toLocaleString("fr-FR")}.</p>}{!!status.issues?.length && <ul className="discord-steps">{status.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}<p className="discord-help">La configuration du bot et la suspension globale des envois se gèrent sur le serveur NXT5.</p></>}<Button type="button" icon={RefreshCw} variant="ghost" disabled={resource.loading} onClick={() => setRevision((value) => value + 1)}>Actualiser Discord</Button></Surface>;
}
