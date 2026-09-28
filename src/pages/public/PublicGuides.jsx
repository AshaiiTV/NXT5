import React from "react";
import { ArrowRight, BookOpen, Download, FileText } from "lucide-react";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import { DemoMatchSummary } from "./DemoMatchSummary.jsx";
import "./features-page.css";
import "./public-guides.css";

export const PUBLIC_GUIDES = {
  "/guides/importer-premier-scrim": {
    title: "Importer ton premier scrim League of Legends", label: "Premier import", icon: Download,
    intro: "Un scrim est une partie d’entraînement entre équipes. Voici comment retrouver son bilan dans NXT5 et préparer le premier débrief.",
    prerequisite: "Un ordinateur Windows (64 bits) ou Mac, le client League of Legends ouvert et une partie accessible depuis ce client. Le propriétaire de l’équipe ou son staff autorisé réalise l’import. Tu peux consulter les résultats ensuite sur mobile.",
    steps: [
      ["Créer ou rejoindre ton espace équipe", "Crée un compte NXT5, vérifie ton adresse e-mail, puis crée ton équipe ou utilise son invitation. Un profil joueur représente un joueur dans l’effectif ; il peut exister avant que ce joueur crée son propre compte."],
      ["Préparer le fichier avec NXT5 Importer", "Dans Parties, choisis « Importer une partie », puis ouvre « Pas encore de fichier ? Obtenir NXT5 Importer ». Sélectionne Windows, Mac Apple Silicon ou Mac Intel. Avec League of Legends ouvert, utilise l’Importer pour exporter ta partie au format JSON."],
      ["Vérifier le côté et les cinq joueurs", "Reviens dans Parties et charge le fichier JSON. Choisis le côté de ton équipe, puis associe les cinq postes à cinq profils distincts. Tu peux préparer les profils manquants depuis le fichier et choisir « Créer les profils proposés ». Ces profils restent dans l’effectif même si tu annules ensuite l’import. Vérifie aussi les postes adverses avant de confirmer la partie."],
      ["Lire le résultat avant les détails", "Ouvre la partie enregistrée. Commence par le résultat et les écarts entre équipes, puis consulte les statistiques ou la chronologie utiles. Certaines données peuvent manquer dans le fichier : un tiret ne signifie pas zéro."],
    ],
    nextPath: "/guides/preparer-debrief", nextLabel: "Préparer un débrief à partir de cette partie",
  },
  "/guides/preparer-debrief": {
    title: "Préparer un débrief utile à ton équipe", label: "Premier débrief", icon: FileText,
    intro: "Le débrief, aussi appelé review, transforme une partie en un point de travail partagé. Garde un fait vérifiable, une question et une action à essayer ensemble.",
    prerequisite: "Une partie importée, les joueurs concernés et le contexte de la séance. Utilise le replay pour vérifier les décisions : les statistiques finales seules ne permettent pas d’en connaître les causes.",
    steps: [
      ["Choisir une partie et un fait précis", "Dans Parties, ouvre le match à revoir. Relève un résultat mesuré et son contexte : un écart d’or, une séquence ou un objectif. Si tu compares plusieurs parties dans Analyses, vérifie leur nombre et leur période."],
      ["Poser une question plutôt qu’un verdict", "Un écart de vision favorable ne prouve pas que la vision a causé la victoire. Demande ce qui a rendu une décision possible et vérifie le moment choisi avec les joueurs. Distingue ce que montre le fichier de ce que vous interprétez."],
      ["Écrire une action observable", "Ouvre le débrief associé à la partie. Note le fait, la question à revoir et une action que l’équipe peut essayer. Exemple : avant le prochain objectif, confirmer ensemble qui prend la vision et qui conserve la priorité de vague."],
      ["Revenir sur l’action à la séance suivante", "Prévois le prochain entraînement dans Planning. Au débrief suivant, vérifiez si l’action a été appliquée et dans quelles situations. Une meilleure statistique isolée ne suffit pas à conclure à une progression durable."],
    ],
    nextPath: "/guides/importer-premier-scrim", nextLabel: "Retrouver les étapes du premier import",
  },
};

export function PublicGuidePage({ path, navigate, user }) {
  const guide = PUBLIC_GUIDES[path];
  if (!guide) return null;
  const Icon = guide.icon;
  return <div className="nxt5-entry-page nxt5-public-guide"><AmbientBackground />
    <SiteHeader navigate={navigate}><PublicTextLink href="/demo" navigate={navigate} className="nxt5-entry-header-link">Démonstration</PublicTextLink><LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">{user ? "Mon équipe" : "Se connecter"}</LinkButton></SiteHeader>
    <main className="nxt5-entry-main"><nav aria-label="Fil d’Ariane" className="nxt5-features-breadcrumb"><PublicTextLink href="/" navigate={navigate}>Accueil</PublicTextLink><span aria-hidden="true">/</span><span aria-current="page">{guide.label}</span></nav>
      <header className="nxt5-features-intro"><p className="nxt5-entry-eyebrow"><Icon aria-hidden="true" size={18} /> Guide pratique NXT5</p><h1>{guide.title}</h1><p>{guide.intro}</p></header>
      <div className="public-guide-layout"><article><aside className="public-guide-prerequisite"><h2>Avant de commencer</h2><p>{guide.prerequisite}</p></aside><ol className="public-guide-steps">{guide.steps.map(([title, description], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h2>{title}</h2><p>{description}</p></div></li>)}</ol>
        {path === "/guides/importer-premier-scrim" && <aside className="public-guide-prerequisite"><h2>Une alerte à l’ouverture de l’Importer ?</h2><p>L’aide à l’ouverture, disponible près du téléchargement, décrit les messages Windows et Mac. La version Mac n’est pas encore notarisée par Apple. Si le message diffère de celui de l’aide ou indique une menace précise, contacte l’équipe en conservant tes protections activées.</p><PublicTextLink href="/contact" navigate={navigate} className="nxt5-entry-text-link">Contacter NXT5</PublicTextLink></aside>}
      </article><aside className="public-guide-example"><DemoMatchSummary compact /><PublicTextLink href="/demo" navigate={navigate} className="nxt5-entry-text-link">Explorer cet exemple fictif <ArrowRight aria-hidden="true" size={16} /></PublicTextLink><p>Sans compte et sans installation. Les filtres et les analyses de la démonstration utilisent les outils NXT5 sur trois parties fictives.</p></aside></div>
      <nav aria-label="Continuer la découverte" className="public-guide-next"><BookOpen aria-hidden="true" size={20} /><PublicTextLink href={guide.nextPath} navigate={navigate}>{guide.nextLabel} <ArrowRight aria-hidden="true" size={16} /></PublicTextLink></nav>
      <section className="nxt5-entry-start"><div><h2>Commence avec ton équipe.</h2><p>Accès actuellement gratuit, aucun abonnement activé.</p></div><LinkButton href={user ? "/equipes" : "/creer-un-compte"} navigate={navigate} icon={ArrowRight}>{user ? "Ouvrir mon équipe" : "Créer mon espace"}</LinkButton></section>
    </main><LegalLinks navigate={navigate} />
  </div>;
}
