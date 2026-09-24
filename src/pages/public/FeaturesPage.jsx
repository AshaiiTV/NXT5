import React from "react";
import { ArrowRight, BarChart3, CalendarDays, FileText, MessageSquare, Swords, Users } from "lucide-react";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import "./features-page.css";

const FEATURES = [
  {
    id: "analyse", icon: BarChart3, label: "Analyse de parties",
    title: "Comprendre une partie, puis regarder ce qui se répète.",
    text: "Importe les parties de ton équipe League of Legends pour retrouver leur résultat, les statistiques des joueurs et les objectifs. Commence par la synthèse, puis ouvre les comparaisons et la chronologie lorsque les données sont disponibles.",
    detail: "Dans Analyses, compare des périodes ou des catégories de parties. Les tendances servent à préparer les questions du prochain débrief ; le nombre de parties et les données manquantes restent essentiels pour les interpréter.",
    items: ["Statistiques d’équipe et détail des joueurs", "Chronologie des objectifs et des combats, selon les données importées", "Comparaison de périodes et suivi des champions joués"],
  },
  {
    id: "coaching", icon: FileText, label: "Coaching et débriefs",
    title: "Relier les observations au travail de la prochaine séance.",
    text: "Prépare le débrief (review) d’un entraînement ou d’un match à partir des parties enregistrées. Garde les observations du staff, les points à revoir et les objectifs de travail dans l’espace de l’équipe.",
    detail: "Les profils joueurs réunissent les parties, les champions et le suivi individuel. Retrouve les adversaires rencontrés avec chaque champion et leurs statistiques pour préparer les points à discuter avec le joueur.",
    items: ["Débriefs associés aux parties", "Objectifs et notes de suivi des joueurs", "Statistiques par champion et adversaire rencontré"],
  },
  {
    id: "draft", icon: Swords, label: "Draft et champions",
    title: "Préparer les choix de champions avec une vision de l’équipe.",
    text: "Organise le champion pool, c’est-à-dire les champions préparés par chaque joueur, et construis les compositions pour les cinq rôles. Le draft désigne cette préparation et ce choix des champions.",
    detail: "Distingue les champions déclarés par les joueurs ou le staff de ceux observés dans les parties importées. Les statuts de préparation et les compositions donnent un support commun aux échanges avant l’entraînement.",
    items: ["Champions préparés par joueur et par rôle", "Statuts de maîtrise déclarés par l’équipe", "Préparation et conservation des compositions"],
  },
  {
    id: "organisation", icon: CalendarDays, label: "Équipe et planning",
    title: "Faire le lien entre l’effectif et le prochain entraînement.",
    text: "Rassemble les titulaires, les remplaçants et l’encadrement dans un même espace. Chaque profil garde son rôle et son contexte ; les disponibilités et les séances se retrouvent dans le planning partagé.",
    detail: "Le manager peut organiser les rendez-vous, le coach préparer les débriefs et les joueurs retrouver le travail prévu. Les droits dans l’équipe déterminent les actions accessibles à chacun.",
    items: ["Effectif, rôles et profils joueurs", "Disponibilités partagées", "Séances d’entraînement, matchs et débriefs"],
  },
  {
    id: "discord", icon: MessageSquare, label: "Exports et Discord",
    title: "Partager le bilan là où l’équipe échange.",
    text: "Exporte les statistiques en image PNG pour les partager. Le bot NXT5 permet aussi de publier les bilans des parties dans les salons Discord configurés pour ton équipe.",
    detail: "La connexion du serveur, les salons et les droits se règlent dans Bot Discord. Le partage manuel présente un aperçu avant confirmation ; la diffusion automatique dépend de la configuration activée par l’équipe.",
    items: ["Exports PNG des parties et des analyses", "Bilans dans les salons Discord choisis", "Aperçu et confirmation du partage manuel"],
  },
];

const QUESTIONS = [
  ["À qui s’adresse NXT5 ?", "NXT5 s’adresse aux équipes League of Legends, à leurs joueurs, coachs, analystes et managers. L’espace est conçu pour le travail collectif : organisation, analyse des parties et préparation des séances, que l’équipe débute son organisation ou possède déjà un encadrement."],
  ["Comment ajouter une partie dans NXT5 ?", "Crée ou rejoins une équipe, puis renseigne au moins cinq profils joueurs distincts. NXT5 Importer, disponible pour Windows et Mac, permet de préparer un fichier de partie au format JSON. Le propriétaire ou le staff autorisé ajoute ensuite ce fichier dans Parties et vérifie le côté ainsi que les joueurs de l’équipe."],
  ["NXT5 remplace-t-il le travail du coach ?", "Les statistiques et les observations automatiques donnent des pistes à vérifier. Elles ne prouvent pas, à elles seules, la cause d’une victoire ou d’une défaite. Le coach et les joueurs gardent l’interprétation du contexte et le choix des actions à travailler."],
  ["Toutes les parties disposent-elles d’une chronologie complète ?", "La chronologie et certaines mesures dépendent des données présentes dans le fichier importé. Une partie peut être exploitable sans timeline complète. Une information absente ne doit pas être interprétée comme un zéro ou comme une absence d’action en jeu."],
  ["NXT5 est-il un service officiel de Riot Games ?", "Non. NXT5 est un projet indépendant, sans affiliation à Riot Games. League of Legends et les éléments associés appartiennent à Riot Games."],
];

export function FeaturesPage({ navigate, user }) {
  return <div className="nxt5-entry-page nxt5-features-page">
    <AmbientBackground />
    <SiteHeader navigate={navigate}>
      <PublicTextLink href="/contact" navigate={navigate} className="nxt5-entry-header-link">Contact</PublicTextLink>
      <LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">{user ? "Mon équipe" : "Se connecter"}</LinkButton>
    </SiteHeader>
    <main className="nxt5-entry-main">
      <nav aria-label="Fil d’Ariane" className="nxt5-features-breadcrumb"><PublicTextLink href="/" navigate={navigate}>Accueil</PublicTextLink><span aria-hidden="true">/</span><span aria-current="page">Fonctionnalités</span></nav>
      <header className="nxt5-features-intro">
        <p className="nxt5-entry-eyebrow">Les outils NXT5</p>
        <h1>Analyse, coaching et organisation pour ton équipe League of Legends.</h1>
        <p>NXT5 rassemble les parties, les joueurs et la préparation des entraînements dans un espace commun. Passe d’un résultat à une observation, puis à un point concret à travailler avec ton équipe.</p>
        <div className="nxt5-entry-actions"><LinkButton href={user ? "/equipes" : "/creer-un-compte"} navigate={navigate} icon={ArrowRight}>{user ? "Ouvrir mon équipe" : "Créer mon espace équipe"}</LinkButton><a href="#analyse" className="nxt5-entry-text-link">Explorer les outils</a></div>
      </header>

      <nav aria-label="Outils présentés" className="nxt5-features-index">{FEATURES.map(({ id, label }) => <a key={id} href={`#${id}`}>{label}<ArrowRight size={14} aria-hidden="true" /></a>)}</nav>

      <div className="nxt5-features-sections">{FEATURES.map(({ id, icon: Icon, label, title, text, detail, items }, index) => <section key={id} id={id} aria-labelledby={`${id}-title`} className="nxt5-feature-section">
        <div className="nxt5-feature-section-heading"><p className="nxt5-entry-eyebrow"><Icon size={20} aria-hidden="true" /><span>0{index + 1} · {label}</span></p><h2 id={`${id}-title`}>{title}</h2></div>
        <div className="nxt5-feature-section-body"><p>{text}</p><p>{detail}</p><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </section>)}</div>

      <section className="nxt5-features-routine" aria-labelledby="routine-title">
        <div className="nxt5-entry-section-heading"><p className="nxt5-entry-eyebrow">Un usage concret</p><h2 id="routine-title">Préparer le prochain entraînement.</h2><p>Après une série de scrims, ces parties d’entraînement entre équipes, construis une routine de travail commune.</p></div>
        <ol className="nxt5-entry-steps">{[
          ["Réunir les parties", "Importe les matchs de la séance et retrouve-les dans leur contexte."],
          ["Choisir les faits utiles", "Compare les parties et vérifie les observations avec les joueurs."],
          ["Préparer le débrief", "Consigne les points à revoir et les objectifs de l’équipe."],
          ["Organiser la suite", "Prépare les champions et planifie la prochaine séance."],
        ].map(([title, text], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
      </section>

      <section className="nxt5-features-faq" aria-labelledby="faq-title"><div className="nxt5-entry-section-heading"><p className="nxt5-entry-eyebrow">Avant de commencer</p><h2 id="faq-title">Les questions fréquentes.</h2></div><div>{QUESTIONS.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>

      <section className="nxt5-entry-start" aria-labelledby="features-start-title"><div><p className="nxt5-entry-eyebrow">Ton prochain point de départ</p><h2 id="features-start-title">Rassemble ton équipe sur NXT5.</h2><p>Un besoin précis pour ton staff ? <PublicTextLink href="/contact" navigate={navigate}>Présente-nous ton usage.</PublicTextLink></p></div><LinkButton href={user ? "/equipes" : "/creer-un-compte"} navigate={navigate} icon={Users}>{user ? "Ouvrir mon équipe" : "Créer un compte"}</LinkButton></section>
    </main>
    <LegalLinks navigate={navigate} />
  </div>;
}
