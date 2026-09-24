import React, { useEffect, useRef, useState } from "react";
import { Eye, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { GameOperationDialog } from "../games/GameOperationDialog.jsx";
import { Button, SelectInput } from "../ui/Core.jsx";
import { DiscordFeedback, DiscordHistory, DiscordPreview, discordQuery, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";

export default function DiscordGameShare({ teamId, matchId, matchName, matchRevision = "", canPublish = false }) {
  if (!teamId || !matchId || !canPublish) return null;
  return <DiscordGameShareContent key={`${teamId}:${matchId}:${matchRevision}`} {...{ teamId, matchId, matchName }} />;
}

function matchingConfiguration(connection, routes) {
  if (!connection || !routes) return false;
  if (routes.guildId != null && routes.guildId !== connection.guildId) return false;
  return routes.configVersion == null || connection.configVersion == null || String(routes.configVersion) === String(connection.configVersion);
}

function DiscordGameShareContent({ teamId, matchId, matchName }) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const trigger = useRef(null);
  const connection = useDiscordResource(discordQuery("team-discord-connection", { teamId }), revision, { keepPreviousData: true });
  const connected = Boolean(connection.data?.connection?.guildId) && connection.data.connection.status !== "disconnected";
  const routes = useDiscordResource(connected ? discordQuery("team-discord-routes", { teamId }) : null, revision, { keepPreviousData: true });
  const coherent = matchingConfiguration(connection.data?.connection, routes.data);
  return <>
    <span ref={trigger} className="discord-share-action"><Button type="button" variant="ghost" icon={MessageSquare} aria-haspopup="dialog" aria-expanded={open} disabled={open} onClick={() => setOpen(true)}>Exporter sur Discord</Button></span>
    {open && <DiscordGameShareForm {...{ teamId, matchId, matchName, connection, routes, connected, coherent, revision }} onReload={() => setRevision((value) => value + 1)} onClose={() => setOpen(false)} returnFocusRef={trigger} />}
  </>;
}

function DiscordGameShareForm({ teamId, matchId, matchName, connection, routes, connected, coherent, revision, onReload, onClose, returnFocusRef }) {
  const [chosenRouteId, setRouteId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewRequest = useRef(null);
  const action = useDiscordAction();
  const destinations = Array.isArray(routes.data?.routes) ? routes.data.routes : [];
  const availableDestinations = destinations.filter((route) => connection.data?.channels?.some((channel) => channel.id === route.channelId && channel.canSend !== false));
  const routeId = chosenRouteId ?? (coherent && availableDestinations.length === 1 ? availableDestinations[0].id : "");
  const selectedRoute = destinations.find((route) => route.id === routeId);
  const channel = connection.data?.channels?.find((item) => item.id === selectedRoute?.channelId);
  const refreshing = connection.loading || routes.loading;
  const metadataError = connection.error || routes.error || connection.data?.connectionError;
  const validMetadata = !refreshing && !metadataError && coherent && connected && connection.data?.health?.verified !== false;
  const ready = validMetadata && connection.data?.configured && connection.data?.enabled !== false && !connection.data.connection.paused && (!connection.data.connection.status || connection.data.connection.status === "active");
  const validDestination = validMetadata && selectedRoute && channel && channel.canSend !== false;
  const validPreviewRevision = Number.isSafeInteger(preview?.snapshotRevision) && preview.snapshotRevision >= 0;
  const busy = preparing || action.busy;
  const previewContext = JSON.stringify([connection.data?.connection?.guildId, connection.data?.connection?.configVersion, routes.data?.guildId, routes.data?.configVersion, selectedRoute]);
  useEffect(() => {
    previewRequest.current?.abort();
    setPreparing(false); setPreview(null); setPreviewError("");
    return () => previewRequest.current?.abort();
  }, [previewContext]);
  function selectRoute(value) { previewRequest.current?.abort(); setPreparing(false); setRouteId(value); setPreview(null); setPreviewError(""); action.clear(); }
  async function prepare() {
    if (busy || !validDestination) return;
    previewRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    setPreparing(true); setPreview(null); setPreviewError(""); action.clear();
    try {
      const result = await apiFetch(discordQuery("team-discord-preview", { teamId, matchId, routeId }), { signal: controller.signal, timeoutMs: 60000 });
      if (!controller.signal.aborted) setPreview(result);
    } catch (error) { if (!controller.signal.aborted) setPreviewError(error.message); }
    finally { if (!controller.signal.aborted) setPreparing(false); }
  }
  function publish() {
    if (busy || !ready || !validDestination || !validPreviewRevision) return;
    action.run("team-discord-publish", { teamId, matchId, routeId, snapshotRevision: preview.snapshotRevision }, () => { setPreview(null); onReload(); }, "Publication ajoutée à la file d’envoi. Son état apparaît dans l’historique.");
  }
  return <GameOperationDialog title="Exporter sur Discord" description={matchName || "Partie sélectionnée"} onClose={onClose} busy={busy} returnFocusRef={returnFocusRef}>
    <div className="discord-share discord-share-content">
      <DiscordFeedback loading={refreshing} error={metadataError || previewError || action.error} notice={action.notice} />
      {connection.data?.configured === false && <p>Le bot Discord n’est pas encore disponible.</p>}
      {connection.data?.configured && !connected && !connection.loading && !metadataError && <p>Relie le bot au serveur Discord de cette équipe pour y envoyer tes parties. <a className="discord-link" href="/bot-discord">Configurer Bot Discord</a></p>}
      {connection.data?.enabled === false && <p>Les envois Discord sont suspendus pour toutes les équipes. <a className="discord-link" href="/bot-discord">Ouvrir Bot Discord</a></p>}
      {connection.data?.connection?.paused && <p>Les envois de l’équipe sont en pause. Le propriétaire ou un capitaine peut les reprendre dans <a className="discord-link" href="/bot-discord">Bot Discord</a>.</p>}
      {!refreshing && connected && !coherent && <p role="alert">Les réglages Discord ont changé. Actualise les salons avant de préparer une publication.</p>}
      {connection.data?.health?.verified === false && !metadataError && <p role="alert">La connexion Discord doit être vérifiée dans <a className="discord-link" href="/bot-discord">Bot Discord</a>.</p>}
      {destinations.some((route) => !connection.data?.channels?.some((item) => item.id === route.channelId && item.canSend !== false)) && <p>Les salons sans autorisation d’envoi sont désactivés. Un responsable peut vérifier les droits du bot dans <a className="discord-link" href="/bot-discord">Bot Discord</a>, puis actualiser les salons.</p>}
      {connected && <>
        {destinations.length ? <><SelectInput label="Destination Discord" value={routeId} onChange={selectRoute} disabled={busy || !validMetadata}><option value="">Choisir un salon</option>{destinations.map((route) => { const destination = connection.data?.channels?.find((item) => item.id === route.channelId); return <option key={route.id} value={route.id} disabled={!destination || destination.canSend === false}>{destination ? `#${destination.name}` : "Salon indisponible"}{route.enabled === false ? " · publication manuelle" : ""}</option>; })}</SelectInput><p className="discord-help">Le message et son visuel seront visibles par les membres du salon. Une publication existante pour cette game sera actualisée.</p><Button type="button" variant="ghost" icon={preparing ? Loader2 : Eye} disabled={busy || !validDestination} onClick={prepare}>{preparing ? "Préparation du visuel…" : "Préparer l’aperçu"}</Button></> : !refreshing && <p>Aucune destination configurée. Ajoute un salon dans <a className="discord-link" href="/bot-discord">Bot Discord</a>.</p>}
        {preview && <><DiscordPreview preview={preview} />{!validPreviewRevision && <p role="alert">Cet aperçu ne peut pas être publié. Actualise-le pour charger la version des données.</p>}<div className="discord-actions"><Button type="button" icon={action.busy ? Loader2 : Send} disabled={busy || !ready || !validDestination || !validPreviewRevision} onClick={publish}>Publier dans #{channel?.name || "le salon"}</Button><Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || !validDestination} onClick={prepare}>Actualiser l’aperçu</Button></div></>}
      </>}
      <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || refreshing} onClick={onReload}>{metadataError ? "Réessayer" : "Actualiser les salons"}</Button>
      {connection.data?.configured && <DiscordHistory teamId={teamId} matchId={matchId} canPublish revision={revision} />}
    </div>
  </GameOperationDialog>;
}
