import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardList, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import AdminTabNav from "../../components/admin/AdminTabNav.jsx";
import { Badge, Button, EmptyState, PageHeader, SelectInput, SkeletonRows, Surface, TextAreaInput } from "../../components/ui/Core.jsx";
import "./access-requests.css";

const STATUSES = [
  { value: "new", label: "Nouvelle demande", tone: "cyan" },
  { value: "contacted", label: "Offre présentée", tone: "purple" },
  { value: "confirmed", label: "Intention confirmée après échange", tone: "green" },
  { value: "declined", label: "Offre présentée, sans suite", tone: "slate" },
];
const PLANS = { free: "Découverte", team_monthly: "Pass Équipe mensuel", team_season: "Pass Saison", structure: "Pass Structure" };
const ROLES = { captain: "Capitaine", manager: "Manager", coach: "Coach", player: "Joueur", other: "Autre" };
const PAYERS = { self: "Le contact", team: "L’équipe", association: "L’association / structure", unknown: "À définir" };
const INTENTS = { yes: "Oui, au prix présenté", maybe: "À discuter", discover: "Découvrir le service" };
const PAGE_SIZE = 10;
const count = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat("fr-FR").format(Number(value)) : "—";

function date(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Metric({ label, value, target, detail }) {
  return <div className="access-requests-metric"><p>{label}</p><strong>{count(value)}{target && <span> / {target}</span>}</strong><p>{detail}</p></div>;
}

function RequestCard({ request, busy, onSave, onDelete, onDirtyChange }) {
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
    <div className="access-request-heading"><div><h3 id={titleId}>{request.teamName}</h3><p>{request.contactName} · {ROLES[request.role] || request.role}</p><p className="access-request-email">{request.email}</p></div><Badge tone={statusInfo.tone}>{statusInfo.label}</Badge></div>
    <dl className="access-request-facts">
      <div><dt>Formule envisagée</dt><dd>{PLANS[request.planCode] || request.planCode}</dd></div>
      <div><dt>Qui paierait ?</dt><dd>{PAYERS[request.payer] || request.payer}</dd></div>
      <div><dt>Intention déclarée au formulaire</dt><dd>{request.planCode === "structure" && request.purchaseIntent === "yes" ? "Oui, selon le devis" : INTENTS[request.purchaseIntent] || request.purchaseIntent}</dd></div>
      <div><dt>Demande reçue</dt><dd>{date(request.createdAt)}</dd></div>
    </dl>
    {request.message && <div className="access-request-message"><h4>Message du contact</h4><p>{request.message}</p></div>}
    {!editing && request.adminNote && <div className="access-request-message"><h4>Notes de suivi</h4><p>{request.adminNote}</p></div>}
    <div className="access-request-actions"><Button type="button" variant="ghost" disabled={Boolean(busy) || deleting} aria-expanded={editing} aria-controls={detailsId} onClick={() => { if (editing) reset(); else setEditing(true); }}>{editing ? "Fermer le suivi" : "Suivre cette demande"}</Button><Button type="button" variant="danger" icon={Trash2} disabled={Boolean(busy) || editing} onClick={() => { setError(""); setDeleting(true); }} aria-label={`Supprimer la demande de ${request.teamName}`}>Supprimer</Button></div>
    {editing && <form id={detailsId} className="access-request-editor" onSubmit={save}>
      <fieldset disabled={Boolean(busy)}><legend className="sr-only">Suivi de {request.teamName}</legend>
        <SelectInput label="Statut du suivi" value={status} onChange={setStatus} disabled={Boolean(busy)}>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectInput>
        <p className="access-requests-caption">Après présentation de l’offre, confirme l’intention uniquement si le contact a validé la formule, le prix et la personne qui paie. Le choix du formulaire seul ne suffit pas.{request.planCode === "structure" && " Pour une structure, le périmètre et le devis doivent avoir été validés ; le tarif de départ ne suffit pas."}{request.planCode === "free" && " Une demande Découverte ne compte pas comme intention d’achat."}</p>
        <TextAreaInput label="Notes de suivi" value={adminNote} onChange={setAdminNote} rows={3} maxLength={4000} placeholder="Date de l’échange, prix accepté, payeur, questions ou réserves…" />
        <p className="access-requests-caption">Notes privées · {adminNote.length} / 4 000 caractères</p>
        <div className="access-request-actions"><Button type="submit" icon={isSaving ? Loader2 : Check} disabled={Boolean(busy) || !dirty || adminNote.length > 4000}>{isSaving ? "Enregistrement…" : "Enregistrer le suivi"}</Button><Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={reset}>Annuler</Button></div>
      </fieldset>
    </form>}
    {deleting && <div className="access-request-delete" role="group" aria-label={`Confirmer la suppression de ${request.teamName}`}><p>Supprimer définitivement la demande de <strong>{request.teamName}</strong>, ses coordonnées et ses notes ?</p><div className="access-request-actions"><Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => { setDeleting(false); setError(""); }} autoFocus>Conserver la demande</Button><Button type="button" variant="danger" icon={isSaving ? Loader2 : Trash2} disabled={Boolean(busy)} onClick={remove}>{isSaving ? "Suppression…" : "Confirmer la suppression"}</Button></div></div>}
    {error && <p className="access-requests-error" role="alert">{error}</p>}
  </article>;
}

export default function AccessRequestsPage({ navigate }) {
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
  const blocked = loading || Boolean(busy);
  return <div className="nxt5-data-dense access-requests-page">
    <PageHeader eyebrow="Administration · Validation commerciale" title="Demandes d’accès" subtitle="Prépare le suivi des demandes dans la prévisualisation réservée à l’administrateur." />
    <AdminTabNav activeId="access-requests" navigate={navigate} disabled={Boolean(busy)} dirty={dirtyRequests.size > 0} />
    <div className="access-requests-notice"><Badge tone="cyan">Prévisualisation interne</Badge><p>La collecte publique est fermée. Seul l’administrateur peut consulter les tarifs et envoyer une demande de test. Le suivi reste manuel, sans e-mail automatique ni abonnement.</p></div>
    <div className="access-requests-live" role="status" aria-live="polite">{announcement || (loading ? "Chargement des demandes…" : "")}</div>
    {error && <div className="access-requests-error" role="alert"><p>{error}{data && " Les données ci-dessous datent de la dernière lecture réussie."}</p><Button type="button" variant="ghost" disabled={blocked} onClick={load}>Réessayer</Button></div>}
    {stats && <Surface><div className="access-requests-metrics"><Metric label="Demandes reçues" value={stats.total} detail="Tous les statuts, toutes les pages" /><Metric label="Équipes avec offre présentée" value={stats.presentedTeams} target={10} detail="Présentation renseignée manuellement" /><Metric label="Intentions d’achat confirmées" value={stats.confirmedTeams} target={3} detail="Équipes ayant validé une formule payante" /></div><p className="access-requests-caption">Les objectifs portent sur des équipes distinctes d’après le nom renseigné. Les nouvelles demandes et leur intention déclarée ne comptent pas comme validation. Les statuts « Offre présentée », « Intention confirmée après échange » et « Offre présentée, sans suite » alimentent le suivi des présentations.</p></Surface>}
    <Surface>
      <div className="access-requests-toolbar"><SelectInput label="Afficher les demandes" value={statusFilter} disabled={blocked} onChange={(value) => { setStatusFilter(value); setPage(1); setAnnouncement(""); }}><option value="">Tous les statuts</option>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</SelectInput><Button type="button" variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={blocked} onClick={load}>{loading ? "Actualisation…" : "Actualiser"}</Button></div>
      {!data && loading && <div aria-label="Chargement des demandes"><SkeletonRows count={3} /></div>}
      {data && <div aria-busy={loading} className="access-requests-list">{data.requests.length ? data.requests.map((request) => <RequestCard key={`${request.id}:${request.updatedAt}`} request={request} busy={busy || (loading ? "loading" : "")} onDirtyChange={handleDirtyChange} onSave={(id, status, adminNote) => mutate(id, "POST", { id, status, adminNote })} onDelete={(id) => mutate(id, "DELETE", { id })} />) : <EmptyState icon={ClipboardList} title={statusFilter ? "Aucune demande avec ce statut" : "Aucune demande pour le moment"} text={statusFilter ? "Choisis un autre statut pour retrouver les demandes enregistrées." : "Les demandes de test envoyées par l’administrateur depuis la prévisualisation des tarifs apparaîtront ici."} />}</div>}
      {pagination && <nav className="access-requests-pagination" aria-label="Pagination des demandes d’accès"><p>{pagination.total ? `${count((pagination.page - 1) * pagination.pageSize + 1)}–${count(Math.min(pagination.page * pagination.pageSize, pagination.total))} sur ${count(pagination.total)} demande${pagination.total > 1 ? "s" : ""}` : "0 demande"}</p><div><Button type="button" variant="ghost" icon={ChevronLeft} aria-label="Page précédente des demandes" disabled={blocked || pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} /><span>Page {pagination.page} / {Math.max(1, pagination.totalPages)}</span><Button type="button" variant="ghost" icon={ChevronRight} aria-label="Page suivante des demandes" disabled={blocked || pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)} /></div></nav>}
    </Surface>
  </div>;
}
