import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, PageHeader, SelectInput, Surface, TextInput } from "../../components/ui/Core.jsx";
import { ModalDialog } from "../../components/ui/ModalDialog.jsx";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { CALENDAR_NETWORKS, CALENDAR_STATUSES, calendarCsv, calendarDate, calendarDayKey, calendarRange, formatCalendarTimestamp, moveCalendarAnchor, publicationNeedsCheck, safeCalendarUrl, sourceFreshness } from "../../utils/social-calendar.js";
import "./social-calendar.css";

const VIEW_OPTIONS = ["week", "month", "list"];
const VIEW_LABELS = { week: "Semaine", month: "Mois", list: "Liste" };
const SOURCE_LABELS = { automatic: "Synchronisation automatique", stale: "Synchronisation à vérifier", error: "Synchronisation interrompue", confirmed: "Confirmation manuelle", manual: "Suivi manuel" };

function PostCard({ post, locale, onOpen }) {
  const status = CALENDAR_STATUSES[post.status] || CALENDAR_STATUSES.needs_check;
  return <button type="button" className="nxt5-social-post" data-network={post.network} onClick={event => onOpen(post, event.currentTarget)} aria-label={t("Ouvrir la publication : {0}", [post.title || t("Sans titre")])}>
    <span className="nxt5-social-post-meta"><span>{CALENDAR_NETWORKS[post.network] || post.network}</span><time dateTime={post.scheduledAt || undefined}>{post.scheduledAt ? formatCalendarTimestamp(post.scheduledAt, locale, { timeOnly: true }) : t("Sans date")}</time></span>
    <strong>{post.title || t("Sans titre")}</strong>
    {post.format && <span className="nxt5-social-post-format">{post.format}</span>}
    <Badge tone={status.tone}>{t(status.label)}</Badge>
  </button>;
}

function SourceStatus({ source, locale, now }) {
  const freshness = sourceFreshness(source, now);
  return <li className="nxt5-social-source">
    <div><strong>{source.label}</strong><Badge tone={freshness === "automatic" ? "green" : ["error", "stale"].includes(freshness) ? "yellow" : "slate"}>{t(SOURCE_LABELS[freshness])}</Badge></div>
    <p>{source.detail}</p>
    <p className="nxt5-social-source-time">{source.lastSuccessAt ? t("Dernière vérification : {0}", [formatCalendarTimestamp(source.lastSuccessAt, locale)]) : t("Aucune vérification disponible")}</p>
    {source.error && <p className="nxt5-social-source-error"><AlertTriangle size={16} aria-hidden="true" />{source.error}</p>}
  </li>;
}

export default function SocialCalendar() {
  useLanguage();
  const locale = getLocale();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => calendarDayKey(new Date()));
  const [network, setNetwork] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const returnFocusRef = useRef(null);
  const now = Date.now();

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    apiFetch("social-calendar", { signal: controller.signal }).then(result => {
      if (!current) return;
      if (!Array.isArray(result?.posts) || !Array.isArray(result?.sources)) throw new Error(t("Le calendrier a reçu une réponse inattendue."));
      setPayload(result);
      setError("");
    }).catch(reason => {
      if (!current) return;
      if ([401, 403].includes(reason.status)) { setPayload(null); setSelected(null); }
      setError(reason.message || t("Impossible de charger le calendrier."));
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [reload]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== "hidden") setReload(value => value + 1); };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const posts = payload?.posts || [];
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase(locale);
    return posts.filter(post => (network === "all" || post.network === network) && (statusFilter === "all" || post.status === statusFilter) && (!search || `${post.title || ""} ${post.body || ""} ${post.format || ""}`.toLocaleLowerCase(locale).includes(search)))
      .sort((left, right) => String(left.scheduledAt || "9999").localeCompare(String(right.scheduledAt || "9999")) || String(left.id).localeCompare(String(right.id)));
  }, [posts, network, statusFilter, query, locale]);
  const days = useMemo(() => calendarRange(anchor, view), [anchor, view]);
  const daysSet = useMemo(() => new Set(days), [days]);
  const visible = view === "list" ? filtered : filtered.filter(post => !calendarDayKey(post.scheduledAt) || daysSet.has(calendarDayKey(post.scheduledAt)));
  const undated = filtered.filter(post => !calendarDayKey(post.scheduledAt));
  const groups = new Map();
  for (const post of filtered) {
    const key = calendarDayKey(post.scheduledAt);
    if (key) groups.set(key, [...(groups.get(key) || []), post]);
  }
  const today = calendarDayKey(new Date());
  const month = anchor.slice(0, 7);
  const period = view === "month" ? new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(calendarDate(anchor)) : `${formatCalendarTimestamp(days[0], locale)} – ${formatCalendarTimestamp(days.at(-1), locale)}`;
  const scheduledCount = posts.filter(post => post.status === "scheduled").length;
  const needsCheckCount = posts.filter(post => post.status === "needs_check" || post.status === "error" || publicationNeedsCheck(post, now)).length;
  const sourceWarning = payload?.sources.some(source => ["stale", "error"].includes(sourceFreshness(source, now)));
  const openPost = (post, trigger) => { returnFocusRef.current = trigger; setSelected(post.id); };
  const selectedPost = posts.find(post => post.id === selected);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([calendarCsv(visible)], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nxt5-publications-${anchor}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="nxt5-social-calendar" aria-label={t("Calendrier des publications")}>
    <PageHeader eyebrow={t("Tes réseaux")} title={t("Calendrier des publications")} subtitle={t("Retrouve les contenus NXT5 et leurs dernières confirmations, en heure de Paris.")}>
      <Button type="button" variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={() => setReload(value => value + 1)}>{loading ? t("Chargement…") : t("Actualiser")}</Button>
      <Button type="button" variant="ghost" icon={Download} disabled={!visible.length} onClick={exportCsv}>{t("Exporter la vue")}</Button>
    </PageHeader>

    {error && <div role="alert" className="nxt5-social-error"><AlertTriangle size={20} aria-hidden="true" /><div><strong>{t("Le calendrier n’a pas pu être actualisé")}</strong><p>{error}</p>{payload && <p>{t("Les dernières données reçues restent affichées.")}</p>}</div></div>}

    {!payload && loading ? <Surface className="nxt5-social-loading"><Loader2 size={22} aria-hidden="true" className="animate-spin" /><p role="status">{t("Chargement des publications…")}</p></Surface> : payload && <>
      <Surface className="nxt5-social-overview">
        <div className="nxt5-social-summary"><p><strong>{posts.length}</strong><span>{t("contenus suivis")}</span></p><p><strong>{scheduledCount}</strong><span>{t("programmés")}</span></p><p><strong>{needsCheckCount}</strong><span>{t("à vérifier")}</span><span className="nxt5-social-summary-note">{t("Horaire passé ou confirmation manquante")}</span></p></div>
        <details className="nxt5-social-sources" data-warning={sourceWarning || undefined}><summary><RefreshCw size={17} aria-hidden="true" /><span>{sourceWarning ? t("Sources à vérifier") : t("Sources et synchronisation")}</span><ChevronRight size={17} aria-hidden="true" /></summary><p className="nxt5-social-source-intro">{t("Les sources automatiques sont synchronisées côté serveur. Les confirmations manuelles restent datées.")}</p><ul>{payload.sources.map(source => <SourceStatus key={source.id} source={source} locale={locale} now={now} />)}</ul></details>
      </Surface>

      <Surface className="nxt5-social-controls">
        <div className="nxt5-social-filters">
          <TextInput label={t("Rechercher un contenu")} value={query} onChange={setQuery} placeholder={t("Titre, texte, format…")} icon={Search} type="search" />
          <SelectInput label={t("Réseau")} value={network} onChange={setNetwork}><option value="all">{t("Tous les réseaux")}</option>{Object.entries(CALENDAR_NETWORKS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</SelectInput>
          <SelectInput label={t("Statut")} value={statusFilter} onChange={setStatusFilter}><option value="all">{t("Tous les statuts")}</option>{Object.entries(CALENDAR_STATUSES).map(([id, info]) => <option value={id} key={id}>{t(info.label)}</option>)}</SelectInput>
        </div>
        <div className="nxt5-social-toolbar">
          <div className="nxt5-social-views" role="group" aria-label={t("Vue du calendrier")}>{VIEW_OPTIONS.map(id => <Button type="button" variant="ghost" key={id} aria-pressed={view === id} onClick={() => setView(id)}>{t(VIEW_LABELS[id])}</Button>)}</div>
          {view !== "list" && <div className="nxt5-social-period-actions"><Button type="button" variant="ghost" icon={ChevronLeft} aria-label={t("Période précédente")} onClick={() => setAnchor(value => moveCalendarAnchor(value, view, -1))} /><Button type="button" variant="ghost" onClick={() => setAnchor(today)}>{t("Aujourd’hui")}</Button><Button type="button" variant="ghost" icon={ChevronRight} aria-label={t("Période suivante")} onClick={() => setAnchor(value => moveCalendarAnchor(value, view, 1))} /></div>}
        </div>
      </Surface>

      <div className="nxt5-social-results-heading"><h3>{view === "list" ? t("Toutes les publications") : period}</h3><p aria-live="polite">{t("{0} contenus affichés", [visible.length])}</p></div>
      {view === "list" ? <div className="nxt5-social-agenda">{[...groups].map(([day, dayPosts]) => <section key={day} className="nxt5-social-agenda-day"><h4><time dateTime={day}>{formatCalendarTimestamp(day, locale, { dayOnly: true })}</time></h4><div>{dayPosts.map(post => <PostCard key={post.id} post={post} locale={locale} onOpen={openPost} />)}</div></section>)}</div> : <>
        <div className="nxt5-social-grid" data-view={view} aria-label={t("Publications par jour")}>
          <div className="nxt5-social-weekdays" aria-hidden="true">{days.slice(0, 7).map(day => <span key={day}>{new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }).format(calendarDate(day))}</span>)}</div>
          {days.map(day => <section key={day} className={`nxt5-social-day${day === today ? " is-today" : ""}${view === "month" && !day.startsWith(month) ? " is-outside" : ""}`}>
            <h4><time dateTime={day}><span className="nxt5-social-day-number">{Number(day.slice(-2))}</span><span className="nxt5-social-day-full">{formatCalendarTimestamp(day, locale, { dayOnly: true })}</span></time>{day === today && <span>{t("Aujourd’hui")}</span>}</h4>
            <div>{(groups.get(day) || []).map(post => <PostCard key={post.id} post={post} locale={locale} onOpen={openPost} />)}</div>
            {!groups.has(day) && <p className="nxt5-social-day-empty">{t("Aucune publication")}</p>}
          </section>)}
        </div>
        {!visible.some(post => calendarDayKey(post.scheduledAt)) && <p className="nxt5-social-empty">{t("Aucune publication datée pour cette période et ces filtres.")}</p>}
      </>}
      {undated.length > 0 && <section className="nxt5-social-undated"><h3>{t("Sans date confirmée")}</h3><p>{t("Ces contenus restent disponibles, sans créneau de publication confirmé.")}</p><div>{undated.map(post => <PostCard key={post.id} post={post} locale={locale} onOpen={openPost} />)}</div></section>}
      {view === "list" && !visible.length && <Surface className="nxt5-social-empty"><CalendarDays size={28} aria-hidden="true" /><p>{t("Aucun contenu ne correspond à ces filtres.")}</p></Surface>}
      <p className="nxt5-social-footnote"><ShieldCheck size={16} aria-hidden="true" />{t("Espace privé de ton compte NXT5. Un horaire passé ne confirme pas une publication.")}</p>
    </>}

    {selectedPost && <ModalDialog onClose={() => setSelected(null)} returnFocusRef={returnFocusRef} aria-labelledby="social-calendar-detail-title" className="nxt5-social-detail">
      <div className="nxt5-social-detail-heading"><Badge tone="purple">{CALENDAR_NETWORKS[selectedPost.network] || selectedPost.network}</Badge><Button type="button" variant="ghost" onClick={() => setSelected(null)}>{t("Fermer")}</Button></div>
      <h2 id="social-calendar-detail-title">{selectedPost.title || t("Sans titre")}</h2>
      <dl><div><dt>{t("Statut")}</dt><dd>{t((CALENDAR_STATUSES[selectedPost.status] || CALENDAR_STATUSES.needs_check).label)}</dd></div><div><dt>{t("Publication prévue")}</dt><dd>{selectedPost.scheduledAt ? formatCalendarTimestamp(selectedPost.scheduledAt, locale) : t("Sans date confirmée")}</dd></div><div><dt>{t("Format")}</dt><dd>{selectedPost.format || t("Non renseigné")}</dd></div><div><dt>{t("Dernière vérification")}</dt><dd>{selectedPost.verifiedAt ? formatCalendarTimestamp(selectedPost.verifiedAt, locale) : t("Aucune vérification disponible")}</dd></div></dl>
      {publicationNeedsCheck(selectedPost, now) && <p className="nxt5-social-detail-warning"><AlertTriangle size={18} aria-hidden="true" />{t("L’horaire est passé : la publication doit être vérifiée auprès du réseau.")}</p>}
      {selectedPost.body && <div className="nxt5-social-detail-body">{selectedPost.body}</div>}
      {selectedPost.origin && <p className="nxt5-social-detail-origin">{selectedPost.origin}</p>}
      <div className="nxt5-social-detail-links">{safeCalendarUrl(selectedPost.url) && <a href={safeCalendarUrl(selectedPost.url)} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} aria-hidden="true" />{t("Voir la publication (nouvel onglet)")}</a>}{safeCalendarUrl(selectedPost.plannerUrl) && <a href={safeCalendarUrl(selectedPost.plannerUrl)} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} aria-hidden="true" />{t("Ouvrir le planificateur (nouvel onglet)")}</a>}</div>
    </ModalDialog>}
  </section>;
}
