import React, { useEffect, useRef, useState } from "react";
import { Eye, Link2, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { GameOperationDialog } from "../games/GameOperationDialog.jsx";
import { Button, SelectInput, TextInput } from "../ui/Core.jsx";
import { DiscordFeedback, DiscordLink, DiscordPreview, DiscordStatus, discordQuery, matchingDiscordConfiguration, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";

export default function DiscordGroupShare({ teamId, archiveId, archiveName, archiveRevision = "", canPublish = false }) {
  if (!teamId || !archiveId || !canPublish) return null;
  return <DiscordGroupShareContent key={`${teamId}:${archiveId}:${archiveRevision}`} {...{ teamId, archiveId, archiveName }} />;
}

function DiscordGroupShareContent({ teamId, archiveId, archiveName }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  return <>
    <span ref={trigger} className="discord-share-action"><Button type="button" variant="ghost" icon={MessageSquare} aria-haspopup="dialog" aria-expanded={open} disabled={open} onClick={() => setOpen(true)}>Exporter sur Discord</Button></span>
    {open && <DiscordGroupShareForm {...{ teamId, archiveId, archiveName }} onClose={() => setOpen(false)} returnFocusRef={trigger} />}
  </>;
}

function DiscordGroupShareForm({ teamId, archiveId, archiveName, onClose, returnFocusRef }) {
  const [revision, setRevision] = useState(0);
  const [chosenRouteId, setChosenRouteId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [resolution, setResolution] = useState(null);
  const previewRequest = useRef(null);
  const action = useDiscordAction();
  const connection = useDiscordResource(discordQuery("team-discord-connection", { teamId }), revision, { keepPreviousData: true });
  const connected = Boolean(connection.data?.connection?.guildId) && connection.data.connection.status !== "disconnected";
  const routes = useDiscordResource(connected ? discordQuery("team-discord-routes", { teamId }) : null, revision, { keepPreviousData: true });
  const history = useDiscordResource(connection.data?.configured ? discordQuery("team-discord-group-deliveries", { teamId, archiveId }) : null, revision);
  const destinations = Array.isArray(routes.data?.routes) ? routes.data.routes : [];
  const coherent = matchingDiscordConfiguration(connection.data?.connection, routes.data);
  const available = destinations.filter((route) => connection.data?.channels?.some((channel) => channel.id === route.channelId && channel.canSend !== false));
  const routeId = chosenRouteId ?? (coherent && available.length === 1 ? available[0].id : "");
  const selectedRoute = destinations.find((route) => route.id === routeId);
  const channel = connection.data?.channels?.find((item) => item.id === selectedRoute?.channelId);
  const refreshing = connection.loading || routes.loading;
  const metadataError = connection.error || routes.error || connection.data?.connectionError;
  const validMetadata = !refreshing && !metadataError && connected && coherent && connection.data?.health?.verified !== false;
  const validDestination = validMetadata && selectedRoute && channel && channel.canSend !== false;
  const ready = validDestination && connection.data?.configured && connection.data?.enabled !== false && !connection.data.connection.paused && connection.data.connection.status === "active";
  const busy = preparing || action.busy;
  const awaitingVerification = ["pending", "sending", "uncertain"].includes(receipt?.status);
  const previewContext = JSON.stringify([connection.data?.connection?.guildId, connection.data?.connection?.configVersion, routes.data?.guildId, routes.data?.configVersion, selectedRoute]);
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    previewRequest.current?.abort();
    setPreparing(false); setPreview(null); setPreviewError("");
    return () => previewRequest.current?.abort();
  }, [previewContext]);

  function selectRoute(value) {
    if (busy || awaitingVerification) return;
    previewRequest.current?.abort();
    setChosenRouteId(value); setPreview(null); setPreviewError(""); setReceipt(null); setResolution(null); action.clear();
  }
  async function prepare() {
    if (busy || awaitingVerification || !validDestination) return;
    const controller = new AbortController();
    previewRequest.current?.abort(); previewRequest.current = controller;
    setPreparing(true); setPreview(null); setPreviewError(""); setReceipt(null); setResolution(null); action.clear();
    try {
      const result = await apiFetch(discordQuery("team-discord-group-preview", { teamId, archiveId, routeId }), { signal: controller.signal, timeoutMs: 60000 });
      if (!controller.signal.aborted) setPreview({ ...result, requestId: crypto.randomUUID() });
    } catch (error) { if (!controller.signal.aborted) setPreviewError(error.message); }
    finally { if (!controller.signal.aborted) setPreparing(false); }
  }
  function receive(result) {
    if (result?.publication) { setReceipt(result.publication); setPreview(null); }
    if (result?.publication?.status === "succeeded") setResolution(null);
    reload();
  }
  function publish() {
    if (busy || awaitingVerification || !ready || !preview?.previewToken || !preview.requestId) return;
    // Retain this identity after a lost response. Verification never resends it.
    setReceipt({ requestId: preview.requestId, status: "pending" });
    action.run("team-discord-group-publish", { teamId, archiveId, routeId, requestId: preview.requestId, previewToken: preview.previewToken }, receive);
  }
  function verify(requestId, messageId) {
    if (busy || !requestId) return;
    action.run("team-discord-group-publish", { teamId, archiveId, requestId, action: "verify", ...(messageId ? { messageId } : {}) }, receive);
  }
  return <GameOperationDialog title="Exporter le groupe sur Discord" description={archiveName || "Groupe sélectionné"} onClose={onClose} busy={busy} returnFocusRef={returnFocusRef}>
    <div className="discord-share discord-share-content">
      <p>Le bot envoie un seul bilan du groupe avec son visuel dans le salon de l’équipe. Toutes les parties du groupe sont prises en compte.</p>
      <DiscordFeedback loading={refreshing} error={metadataError || previewError || action.error} />
      {connection.data?.configured === false && <p>Le bot Discord n’est pas encore disponible.</p>}
      {connection.data?.configured && !connected && !connection.loading && !metadataError && <p>Relie le bot au serveur Discord de cette équipe. <a className="discord-link" href="/bot-discord">Configurer Bot Discord</a></p>}
      {connection.data?.enabled === false && <p>Les envois Discord sont suspendus pour toutes les équipes.</p>}
      {connection.data?.connection?.paused && <p>Les envois de l’équipe sont en pause. Le propriétaire ou un capitaine peut les reprendre dans <a className="discord-link" href="/bot-discord">Bot Discord</a>.</p>}
      {!refreshing && connected && !coherent && <p role="alert">Les réglages Discord ont changé. Actualise les salons avant de préparer le bilan.</p>}
      {connection.data?.health?.verified === false && !metadataError && <p role="alert">Vérifie la connexion dans <a className="discord-link" href="/bot-discord">Bot Discord</a>.</p>}
      {connected && (destinations.length ? <>
        <SelectInput label="Destination Discord" value={routeId} onChange={selectRoute} disabled={busy || awaitingVerification || !validMetadata}>
          <option value="">Choisir un salon</option>
          {destinations.map((route) => { const destination = connection.data?.channels?.find((item) => item.id === route.channelId); return <option key={route.id} value={route.id} disabled={!destination || destination.canSend === false}>{destination ? `#${destination.name}` : "Salon indisponible"}{route.enabled === false ? " · publication manuelle" : ""}</option>; })}
        </SelectInput>
        <p className="discord-help">Le bilan sera visible par les membres du salon. Un bilan identique déjà publié ne sera pas envoyé une seconde fois.</p>
        {available.length !== destinations.length && <p>Les salons où le bot ne peut pas envoyer de message sont désactivés. Vérifie ses autorisations dans <a className="discord-link" href="/bot-discord">Bot Discord</a>.</p>}
        <Button type="button" variant="ghost" icon={preparing ? Loader2 : Eye} disabled={busy || awaitingVerification || !validDestination} onClick={prepare}>{preparing ? "Préparation du bilan…" : "Préparer l’aperçu"}</Button>
      </> : !refreshing && <p>Aucune destination configurée. Ajoute un salon dans <a className="discord-link" href="/bot-discord">Bot Discord</a>.</p>)}
      {preview && <>
        <DiscordPreview preview={preview} />
        {!preview.previewToken && <p role="alert">Prépare à nouveau l’aperçu pour publier ce bilan.</p>}
        <div className="discord-actions"><Button type="button" icon={action.busy ? Loader2 : Send} disabled={busy || awaitingVerification || !ready || !preview.previewToken} onClick={publish}>Publier dans #{channel?.name || "le salon"}</Button></div>
      </>}
      {receipt && <div role="status">
        {receipt.lastError && <p className="discord-history-error">{receipt.lastError}</p>}
        {receipt.status === "succeeded" && <><p>Le bilan du groupe est publié sur Discord.</p><DiscordLink href={receipt.messageUrl}>Voir le bilan sur Discord</DiscordLink></>}
        {receipt.status === "failed" && <p>L’envoi a été refusé. Vérifie le motif dans l’historique, puis prépare un nouvel aperçu pour réessayer.</p>}
        {receipt.status === "not_found" && <p>Aucun envoi enregistré pour cette demande. Prépare un nouvel aperçu pour réessayer.</p>}
        {awaitingVerification && <><p>La réception du bilan doit être vérifiée avant tout nouvel envoi.</p><Button type="button" variant="ghost" icon={RefreshCw} disabled={busy} onClick={() => verify(receipt.requestId)}>Vérifier ce même envoi</Button><Button type="button" variant="ghost" icon={Link2} disabled={busy} onClick={() => setResolution({ requestId: receipt.requestId, messageId: "" })}>Associer le message existant</Button></>}
      </div>}
      {resolution && <form className="discord-confirm" onSubmit={(event) => { event.preventDefault(); if (/^\d{17,20}$/.test(resolution.messageId)) verify(resolution.requestId, resolution.messageId); }}>
        <p>Si le bilan est visible dans Discord, active le mode développeur dans les paramètres avancés, puis ouvre le menu du message du bot et choisis « Copier l’identifiant du message ».</p>
        <TextInput label="Identifiant du message Discord" value={resolution.messageId} onChange={(value) => setResolution({ ...resolution, messageId: value.trim() })} required inputMode="numeric" pattern="[0-9]{17,20}" minLength={17} maxLength={20} autoComplete="off" autoFocus disabled={busy} />
        <div className="discord-actions"><Button type="submit" icon={Link2} disabled={busy || !/^\d{17,20}$/.test(resolution.messageId)}>Vérifier et associer</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setResolution(null)}>Annuler l’association</Button></div>
      </form>}
      <Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || refreshing} onClick={reload}>{metadataError ? "Réessayer" : "Actualiser les salons"}</Button>
      {connection.data?.configured && <section className="discord-section" aria-label="Historique Discord du groupe">
        <div className="discord-heading"><h4>Historique des bilans du groupe</h4><Button type="button" variant="ghost" icon={RefreshCw} disabled={busy || history.loading} onClick={reload}>Actualiser l’historique</Button></div>
        <DiscordFeedback loading={history.loading} error={history.error} />
        {!history.loading && !history.error && !history.data?.publications?.length && <p>Aucun bilan publié pour le moment.</p>}
        <ol className="discord-history">{(history.data?.publications || []).map((item) => <li key={item.id || item.requestId}>
          <div className="discord-heading"><strong>{item.channelName ? `#${item.channelName.replace(/^#/, "")}` : "Salon Discord"}</strong><DiscordStatus status={item.status} /></div>
          {item.createdAt && <p className="discord-help">{new Date(item.createdAt).toLocaleString("fr-FR")}</p>}
          {item.lastError && <p className="discord-history-error">{item.lastError}</p>}
          <div className="discord-actions"><DiscordLink href={item.messageUrl}>Voir sur Discord</DiscordLink>{["sending", "uncertain"].includes(item.status) && <><Button type="button" variant="ghost" icon={RefreshCw} disabled={busy} onClick={() => verify(item.requestId)}>Vérifier l’envoi</Button><Button type="button" variant="ghost" icon={Link2} disabled={busy} onClick={() => setResolution({ requestId: item.requestId, messageId: "" })}>Associer le message existant</Button></>}</div>
        </li>)}</ol>
      </section>}
    </div>
  </GameOperationDialog>;
}
