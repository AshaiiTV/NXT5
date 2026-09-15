import React, { useEffect, useRef, useState } from "react";
import { Eye, Loader2, MessageSquare, RefreshCw, Send, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Button, SelectInput } from "../ui/Core.jsx";
import { DiscordFeedback, DiscordHistory, DiscordPreview, discordQuery, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";

export default function DiscordGameShare({ teamId, matchId, matchName, matchRevision = "", canPublish = false }) {
  if (!teamId || !matchId || !canPublish) return null;
  return <DiscordGameShareContent key={`${teamId}:${matchId}:${matchRevision}`} {...{ teamId, matchId, matchName }} />;
}

function DiscordGameShareContent({ teamId, matchId, matchName }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <section className="discord-share" aria-label="Partager cette game sur Discord">
    <div className="discord-actions"><button ref={trigger} type="button" className="nxt5-cyber-button nxt5-control discord-share-trigger" aria-expanded={open} aria-controls={`discord-share-${matchId}`} onClick={() => setOpen((value) => !value)}><MessageSquare aria-hidden="true" className="h-4 w-4" />Partager sur Discord</button></div>
    {open && <div id={`discord-share-${matchId}`} className="discord-share-content"><DiscordGameShareForm {...{ teamId, matchId, matchName }} onClose={close} /></div>}
  </section>;
}

function DiscordGameShareForm({ teamId, matchId, matchName, onClose }) {
  const [revision, setRevision] = useState(0);
  const [routeId, setRouteId] = useState("");
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewRequest = useRef(null);
  const connection = useDiscordResource(discordQuery("team-discord-connection", { teamId }), revision);
  const connected = Boolean(connection.data?.connection?.guildId) && connection.data.connection.status !== "disconnected";
  const routes = useDiscordResource(connected ? discordQuery("team-discord-routes", { teamId }) : null, revision);
  const action = useDiscordAction();
  useEffect(() => () => previewRequest.current?.abort(), []);
  const destinations = routes.data?.routes || [];
  const selectedRoute = destinations.find((route) => route.id === routeId);
  const channel = connection.data?.channels?.find((item) => item.id === selectedRoute?.channelId);
  const ready = connection.data?.configured && connection.data?.enabled !== false && connected && !connection.data.connection.paused && (!connection.data.connection.status || connection.data.connection.status === "active");
  const validDestination = selectedRoute && channel && channel.canSend !== false;
  const validPreviewRevision = Number.isSafeInteger(preview?.snapshotRevision) && preview.snapshotRevision >= 0;
  const busy = preparing || action.busy;
  function selectRoute(value) { previewRequest.current?.abort(); setPreparing(false); setRouteId(value); setPreview(null); setPreviewError(""); action.clear(); }
  async function prepare() {
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
    if (!validPreviewRevision) return;
    action.run("team-discord-publish", { teamId, matchId, routeId, snapshotRevision: preview.snapshotRevision }, () => { setPreview(null); setRevision((value) => value + 1); }, "Publication ajoutée à la file d’envoi. Son état apparaît dans l’historique.");
  }
  return <>
    <div className="discord-heading"><h4>{matchName || "Game sélectionnée"}</h4><Button type="button" variant="ghost" icon={X} disabled={busy} onClick={onClose}>Fermer</Button></div>
    <DiscordFeedback loading={connection.loading || routes.loading} error={connection.error || routes.error || previewError || action.error || connection.data?.connectionError} notice={action.notice} />
    {connection.data?.configured === false && <p>Le bot Discord n’est pas encore disponible.</p>}
    {connection.data?.configured && !connected && <p>Connecte le serveur Discord depuis la gestion de l’équipe.</p>}
    {connection.data?.enabled === false && <p>Les envois Discord sont suspendus pour toutes les équipes.</p>}
    {connection.data?.connection?.paused && <p>Les envois de l’équipe sont en pause. Le propriétaire ou un capitaine peut les reprendre depuis la gestion de l’équipe.</p>}
    {!connection.loading && !routes.loading && connected && <>
      {destinations.length ? <><SelectInput label="Destination Discord" value={routeId} onChange={selectRoute} disabled={busy}><option value="">Choisir un salon</option>{destinations.map((route) => { const destination = connection.data?.channels?.find((item) => item.id === route.channelId); return <option key={route.id} value={route.id} disabled={!destination || destination.canSend === false}>{destination ? `#${destination.name}` : "Salon indisponible"}{route.enabled === false ? " · publication manuelle" : ""}</option>; })}</SelectInput><p className="discord-help">Le message et son visuel seront visibles par les membres du salon. Une publication existante pour cette game sera actualisée.</p><Button type="button" variant="ghost" icon={preparing ? Loader2 : Eye} disabled={busy || !validDestination} onClick={prepare}>{preparing ? "Préparation du visuel…" : "Préparer l’aperçu"}</Button></> : <p>Aucune destination configurée. Ajoute un salon depuis la gestion de l’équipe.</p>}
      {preview && <><DiscordPreview preview={preview} />{!validPreviewRevision && <p role="alert">Cet aperçu ne peut pas être publié. Actualise-le pour charger la version des données.</p>}<div className="discord-actions"><Button type="button" icon={action.busy ? Loader2 : Send} disabled={busy || !ready || !validDestination || !validPreviewRevision} onClick={publish}>Publier dans #{channel?.name || "le salon"}</Button><Button type="button" variant="ghost" icon={RefreshCw} disabled={busy} onClick={prepare}>Actualiser l’aperçu</Button></div></>}
    </>}
    {connection.data?.configured && <DiscordHistory teamId={teamId} matchId={matchId} canPublish revision={revision} />}
    {(connection.error || routes.error) && <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy} onClick={() => setRevision((value) => value + 1)}>Réessayer</Button>}
  </>;
}
