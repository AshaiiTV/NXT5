import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { ArrowRight, BarChart3, CalendarDays, FileText, MessageSquare, Swords, Users } from "lucide-react";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import { DemoMatchSummary } from "./DemoMatchSummary.jsx";
import "./features-page.css";

const FEATURES = [
  {
    id: "analyse", icon: BarChart3, label: "Analyse de parties",
    title: "Lire les faits avant de conclure.",
    text: "Retrouve le résultat, les écarts entre équipes et les statistiques des joueurs. Compare plusieurs parties dans Analyses et rouvre la partie à l’origine d’une observation.",
    detail: "Dans Analyses, compare des périodes ou des catégories de parties. Les tendances servent à préparer les questions du prochain débrief ; le nombre de parties et les données manquantes restent essentiels pour les interpréter.",
    items: ["Statistiques d’équipe et détail des joueurs", "Chronologie des objectifs et des combats, selon les données importées", "Comparaison de périodes et suivi des champions joués"],
  },
  {
    id: "coaching", icon: FileText, label: "Coaching et débriefs",
    title: "Garder une action à travailler.",
    text: "Relie le débrief à ses parties sources. Rassemble les observations, les questions du staff et les objectifs des joueurs avant la prochaine séance.",
    detail: "Les profils joueurs réunissent les parties, les champions et le suivi individuel. Retrouve les adversaires rencontrés avec chaque champion et leurs statistiques pour préparer les points à discuter avec le joueur.",
    items: ["Débriefs associés aux parties", "Objectifs et notes de suivi des joueurs", "Statistiques par champion et adversaire rencontré"],
  },
  {
    id: "draft", icon: Swords, label: "Draft et champions",
    title: "Préparer les cinq choix ensemble.",
    text: "Déclare les champions préparés par chaque joueur, puis compose les cinq rôles. Distingue la maîtrise déclarée de ce que montrent les parties jouées.",
    detail: "Distingue les champions déclarés par les joueurs ou le staff de ceux observés dans les parties importées. Les statuts de préparation et les compositions donnent un support commun aux échanges avant l’entraînement.",
    items: ["Champions préparés par joueur et par rôle", "Statuts de maîtrise déclarés par l’équipe", "Préparation et conservation des compositions"],
  },
  {
    id: "organisation", icon: CalendarDays, label: "Équipe et planning",
    title: "Retrouver qui joue et quand.",
    text: "Réunis titulaires, remplaçants et encadrement. Les disponibilités partagées aident à préparer entraînements, matchs et débriefs dans le planning.",
    detail: "Le manager peut organiser les rendez-vous, le coach préparer les débriefs et les joueurs retrouver le travail prévu. Les droits dans l’équipe déterminent les actions accessibles à chacun.",
    items: ["Effectif, rôles et profils joueurs", "Disponibilités partagées", "Séances d’entraînement, matchs et débriefs"],
  },
  {
    id: "discord", icon: MessageSquare, label: "Exports et Discord",
    title: "Partager un bilan lisible.",
    text: "Exporte les statistiques en PNG ou publie les bilans des parties dans les salons Discord choisis par l’équipe, après configuration du bot.",
    detail: "Le bot est actuellement accessible gratuitement. Au lancement des offres, il sera réservé au Pass Équipe et ne sera pas inclus dans Découverte. La connexion du serveur, les salons et les droits se règlent dans Bot Discord. Le partage manuel présente un aperçu avant confirmation ; la diffusion automatique dépend de la configuration activée par l’équipe.",
    items: ["Exports PNG des parties et des analyses", "Bilans dans les salons Discord choisis", "Aperçu et confirmation du partage manuel"],
  },
];

const QUESTIONS = [
  ["À qui s’adresse NXT5 ?", "NXT5 s’adresse aux équipes League of Legends, à leurs joueurs, coachs, analystes et managers. L’espace est conçu pour le travail collectif : organisation, analyse des parties et préparation des séances, que l’équipe débute son organisation ou possède déjà un encadrement."],
  ["Comment ajouter une partie dans NXT5 ?", "Crée ou rejoins une équipe. Sur Windows ou Mac avec League of Legends ouvert, NXT5 Importer prépare le fichier JSON. Le propriétaire ou le staff autorisé le charge dans Parties, vérifie son côté et associe les cinq joueurs. Les profils manquants peuvent être préparés depuis le fichier avant la confirmation."],
  ["Combien coûte l’accès aujourd’hui ?", "Toutes les fonctionnalités actuellement accessibles sont gratuites. La création du compte n’active aucun abonnement et n’autorise aucun prélèvement. D’éventuelles offres payantes futures seront présentées avant toute souscription volontaire."],
  ["NXT5 remplace-t-il le travail du coach ?", "Les statistiques et les observations automatiques donnent des pistes à vérifier. Elles ne prouvent pas, à elles seules, la cause d’une victoire ou d’une défaite. Le coach et les joueurs gardent l’interprétation du contexte et le choix des actions à travailler."],
  ["Toutes les parties disposent-elles d’une chronologie complète ?", "La chronologie et certaines mesures dépendent des données présentes dans le fichier importé. Une partie peut être exploitable sans timeline complète. Une information absente ne doit pas être interprétée comme un zéro ou comme une absence d’action en jeu."],
  ["NXT5 est-il un service officiel de Riot Games ?", "Non. NXT5 est un projet indépendant, sans affiliation à Riot Games. League of Legends et les éléments associés appartiennent à Riot Games."],
];

export function FeaturesPage({ navigate, user }) {
  useLanguage();
  return <div className="nxt5-entry-page nxt5-features-page">
    <AmbientBackground />
    <SiteHeader navigate={navigate}>
      <PublicTextLink href="/contact" navigate={navigate} className="nxt5-entry-header-link">{t("Contact")}</PublicTextLink>
      <LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">{user ? t("Mon équipe") : t("Se connecter")}</LinkButton>
    </SiteHeader>
    <main className="nxt5-entry-main">
      <nav aria-label={t("Fil d’Ariane")} className="nxt5-features-breadcrumb"><PublicTextLink href="/" navigate={navigate}>{t("Accueil")}</PublicTextLink><span aria-hidden="true">/</span><span aria-current="page">{t("Fonctionnalités")}</span></nav>
      <header className="nxt5-features-intro">
        <p className="nxt5-entry-eyebrow">{t("Les outils NXT5")}</p>
        <h1>{t("Analyse, coaching et organisation pour ton équipe League of Legends.")}</h1>
        <p>{t("NXT5 rassemble les parties, les joueurs et la préparation des entraînements dans un espace commun. Passe d’un résultat à une observation, puis à un point concret à travailler avec ton équipe.")}</p>
        <div className="nxt5-entry-actions"><LinkButton href="/demo" navigate={navigate} icon={ArrowRight}>{t("Essayer la démo")}</LinkButton><LinkButton href={user ? "/equipes" : "/creer-un-compte"} navigate={navigate} variant="ghost">{user ? t("Ouvrir mon équipe") : t("Créer mon espace équipe")}</LinkButton></div>
        <p className="nxt5-features-access">{t("Accès actuellement gratuit, aucun abonnement activé. L’import nécessite Windows ou Mac et League of Legends ouvert ; la démo se consulte sans installation.")}</p>
      </header>

      <section className="nxt5-features-example" aria-labelledby="feature-example-title"><div><p className="nxt5-entry-eyebrow">{t("Un exemple, du résultat à l’action")}</p><h2 id="feature-example-title">{t("Une statistique. Une question. Un débrief.")}</h2><p>{t("Un avantage de vision ne suffit pas à expliquer une victoire. Le bilan donne un point de départ ; l’équipe vérifie le contexte et choisit ce qu’elle travaillera.")}</p><PublicTextLink href="/demo" navigate={navigate} className="nxt5-entry-text-link">{t("Ouvrir les trois parties fictives ")}<ArrowRight aria-hidden="true" size={16} /></PublicTextLink></div><DemoMatchSummary compact /></section>

      <nav aria-label={t("Outils présentés")} className="nxt5-features-index">{FEATURES.map(({ id, label }) => <a key={id} href={`#${id}`}>{t(label)}<ArrowRight size={14} aria-hidden="true" /></a>)}</nav>

      <div className="nxt5-features-sections">{FEATURES.map(({ id, icon: Icon, label, title, text, detail, items }, index) => <section key={id} id={id} aria-labelledby={`${id}-title`} className="nxt5-feature-section">
        <div className="nxt5-feature-section-heading"><p className="nxt5-entry-eyebrow"><Icon size={20} aria-hidden="true" /><span>0{index + 1} · {t(label)}</span></p><h2 id={`${id}-title`}>{t(title)}</h2></div>
        <div className="nxt5-feature-section-body"><p>{t(text)}</p><details><summary>{t("Voir les outils et leurs limites")}</summary><p>{t(detail)}</p><ul>{items.map((item) => <li key={item}>{t(item)}</li>)}</ul></details>{id === "coaching" && <PublicTextLink href="/guides/preparer-debrief" navigate={navigate} className="nxt5-entry-text-link">{t("Le guide du premier débrief ")}<ArrowRight aria-hidden="true" size={16} /></PublicTextLink>}{id === "analyse" && <PublicTextLink href="/guides/importer-premier-scrim" navigate={navigate} className="nxt5-entry-text-link">{t("Le guide du premier import ")}<ArrowRight aria-hidden="true" size={16} /></PublicTextLink>}</div>
      </section>)}</div>

      <section className="nxt5-features-routine" aria-labelledby="routine-title">
        <div className="nxt5-entry-section-heading"><p className="nxt5-entry-eyebrow">{t("Un usage concret")}</p><h2 id="routine-title">{t("Préparer le prochain entraînement.")}</h2><p>{t("Après une série de scrims, ces parties d’entraînement entre équipes, construis une routine de travail commune.")}</p></div>
        <ol className="nxt5-entry-steps">{[
          ["Réunir les parties", "Importe les matchs de la séance et retrouve-les dans leur contexte."],
          ["Choisir les faits utiles", "Compare les parties et vérifie les observations avec les joueurs."],
          ["Préparer le débrief", "Consigne les points à revoir et les objectifs de l’équipe."],
          ["Organiser la suite", "Prépare les champions et planifie la prochaine séance."],
        ].map(([title, text], index) => <li key={title}><span>0{index + 1}</span><div><h3>{t(title)}</h3><p>{t(text)}</p></div></li>)}</ol>
      </section>

      <section className="nxt5-features-faq" aria-labelledby="faq-title"><div className="nxt5-entry-section-heading"><p className="nxt5-entry-eyebrow">{t("Avant de commencer")}</p><h2 id="faq-title">{t("Les questions fréquentes.")}</h2></div><div>{QUESTIONS.map(([question, answer]) => <details key={question}><summary>{t(question)}</summary><p>{t(answer)}</p></details>)}</div></section>

      <section className="nxt5-entry-start" aria-labelledby="features-start-title"><div><p className="nxt5-entry-eyebrow">{t("Ton prochain point de départ")}</p><h2 id="features-start-title">{t("Rassemble ton équipe sur NXT5.")}</h2><p>{t("Un besoin précis pour ton staff ? ")}<PublicTextLink href="/contact" navigate={navigate}>{t("Présente-nous ton usage.")}</PublicTextLink></p></div><LinkButton href={user ? "/equipes" : "/creer-un-compte"} navigate={navigate} icon={Users}>{user ? t("Ouvrir mon équipe") : t("Créer un compte")}</LinkButton></section>
    </main>
    <LegalLinks navigate={navigate} />
  </div>;
}
