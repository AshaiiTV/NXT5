import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, SelectInput, SkeletonRows, Surface, TextInput } from "../../components/ui/Core.jsx";

const STATUSES = {
  pending: { label: "En attente", tone: "yellow" },
  paid: { label: "Payé", tone: "green" },
  cancelled: { label: "Annulé", tone: "red" },
  refunded: { label: "Remboursé", tone: "blue" },
};
const money = value => new Intl.NumberFormat(getLocale(), { style: "currency", currency: "EUR" }).format(Number(value) / 100);
const number = value => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(value);
const date = value => value ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : t("Non renseignée");
const month = value => new Intl.DateTimeFormat(getLocale(), { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

function usePurchases(path) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ path: "", loading: true, data: null, error: "" });
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setState({ path, loading: true, data: null, error: "" });
    apiFetch(path, { signal: controller.signal }).then(data => {
      const overview = new URLSearchParams(path.split("?")[1]).get("view") === "overview";
      if (!data || typeof data !== "object" || (overview
        ? !data.totals || !Array.isArray(data.monthly)
        : !data.pagination || !Array.isArray(data.purchases))) {
        throw new Error("Les données d’achats reçues sont incomplètes. Réessaie dans quelques instants.");
      }
      if (current) setState({ path, loading: false, data, error: "" });
    }).catch(error => { if (current) setState({ path, loading: false, data: null, error: error.message }); });
    return () => { current = false; controller.abort(); };
  }, [path, revision]);
  const visible = state.path === path ? state : { loading: true, data: null, error: "" };
  return { ...visible, retry: () => setRevision(value => value + 1) };
}

function LoadState({ loading, error, retry }) {
  useLanguage();
  if (loading) return <div role="status" aria-label={t("Chargement des achats")}><SkeletonRows count={3} /></div>;
  if (error) return <div className="purchase-message purchase-error" role="alert"><p>{t(error)}</p><Button variant="ghost" onClick={retry}>{t("Réessayer")}</Button></div>;
  return null;
}

function Status({ value }) {
  useLanguage();
  const status = STATUSES[value] || { label: value, tone: "blue" };
  return <Badge tone={status.tone}>{t(status.label)}</Badge>;
}

function PurchaseDates({ purchase }) {
  useLanguage();
  return <div className="purchase-dates">
    <span>{t("Commande : ")}<time dateTime={purchase.orderedAt}>{date(purchase.orderedAt)}</time></span>
    {purchase.paidAt && <span>{t("Paiement : ")}<time dateTime={purchase.paidAt}>{date(purchase.paidAt)}</time></span>}
    {purchase.refundedAt && <span>{t("Remboursement : ")}<time dateTime={purchase.refundedAt}>{date(purchase.refundedAt)}</time></span>}
  </div>;
}

export function PurchaseHistory() {
  useLanguage();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "", page: 1 });
  const params = new URLSearchParams({ page: String(filters.page), pageSize: "10" });
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  const state = usePurchases(`admin-purchases?${params}`);
  const { data, loading, error, retry } = state;
  const hasFilters = Boolean(filters.q || filters.status);
  const pagination = data?.pagination;

  return <Surface className="purchase-section">
    <div className="purchase-heading"><div><h3>{t("Historique des achats")}</h3><p>{t("Toutes les commandes, de la plus récente à la plus ancienne. Montants TTC en euros.")}</p></div>
      <Button variant="ghost" disabled={loading} onClick={retry}><RefreshCw size={16} aria-hidden="true" />{t("Actualiser")}</Button>
    </div>
    <form className="purchase-filters" role="search" aria-label={t("Rechercher dans les achats")} onSubmit={event => { event.preventDefault(); setFilters(previous => ({ ...previous, q: query.trim(), page: 1 })); }}>
      <div className="purchase-search"><TextInput label={t("Référence, client, équipe ou offre")} type="search" value={query} maxLength={160} placeholder={t("Rechercher une commande")} onChange={setQuery} /></div>
      <SelectInput label={t("Statut")} aria-label={t("Statut")} value={filters.status} onChange={status => setFilters(previous => ({ ...previous, status, page: 1 }))}>
        <option value="">{t("Tous les statuts")}</option>{Object.entries(STATUSES).map(([value, status]) => <option key={value} value={value}>{t(status.label)}</option>)}
      </SelectInput>
      <Button type="submit" variant="primary"><Search size={16} aria-hidden="true" />{t("Rechercher")}</Button>
      {hasFilters && <Button variant="ghost" type="button" onClick={() => { setQuery(""); setFilters({ q: "", status: "", page: 1 }); }}>{t("Effacer les filtres")}</Button>}
    </form>
    <LoadState {...state} />
    {!loading && !error && data && <>
      <p className="purchase-count" role="status">{number(pagination.total)}{t(" commande")}{pagination.total > 1 ? "s" : ""}{hasFilters ? t(" correspondant aux filtres") : t(" dans l’historique")}</p>
      {data.purchases.length === 0 ? <div className="purchase-empty"><ShoppingBag size={28} aria-hidden="true" /><h4>{hasFilters ? t("Aucun achat pour ces filtres") : t("Aucun achat enregistré")}</h4>
        <p>{hasFilters ? t("Modifie la recherche ou efface les filtres pour retrouver toutes les commandes.") : t("Les commandes apparaîtront ici avec leur référence, leur tarif et leur statut dès leur enregistrement. Les demandes d’accès ne constituent pas des achats.")}</p>
      </div> : <>
        <div className="purchase-desktop nxt5-responsive-scroll" role="region" aria-label={t("Historique des achats")} tabIndex={0}><table className="purchase-table"><caption className="sr-only">{t("Historique complet des achats, montants TTC en euros")}</caption>
          <thead><tr><th scope="col">{t("Commande / client")}</th><th scope="col">{t("Offre / tarif")}</th><th scope="col">{t("Montant TTC")}</th><th scope="col">{t("Dates")}</th><th scope="col">{t("Statut")}</th></tr></thead>
          <tbody>{data.purchases.map(purchase => <tr key={purchase.id}>
            <th scope="row"><strong>{purchase.reference}</strong><span>{purchase.customerName}</span>{purchase.teamName && <span>{purchase.teamName}</span>}</th>
            <td><strong>{purchase.planLabel}</strong><span>{money(purchase.unitAmountCents)} × {number(purchase.quantity)}</span></td>
            <td className="purchase-amount">{money(purchase.amountCents)}</td><td><PurchaseDates purchase={purchase} /></td><td><Status value={purchase.status} /></td>
          </tr>)}</tbody></table></div>
        <ul className="purchase-mobile" aria-label={t("Commandes")}>{data.purchases.map(purchase => <li key={purchase.id}>
          <div className="purchase-card-top"><h4><span className="purchase-card-eyebrow">{t("Commande")}</span>{purchase.reference}</h4><Status value={purchase.status} /></div>
          <p>{purchase.customerName}{purchase.teamName && ` · ${purchase.teamName}`}</p>
          <dl><div><dt>{t("Offre")}</dt><dd>{purchase.planLabel}</dd></div><div><dt>{t("Tarif unitaire TTC")}</dt><dd>{money(purchase.unitAmountCents)}</dd></div><div><dt>{t("Quantité")}</dt><dd>{number(purchase.quantity)}</dd></div><div><dt>{t("Montant TTC")}</dt><dd className="purchase-amount">{money(purchase.amountCents)}</dd></div></dl>
          <PurchaseDates purchase={purchase} />
        </li>)}</ul>
        <nav className="purchase-pagination" aria-label={t("Pagination des achats")}>
          <p>{t("Page ")}{number(pagination.page)}{t(" sur ")}{number(pagination.totalPages)}</p>
          <div><Button variant="ghost" disabled={pagination.page <= 1} aria-label={t("Page précédente des achats")} onClick={() => setFilters(previous => ({ ...previous, page: pagination.page - 1 }))}><ChevronLeft size={16} aria-hidden="true" />{t("Précédent")}</Button>
            <Button variant="ghost" disabled={pagination.page >= pagination.totalPages} aria-label={t("Page suivante des achats")} onClick={() => setFilters(previous => ({ ...previous, page: pagination.page + 1 }))}>{t("Suivant")}<ChevronRight size={16} aria-hidden="true" /></Button></div>
        </nav>
      </>}
    </>}
  </Surface>;
}

function Metric({ label, value, note }) {
  useLanguage();
  return <div className="purchase-metric"><p>{t(label)}</p><strong>{value}</strong><span>{t(note)}</span></div>;
}

export function PurchaseOverview() {
  useLanguage();
  const state = usePurchases("admin-purchases?view=overview");
  const { data, loading, error, retry } = state;
  const totals = data?.totals;
  const [field, setField] = useState("count");
  const max = Math.max(1, ...(data?.monthly || []).map(row => row[field]));
  const delta = totals?.paidPrevious30d ? ((totals.paid30d - totals.paidPrevious30d) / totals.paidPrevious30d) * 100 : null;
  return <Surface className="purchase-section">
    <div className="purchase-heading"><div><h3>{t("Bilan commercial")}</h3><p>{t("Indicateurs consolidés sur tout l’historique, indépendants des filtres de recherche des commandes.")}</p></div>
      <Button variant="ghost" disabled={loading} onClick={retry}><RefreshCw size={16} aria-hidden="true" />{t("Actualiser les achats")}</Button>
    </div>
    <LoadState {...state} />
    {!loading && !error && totals && <>
      <div className="purchase-metrics">
        <Metric label={t("Commandes")} value={number(totals.orders)} note={t("{0} payées · {1} en attente", [number(totals.paid), number(totals.pending)])} />
        <Metric label={t("Montant des achats payés")} value={money(totals.paidCents)} note={t("TTC · hors achats annulés ou remboursés")} />
        <Metric label={t("Panier moyen payé")} value={totals.paid ? money(totals.averageCents) : "Non disponible"} note={t("Montant payé / nombre d’achats payés")} />
        <Metric label={t("Fréquence sur 30 jours")} value={`${number(totals.frequency30d)} / jour`} note={t("{0} achats payés sur les 30 derniers jours", [number(totals.paid30d)])} />
      </div>
      <div className="purchase-insights"><p><strong>{t("Tendance sur 30 jours : ")}</strong>{delta === null ? t("Pas de base de comparaison sur les 30 jours précédents.") : t("{0}{1} % d’achats payés par rapport aux 30 jours précédents.", [delta > 0 ? "+" : "", number(delta)])}</p>
        <p>{number(totals.cancelled)}{t(" commandes annulées · ")}{number(totals.refunded)}{t(" remboursées")}</p></div>
      <div className="purchase-trend-heading"><div><h4>{t("Tendance des achats payés")}</h4><p>{t("12 mois calendaires · mois en cours partiel · dates de paiement en UTC")}</p></div>
        <SelectInput label={t("Indicateur du graphique")} aria-label={t("Indicateur du graphique")} value={field} onChange={setField}><option value="count">{t("Nombre d’achats")}</option><option value="amountCents">{t("Montant TTC")}</option></SelectInput>
      </div>
      {!totals.orders && <p className="purchase-message">{t("Aucun achat enregistré. Les indicateurs évolueront avec les premières commandes.")}</p>}
      <ol className="purchase-trend" aria-label={t("{0} par mois", [field === "count" ? t("Nombre d’achats payés") : t("Montant des achats payés")])}>
        {data.monthly.map(row => <li key={row.date}><span className="purchase-month">{month(row.date)}</span><span className="purchase-bar" aria-hidden="true"><span style={{ width: `${row[field] / max * 100}%` }} /></span><strong>{field === "count" ? number(row.count) : money(row.amountCents)}</strong></li>)}
      </ol>
      <p className="purchase-footnote">{t("Mis à jour le ")}{date(data.generatedAt)}{t(". Les remboursements sont exclus des achats payés, y compris des périodes précédentes.")}</p>
    </>}
  </Surface>;
}
