import React, { useEffect, useState } from "react";
import { BarChart3, ShoppingBag } from "lucide-react";
import { Button, PageHeader } from "../../components/ui/Core.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import { PurchaseHistory, PurchaseOverview } from "./Purchases.jsx";
import "./administration.css";

const TABS = [
  { id: "achats", label: "Achats", icon: ShoppingBag },
  { id: "vue-ensemble", label: "Vue d’ensemble", icon: BarChart3 },
];

export default function AdministrationPage({ route, navigate }) {
  const active = new URLSearchParams(route?.search || "").get("tab") === "vue-ensemble" ? "vue-ensemble" : "achats";
  const [visited, setVisited] = useState(() => new Set([active]));
  useEffect(() => { setVisited(previous => new Set([...previous, active])); }, [active]);

  function changeTab(id, focus = false) {
    const params = new URLSearchParams(route?.search || "");
    params.set("tab", id);
    navigate(`/admin?${params}`);
    if (focus) document.getElementById(`administration-tab-${id}`)?.focus();
  }

  return <div className="nxt5-data-dense administration-page">
    <PageHeader eyebrow="Espace administrateur" title="Administration" subtitle="Consulte les commandes et suis l’activité de NXT5 dans deux vues dédiées.">
      <Button variant="ghost" icon={BarChart3} onClick={() => navigate("/admin/frequentation")}>Fréquentation du site</Button>
      <Button variant="ghost" onClick={() => navigate("/admin/abonnements")}>Profils et abonnements</Button>
      <Button variant="ghost" onClick={() => navigate("/admin/demandes-acces")}>Demandes d’accès</Button>
      <Button variant="ghost" onClick={() => navigate("/tarifs")}>Voir les tarifs</Button>
    </PageHeader>
    <div className="administration-tabs" role="tablist" aria-label="Administration">
      {TABS.map(({ id, label, icon: Icon }, index) => <button key={id} type="button" role="tab"
        id={`administration-tab-${id}`} aria-selected={active === id} aria-controls={`administration-panel-${id}`}
        tabIndex={active === id ? 0 : -1} onClick={() => changeTab(id)} onKeyDown={event => {
          let next;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = (index + 1) % TABS.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = TABS.length - 1;
          if (next !== undefined) { event.preventDefault(); changeTab(TABS[next].id, true); }
        }}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}
    </div>
    <section role="tabpanel" id="administration-panel-achats" aria-labelledby="administration-tab-achats" hidden={active !== "achats"} tabIndex={0}>
      {(visited.has("achats") || active === "achats") && <PurchaseHistory />}
    </section>
    <section role="tabpanel" id="administration-panel-vue-ensemble" aria-labelledby="administration-tab-vue-ensemble" hidden={active !== "vue-ensemble"} tabIndex={0}>
      {(visited.has("vue-ensemble") || active === "vue-ensemble") && <div className="administration-overview">
        <PurchaseOverview />
        <AdminDashboard navigate={navigate} embedded />
      </div>}
    </section>
  </div>;
}
