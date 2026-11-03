import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Handshake, Loader2, Megaphone, RefreshCw, Send, Trash2, Users, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { errorToast } from "../../app/helpers.js";
import { Badge, Button, EmptyState, PageHeader, SelectInput, SkeletonRows, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import "./scrim-finder.css";

export const SCRIM_TIERS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master"];
const TIER_LABELS = { iron: "Fer", bronze: "Bronze", silver: "Argent", gold: "Or", platinum: "Platine", emerald: "Émeraude", diamond: "Diamant", master: "Maître et plus" };
const DURATIONS = [60, 90, 120, 150, 180, 240];
const STATUS_TONES = { open: "cyan", matched: "green", cancelled: "slate", pending: "yellow", accepted: "green", declined: "slate", withdrawn: "slate" };
const STATUS_LABELS = { open: "Ouverte", matched: "Confirmée", cancelled: "Annulée", pending: "En attente", accepted: "Acceptée", declined: "Refusée", withdrawn: "Retirée" };

export function tierLabel(tier) { return t(TIER_LABELS[tier] || tier); }
export function levelRange(offer) {
  return offer.levelMin === offer.levelMax ? tierLabel(offer.levelMin) : t("{0} à {1}", [tierLabel(offer.levelMin), tierLabel(offer.levelMax)]);
}
export function formatSlot(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(getLocale(), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
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
  const [duration, setDuration] = useState("120");
  const [games, setGames] = useState("3");
  const [levelMin, setLevelMin] = useState("emerald");
  const [levelMax, setLevelMax] = useState("diamond");
  const [note, setNote] = useState("");
  const invalidRange = SCRIM_TIERS.indexOf(levelMin) > SCRIM_TIERS.indexOf(levelMax);
  return <form className="scrim-form" onSubmit={(event) => {
    event.preventDefault();
    if (invalidRange || busy) return;
    const starts = new Date(startsAt);
    onSubmit({ startsAt: starts.toISOString(), durationMinutes: Number(duration), games: Number(games), levelMin, levelMax, note: note.trim() }).then((ok) => { if (ok) setNote(""); });
  }}>
    <TextInput label="Date et heure" type="datetime-local" value={startsAt} onChange={setStartsAt} required icon={CalendarClock} />
    <SelectInput label="Durée" value={duration} onChange={setDuration}>{DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{t("{0} min", [minutes])}</option>)}</SelectInput>
    <SelectInput label="Nombre de games" value={games} onChange={setGames}>{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}</SelectInput>
    <SelectInput label="Niveau minimum" value={levelMin} onChange={setLevelMin}>{SCRIM_TIERS.map((tier) => <option key={tier} value={tier}>{tierLabel(tier)}</option>)}</SelectInput>
    <SelectInput label="Niveau maximum" value={levelMax} onChange={setLevelMax}>{SCRIM_TIERS.map((tier) => <option key={tier} value={tier}>{tierLabel(tier)}</option>)}</SelectInput>
    <div className="scrim-form-note"><TextAreaInput label="Précisions (facultatif)" value={note} onChange={setNote} rows={2} maxLength={500} placeholder={t("Draft classique, Discord vocal de ton côté, contact du coach…")} /></div>
    <div className="scrim-form-actions">
      {invalidRange ? <p role="alert" className="scrim-form-error">{t("Le niveau minimum dépasse le niveau maximum.")}</p> : <p>{t("Les autres équipes NXT5 verront le nom de ton équipe, le créneau et le niveau. Le reste du planning reste privé.")}</p>}
      <Button type="submit" icon={busy ? Loader2 : Megaphone} disabled={busy || invalidRange}>{t("Publier la proposition")}</Button>
    </div>
  </form>;
}

function OfferCard({ offer, children, highlight = false }) {
  useLanguage();
  return <Surface className={highlight ? "scrim-card scrim-card-matched" : "scrim-card"} glow={highlight}>
    <div className="scrim-card-head">
      <div>
        <p className="scrim-eyebrow"><Users aria-hidden="true" />{offer.teamName}{offer.teamTag ? <span className="scrim-tag">{offer.teamTag}</span> : null}</p>
        <h3>{formatSlot(offer.startsAt)}</h3>
        <p className="scrim-meta">{t("{0} min", [offer.durationMinutes])} · {t("{0} game(s)", [offer.games])} · {levelRange(offer)}</p>
      </div>
      <Badge tone={STATUS_TONES[offer.status] || "slate"}>{t(STATUS_LABELS[offer.status] || offer.status)}</Badge>
    </div>
    {offer.note ? <p className="scrim-note">{offer.note}</p> : null}
    {children}
  </Surface>;
}

export function ScrimFinder({ data, selectedTeamId, currentMember, user, pushToast, refreshAll }) {
  useLanguage();
  const [state, setState] = useState({ loading: true, error: "", result: null, teamId: null });
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
  const mine = useMemo(() => (result?.mine || []).filter((offer) => offer.status !== "cancelled" || offer.requests?.length), [result]);
  const matched = useMemo(() => [...(result?.matched || []), ...mine.filter((offer) => offer.status === "matched")].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)), [result, mine]);

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

  return <div className="space-y-4 scrim-page">
    <PageHeader eyebrow={t("Équipe")} title={t("Scrims")} subtitle={t("Publie un créneau, réponds aux propositions des autres équipes NXT5 et confirme : la séance arrive dans les deux plannings.")}>
      <Button variant="ghost" icon={state.loading ? Loader2 : RefreshCw} disabled={state.loading} onClick={() => load()}>{t("Actualiser")}</Button>
    </PageHeader>

    {state.error && <Surface className="scrim-card"><div role="alert" className="scrim-error"><p>{state.error}</p><Button variant="ghost" icon={RefreshCw} onClick={() => load()}>{t("Réessayer")}</Button></div></Surface>}

    {canManage && <Surface className="scrim-card" glow>
      <div className="scrim-section-head"><Megaphone aria-hidden="true" /><div><h3>{t("Proposer un scrim")}</h3><p>{t("Au nom de {0}. Les équipes intéressées répondent ici, puis tu confirmes l’une d’elles.", [team?.name || t("ton équipe")])}</p></div></div>
      <ScrimOfferForm busy={busy === "create"} onSubmit={(body) => act("create", { action: "create", ...body }, [t("Proposition publiée"), t("Les autres équipes NXT5 peuvent maintenant répondre.")])} />
    </Surface>}
    {!canManage && result && <Surface className="scrim-card"><p className="scrim-hint">{t("Seul le staff de l’équipe publie et confirme les scrims. Tu peux consulter les propositions et prévenir ton capitaine.")}</p></Surface>}

    {matched.length > 0 && <section aria-label={t("Scrims confirmés")} className="scrim-section">
      <h3 className="scrim-section-title"><Check aria-hidden="true" />{t("Scrims confirmés")}</h3>
      <div className="scrim-list">{matched.map((offer) => <OfferCard key={offer.id} offer={offer} highlight>
        <p className="scrim-matched">{offer.mine ? t("Contre {0}. La séance est dans vos deux plannings.", [offer.matchedTeamName || "—"]) : t("Ta réponse a été acceptée. La séance est dans vos deux plannings.")}</p>
        {offer.requests?.filter((request) => request.status === "accepted").map((request) => request.message ? <p key={request.id} className="scrim-note">{t("Réponse de {0} :", [request.teamName])} {request.message}</p> : null)}
      </OfferCard>)}</div>
    </section>}

    <section aria-label={t("Propositions des autres équipes")} className="scrim-section">
      <h3 className="scrim-section-title"><Handshake aria-hidden="true" />{t("Propositions des autres équipes")}</h3>
      {state.loading && !result ? <div role="status" aria-label={t("Chargement des scrims")}><SkeletonRows count={3} /></div>
        : !open.length ? <Surface className="scrim-card"><EmptyState icon={Handshake} title={t("Aucune proposition ouverte pour le moment")} text={t("Publie la tienne : les équipes qui cherchent un adversaire la verront ici.")} /></Surface>
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
    </section>

    {mine.filter((offer) => offer.status === "open").length > 0 && <section aria-label={t("Mes propositions")} className="scrim-section">
      <h3 className="scrim-section-title"><Megaphone aria-hidden="true" />{t("Mes propositions")}</h3>
      <div className="scrim-list">{mine.filter((offer) => offer.status === "open").map((offer) => <OfferCard key={offer.id} offer={offer}>
        {offer.requests?.filter((request) => request.status === "pending").length ? <ul className="scrim-requests">{offer.requests.filter((request) => request.status === "pending").map((request) => <li key={request.id}>
          <div><strong>{request.teamName}</strong>{request.teamTag ? <span className="scrim-tag">{request.teamTag}</span> : null}{request.message ? <p>{request.message}</p> : null}</div>
          {canManage && <div className="scrim-actions">
            <Button icon={busy === request.id ? Loader2 : Check} disabled={Boolean(busy)} onClick={() => act(request.id, { action: "accept", requestId: request.id, expectedRevision: offer.revision }, [t("Scrim confirmé"), t("La séance est ajoutée au planning des deux équipes.")])}>{t("Confirmer")}</Button>
            <Button variant="ghost" icon={X} disabled={Boolean(busy)} onClick={() => act(request.id, { action: "decline", requestId: request.id })}>{t("Refuser")}</Button>
          </div>}
        </li>)}</ul> : <p className="scrim-hint">{t("Aucune réponse pour l’instant.")}</p>}
        {canManage && <div className="scrim-actions scrim-actions-end"><Button variant="ghost" icon={Trash2} disabled={Boolean(busy)} onClick={() => act(offer.id, { action: "cancel", offerId: offer.id })}>{t("Annuler la proposition")}</Button></div>}
      </OfferCard>)}</div>
    </section>}
  </div>;
}

export default ScrimFinder;
