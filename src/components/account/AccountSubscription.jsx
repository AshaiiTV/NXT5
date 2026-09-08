import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { getSubscriptionPresentation, notifySubscriptionUpdated, SUBSCRIPTION_PLANS, SUBSCRIPTION_UPDATED_EVENT } from "../../app/subscriptions.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";

function dateLabel(value, inclusiveEnd = false) {
  const date = new Date(new Date(value).getTime() - (inclusiveEnd ? 1 : 0));
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}

export default function AccountSubscription({ compact = false }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!compact || typeof window === "undefined") return;
    const reload = () => setRefresh((value) => value + 1);
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, reload);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, reload);
      window.removeEventListener("focus", reload);
    };
  }, [compact]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    apiFetch("account-subscription")
      .then((result) => {
        if (!result?.subscription || !["none", "active", "scheduled", "expired", "revoked"].includes(result.subscription.status)) {
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
  const hasPass = subscription && subscription.planCode !== "free";

  if (compact) {
    const currentPlan = SUBSCRIPTION_PLANS.find((plan) => plan.code === subscription?.effectivePlanCode);
    if (loading) return <span role="status"><Badge tone="slate">Abonnement…</Badge></span>;
    if (error || !currentPlan) return <button type="button" className="min-h-11 rounded-xl" onClick={() => setRefresh((value) => value + 1)} title="Réessayer de charger ton abonnement" aria-label="Abonnement indisponible. Réessayer"><Badge tone="slate">Indisponible</Badge></button>;
    return <span aria-label={`Abonnement en cours : ${currentPlan.label}`}><Badge tone="cyan">{currentPlan.label}</Badge></span>;
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
      {hasPass ? <>
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-4 text-sm">
          <div><dt className="text-slate-400">Début</dt><dd className="mt-1 font-bold">{dateLabel(subscription.startsAt)}</dd></div>
          <div><dt className="text-slate-400">Fin incluse</dt><dd className="mt-1 font-bold">{subscription.endsAt ? dateLabel(subscription.endsAt, true) : "Sans date de fin"}</dd></div>
        </dl>
        {subscription.status !== "active" && <p className="mt-3 text-sm text-slate-300">{subscription.status === "scheduled" ? "Ce Pass prendra effet à la date de début indiquée." : "Ce Pass n’est plus actif."}</p>}
        <p className="mt-3 text-sm text-slate-400">Attribution manuelle, sans reconduction automatique. Pour une modification, contacte l’administration.</p>
      </> : <p className="mt-3 text-sm text-slate-300">Aucun Pass actif n’est attribué à ton profil.</p>}
    </div>}
  </section></Surface>;
}
