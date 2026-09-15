import React, { useState } from "react";
import { Download, Loader2, Plug, RefreshCw } from "lucide-react";
import { useAdminMutation, useAdminQuery } from "../../hooks/useAdminQuery.js";
import { Badge, Button, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { LinkButton } from "../public/PublicPages.jsx";
import checklistUrl from "../../../docs/shopify-et-checklist-juridique.md?url";

const LEGAL_TASKS = [
  ["Identité du vendeur", "Nom et prénoms avec la mention EI, adresse professionnelle, SIREN/SIRET, immatriculation, e-mail et téléphone. Confirmer le régime de TVA."],
  ["Contrat et CGV", "Préciser qui achète, les fonctionnalités, le prix, la durée, le renouvellement, la résiliation et les garanties. Faire valider les clauses propres au service NXT5."],
  ["Rétractation et remboursements", "Définir les modalités pour le service numérique et fournir le formulaire adapté. Pour des produits physiques, ajouter les conditions et l’adresse de retour."],
  ["Mentions et confidentialité", "Actualiser l’éditeur et le responsable de traitement. Décrire les flux Shopify, les prestataires, les durées et les droits. Recenser les cookies réellement utilisés."],
  ["Médiation et paiement", "Choisir le médiateur compétent et souscrire sa convention. Compléter les vérifications Shopify Payments directement chez Shopify."],
  ["Avant la première vente", "Publier les textes validés et tester la commande, la facture, la rétractation, le remboursement et la résiliation. Prévoir l’activation des accès NXT5 après paiement."],
];

export default function IntegrationsPage({ navigate }) {
  const mutateAdmin = useAdminMutation();
  const { data: status, loading, error: queryError, refresh } = useAdminQuery("admin-shopify");
  const [connection, setConnection] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const error = testError || queryError;

  async function testConnection() {
    setTesting(true);
    setConnection(null);
    setTestError("");
    try {
      setConnection(await mutateAdmin("admin-shopify", { method: "POST" }));
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Intégrations"
        subtitle="Vérifie la connexion de la boutique Shopify et retrouve les liens vers les réseaux sociaux."
      />
      <Surface glow>
        <div className="space-y-5 p-2 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-3 text-xl font-black"><Plug aria-hidden="true" className="h-6 w-6 text-cyan-200" />Shopify</h3>
            <Badge tone={connection ? "cyan" : "slate"}>{loading ? "Chargement" : connection ? "Connexion vérifiée" : status?.configured ? "Prêt à tester" : "À configurer"}</Badge>
          </div>
          <p className="text-sm leading-7 text-slate-200">Le connecteur lit le nom, le domaine et la devise de la boutique. La mise en vente et l’activation automatique des abonnements restent à finaliser.</p>
          {loading && <p role="status" className="text-sm">Lecture de la configuration…</p>}
          {status && <p className="break-words text-sm text-slate-200">Boutique : {status.domain || "à renseigner"} · API : {status.apiVersion || "à corriger"}</p>}
          {!!status?.issues?.length && <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-amber-100">{status.issues.map((issue) => <li className="break-words" key={issue}>{issue}</li>)}</ul>}
          <p className="text-sm leading-7 text-slate-300">Dans les variables serveur Netlify, renseigne <code>SHOPIFY_SHOP_DOMAIN</code>, <code>SHOPIFY_CLIENT_ID</code> et <code>SHOPIFY_CLIENT_SECRET</code>, puis redéploie. Le guide de configuration détaille la création de l’application et son installation.</p>
          {error && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">{error}{queryError && status && " La configuration ci-dessus date de la dernière lecture réussie."}</p>}
          {connection && <div role="status" className="space-y-2 rounded-xl border border-cyan-200/25 bg-cyan-300/10 p-4 text-sm leading-6">
            <p className="font-black">{connection.shop.name}</p>
            <p className="break-words">{connection.shop.domain} · {connection.shop.currency}</p>
            <p>Vérifiée le {new Date(connection.checkedAt).toLocaleString("fr-FR")}. API utilisée : {connection.apiVersion}.</p>
            {connection.apiVersion !== connection.requestedApiVersion && <p className="text-amber-100">Shopify a remplacé la version demandée. Actualise SHOPIFY_API_VERSION avec une version prise en charge.</p>}
          </div>}
          <a href={checklistUrl} download="nxt5-guide-shopify.md" className="inline-flex min-h-11 max-w-full items-center gap-2 text-sm font-bold text-cyan-100 underline underline-offset-4">
            <Download aria-hidden="true" className="h-4 w-4 shrink-0" /><span>Télécharger le guide de configuration</span>
          </a>
          <div className="flex flex-wrap gap-3">
            <Button type="button" icon={testing ? Loader2 : Plug} disabled={loading || testing || !status?.configured} onClick={testConnection}>{testing ? "Connexion en cours…" : "Tester la connexion"}</Button>
            <Button type="button" icon={RefreshCw} variant="ghost" disabled={loading || testing} onClick={() => { setConnection(null); setTestError(""); void refresh().catch(() => {}); }}>Actualiser</Button>
          </div>
        </div>
      </Surface>
      <Surface>
        <div className="space-y-4 p-2 sm:p-4">
          <h3 className="text-xl font-black">Réseaux sociaux</h3>
          <p className="text-sm leading-7 text-slate-200">Consulte les liens publics de NXT5 et les réseaux renseignés sur le site.</p>
          <LinkButton href="/reseaux" navigate={navigate} variant="ghost">Voir la page Réseaux</LinkButton>
        </div>
      </Surface>
    </div>
  );
}

export function LegalReadinessPage() {
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow="Ventes et accès"
        title="Préparer la vente"
        subtitle="Retrouve les documents et les étapes à préparer avant la commercialisation de NXT5."
      />
      <Surface>
        <div className="space-y-5 p-2 sm:p-4">
          <h3 className="text-xl font-black">Check-list juridique</h3>
          <p className="text-sm leading-7 text-slate-200">Les textes actuels présentent un service gratuit édité à titre non professionnel. Avant de vendre, les documents ci-dessous doivent correspondre à l’entreprise et à l’offre réellement proposées.</p>
          <ol className="space-y-5">
            {LEGAL_TASKS.map(([title, description], index) => <li key={title} className="border-t border-cyan-100/10 pt-4"><h4 className="font-black text-cyan-100">{index + 1}. {title}</h4><p className="mt-2 text-sm leading-7 text-slate-200">{description}</p></li>)}
          </ol>
          <a href={checklistUrl} download="nxt5-checklist-juridique.md" className="nxt5-control inline-flex min-h-12 max-w-full items-center gap-3 rounded-xl border border-cyan-200/30 px-4 py-3 text-sm font-black text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
            <Download aria-hidden="true" className="h-5 w-5 shrink-0" /><span>Télécharger le guide et la check-list complète</span>
          </a>
        </div>
      </Surface>
    </div>
  );
}
