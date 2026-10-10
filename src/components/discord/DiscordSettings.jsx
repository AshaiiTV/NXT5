import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, CircleHelp, Copy, Hash, History, LayoutDashboard, Link2, Loader2, MessageSquare, Pause, Play, Plus, RefreshCw, Send, ShieldCheck, Unplug, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import { DiscordFeedback, DiscordHistory, DiscordLink, DiscordPreview, discordPost, discordQuery, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";
import DiscordRoleAccess from "./DiscordRoleAccess.jsx";

export default function DiscordSettings({ teamId, teamName, canManage = false, canPublish = false }) {
  useLanguage();
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
  if (!routes.length) return ["Publications à configurer", "yellow"];
  if (!routes.some((route) => route.enabled)) return ["Diffusion manuelle", "cyan"];
  return ["Diffusion active", "green"];
}

function DiscordSettingsContent({ teamId, teamName, canManage, canPublish }) {
  useLanguage();
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
  const [routesError, setRoutesError] = useState("");
  const [, setTestPassed] = useState(false);
  const [selectedView, setSelectedView] = useState(null);
  const [accessOpened, setAccessOpened] = useState(false);
  const stepTabs = useRef([]);
  const stepFocus = useRef(null);
  const navFocus = useRef(null);
  const navButtons = useRef({});
  const stepsId = useId();
  const resource = useDiscordResource(discordQuery("team-discord-connection", { teamId }), revision, { keepPreviousData: true });
  const action = useDiscordAction();
  const status = resource.data;
  const connection = status?.connection;
  const connected = Boolean(connection?.guildId) && connection.status !== "disconnected";
  const commandChannelId = connection?.commandChannelId || "";
  const commandsReady = Boolean(commandChannelId && status?.channels?.some((channel) => channel.id === commandChannelId && channel.canSend));
  const commandChannelName = status?.channels?.find((channel) => channel.id === commandChannelId)?.name;
  const verified = connected && !resource.error && !status.connectionError && status.health?.verified !== false;
  const reload = useCallback(() => { setRoutesRefreshing(true); setRevision((value) => value + 1); }, []);
  const established = connected && (Boolean(connection.enabledAt) || !connection.paused);
  const [knownStatusLabel, knownStatusTone] = discordConnectionState(status, { loading: resource.loading, error: resource.error, routes: savedRoutes });
  const unavailableRoutes = verified && !routesRefreshing && savedRoutes.some((route) => !status.channels?.some((channel) => channel.id === route.channelId && channel.canSend));
  const [statusLabel, statusTone] = unavailableRoutes ? ["Salons à vérifier", "yellow"] : routesError && connected ? ["Publications à vérifier", "yellow"] : connected && routesRefreshing && verified && !connection.paused && status.enabled !== false
    ? ["Vérification des publications…", "slate"] : [knownStatusLabel, knownStatusTone];
  const command = link?.code ? `/nxt connecter code:${link.code}` : "";
  const currentDestinations = connected && routesSnapshot?.guildId === connection.guildId && String(routesSnapshot?.configVersion) === String(connection.configVersion);
  const routesReady = currentDestinations && savedRoutes.length > 0 && !routesDirty && !unavailableRoutes;
  const active = established && !connection.paused && status.enabled !== false && verified;
  const view = selectedView ?? (!canManage || established ? "overview" : !connected ? "connect" : commandsReady && routesReady ? "activate" : "salons");
  const activeStep = ["connect", "salons", "activate"].indexOf(view);
  const selectStep = (index, focus = false) => {
    if (focus) stepFocus.current = index;
    setSelectedView(["connect", "salons", "activate"][index]);
  };
  const openView = (next) => {
    if (next === "access") setAccessOpened(true);
    navFocus.current = next;
    setSelectedView(next);
  };

  useEffect(() => {
    if (stepFocus.current != null && activeStep >= 0) {
      stepTabs.current[stepFocus.current]?.focus();
      stepFocus.current = null;
    }
    if (navFocus.current) {
      navButtons.current[navFocus.current]?.focus();
      navFocus.current = null;
    }
  }, [selectedView, activeStep]);

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

  const progress = <InstallationProgress connected={connected} routesReady={commandsReady && routesReady} active={active && routesReady} selectedStep={activeStep} onSelect={selectStep} tabsRef={stepTabs} idPrefix={stepsId} />;
  const nextAction = !connected ? ["Connecter le serveur", 0]
    : !verified ? ["Vérifier la connexion", 0]
    : routesError || unavailableRoutes ? ["Vérifier les salons", 1]
    : !commandsReady ? ["Associer le salon des commandes", 1]
    : !routesReady ? ["Choisir un salon de publication", 1]
    : !established ? ["Tester et activer", 2]
    : connection.paused ? ["Reprendre les envois", 2] : ["Gérer les salons", 1];
  const ready = active && commandsReady && routesReady && !routesRefreshing;
  const automaticRoutes = savedRoutes.filter((route) => route.enabled);
  const commandDestination = commandsReady && verified ? `https://discord.com/channels/${encodeURIComponent(connection.guildId)}/${encodeURIComponent(commandChannelId)}` : null;
  const navigation = [
    ["overview", "Vue d’ensemble", LayoutDashboard],
    ...(canManage ? [["salons", "Salons", Hash], ["access", "Accès aux commandes", ShieldCheck]] : []),
    ["activity", "Activité", History], ["settings", "Aide et réglages", CircleHelp],
  ];
  return <Surface className="discord-panel discord-dashboard">
    <div className="discord-heading discord-dashboard-status">
      <div className="discord-team-identity"><span className="discord-team-icon"><MessageSquare size={23} aria-hidden="true" /></span><div><p className="discord-eyebrow">{t("Pour l’équipe")}</p><h3>{t("Le bot de ")}{teamName || t("ton équipe")}</h3><p className="discord-server">{t("Serveur : ")}<strong>{!status ? resource.loading ? t("vérification en cours") : t("état indisponible") : connected ? connection.guildName || connection.guildId : t("aucun serveur relié")}</strong></p></div></div>
      <Badge tone={resource.error ? "yellow" : verified ? "green" : connected ? "yellow" : "slate"}>{!status ? resource.loading ? t("Vérification…") : t("Vérification impossible") : !status.configured ? t("Service indisponible") : verified ? t("Serveur relié") : connected ? t("Connexion à vérifier") : t("À installer")}</Badge>
    </div>
    <DiscordFeedback loading={resource.loading && !status} error={resource.error || action.error || status?.connectionError} notice={action.notice} />
    {status?.configured === false && <p className="discord-feedback">{t("Le bot Discord n’est pas encore disponible. Un administrateur NXT5 doit terminer sa configuration.")}</p>}
    {status?.configured && status.enabled === false && <p className="discord-feedback">{t("Les envois Discord sont suspendus pour toutes les équipes par NXT5. Les réglages restent disponibles ; le test et l’activation attendent la reprise du service.")}</p>}
    {!canManage && <p className="discord-help">{t("Seuls le propriétaire et les capitaines peuvent configurer le bot pour cette équipe. Tu peux consulter son activité et partager les parties selon tes droits.")}</p>}
    {status?.configured && <>
      {(established || activeStep < 0) && <nav className="discord-team-nav" aria-label={t("Gestion du bot de l’équipe")}>{navigation.map(([id, label, Icon]) => <button type="button" key={id} ref={(node) => { navButtons.current[id] = node; }} aria-current={view === id || id === "salons" && activeStep >= 0 ? "page" : undefined} onClick={() => openView(id)}><Icon size={17} aria-hidden="true" /><span>{t(label)}</span></button>)}</nav>}
      {view === "overview" && <section className="discord-overview" aria-label={t("Aperçu du bot Discord")}>
        <div className={`discord-next-action${ready ? " is-ready" : ""}`}>
          <div><p className="discord-step-kicker">{ready ? t("Tout est en place") : t("La prochaine étape")}</p><h4>{ready ? t("Ton équipe peut utiliser le bot") : status.enabled === false ? t("Les publications sont suspendues") : routesError || unavailableRoutes ? t("Vérifie les salons de publication") : !verified && connected ? t("Vérifie la connexion au serveur") : canManage ? t(nextAction[0]) : connected ? t("Suivre les publications") : t("Serveur à connecter")}</h4><p>{!connected ? t("Le propriétaire ou un capitaine relie l’équipe à son serveur Discord.") : !verified ? t("La dernière vérification a échoué. Actualise Discord avant de poursuivre.") : routesError ? t("Les salons n’ont pas pu être actualisés. Ouvre-les pour réessayer ; les réglages connus sont conservés.") : unavailableRoutes ? t("Le bot ne peut plus publier dans un salon enregistré. Vérifie ses autorisations ou choisis un autre salon.") : !commandsReady ? t("Choisis le salon où les membres utiliseront les commandes de cette équipe.") : routesRefreshing ? t("Vérification des salons de publication enregistrés…") : !routesReady ? t("Choisis où le bot doit publier les résultats des parties.") : status.enabled === false ? t("Les publications reprendront lorsque NXT5 aura réactivé le service.") : connection.paused ? t("Les publications sont en pause. Les messages déjà envoyés restent dans Discord.") : t("Les commandes et les publications ont chacune leur destination ci-dessous.")}</p></div>
          {canManage && <Button type="button" icon={!verified && connected ? RefreshCw : ArrowRight} variant={ready ? "ghost" : "primary"} disabled={resource.loading || routesRefreshing && connected && !routesError} onClick={() => !verified && connected ? reload() : selectStep(nextAction[1], true)}>{t(nextAction[0])}</Button>}
        </div>
        <div className="discord-usage-grid">
          <section className="discord-usage"><div className="discord-usage-title"><Hash size={20} aria-hidden="true" /><h4>{t("Utiliser les commandes")}</h4></div><p>{t("Consulter les informations de ton équipe dans Discord.")}</p><dl><dt>{t("Salon de ton équipe")}</dt><dd>{!connected ? t("Serveur à connecter") : !verified ? t("Connexion à vérifier") : commandsReady ? `#${commandChannelName}` : t("Salon à choisir")}</dd></dl>{commandsReady && verified ? <><DiscordQuickCommand /><DiscordLink href={commandDestination}>{t("Ouvrir le salon")}</DiscordLink><p className="discord-help">{t("Chaque membre doit avoir lié son compte personnel.")}</p></> : <p className="discord-help">{t("Un salon réservé à cette équipe permet au bot de la reconnaître automatiquement.")}</p>}</section>
          <section className="discord-usage"><div className="discord-usage-title"><Send size={20} aria-hidden="true" /><h4>{t("Recevoir les parties")}</h4></div><p>{t("Partager les résultats et leur image récapitulative.")}</p><Badge tone={statusTone}>{t(statusLabel)}</Badge>{savedRoutes.length > 0 ? <ul className="discord-destination-list">{savedRoutes.map((route) => <li key={route.id || route.channelId}><strong>#{route.channelName || status?.channels?.find((channel) => channel.id === route.channelId)?.name || route.channelId}</strong><span>{route.enabled ? t("Automatique") : t("Manuel")}</span></li>)}</ul> : <p className="discord-help">{routesRefreshing && connected ? t("Chargement des salons…") : t("Aucun salon de publication enregistré.")}</p>}<p className="discord-help">{automaticRoutes.length ? t("Les nouvelles parties correspondant aux catégories choisies sont publiées automatiquement lorsque les envois sont actifs.") : t("Le partage manuel se lance depuis une partie dans NXT5.")}</p></section>
        </div>
        <p className="discord-help discord-team-scope">{t("Les réglages et les rôles de cette équipe ne changent pas ceux des autres équipes. La liaison de ton compte personnel se gère au-dessus.")}</p>
      </section>}
      <section hidden={activeStep < 0} className="discord-section discord-configuration" aria-label={t("Configuration du bot")}>
        <div className="discord-heading"><div><h4>{established ? t("Configuration de l’équipe") : t("Installer le bot")}</h4><p className="discord-help">{t("Pour le propriétaire ou un capitaine.")}</p></div>{established && <Button type="button" variant="ghost" onClick={() => openView("overview")}>{t("Retour à l’aperçu")}</Button>}</div>
        <div className="discord-install-layout">{progress}
        <div className="discord-step-panels">
          <section id={`${stepsId}-panel-0`} role="tabpanel" aria-labelledby={`${stepsId}-tab-0`} hidden={activeStep !== 0} tabIndex={0} className="discord-step-panel discord-setup-step">
            <h4>{t("Connecter le serveur")}</h4>
            {connected ? <><Badge tone={verified ? "cyan" : "yellow"}>{verified ? t("Équipe et serveur associés") : t("Connexion à vérifier")}</Badge><p><strong>{teamName || t("Ton équipe")}</strong>{t(" est reliée à ")}<strong>{connection.guildName || connection.guildId}</strong>.</p><DiscordPermissionUpdate installUrl={status.installUrl} guildId={connection.guildId} canManage={canManage} /><Button type="button" variant="primary" onClick={() => selectStep(1, true)}>{t("Choisir les salons")}</Button></> : <>
              <div className="discord-connect-task"><h5>{t("1. Ajouter NXT5 dans Discord")}</h5><p>{t("Invite NXT5 sur ton serveur Discord. Si le bot y est déjà présent, passe directement au code de liaison.")}</p>
              {canManage && <DiscordLink className={`discord-invite-button ${link || invitationOpened ? "nxt5-button-secondary" : "nxt5-button-primary"}`} href={status.installUrl || link?.installUrl} onClick={() => setInvitationOpened(true)}>{t("Ajouter à Discord")}</DiscordLink>}
              <p className="discord-help">{t("Un responsable du serveur valide l’autorisation Administrateur dans Discord. Elle donne tous les droits au bot, y compris dans les salons privés.")}</p>
              {invitationOpened && <p role="status" className="discord-help">{t("Invitation ouverte. Termine l’autorisation dans Discord, puis utilise le code ci-dessous.")}</p>}
              </div><div className="discord-connect-task"><h5>{t("2. Relier cette équipe au serveur")}</h5><p>{t("Crée un code propre à cette équipe et colle la commande dans le serveur où le bot est présent. Chaque équipe crée son propre code, même sur un serveur partagé.")}</p>
              {canManage && <Button type="button" variant={link && !linkExpired || !invitationOpened ? "ghost" : "primary"} icon={action.busy ? Loader2 : Link2} disabled={action.busy} onClick={() => { setCopyNotice(""); action.run("team-discord-connection", { teamId, action: "create-link" }, setLink); }}>{link ? t("Créer un nouveau code") : t("Créer le code de liaison")}</Button>}
              {link?.code && <div className="discord-link-code"><p>{t("Commande de liaison à usage unique")}</p><code>{command}</code><p className="discord-help">{linkExpired ? t("Ce code a expiré. Crée un nouveau code.") : t("Valable jusqu’au {0}. Un nouveau code remplace le précédent.", [new Date(link.expiresAt).toLocaleString(getLocale())])}</p><div className="discord-actions"><Button type="button" icon={Copy} variant="primary" disabled={linkExpired || action.busy} onClick={copyCommand}>{t("Copier la commande")}</Button><Button type="button" icon={RefreshCw} variant="ghost" disabled={action.busy || resource.loading} onClick={reload}>{t("Vérifier la connexion")}</Button></div>{copyNotice && <p role="status">{t(copyNotice)}</p>}<p className="discord-help" role="status">{watchingLink ? t("Vérification automatique de la liaison pendant deux minutes…") : t("Tu peux vérifier la connexion ici ou revenir sur cet onglet après la commande.")}</p></div>}
              </div><DiscordExample teamId={teamId} />
            </>}
          </section>
          <section id={`${stepsId}-panel-1`} role="tabpanel" aria-labelledby={`${stepsId}-tab-1`} hidden={activeStep !== 1} tabIndex={0} className="discord-step-panel">
            {connected ? <><DiscordCommandChannel key={`commands-${connection.guildId}`} teamId={teamId} teamName={teamName} metadata={status} canManage={canManage} loading={resource.loading} error={resource.error || status.connectionError} onSaved={reload} /><DiscordRoutes key={`routes-${connection.guildId}`} teamId={teamId} metadata={status} channelsLoading={resource.loading} channelsError={resource.error || status.connectionError || (status.health?.verified === false ? "La connexion au serveur Discord doit être vérifiée." : "")} canManage={canManage} revision={revision} onSaved={reload} onRoutes={setSavedRoutes} onSnapshot={setRoutesSnapshot} onDirty={setRoutesDirty} onRefreshing={setRoutesRefreshing} onError={setRoutesError} /><div className="discord-actions"><Button type="button" variant={routesReady ? "primary" : "ghost"} onClick={() => selectStep(2, true)}>{t("Passer au test et à l’activation")}</Button></div></> : <DiscordStepPrerequisite title={t("Choisir les salons")} onLink={() => selectStep(0, true)} />}
          </section>
          <section id={`${stepsId}-panel-2`} role="tabpanel" aria-labelledby={`${stepsId}-tab-2`} hidden={activeStep !== 2} tabIndex={0} className="discord-step-panel">
            {connected ? <DiscordActivation key={connection.guildId} {...{ teamId, teamName, canManage, status, savedRoutes, routesSnapshot, routesDirty, routesRefreshing, verified, revision, established }} connectionRefreshing={resource.loading} onChanged={reload} onActivated={() => setSelectedView(null)} onTestPassed={setTestPassed} /> : <DiscordStepPrerequisite title={t("Tester et activer")} onLink={() => selectStep(0, true)} />}
          </section>
        </div>
        </div>
        {!established && <div className="discord-overview-links discord-setup-links">{connected && canManage && <Button type="button" variant="ghost" onClick={() => openView("access")}>{t("Accès aux commandes")}</Button>}<Button type="button" variant="ghost" onClick={() => openView("activity")}>{t("Activité")}</Button><Button type="button" variant="ghost" onClick={() => openView("settings")}>{t("Aide et réglages")}</Button></div>}
      </section>
      {view === "access" && <div className="discord-section"><Button type="button" variant="ghost" onClick={() => openView("overview")}>{t("Retour à l’aperçu")}</Button></div>}
      {connected && accessOpened && <div hidden={view !== "access"} className="discord-secondary-panel"><DiscordRoleAccess key={connection.guildId} teamId={teamId} metadata={status} canManage={canManage} revision={revision} /></div>}
      {view === "activity" && <section className="discord-section"><Button type="button" variant="ghost" onClick={() => openView("overview")}>{t("Retour à l’aperçu")}</Button><DiscordHistory teamId={teamId} canPublish={canPublish || canManage} revision={revision} showSummary={connected} /></section>}
      {view === "settings" && <section className="discord-section discord-secondary-panel"><Button type="button" variant="ghost" onClick={() => openView("overview")}>{t("Retour à l’aperçu")}</Button><h4>{t("Aide et réglages")}</h4><details className="discord-guide"><summary>{t("Comment ça marche ?")}</summary><ConnectionHelp /></details><details className="discord-guide"><summary>{t("Résoudre un problème")}</summary><h4>{t("Le salon n’apparaît pas ou l’envoi échoue ?")}</h4><p>{t("Un responsable peut ouvrir « Mettre à jour les autorisations » dans Connecter le serveur ou Choisir les salons, puis valider l’autorisation Administrateur dans Discord. Reviens ensuite dans Choisir les salons et clique sur « Actualiser les salons ».")}</p><h4>{t("Que reçoivent les membres du salon ?")}</h4><p>{t("Le résultat, les statistiques et le visuel de la partie. Les notes privées de l’encadrement ne sont pas incluses. Le message et son image sont lisibles dans Discord ; ouvrir la partie dans NXT5 exige toujours les droits de l’équipe.")}</p><h4>{t("Un message est « à vérifier » ?")}</h4><p>{t("Consulte le salon avant toute action. L’historique permet d’associer le message déjà envoyé ; un envoi incertain n’est pas renvoyé automatiquement.")}</p></details>{status?.health?.checkedAt && <p className="discord-help">{t("Dernière vérification : ")}{new Date(status.health.checkedAt).toLocaleString(getLocale())}.</p>}{connected && canManage && !connection.paused && <div className="discord-actions"><Button type="button" variant="ghost" icon={Pause} disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "pause" }, reload, "La diffusion de l’équipe est en pause.")}>{t("Mettre en pause")}</Button><p className="discord-help">{t("La pause arrête les publications de cette équipe. Les messages déjà envoyés restent visibles.")}</p></div>}</section>}
    </>}
    <div className="discord-actions discord-section"><Button type="button" variant="ghost" icon={RefreshCw} disabled={resource.loading || action.busy} onClick={reload}>{t("Actualiser Discord")}</Button>{view === "settings" && connected && canManage && !confirmDisconnect && <Button type="button" icon={Unplug} variant="ghost" className="discord-danger-action" disabled={action.busy} onClick={() => setConfirmDisconnect(true)}>{t("Délier cette équipe")}</Button>}</div>
    {view === "settings" && confirmDisconnect && <div className="discord-confirm"><p>{t("Délier ")}<strong>{teamName || t("cette équipe")}</strong>{t(" de ")}<strong>{connection?.guildName || t("ce serveur")}</strong>{t(" arrête uniquement ses publications. Le bot reste sur le serveur et les autres équipes gardent leurs liaisons, leurs réglages et leurs envois. Les messages déjà publiés par cette équipe restent visibles et peuvent être retirés depuis son historique.")}</p><div className="discord-actions"><Button type="button" variant="danger" disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "disconnect" }, () => { setConfirmDisconnect(false); setSelectedView(null); setLink(null); setSavedRoutes([]); setTestPassed(false); reload(); }, "Cette équipe a été déliée du serveur. Les autres équipes restent connectées.")}>{t("Confirmer la déliaison")}</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmDisconnect(false)}>{t("Annuler")}</Button></div></div>}
  </Surface>;
}

function DiscordQuickCommand() {
  useLanguage();
  const [notice, setNotice] = useState("");
  return <div className="discord-quick-command"><p className="discord-help">{t("Pour voir la dernière partie :")}</p><div><code>/nxt voir sujet:derniere</code><Button type="button" variant="ghost" icon={Copy} aria-label={t("Copier la commande de dernière partie")} onClick={async () => {
    try { await navigator.clipboard.writeText("/nxt voir sujet:derniere"); setNotice("Commande copiée. Colle-la dans le salon de ton équipe."); }
    catch { setNotice("Sélectionne la commande affichée pour la copier."); }
  }}>{t("Copier")}</Button></div>{notice && <p className="discord-help" role="status">{t(notice)}</p>}</div>;
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
  useLanguage();
  const url = canManage ? discordPermissionsUrl(installUrl, guildId) : null;
  if (!url) return null;
  return <details className="discord-guide discord-permission-update"><summary>{t("Le bot ne voit pas un salon ?")}</summary><DiscordLink href={url}>{t("Mettre à jour les autorisations")}</DiscordLink><p className="discord-help">{t("Administrateur donne tous les droits au bot sur ce serveur. Un responsable doit valider cette autorisation dans Discord, puis revenir cliquer sur « Actualiser les salons ». Le bot reste installé et les liaisons des équipes sont conservées.")}</p></details>;
}

function InstallationProgress({ connected, routesReady, active, selectedStep, onSelect, tabsRef, idPrefix }) {
  useLanguage();
  const steps = [
    ["Connecter le serveur", connected, "Serveur", "Ajouter le bot et relier l’équipe"],
    ["Choisir les salons", routesReady, "Salons", "Choisir où utiliser et lire le bot"],
    ["Tester et activer", active, "Activation", "Vérifier un envoi avant de démarrer"],
  ];
  function onKeyDown(event, index) {
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % steps.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + steps.length - 1) % steps.length
      : event.key === "Home" ? 0 : event.key === "End" ? steps.length - 1 : null;
    if (next == null) return;
    event.preventDefault();
    onSelect(next, true);
  }
  return <div className="discord-install-progress" role="tablist" aria-label={t("Étapes de configuration Discord")}>{steps.map(([title, done, shortTitle, description], index) => <button type="button" key={title} ref={(node) => { tabsRef.current[index] = node; }} id={`${idPrefix}-tab-${index}`} role="tab" aria-label={t(title)} aria-selected={selectedStep === index} aria-controls={`${idPrefix}-panel-${index}`} tabIndex={selectedStep === index ? 0 : -1} className={`discord-step-tab${done ? " is-complete" : ""}${selectedStep === index ? " is-selected" : ""}`} onClick={() => onSelect(index)} onKeyDown={(event) => onKeyDown(event, index)}><span className="discord-progress-number" aria-hidden="true">{done ? <Check size={17} /> : index + 1}</span><span className="discord-step-label"><strong>{t(shortTitle)}</strong><span className="discord-step-description">{t(description)}</span><span className="sr-only">. {done ? t("Étape terminée.") : t("Étape à terminer.")}</span></span></button>)}</div>;
}

function DiscordStepPrerequisite({ title, onLink }) {
  useLanguage();
  return <div className="discord-setup-step"><h4>{t(title)}</h4><p>{t("Relie d’abord ton équipe à son serveur Discord. Ses salons seront ensuite disponibles pour préparer et tester la diffusion.")}</p><Button type="button" variant="primary" icon={Link2} onClick={onLink}>{t("Connecter le serveur")}</Button></div>;
}

function DiscordCommandChannel({ teamId, teamName, metadata, canManage, loading, error, onSaved }) {
  useLanguage();
  const connection = metadata.connection;
  const currentChannelId = connection?.commandChannelId || "";
  const channels = Array.isArray(metadata.channels) ? metadata.channels.filter((channel, index, all) => all.findIndex((item) => item.id === channel.id) === index) : [];
  const currentChannel = channels.find((channel) => channel.id === currentChannelId);
  const [selectedChannelId, setSelectedChannelId] = useState(currentChannelId);
  const [dirty, setDirty] = useState(false);
  const action = useDiscordAction();
  const titleId = useId();
  useEffect(() => {
    if (!dirty) setSelectedChannelId(currentChannelId);
  }, [currentChannelId, dirty]);
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId);
  const canSave = canManage && !loading && !error && !action.busy && metadata.health?.verified !== false && selectedChannel?.canSend === true && selectedChannelId !== currentChannelId;
  function save(event) {
    event.preventDefault();
    if (!canSave) return;
    action.run("team-discord-connection", {
      teamId, action: "command-channel", channelId: selectedChannelId,
      expectedGuildId: connection.guildId, expectedConfigVersion: connection.configVersion,
    }, () => { setDirty(false); onSaved(); }, "Salon des commandes enregistré.");
  }
  return <section className="discord-command-channel" aria-labelledby={titleId}>
    <p className="discord-task-label">{t("Usage 1 · Les commandes")}</p><div className="discord-heading"><h4 id={titleId}>{t("Où utiliser le bot ?")}</h4><Badge tone={currentChannelId && currentChannel?.canSend === true ? "cyan" : "yellow"}>{currentChannelId ? currentChannel?.canSend === true ? t("Associé") : t("À vérifier") : t("À choisir")}</Badge></div>
    <p>{currentChannelId ? currentChannel ? <>{t("Les commandes lancées dans ")}<strong>#{currentChannel.name}</strong>{t(" concernent automatiquement ")}<strong>{teamName || t("cette équipe")}</strong>.</> : loading ? t("Vérification du salon enregistré…") : t("Le salon enregistré n’est plus disponible. Choisis un autre salon.") : t("Choisis un salon réservé aux commandes de cette équipe. Les joueurs doivent avoir lié leur compte Discord à NXT5 et appartenir à cette équipe.")}</p>
    <p className="discord-help">{t("Un même salon ne peut pas servir aux commandes de plusieurs équipes. Les réponses destinées au salon sont visibles par ses membres ; les informations personnelles restent privées.")}</p>
    {canManage && <form className="discord-command-channel-form" onSubmit={save}>
      <SelectInput label={t("Salon des commandes de l’équipe")} value={selectedChannelId} onChange={(value) => { setSelectedChannelId(value); setDirty(value !== currentChannelId); }} disabled={loading || Boolean(error) || action.busy || !Array.isArray(metadata.channels)}>
        <option value="">{t("Choisir un salon")}</option>
        {currentChannelId && !currentChannel && <option value={currentChannelId} disabled>{t("Salon indisponible")}</option>}
        {channels.map((channel) => <option key={channel.id} value={channel.id} disabled={channel.canSend !== true}>#{channel.name}{channel.canSend !== true ? t(" · envoi impossible") : ""}</option>)}
      </SelectInput>
      <Button type="submit" variant={currentChannelId ? "ghost" : "primary"} icon={action.busy ? Loader2 : Check} disabled={!canSave}>{currentChannelId ? t("Changer le salon") : t("Associer ce salon")}</Button>
    </form>}
    {loading && <p className="discord-help" role="status">{t("Vérification des salons…")}</p>}
    {!loading && !error && !channels.some((channel) => channel.canSend === true) && <p className="discord-feedback">{t("Aucun salon disponible pour les commandes. Vérifie les autorisations du bot, puis actualise les salons.")}</p>}
    {dirty && selectedChannelId !== currentChannelId && <p className="discord-help" role="status">{t("Choix non enregistré.")}</p>}
    <DiscordFeedback error={error || action.error} notice={action.notice} />
  </section>;
}

function ConnectionHelp() {
  useLanguage();
  return <ol className="discord-steps"><li>{t("Dans « Connecter le serveur », invite NXT5 une seule fois avec « Ajouter à Discord » et valide l’autorisation Administrateur dans Discord. Si le bot est déjà présent, crée directement le code de liaison ; ses autorisations peuvent être mises à jour sans le retirer du serveur.")}</li><li>{t("Colle la commande ")}<code>/nxt connecter code:…</code>{t(" dans ce serveur avec un compte autorisé à le gérer. Chaque équipe utilise son propre code.")}</li><li>{t("Associe un salon aux commandes de cette équipe. Un joueur qui a lié son compte Discord et rejoint l’équipe NXT5 utilise ensuite les commandes dans ce salon, sans choisir d’équipe à chaque fois.")}</li><li>{t("Choisis séparément les salons de publication des parties. Les catégories et mentions sont facultatives.")}</li><li>{t("Envoie explicitement l’exemple fictif dans un salon, vérifie sa réception, puis active la diffusion. L’installation ne republie pas les anciennes parties.")}</li></ol>;
}

function DiscordExample({ teamId }) {
  useLanguage();
  const preview = useDiscordResource(discordQuery("team-discord-test", { teamId }));
  return <details className="discord-guide discord-section"><summary>{t("Voir un exemple de message et de visuel")}</summary><DiscordFeedback loading={preview.loading} error={preview.error} /><DiscordPreview preview={preview.data} fictitious /></details>;
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
  useLanguage();
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
    <p>{t("Envoie un exemple fictif pour vérifier le message et son image. Aucun joueur ni rôle n’est mentionné. Ce test reste possible lorsque ton équipe est en pause.")}</p>
    <DiscordFeedback error={resource.error || requestError} loading={resource.loading && !resource.data} />
    <details className="discord-guide discord-example"><summary>{t("Prévisualiser l’exemple fictif")}</summary><DiscordPreview preview={resource.data} fictitious /></details>
    {!!savedRoutes.length && <SelectInput label={t("Salon du message de test")} value={routeId} onChange={(value) => { setRouteId(value); setRequestError(""); }} disabled={!canManage || busy || routesDirty}>{savedRoutes.map((route) => <option key={route.id} value={route.id}>#{route.channelName || status.channels?.find((channel) => channel.id === route.channelId)?.name || route.channelId}</option>)}</SelectInput>}
    {routesDirty && <p className="discord-feedback">{t("Enregistre tes salons avant de tester ou d’activer la diffusion.")}</p>}
    {!savedRoutes.length && <p className="discord-help">{t("Enregistre au moins un salon pour choisir où envoyer le test.")}</p>}
    {latestTest && <div className="discord-test-receipt" role="status"><Badge tone={latestTest.status === "succeeded" ? "green" : latestTest.status === "failed" ? "red" : "yellow"}>{latestTest.status === "succeeded" ? t("Test reçu sur Discord") : latestTest.status === "failed" ? t("Test non envoyé") : t("Réception du test à vérifier")}</Badge><p>{latestTest.status === "succeeded" ? t("Le bot a confirmé la publication du message de test.") : latestTest.status === "failed" ? testFailureHelp(latestTest.errorCode) : t("Consulte le salon. La vérification recherche le message existant et ne le renvoie pas.")}</p>{!currentReceipt && <p className="discord-help">{t("Ce test concerne une ancienne configuration. Un nouveau test validera les salons actuels.")}</p>}<DiscordLink href={latestTest.messageUrl}>{t("Voir le message de test")}</DiscordLink></div>}
    {canManage && <div className="discord-actions"><Button type="button" variant={testPassed ? "ghost" : "primary"} icon={busy ? Loader2 : pending ? RefreshCw : MessageSquare} disabled={busy || action.busy || !serviceReady || routesDirty || (!pending && !testReady)} onClick={sendTest}>{busy ? t("Vérification du test…") : pending ? t("Vérifier ce même test") : latestTest ? t("Envoyer un nouveau test") : t("Envoyer le message de test")}</Button></div>}
    <p className="discord-help">{t("Ce bouton publie un message visible par les membres du salon sélectionné. L’aperçu seul n’envoie rien.")}</p>
  </>;
  return <section className="discord-section discord-activation" aria-label={t("Test et activation")}>
    {!snapshotsMatch && !routesRefreshing && !connectionRefreshing && <p className="discord-feedback">{t("La connexion et les salons ont changé pendant leur chargement. Actualise Discord avant l’activation.")}</p>}
    <span className="discord-step-kicker">{t("Étape 3")}</span><h4>{t("Tester et activer")}</h4><div className="discord-activation-task"><h5>{t("1. Vérifier la réception d’un exemple")}</h5>{testContent}</div>
    {connection.paused && canManage && <div className="discord-activation-task"><h5>2. {established ? t("Reprendre les publications") : t("Autoriser les publications")}</h5>
      {!established && !testPassed && <p className="discord-help">{t("La première activation sera disponible après la confirmation du test.")}</p>}
      {canActivate && !confirmActivation && <Button type="button" icon={Play} disabled={action.busy} onClick={() => setConfirmActivation(true)}>{established ? t("Reprendre les envois") : t("Activer la diffusion")}</Button>}
      {confirmActivation && <div className="discord-confirm" role="region" aria-label={t("Confirmer la diffusion")}><h4>{established ? t("Reprendre") : t("Activer")}{t(" pour ")}{teamName || t("ton équipe")}</h4><p>{t("Serveur : ")}<strong>{connection.guildName || connection.guildId}</strong>.</p><ul className="discord-steps">{savedRoutes.map((route) => <li key={route.id}><strong>#{route.channelName || status.channels?.find((channel) => channel.id === route.channelId)?.name || route.channelId}</strong> · {route.enabled ? t("nouvelles parties automatiques") : t("partages manuels")} · {route.categoryIds?.length ? route.categoryIds.map((id) => status.categories?.find((category) => category.id === id)?.name || t("Catégorie supprimée")).join(", ") : t("toutes les catégories")}{route.mentionRoleId ? t(" · mention @{0}", [status.roles?.find((role) => role.id === route.mentionRoleId)?.name || t("rôle configuré")]) : t(" · aucune mention")}</li>)}</ul><p>{t("Toute personne ayant accès à ces salons pourra lire les messages et leurs visuels. Les anciennes parties ne sont pas republiées automatiquement.")}</p>{!automaticRoutes.length && <p>{t("Les salons sont réglés sur le partage manuel. Aucune nouvelle partie ne sera envoyée automatiquement.")}</p>}<div className="discord-actions"><Button type="button" icon={action.busy ? Loader2 : Play} disabled={!canActivate || action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "resume", expectedConfigVersion: routesSnapshot.configVersion, expectedGuildId: routesSnapshot.guildId }, () => { setConfirmActivation(false); onChanged(); onActivated(); }, "La diffusion de l’équipe a repris.")}>{t("Confirmer l’activation")}</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmActivation(false)}>{t("Annuler l’activation")}</Button></div></div>}
    </div>}
    <DiscordFeedback error={action.error} notice={action.notice} />
  </section>;
}
function DiscordRoutes({ teamId, metadata, channelsLoading, channelsError, canManage, onSaved, revision, onRoutes, onSnapshot, onDirty, onRefreshing, onError }) {
  useLanguage();
  const resource = useDiscordResource(discordQuery("team-discord-routes", { teamId }), revision, { keepPreviousData: true });
  useEffect(() => { onRefreshing(resource.loading || Boolean(resource.error)); onError(resource.error); }, [resource.loading, resource.error, onRefreshing, onError]);
  useEffect(() => { if (resource.data) { onRoutes(resource.data.routes || []); onSnapshot(resource.data); } }, [resource.data, onRoutes, onSnapshot]);
  if (!resource.data) return <section className="discord-section"><h4>{t("Salons de publication")}</h4><DiscordFeedback loading={resource.loading} error={resource.error} /><p className="discord-help">{t("Chargement des salons enregistrés…")}</p><Button type="button" variant="ghost" icon={RefreshCw} disabled={resource.loading || channelsLoading} onClick={onSaved}>{t("Actualiser les salons")}</Button></section>;
  return <><DiscordFeedback error={resource.error} /><DiscordRoutesEditor {...{ teamId, metadata, channelsLoading, channelsError, canManage, onSaved, onDirty }} routesLoading={resource.loading} routesError={resource.error} initialRoutes={resource.data.routes || []} /></>;
}

function DiscordRoutesEditor({ teamId, metadata, channelsLoading, channelsError, routesLoading, routesError, canManage, onSaved, onDirty, initialRoutes }) {
  useLanguage();
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
    <span className="discord-task-label">{t("Usage 2 · Les publications")}</span><h4>{t("Où recevoir les résultats ?")}</h4>
    <p>{t("Choisis les salons qui recevront les parties et leur image récapitulative. Tu peux reprendre le salon des commandes ou en choisir un autre.")}</p>
    <p className="discord-help">{t("Toute personne ayant accès au salon pourra lire le message et son visuel, même sans compte NXT5. Les liens vers les parties conservent les droits d’accès NXT5.")}</p>
    <section className="discord-channel-selection" aria-label={t("Salons disponibles sur le serveur")}>
      <div className="discord-channel-picker">
        {canManage && <SelectInput label={t("Choisir un salon du serveur")} value={selectedChannelId} onChange={setSelectedChannelId} disabled={refreshing || action.busy || !channelsReady || routes.length >= 10}>
          <option value="">{t("Sélectionner un salon")}</option>
          {selectedChannelId && !channels.some((channel) => channel.id === selectedChannelId) && <option value={selectedChannelId} disabled>{t("Salon indisponible")}</option>}
          {channels.map((channel) => { const added = routes.some((route) => route.channelId === channel.id); return <option key={channel.id} value={channel.id} disabled={channel.canSend !== true || added}>#{channel.name}{channel.canSend !== true ? t(" · autorisation manquante") : ""}{added ? t(" · déjà ajouté") : ""}</option>; })}
        </SelectInput>}
        <div className="discord-actions">{canManage && <Button type="button" variant={routes.length || dirty ? "ghost" : "primary"} icon={Plus} disabled={!canAdd} onClick={addChannel}>{t("Ajouter ce salon")}</Button>}<Button type="button" variant="ghost" icon={refreshing ? Loader2 : RefreshCw} disabled={refreshing || action.busy} onClick={onSaved}>{t("Actualiser les salons")}</Button></div>
      </div>
      <DiscordPermissionUpdate installUrl={metadata.installUrl} guildId={metadata.connection?.guildId} canManage={canManage} />
      {refreshing && <p role="status" className="discord-loading"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />{t("Actualisation des salons du serveur…")}</p>}
      <DiscordFeedback error={channelError} />
      {channelsReady && !channels.length && <p className="discord-feedback">{t("Aucun salon disponible sur ce serveur. Vérifie les droits du bot dans Discord, puis actualise les salons.")}</p>}
      {channelsReady && channels.length > 0 && !channels.some((channel) => channel.canSend === true) && <p className="discord-feedback">{t("Aucun salon ne permet l’envoi. Autorise le bot à voir le salon, envoyer des messages et images, intégrer des liens et lire l’historique, puis actualise les salons.")}</p>}
      {canManage && routes.length >= 10 ? <p className="discord-help">{t("Limite atteinte : dix salons par équipe. Supprime un salon pour en ajouter un autre.")}</p> : canManage && channelsReady && channels.some((channel) => channel.canSend === true) && !availableChannels.length && <p className="discord-help">{t("Tous les salons utilisables sont déjà ajoutés.")}</p>}
      {canManage && <p className="discord-help">{t("Choisis un salon, ajoute-le, puis enregistre tes salons. Aucun message n’est envoyé à cette étape.")}</p>}
    </section>
    {!routes.length && <p>{canManage ? t("{0} Choisis un salon ci-dessus pour préparer la diffusion.", [dirty ? t("Aucun salon dans le brouillon.") : t("Aucun salon enregistré.")]) : t("Aucun salon n’est configuré pour cette équipe.")}</p>}
    <div className="discord-routes">{routes.map((route, index) => {
      const channel = channels.find((item) => item.id === route.channelId);
      const channelName = channel?.name || route.channelName || "Salon indisponible";
      const mentionName = roles.find((role) => role.id === route.mentionRoleId)?.name || "rôle indisponible";
      return <fieldset key={route.id || `new-${index}`} className="discord-route" disabled={!canManage || action.busy}>
        <legend>#{channelName} <span className="discord-route-mode">{route.enabled ? t("Automatique") : t("Manuel")}</span></legend>
        <label className="discord-check"><input type="checkbox" checked={route.enabled} onChange={(event) => patch(index, { enabled: event.target.checked })} />{t("Publier automatiquement les nouvelles parties")}</label>
        <p className="discord-help">{route.categoryIds.length ? t("{0} catégorie{1}", [route.categoryIds.length, route.categoryIds.length > 1 ? "s" : ""]) : t("Toutes les catégories")}{route.mentionRoleId ? t(" · Mention @{0}", [mentionName]) : ""}{route.includeHints ? t(" · Piste de débrief") : ""}</p>
        <details className="discord-guide">
          <summary>{t("Options du salon ")}<span className="sr-only">#{channelName}</span></summary>
          <div className="discord-form-grid"><SelectInput label={t("Salon Discord · destination {0}", [index + 1])} value={route.channelId} onChange={(value) => patch(index, { channelId: value, mentionRoleId: "" })} required><option value="">{t("Choisir un salon")}</option>{route.channelId && !channels.some((item) => item.id === route.channelId) && <option value={route.channelId} disabled>{t("Salon indisponible")}</option>}{channels.map((item) => <option key={item.id} value={item.id} disabled={item.canSend === false || routes.some((other, i) => i !== index && other.channelId === item.id)}>#{item.name}{item.canSend === false ? t(" · autorisation manquante") : ""}</option>)}</SelectInput>
            <SelectInput label={t("Mention · destination {0}", [index + 1])} value={route.mentionRoleId} onChange={(value) => patch(index, { mentionRoleId: value })}><option value="">{t("Aucune mention")}</option>{route.mentionRoleId && !roles.some((role) => role.id === route.mentionRoleId) && <option value={route.mentionRoleId} disabled>{t("Rôle indisponible")}</option>}{roles.map((role) => <option key={role.id} value={role.id} disabled={role.mentionable === false && !channel?.canMentionRoles}>@{role.name}</option>)}</SelectInput></div>
          <fieldset className="discord-categories"><legend>{t("Catégorie · destination ")}{index + 1}</legend><label className="discord-check"><input type="checkbox" checked={!route.categoryIds.length} onChange={(event) => patch(index, { categoryIds: event.target.checked ? [] : categories[0] ? [categories[0].id] : [] })} />{t("Toutes les catégories, y compris les parties non classées")}</label>{categories.map((category) => <label key={category.id} className="discord-check"><input type="checkbox" checked={route.categoryIds.includes(category.id)} onChange={(event) => patch(index, { categoryIds: event.target.checked ? [...route.categoryIds, category.id] : route.categoryIds.filter((id) => id !== category.id) })} />{category.name}</label>)}</fieldset>
          <label className="discord-check"><input type="checkbox" checked={route.includeHints} onChange={(event) => patch(index, { includeHints: event.target.checked })} />{t("Ajouter une piste de débrief au message")}</label>
          <p className="discord-help">{t("Les corrections actualisent la publication existante. Les notes privées de l’encadrement ne sont pas incluses.")}</p>
          {canManage && <Button type="button" variant="ghost" className="discord-danger-action" icon={X} onClick={() => { setRoutes((current) => current.filter((_, i) => index !== i)); setDirty(true); }}>{t("Supprimer cette destination")}</Button>}
        </details>
      </fieldset>;
    })}</div>
    <DiscordFeedback error={action.error} notice={action.notice} />
    {canManage && <div className="discord-actions discord-save-actions"><Button type="submit" variant={dirty ? "primary" : "ghost"} icon={action.busy ? Loader2 : Check} disabled={action.busy || !dirty || !canSave}>{t("Enregistrer les salons")}</Button>{dirty && <p className="discord-help" role="status">{t("Modifications non enregistrées.")}</p>}</div>}
  </form>;
}

export function DiscordAdminStatus() {
  useLanguage();
  const [revision, setRevision] = useState(0);
  const resource = useDiscordResource("admin-discord", revision);
  const status = resource.data;
  return <Surface className="discord-panel"><div className="discord-heading"><h3><MessageSquare aria-hidden="true" className="h-5 w-5" />{t("Discord")}</h3><Badge tone={status?.enabled && status?.configured ? "cyan" : "slate"}>{resource.loading ? t("Chargement") : !status?.configured ? t("À configurer") : status.enabled ? t("En service") : t("Envois suspendus")}</Badge></div><p>{t("Les destinations et les autorisations de publication se règlent dans la gestion de chaque équipe.")}</p><DiscordFeedback error={resource.error} loading={resource.loading} />{status && <><dl className="discord-health">{[["Équipes connectées", status.connectionsCount], ["En attente", status.queuedCount], ["En échec", status.failedCount], ["Envois à vérifier", status.unknownCount]].map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value ?? "—"}</dd></div>)}</dl>{status.oldestPendingAt && <p className="discord-help">{t("Plus ancienne publication en attente : ")}{new Date(status.oldestPendingAt).toLocaleString(getLocale())}.</p>}{!!status.issues?.length && <ul className="discord-steps">{status.issues.map((issue) => <li key={issue}>{t(issue)}</li>)}</ul>}<p className="discord-help">{t("La configuration du bot et la suspension globale des envois se gèrent sur le serveur NXT5.")}</p></>}<Button type="button" icon={RefreshCw} variant="ghost" disabled={resource.loading} onClick={() => setRevision((value) => value + 1)}>{t("Actualiser Discord")}</Button></Surface>;
}
