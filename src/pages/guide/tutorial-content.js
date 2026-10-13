// Contenu du tutoriel de l’Aide. Les textes sont des clés de traduction : les
// libellés d’interface repris tels quels ({0}, {1}…) gardent la traduction de
// l’application. Les exemples (équipe Horizon, adversaires Aurore et Orbite)
// sont fictifs et reprennent la démonstration publique.

export const TUTORIAL_SECTION_ID = "tutoriel";

export const TUTORIAL_ACTS = [
  { id: "joue", numeral: "I", word: "Joue.", from: "01", to: "04", promise: "Mets l’équipe en place et ramène ta partie dans NXT5." },
  { id: "analyse", numeral: "II", word: "Analyse.", from: "05", to: "09", promise: "Lis la partie, garde l’essentiel dans un débrief, cherche ce qui revient d’une partie à l’autre." },
  { id: "recommence", numeral: "III", word: "Recommence.", from: "10", to: "15", promise: "Prépare la prochaine séance, fais progresser chaque joueur et partage le bilan avec l’équipe." },
];

const UI = (label) => label;
const CMD = (command, copy = false) => ({ cmd: command, copy });
const RAW = (text) => ({ raw: text });

export const TUTORIAL_CHAPTERS = [
  {
    id: "depart", num: "01", act: "joue", for: ["tous"], short: "Créer ou rejoindre", mock: "accueil",
    rubric: ["Accueil"], where: "/accueil",
    title: "Créer ou rejoindre ton équipe",
    intro: ["À la première arrivée, NXT5 te demande ton point de départ. Ensuite, l’Accueil te propose une seule action principale à la fois."],
    steps: [
      { z: "1", lead: "Choisis {0} ou {1}.", text: "Une invitation préremplit le formulaire pour rejoindre l’équipe.", values: [UI("Créer mon équipe"), UI("Rejoindre mon équipe")] },
      { z: "2", lead: "Suis {0}.", text: "Responsable : importer une première partie. Joueur : ouvrir ton profil relié et renseigner tes disponibilités.", values: [UI("Ta prochaine action")] },
      { z: "3", lead: "Les étapes suivantes restent visibles", text: "dans {0}, sous forme de progression compacte.", values: [UI("Tes premiers repères")] },
      { z: "4", lead: "{0} te sort du parcours.", text: "L’Accueil affiche alors {1} tant qu’il reste des étapes. Le bouton {2}, en haut de l’écran, explique la rubrique en cours.", values: [UI("Explorer librement"), UI("Reprendre le démarrage"), UI("Aide")] },
    ],
    tip: { lead: "À retenir.", text: "Pas besoin de créer cinq joueurs ni d’importer trois parties pour commencer : une partie suffit, et les profils peuvent être créés pendant l’import." },
    link: { label: "Revenir à l’accueil", path: "/accueil" },
    caption: "Exemple fictif · premier accès d’un responsable d’équipe.",
  },
  {
    id: "effectif", num: "02", act: "joue", for: ["staff"], short: "L’effectif", mock: "equipe",
    rubric: ["Mon équipe"], where: "/mon-equipe",
    title: "Monter l’effectif",
    intro: ["Mon équipe présente les titulaires, les remplaçants et l’encadrement. Les profils et les accès se gèrent dans Gestion de l’équipe."],
    steps: [
      { z: "1", lead: "Ouvre un joueur", text: "depuis la liste pour consulter son profil et ses champions les plus joués." },
      { z: "2", lead: "{0} copie le lien", text: "des titulaires et des remplaçants.", values: [UI("Copier le multi OP.GG")] },
      { z: "3", lead: "Dans Gestion de l’équipe, crée les profils", text: "et vérifie le poste, le Riot ID et le statut Titulaire ou Remplaçant." },
      { z: "4", lead: "Associe chaque compte NXT5 au bon profil", text: "et vérifie les accès avant de partager une invitation avec {0}.", values: [UI("Inviter dans l’équipe")] },
    ],
    tip: { lead: "À retenir.", text: "Un profil joueur représente une personne de l’effectif et peut exister avant son compte. Une invitation reste valable une heure ; une nouvelle invitation remplace la précédente." },
    link: { label: "Ouvrir l’équipe", path: "/mon-equipe" },
    caption: "Exemple fictif · l’équipe Horizon et ses cinq titulaires.",
  },
  {
    id: "export", num: "03", act: "joue", for: ["staff"], short: "NXT5 Importer", mock: "importer",
    rubric: ["NXT5 Importer"], where: "Windows · Mac",
    title: "Exporter la partie avec NXT5 Importer",
    intro: ["NXT5 Importer récupère le fichier de la partie dans le client League of Legends. Il te faut un ordinateur Windows (64 bits) ou Mac, avec le client ouvert. Ensuite, tu consultes les résultats où tu veux, même sur mobile."],
    steps: [
      { z: "1", lead: "Télécharge l’application.", text: "Dans Parties, choisis {0}, puis {1} : Windows (64 bits), Mac Apple Silicon ou Mac Intel.", values: [UI("Importer une partie"), UI("Pas encore de fichier ? Obtenir NXT5 Importer")] },
      { z: "2", lead: "Garde League of Legends ouvert", text: "sur le même ordinateur. L’Importer doit trouver le client avant d’exporter." },
      { z: "3", lead: "Renseigne l’identifiant du match", text: "copié depuis l’historique du client. Pour un numéro sans préfixe, choisis le serveur de la partie." },
      { z: "4", lead: "Clique sur {0}", text: "et enregistre le fichier .json. Il reste sur ton ordinateur tant que tu ne l’as pas importé dans NXT5.", values: [UI("Exporter la game")] },
    ],
    tip: { lead: "Au premier lancement,", text: "Microsoft Defender SmartScreen ou la vérification Apple peuvent afficher une alerte. NXT5 détaille la marche à suivre dans {0}.", values: [UI("Aide à l’ouverture sur Windows et Mac")] },
    link: { label: "Télécharger NXT5 Importer", path: "/games?import=1" },
    caption: "Illustration · identifiant de match fictif.",
  },
  {
    id: "import", num: "04", act: "joue", for: ["staff"], short: "Importer la partie", mock: "import",
    rubric: ["Parties"], where: "/games?import=1",
    title: "Importer la partie dans l’équipe",
    intro: ["Charger le fichier ne suffit pas : la partie n’appartient à l’équipe qu’au moment où tu confirmes l’import. Vérifie d’abord le côté, les postes et les cinq joueurs."],
    steps: [
      { z: "1", lead: "Dans Parties, clique sur {0}", text: "et charge le JSON exporté. Sélectionne la bonne équipe avant : l’import lui appartiendra.", values: [UI("Choisir mon fichier")] },
      { z: "2", lead: "Choisis le côté de ton équipe,", text: "bleu ou rouge, en vérifiant les noms et les champions." },
      { z: "3", lead: "Pour chaque poste, associe un profil différent", text: "— TOP, JGL, MID, ADC et SUP. Un profil manque ? {0} le crée depuis le fichier.", values: [UI("Créer les profils proposés")] },
      { z: "4", lead: "Donne un nom reconnaissable,", text: "par exemple « Scrim Aurore · partie 1 », et choisis au moins un tag." },
      { z: "5", lead: "Associe l’adversaire si c’est utile.", text: "Dans {0}, choisis une fiche ou clique sur {1}.", values: [UI("Équipe adverse (facultatif)"), UI("Nouvelle équipe")] },
      { z: "6", lead: "Clique sur {0}", text: "et attends le message « Partie importée ».", values: [UI("Confirmer l’import")] },
    ],
    tip: { lead: "Bouton désactivé ?", text: "Le texte juste au-dessus indique ce qu’il manque : côté, association de joueurs ou de champions, postes adverses, nom, tag ou nom d’une nouvelle équipe adverse." },
    link: { label: "Importer une partie", path: "/games?import=1" },
    caption: "Exemple fictif · Horizon côté bleu contre Aurore.",
  },
  {
    id: "lire", num: "05", act: "analyse", for: ["tous"], short: "Lire une partie", mock: "partie", demo: true,
    rubric: ["Parties"], where: "/games",
    title: "Lire le bilan d’une partie",
    intro: ["Commence par le résumé. Ouvre les détails pour vérifier une observation avant d’en discuter avec l’équipe."],
    steps: [
      { z: "1", lead: "Dans Parties, recherche puis ouvre la partie.", text: "Les groupes réunissent les parties d’une même séance." },
      { z: "2", lead: "Lis le résultat,", text: "les points à garder ou à vérifier, puis la prochaine action proposée." },
      { z: "3", lead: "Ouvre {0},", text: "puis la chronologie si les événements sont disponibles. Ici, déplace le curseur pour suivre l’écart d’or.", values: [UI("Statistiques et comparaison 5 contre 5")] },
      { z: "4", lead: "Vérifie les champions et les postes", text: "des deux équipes." },
      { z: "5", lead: "Choisis {0}", text: "pour garder les observations liées à cette partie ou à ce groupe.", values: [UI("Préparer un débrief")] },
    ],
    tip: { lead: "Une donnée absente ne vaut pas zéro.", text: "Un tiret « — » signale une valeur inconnue, et une chronologie absente ne prouve pas qu’aucune action n’a eu lieu." },
    link: { label: "Ouvrir les parties", path: "/games" },
    caption: "Déplace le curseur ou touche un objectif. Courbe et notes illustratives.",
  },
  {
    id: "debrief", num: "06", act: "analyse", for: ["tous"], short: "Le débrief", mock: "debrief",
    rubric: ["Débriefs"], where: "/rapports",
    title: "Préparer un débrief utile",
    intro: ["Pendant le débrief, aussi appelé review, l’équipe choisit ce qu’elle veut travailler à partir d’une partie. Note un fait vérifiable, une question et une action à essayer ensemble."],
    steps: [
      { z: "1", lead: "Depuis une partie ou un groupe, choisis {0}.", text: "Le débrief d’un groupe reprend son nom.", values: [UI("Préparer un débrief")] },
      { z: "2", lead: "Le fait :", text: "un résultat mesuré et son contexte. Distingue une valeur finale d’un événement observé à un instant du replay." },
      { z: "3", lead: "La question plutôt qu’un verdict :", text: "qu’est-ce qui a rendu la décision possible ? Choisis une séquence à revoir." },
      { z: "4", lead: "L’action :", text: "observable, à essayer à la prochaine séance, avec la façon de la vérifier." },
      { z: "5", lead: "{0} l’enregistre.", text: "{1} te laisse naviguer, mais ce brouillon ne survit pas au rechargement de l’onglet.", values: [UI("Créer le débrief"), UI("Fermer et garder le brouillon")] },
    ],
    tip: { lead: "L’analyse automatique propose des pistes", text: "à vérifier dans les parties liées. Elle ne conclut pas sur la responsabilité d’un joueur : c’est l’équipe qui décide." },
    link: { label: "Ouvrir les débriefs", path: "/rapports" },
    caption: "Exemple fictif · tiré du troisième scrim de la démonstration.",
  },
  {
    id: "adversaires", num: "07", act: "analyse", for: ["staff"], short: "Équipes adverses", mock: "adversaires",
    rubric: ["Parties", "Équipes"], where: "/games?view=teams",
    title: "Retrouver les parties d’un adversaire",
    intro: ["L’onglet Équipes regroupe les fiches adverses de l’équipe sélectionnée. Tous les membres peuvent les consulter ; le propriétaire et le staff autorisé les créent et gèrent les associations."],
    steps: [
      { z: "1", lead: "Dans Parties › Équipes, recherche ou trie les fiches,", text: "puis ouvre un adversaire ou crée sa fiche avec les notes utiles." },
      { z: "2", lead: "Consulte {0}, {1} et {2}.", text: "Parties présente aussi les groupes liés à cet adversaire.", values: [UI("Vue d’ensemble"), UI("Parties"), UI("Drafts")] },
      { z: "3", lead: "Associe une fiche", text: "pendant l’import, ou depuis la partie avec {0} › {1}.", values: [UI("Équipe adverse"), UI("Enregistrer l’adversaire")] },
      { z: "4", lead: "Pour toute une séance,", text: "ouvre le groupe, choisis {0}, puis {1}. Le lien s’applique aux parties actuelles et futures.", values: [UI("Équipe adverse du groupe"), UI("Enregistrer le lien")] },
    ],
    tip: { lead: "Vérifie la source et le nombre de parties.", text: "Les picks d’une draft complètent les champions manquants, sans confirmer qu’ils ont été joués." },
    link: { label: "Ouvrir les équipes adverses", path: "/games?view=teams" },
    caption: "Exemple fictif · fiches Aurore et Orbite de la démonstration.",
  },
  {
    id: "analyses", num: "08", act: "analyse", for: ["tous"], short: "Analyses", mock: "analyses",
    rubric: ["Analyses"], where: "/tendances",
    title: "Repérer ce qui revient",
    intro: ["Analyses compare plusieurs parties. Une répétition peut donner une piste de travail ; elle ne suffit pas à expliquer une action isolée."],
    steps: [
      { z: "1", lead: "Choisis une période et une catégorie", text: "de parties comparables." },
      { z: "2", lead: "Vérifie combien de parties sont analysées", text: "avant de lire un taux de victoire." },
      { z: "3", lead: "Dans Champions, sélectionne un champion :", text: "nombre de parties, victoires et KDA disponible, par rôle." },
      { z: "4", lead: "Remonte aux sources", text: "avec {0} ou {1}. {2} montre les autres champions au même rôle, les adversaires et les associations alliées.", values: [UI("Voir les parties"), UI("Revoir les défaites"), UI("Comparer et approfondir")] },
    ],
    tip: { lead: "Ces résultats décrivent tes parties,", text: "ils ne prouvent pas une synergie. Tiens compte du nombre de parties et des données manquantes avant de retenir une piste." },
    link: { label: "Ouvrir les analyses", path: "/tendances" },
    caption: "Exemple fictif · calculé sur les trois scrims de la démonstration.",
  },
  {
    id: "drafts", num: "09", act: "analyse", for: ["staff"], short: "Drafts & bans", mock: "draft", demo: true,
    rubric: ["Analyses", "Drafts & bans"], where: "/tendances?rubrique=drafts",
    title: "Rattacher la draft et rejouer les choix",
    intro: ["Ajoute à la partie une draft publique terminée de Drafter.lol, puis étudie les picks, les bans et leur ordre. Les fréquences décrivent ton échantillon ; elles ne prouvent pas l’efficacité d’un choix."],
    steps: [
      { z: "1", lead: "Dans {0}, colle le lien Drafter", text: "de la bonne game, par exemple avec {1}, puis {2}.", values: [UI("Draft de la partie (facultatif)"), RAW("?game=2"), UI("Vérifier la draft")] },
      { z: "2", lead: "Relis l’aperçu, choisis le côté de ton équipe,", text: "puis {0}. Les noms de Drafter ne créent pas de fiches adverses.", values: [UI("Rattacher la draft")] },
      { z: "3", lead: "Dans Analyses › Drafts & bans,", text: "règle {0}, {1} et {2}.", values: [UI("Équipe adverse liée"), UI("Bans à analyser"), UI("Côté de notre équipe")] },
      { z: "4", lead: "Ouvre {0}", text: "et rejoue la draft étape par étape avec le tableau de draft.", values: [UI("Ordre des picks et des bans")] },
    ],
    tip: { lead: "L’ordre est reconstitué", text: "depuis les emplacements finaux vérifiés de Drafter : il ne retrace pas les corrections et ne donne pas les rôles joués." },
    link: { label: "Ouvrir Drafts & bans", path: "/tendances?rubrique=drafts" },
    caption: "Rejoue la draft avec les quatre boutons. Picks et bans fictifs.",
  },
  {
    id: "pool", num: "10", act: "recommence", for: ["tous"], short: "Champion pool", mock: "pool",
    rubric: ["Draft & Pool", "Champions des joueurs"], where: "/draft/pool",
    title: "Déclarer les champions de chacun",
    intro: ["Le champion pool est la liste des champions qu’un joueur prépare. Son niveau indique sa maîtrise actuelle."],
    steps: [
      { z: "1", lead: "Dans Draft & Pool › {0},", text: "choisis le joueur et son rôle.", values: [UI("Champions des joueurs")] },
      { z: "2", lead: "Ajoute les champions", text: "et indique leur niveau de maîtrise." },
      { z: "3", lead: "Distingue les champions prêts à jouer", text: "de ceux encore en entraînement, grâce aux quatre niveaux." },
    ],
    tip: { lead: "Mets la liste à jour après les séances de travail.", text: "L’aide à la composition s’appuie d’abord sur cette maîtrise déclarée." },
    link: { label: "Choisir les champions", path: "/draft/pool" },
    caption: "Exemple fictif · le pool du MID d’Horizon.",
  },
  {
    id: "compo", num: "11", act: "recommence", for: ["staff"], short: "Compositions", mock: "compo",
    rubric: ["Draft & Pool", "Compositions"], where: "/draft/compositions",
    title: "Préparer une composition",
    intro: ["Une composition rassemble cinq champions et leur plan de jeu. Prépare-la pour le côté choisi, avec les champions que tes joueurs peuvent jouer."],
    steps: [
      { z: "1", lead: "Dans Compositions, prépare une composition pour le côté choisi.", text: "Les filtres {0}, {1} et {2} la retrouvent ensuite.", values: [UI("Toutes"), UI("Côté bleu"), UI("Côté rouge")] },
      { z: "2", lead: "Place un champion par rôle,", text: "parmi ceux que les joueurs peuvent jouer." },
      { z: "3", lead: "Ouvre {0} :", text: "sélectionne le poste, puis éventuellement le champion adverse, la catégorie et le patch. Choisir un champion l’ajoute au brouillon.", values: [UI("Aide au choix : pool et parties de l’équipe")] },
      { z: "4", lead: "Écris le plan de jeu, nomme et enregistre", text: "la composition. Les filtres de l’aide ne sont pas enregistrés." },
    ],
    tip: { lead: "La maîtrise déclarée passe avant le nombre de parties.", text: "Le taux de victoire ne classe pas les suggestions et ne garantit pas un avantage en lane." },
    link: { label: "Ouvrir les compositions", path: "/draft/compositions" },
    caption: "Exemple fictif · une composition côté bleu pour Horizon.",
  },
  {
    id: "planning", num: "12", act: "recommence", for: ["tous"], short: "Planning", mock: "planning",
    rubric: ["Planning"], where: "/planning",
    title: "Organiser la prochaine séance",
    intro: ["Le planning réunit les disponibilités, les séances et les précisions de l’équipe pour la semaine affichée.", "Le prochain scrim commence avant le lobby."],
    steps: [
      { z: "1", lead: "Choisis la bonne semaine", text: "et renseigne les créneaux où tu es disponible." },
      { z: "2", lead: "Ajoute une précision", text: "sur tes disponibilités : 500 caractères maximum, visibles par toute l’équipe une fois enregistrés." },
      { z: "3", lead: "Consulte {0} ;", text: "{1} récupère les dernières notes enregistrées.", values: [UI("Précisions de l’équipe"), UI("Actualiser les précisions")] },
      { z: "4", lead: "Selon tes droits, ajoute une séance", text: "de type Entraînement, Match ou Débrief, puis vérifie les disponibilités avec l’équipe." },
    ],
    tip: { lead: "Boucle la boucle.", text: "Au débrief suivant, reprends l’action choisie et note si elle a été appliquée, non appliquée ou impossible à vérifier, avec la raison." },
    link: { label: "Ouvrir le planning", path: "/planning" },
    caption: "Exemple fictif · la semaine d’Horizon.",
  },
  {
    id: "profil", num: "13", act: "recommence", for: ["joueur"], short: "Mon profil", mock: "profil",
    rubric: ["Mon profil"], where: "/mon-profil",
    title: "Suivre ta progression",
    intro: ["Le profil réunit la synthèse, les champions, l’historique, le suivi et Carte & Wrapped du joueur sélectionné, dans la catégorie choisie."],
    steps: [
      { z: "1", lead: "Vérifie le joueur et la catégorie sélectionnés,", text: "ainsi que la liaison entre ton compte et ton profil." },
      { z: "2", lead: "Lis la Synthèse, puis ouvre Historique", text: "pour retrouver les parties à l’origine des chiffres. Les objectifs et les notes du coach sont dans {0}, selon tes droits.", values: [UI("Suivi")] },
      { z: "3", lead: "Dans Champions joués, ouvre {0} :", text: "choisis un adversaire au même poste et retrouve les parties de cette confrontation.", values: [UI("Matchups")] },
      { z: "4", lead: "Note ton plan dans {0},", text: "puis {1} si tu as le droit de modification.", values: [UI("Plan de départ et essais"), UI("Enregistrer le carnet")] },
    ],
    tip: { lead: "Les dégâts moyens se lisent avec le nombre de parties renseignées.", text: "Une valeur absente s’affiche « — ». Vérifie dans les parties liées avant de conclure." },
    link: { label: "Ouvrir mon profil", path: "/mon-profil" },
    caption: "Exemple fictif · le profil du MID d’Horizon.",
  },
  {
    id: "carte", num: "14", act: "recommence", for: ["joueur"], short: "Carte & Wrapped", mock: "carte", demo: true,
    rubric: ["Mon profil", "Carte & Wrapped"], where: "/mon-profil/carte",
    title: "Découvrir ta carte et ton Wrapped",
    intro: ["La carte et le Wrapped utilisent les parties reliées au joueur dans la catégorie sélectionnée. Les chiffres décrivent cette sélection, sans attribuer une note de niveau."],
    steps: [
      { z: null, lead: "Dans Mon profil, choisis le joueur et la catégorie,", text: "puis ouvre {0}.", values: [UI("Carte & Wrapped")] },
      { z: "2", lead: "Parcours la carte", text: "avec {0} et {1} ; {2} ouvre le visuel en grand.", values: [UI("Voir le verso"), UI("Voir le recto"), UI("Agrandir")] },
      { z: "3", lead: "Choisis {0}", text: "et avance dans les cinq chapitres avec les boutons, les flèches du clavier ou un glissement.", values: [UI("Découvrir le Wrapped")] },
      { z: "4", lead: "Exporte en PNG", text: "la carte, le verso ou le chapitre affiché." },
    ],
    tip: { lead: "Carte vide ?", text: "Vérifie la catégorie et les parties reliées au joueur. {0} détaille ce qui est compté.", values: [UI("Données et méthode de cette édition")] },
    link: { label: "Ouvrir Carte & Wrapped", path: "/mon-profil/carte" },
    caption: "Retourne la carte. Chiffres calculés sur la démonstration.",
  },
  {
    id: "discord", num: "15", act: "recommence", for: ["tous"], short: "Bot Discord", mock: "discord",
    rubric: ["Bot Discord"], where: "/bot-discord",
    title: "Relier Discord et partager les parties",
    intro: ["La page Bot Discord rassemble la liaison de ton compte et les réglages du serveur. Le propriétaire ou un capitaine gère la connexion ; le staff autorisé peut publier."],
    steps: [
      { z: "1", lead: "Lie ton compte", text: "avec {0}, ouvre le lien privé et confirme les deux comptes sur NXT5 et sur Discord.", values: [CMD("/nxt lier", true)] },
      { z: "2", lead: "Propriétaire ou capitaine :", text: "crée un code dans Bot Discord, puis lance {0} sur le serveur. Le code sert une fois et expire après dix minutes. Choisis ensuite les salons et teste la connexion.", values: [CMD("/nxt connecter code:<code>")] },
      { z: "3", lead: "Dans le salon de commandes,", text: "{0} ouvre le tutoriel et {1} montre la dernière partie, le bilan, les stats, le planning, les objectifs, les reviews ou la draft.", values: [CMD("/nxt help", true), CMD("/nxt voir")] },
      { z: "4", lead: "Depuis une partie ou un groupe, {0} :", text: "choisis le salon, vérifie l’aperçu du message et du visuel, puis confirme.", values: [UI("Exporter sur Discord")] },
    ],
    tip: { lead: "Envoi incertain ?", text: "Vérifie son état dans l’historique avant de réessayer, pour éviter une double publication." },
    link: { label: "Ouvrir Bot Discord", path: "/bot-discord" },
    caption: "Exemple fictif · un salon de l’équipe Horizon.",
  },
];

export const TUTORIAL_PATHS = {
  staff: [
    { id: "staff-1", label: "Créer mon équipe", chapter: "depart" },
    { id: "staff-2", label: "Exporter une partie avec NXT5 Importer", chapter: "export" },
    { id: "staff-3", label: "Importer la partie et ouvrir son résumé", chapter: "import" },
    { id: "staff-4", label: "Enregistrer un premier débrief", chapter: "debrief" },
  ],
  joueur: [
    { id: "joueur-1", label: "Rejoindre mon équipe avec l’invitation", chapter: "depart" },
    { id: "joueur-2", label: "Découvrir mon profil relié", chapter: "profil" },
    { id: "joueur-3", label: "Renseigner mes disponibilités", chapter: "planning" },
    { id: "joueur-4", label: "Ouvrir une partie ou un débrief de l’équipe", chapter: "lire" },
  ],
};

// Les rubriques reprennent les libellés et les indications de la navigation.
export const TUTORIAL_PLAN = [
  { group: "Au quotidien", items: [
    { label: "Accueil", hint: "Tes prochaines actions", chapter: "depart", icon: "home" },
    { label: "Mon équipe", hint: "Retrouver tes joueurs", chapter: "effectif", icon: "teams" },
    { label: "Parties", hint: "Importer et revoir une partie", chapter: "import", icon: "matches" },
    { label: "Planning", hint: "Organiser les séances", chapter: "planning", icon: "planning" },
    { label: "Mon profil", hint: "Suivre ta progression", chapter: "profil", icon: "profile" },
  ] },
  { group: "Préparation et partage", items: [
    { label: "Débriefs", hint: "Noter les points à travailler", chapter: "debrief", icon: "reports" },
    { label: "Analyses", hint: "Comparer tes parties", chapter: "analyses", icon: "trends" },
    { label: "Draft & Pool", hint: "Choisir les champions", chapter: "pool", icon: "draft" },
    { label: "Bot Discord", hint: "Connexion et publications", chapter: "discord", icon: "discord" },
  ] },
];

export const TUTORIAL_RIGHTS = [
  { action: "Importer une partie", who: ["Propriétaire", "Staff autorisé"] },
  { action: "Créer une invitation", who: ["Propriétaire", "Capitaine", "Manager"], note: "Valable une heure. Une nouvelle invitation remplace la précédente." },
  { action: "Modifier les droits d’accès", who: ["Propriétaire", "Capitaine"] },
  { action: "Créer les fiches adverses et les associer", who: ["Propriétaire", "Staff autorisé"], note: "Tous les membres peuvent consulter les fiches." },
  { action: "Rattacher une draft Drafter", who: ["Propriétaire", "Staff autorisé"] },
  { action: "Connecter le serveur Discord", who: ["Propriétaire", "Capitaine"] },
  { action: "Publier une partie sur Discord", who: ["Staff autorisé"] },
  { action: "Renseigner ses disponibilités", who: ["Tous les membres"], everyone: true },
];

export const TUTORIAL_FAQ = [
  ["L’Importer ne détecte pas League of Legends", "Vérifie que le client est ouvert sur le même ordinateur. Dans les Paramètres de l’Importer, contrôle le dossier d’installation du client, puis relance la vérification. Si la partie reste inaccessible, contrôle son identifiant et son serveur."],
  ["Le fichier est refusé", "Le site attend le fichier JSON exporté par NXT5 Importer, de 5 Mo maximum, sans modification. S’il est incomplet ou invalide, réexporte la partie avec la dernière version de l’Importer."],
  ["Un joueur manque ou apparaît sur deux postes", "Associe chacun des cinq postes à un profil distinct de l’équipe active. Vérifie les profils existants avant d’en créer un. Pour les profils proposés depuis le fichier, chaque nom et chaque Riot ID complet doivent être renseignés et différents."],
  ["L’import n’est pas disponible pour mon compte", "L’import est réservé au propriétaire ou au staff autorisé de l’équipe sélectionnée. Un profil joueur dans l’effectif ne donne pas, à lui seul, un accès de gestion à ton compte."],
  ["La draft Drafter ne se lit pas", "Vérifie que le lien est public et que la draft est terminée. Un aperçu expiré doit être vérifié à nouveau avant l’enregistrement."],
  ["Le problème persiste", "Conserve le message d’erreur exact pour demander de l’aide. Le bouton Aide, en haut de l’écran, ouvre aussi l’explication de la rubrique en cours."],
];

export const TUTORIAL_GLOSSARY = [
  ["Scrim", "Partie d’entraînement entre deux équipes."],
  ["Débrief", "Le moment où l’équipe choisit ce qu’elle veut travailler à partir d’une partie."],
  ["Groupe", "Les parties d’une même séance, réunies pour être relues ensemble."],
  ["Draft", "La phase de choix des champions : picks et bans des deux équipes."],
  ["Champion pool", "La liste des champions qu’un joueur prépare, avec leur niveau de maîtrise."],
  ["Composition", "Cinq champions, un par rôle, et leur plan de jeu."],
  ["Côté bleu / rouge", "Le camp de l’équipe sur la Faille de l’invocateur. Le côté bleu choisit en premier."],
  ["Riot ID", "L’identifiant du compte League of Legends, au format Nom#TAG."],
  ["Tag", "L’étiquette qui classe une partie. Au moins une par import."],
];

/** Every French source string carried by the data above, for translation checks. */
export function tutorialDataStrings() {
  const strings = new Set();
  const add = (value) => { if (typeof value === "string" && value.trim()) strings.add(value); };
  for (const act of TUTORIAL_ACTS) [act.word, act.promise].forEach(add);
  for (const chapter of TUTORIAL_CHAPTERS) {
    [chapter.short, chapter.title, chapter.caption, chapter.link.label, chapter.tip.lead, chapter.tip.text, ...chapter.intro, ...chapter.rubric].forEach(add);
    (chapter.tip.values || []).forEach(add);
    for (const step of chapter.steps) [step.lead, step.text, ...(step.values || [])].forEach(add);
  }
  for (const list of Object.values(TUTORIAL_PATHS)) list.forEach((item) => add(item.label));
  for (const group of TUTORIAL_PLAN) { add(group.group); group.items.forEach((item) => { add(item.label); add(item.hint); }); }
  for (const right of TUTORIAL_RIGHTS) [right.action, right.note, ...right.who].forEach(add);
  for (const pair of [...TUTORIAL_FAQ, ...TUTORIAL_GLOSSARY]) pair.forEach(add);
  return [...strings];
}
