import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { getSubscriptionPresentation, notifySubscriptionUpdated, subscriptionPeriodLabel, SUBSCRIPTION_UPDATED_EVENT } from "../../app/subscriptions.js";
import { DISCOVERY_TRIAL_DAYS } from "../../app/pass-access.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";

export default function AccountSubscription({ compact = false }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reload = () => setRefresh((value) => value + 1);
    // The full view announces successful updates; only the badge listens to them.
    if (compact) window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, reload);
    window.addEventListener("focus", reload);
    return () => {
      if (compact) window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, reload);
      window.removeEventListener("focus", reload);
    };
  }, [compact]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    apiFetch("account-subscription")
      .then((result) => {
        if (!result?.subscription || !["none", "pending", "active", "scheduled", "expired", "revoked"].includes(result.subscription.status)) {
          throw new Error("L’abonnement n’a pas pu être vérifié.");
        }
        if (current) {
          setSubscription(result.subscription);
          if (!compact) notifySubscriptionUpdated();
        }
      })
      .catch((err) => { if (current) { setSubscription(null); setError(err.message || "Impossible de charger ton abonnement."); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [compact, refresh]);

  const presentation = subscription ? getSubscriptionPresentation(subscription) : null;
  const hasAttribution = subscription && subscription.status !== "none";
  const isDiscovery = hasAttribution && subscription.planCode === "free";

  if (compact) {
    if (loading) return <span role="status"><Badge tone="slate">Abonnement…</Badge></span>;
    if (error || !presentation) return <button type="button" className="min-h-11 rounded-xl" onClick={() => setRefresh((value) => value + 1)} title="Réessayer de charger ton abonnement" aria-label="Abonnement indisponible. Réessayer"><Badge tone="slate">Indisponible</Badge></button>;
    const statusSuffix = subscription.status === "active" || subscription.status === "none" ? "" : ` · ${presentation.statusLabel}`;
    return <span aria-label={`Abonnement : ${presentation.label}${subscription.status === "none" ? "" : ` · ${presentation.statusLabel}`}`}><Badge tone={presentation.tone}>{presentation.label}{statusSuffix}</Badge></span>;
  }

  return <Surface className="mb-5"><section aria-labelledby="account-subscription-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="account-subscription-title" className="text-xl font-black">Mon abonnement</h3><p className="mt-2 text-sm leading-6 text-slate-300">La formule attribuée à ton profil par l’administration.</p></div>
      <Button type="button" variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{loading ? "Vérification…" : "Actualiser l’abonnement"}</Button>
    </div>
    {loading && !subscription && <p className="mt-4 text-sm text-slate-300" role="status">Chargement de ton abonnement…</p>}
    {error && <p className="mt-4 text-sm text-rose-200" role="alert">{error}</p>}
    {subscription && <div className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center gap-3"><p className="text-2xl font-black">{presentation.label}</p><Badge tone={presentation.tone}>{presentation.statusLabel}</Badge></div>
      {hasAttribution ? <>
        {isDiscovery && <p className="mt-3 text-sm leading-6 text-slate-300">Découverte comprend {DISCOVERY_TRIAL_DAYS} jours d’accès à tous les outils. Après cet essai, le Pass Équipe sera nécessaire pour continuer à les utiliser lorsque les abonnements seront lancés.</p>}
        <dl className="mt-4 text-sm leading-6">
          <div><dt className="text-slate-400">{isDiscovery ? "Période de l’essai" : "Période du Pass"}</dt><dd className="mt-1 font-bold">{subscriptionPeriodLabel(subscription)}</dd></div>
        </dl>
        {isDiscovery ? <>
          {subscription.status === "pending" && <p className="mt-3 text-sm text-slate-300">Ton essai n’a pas encore commencé. Aucune période n’est décomptée.</p>}
          {subscription.status === "scheduled" && <p className="mt-3 text-sm text-slate-300">Cet essai prendra effet à la date de début indiquée.</p>}
          {subscription.status === "revoked" && <p className="mt-3 text-sm text-slate-300">L’attribution de cet essai a été retirée.</p>}
        </> : subscription.status !== "active" && <p className="mt-3 text-sm text-slate-300">{subscription.status === "scheduled" ? "Ce Pass prendra effet à la date de début indiquée." : "Ce Pass n’est plus actif."}</p>}
      </> : <p className="mt-3 text-sm text-slate-300">Aucun abonnement n’est attribué à ton profil.</p>}
      <p className="mt-3 text-sm leading-6 text-cyan-100">Les abonnements ne sont pas encore lancés : tous les outils restent accessibles, quel que soit le statut indiqué ici.</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">Une attribution manuelle ne déclenche aucun paiement ni reconduction automatique. Pour une modification, contacte l’administration.</p>
    </div>}
  </section></Surface>;
}
