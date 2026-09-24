import React, { useEffect, useState } from "react";
import { Download, Loader2, Plug, RefreshCw } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import checklistUrl from "../../../docs/shopify-et-checklist-juridique.md?url";
import { DiscordAdminStatus } from "../../components/discord/DiscordSettings.jsx";
import "./integrations.css";

const LEGAL_TASKS = [
  ["Identité du vendeur", "Nom et prénoms avec la mention EI, adresse professionnelle, SIREN/SIRET, immatriculation, e-mail et téléphone. Confirmer le régime de TVA."],
  ["Contrat et CGV", "Préciser qui achète, les fonctionnalités, le prix, la durée, le renouvellement, la résiliation et les garanties. Faire valider les clauses propres au service NXT5."],
  ["Rétractation et remboursements", "Définir les modalités pour le service numérique et fournir le formulaire adapté. Pour des produits physiques, ajouter les conditions et l’adresse de retour."],
  ["Mentions et confidentialité", "Actualiser l’éditeur et le responsable de traitement. Décrire les flux Shopify, les prestataires, les durées et les droits. Recenser les cookies réellement utilisés."],
  ["Médiation et paiement", "Choisir le médiateur compétent et souscrire sa convention. Compléter les vérifications Shopify Payments directement chez Shopify."],
  ["Avant la première vente", "Publier les textes validés et tester la commande, la facture, la rétractation, le remboursement et la résiliation. Prévoir l’activation des accès NXT5 après paiement."],
];

export default function IntegrationsPage({ navigate }) {
  const [status, setStatus] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setStatus(null);
    setConnection(null);
    setError("");
    apiFetch("admin-shopify", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setStatus(data); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  async function testConnection() {
    setTesting(true);
    setConnection(null);
    setError("");
    try {
      setConnection(await apiFetch("admin-shopify", { method: "POST" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="admin-integration-page">
      <PageHeader
        eyebrow="Configuration"
        title="Intégrations"
        subtitle="Vérifie les connexions Shopify et Discord, et retrouve les liens vers les réseaux sociaux."
      />
      <Surface className="admin-integration-card">
        <div className="admin-integration-content">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="admin-integration-title"><Plug aria-hidden="true" className="h-6 w-6 text-cyan-200" />Shopify</h3>
            <Badge tone={connection ? "cyan" : "slate"}>{loading ? "Chargement" : connection ? "Connexion vérifiée" : status?.configured ? "Prêt à tester" : "À configurer"}</Badge>
          </div>
          <p className="text-sm leading-7 text-slate-200">Le connecteur lit le nom, le domaine et la devise de la boutique. La mise en vente et l’activation automatique des abonnements restent à finaliser.</p>
          {loading && <p role="status" className="text-sm">Lecture de la configuration…</p>}
          {status && <dl className="admin-integration-facts"><div><dt>Boutique</dt><dd>{status.domain || "À renseigner"}</dd></div><div><dt>Version de l’API</dt><dd>{status.apiVersion || "À corriger"}</dd></div></dl>}
          {!!status?.issues?.length && <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-amber-100">{status.issues.map((issue) => <li className="break-words" key={issue}>{issue}</li>)}</ul>}
          <details className="admin-integration-help"><summary>Configurer la connexion Shopify</summary><p className="text-sm leading-7 text-slate-300">Dans les variables serveur Netlify, renseigne <code>SHOPIFY_SHOP_DOMAIN</code>, <code>SHOPIFY_CLIENT_ID</code> et <code>SHOPIFY_CLIENT_SECRET</code>, puis redéploie. Le guide de configuration détaille la création de l’application et son installation.</p></details>
          {error && <p role="alert" className="admin-integration-error">{error}</p>}
          {connection && <div role="status" className="admin-integration-result">
            <p className="font-semibold">{connection.shop.name}</p>
            <p className="break-words">{connection.shop.domain} · {connection.shop.currency}</p>
            <p>Vérifiée le {new Date(connection.checkedAt).toLocaleString("fr-FR")}. API utilisée : {connection.apiVersion}.</p>
            {connection.apiVersion !== connection.requestedApiVersion && <p className="text-amber-100">Shopify a remplacé la version demandée. Actualise SHOPIFY_API_VERSION avec une version prise en charge.</p>}
          </div>}
          <a href={checklistUrl} download="nxt5-guide-shopify.md" className="inline-flex min-h-11 max-w-full items-center gap-2 text-sm font-bold text-cyan-100 underline underline-offset-4">
            <Download aria-hidden="true" className="h-4 w-4 shrink-0" /><span>Télécharger le guide de configuration</span>
          </a>
          <div className="flex flex-wrap gap-3">
            <Button type="button" icon={testing ? Loader2 : Plug} disabled={loading || testing || !status?.configured} onClick={testConnection}>{testing ? "Connexion en cours…" : "Tester la connexion"}</Button>
            <Button type="button" icon={RefreshCw} variant="ghost" disabled={loading || testing} onClick={() => setRevision((value) => value + 1)}>Actualiser</Button>
          </div>
        </div>
      </Surface>
      <DiscordAdminStatus />
      <Surface>
        <div className="admin-integration-content">
          <h3 className="admin-integration-title">Réseaux sociaux</h3>
          <p className="text-sm leading-7 text-slate-200">Consulte les liens publics de NXT5 et les réseaux renseignés sur le site.</p>
          <LinkButton href="/reseaux" navigate={navigate} variant="ghost">Voir la page Réseaux</LinkButton>
        </div>
      </Surface>
    </div>
  );
}

export function LegalReadinessPage() {
  return (
    <div className="admin-integration-page">
      <PageHeader
        eyebrow="Ventes et accès"
        title="Préparer la vente"
        subtitle="Retrouve les documents et les étapes à préparer avant la commercialisation de NXT5."
      />
      <Surface>
        <div className="admin-integration-content">
          <h3 className="admin-integration-title">Check-list juridique</h3>
          <p className="text-sm leading-7 text-slate-200">Les textes actuels présentent un service gratuit édité à titre non professionnel. Avant de vendre, les documents ci-dessous doivent correspondre à l’entreprise et à l’offre réellement proposées.</p>
          <ol className="admin-launch-checklist">
            {LEGAL_TASKS.map(([title, description], index) => <li key={title}><span className="admin-launch-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h4>{title}</h4><p>{description}</p></div></li>)}
          </ol>
          <a href={checklistUrl} download="nxt5-checklist-juridique.md" className="nxt5-control nxt5-button-secondary admin-launch-download">
            <Download aria-hidden="true" className="h-5 w-5 shrink-0" /><span>Télécharger le guide et la check-list complète</span>
          </a>
        </div>
      </Surface>
    </div>
  );
}
