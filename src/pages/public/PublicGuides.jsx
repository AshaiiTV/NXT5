import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React from "react";
import { ArrowRight, BookOpen, Download, FileText } from "lucide-react";
import { AmbientBackground } from "../../components/layout/AppChrome.jsx";
import { LegalLinks, LinkButton, PublicTextLink, SiteHeader } from "./PublicPages.jsx";
import { DemoMatchSummary } from "./DemoMatchSummary.jsx";
import { DEMO_MATCHES } from "./demo-data.js";
import "./features-page.css";
import "./public-guides.css";

export const PUBLIC_GUIDES = {
  "/guides/importer-premier-scrim": {
    title: "Importer ton premier scrim League of Legends", label: "Premier import", icon: Download,
    intro: "Un scrim est une partie d’entraînement entre équipes. Voici comment retrouver son bilan dans NXT5 et préparer le premier débrief.",
    prerequisite: "Un ordinateur Windows (64 bits) ou Mac, le client League of Legends ouvert et une partie accessible depuis ce client. Le propriétaire de l’équipe ou son staff autorisé réalise l’import. Tu peux consulter les résultats ensuite sur mobile.",
    steps: [
      ["Créer ou rejoindre ton espace équipe", "Crée un compte NXT5, vérifie ton adresse e-mail, puis crée ton équipe ou utilise son invitation. Sélectionne la bonne équipe avant d’ouvrir Parties : l’import appartient à cette équipe.", "Un profil joueur représente une personne dans l’effectif ; il peut exister avant son compte connecté. Tu peux charger le fichier avant d’avoir créé les cinq profils, puis compléter les profils manquants pendant l’import."],
      ["Exporter le fichier JSON depuis le client LoL", "Dans Parties, choisis « Importer une partie », puis ouvre « Pas encore de fichier ? Obtenir NXT5 Importer ». Choisis Windows (64 bits), Mac Apple Silicon ou Mac Intel, puis télécharge l’application.", "Garde League of Legends ouvert. Dans NXT5 Importer, renseigne l’identifiant du match copié depuis l’historique du client. Pour un numéro sans préfixe, choisis le serveur de la partie. Clique sur « Exporter la game » et enregistre le fichier .json. Cet export crée un fichier sur ton ordinateur ; il ne l’ajoute pas encore à ton équipe NXT5."],
      ["Vérifier le côté, les postes et les cinq joueurs", "Reviens dans Parties et clique sur « Choisir mon fichier ». Charge le JSON obtenu, puis choisis le côté bleu ou rouge de ton équipe en vérifiant les noms et les champions. Pour chacun des cinq postes — TOP, JGL, MID, ADC et SUP — vérifie le champion et associe un profil NXT5 différent.", "Si un profil manque, vérifie le nom et le Riot ID proposé, au format Nom#TAG, avant de choisir « Créer les profils proposés ». Ces profils restent dans l’effectif même si tu annules ensuite l’import. Vérifie aussi les cinq postes adverses : choisir un poste déjà occupé échange les deux champions concernés."],
      ["Nommer la partie et confirmer l’import", "Donne un nom reconnaissable à la partie, par exemple « Scrim Aurore · partie 1 ». Sélectionne une catégorie si ton équipe en utilise, puis relis le résumé : côté et cinq joueurs. Le chargement du JSON seul n’enregistre pas la partie.", "Clique sur « Confirmer l’import » et attends le message « Partie importée ». Si le bouton est désactivé, le texte juste au-dessus indique ce qu’il manque : côté, association de joueurs ou de champions, postes adverses ou nom de la partie."],
      ["Ouvrir le bilan et préparer la suite", "Ouvre la partie enregistrée et commence par le résultat et les écarts entre équipes. Consulte ensuite les statistiques ou la chronologie utiles à ta question. Certaines données peuvent manquer dans le fichier : un tiret ne signifie pas zéro et une chronologie absente ne prouve pas qu’aucune action n’a eu lieu."],
    ],
    featureLabel: "Comprendre les outils d’analyse et leurs limites",
    help: [
      ["L’Importer ne détecte pas League of Legends", "Vérifie que le client LoL est ouvert sur le même ordinateur. Dans les Paramètres de l’Importer, vérifie le dossier d’installation du client, puis relance la vérification. Si la partie reste inaccessible, contrôle son identifiant et son serveur ; la disponibilité des données dépend aussi du client et de Riot."],
      ["Le fichier est refusé", "Le site attend un fichier JSON de 5 Mo maximum. Utilise le fichier exporté par NXT5 Importer, sans le modifier ni renommer un autre format en .json. S’il est incomplet ou invalide, réexporte la partie. Si l’erreur persiste, conserve le message exact pour contacter le support."],
      ["Un joueur manque ou apparaît sur deux postes", "Associe chacun des cinq postes à un profil distinct de l’équipe active. Vérifie les profils existants avant d’en créer un nouveau. Pour les profils proposés depuis le fichier, chaque nom et chaque Riot ID complet doivent être renseignés ; les Riot IDs doivent être différents."],
      ["L’import n’est pas disponible pour mon compte", "L’import est réservé au propriétaire ou au staff autorisé de l’équipe sélectionnée. Vérifie l’équipe active et demande à son propriétaire de contrôler ton rôle. Un profil joueur dans l’effectif ne donne pas, à lui seul, un accès de gestion à ton compte."],
    ],
    nextPath: "/guides/preparer-debrief", nextLabel: "Préparer un débrief à partir de cette partie",
  },
  "/guides/preparer-debrief": {
    title: "Préparer un débrief utile à ton équipe", label: "Premier débrief", icon: FileText,
    intro: "Le débrief, aussi appelé review, transforme une partie en un point de travail partagé. Garde un fait vérifiable, une question et une action à essayer ensemble.",
    prerequisite: "Une partie importée, les joueurs concernés et le contexte de la séance. Utilise le replay pour vérifier les décisions : les statistiques finales seules ne permettent pas d’en connaître les causes.",
    steps: [
      ["Choisir une partie et un fait précis", "Dans Parties, ouvre le match à revoir. Relève un résultat mesuré et son contexte : écart d’or final, morts ou objectifs disponibles. Garde la partie comme source et distingue une valeur finale d’un événement observé à un instant du replay.", "Si tu compares plusieurs parties dans Analyses, vérifie leur nombre, leur période et les filtres. Une donnée absente reste inconnue ; un petit ensemble de parties ne suffit pas à démontrer une tendance durable."],
      ["Poser une question plutôt qu’un verdict", "Un écart de vision favorable ne prouve pas que la vision a causé la victoire. Demande ce qui a rendu une décision possible, choisis une séquence à revoir et confronte-la aux souvenirs des joueurs.", "Dans le replay, vérifie la position des joueurs, l’état des vagues, les ressources disponibles et les informations connues au moment de la décision. Note ce qui reste incertain. Les observations automatiques servent de points de départ, pas de conclusion sur la responsabilité d’un joueur."],
      ["Écrire et enregistrer une action observable", "Depuis la partie, choisis « Préparer le débrief » ou ouvre le débrief existant. Vérifie les parties liées, puis complète « Observations et décisions de l’équipe » : le fait, la question, l’action choisie et la façon de la vérifier. Les notes de l’équipe complètent l’analyse automatique.", "Choisis « Créer le débrief » pour un nouveau document, ou « Enregistrer » après une modification. « Fermer et garder le brouillon » permet de reprendre la saisie pendant la navigation ; ce brouillon en mémoire ne survit pas à la fermeture ou au rechargement de l’onglet."],
      ["Vérifier l’action à l’entraînement suivant", "Prévois la prochaine séance dans Planning. Avant de jouer, rappelez qui annonce l’action et dans quelle situation elle doit s’appliquer. Au débrief suivant, choisissez une séquence comparable et notez : appliquée, non appliquée ou impossible à vérifier, avec la raison.", "Conservez, adaptez ou abandonnez la consigne selon ce que vous observez ensemble. Une victoire ou une meilleure statistique isolée ne suffit pas à attribuer un progrès à cette action."],
    ],
    featureLabel: "Voir les outils de débrief et d’organisation d’équipe",
    nextPath: "/guides/importer-premier-scrim", nextLabel: "Retrouver les étapes du premier import",
  },
};

const REVIEW_EXAMPLE = DEMO_MATCHES[2];

function DebriefExample() {
  useLanguage();
  return <section className="public-guide-case" aria-labelledby="guide-case-title">
    <p className="nxt5-entry-eyebrow">{t("Exemple fictif · Aucun résultat d’équipe réel")}</p>
    <h2 id="guide-case-title">{t("Du bilan à une consigne vérifiable")}</h2>
    <p>{t("Voici une façon de prolonger le troisième scrim de la démonstration. Les chiffres viennent de cette partie fictive ; la séquence et la consigne restent à choisir par les joueurs dans leur propre replay.")}</p>
    <dl>
      <div><dt>{t("Le fait")}</dt><dd>{t(REVIEW_EXAMPLE.demoReview.observation)}{t(" Ce sont des écarts en fin de partie, pas la preuve d’une préparation réussie de chaque objectif.")}</dd></div>
      <div><dt>{t("La question")}</dt><dd>{t(REVIEW_EXAMPLE.demoReview.question)}{t(" Choisissez un objectif et regardez si les vagues et les positions permettaient réellement d’entrer ensemble dans la zone.")}</dd></div>
      <div><dt>{t("L’action à essayer")}</dt><dd>{t("Avant le prochain objectif que l’équipe choisit de contester, un joueur annonce qui prépare la vision et qui prend les vagues. Les joueurs concernés confirment la consigne avant d’avancer. Adaptez-la aux rôles et aux informations disponibles.")}</dd></div>
      <div><dt>{t("La vérification")}</dt><dd>{t("À la séance suivante, notez le moment de l’annonce, les réponses et la position de chaque joueur dans une séquence comparable. La consigne a-t-elle été appliquée ? Si la communication n’a pas été enregistrée, confirmez-la avec les joueurs et gardez la limite explicite. Ne déduisez pas son efficacité du seul résultat de la partie.")}</dd></div>
    </dl>
  </section>;
}

export function PublicGuidePage({ path, navigate, user }) {
  useLanguage();
  const guide = PUBLIC_GUIDES[path];
  if (!guide) return null;
  const Icon = guide.icon;
  const isImportGuide = path === "/guides/importer-premier-scrim";
  return <div className="nxt5-entry-page nxt5-public-guide"><AmbientBackground />
    <SiteHeader navigate={navigate}><PublicTextLink href="/demo" navigate={navigate} className="nxt5-entry-header-link">{t("Démonstration")}</PublicTextLink><LinkButton href={user ? "/equipes" : "/connexion"} navigate={navigate} variant="ghost">{user ? t("Mon équipe") : t("Se connecter")}</LinkButton></SiteHeader>
    <main className="nxt5-entry-main"><nav aria-label={t("Fil d’Ariane")} className="nxt5-features-breadcrumb"><PublicTextLink href="/" navigate={navigate}>{t("Accueil")}</PublicTextLink><span aria-hidden="true">/</span><span aria-current="page">{t(guide.label)}</span></nav>
      <header className="nxt5-features-intro"><p className="nxt5-entry-eyebrow"><Icon aria-hidden="true" size={18} />{t(" Guide pratique NXT5")}</p><h1>{t(guide.title)}</h1><p>{t(guide.intro)}</p><div className="public-guide-byline">{t("Documentation de l’équipe NXT5 · Révisée le ")}<time dateTime="2026-10-06">{t("6 octobre 2026")}</time></div></header>
      <div className="public-guide-layout"><article><aside className="public-guide-prerequisite"><h2>{t("Avant de commencer")}</h2><p>{t(guide.prerequisite)}</p></aside><ol className="public-guide-steps">{guide.steps.map(([title, ...paragraphs], index) => <li key={title}><span aria-hidden="true">0{index + 1}</span><div><h2>{t(title)}</h2>{paragraphs.map((paragraph) => <p key={paragraph}>{t(paragraph)}</p>)}</div></li>)}</ol>
        {isImportGuide && <>
          <section className="public-guide-help" aria-labelledby="guide-help-title"><h2 id="guide-help-title">{t("Si l’import ne se passe pas comme prévu")}</h2>{guide.help.map(([title, description]) => <details key={title}><summary>{t(title)}</summary><p>{t(description)}</p></details>)}</section>
          <aside className="public-guide-prerequisite"><h2>{t("Une alerte à l’ouverture de l’Importer ?")}</h2><p>{t("L’« Aide à l’ouverture », près du téléchargement, décrit les messages Windows et Mac. La version Mac n’est pas encore notarisée par Apple. Si le message diffère de celui de l’aide ou indique une menace précise, contacte l’équipe en conservant tes protections activées.")}</p><PublicTextLink href="/contact" navigate={navigate} className="nxt5-entry-text-link">{t("Contacter NXT5")}</PublicTextLink></aside>
        </>}
        {!isImportGuide && <DebriefExample />}
        <PublicTextLink href="/fonctionnalites" navigate={navigate} className="nxt5-entry-text-link public-guide-feature-link">{t(guide.featureLabel)} <ArrowRight aria-hidden="true" size={16} /></PublicTextLink>
      </article><aside className="public-guide-example">
        {isImportGuide ? <figure className="public-guide-screenshot">
          <img src="/assets/guides/import-associer-joueurs.png" width="1030" height="1065" loading="lazy" decoding="async" alt={t("Formulaire d’import NXT5 : côté bleu et profils fictifs associés aux cinq postes, de Top à Support.")} />
          <figcaption>{t("Exemple fictif : vérifie le côté de l’équipe et les cinq joueurs avant de confirmer l’import. Cette capture du formulaire utilise uniquement des identités d’exemple.")}</figcaption>
          <a href="/assets/guides/import-associer-joueurs.png" target="_blank" rel="noopener noreferrer" className="nxt5-entry-text-link">{t("Agrandir la capture ")}<span className="public-guide-image-note">{t("(nouvel onglet)")}</span><ArrowRight aria-hidden="true" size={16} /></a>
        </figure> : <DemoMatchSummary compact />}
        <PublicTextLink href="/demo" navigate={navigate} className="nxt5-entry-text-link">{t("Explorer une séance fictive ")}<ArrowRight aria-hidden="true" size={16} /></PublicTextLink><p>{t("Sans compte et sans installation. Les filtres et les analyses de la démonstration utilisent les outils NXT5 sur trois parties fictives.")}</p>
      </aside></div>
      <nav aria-label={t("Continuer la découverte")} className="public-guide-next"><BookOpen aria-hidden="true" size={20} /><PublicTextLink href={guide.nextPath} navigate={navigate}>{t(guide.nextLabel)} <ArrowRight aria-hidden="true" size={16} /></PublicTextLink></nav>
      <section className="nxt5-entry-start"><div><h2>{t("Commence avec ton équipe.")}</h2><p>{t("Accès actuellement gratuit, aucun abonnement activé.")}</p></div><LinkButton href={user ? "/equipes" : "/creer-un-compte"} navigate={navigate} icon={ArrowRight}>{user ? t("Ouvrir mon équipe") : t("Créer mon espace")}</LinkButton></section>
    </main><LegalLinks navigate={navigate} />
  </div>;
}
