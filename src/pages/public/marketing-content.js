export const MARKETING_PAGES = {
  "/analyse-equipe-lol": {
    title: "Analyse d’équipe League of Legends et statistiques | NXT5",
    description: "Analyse ton équipe League of Legends : importe tes matchs, compare les rôles à 10 et 20 minutes et prépare des décisions de coaching avec NXT5.",
    heading: "Analyser son équipe League of Legends",
    eyebrow: "Statistiques d’équipe",
    intro: "Une analyse d’équipe commence par une question précise : que se passe-t-il dans nos parties, et que voulons-nous travailler au prochain entraînement ? NXT5 rassemble les matchs importés, les statistiques par rôle et les tendances pour aider joueurs et staff à construire cette lecture ensemble.",
    sections: [
      {
        title: "Partir de matchs correctement attribués",
        text: "Avant de comparer des chiffres, crée ou rejoins une équipe, renseigne le roster et relie les bons comptes aux profils. Génère ensuite un fichier JSON avec NXT5 Importer, puis dépose-le dans l’espace Intégration. L’import permet de nommer la partie, de choisir son contexte et de vérifier le side, les lanes et les profils. Cette étape compte : une mauvaise attribution peut fausser l’historique d’un joueur et les conclusions du staff.",
        steps: [
          "Vérifie les cinq profils et leur rôle avant de valider l’import.",
          "Réunis les parties d’un même bloc dans un groupe pour les retrouver ensemble.",
          "Corrige une assignation erronée depuis l’historique avant de poursuivre l’analyse.",
        ],
      },
      {
        title: "Lire les écarts par rôle, à 10 et 20 minutes",
        text: "Dans Statistiques, retrouve une partie et consulte les deux sides. CS10 et CS20 correspondent au farm du joueur à ces moments de la partie ; DIFF10 et DIFF20 comparent ce farm à celui de l’adversaire du même rôle. Rapproche ces écarts de l’or, des morts et des objectifs. Le KDA, les dégâts ou la vision apportent d’autres éléments de lecture, mais aucun indicateur isolé ne raconte à lui seul le déroulement d’une game.",
      },
      {
        title: "Passer d’un match à une tendance vérifiable",
        text: "La page Tendances agrège les parties du contexte sélectionné. Elle permet de lire le taux de victoire global et par side, les rôles moteurs et les écarts récurrents, puis d’identifier des matchs à revoir. Commence par un ensemble cohérent : même objectif de travail, roster comparable et contexte connu. Quand un signal revient, ouvre les parties sources pour vérifier ce qu’il recouvre. La comparaison aide à formuler une hypothèse ; son interprétation reste un travail d’équipe.",
      },
      {
        title: "Exemple pédagogique : comprendre un déficit de farm",
        text: "Imaginons un bloc de trois scrims dans lequel le mid présente un DIFF10 négatif à chaque partie. Ce constat n’établit pas automatiquement un problème individuel. Le staff peut examiner les champions joués, les morts, les écarts d’or et le contexte des objectifs, puis confronter ces données aux souvenirs des joueurs ou à leur vidéo de partie. L’hypothèse retenue peut ensuite devenir une action de review, par exemple annoncer et discuter la gestion de la vague avant un déplacement. Cet exemple illustre une méthode, pas un résultat observé chez une équipe NXT5.",
      },
      {
        title: "Transformer la lecture en prochain exercice",
        text: "Termine l’analyse par une décision à conserver, un point à corriger et une action observable lors de la prochaine session. Une review liée aux matchs permet de garder les preuves à portée de main. Les données disponibles dépendent des imports et de leur qualité ; quelques parties ne suffisent pas à établir une règle générale. NXT5 fournit un espace de consultation et de suivi : les décisions sportives appartiennent au coach, au capitaine et aux joueurs.",
      },
    ],
  },
  "/review-scrim-lol": {
    title: "Review de scrim LoL : méthode et suivi d’équipe | NXT5",
    description: "Structure ta review de scrim League of Legends : retrouve les matchs, relie tes observations aux statistiques et définis une action pour la prochaine session.",
    heading: "Structurer une review de scrim LoL",
    eyebrow: "Review et coaching",
    intro: "Une review de scrim utile donne à l’équipe une priorité compréhensible pour la session suivante. Avec NXT5, tu peux partir d’une game ou d’un groupe de matchs, consulter les données associées et conserver les décisions du staff dans une bibliothèque de reviews accessible selon les permissions de chacun.",
    sections: [
      {
        title: "Préparer le bloc avant la discussion",
        text: "Importe les fichiers JSON générés avec NXT5 Importer, puis vérifie le contexte, le side, les rôles et les profils. Rassemble les matchs du bloc dans un groupe. Cette préparation évite de discuter d’une statistique attribuée au mauvais joueur ou de mélanger des sessions différentes. Avant la review, choisis une question de travail : sortie de lane, préparation d’objectif ou exécution d’une composition. Le sujet doit être assez précis pour que les cinq joueurs puissent contribuer à la discussion.",
      },
      {
        title: "Construire la review autour de trois éléments",
        text: "Crée une review depuis une partie ou un groupe. Les matchs liés restent accessibles pour revenir aux éléments qui ont motivé une observation. Sépare les faits disponibles des interprétations et des décisions : une mort est un fait, sa cause peut encore être discutée. Le guide NXT5 propose une structure simple pour conclure la review et préparer la prochaine game.",
        steps: [
          "Une décision à conserver : nomme une action ou une coordination que l’équipe veut reproduire.",
          "Un point à corriger : décris une situation précise, avec le match concerné.",
          "Une action vérifiable : indique ce que l’équipe observera pendant la prochaine session.",
        ],
      },
      {
        title: "Appuyer la discussion sur les données disponibles",
        text: "Les pages Statistiques et Tendances aident à retrouver les écarts de farm à 10 et 20 minutes, l’or, les morts et les objectifs. Utilise ces données pour sélectionner les situations à revoir, puis confronte-les au contexte de la partie. Un score de vision ne décrit pas à lui seul la qualité d’un setup ; un résultat de match ne valide pas chaque décision prise. La vidéo de partie et les explications des joueurs, lorsqu’elles sont disponibles, complètent ce que les chiffres permettent de constater.",
      },
      {
        title: "Exemple pédagogique : préparer un objectif ensemble",
        text: "Supposons qu’une équipe arrive dispersée autour d’un dragon pendant deux scrims. La review peut conserver une bonne annonce d’objectif, identifier un désaccord sur le moment de quitter les lanes et retenir une action : annoncer ensemble le plan de vague et le regroupement avant le prochain objectif contesté. Lors de la session suivante, le staff vérifie si cette coordination a eu lieu, puis revient aux parties concernées. Il s’agit d’un exemple de formulation pour la discussion, et non d’un diagnostic automatique ou d’une promesse de victoire.",
      },
      {
        title: "Retrouver les décisions et préparer la suite",
        text: "La bibliothèque Rapports permet de rechercher, filtrer, ouvrir et modifier les reviews selon les droits du membre. Le planning centralise les disponibilités de la semaine courante ou suivante et les événements Scrim, Match et Review. Tu peux ainsi organiser un temps de retour après le bloc et relire la priorité avant de rejouer. Garde peu d’actions simultanées, formule-les sans jugement sur les personnes et réévalue-les avec les nouvelles parties : la review reste un support de dialogue entre joueurs et staff.",
      },
    ],
  },
  "/draft-champion-pool-lol": {
    title: "Champion pool et préparation de draft LoL | NXT5",
    description: "Prépare tes drafts League of Legends avec un champion pool par joueur, des niveaux de maîtrise et des compositions organisées par rôle, side et condition de jeu.",
    heading: "Préparer sa draft et son champion pool LoL",
    eyebrow: "Champion pool et compositions",
    intro: "Préparer une draft commence avant la sélection des champions : le staff doit savoir ce que chaque joueur maîtrise et comment les cinq picks peuvent fonctionner ensemble. NXT5 permet d’organiser les champion pools par joueur puis de préparer des compositions avec leurs rôles, leur side, leurs tags et leur condition de jeu.",
    sections: [
      {
        title: "Construire un pool qui reflète la maîtrise des joueurs",
        text: "Le Champion Pool classe les champions de chaque joueur par tier de maîtrise. Les statuts distinguent les picks de confiance, situationnels, en validation et en développement. Utilise cette distinction pour discuter de ce que l’équipe peut déjà jouer et de ce qui demande encore du travail. Un champion présent dans un pool n’est pas nécessairement prêt pour un match : les parties récentes et le retour du joueur doivent éclairer son classement.",
        steps: [
          "Vérifie le profil et le rôle associés au joueur.",
          "Classe les champions selon le niveau de confiance partagé avec le staff.",
          "Réévalue les picks en validation après les sessions où ils ont été travaillés.",
        ],
      },
      {
        title: "Passer des picks individuels à une composition",
        text: "Dans Compositions, glisse les champions depuis le pool vers leur rôle. Précise le side, ajoute des tags et décris la condition de jeu pour rendre la préparation lisible par le staff. Le but est d’expliciter ce que les cinq picks cherchent à réaliser ensemble : comment ils abordent les lanes, se regroupent ou jouent autour d’un objectif. Cette préparation donne une base de discussion avant le scrim, que l’équipe peut confronter ensuite à son expérience de la partie.",
      },
      {
        title: "Définir ce que le scrim doit réellement tester",
        text: "Avant de lancer un bloc, distingue le test d’un nouveau champion de l’entraînement d’une composition déjà connue. Si plusieurs picks sont en développement, le résultat seul dira peu de choses sur la solidité du plan. Choisis une question observable, puis indique dans la review ce qui a fonctionné et ce qui reste à valider. Les statistiques des matchs et les tendances peuvent orienter la discussion, à condition de rouvrir les parties sources avant de modifier les priorités de draft.",
      },
      {
        title: "Exemple pédagogique : tester un plan de regroupement",
        text: "Imaginons une composition préparée sur le blue side avec une condition de jeu centrée sur le regroupement autour des objectifs. Quatre picks sont de confiance et celui du support est encore en validation. Le staff peut choisir de travailler la coordination avant l’objectif, puis relire les parties avec le support et les autres joueurs. Une défaite ne suffit pas à déclasser le pick, pas plus qu’une victoire ne démontre sa maîtrise. Cet exemple sert à organiser le test ; il ne recommande aucun champion ni aucune composition comme choix optimal du patch.",
      },
      {
        title: "Faire évoluer la préparation avec les parties",
        text: "Après le bloc, relie les observations à une review, réévalue le niveau de maîtrise des picks travaillés et prépare le prochain exercice. Les imports, l’historique des profils et le retour des joueurs apportent des éléments complémentaires. La qualité du plan dépend aussi de l’adversaire, du patch et de l’exécution collective. NXT5 sert à documenter les pools et les compositions ; les choix de champions et leur interprétation restent sous la responsabilité du staff et des joueurs.",
      },
    ],
  },
};
