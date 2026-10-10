import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { getSubscriptionPresentation, notifySubscriptionUpdated, subscriptionPeriodLabel, SUBSCRIPTION_UPDATED_EVENT } from "../../app/subscriptions.js";
import { DISCOVERY_TRIAL_DAYS } from "../../app/pass-access.js";
import { Badge, Button, Surface } from "../ui/Core.jsx";
import "./account-subscription.css";

export default function AccountSubscription({ compact = false }) {
  useLanguage();
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
    // Keep the known badge visible while focus/update events revalidate it.
    if (loading && !subscription) return <span role="status"><Badge tone="slate">{t("Abonnement…")}</Badge></span>;
    if (error || !presentation) return <button type="button" className="min-h-11 rounded-[2px]" onClick={() => setRefresh((value) => value + 1)} title={t("Réessayer de charger ton abonnement")} aria-label={t("Abonnement indisponible. Réessayer")}><Badge tone="slate">{t("Indisponible")}</Badge></button>;
    const statusSuffix = subscription.status === "active" || subscription.status === "none" ? "" : ` · ${t(presentation.statusLabel)}`;
    return <span aria-label={t("Abonnement : {0}{1}", [t(presentation.label), subscription.status === "none" ? "" : ` · ${t(presentation.statusLabel)}`])}><Badge tone={presentation.tone}>{t(presentation.label)}{statusSuffix}</Badge></span>;
  }

  return <Surface className="mb-5 account-subscription"><section aria-labelledby="account-subscription-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="account-subscription-title" className="text-lg font-semibold">{t("Mon abonnement")}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{t("La formule et les dates associées à ton compte par l’administration.")}</p></div>
      <Button type="button" variant="ghost" icon={loading ? Loader2 : RefreshCw} disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{loading ? t("Vérification…") : t("Actualiser l’abonnement")}</Button>
    </div>
    {loading && !subscription && <p className="mt-4 text-sm text-slate-300" role="status">{t("Chargement de ton abonnement…")}</p>}
    {error && <p className="account-subscription-error" role="alert">{t(error)}</p>}
    {subscription && <div className="account-subscription-detail">
      <div className="flex flex-wrap items-center gap-3"><p className="account-subscription-plan">{t(presentation.label)}</p><Badge tone={presentation.tone}>{t(presentation.statusLabel)}</Badge></div>
      {hasAttribution ? <>
        {isDiscovery && <p className="mt-3 text-sm leading-6 text-slate-300">{t("Au lancement des offres, Découverte comprendra ")}{DISCOVERY_TRIAL_DAYS}{t(" jours d’accès à tous les outils, sauf le bot Discord, réservé au Pass Équipe. Après cet essai, le Pass Équipe sera nécessaire pour continuer à les utiliser lorsque les abonnements seront lancés.")}</p>}
        <dl className="mt-4 text-sm leading-6">
          <div><dt className="text-slate-400">{isDiscovery ? t("Période de l’essai") : t("Période du Pass")}</dt><dd className="mt-1 font-bold">{t(subscriptionPeriodLabel(subscription))}</dd></div>
        </dl>
        {isDiscovery ? <>
          {subscription.status === "pending" && <p className="mt-3 text-sm text-slate-300">{t("Ton essai n’a pas encore commencé. Aucune période n’est décomptée.")}</p>}
          {subscription.status === "scheduled" && <p className="mt-3 text-sm text-slate-300">{t("Cet essai prendra effet à la date de début indiquée.")}</p>}
          {subscription.status === "revoked" && <p className="mt-3 text-sm text-slate-300">{t("L’attribution de cet essai a été retirée.")}</p>}
        </> : subscription.status !== "active" && <p className="mt-3 text-sm text-slate-300">{subscription.status === "scheduled" ? t("Ce Pass prendra effet à la date de début indiquée.") : t("Ce Pass n’est plus actif.")}</p>}
      </> : <p className="mt-3 text-sm text-slate-300">{t("Aucun abonnement n’est attribué à ton profil.")}</p>}
      <p className="account-subscription-launch">{t("Les abonnements ne sont pas encore lancés : tous les outils restent accessibles, quel que soit le statut indiqué ici.")}</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">{t("Une attribution manuelle ne déclenche aucun paiement ni reconduction automatique. Pour une modification, contacte l’administration.")}</p>
    </div>}
  </section></Surface>;
}
