import React, { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { useAdminQuery } from "../../hooks/useAdminQuery.js";
import { Badge, Button, SkeletonRows, Surface } from "../../components/ui/Core.jsx";

const STATUSES = {
  pending: { label: "En attente", tone: "yellow" },
  paid: { label: "Payé", tone: "green" },
  cancelled: { label: "Annulé", tone: "red" },
  refunded: { label: "Remboursé", tone: "blue" },
};
const money = value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value) / 100);
const number = value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
const date = value => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Non renseignée";
const month = value => new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

function validateHistory(data) {
  if (!data?.pagination || !Array.isArray(data.purchases)) throw new Error("Les données d’achats sont indisponibles.");
}

function validateOverview(data) {
  if (!data?.totals || !Array.isArray(data.monthly)) throw new Error("Les données d’achats sont indisponibles.");
}

function LoadState({ loading, error, data, refresh }) {
  if (loading) return data ? <p className="purchase-message" role="status">Actualisation des achats…</p> : <div role="status" aria-label="Chargement des achats"><SkeletonRows count={3} /></div>;
  if (error) return <div className="purchase-message purchase-error" role="alert"><p>{error}{data && " Les données ci-dessous datent de la dernière lecture réussie."}</p><Button variant="ghost" onClick={() => { void refresh().catch(() => {}); }}>Réessayer</Button></div>;
  return null;
}

function Status({ value }) {
  const status = STATUSES[value] || { label: value, tone: "blue" };
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

function PurchaseDates({ purchase }) {
  return <div className="purchase-dates">
    <span>Commande : <time dateTime={purchase.orderedAt}>{date(purchase.orderedAt)}</time></span>
    {purchase.paidAt && <span>Paiement : <time dateTime={purchase.paidAt}>{date(purchase.paidAt)}</time></span>}
    {purchase.refundedAt && <span>Remboursement : <time dateTime={purchase.refundedAt}>{date(purchase.refundedAt)}</time></span>}
  </div>;
}

export function PurchaseHistory() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "", page: 1 });
  const params = new URLSearchParams({ page: String(filters.page), pageSize: "10" });
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  const state = useAdminQuery(`admin-purchases?${params}`, { validate: validateHistory });
  const { data, loading, refresh } = state;
  const hasFilters = Boolean(filters.q || filters.status);
  const pagination = data?.pagination;

  return <Surface className="purchase-section">
    <div className="purchase-heading"><div><h3>Historique des achats</h3><p>Toutes les commandes, de la plus récente à la plus ancienne. Montants TTC en euros.</p></div>
      <Button variant="ghost" disabled={loading} onClick={() => { void refresh().catch(() => {}); }}><RefreshCw size={16} aria-hidden="true" />Actualiser</Button>
    </div>
    <form className="purchase-filters" role="search" aria-label="Rechercher dans les achats" onSubmit={event => { event.preventDefault(); setFilters(previous => ({ ...previous, q: query.trim(), page: 1 })); }}>
      <label className="purchase-search"><span>Référence, client, équipe ou offre</span><input type="search" value={query} maxLength={160} placeholder="Rechercher une commande" onChange={event => setQuery(event.target.value)} /></label>
      <label><span>Statut</span><select value={filters.status} onChange={event => setFilters(previous => ({ ...previous, status: event.target.value, page: 1 }))}>
        <option value="">Tous les statuts</option>{Object.entries(STATUSES).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}
      </select></label>
      <Button type="submit" variant="ghost"><Search size={16} aria-hidden="true" />Rechercher</Button>
      {hasFilters && <Button variant="ghost" type="button" onClick={() => { setQuery(""); setFilters({ q: "", status: "", page: 1 }); }}>Effacer les filtres</Button>}
    </form>
    <LoadState {...state} />
    {data && <>
      <p className="purchase-count" role="status">{number(pagination.total)} commande{pagination.total > 1 ? "s" : ""}{hasFilters ? " correspondant aux filtres" : " dans l’historique"}</p>
      {data.purchases.length === 0 ? <div className="purchase-empty"><ShoppingBag size={28} aria-hidden="true" /><h4>{hasFilters ? "Aucun achat pour ces filtres" : "Aucun achat enregistré"}</h4>
        <p>{hasFilters ? "Modifie la recherche ou efface les filtres pour retrouver toutes les commandes." : "Les commandes apparaîtront ici avec leur référence, leur tarif et leur statut dès leur enregistrement. Les demandes d’accès ne constituent pas des achats."}</p>
      </div> : <>
        <div className="purchase-desktop nxt5-responsive-scroll"><table className="purchase-table"><caption className="sr-only">Historique complet des achats, montants TTC en euros</caption>
          <thead><tr><th scope="col">Commande / client</th><th scope="col">Offre / tarif</th><th scope="col">Montant TTC</th><th scope="col">Dates</th><th scope="col">Statut</th></tr></thead>
          <tbody>{data.purchases.map(purchase => <tr key={purchase.id}>
            <th scope="row"><strong>{purchase.reference}</strong><span>{purchase.customerName}</span>{purchase.teamName && <span>{purchase.teamName}</span>}</th>
            <td><strong>{purchase.planLabel}</strong><span>{money(purchase.unitAmountCents)} × {number(purchase.quantity)}</span></td>
            <td className="purchase-amount">{money(purchase.amountCents)}</td><td><PurchaseDates purchase={purchase} /></td><td><Status value={purchase.status} /></td>
          </tr>)}</tbody></table></div>
        <ul className="purchase-mobile" aria-label="Commandes">{data.purchases.map(purchase => <li key={purchase.id}>
          <div className="purchase-card-top"><h4>{purchase.reference}</h4><Status value={purchase.status} /></div>
          <p>{purchase.customerName}{purchase.teamName && ` · ${purchase.teamName}`}</p>
          <dl><div><dt>Offre</dt><dd>{purchase.planLabel}</dd></div><div><dt>Tarif unitaire TTC</dt><dd>{money(purchase.unitAmountCents)}</dd></div><div><dt>Quantité</dt><dd>{number(purchase.quantity)}</dd></div><div><dt>Montant TTC</dt><dd className="purchase-amount">{money(purchase.amountCents)}</dd></div></dl>
          <PurchaseDates purchase={purchase} />
        </li>)}</ul>
        <nav className="purchase-pagination" aria-label="Pagination des achats">
          <p>Page {number(pagination.page)} sur {number(pagination.totalPages)}</p>
          <div><Button variant="ghost" disabled={pagination.page <= 1} aria-label="Page précédente des achats" onClick={() => setFilters(previous => ({ ...previous, page: pagination.page - 1 }))}><ChevronLeft size={16} aria-hidden="true" />Précédent</Button>
            <Button variant="ghost" disabled={pagination.page >= pagination.totalPages} aria-label="Page suivante des achats" onClick={() => setFilters(previous => ({ ...previous, page: pagination.page + 1 }))}>Suivant<ChevronRight size={16} aria-hidden="true" /></Button></div>
        </nav>
      </>}
    </>}
  </Surface>;
}

function Metric({ label, value, note }) {
  return <div className="purchase-metric"><p>{label}</p><strong>{value}</strong><span>{note}</span></div>;
}

export function PurchaseOverview() {
  const state = useAdminQuery("admin-purchases?view=overview", { validate: validateOverview });
  const { data, loading, refresh } = state;
  const totals = data?.totals;
  const [field, setField] = useState("count");
  const max = Math.max(1, ...(data?.monthly || []).map(row => row[field]));
  const delta = totals?.paidPrevious30d ? ((totals.paid30d - totals.paidPrevious30d) / totals.paidPrevious30d) * 100 : null;
  return <Surface className="purchase-section">
    <div className="purchase-heading"><div><h3>Bilan commercial</h3><p>Indicateurs consolidés sur tout l’historique, indépendants des filtres de recherche des commandes.</p></div>
      <Button variant="ghost" disabled={loading} onClick={() => { void refresh().catch(() => {}); }}><RefreshCw size={16} aria-hidden="true" />Actualiser les achats</Button>
    </div>
    <LoadState {...state} />
    {totals && <>
      <div className="purchase-metrics">
        <Metric label="Commandes" value={number(totals.orders)} note={`${number(totals.paid)} payées · ${number(totals.pending)} en attente`} />
        <Metric label="Montant des achats payés" value={money(totals.paidCents)} note="TTC · hors achats annulés ou remboursés" />
        <Metric label="Panier moyen payé" value={totals.paid ? money(totals.averageCents) : "Non disponible"} note="Montant payé / nombre d’achats payés" />
        <Metric label="Fréquence sur 30 jours" value={`${number(totals.frequency30d)} / jour`} note={`${number(totals.paid30d)} achats payés sur les 30 derniers jours`} />
      </div>
      <div className="purchase-insights"><p><strong>Tendance sur 30 jours : </strong>{delta === null ? "Pas de base de comparaison sur les 30 jours précédents." : `${delta > 0 ? "+" : ""}${number(delta)} % d’achats payés par rapport aux 30 jours précédents.`}</p>
        <p>{number(totals.cancelled)} commandes annulées · {number(totals.refunded)} remboursées</p></div>
      <div className="purchase-trend-heading"><div><h4>Tendance des achats payés</h4><p>12 mois calendaires · mois en cours partiel · dates de paiement en UTC</p></div>
        <label><span>Indicateur du graphique</span><select value={field} onChange={event => setField(event.target.value)}><option value="count">Nombre d’achats</option><option value="amountCents">Montant TTC</option></select></label>
      </div>
      {!totals.orders && <p className="purchase-message">Aucun achat enregistré. Les indicateurs évolueront avec les premières commandes.</p>}
      <ol className="purchase-trend" aria-label={`${field === "count" ? "Nombre d’achats payés" : "Montant des achats payés"} par mois`}>
        {data.monthly.map(row => <li key={row.date}><span className="purchase-month">{month(row.date)}</span><span className="purchase-bar" aria-hidden="true"><span style={{ width: `${row[field] / max * 100}%` }} /></span><strong>{field === "count" ? number(row.count) : money(row.amountCents)}</strong></li>)}
      </ol>
      <p className="purchase-footnote">Mis à jour le {date(data.generatedAt)}. Les remboursements sont exclus des achats payés, y compris des périodes précédentes.</p>
    </>}
  </Surface>;
}
