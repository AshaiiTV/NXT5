import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, Link2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, TextInput } from "../ui/Core.jsx";
import "./discord.css";

export const discordQuery = (endpoint, values) => `${endpoint}?${new URLSearchParams(Object.entries(values).filter(([, value]) => value != null && value !== ""))}`;
export const discordPost = (body) => ({ method: "POST", body: JSON.stringify(body) });

export function useDiscordResource(path, revision = 0, { keepPreviousData = false } = {}) {
  const [state, setState] = useState({ path: null, data: null, loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ path, data: keepPreviousData && previous.path === path ? previous.data : null, loading: Boolean(path), error: "" }));
    if (path) apiFetch(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ path, data, loading: false, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted) setState((previous) => ({ path, data: keepPreviousData && previous.path === path ? previous.data : null, loading: false, error: error.message }));
    });
    return () => controller.abort();
  }, [path, revision, keepPreviousData]);
  return state.path === path ? state : { data: null, loading: Boolean(path), error: "" };
}

// A remount cancels work for the previous team or game. A cancelled POST may have
// reached the server; its result must never populate the newly selected context.
export function useDiscordAction() {
  const controller = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => () => controller.current?.abort(), []);
  async function run(path, body, onSuccess, successText = "") {
    if (controller.current && !controller.current.signal.aborted) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiFetch(path, { ...discordPost(body), signal: request.signal });
      if (!request.signal.aborted) { onSuccess?.(result); setNotice(successText); }
    } catch (err) {
      if (!request.signal.aborted) setError(err.message);
    } finally {
      if (!request.signal.aborted) { controller.current = null; setBusy(false); }
    }
  }
  return { run, busy, error, notice, clear: () => { setError(""); setNotice(""); } };
}

export function DiscordFeedback({ error, notice, loading }) {
  return <>{loading && <p role="status" className="discord-loading"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />Chargement de Discord…</p>}{error && <p role="alert" className="discord-feedback discord-feedback-error">{error}</p>}{notice && <p role="status" className="discord-feedback">{notice}</p>}</>;
}

export function safeDiscordUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["discord.com", "www.discord.com"].includes(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function DiscordLink({ href, children, onClick, className = "" }) {
  const safeHref = safeDiscordUrl(href);
  return safeHref ? <a className={`discord-link ${className}`} href={safeHref} target="_blank" rel="noopener noreferrer" onClick={onClick}>{children}<ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only"> (nouvel onglet)</span></a> : null;
}

const STATUS = {
  queued: ["En attente", "cyan"], preparing: ["Préparation", "cyan"], retry_wait: ["Nouvel essai prévu", "yellow"], sending: ["Envoi en cours", "cyan"],
  uncertain: ["Envoi à vérifier", "yellow"], unknown: ["Envoi à vérifier", "yellow"], succeeded: ["Publié", "green"], sent: ["Publié", "green"],
  superseded: ["Version remplacée", "slate"], blocked: ["Action requise", "red"], failed: ["Échec", "red"], cancelled: ["Annulé", "slate"],
  removed: ["Retiré", "slate"], withdrawn: ["Retiré", "slate"], withdrawal_pending: ["Retrait à réessayer", "yellow"], pending: ["En attente", "cyan"],
};

export function DiscordStatus({ status }) {
  const [label, tone] = STATUS[status] || ["État indisponible", "slate"];
  return <Badge tone={tone}>{label}</Badge>;
}

// These values are escaped for Discord, but remain plain React text here.
const previewText = (value) => String(value ?? "").replace(/\\([\\`*_{}\[\]<>~|])/g, "$1");
function previewGamePath(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && url.pathname === "/statistiques"
      ? url.pathname + url.search : null;
  } catch { return null; }
}

export function DiscordPreview({ preview, fictitious = false }) {
  if (!preview) return null;
  const message = preview.message || {};
  const image = typeof preview.imageDataUrl === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/.test(preview.imageDataUrl) ? preview.imageDataUrl : null;
  const imageAlt = message.attachments?.[0]?.description || (fictitious ? "Exemple fictif du visuel de game envoyé par NXT5" : "Visuel NXT5 de la game, reprenant les statistiques de la publication");
  const links = (message.components || []).flatMap((row) => row.components || []).filter((item) => item.type === 2 && item.style === 5 && previewGamePath(item.url));
  return <section className="discord-preview" aria-label="Aperçu de la publication">
    <h4>{fictitious ? "Exemple de message et de visuel" : "Aperçu de la publication"}</h4>
    {fictitious && <p className="discord-help">Données fictives : cet exemple ne reprend aucune game ni note de ton équipe.</p>}
    {!!message.content && <p className="discord-message-content">{message.content}</p>}
    {(message.embeds || []).map((embed, index) => <div className="discord-embed" key={index}>
      {embed.title && <h5>{previewText(embed.title)}</h5>}{embed.description && <p className="discord-message-content">{previewText(embed.description)}</p>}
      {!!embed.fields?.length && <dl className="discord-embed-fields">{embed.fields.map((field, i) => <div key={i}><dt>{previewText(field.name)}</dt><dd>{previewText(field.value)}</dd></div>)}</dl>}
      {image && index === 0 && <img className="discord-preview-image" src={image} alt={previewText(imageAlt)} />}
      {embed.footer?.text && <p className="discord-embed-footer">{embed.footer.text}</p>}
    </div>)}
    {image && !message.embeds?.length && <img className="discord-preview-image" src={image} alt={previewText(imageAlt)} />}
    {!!links.length && <div className="discord-actions discord-preview-buttons">{links.map((link, index) => <a className="discord-preview-game" href={previewGamePath(link.url)} key={index}>{previewText(link.label)}<ExternalLink aria-hidden="true" className="h-4 w-4" /></a>)}</div>}
    <div className="discord-preview-meta">{image ? <a className="discord-link" href={image} download="nxt5-discord-apercu.png">Télécharger le visuel</a> : <p className="discord-help">Visuel indisponible pour cet aperçu.</p>}
      {preview.snapshotRevision != null && <p className="discord-help">Version des données : {preview.snapshotRevision}</p>}
    </div>
  </section>;
}

export function DiscordHistory({ teamId, matchId, revision = 0, canPublish = false, showSummary = false }) {
  return <DiscordHistoryContent key={`${teamId}:${matchId || "all"}`} {...{ teamId, matchId, revision, canPublish, showSummary }} />;
}

function DiscordHistoryContent({ teamId, matchId, revision, canPublish, showSummary }) {
  const [localRevision, setLocalRevision] = useState(0);
  const [removeId, setRemoveId] = useState(null);
  const [resolution, setResolution] = useState(null);
  const history = useDiscordResource(discordQuery("team-discord-deliveries", { teamId, matchId }), `${revision}:${localRevision}`);
  const action = useDiscordAction();
  const reload = () => setLocalRevision((value) => value + 1);
  const deliveries = (history.data?.deliveries || []).filter((item) => !matchId || item.matchId === matchId);
  const latest = deliveries.find((item) => ["succeeded", "sent"].includes(item.status) && safeDiscordUrl(item.messageUrl));
  const issues = deliveries.filter((item) => ["blocked", "failed", "uncertain", "unknown", "withdrawal_pending"].includes(item.status));
  return <section className="discord-section" aria-label="Historique Discord">
    {showSummary && !history.loading && !history.error && <div className="discord-publication-summary">
      <div><h4>Dernière publication confirmée</h4>{latest ? <><p><strong>{latest.matchLabel || "Game NXT5"}</strong>{latest.channelName ? ` · #${latest.channelName.replace(/^#/, "")}` : ""}</p><DiscordLink href={latest.messageUrl}>Ouvrir la dernière publication</DiscordLink></> : <p>Aucune game publiée dans l’historique disponible. Le message de test reste distinct des games.</p>}</div>
      {!!issues.length && <p className="discord-feedback discord-feedback-error">{issues.length} publication{issues.length > 1 ? "s demandent" : " demande"} une vérification. Consulte le motif et les actions dans l’historique ci-dessous.</p>}
    </div>}
    <div className="discord-heading"><h4>Historique des publications</h4><Button type="button" variant="ghost" icon={RefreshCw} disabled={history.loading || action.busy} onClick={reload}>Actualiser l’historique</Button></div>
    <DiscordFeedback error={history.error || action.error} notice={action.notice} loading={history.loading} />
    {!history.loading && !history.error && deliveries.length === 0 && <p>Aucune publication pour le moment.</p>}
    <ol className="discord-history">{deliveries.map((item) => {
      const uncertain = ["uncertain", "unknown"].includes(item.status);
      return <li key={item.id}>
        <div className="discord-heading"><strong>{item.matchLabel || "Game NXT5"}</strong><DiscordStatus status={item.status} /></div>
        <p className="discord-help">{item.channelName ? `#${item.channelName.replace(/^#/, "")}` : "Salon Discord"}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString("fr-FR")}` : ""}</p>
        {item.lastError && <p className="discord-history-error">{item.lastError}</p>}
        {uncertain && <p>La réception du message doit être vérifiée avant tout nouvel envoi.</p>}
        <div className="discord-actions"><DiscordLink href={item.messageUrl}>Voir sur Discord</DiscordLink>
          {canPublish && item.canResolve === true && uncertain && resolution?.id !== item.id && <Button type="button" variant="ghost" disabled={action.busy} icon={Link2} onClick={() => setResolution({ id: item.id, messageId: "" })}>Associer le message existant</Button>}
          {canPublish && item.canRetry === true && !uncertain && <Button type="button" variant="ghost" disabled={action.busy} icon={RefreshCw} onClick={() => action.run("team-discord-retry", { teamId, deliveryId: item.id, action: "retry" }, reload, "La reprise a été demandée.")}>Réessayer</Button>}
          {canPublish && item.canRemove === true && removeId !== item.id && <Button type="button" variant="danger" disabled={action.busy} icon={Trash2} onClick={() => setRemoveId(item.id)}>Retirer le message</Button>}
        </div>
        {canPublish && item.canResolve === true && uncertain && resolution?.id === item.id && <form className="discord-confirm" onSubmit={(event) => { event.preventDefault(); if (/^\d{17,20}$/.test(resolution.messageId)) action.run("team-discord-retry", { teamId, deliveryId: item.id, action: "resolve", messageId: resolution.messageId }, () => { setResolution(null); reload(); }, "Le message existant a été associé à la publication."); }}>
          <p>Dans Discord, active le mode développeur dans les paramètres avancés, puis ouvre le menu du message envoyé par le bot et choisis « Copier l’identifiant du message ».</p>
          <p className="discord-help">NXT5 vérifiera l’auteur, le salon et la référence de cette publication avant de l’associer. Cette action ne renvoie aucun message.</p>
          <TextInput label="Identifiant du message Discord" value={resolution.messageId} onChange={(value) => setResolution({ id: item.id, messageId: value.trim() })} required inputMode="numeric" pattern="[0-9]{17,20}" minLength={17} maxLength={20} autoComplete="off" autoFocus disabled={action.busy} />
          <div className="discord-actions"><Button type="submit" icon={Link2} disabled={action.busy || !/^\d{17,20}$/.test(resolution.messageId)}>Vérifier et associer</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setResolution(null)}>Annuler l’association</Button></div>
        </form>}
        {removeId === item.id && <div className="discord-confirm"><p>Retirer cette publication et son visuel de Discord ? La game restera dans NXT5.</p><div className="discord-actions"><Button type="button" variant="danger" disabled={action.busy} onClick={() => action.run("team-discord-retry", { teamId, deliveryId: item.id, action: "remove" }, () => { setRemoveId(null); reload(); }, "Le retrait du message a été demandé.")}>Confirmer le retrait</Button><Button type="button" variant="ghost" disabled={action.busy} onClick={() => setRemoveId(null)}>Annuler</Button></div></div>}
      </li>;
    })}</ol>
    {history.data?.hasMore && <p className="discord-help">Les publications les plus récentes sont affichées.</p>}
  </section>;
}
