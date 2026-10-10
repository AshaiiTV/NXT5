import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardList, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import AdminTabNav from "../../components/admin/AdminTabNav.jsx";
import { useAdminNavigationGuard } from "../../components/admin/AdminNavigationContext.jsx";
import { Badge, Button, EmptyState, PageHeader, SelectInput, SkeletonRows, Surface, TextAreaInput } from "../../components/ui/Core.jsx";
import "./access-requests.css";

const STATUSES = [
  { value: "new", label: "Nouvelle demande", tone: "cyan" },
  { value: "contacted", label: "Offre présentée", tone: "purple" },
  { value: "confirmed", label: "Intention confirmée après échange", tone: "green" },
  { value: "declined", label: "Offre présentée, sans suite", tone: "slate" },
];
const PLANS = { free: "Découverte", team_monthly: "Pass Équipe mensuel", team_season: "Pass Saison (ancienne offre)", structure: "Plusieurs équipes · échange" };
const ROLES = { captain: "Capitaine", manager: "Manager", coach: "Coach", player: "Joueur", other: "Autre" };
const PAYERS = { self: "Le contact", team: "L’équipe", association: "L’association / structure", unknown: "À définir" };
const INTENTS = { yes: "Oui, au prix présenté", maybe: "À discuter", discover: "Découvrir le service" };
const PAGE_SIZE = 10;
const count = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat(getLocale()).format(Number(value)) : "—";

function date(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return t("Date non disponible");
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Metric({ label, value, target, detail }) {
  useLanguage();
  return <div className="access-requests-metric"><p>{t(label)}</p><strong>{count(value)}{target && <span> / {target}</span>}</strong><p>{t(detail)}</p></div>;
}

function RequestCard({ request, busy, onSave, onDelete, onDirtyChange }) {
  useLanguage();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(request.status);
  const [adminNote, setAdminNote] = useState(request.adminNote || "");
  const [error, setError] = useState("");
  const statusInfo = STATUSES.find((item) => item.value === request.status) || STATUSES[0];
  const titleId = `access-request-${request.id}`;
  const detailsId = `${titleId}-followup`;
  const dirty = status !== request.status || adminNote !== (request.adminNote || "");
  useEffect(() => { onDirtyChange(request.id, editing && dirty); }, [request.id, editing, dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(request.id, false), [request.id, onDirtyChange]);
  const isSaving = busy === request.id;
  const reset = () => { setStatus(request.status); setAdminNote(request.adminNote || ""); setEditing(false); setError(""); };
  const save = async (event) => {
    event.preventDefault();
    setError("");
    try { await onSave(request.id, status, adminNote); setEditing(false); }
    catch (err) { setError(err.message || "Impossible d’enregistrer le suivi. Réessaie."); }
  };
  const remove = async () => {
    setError("");
    try { await onDelete(request.id); }
    catch (err) { setError(err.message || "Impossible de supprimer cette demande. Réessaie."); }
  };
  return <article className="access-request" aria-labelledby={titleId}>
    <div className="access-request-heading"><div><h3 id={titleId}>{request.teamName}</h3><p>{request.contactName} · {t(ROLES[request.role] || request.role)}</p><p className="access-request-email">{request.email}</p></div><Badge tone={statusInfo.tone}>{t(statusInfo.label)}</Badge></div>
    <dl className="access-request-facts">
      <div><dt>{t("Formule envisagée")}</dt><dd>{t(PLANS[request.planCode] || request.planCode)}</dd></div>
      <div><dt>{t("Qui paierait ?")}</dt><dd>{t(PAYERS[request.payer] || request.payer)}</dd></div>
      <div><dt>{t("Intention déclarée au formulaire")}</dt><dd>{request.purchaseIntent === "yes" && request.planCode === "structure" ? t("Oui, je souhaite en discuter") : request.purchaseIntent === "yes" && request.planCode === "free" ? t("Oui, je souhaite essayer") : t(INTENTS[request.purchaseIntent] || request.purchaseIntent)}</dd></div>
      <div><dt>{t("Demande reçue")}</dt><dd>{date(request.createdAt)}</dd></div>
    </dl>
    {request.message && <div className="access-request-message"><h4>{t("Message du contact")}</h4><p>{request.message}</p></div>}
    {!editing && request.adminNote && <div className="access-request-message"><h4>{t("Notes de suivi")}</h4><p>{request.adminNote}</p></div>}
    <div className="access-request-actions"><Button type="button" variant="ghost" disabled={Boolean(busy) || deleting} aria-expanded={editing} aria-controls={detailsId} onClick={() => { if (editing) reset(); else setEditing(true); }}>{editing ? t("Fermer le suivi") : t("Suivre cette demande")}</Button><Button type="button" variant="ghost" className="access-request-remove" icon={Trash2} disabled={Boolean(busy) || editing} onClick={() => { setError(""); setDeleting(true); }} aria-label={t("Supprimer la demande de {0}", [request.teamName])}>{t("Supprimer")}</Button></div>
    {editing && <form id={detailsId} className="access-request-editor" onSubmit={save}><h4>{t("Mettre à jour le suivi")}</h4>
      <fieldset disabled={Boolean(busy)}><legend className="sr-only">{t("Suivi de ")}{request.teamName}</legend>
        <SelectInput label={t("Statut du suivi")} value={status} onChange={setStatus} disabled={Boolean(busy)}>{STATUSES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</SelectInput>
        <p className="access-requests-caption">{t("Après présentation de l’offre, confirme l’intention uniquement si le contact a validé la formule, le prix et la personne qui paie. Le choix du formulaire seul ne suffit pas.")}{request.planCode === "structure" && t(" Cette demande porte sur un échange. Pour confirmer un achat, le périmètre et le devis doivent avoir été validés séparément ; aucun tarif n’est annoncé dans le formulaire.")}{request.planCode === "free" && t(" Une demande Découverte ne compte pas comme intention d’achat.")}</p>
        <TextAreaInput label={t("Notes de suivi")} value={adminNote} onChange={setAdminNote} rows={3} maxLength={4000} placeholder={t("Date de l’échange, prix accepté, payeur, questions ou réserves…")} />
        <p className="access-requests-caption">{t("Notes privées · ")}{adminNote.length}{t(" / 4 000 caractères")}</p>
        <div className="access-request-actions"><Button type="submit" icon={isSaving ? Loader2 : Check} disabled={Boolean(busy) || !dirty || adminNote.length > 4000}>{isSaving ? t("Enregistrement…") : t("Enregistrer le suivi")}</Button><Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={reset}>{t("Annuler")}</Button></div>
      </fieldset>
    </form>}
    {deleting && <div className="access-request-delete" role="group" aria-label={t("Confirmer la suppression de {0}", [request.teamName])}><p>{t("Supprimer définitivement la demande de ")}<strong>{request.teamName}</strong>{t(", ses coordonnées et ses notes ?")}</p><div className="access-request-actions"><Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => { setDeleting(false); setError(""); }} autoFocus>{t("Conserver la demande")}</Button><Button type="button" variant="danger" icon={isSaving ? Loader2 : Trash2} disabled={Boolean(busy)} onClick={remove}>{isSaving ? t("Suppression…") : t("Confirmer la suppression")}</Button></div></div>}
    {error && <p className="access-requests-error" role="alert">{t(error)}</p>}
  </article>;
}

export default function AccessRequestsPage({ navigate, embedded = false }) {
  useLanguage();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState("");
  const [dirtyRequests, setDirtyRequests] = useState(() => new Set());
  const handleDirtyChange = useCallback((id, dirty) => {
    setDirtyRequests((previous) => {
      if (previous.has(id) === dirty) return previous;
      const next = new Set(previous);
      if (dirty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const requestSequence = useRef(0);
  const mutationPending = useRef(false);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter) query.set("status", statusFilter);
      const result = await apiFetch(`admin-access-requests?${query}`);
      if (sequence !== requestSequence.current) return;
      if (page > Math.max(1, result.pagination.totalPages)) { setPage(Math.max(1, result.pagination.totalPages)); return; }
      setData(result);
    } catch (err) { if (sequence === requestSequence.current) setError(err.message || "Impossible de charger les demandes d’accès."); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [page, statusFilter]);
  useEffect(() => { setData(null); load(); return () => { requestSequence.current += 1; }; }, [load]);

  const mutate = async (id, method, body) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy(id); setAnnouncement("");
    try {
      const result = await apiFetch("admin-access-requests", { method, body: JSON.stringify(body) });
      if (result?.ok !== true) throw new Error("Le serveur n’a pas confirmé la modification. Réessaie.");
      setAnnouncement(method === "DELETE" ? "Demande supprimée." : "Suivi enregistré.");
      await load();
    } finally { mutationPending.current = false; setBusy(""); }
  };
  const pagination = data?.pagination;
  const stats = data?.stats;
  const blocked = loading || Boolean(busy) || dirtyRequests.size > 0;
  useAdminNavigationGuard({ dirty: dirtyRequests.size > 0, disabled: Boolean(busy) });
  return <div className="nxt5-data-dense access-requests-page">
    <PageHeader eyebrow={t("Ventes et accès")} title={t("Demandes d’accès")} subtitle={t("Retrouve les demandes reçues et mets à jour les échanges, les statuts et les notes de suivi.")}>
      {embedded && <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => navigate("/admin/tarifs")}>{t("Voir les offres")}</Button>}
    </PageHeader>
    {!embedded && <AdminTabNav activeId="access-requests" navigate={navigate} disabled={Boolean(busy)} dirty={dirtyRequests.size > 0} />}
    <div className="access-requests-notice"><Badge tone="cyan">{t("Prévisualisation interne")}</Badge><p>{t("La collecte publique est fermée. Seul l’administrateur peut consulter les tarifs et envoyer une demande de test. Le suivi reste manuel, sans e-mail automatique ni abonnement.")}</p></div>
    <div className="access-requests-live" role="status" aria-live="polite">{t(announcement) || (loading ? t("Chargement des demandes…") : "")}</div>
    {error && <div className="access-requests-error" role="alert"><p>{t(error)}{data && t(" Les données ci-dessous datent de la dernière lecture réussie.")}</p><Button type="button" variant="ghost" disabled={blocked} onClick={load}>{t("Réessayer")}</Button></div>}
    {stats && <Surface><div className="access-requests-metrics"><Metric label={t("Demandes reçues")} value={stats.total} detail={t("Tous les statuts, toutes les pages")} /><Metric label={t("Équipes avec offre présentée")} value={stats.presentedTeams} target={10} detail={t("Présentation renseignée manuellement")} /><Metric label={t("Intentions d’achat confirmées")} value={stats.confirmedTeams} target={3} detail={t("Équipes ayant validé une formule payante")} /></div><p className="access-requests-caption">{t("Les objectifs portent sur des équipes distinctes d’après le nom renseigné. Les nouvelles demandes et leur intention déclarée ne comptent pas comme validation. Les statuts « Offre présentée », « Intention confirmée après échange » et « Offre présentée, sans suite » alimentent le suivi des présentations.")}</p></Surface>}
    <Surface>
      <div className="access-requests-list-heading"><h3>{t("Suivi des demandes")}</h3><p>{t("Ouvre le suivi d’une équipe pour consigner un échange ou modifier son statut.")}</p></div>
      {dirtyRequests.size > 0 && <p className="access-requests-caption" role="status">{t("Enregistre ou annule le suivi en cours pour changer de filtre, de page ou actualiser la liste.")}</p>}
      <div className="access-requests-toolbar"><SelectInput label={t("Afficher les demandes")} value={statusFilter} disabled={blocked} onChange={(value) => { setStatusFilter(value); setPage(1); setAnnouncement(""); }}><option value="">{t("Tous les statuts")}</option>{STATUSES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</SelectInput><Button type="button" variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={blocked} onClick={load}>{loading ? t("Actualisation…") : t("Actualiser")}</Button></div>
      {!data && loading && <div aria-label={t("Chargement des demandes")}><SkeletonRows count={3} /></div>}
      {data && <div aria-busy={loading} className="access-requests-list">{data.requests.length ? data.requests.map((request) => <RequestCard key={`${request.id}:${request.updatedAt}`} request={request} busy={busy || (loading ? "loading" : "")} onDirtyChange={handleDirtyChange} onSave={(id, status, adminNote) => mutate(id, "POST", { id, status, adminNote })} onDelete={(id) => mutate(id, "DELETE", { id })} />) : <EmptyState icon={ClipboardList} title={statusFilter ? t("Aucune demande avec ce statut") : t("Aucune demande pour le moment")} text={statusFilter ? t("Choisis un autre statut pour retrouver les demandes enregistrées.") : t("Les demandes de test envoyées par l’administrateur depuis la prévisualisation des tarifs apparaîtront ici.")} />}</div>}
      {pagination && <nav className="access-requests-pagination" aria-label={t("Pagination des demandes d’accès")}><p>{pagination.total ? t("{0}–{1} sur {2} demande{3}", [count((pagination.page - 1) * pagination.pageSize + 1), count(Math.min(pagination.page * pagination.pageSize, pagination.total)), count(pagination.total), pagination.total > 1 ? "s" : ""]) : t("0 demande")}</p><div><Button type="button" variant="ghost" icon={ChevronLeft} aria-label={t("Page précédente des demandes")} disabled={blocked || pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} /><span>{t("Page ")}{pagination.page} / {Math.max(1, pagination.totalPages)}</span><Button type="button" variant="ghost" icon={ChevronRight} aria-label={t("Page suivante des demandes")} disabled={blocked || pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)} /></div></nav>}
    </Surface>
  </div>;
}
