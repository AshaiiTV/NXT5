import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Clock3, Handshake, Loader2, Megaphone, RefreshCw, Search, Send, Swords, Trash2, Trophy, Users, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { errorToast } from "../../app/helpers.js";
import { TeamAvatar } from "../../components/brand/BrandAssets.jsx";
import { Badge, Button, EmptyState, PageHeader, SelectInput, SkeletonRows, Surface, TabNav, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import "./scrim-finder.css";

export const SCRIM_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master"];
export const SCRIM_FORMATS = ["1", "2", "3", "4", "5", "bo3", "bo5"];
const TIER_LABELS = { iron: "Fer", bronze: "Bronze", silver: "Argent", gold: "Or", platinum: "Platine", emerald: "Émeraude", diamond: "Diamant", master: "Maître et plus" };
const STATUS_TONES = { open: "cyan", matched: "green", cancelled: "slate", pending: "yellow", accepted: "green", declined: "slate", withdrawn: "slate" };
const STATUS_LABELS = { open: "Ouverte", matched: "Confirmée", cancelled: "Annulée", pending: "En attente", accepted: "Acceptée", declined: "Refusée", withdrawn: "Retirée" };
const TABS = [
  { id: "find", label: "Trouver un adversaire", icon: Search },
  { id: "mine", label: "Mes scrims", icon: Megaphone },
];

export function tierLabel(tier) { return t(TIER_LABELS[tier] || tier); }
export function formatLabel(format) {
  if (format === "bo3" || format === "bo5") return format.toUpperCase();
  const games = Number(format);
  return Number.isInteger(games) ? t("{0} game(s)", [games]) : String(format || "");
}
export function levelRange(offer) {
  return offer.levelMin === offer.levelMax ? tierLabel(offer.levelMin) : t("{0} à {1}", [tierLabel(offer.levelMin), tierLabel(offer.levelMax)]);
}
export function formatSlot(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(getLocale(), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
function slotParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "", time: "" };
  return { day: date.toLocaleDateString(getLocale(), { weekday: "long", day: "numeric", month: "long" }), time: date.toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" }) };
}
function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(21, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScrimOfferForm({ onSubmit, busy }) {
  useLanguage();
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [format, setFormat] = useState("3");
  const [levelMin, setLevelMin] = useState("emerald");
  const [levelMax, setLevelMax] = useState("diamond");
  const [note, setNote] = useState("");
  const invalidRange = SCRIM_TIERS.indexOf(levelMin) > SCRIM_TIERS.indexOf(levelMax);
  return <form className="scrim-form" onSubmit={(event) => {
    event.preventDefault();
    if (invalidRange || busy) return;
    const starts = new Date(startsAt);
    onSubmit({ startsAt: starts.toISOString(), format, levelMin, levelMax, note: note.trim() }).then((ok) => { if (ok) setNote(""); });
  }}>
    <TextInput label="Date et heure" type="datetime-local" value={startsAt} onChange={setStartsAt} required icon={CalendarClock} />
    <SelectInput label="Nombre de games" value={format} onChange={setFormat}>{SCRIM_FORMATS.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</SelectInput>
    <SelectInput label="Niveau minimum" value={levelMin} onChange={setLevelMin}>{SCRIM_TIERS.map((tier) => <option key={tier} value={tier}>{tierLabel(tier)}</option>)}</SelectInput>
    <SelectInput label="Niveau maximum" value={levelMax} onChange={setLevelMax}>{SCRIM_TIERS.map((tier) => <option key={tier} value={tier}>{tierLabel(tier)}</option>)}</SelectInput>
    <div className="scrim-form-note"><TextAreaInput label="Précisions (facultatif)" value={note} onChange={setNote} rows={2} maxLength={500} placeholder={t("Draft classique, Discord vocal de ton côté, contact du coach…")} /></div>
    <div className="scrim-form-actions">
      {invalidRange ? <p role="alert" className="scrim-form-error">{t("Le niveau minimum dépasse le niveau maximum.")}</p> : <p>{t("Les autres équipes NXT5 verront le nom de ton équipe, le créneau et le niveau. Le reste du planning reste privé.")}</p>}
      <Button type="submit" icon={busy ? Loader2 : Megaphone} disabled={busy || invalidRange}>{t("Publier la proposition")}</Button>
    </div>
  </form>;
}

function TeamIdentity({ team, name, tag, size = "h-14 w-14" }) {
  useLanguage();
  return <div className="scrim-team">
    <TeamAvatar team={team || { name, tag }} className={`${size} scrim-team-avatar`} />
    <div className="scrim-team-copy"><strong>{name}</strong>{tag ? <span className="scrim-tag">{tag}</span> : null}</div>
  </div>;
}

function OfferCard({ offer, children, highlight = false, opponent = null }) {
  useLanguage();
  const slot = slotParts(offer.startsAt);
  return <Surface className={highlight ? "scrim-card scrim-card-matched" : "scrim-card"} glow={highlight}>
    <div className="scrim-card-head">
      <TeamIdentity team={offer.team} name={offer.teamName} tag={offer.teamTag} />
      {opponent && <div className="scrim-versus" aria-hidden="true"><Swords /></div>}
      {opponent && <TeamIdentity team={opponent.team} name={opponent.name} tag={opponent.tag} />}
      <Badge tone={STATUS_TONES[offer.status] || "slate"} className="scrim-status">{t(STATUS_LABELS[offer.status] || offer.status)}</Badge>
    </div>
    <div className="scrim-slot">
      <div className="scrim-slot-time"><Clock3 aria-hidden="true" /><strong>{slot.time}</strong></div>
      <div className="scrim-slot-day">{slot.day}</div>
      <div className="scrim-pills">
        <span className="scrim-pill scrim-pill-format"><Trophy aria-hidden="true" />{formatLabel(offer.format || String(offer.games))}</span>
        <span className="scrim-pill">{levelRange(offer)}</span>
      </div>
    </div>
    {offer.note ? <p className="scrim-note">{offer.note}</p> : null}
    {children}
  </Surface>;
}

export function ScrimFinder({ data, selectedTeamId, currentMember, user, pushToast, refreshAll }) {
  useLanguage();
  const [state, setState] = useState({ loading: true, error: "", result: null, teamId: null });
  const [tab, setTab] = useState("find");
  const [busy, setBusy] = useState("");
  const [replyFor, setReplyFor] = useState("");
  const [reply, setReply] = useState("");
  const team = (data?.teams || []).find((item) => item.id === selectedTeamId) || null;

  const load = useCallback(async (signal) => {
    if (!selectedTeamId) return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await apiFetch(`scrims-manage?teamId=${encodeURIComponent(selectedTeamId)}`, { signal });
      if (!signal?.aborted) setState({ loading: false, error: "", result, teamId: selectedTeamId });
    } catch (err) {
      if (!signal?.aborted) setState({ loading: false, error: err?.message || t("Chargement impossible. Réessaie."), result: null, teamId: selectedTeamId });
    }
  }, [selectedTeamId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const result = state.teamId === selectedTeamId ? state.result : null;
  const canManage = Boolean(result?.canManage);
  const open = useMemo(() => result?.offers || [], [result]);
  const mine = useMemo(() => (result?.mine || []).filter((offer) => offer.status === "open"), [result]);
  const answered = useMemo(() => (result?.requests || []).filter((request) => request.status === "pending" || request.status === "declined"), [result]);
  const matched = useMemo(() => [...(result?.matched || []), ...(result?.mine || []).filter((offer) => offer.status === "matched")].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)), [result]);
  const pendingForMe = mine.reduce((total, offer) => total + (offer.requests || []).filter((request) => request.status === "pending").length, 0);
  const tabs = TABS.map((item) => ({ ...item, meta: item.id === "find" ? open.length : (mine.length + matched.length) || undefined }));

  async function act(key, body, success) {
    if (busy) return false;
    setBusy(key);
    try {
      await apiFetch("scrims-manage", { method: "POST", body: JSON.stringify({ teamId: selectedTeamId, ...body }) });
      if (success) pushToast?.({ type: "green", title: success[0], text: success[1] });
      await load();
      // A confirmation created planning sessions: the shared planning data must follow.
      if (body.action === "accept") await refreshAll?.().catch(() => {});
      return true;
    } catch (err) {
      pushToast?.(errorToast(err, t("Action impossible")));
      return false;
    } finally {
      setBusy("");
    }
  }

  if (!selectedTeamId) {
    return <div className="space-y-4"><PageHeader eyebrow={t("Équipe")} title={t("Scrims")} subtitle={t("Trouve un adversaire parmi les équipes NXT5.")} /><Surface><EmptyState icon={Users} title={t("Rejoins ou crée une équipe")} text={t("Les propositions de scrim sont publiées au nom d’une équipe.")} /></Surface></div>;
  }

  const findPanel = <div id="scrim-panel" role="tabpanel" aria-labelledby="scrim-tab-find" className="scrim-section">
    {state.loading && !result ? <div role="status" aria-label={t("Chargement des scrims")}><SkeletonRows count={3} /></div>
      : !open.length ? <Surface className="scrim-card"><EmptyState icon={Handshake} title={t("Aucune proposition ouverte pour le moment")} text={t("Publie la tienne : les équipes qui cherchent un adversaire la verront ici.")} action={canManage ? <Button icon={Megaphone} onClick={() => setTab("mine")}>{t("Proposer un scrim")}</Button> : null} /></Surface>
      : <div className="scrim-list">{open.map((offer) => <OfferCard key={offer.id} offer={offer}>
        {offer.myRequest?.status === "pending" ? <div className="scrim-actions">
          <Badge tone="yellow">{t("Réponse envoyée")}</Badge>
          {canManage && <Button variant="ghost" icon={X} disabled={Boolean(busy)} onClick={() => act(offer.id, { action: "withdraw", requestId: offer.myRequest.id })}>{t("Retirer ma réponse")}</Button>}
        </div> : replyFor === offer.id ? <form className="scrim-reply" onSubmit={(event) => { event.preventDefault(); act(offer.id, { action: "respond", offerId: offer.id, message: reply.trim() }, [t("Réponse envoyée"), t("Le staff de {0} peut maintenant confirmer.", [offer.teamName])]).then((ok) => { if (ok) { setReplyFor(""); setReply(""); } }); }}>
          <TextAreaInput label="Message pour l’équipe" value={reply} onChange={setReply} rows={2} maxLength={300} placeholder={t("Vos disponibilités exactes, votre niveau, un contact Discord…")} />
          <div className="scrim-actions"><Button type="submit" icon={busy === offer.id ? Loader2 : Send} disabled={Boolean(busy)}>{t("Envoyer la réponse")}</Button><Button type="button" variant="ghost" onClick={() => setReplyFor("")}>{t("Annuler")}</Button></div>
        </form> : <div className="scrim-actions">
          {offer.requestCount > 0 && <span className="scrim-count">{t("{0} équipe(s) déjà intéressée(s)", [offer.requestCount])}</span>}
          {canManage && <Button icon={Send} disabled={Boolean(busy)} onClick={() => { setReplyFor(offer.id); setReply(""); }}>{t("Répondre")}</Button>}
        </div>}
      </OfferCard>)}</div>}
  </div>;

  const minePanel = <div id="scrim-panel" role="tabpanel" aria-labelledby="scrim-tab-mine" className="scrim-section">
    {canManage ? <Surface className="scrim-card" glow>
      <div className="scrim-section-head"><Megaphone aria-hidden="true" /><div><h3>{t("Proposer un scrim")}</h3><p>{t("Au nom de {0}. Les équipes intéressées répondent ici, puis tu confirmes l’une d’elles.", [team?.name || t("ton équipe")])}</p></div></div>
      <ScrimOfferForm busy={busy === "create"} onSubmit={(body) => act("create", { action: "create", ...body }, [t("Proposition publiée"), t("Les autres équipes NXT5 peuvent maintenant répondre.")])} />
    </Surface> : result && <Surface className="scrim-card"><p className="scrim-hint">{t("Seul le staff de l’équipe publie et confirme les scrims. Tu peux consulter les propositions et prévenir ton capitaine.")}</p></Surface>}

    {matched.length > 0 && <section aria-label={t("Scrims confirmés")} className="scrim-section">
      <h3 className="scrim-section-title"><Check aria-hidden="true" />{t("Scrims confirmés")}</h3>
      <div className="scrim-list">{matched.map((offer) => {
        const accepted = (offer.requests || []).find((request) => request.status === "accepted");
        const opponent = offer.mine ? (accepted ? { team: accepted.team, name: accepted.teamName, tag: accepted.teamTag } : { name: offer.matchedTeamName || "—" }) : { team: team, name: team?.name || "", tag: team?.tag };
        return <OfferCard key={offer.id} offer={offer} highlight opponent={opponent}>
          <p className="scrim-matched">{t("La séance est dans vos deux plannings.")}</p>
          {accepted?.message ? <p className="scrim-note">{t("Réponse de {0} :", [accepted.teamName])} {accepted.message}</p> : null}
        </OfferCard>;
      })}</div>
    </section>}

    {mine.length > 0 && <section aria-label={t("Mes propositions")} className="scrim-section">
      <h3 className="scrim-section-title"><Megaphone aria-hidden="true" />{t("Mes propositions")}{pendingForMe > 0 && <Badge tone="yellow">{t("{0} réponse(s) à traiter", [pendingForMe])}</Badge>}</h3>
      <div className="scrim-list">{mine.map((offer) => <OfferCard key={offer.id} offer={offer}>
        {offer.requests?.filter((request) => request.status === "pending").length ? <ul className="scrim-requests">{offer.requests.filter((request) => request.status === "pending").map((request) => <li key={request.id}>
          <div className="scrim-request-team"><TeamIdentity team={request.team} name={request.teamName} tag={request.teamTag} size="h-10 w-10" />{request.message ? <p>{request.message}</p> : null}</div>
          {canManage && <div className="scrim-actions">
            <Button icon={busy === request.id ? Loader2 : Check} disabled={Boolean(busy)} onClick={() => act(request.id, { action: "accept", requestId: request.id, expectedRevision: offer.revision }, [t("Scrim confirmé"), t("La séance est ajoutée au planning des deux équipes.")])}>{t("Confirmer")}</Button>
            <Button variant="ghost" icon={X} disabled={Boolean(busy)} onClick={() => act(request.id, { action: "decline", requestId: request.id })}>{t("Refuser")}</Button>
          </div>}
        </li>)}</ul> : <p className="scrim-hint">{t("Aucune réponse pour l’instant.")}</p>}
        {canManage && <div className="scrim-actions scrim-actions-end"><Button variant="ghost" icon={Trash2} disabled={Boolean(busy)} onClick={() => act(offer.id, { action: "cancel", offerId: offer.id })}>{t("Annuler la proposition")}</Button></div>}
      </OfferCard>)}</div>
    </section>}

    {answered.length > 0 && <section aria-label={t("Mes réponses")} className="scrim-section">
      <h3 className="scrim-section-title"><Send aria-hidden="true" />{t("Mes réponses")}</h3>
      <ul className="scrim-requests">{answered.map((request) => {
        const offer = open.find((item) => item.id === request.offerId);
        return <li key={request.id}>
          <div className="scrim-request-team">{offer ? <TeamIdentity team={offer.team} name={offer.teamName} tag={offer.teamTag} size="h-10 w-10" /> : <strong>{t("Proposition fermée")}</strong>}<p>{offer ? formatSlot(offer.startsAt) : ""}{request.message ? ` · ${request.message}` : ""}</p></div>
          <div className="scrim-actions"><Badge tone={STATUS_TONES[request.status] || "slate"}>{t(STATUS_LABELS[request.status] || request.status)}</Badge>{canManage && request.status === "pending" && <Button variant="ghost" icon={X} disabled={Boolean(busy)} onClick={() => act(request.id, { action: "withdraw", requestId: request.id })}>{t("Retirer")}</Button>}</div>
        </li>;
      })}</ul>
    </section>}

    {result && !mine.length && !matched.length && !answered.length && <Surface className="scrim-card"><EmptyState icon={Handshake} title={t("Aucun scrim en cours pour ton équipe")} text={t("Publie une proposition ou réponds à une équipe dans Trouver un adversaire.")} /></Surface>}
  </div>;

  return <div className="space-y-4 scrim-page">
    <PageHeader eyebrow={t("Équipe")} title={t("Scrims")} subtitle={t("Publie un créneau, réponds aux propositions des autres équipes NXT5 et confirme : la séance arrive dans les deux plannings.")}>
      <Button variant="ghost" icon={state.loading ? Loader2 : RefreshCw} disabled={state.loading} onClick={() => load()}>{t("Actualiser")}</Button>
    </PageHeader>
    {state.error && <Surface className="scrim-card"><div role="alert" className="scrim-error"><p>{state.error}</p><Button variant="ghost" icon={RefreshCw} onClick={() => load()}>{t("Réessayer")}</Button></div></Surface>}
    <TabNav items={tabs} activeId={tab} onChange={setTab} label="Rubriques des scrims" idPrefix="scrim" panelId="scrim-panel" />
    {tab === "find" ? findPanel : minePanel}
  </div>;
}

export default ScrimFinder;
