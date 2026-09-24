import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ExternalLink, Eye, Loader2, Megaphone, Plus, RefreshCw, Send } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { useAdminNavigationGuard } from "../../components/admin/AdminNavigationContext.jsx";
import { Badge, Button, SelectInput, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import "./community-announcements.css";

const ENDPOINT = "admin-discord-announcements";
const MAX_CONTENT = 4096;
const STATUS_LABELS = { sent: ["Envoyée", "green"], uncertain: ["À vérifier", "yellow"], sending: ["Envoi en cours", "cyan"], failed: ["Échec", "red"] };

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

function messageHref(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "discord.com" && /^\/channels\/\d+\/\d+\/\d+$/.test(url.pathname) ? url.href : "";
  } catch { return ""; }
}

function MessageLink({ href }) {
  const safeHref = messageHref(href);
  return safeHref ? <a className="community-announcement-link" href={safeHref} target="_blank" rel="noopener noreferrer">Voir le message Discord<ExternalLink size={15} aria-hidden="true" /><span className="sr-only"> (nouvel onglet)</span></a> : null;
}

function validData(value) {
  return value && Array.isArray(value.channels) && Array.isArray(value.announcements)
    && (value.guild === null || typeof value.guild?.id === "string")
    && (value.channelId === null || typeof value.channelId === "string");
}

export default function CommunityAnnouncementsPanel() {
  const id = useId();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [channelId, setChannelId] = useState("");
  const [reference, setReference] = useState(newReference);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [checkingReference, setCheckingReference] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const request = useRef(null);
  const savedChannel = useRef(null);
  const revision = useRef(0);
  const mutation = useRef(false);
  const attempt = useRef(null);
  const previewRef = useRef(null);
  const resultRef = useRef(null);

  const clearAccess = useCallback(() => {
    setData(null);
    setPreview(null);
    setResult(null);
    savedChannel.current = null;
    attempt.current = null;
  }, []);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadError("");
    try {
      const next = await apiFetch(ENDPOINT, { signal: controller.signal });
      if (!validData(next)) throw new Error("Les informations des annonces sont incomplètes. Actualise les salons pour réessayer.");
      if (!mounted.current || controller.signal.aborted) return;
      const previousChannel = savedChannel.current;
      const nextChannel = next.channelId || "";
      setChannelId(current => previousChannel === null || current === previousChannel ? nextChannel : current);
      savedChannel.current = nextChannel;
      setData(next);
      if (previousChannel !== null && previousChannel !== nextChannel) {
        revision.current += 1;
        setPreview(null);
      }
      const sent = attempt.current && next.announcements.find(item => item.reference === attempt.current.reference && item.status === "sent");
      if (sent) setResult({ status: "sent", reference: sent.reference, messageUrl: sent.messageUrl });
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      setLoadError(failure.message || "Impossible de charger les annonces communautaires.");
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  }, [clearAccess]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => { mounted.current = false; request.current?.abort(); };
  }, [refresh]);

  const locked = busy === "publish" || result?.status === "uncertain" || result?.status === "sent";
  const channel = data?.channels.find(item => item.id === channelId);
  const channelChanged = Boolean(data) && channelId !== (data.channelId || "");
  const configured = Boolean(data?.guild && channelId && channelId === data.channelId && channel?.canSend);
  const validContent = Boolean(reference.trim() && content.trim()) && content.length <= MAX_CONTENT;
  const dirty = channelChanged || Boolean(content.trim() && result?.status !== "sent");
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
    revision.current += 1;
    setPreview(null);
    setError("");
    setNotice("");
    setter(value);
  }

  async function configure() {
    if (mutation.current || loading || locked || !channelChanged || !channel?.canSend) return;
    mutation.current = true;
    setBusy("configure"); setError(""); setNotice(""); setPreview(null);
    const selected = channelId;
    try {
      await apiFetch(ENDPOINT, { method: "POST", body: JSON.stringify({ action: "configure", channelId: selected }) });
      if (!mounted.current) return;
      savedChannel.current = selected;
      setData(current => current ? { ...current, channelId: selected } : current);
      setNotice("Salon d’annonces enregistré. Aucun message n’a été envoyé.");
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      setError(failure.message || "Impossible d’enregistrer le salon.");
    } finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  async function preparePreview(event) {
    event.preventDefault();
    if (mutation.current || loading || locked || !configured || !validContent) return;
    mutation.current = true;
    const currentRevision = revision.current;
    setBusy("preview"); setError(""); setNotice(""); setPreview(null);
    try {
      const next = await apiFetch(ENDPOINT, { method: "POST", body: JSON.stringify({ action: "preview", reference, content }) });
      if (!next?.previewToken || typeof next.content !== "string" || !next.reference || next.channelId !== channelId) throw new Error("L’aperçu est incomplet ou le salon a changé. Actualise les salons, puis prépare un nouvel aperçu.");
      if (mounted.current && currentRevision === revision.current) setPreview(next);
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      if (currentRevision === revision.current) setError(failure.message || "Impossible de préparer l’aperçu.");
    } finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  async function publish() {
    const snapshot = preview;
    if (mutation.current || loading || !snapshot || !configured || locked) return;
    mutation.current = true;
    attempt.current = snapshot;
    setBusy("publish"); setError(""); setNotice("");
    try {
      const next = await apiFetch(ENDPOINT, { method: "POST", body: JSON.stringify({ action: "publish", reference: snapshot.reference, content: snapshot.content, previewToken: snapshot.previewToken }) });
      if (!["sent", "uncertain"].includes(next?.status)) throw new Error("Le résultat de l’envoi n’a pas pu être confirmé.");
      if (!mounted.current) return;
      setResult({ ...next, reference: snapshot.reference });
      setPreview(null);
      refresh();
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      else if (!failure.status || failure.status >= 500) {
        setResult({ status: "uncertain", reference: snapshot.reference });
        setPreview(null);
      } else setPreview(null);
      setError(failure.message || "Impossible de confirmer le résultat de l’envoi.");
    } finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  async function recover(targetReference) {
    if (mutation.current || loading || !targetReference) return;
    mutation.current = true;
    setBusy("recover"); setCheckingReference(targetReference); setError(""); setNotice("");
    try {
      const next = await apiFetch(ENDPOINT, { method: "POST", body: JSON.stringify({ action: "recover", reference: targetReference }) });
      if (!["sent", "uncertain", "failed"].includes(next?.status)) throw new Error("Le résultat de l’envoi n’a pas pu être confirmé.");
      if (!mounted.current) return;
      setData(current => current ? { ...current, announcements: current.announcements.map(item => item.reference === targetReference ? { ...item, ...next, reference: targetReference } : item) } : current);
      if (attempt.current?.reference === targetReference) {
        if (next.status === "failed") {
          setResult(null);
          setPreview(null);
          attempt.current = null;
          setNotice("L’envoi a échoué. Le texte est conservé ; prépare un nouvel aperçu pour réessayer.");
        } else setResult({ ...next, reference: targetReference });
      } else setNotice(next.status === "sent" ? `Envoi confirmé pour ${targetReference}. Le lien est disponible dans l’historique.` : next.status === "failed" ? `Échec confirmé pour ${targetReference}.` : `Le résultat de ${targetReference} reste à vérifier. Aucun nouveau message n’a été envoyé.`);
      refresh();
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403].includes(failure.status)) clearAccess();
      setError(failure.message || "Impossible de vérifier le résultat de l’envoi.");
    } finally { mutation.current = false; if (mounted.current) { setBusy(""); setCheckingReference(""); } }
  }

  function startNew() {
    if (mutation.current || result?.status !== "sent") return;
    revision.current += 1;
    attempt.current = null;
    setReference(newReference()); setContent(""); setPreview(null); setResult(null); setError(""); setNotice("");
  }

  return <Surface className="community-announcements">
    <section aria-labelledby={`${id}-title`}>
      <header className="community-announcements-heading">
        <div><h3 id={`${id}-title`}><Megaphone size={20} aria-hidden="true" />Annonces communautaires</h3><p>Prépare les nouveautés NXT5, vérifie le texte et publie avec le bot sur le serveur communautaire.</p></div>
        <Button type="button" variant="ghost" icon={RefreshCw} onClick={refresh} disabled={loading || Boolean(busy)}>{loading ? "Chargement des salons…" : "Actualiser les salons"}</Button>
      </header>

      {loadError && <div className="community-announcement-notice is-error" role="alert"><strong>{data ? "L’actualisation des annonces a échoué." : "Annonces indisponibles."}</strong><p>{loadError}</p>{data && <p>Les dernières informations restent affichées.</p>}</div>}
      {error && <div className="community-announcement-notice is-error" role="alert">{error}</div>}
      {loading && !data && <p className="community-announcement-help" role="status">Chargement du serveur communautaire et des salons…</p>}

      {data && <>
        {!data.guild ? <p className="community-announcement-notice">Le serveur communautaire n’est pas encore configuré pour le bot. Termine sa configuration, puis actualise les salons.</p> : <>
          <p className="community-announcement-server">Serveur communautaire : <strong>{data.guild.name || data.guild.id}</strong></p>
          <div className="community-announcement-destination">
            <SelectInput label="Salon d’annonces" value={channelId} onChange={value => change(setChannelId, value)} disabled={locked || busy === "configure"} aria-describedby={`${id}-channel-help`}>
              <option value="">Choisir un salon du serveur</option>
              {channelId && !data.channels.some(item => item.id === channelId) && <option value={channelId} disabled>Salon enregistré indisponible</option>}
              {data.channels.map(item => <option key={item.id} value={item.id} disabled={!item.canSend}>#{item.name || item.id}{!item.canSend ? " · Envoi non autorisé" : ""}</option>)}
            </SelectInput>
            <Button type="button" variant="ghost" icon={busy === "configure" ? Loader2 : Check} onClick={configure} disabled={loading || Boolean(busy) || locked || !channelChanged || !channel?.canSend}>{busy === "configure" ? "Enregistrement…" : "Enregistrer le salon"}</Button>
          </div>
          <p className="community-announcement-help" id={`${id}-channel-help`}>{!data.channels.some(item => item.canSend) ? "Aucun salon ne permet l’envoi. Vérifie les autorisations du bot sur le serveur, puis actualise les salons." : channelChanged ? "Enregistre ce salon avant de préparer l’aperçu." : configured ? "Le bot publiera les annonces dans ce salon." : "Choisis un salon dans lequel le bot est autorisé à publier."}</p>
          {notice && <p className="community-announcement-notice" role="status">{notice}</p>}

          <form className="community-announcement-editor" onSubmit={preparePreview}>
            <TextInput label="Identifiant de l’annonce" value={reference} onChange={value => change(setReference, value)} maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,79}" required disabled={locked} aria-describedby={`${id}-reference-help`} />
            <p className="community-announcement-help" id={`${id}-reference-help`}>Conservé lors d’une nouvelle vérification pour éviter les doublons.</p>
            <TextAreaInput label="Texte de l’annonce (Markdown Discord)" value={content} onChange={value => change(setContent, value)} rows={10} maxLength={MAX_CONTENT} required disabled={locked} placeholder="Rédige ou colle ton annonce ici…" aria-describedby={`${id}-content-help`} />
            <div className="community-announcement-editor-meta" id={`${id}-content-help`}><p>Les mentions ne déclenchent aucune notification.</p><span>{content.length} / {MAX_CONTENT} caractères</span></div>
            {!locked && <div className="community-announcement-actions"><Button type="submit" variant={preview ? "ghost" : "primary"} icon={busy === "preview" ? Loader2 : Eye} disabled={loading || Boolean(busy) || !configured || !validContent}>{busy === "preview" ? "Préparation de l’aperçu…" : "Préparer l’aperçu"}</Button><p>L’aperçu ne publie aucun message.</p></div>}
          </form>

          {preview && <section className="community-announcement-preview" aria-labelledby={`${id}-preview-title`}>
            <h4 id={`${id}-preview-title`} ref={previewRef} tabIndex={-1}>Aperçu de l’annonce</h4>
            <p><strong>{preview.guildName || data.guild.name || data.guild.id}</strong> · #{preview.channelName || channel?.name || preview.channelId}</p>
            <p className="community-announcement-help">Texte exact à publier. La mise en forme Markdown sera appliquée dans Discord.</p>
            <pre>{preview.content}</pre>
            <div className="community-announcement-actions"><Button type="button" icon={busy === "publish" ? Loader2 : Send} onClick={() => publish()} disabled={loading || Boolean(busy) || !configured}>{busy === "publish" ? "Publication…" : "Publier sur Discord"}</Button><p>Cette action envoie l’annonce dans le salon indiqué.</p></div>
          </section>}

          {result && <div ref={resultRef} tabIndex={-1} role="status" className={`community-announcement-notice ${result.status === "sent" ? "is-success" : "is-uncertain"}`}>
            <strong>{result.status === "sent" ? "Annonce publiée." : "Résultat de l’envoi à vérifier."}</strong>
            <p>{result.status === "sent" ? `Identifiant : ${result.reference}` : "Le message a peut-être été publié. Vérifie ce même envoi avant de préparer une autre annonce."}</p>
            <MessageLink href={result.messageUrl} />
            <div className="community-announcement-actions">{result.status === "sent" ? <Button type="button" variant="ghost" icon={Plus} onClick={startNew} disabled={Boolean(busy)}>Nouvelle annonce</Button> : <Button type="button" variant="ghost" icon={busy === "recover" ? Loader2 : RefreshCw} onClick={() => recover(result.reference)} disabled={loading || Boolean(busy)}>{busy === "recover" ? "Vérification…" : "Vérifier le résultat"}</Button>}</div>
          </div>}
        </>}

        <details className="community-announcement-history">
          <summary>Dernières annonces · {Math.min(data.announcements.length, 20)}</summary>
          {data.announcements.length ? <ol>{data.announcements.slice(0, 20).map(item => {
            const [label, tone] = STATUS_LABELS[item.status] || ["État inconnu", "slate"];
            const name = data.channels.find(value => value.id === item.channelId)?.name;
            return <li key={item.id || item.reference}><div><strong>{item.reference}</strong><p>{name ? `#${name}` : `Salon ${item.channelId}`} · <time dateTime={item.createdAt || undefined}>{announcementDate(item.createdAt)}</time></p><MessageLink href={item.messageUrl} />{["uncertain", "sending"].includes(item.status) && <div className="community-announcement-actions"><Button type="button" variant="ghost" icon={checkingReference === item.reference ? Loader2 : RefreshCw} onClick={() => recover(item.reference)} disabled={loading || Boolean(busy)} aria-label={`Vérifier le résultat de ${item.reference}`}>{checkingReference === item.reference ? "Vérification…" : "Vérifier cet envoi"}</Button></div>}</div><Badge tone={tone}>{label}</Badge></li>;
          })}</ol> : <p className="community-announcement-help">Aucune annonce enregistrée.</p>}
        </details>
      </>}
    </section>
  </Surface>;
}
