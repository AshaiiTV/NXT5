import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, History, Loader2, RefreshCw, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { createSubscriptionForm, defaultSubscriptionEndDate, getSubscriptionPlanLabel, getSubscriptionPresentation, localDateInput, notifySubscriptionUpdated, subscriptionDateToISO, subscriptionFormDates, subscriptionPeriodLabel } from "../../app/subscriptions.js";
import { PROPOSED_PLAN_OPTIONS } from "../../app/pricing.js";
import { DISCOVERY_TRIAL_DAYS } from "../../app/pass-access.js";
import { Badge, Button, EmptyState, PageHeader, SelectInput, SkeletonRows, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import "./account-subscriptions.css";
import AdminTabNav from "../../components/admin/AdminTabNav.jsx";
import { useAdminNavigationGuard } from "../../components/admin/AdminNavigationContext.jsx";

const ENDPOINT = "admin-account-subscriptions";
const PAGE_SIZE = 10;
const NOTE_LIMIT = 1000;
const historyDate = () => new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" });
const dateLabel = (value) => value && Number.isFinite(new Date(value).getTime()) ? historyDate().format(new Date(value)) : "Date non disponible";
const accountLabel = (account) => account?.name || account?.accountName || account?.email || t("Compte");
const requestError = (error, fallback) => error?.message || fallback;

function AccountIdentity({ account, heading = false }) {
  useLanguage();
  const Name = heading ? "h3" : "h4";
  return <div className="as-identity"><Name id={heading ? "subscription-editor-title" : undefined}>{accountLabel(account)}</Name><p>{account.accountName ? `@${account.accountName}` : t("Pseudo non renseigné")}</p><p>{account.email || t("E-mail non renseigné")}</p></div>;
}

function SubscriptionSummary({ subscription }) {
  useLanguage();
  const presentation = getSubscriptionPresentation(subscription);
  return <div className="as-subscription-summary"><div><strong>{t(presentation.label)}</strong><Badge tone={presentation.tone}>{t(presentation.statusLabel)}</Badge></div><p>{t(subscriptionPeriodLabel(subscription))}</p>{["scheduled", "expired", "revoked"].includes(subscription?.status) && <p>{t("Aucune formule active. Les outils restent accessibles avant lancement.")}</p>}</div>;
}

function SubscriptionHistory({ history }) {
  useLanguage();
  return <section className="as-history" aria-labelledby="subscription-history-title">
    <header><History aria-hidden="true" /><div><h4 id="subscription-history-title">{t("Historique des attributions")}</h4><p>{t("Les 10 dernières modifications d’abonnement de ce compte.")}</p></div></header>
    {history.length ? <ol>{history.slice(0, 10).map((entry) => <li key={entry.id}>
      <div className="as-history-heading"><strong>{entry.action === "migrate" ? `${t(getSubscriptionPlanLabel(entry.previousPlanCode))} → ${t(getSubscriptionPlanLabel(entry.planCode))}` : entry.action === "revoke" ? t("Abonnement retiré") : t("{0} attribué", [t(getSubscriptionPlanLabel(entry.planCode))])}</strong><time dateTime={entry.createdAt}>{t(dateLabel(entry.createdAt))}</time></div>
      <p>{t(subscriptionPeriodLabel(entry))}{t(" · Par ")}{entry.actorName || t("Administrateur")}</p>
      {entry.note && <p className="as-history-note">{entry.note}</p>}
    </li>)}</ol> : <p className="as-caption">{t("Aucune formule attribuée à ce compte pour le moment.")}</p>}
  </section>;
}

export default function AccountSubscriptionsPage({ navigate, initialUserId = "", embedded = false }) {
  useLanguage();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState(initialUserId);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(initialUserId));
  const [detailError, setDetailError] = useState("");
  const [form, setForm] = useState(() => createSubscriptionForm(null));
  const [baseline, setBaseline] = useState(form);
  const [automaticEnd, setAutomaticEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const listSequence = useRef(0);
  const detailSequence = useRef(0);
  const pendingMutation = useRef(false);
  const selectedRef = useRef(selectedId);
  const errorRef = useRef(null);
  const headingRef = useRef(null);
  selectedRef.current = selectedId;

  const loadList = useCallback(async () => {
    const sequence = ++listSequence.current;
    setListLoading(true); setListError("");
    try {
      const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(PAGE_SIZE) });
      const result = await apiFetch(`${ENDPOINT}?${params}`);
      if (sequence !== listSequence.current) return;
      if (!Array.isArray(result?.accounts) || !result?.pagination) throw new Error("Le serveur n’a pas confirmé la liste des comptes.");
      if (page > Math.max(1, result.pagination.totalPages)) { setPage(Math.max(1, result.pagination.totalPages)); return; }
      setList(result);
    } catch (err) { if (sequence === listSequence.current) setListError(requestError(err, "Impossible de charger les comptes.")); }
    finally { if (sequence === listSequence.current) setListLoading(false); }
  }, [query, page]);

  useEffect(() => {
    if (selectedId) return;
    setList(null);
    loadList();
    return () => { listSequence.current += 1; };
  }, [loadList, selectedId]);

  function applyDetail(result) {
    const next = createSubscriptionForm(result.account.subscription);
    setDetail(result); setForm(next); setBaseline(next); setAutomaticEnd(false);
    setError(""); setConflict(false); setConfirmRevoke(false);
  }

  const loadDetail = useCallback(async (userId) => {
    const sequence = ++detailSequence.current;
    setDetailLoading(true); setDetailError("");
    try {
      const result = await apiFetch(`${ENDPOINT}?${new URLSearchParams({ userId })}`);
      if (sequence !== detailSequence.current || selectedRef.current !== userId) return;
      if (result?.account?.id !== userId || !result.account.subscription || !Array.isArray(result.history)) throw new Error("Le serveur n’a pas confirmé les informations de ce compte.");
      applyDetail(result);
    } catch (err) { if (sequence === detailSequence.current && selectedRef.current === userId) setDetailError(requestError(err, "Impossible de charger ce compte.")); }
    finally { if (sequence === detailSequence.current && selectedRef.current === userId) setDetailLoading(false); }
  }, []);

  useEffect(() => { setSelectedId(initialUserId || ""); }, [initialUserId]);
  useEffect(() => {
    setDetail(null); setDetailError(""); setError(""); setConflict(false); setConfirmRevoke(false); setAnnouncement("");
    pendingMutation.current = false; setBusy(false);
    if (selectedId) loadDetail(selectedId);
    return () => { detailSequence.current += 1; };
  }, [selectedId, loadDetail]);
  useEffect(() => { if (error || detailError) errorRef.current?.focus(); }, [error, detailError]);
  useEffect(() => { if (detail?.account.id === selectedId) headingRef.current?.focus({ preventScroll: true }); }, [detail?.account.id, selectedId]);

  const dirty = Boolean(detail && JSON.stringify(form) !== JSON.stringify(baseline));
  const blocked = busy || detailLoading;
  const paid = form.planCode !== "free";
  const account = detail?.account;
  const subscription = account?.subscription;
  const canRevoke = Boolean(subscription?.revision > 0 && subscription?.status !== "revoked" && subscription?.status !== "none");
  const futureReplacement = subscription?.status === "active" && subscription?.effectivePlanCode !== "free" && paid && new Date(subscriptionDateToISO(form.startDate) || 0).getTime() > Date.now();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function patch(key, value) {
    setAnnouncement("");
    if (key === "planCode") {
      setForm((current) => {
        const startDate = current.startDate || localDateInput();
        return { ...current, planCode: value, startDate, endDate: defaultSubscriptionEndDate(startDate, value), startTrial: false, noEndDate: false, sourceStartsAt: null, sourceEndsAt: null };
      });
      setAutomaticEnd(true);
    } else if (key === "startDate") {
      setForm((current) => ({ ...current, startDate: value, ...(automaticEnd ? { endDate: defaultSubscriptionEndDate(value, current.planCode) } : {}) }));
    } else {
      if (key === "endDate") setAutomaticEnd(false);
      setForm((current) => ({ ...current, [key]: value }));
    }
  }

  function cancelChanges() {
    setForm(baseline); setAutomaticEnd(false); setConfirmRevoke(false); if (!conflict) setError(""); setAnnouncement("");
  }

  async function mutate(action) {
    if (pendingMutation.current || blocked || conflict || !account) return;
    setError(""); setAnnouncement("");
    let dates;
    try {
      if (form.note.length > NOTE_LIMIT) throw new Error(`La note privée est limitée à ${NOTE_LIMIT} caractères.`);
      if (action === "assign") dates = subscriptionFormDates(form);
    } catch (err) { setError(err.message); return; }
    const userId = account.id;
    const sequence = detailSequence.current;
    pendingMutation.current = true; setBusy(true);
    try {
      const result = await apiFetch(ENDPOINT, { method: "POST", body: JSON.stringify({
        userId, action, ...(action === "assign" ? { planCode: form.planCode, ...dates } : {}), note: form.note.trim(), expectedRevision: subscription.revision,
      }) });
      if (sequence !== detailSequence.current || selectedRef.current !== userId) return;
      if (result?.ok !== true || result?.account?.id !== userId || !result.account.subscription || !Array.isArray(result.history)) throw new Error("Le serveur n’a pas confirmé la modification. Ton brouillon est conservé.");
      applyDetail(result);
      notifySubscriptionUpdated();
      setAnnouncement(action === "revoke" ? `Abonnement retiré pour ${accountLabel(result.account)}.` : `Abonnement enregistré pour ${accountLabel(result.account)}.`);
    } catch (err) {
      if (sequence !== detailSequence.current || selectedRef.current !== userId) return;
      if (err?.status === 409) { setConflict(true); setError("Cet abonnement a été modifié ailleurs. Ton brouillon est conservé. Actualise le compte avant toute nouvelle modification."); }
      else setError(requestError(err, "Impossible d’enregistrer l’abonnement. Ton brouillon est conservé."));
    } finally {
      if (sequence === detailSequence.current && selectedRef.current === userId) { pendingMutation.current = false; setBusy(false); }
    }
  }

  function runSearch(event) {
    event.preventDefault();
    const next = search.trim();
    if (next === query && page === 1) loadList();
    else { setQuery(next); setPage(1); }
  }
  function resetSearch() { setSearch(""); setQuery(""); setPage(1); }
  const pagination = list?.pagination;
  let trialPeriod = "";
  if (!paid && form.startTrial) {
    try { trialPeriod = subscriptionPeriodLabel({ planCode: "free", ...subscriptionFormDates(form) }); } catch { /* Keep the date field editable; submit reports invalid dates. */ }
  }

  useAdminNavigationGuard({ dirty, disabled: busy });
  return <div className="nxt5-data-dense account-subscriptions-page">
    <PageHeader eyebrow={t("Ventes et accès")} title={t("Comptes et abonnements")} subtitle={t("Retrouve un compte, consulte son abonnement ou attribue-lui une formule.")} />
    {!embedded && <AdminTabNav activeId="account-subscriptions" navigate={navigate} disabled={busy} dirty={dirty} />}
    <p className="as-notice"><ShieldCheck aria-hidden="true" /><span>{t("Découverte : ")}{DISCOVERY_TRIAL_DAYS}{t(" jours d’accès complet, puis Pass Équipe pour continuer. Les outils restent ouverts à tous avant le lancement. Les attributions manuelles ne déclenchent aucun paiement ni renouvellement automatique.")}</span></p>
    <p className="as-announcement" role="status" aria-live="polite">{t(announcement)}</p>

    {!selectedId ? <Surface>
      <section aria-labelledby="subscription-accounts-title">
        <header className="as-section-heading"><div><h3 id="subscription-accounts-title">{t("Trouver un compte")}</h3><p>{t("Recherche parmi tous les comptes, par nom, pseudo ou e-mail.")}</p></div></header>
        <form className="as-search" onSubmit={runSearch}>
          <TextInput label={t("Rechercher un compte")} type="search" name="q" value={search} onChange={setSearch} placeholder={t("Nom, pseudo ou e-mail")} maxLength={100} icon={Search} />
          <Button type="submit" icon={listLoading ? Loader2 : Search} disabled={listLoading && search.trim() === query}>{t("Rechercher")}</Button>
          {(search || query) && <Button type="button" variant="ghost" icon={X} onClick={resetSearch}>{t("Effacer")}</Button>}
        </form>
        {listError && <div className="as-error" role="alert"><p>{t(listError)}</p><Button type="button" variant="ghost" disabled={listLoading} onClick={loadList}>{t("Réessayer")}</Button></div>}
        <div aria-busy={listLoading} className="as-account-list">
          {listLoading && !list ? <div aria-label={t("Chargement des comptes")}><SkeletonRows count={3} /></div> : list && <>
            <p className="as-result-count" role="status">{listLoading ? t("Actualisation des comptes…") : t("{0} compte{1}{2}", [pagination.total, pagination.total > 1 ? "s" : "", query ? t(" pour « {0} »", [query]) : ""])}</p>
            {list.accounts.length ? <ul>{list.accounts.map((item) => <li key={item.id}>
              <AccountIdentity account={item} /><SubscriptionSummary subscription={item.subscription} />
              <Button type="button" variant="ghost" disabled={listLoading} aria-label={t("Gérer l’abonnement de {0}", [accountLabel(item)])} onClick={() => setSelectedId(item.id)}>{t("Gérer l’abonnement")}</Button>
            </li>)}</ul> : !listError && <EmptyState icon={UserRound} title={query ? t("Aucun compte trouvé") : t("Aucun compte")} text={query ? t("Essaie un autre nom, pseudo ou e-mail.") : t("Les comptes NXT5 apparaîtront ici.")} />}
            {!list.accounts.length && query && <Button type="button" variant="ghost" onClick={resetSearch}>{t("Voir tous les comptes")}</Button>}
          </>}
        </div>
        {pagination && pagination.total > 0 && <nav className="as-pagination" aria-label={t("Pagination des comptes")}>
          <p>{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)}{t(" sur ")}{pagination.total}</p>
          <div><Button type="button" variant="ghost" icon={ChevronLeft} aria-label={t("Page précédente des comptes")} disabled={listLoading || pagination.page <= 1} onClick={() => setPage(page - 1)} /><span>{t("Page ")}{pagination.page} / {Math.max(1, pagination.totalPages)}</span><Button type="button" variant="ghost" icon={ChevronRight} aria-label={t("Page suivante des comptes")} disabled={listLoading || pagination.page >= pagination.totalPages} onClick={() => setPage(page + 1)} /></div>
        </nav>}
      </section>
    </Surface> : <Surface>
      <section aria-labelledby="subscription-editor-title">
        <div className="as-profile-navigation"><Button type="button" variant="ghost" icon={ArrowLeft} disabled={busy} onClick={() => setSelectedId("")}>{dirty ? t("Annuler et changer de compte") : t("Changer de compte")}</Button>{account && <Button type="button" variant="ghost" icon={detailLoading ? Loader2 : RefreshCw} disabled={blocked} onClick={() => { setAnnouncement(""); loadDetail(selectedId); }}>{dirty || conflict ? t("Abandonner le brouillon et actualiser") : t("Actualiser le compte")}</Button>}</div>
        {!account && <h3 id="subscription-editor-title" className="as-loading-title">{t("Abonnement du compte")}</h3>}
        {detailError && <div ref={errorRef} tabIndex={-1} className="as-error" role="alert"><p>{t(detailError)}{account && t(" Les informations affichées datent de la dernière lecture réussie.")}</p><Button type="button" variant="ghost" disabled={blocked} onClick={() => loadDetail(selectedId)}>{t("Réessayer")}</Button></div>}
        {detailLoading && !account && <div aria-label={t("Chargement de l’abonnement")}><SkeletonRows count={3} /></div>}
        {account && <>
          <div ref={headingRef} tabIndex={-1} className="as-selected-heading"><AccountIdentity account={account} heading /><SubscriptionSummary subscription={subscription} /></div>
          <form className="as-editor" onSubmit={(event) => { event.preventDefault(); mutate("assign"); }} aria-busy={busy}>
            <div className="as-editor-heading"><h4>{t("Attribution de la formule")}</h4><p className="as-caption">{t("La formule enregistrée remplace l’abonnement actuel de ce compte.")}</p></div>
            <fieldset disabled={blocked || conflict || confirmRevoke}>
              <legend className="sr-only">{t("Abonnement de ")}{accountLabel(account)}</legend>
              <div>
                <SelectInput label={t("Formule attribuée")} name="planCode" value={form.planCode} aria-describedby="manual-plan-detail" onChange={(value) => patch("planCode", value)}>{PROPOSED_PLAN_OPTIONS.map((plan) => <option key={plan.value} value={plan.value}>{t(plan.label)}</option>)}</SelectInput>
                <p id="manual-plan-detail" className="as-caption mt-2">{t(PROPOSED_PLAN_OPTIONS.find((plan) => plan.value === form.planCode)?.label)}</p>
              </div>
              {paid ? <>
                <div className="as-date-fields"><TextInput label={t("Date de début")} name="startsAt" type="date" required value={form.startDate} onChange={(value) => patch("startDate", value)} /><TextInput label={t("Date de fin incluse")} name="endsAt" type="date" required={!form.noEndDate} disabled={form.noEndDate} min={form.startDate || undefined} value={form.noEndDate ? "" : form.endDate} onChange={(value) => patch("endDate", value)} /></div>
                <label className="as-checkbox"><input type="checkbox" checked={form.noEndDate} onChange={(event) => patch("noEndDate", event.target.checked)} /><span>{t("Sans date de fin")}</span></label>
                <p className="as-caption">{t("Le dernier jour choisi est inclus. Dates en heure locale")}{timezone ? ` (${timezone})` : ""}.</p>
              </> : <>
                <p className="as-caption">{t("Tous les outils pendant ")}{DISCOVERY_TRIAL_DAYS}{t(" jours. Sans période définie, l’essai reste en attente et aucun compte à rebours ne démarre.")}</p>
                <label className="as-checkbox"><input name="startTrial" type="checkbox" checked={form.startTrial} onChange={(event) => patch("startTrial", event.target.checked)} /><span>{t("Définir une période d’essai de ")}{DISCOVERY_TRIAL_DAYS}{t(" jours")}</span></label>
                {form.startTrial && <>
                  <div className="as-date-fields"><TextInput label={t("Date de début de l’essai")} name="startsAt" type="date" required value={form.startDate} onChange={(value) => patch("startDate", value)} /></div>
                  {trialPeriod && <p className="as-caption" role="status">{t(trialPeriod)}{t(". Dates en heure locale")}{timezone ? ` (${timezone})` : ""}.</p>}
                  <p className="as-caption">{t("L’enregistrement applique cette période uniquement à ce compte. Aucun outil ne sera bloqué avant le lancement des abonnements.")}</p>
                </>}
              </>}
              <TextAreaInput label={t("Note privée")} name="note" rows={3} maxLength={NOTE_LIMIT} value={form.note} onChange={(value) => patch("note", value)} placeholder={t("Motif de l’attribution, accord ou référence interne…")} /><p className="as-caption">{t("Visible uniquement dans l’administration · ")}{form.note.length} / {NOTE_LIMIT}{t(" caractères")}</p>
            </fieldset>
            {futureReplacement && <p className="as-replacement-notice">{t("Cette attribution remplace le Pass actuel. Aucun Pass ne sera actif avant le ")}{new Date(subscriptionDateToISO(form.startDate)).toLocaleDateString(getLocale())}.</p>}
            <div className="as-editor-actions"><Button type="submit" icon={busy ? Loader2 : Check} disabled={blocked || conflict || confirmRevoke || form.note.length > NOTE_LIMIT}>{busy ? t("Enregistrement…") : t("Enregistrer l’abonnement")}</Button>{dirty && <Button type="button" variant="ghost" disabled={blocked} onClick={cancelChanges}>{t("Annuler les modifications")}</Button>}{canRevoke && <Button type="button" variant="ghost" className="as-remove-action" disabled={blocked || conflict || confirmRevoke} onClick={() => { setConfirmRevoke(true); setError(""); }}>{t("Retirer l’abonnement")}</Button>}</div>
          </form>
          {confirmRevoke && <div className="as-revoke" role="group" aria-label={t("Confirmer le retrait de l’abonnement")}><h4>{t("Retirer ")}{t(getSubscriptionPresentation(subscription).label)} ?</h4><p>{t("Le retrait concerne ")}<strong>{accountLabel(account)}</strong>{account.accountName && <> (@{account.accountName})</>} · {account.email}{t(". Le compte n’aura plus de formule active ; aucun nouvel essai ne sera démarré.")}</p><p>{t("La note privée saisie sera enregistrée avec ce retrait.")}</p><div className="as-editor-actions"><Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmRevoke(false)}>{t("Conserver l’abonnement")}</Button><Button type="button" variant="danger" disabled={blocked || conflict} icon={busy ? Loader2 : X} onClick={() => mutate("revoke")}>{busy ? t("Retrait…") : t("Confirmer le retrait")}</Button></div></div>}
          {error && <div ref={errorRef} tabIndex={-1} className="as-error" role="alert"><p>{t(error)}</p>{conflict && <p>{t("La dernière attribution doit être relue avant de pouvoir enregistrer ou retirer un abonnement.")}</p>}</div>}
          <SubscriptionHistory history={detail.history} />
        </>}
      </section>
    </Surface>}
  </div>;
}
