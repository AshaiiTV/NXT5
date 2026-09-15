import React, { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, MessageSquare, Pause, Play, Plus, RefreshCw, Unplug, X } from "lucide-react";
import { Badge, Button, SelectInput, Surface } from "../ui/Core.jsx";
import { DiscordFeedback, DiscordHistory, DiscordLink, discordQuery, useDiscordAction, useDiscordResource } from "./discord-shared.jsx";

export default function DiscordSettings({ teamId, teamName, canManage = false, canPublish = false }) {
  if (!teamId || (!canManage && !canPublish)) return null;
  return <DiscordSettingsContent key={teamId} {...{ teamId, teamName, canManage, canPublish }} />;
}

function DiscordSettingsContent({ teamId, teamName, canManage, canPublish }) {
  const [revision, setRevision] = useState(0);
  const [link, setLink] = useState(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const resource = useDiscordResource(discordQuery("team-discord-connection", { teamId }), revision);
  const action = useDiscordAction();
  const status = resource.data;
  const connection = status?.connection;
  const connected = Boolean(connection?.guildId) && connection.status !== "disconnected";
  const reload = () => setRevision((value) => value + 1);

  useEffect(() => {
    setLinkExpired(false);
    if (!link?.expiresAt) return undefined;
    const remaining = new Date(link.expiresAt).getTime() - Date.now();
    if (remaining <= 0) { setLinkExpired(true); return undefined; }
    const timeout = setTimeout(() => setLinkExpired(true), Math.min(remaining, 2147483647));
    return () => clearTimeout(timeout);
  }, [link]);

  async function copyCode() {
    try { await navigator.clipboard.writeText(link.code); setCopyNotice("Code copié."); }
    catch { setCopyNotice("Sélectionne le code affiché pour le copier."); }
  }

  return <Surface className="discord-panel">
    <div className="discord-heading"><h3><MessageSquare aria-hidden="true" className="h-5 w-5" />Discord de l’équipe</h3><Badge tone={connected ? connection.paused ? "yellow" : "cyan" : "slate"}>{resource.loading ? "Chargement" : connected ? connection.paused ? "En pause" : "Connecté" : "Non connecté"}</Badge></div>
    <p>Diffuse les résultats et visuels NXT5 de {teamName || "ton équipe"} dans les salons que tu choisis.</p>
    <DiscordFeedback loading={resource.loading} error={resource.error || action.error || status?.connectionError} notice={action.notice} />
    {status?.configured === false && <p className="discord-feedback">Le bot Discord n’est pas encore disponible. Un administrateur NXT5 doit terminer sa configuration.</p>}
    {status?.configured && status.enabled === false && <p className="discord-feedback">Les envois Discord sont suspendus pour toutes les équipes. Les réglages restent disponibles.</p>}
    {!canManage && <p className="discord-help">Seuls le propriétaire et les capitaines peuvent connecter le serveur et modifier les destinations.</p>}
    {status?.configured && !connected && canManage && <section className="discord-section">
      <h4>Connecter le serveur</h4>
      <ol className="discord-steps"><li>Installe le bot sur le serveur Discord de l’équipe.</li><li>Crée un code de liaison, puis utilise <code>/nxt connecter</code> dans ce serveur avec le code.</li><li>Reviens ici pour choisir les salons et activer la diffusion.</li></ol>
      <p className="discord-help">La liaison doit être effectuée par un membre autorisé à gérer le serveur Discord.</p>
      <div className="discord-actions"><DiscordLink href={status.installUrl || link?.installUrl}>Installer le bot</DiscordLink><Button type="button" icon={action.busy ? Loader2 : Link2} disabled={action.busy} onClick={() => { setCopyNotice(""); action.run("team-discord-connection", { teamId, action: "create-link" }, setLink); }}>{link ? "Créer un nouveau code" : "Créer le code de liaison"}</Button></div>
      {link?.code && <div className="discord-link-code"><p>Code de liaison à usage unique</p><code>{link.code}</code><p className="discord-help">{linkExpired ? "Ce code a expiré. Crée un nouveau code." : `Valable jusqu’au ${new Date(link.expiresAt).toLocaleString("fr-FR")}. Un nouveau code remplace le précédent.`}</p><div className="discord-actions"><Button type="button" icon={Copy} variant="ghost" disabled={linkExpired || action.busy} onClick={copyCode}>Copier le code</Button><Button type="button" icon={RefreshCw} variant="ghost" disabled={action.busy || resource.loading} onClick={reload}>Vérifier la connexion</Button></div>{copyNotice && <p role="status">{copyNotice}</p>}</div>}
    </section>}
    {connected && <>
      <section className="discord-section"><div className="discord-heading"><div><h4>{connection.guildName || "Serveur Discord connecté"}</h4><p className="discord-help">{connection.paused ? "Les publications de cette équipe sont suspendues." : "Les nouvelles games suivent les règles de diffusion actives."}</p></div>{canManage && <Button type="button" variant="ghost" icon={connection.paused ? Play : Pause} disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: connection.paused ? "resume" : "pause" }, reload, connection.paused ? "La diffusion de l’équipe a repris." : "La diffusion de l’équipe est en pause.")}>{connection.paused ? "Reprendre les envois" : "Mettre en pause"}</Button>}</div></section>
      <DiscordRoutes teamId={teamId} metadata={status} canManage={canManage} onSaved={reload} />
    </>}
    {status?.configured && <DiscordHistory teamId={teamId} canPublish={canPublish || canManage} revision={revision} />}
    <div className="discord-actions discord-section"><Button type="button" variant="ghost" icon={RefreshCw} disabled={resource.loading || action.busy} onClick={reload}>Actualiser Discord</Button>{connected && canManage && !confirmDisconnect && <Button type="button" icon={Unplug} variant="danger" disabled={action.busy} onClick={() => setConfirmDisconnect(true)}>Déconnecter le serveur</Button>}</div>
    {confirmDisconnect && <div className="discord-confirm"><p>Déconnecter ce serveur arrête les publications de l’équipe. Les messages déjà présents dans Discord restent visibles et peuvent être retirés depuis l’historique.</p><div className="discord-actions"><Button type="button" variant="danger" disabled={action.busy} onClick={() => action.run("team-discord-connection", { teamId, action: "disconnect" }, () => { setConfirmDisconnect(false); setLink(null); reload(); }, "Le serveur a été déconnecté.")}>Confirmer la déconnexion</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setConfirmDisconnect(false)}>Annuler</Button></div></div>}
  </Surface>;
}

function DiscordRoutes({ teamId, metadata, canManage, onSaved }) {
  const resource = useDiscordResource(discordQuery("team-discord-routes", { teamId }));
  if (resource.loading || resource.error) return <DiscordFeedback loading={resource.loading} error={resource.error} />;
  return <DiscordRoutesEditor {...{ teamId, metadata, canManage, onSaved }} initialRoutes={resource.data?.routes || []} />;
}

function DiscordRoutesEditor({ teamId, metadata, canManage, onSaved, initialRoutes }) {
  const normalize = (route) => ({ ...route, channelId: route.channelId || "", categoryIds: route.categoryIds || [], includeHints: route.includeHints === true, mentionRoleId: route.mentionRoleId || "", enabled: route.enabled !== false });
  const [routes, setRoutes] = useState(() => initialRoutes.map(normalize));
  const [dirty, setDirty] = useState(false);
  const action = useDiscordAction();
  const channels = metadata.channels || [], roles = metadata.roles || [], categories = metadata.categories || [];
  const patch = (index, values) => { setRoutes((current) => current.map((route, i) => i === index ? { ...route, ...values } : route)); setDirty(true); };
  const availableChannels = channels.filter((channel) => channel.canSend !== false && !routes.some((route) => route.channelId === channel.id));
  const canSave = new Set(routes.map((route) => route.channelId)).size === routes.length && routes.every((route) => route.channelId && channels.some((channel) => channel.id === route.channelId && channel.canSend !== false));
  function save(event) {
    event.preventDefault();
    action.run("team-discord-routes", { teamId, routes: routes.map(({ id, channelId, categoryIds, includeHints, mentionRoleId, enabled }) => ({ ...(id ? { id } : {}), channelId, categoryIds, includeHints, mentionRoleId: mentionRoleId || null, enabled })) }, () => { setDirty(false); onSaved(); }, "Destinations enregistrées.");
  }
  return <form className="discord-section" onSubmit={save}>
    <h4>Destinations des games</h4>
    <p>Toute personne ayant accès au salon pourra lire le message et son visuel, même sans compte NXT5. Les liens vers les games conservent les droits d’accès NXT5.</p>
    {!channels.length && <p className="discord-feedback">Aucun salon disponible. Vérifie les droits du bot dans Discord, puis actualise la connexion.</p>}
    {!routes.length && <p>Aucune destination. Ajoute un salon pour préparer la diffusion.</p>}
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
    {canManage && <div className="discord-actions"><Button type="button" variant="ghost" icon={Plus} disabled={action.busy || !availableChannels.length || routes.length >= 10} onClick={() => { setRoutes((current) => [...current, normalize({ channelId: "", enabled: true })]); setDirty(true); }}>Ajouter un salon</Button><Button type="submit" icon={action.busy ? Loader2 : Check} disabled={action.busy || !dirty || !canSave}>Enregistrer les destinations</Button>{dirty && <p className="discord-help" role="status">Modifications non enregistrées.</p>}</div>}
  </form>;
}

export function DiscordAdminStatus() {
  const [revision, setRevision] = useState(0);
  const resource = useDiscordResource("admin-discord", revision);
  const status = resource.data;
  return <Surface className="discord-panel"><div className="discord-heading"><h3><MessageSquare aria-hidden="true" className="h-5 w-5" />Discord</h3><Badge tone={status?.enabled && status?.configured ? "cyan" : "slate"}>{resource.loading ? "Chargement" : !status?.configured ? "À configurer" : status.enabled ? "En service" : "Envois suspendus"}</Badge></div><p>Les destinations et les autorisations de publication se règlent dans la gestion de chaque équipe.</p><DiscordFeedback error={resource.error} loading={resource.loading} />{status && <><dl className="discord-health">{[["Équipes connectées", status.connectionsCount], ["En attente", status.queuedCount], ["En échec", status.failedCount], ["Envois à vérifier", status.unknownCount]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>{status.oldestPendingAt && <p className="discord-help">Plus ancienne publication en attente : {new Date(status.oldestPendingAt).toLocaleString("fr-FR")}.</p>}{!!status.issues?.length && <ul className="discord-steps">{status.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}<p className="discord-help">La configuration du bot et la suspension globale des envois se gèrent sur le serveur NXT5.</p></>}<Button type="button" icon={RefreshCw} variant="ghost" disabled={resource.loading} onClick={() => setRevision((value) => value + 1)}>Actualiser Discord</Button></Surface>;
}
