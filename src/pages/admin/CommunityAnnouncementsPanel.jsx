import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ExternalLink, Eye, Loader2, Megaphone, Plus, RefreshCw, Send } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { ANNOUNCEMENT_API_VERSION, ANNOUNCEMENT_API_VERSION_HEADER } from "../../../shared/discord-announcements-contract.js";
import { useAdminNavigationGuard } from "../../components/admin/AdminNavigationContext.jsx";
import { Badge, Button, SelectInput, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import "./community-announcements.css";

const ENDPOINT = "admin-discord-announcements";
const announcementFetch = options => apiFetch(ENDPOINT, {
  ...options,
  headers: { "Content-Type": "application/json", [ANNOUNCEMENT_API_VERSION_HEADER]: ANNOUNCEMENT_API_VERSION },
});
const MAX_CONTENT = 4096;
const MAX_SERVERS = 10;
const STATUS_LABELS = { sent: ["Envoyée", "green"], uncertain: ["À vérifier", "yellow"], sending: ["Envoi en cours", "cyan"], queued: ["En attente", "slate"], failed: ["Échec", "red"] };
const destinationKey = values => JSON.stringify(values.map(({ guildId, channelId }) => [guildId, channelId]).sort((a, b) => a[0].localeCompare(b[0])));
const sameDestination = (a, b) => a.guildId === b.guildId && a.channelId === b.channelId;
const pendingResult = result => result?.results.some(item => ["uncertain", "sending", "queued"].includes(item.status));

function newReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `annonce-${date}-${suffix}`;
}
function announcementDate(value) {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Date indisponible";
}
function safeDiscordLink(value, kind) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "discord.com" && !url.username && !url.password
      && (kind === "install" ? url.pathname === "/oauth2/authorize" : /^\/channels\/\d+\/\d+\/\d+$/.test(url.pathname)) ? url.href : "";
  } catch { return ""; }
}
function DiscordLink({ href, kind, children }) {
  const safeHref = safeDiscordLink(href, kind);
  return safeHref ? <a className="community-announcement-link" href={safeHref} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={15} aria-hidden="true" /><span className="sr-only"> (nouvel onglet)</span></a> : null;
}
function validData(value) {
  return value && Array.isArray(value.guilds) && value.guilds.every(guild => typeof guild.id === "string" && Array.isArray(guild.channels))
    && Array.isArray(value.destinations) && value.destinations.every(item => typeof item.guildId === "string" && typeof item.channelId === "string")
    && Array.isArray(value.announcements);
}
function combinedResult(reference, results) {
  return { reference, results, status: results.every(item => item.status === "sent") ? "sent"
    : results.every(item => item.status === "failed") ? "failed"
    : results.some(item => item.status === "sent") ? "partial" : "uncertain" };
}
function checkedResult(value, snapshot) {
  if (!Array.isArray(value?.results) || value.results.length !== snapshot.destinations.length
    || !snapshot.destinations.every(destination => value.results.filter(item => sameDestination(item, destination)).length === 1)
    || value.results.some(item => !STATUS_LABELS[item.status])) throw new Error("Le résultat de tous les serveurs n’a pas pu être confirmé.");
  return combinedResult(snapshot.reference, value.results.map(item => ({ ...snapshot.destinations.find(destination => sameDestination(item, destination)), ...item })));
}
function ResultsList({ results }) {
  return <ul className="community-announcement-receipts">{results.map(item => {
    const [label, tone] = STATUS_LABELS[item.status] || ["État inconnu", "slate"];
    return <li key={item.guildId}><div><strong>{item.guildName || `Serveur ${item.guildId}`}</strong><p>#{item.channelName || item.channelId}</p>{item.error && <p>{item.error}</p>}<DiscordLink href={item.messageUrl}>Voir le message Discord</DiscordLink></div><Badge tone={tone}>{label}</Badge></li>;
  })}</ul>;
}

export default function CommunityAnnouncementsPanel() {
  const id = useId();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [reference, setReference] = useState(newReference);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [checkingReference, setCheckingReference] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const request = useRef(null);
  const savedDestinations = useRef(null);
  const revision = useRef(0);
  const mutation = useRef(false);
  const attempt = useRef(null);
  const previewRef = useRef(null);
  const resultRef = useRef(null);

  const clearAccess = useCallback(() => {
    setData(null); setPreview(null); setResult(null); setDestinations([]);
    savedDestinations.current = null; attempt.current = null;
  }, []);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setLoadError("");
    try {
      const next = await announcementFetch({ signal: controller.signal });
      if (!validData(next)) throw new Error("Les informations des annonces sont incomplètes. Actualise les serveurs pour réessayer.");
      if (!mounted.current || controller.signal.aborted) return;
      const previous = savedDestinations.current;
      setDestinations(current => !attempt.current && (previous === null || destinationKey(current) === destinationKey(previous)) ? next.destinations : current);
      savedDestinations.current = next.destinations;
      setData(next);
      // Permissions may have changed even when the saved selection is identical.
      revision.current += 1; setPreview(null);
      if (attempt.current) {
        const snapshot = attempt.current;
        setResult(current => {
          const rows = snapshot.destinations.map(destination => {
            const receipt = next.announcements.find(item => item.reference === snapshot.reference && sameDestination(item, destination));
            const prior = current?.results.find(item => sameDestination(item, destination));
            return { ...destination, ...(prior || { status: "uncertain" }), ...(receipt || {}) };
          });
          return combinedResult(snapshot.reference, rows);
        });
      }
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      setLoadError(failure.message || "Impossible de charger les serveurs Discord.");
    } finally { if (mounted.current && !controller.signal.aborted) setLoading(false); }
  }, [clearAccess]);
  useEffect(() => {
    mounted.current = true; refresh();
    return () => { mounted.current = false; request.current?.abort(); };
  }, [refresh]);

  const locked = busy === "publish" || Boolean(result);
  const destinationChanged = Boolean(data) && destinationKey(destinations) !== destinationKey(data.destinations);
  const validDestinations = destinations.length > 0 && destinations.length <= MAX_SERVERS && destinations.every(destination => {
    if (result?.results.some(item => sameDestination(item, destination) && ["sent", "uncertain", "sending"].includes(item.status))) return true;
    const guild = data?.guilds.find(item => item.id === destination.guildId);
    return !guild?.error && guild?.channels.some(channel => channel.id === destination.channelId && channel.canSend);
  });
  const configured = validDestinations && !destinationChanged;
  const validContent = Boolean(reference.trim() && content.trim()) && content.length <= MAX_CONTENT;
  const dirty = destinationChanged || Boolean(content.trim() && result?.status !== "sent");
  useAdminNavigationGuard({ dirty, disabled: Boolean(busy) });
  useEffect(() => {
    if (!dirty || typeof window === "undefined") return undefined;
    const beforeUnload = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  useEffect(() => { if (preview) previewRef.current?.focus(); }, [preview]);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  function change(setter, value) {
    revision.current += 1; setPreview(null); setError(""); setNotice(""); setter(value);
  }
  function toggleGuild(guild, checked) {
    change(setDestinations, checked ? [...destinations, { guildId: guild.id, channelId: guild.channelId || "" }] : destinations.filter(item => item.guildId !== guild.id));
  }
  async function configure() {
    if (mutation.current || loading || busy === "publish" || !destinationChanged || !validDestinations) return;
    mutation.current = true; setBusy("configure"); setError(""); setNotice(""); setPreview(null);
    const selected = destinations;
    try {
      await announcementFetch({ method: "POST", body: JSON.stringify({ action: "configure", destinations: selected, ...(result ? { reference: result.reference } : {}) }) });
      if (!mounted.current) return;
      savedDestinations.current = selected;
      setData(current => current ? { ...current, destinations: selected } : current);
      setNotice("Destinations enregistrées. Aucun message n’a été envoyé.");
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      setError(failure.message || "Impossible d’enregistrer les destinations.");
    } finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }
  async function preparePreview(event, retry = false) {
    event?.preventDefault();
    if (mutation.current || loading || (locked && !retry) || !configured || !validContent) return;
    mutation.current = true;
    const currentRevision = revision.current;
    setBusy("preview"); setError(""); setNotice(""); setPreview(null);
    try {
      const next = await announcementFetch({ method: "POST", body: JSON.stringify({ action: "preview", reference, content, destinations }) });
      if (!next?.previewToken || next.content !== content || next.reference !== reference || !Array.isArray(next.destinations)
        || destinationKey(next.destinations) !== destinationKey(destinations)) throw new Error("L’aperçu est incomplet ou les destinations ont changé. Actualise les serveurs, puis prépare un nouvel aperçu.");
      if (mounted.current && currentRevision === revision.current) setPreview(next);
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      if (currentRevision === revision.current) setError(failure.message || "Impossible de préparer l’aperçu.");
    } finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }
  async function publish() {
    const snapshot = preview;
    if (mutation.current || loading || !snapshot || !configured) return;
    mutation.current = true; attempt.current = snapshot;
    setBusy("publish"); setError(""); setNotice("");
    try {
      const next = await announcementFetch({ method: "POST", body: JSON.stringify({ action: "publish", reference: snapshot.reference, content: snapshot.content,
        destinations: snapshot.destinations.map(({ guildId, channelId }) => ({ guildId, channelId })), previewToken: snapshot.previewToken }) });
      const confirmed = checkedResult(next, snapshot);
      if (!mounted.current) return;
      setResult(confirmed); setPreview(null); refresh();
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      else if (!failure.status || failure.status >= 500) {
        setResult(current => combinedResult(snapshot.reference, snapshot.destinations.map(destination => ({ ...destination,
          ...(current?.results.find(item => sameDestination(item, destination)) || { status: "uncertain" }) }))));
        setPreview(null);
      } else { setPreview(null); if (!result) attempt.current = null; }
      setError(failure.message || "Impossible de confirmer le résultat de l’envoi.");
    } finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }
  async function recover(targetReference, guildId) {
    if (mutation.current || loading || !targetReference) return;
    mutation.current = true; setBusy("recover"); setCheckingReference(`${targetReference}:${guildId || "all"}`); setError(""); setNotice("");
    try {
      const next = await announcementFetch({ method: "POST", body: JSON.stringify({ action: "recover", reference: targetReference, ...(guildId ? { guildId } : {}) }) });
      if (!Array.isArray(next?.results) || !next.results.length || next.results.some(item => !STATUS_LABELS[item.status])) throw new Error("Le résultat de l’envoi n’a pas pu être confirmé.");
      if (!mounted.current) return;
      if (attempt.current?.reference === targetReference) {
        if (!guildId) setResult(checkedResult(next, attempt.current));
        else setResult(current => current ? combinedResult(targetReference, current.results.map(item => ({ ...item, ...(next.results.find(row => sameDestination(row, item)) || {}) }))) : current);
      } else setNotice("Vérification terminée. Consulte le résultat dans l’historique. Aucun nouveau message n’a été envoyé.");
      setData(current => current ? { ...current, announcements: current.announcements.map(item => item.reference === targetReference
        ? { ...item, ...(next.results.find(row => sameDestination(row, item)) || {}) } : item) } : current);
      refresh();
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      setError(failure.message || "Impossible de vérifier le résultat de l’envoi.");
    } finally { mutation.current = false; if (mounted.current) { setBusy(""); setCheckingReference(""); } }
  }
  function startNew() {
    if (mutation.current || !result || pendingResult(result)) return;
    revision.current += 1; attempt.current = null;
    setReference(newReference()); setContent(""); setPreview(null); setResult(null); setError(""); setNotice("");
  }

  async function restore(targetReference) {
    if (mutation.current || loading || content.trim() || result) return;
    const currentRevision = revision.current;
    mutation.current = true; setBusy("restore"); setError(""); setNotice("");
    try {
      const next = await announcementFetch({ method: "POST", body: JSON.stringify({ action: "restore", reference: targetReference }) });
      if (next?.reference !== targetReference || typeof next.content !== "string" || !Array.isArray(next.destinations) || !next.destinations.length) throw new Error("Impossible de retrouver le texte et les destinations de cette annonce.");
      const snapshot = { ...next, destinations: next.destinations.map(item => {
        const guild = data.guilds.find(value => value.id === item.guildId);
        return { ...item, guildName: guild?.name, channelName: guild?.channels.find(value => value.id === item.channelId)?.name };
      }) };
      const restored = checkedResult(next, snapshot);
      if (!mounted.current) return;
      if (currentRevision !== revision.current) {
        setNotice("Ton brouillon a changé. Il est conservé ; vide-le avant de reprendre une autre annonce.");
        return;
      }
      revision.current += 1; attempt.current = snapshot;
      setReference(next.reference); setContent(next.content); setDestinations(next.destinations.map(({ guildId, channelId }) => ({ guildId, channelId })));
      setPreview(null); setResult(restored);
      setNotice("Annonce retrouvée. Prépare l’aperçu de reprise pour envoyer uniquement les destinations en attente ou en échec.");
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      setError(failure.message || "Impossible de reprendre cette annonce.");
    } finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  return <Surface className="community-announcements"><section aria-labelledby={`${id}-title`}>
    <header className="community-announcements-heading">
      <div><h3 id={`${id}-title`}><Megaphone size={20} aria-hidden="true" />Annonces communautaires</h3><p>Publie la même annonce sur un ou plusieurs serveurs où le bot est installé.</p></div>
      <Button type="button" variant="ghost" icon={RefreshCw} onClick={refresh} disabled={loading || Boolean(busy)}>{loading ? "Chargement des serveurs…" : "Actualiser les serveurs"}</Button>
    </header>
    {loadError && <div className="community-announcement-notice is-error" role="alert"><strong>{data ? "L’actualisation des serveurs a échoué." : "Annonces indisponibles."}</strong><p>{loadError}</p>{data && <p>Les dernières informations restent affichées.</p>}</div>}
    {error && <div className="community-announcement-notice is-error" role="alert">{error}</div>}
    {loading && !data && <p className="community-announcement-help" role="status">Chargement des serveurs du bot et de leurs salons…</p>}
    {data && <>
      {!data.community?.joined && <div className="community-announcement-notice"><strong>Ajoute le bot à ton serveur communauté</strong><p>Le serveur NXT5 indiqué sur la page Contact n’accueille pas encore le bot. Invite-le, puis actualise les serveurs pour choisir son salon.</p><DiscordLink kind="install" href={data.community?.installUrl}>Inviter le bot sur le serveur communauté</DiscordLink><p>L’autorisation s’ouvre dans Discord et demande la permission Administrateur. Tu dois pouvoir gérer ce serveur.</p></div>}
      <fieldset className="community-announcement-servers" aria-describedby={`${id}-servers-help`}>
        <legend>Serveurs destinataires</legend>
        <p className="community-announcement-help" id={`${id}-servers-help`}>Coche les serveurs, puis choisis un salon pour chacun. Jusqu’à {MAX_SERVERS} serveurs par annonce.</p>
        {!data.guilds.length && <p className="community-announcement-help">Aucun serveur disponible. Invite le bot, puis actualise cette liste.</p>}
        {data.guilds.map(guild => {
          const selected = destinations.find(item => item.guildId === guild.id);
          const unavailable = Boolean(guild.error) || !guild.channels.some(channel => channel.canSend);
          return <div className="community-announcement-guild" key={guild.id}>
            <label className="community-announcement-guild-choice"><input type="checkbox" checked={Boolean(selected)} onChange={event => toggleGuild(guild, event.target.checked)}
              disabled={locked || busy === "configure" || (!selected && (unavailable || destinations.length >= MAX_SERVERS))} /><span><strong>{guild.name || guild.id}</strong>{guild.id === data.community?.guildId && <small>Serveur communauté · Contact</small>}</span></label>
            {guild.error && <p className="community-announcement-help">{guild.error}</p>}
            {!guild.error && unavailable && <p className="community-announcement-help">Aucun salon autorisé. Vérifie les permissions du bot, puis actualise les serveurs.</p>}
            {selected && <SelectInput label={`Salon d’annonces · ${guild.name || guild.id}`} value={selected.channelId} onChange={value => change(setDestinations, destinations.map(item => item.guildId === guild.id ? { ...item, channelId: value } : item))} disabled={locked || busy === "configure"}>
              <option value="">Choisir un salon</option>
              {selected.channelId && !guild.channels.some(item => item.id === selected.channelId) && <option value={selected.channelId} disabled>Salon enregistré indisponible</option>}
              {guild.channels.map(channel => <option key={channel.id} value={channel.id} disabled={!channel.canSend}>#{channel.name || channel.id}{!channel.canSend ? " · Envoi non autorisé" : ""}</option>)}
            </SelectInput>}
          </div>;
        })}
        {destinations.filter(item => !data.guilds.some(guild => guild.id === item.guildId)).map(item => <div className="community-announcement-guild" key={item.guildId}><label className="community-announcement-guild-choice"><input type="checkbox" checked onChange={() => change(setDestinations, destinations.filter(destination => destination.guildId !== item.guildId))} disabled={locked || busy === "configure"} /><span>Serveur {item.guildId} indisponible</span></label><p className="community-announcement-help">Actualise les serveurs ou retire cette destination avant de continuer.</p></div>)}
      </fieldset>
      <div className="community-announcement-actions"><Button type="button" variant="ghost" icon={busy === "configure" ? Loader2 : Check} onClick={configure} disabled={loading || Boolean(busy) || !destinationChanged || !validDestinations}>{busy === "configure" ? "Enregistrement…" : result ? "Rétablir les destinations de cet envoi" : "Enregistrer les destinations"}</Button><DiscordLink kind="install" href={data.installUrl}>Ajouter le bot à un autre serveur</DiscordLink></div>
      <p className="community-announcement-help">{!destinations.length ? "Sélectionne au moins un serveur pour préparer l’aperçu." : !validDestinations ? "Choisis un salon autorisé pour chaque serveur sélectionné." : destinationChanged ? "Enregistre ces destinations avant de préparer l’aperçu." : `${destinations.length} serveur${destinations.length > 1 ? "s" : ""} sélectionné${destinations.length > 1 ? "s" : ""}. L’envoi aura lieu uniquement après ta confirmation de l’aperçu.`}</p>
      {notice && <p className="community-announcement-notice" role="status">{notice}</p>}
      <form className="community-announcement-editor" onSubmit={preparePreview}>
        <TextInput label="Identifiant de l’annonce" value={reference} onChange={value => change(setReference, value)} maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,79}" required disabled={locked} aria-describedby={`${id}-reference-help`} />
        <p className="community-announcement-help" id={`${id}-reference-help`}>Conservé pour chaque serveur lors d’une vérification ou d’une reprise, afin d’éviter les doublons.</p>
        <TextAreaInput label="Texte de l’annonce (Markdown Discord)" value={content} onChange={value => change(setContent, value)} rows={10} maxLength={MAX_CONTENT} required disabled={locked} placeholder="Rédige ou colle ton annonce ici…" aria-describedby={`${id}-content-help`} />
        <div className="community-announcement-editor-meta" id={`${id}-content-help`}><p>Les mentions ne déclenchent aucune notification.</p><span>{content.length} / {MAX_CONTENT} caractères</span></div>
        {!locked && <div className="community-announcement-actions"><Button type="submit" variant={preview ? "ghost" : "primary"} icon={busy === "preview" ? Loader2 : Eye} disabled={loading || Boolean(busy) || !configured || !validContent}>{busy === "preview" ? "Préparation de l’aperçu…" : "Préparer l’aperçu"}</Button><p>L’aperçu ne publie aucun message.</p></div>}
      </form>
      {preview && <section className="community-announcement-preview" aria-labelledby={`${id}-preview-title`}>
        <h4 id={`${id}-preview-title`} ref={previewRef} tabIndex={-1}>Aperçu de l’annonce</h4>
        <ul className="community-announcement-targets">{preview.destinations.map(item => <li key={item.guildId}><strong>{item.guildName || item.guildId}</strong> · #{item.channelName || item.channelId}</li>)}</ul>
        <p className="community-announcement-help">Texte exact à publier. La mise en forme Markdown sera appliquée dans Discord.</p><pre>{preview.content}</pre>
        <div className="community-announcement-actions"><Button type="button" icon={busy === "publish" ? Loader2 : Send} onClick={publish} disabled={loading || Boolean(busy) || !configured}>{busy === "publish" ? "Publication…" : result ? "Reprendre les envois sur Discord" : "Publier sur Discord"}</Button><p>{result ? "Seuls les envois en attente ou en échec seront tentés. Les messages déjà envoyés ou à vérifier ne sont pas renvoyés." : `Cette action publie dans les ${preview.destinations.length === 1 ? "serveur et salon indiqués" : `${preview.destinations.length} serveurs indiqués`}.`}</p></div>
      </section>}
      {result && <div ref={resultRef} tabIndex={-1} role="status" className={`community-announcement-notice ${result.status === "sent" ? "is-success" : "is-uncertain"}`}>
        <strong>{result.status === "sent" ? "Annonce publiée sur tous les serveurs sélectionnés." : result.status === "failed" ? "Les envois ont échoué." : "Publication à compléter ou à vérifier."}</strong>
        <p>Identifiant : {result.reference}</p><ResultsList results={result.results} />
        <div className="community-announcement-actions">
          {result.results.some(item => ["sending", "uncertain"].includes(item.status)) && <Button type="button" variant="ghost" icon={busy === "recover" ? Loader2 : RefreshCw} onClick={() => recover(result.reference)} disabled={loading || Boolean(busy)}>Vérifier le résultat</Button>}
          {result.results.some(item => ["failed", "queued"].includes(item.status)) && !preview && <Button type="button" variant="ghost" icon={Eye} onClick={() => preparePreview(null, true)} disabled={loading || Boolean(busy) || !configured}>Préparer la reprise des envois</Button>}
          {!pendingResult(result) && <Button type="button" variant="ghost" icon={Plus} onClick={startNew} disabled={Boolean(busy)}>Nouvelle annonce</Button>}
        </div>
      </div>}
      <details className="community-announcement-history"><summary>Derniers envois · {Math.min(data.announcements.length, 20)}</summary>
        {data.announcements.length ? <ol>{data.announcements.slice(0, 20).map(item => {
          const [label, tone] = STATUS_LABELS[item.status] || ["État inconnu", "slate"];
          const guild = data.guilds.find(value => value.id === item.guildId);
          const name = guild?.channels.find(value => value.id === item.channelId)?.name;
          const checking = checkingReference === `${item.reference}:${item.guildId}`;
          return <li key={item.id || `${item.reference}:${item.guildId}`}><div><strong>{item.reference}</strong><p>{item.guildName || guild?.name || `Serveur ${item.guildId}`} · #{item.channelName || name || item.channelId}</p><p><time dateTime={item.createdAt || undefined}>{announcementDate(item.createdAt)}</time></p><DiscordLink href={item.messageUrl}>Voir le message Discord</DiscordLink>{["uncertain", "sending"].includes(item.status) && <div className="community-announcement-actions"><Button type="button" variant="ghost" icon={checking ? Loader2 : RefreshCw} onClick={() => recover(item.reference, item.guildId)} disabled={loading || Boolean(busy)} aria-label={`Vérifier ${item.reference} sur ${item.guildName || guild?.name || item.guildId}`}>{checking ? "Vérification…" : "Vérifier cet envoi"}</Button></div>}{["queued", "failed"].includes(item.status) && <div className="community-announcement-actions"><Button type="button" variant="ghost" icon={RefreshCw} onClick={() => restore(item.reference)} disabled={loading || Boolean(busy) || Boolean(content.trim()) || Boolean(result)}>Reprendre cette annonce</Button>{(content.trim() || result) && <p className="community-announcement-help">Termine ou vide le brouillon en cours avant de reprendre cette annonce.</p>}</div>}</div><Badge tone={tone}>{label}</Badge></li>;
        })}</ol> : <p className="community-announcement-help">Aucune annonce enregistrée.</p>}
      </details>
    </>}
  </section></Surface>;
}
