import { ASSISTANT_TRANSLATIONS } from './assistant-knowledge-locales';

export type AssistantLanguage = 'fr' | 'en' | 'es';
export function normalizeAssistantLanguage(value: unknown): AssistantLanguage {
  return value === 'en' || value === 'es' ? value : 'fr';
}

export type AssistantAction = {
  label: string;
  path: string;
};

export type AssistantSource = {
  id: string;
  title: string;
  path: string;
};

export type AssistantFaq = {
  question: string;
  triggers: string[];
  answer: string;
};

export type AssistantKnowledgeEntry = AssistantSource & {
  summary: string;
  keywords: string[];
  steps: string[];
  suggestions: string[];
  actionLabel: string;
  faq?: AssistantFaq[];
};

export type AssistantKnowledgeMatch = AssistantKnowledgeEntry & {
  score: number;
};

export const ALLOWED_ASSISTANT_PATHS = [
  '/accueil',
  '/mon-equipe',
  '/gestion-equipe',
  '/bot-discord',
  '/games',
  '/integration',
  '/statistiques',
  '/rapports',
  '/tendances',
  '/draft/pool',
  '/draft/compositions',
  '/planning',
  '/mon-profil',
  '/mon-profil/champions',
  '/mon-profil/pool',
  '/mon-profil/historique',
  '/mon-profil/coaching',
  '/mon-profil/carte',
  '/guide',
  '/parametres'
] as const;

const ALLOWED_PATH_SET = new Set<string>(ALLOWED_ASSISTANT_PATHS);

export const ASSISTANT_KNOWLEDGE: AssistantKnowledgeEntry[] = [
  {
    id: 'getting-started',
    title: 'Démarrer sur NXT5',
    path: '/accueil',
    actionLabel: 'Ouvrir l’accueil',
    summary: "L’accueil propose le prochain pas selon ton rôle et l’activité de l’équipe : premiers réglages, partie à relire, disponibilités ou suivi du joueur.",
    keywords: ['commencer', 'débuter', 'première fois', 'guide', 'parcours', 'aide', 'utiliser le site', 'accueil', 'prochain pas'],
    steps: [
      "Crée une équipe ou rejoins-la avec un code temporaire.",
      "Suis le prochain pas proposé sur l’accueil. Les profils joueurs peuvent être préparés dans Gestion de l’équipe ou créés pendant l’import.",
      "Dans Parties, importe le fichier JSON et associe les cinq postes à cinq profils différents avant de confirmer.",
      "Lis le bilan de la partie, puis prépare un débrief avec les points à travailler."
    ],
    suggestions: [
      "Comment importer ma première partie ?",
      "Comment ajouter les joueurs ?",
      "Comment préparer un débrief utile ?"
    ]
  },
  {
    id: 'teams-and-roster',
    title: "Équipe, joueurs et accès",
    path: '/gestion-equipe',
    actionLabel: 'Gérer l’équipe',
    summary: "Mon équipe présente les joueurs et l’encadrement. Gestion de l’équipe permet d’ajouter les profils, de choisir les titulaires et remplaçants, de lier les comptes et de régler les accès.",
    keywords: ['équipe', 'team', 'roster', 'joueur', 'staff', 'main team', 'sub', 'remplaçant', 'riot id', 'opgg', 'invitation', 'lier compte', 'modifier nom', 'accès', 'santé des données', 'fiabilité', "titulaire", "encadrement", "effectif"],
    steps: [
      "Ouvre Gestion de l’équipe depuis la page Mon équipe ou le bouton en haut de l’application.",
      "Ajoute le profil et son poste, puis choisis Titulaire ou Remplaçant dans Effectif.",
      "Associe le bon compte NXT5 au profil joueur lorsque la personne a un compte.",
      "Vérifie le rôle attribué avant de partager un code d’invitation."
    ],
    suggestions: [
      "Comment ajouter un joueur ?",
      "Comment organiser les titulaires et les remplaçants ?",
      "Comment modifier le nom ou le poste d’un joueur ?"
    ],
    faq: [
      {
        "question": "Comment copier le multi OP.GG de toute l’équipe ?",
        "triggers": [
          "copier opgg",
          "copier le multi op gg",
          "multi opgg",
          "op gg main team",
          "opgg équipe",
          "opgg roster",
          "opgg titulaires"
        ],
        "answer": "Dans Mon équipe, Copier le multi OP.GG réunit les titulaires et les remplaçants disposant d’un Riot ID valide. Le staff n’est pas inclus."
      },
      {
        "question": "Pourquoi un joueur a moins de parties ?",
        "triggers": [
          "moins de games",
          "games manquantes",
          "nombre de games différent",
          "adc moins",
          "moins de parties",
          "parties manquantes"
        ],
        "answer": "Le compteur dépend du profil lié à chaque participant importé. Dans Parties, ouvre la partie concernée, puis ses options pour vérifier le joueur associé et son poste. Corrige l’association si le joueur a changé de Riot ID ou si un profil en double a été choisi."
      }
    ]
  },
  {
    id: 'imports-and-games',
    title: "Importer et gérer les parties",
    path: '/games',
    actionLabel: "Ouvrir Parties",
    summary: "Parties réunit les parties importées et leurs bilans. Importer une partie ouvre le choix du fichier. Les corrections restent accessibles depuis les options de chaque partie.",
    keywords: ['import', 'importer', 'json', 'game id', 'games', 'partie', 'side', 'lane', 'profil', 'créer les profils', 'catégorie', 'scrim', 'upload', 'historique'],
    steps: [
      "Prépare le fichier .json avec NXT5 Importer. L’aide Pas encore de fichier ? explique comment l’obtenir.",
      "Dans Parties, choisis Importer une partie, puis Choisir mon fichier.",
      "Choisis le côté de ton équipe, vérifie les postes des deux équipes et associe cinq profils différents. Crée les profils manquants depuis l’import si nécessaire.",
      "Donne un nom à la partie, ajoute une catégorie si utile, puis confirme l’import."
    ],
    suggestions: [
      "Pourquoi mon import échoue ?",
      "Comment corriger le joueur associé ?",
      "Comment retrouver une partie importée ?"
    ],
    faq: [
      {
        "question": "Pourquoi mon import ne fonctionne pas ?",
        "triggers": [
          "import échoue",
          "import erreur",
          "json refusé",
          "game introuvable",
          "upload bloqué",
          "import bloqué"
        ],
        "answer": "Vérifie tes droits de gestion, le côté choisi, les postes des deux équipes et les cinq profils joueurs différents associés. Les profils manquants peuvent être créés pendant l’import. Utilise un fichier .json récent de NXT5 Importer pour une partie terminée. Si le chargement réussit mais que l’analyse échoue, exporte à nouveau la partie depuis le PC où elle apparaît dans le client LoL."
      },
      {
        question: "Faut-il créer tous les profils avant d’importer ?",
        triggers: ['créer les profils', 'profils manquants', 'profils avant import', 'sans cinq joueurs'],
        answer: "Tu peux commencer l’import sans avoir préparé tous les profils. Après le choix du côté, vérifie les noms et Riot IDs proposés, puis crée les profils manquants dans l’import. Associe ensuite chacun des cinq postes à un profil différent avant de confirmer la partie."
      },
      {
        "question": "Comment corriger un joueur ou un poste ?",
        "triggers": [
          "corriger profil",
          "mauvaise lane",
          "mauvais joueur",
          "assignation",
          "modifier import",
          "mauvais poste"
        ],
        "answer": "Dans Parties, ouvre la partie puis ses options de gestion. Vérifie le côté, les postes et les joueurs associés avant d’enregistrer. Les bilans et analyses utilisent ensuite ces associations corrigées."
      }
    ]
  },
  {
    id: 'statistics',
    title: "Lire le bilan d’une partie",
    path: '/games',
    actionLabel: "Voir les parties",
    summary: "Le bilan commence par L’essentiel de la partie. Les statistiques, les points à approfondir et la chronologie s’ouvrent ensuite selon ta question.",
    keywords: ['statistiques', 'stats', 'kda', 'kp', 'cs10', 'cs20', 'diff10', 'diff20', 'or', 'vision', 'build', 'objectif', 'timeline', 'groupe', "bilan", "chronologie", "écart", "sbires"],
    steps: [
      "Dans Parties, recherche puis ouvre la partie qui t’intéresse.",
      "Lis le résultat, les points à garder ou à vérifier et la prochaine action proposée.",
      "Ouvre Statistiques et comparaison 5 contre 5 pour les chiffres, ou Chronologie de la partie pour les événements.",
      "Utilise un groupe pour rapprocher les parties d’une même séance."
    ],
    suggestions: [
      "Comment lire l’écart à 20 minutes ?",
      "Comment créer un groupe de parties ?",
      "Comment passer du bilan à un débrief ?"
    ],
    faq: [
      {
        "question": "Comment lire les écarts à 10 et 20 minutes ?",
        "triggers": [
          "diff10",
          "diff20",
          "écart lane",
          "cs10",
          "cs20",
          "écart à 20",
          "écart à 10"
        ],
        "answer": "CS 10 et CS 20 indiquent les sbires et monstres éliminés à 10 et 20 minutes. Dans la comparaison par poste, l’écart affiché compare ces nombres entre les deux adversaires. Relie cet écart à l’or, aux morts et aux événements de la partie avant de conclure."
      }
    ]
  },
  {
    id: 'reviews',
    title: "Préparer un débrief",
    path: '/rapports',
    actionLabel: "Ouvrir Débriefs",
    summary: "Un débrief rassemble les observations et décisions après une ou plusieurs parties. Les notes de l’équipe viennent avant l’analyse automatique, que tu peux déplier pour vérifier une observation.",
    keywords: ["review","rapport","décision","notes","game source","bibliothèque","staff","groupe","créer review","modifier review","débrief","debrief","préparer un débrief","parties liées","engrenage","gérer ce débrief","analyse automatique","titre du groupe"],
    steps: [
      "Ouvre une partie ou un groupe depuis Parties, puis choisis Préparer un débrief.",
      "Note ce que l’équipe garde, ce qu’elle doit vérifier et l’action à essayer, puis enregistre. Éditer permet de compléter les notes selon tes droits.",
      "Lis les Notes de l’équipe, puis ouvre Analyse automatique des parties si besoin. Les parties liées permettent de vérifier les constats.",
      "Dans la bibliothèque, l’engrenage Gérer ce débrief donne accès à Dupliquer et, selon tes droits, Supprimer. Si les parties liées correspondent exactement à un groupe de plusieurs parties, le titre reprend son nom."
    ],
    suggestions: [
      "Que mettre dans un débrief ?",
      "Où trouver Dupliquer et Supprimer pour un débrief ?",
      "Pourquoi le débrief reprend-il le nom du groupe ?"
    ],
    faq: [
      {
        "question": "Que mettre dans un débrief ?",
        "triggers": [
          "quoi écrire review",
          "contenu review",
          "review utile",
          "notes staff",
          "débrief utile",
          "mettre dans un débrief"
        ],
        "answer": "Garde le débrief court : une décision utile, un point à vérifier et une action observable pour la prochaine partie. Lie les parties concernées pour permettre à l’équipe de vérifier les observations."
      },

  {
    "question": "Où trouver Dupliquer et Supprimer pour un débrief ?",
    "triggers": [
      "dupliquer un débrief",
      "supprimer un débrief",
      "gérer ce débrief",
      "engrenage du débrief"
    ],
    "answer": "Dans Débriefs, ouvre le débrief dans la bibliothèque, puis clique sur l’engrenage Gérer ce débrief. Ce menu contient Dupliquer et, si tu peux gérer ce débrief, Supprimer. Éditer reste disponible séparément pour modifier les notes selon tes droits."
  },
  {
    "question": "Pourquoi le débrief reprend-il le nom du groupe ?",
    "triggers": [
      "nom du groupe",
      "titre du groupe",
      "titre du débrief"
    ],
    "answer": "Lorsque les parties liées au débrief correspondent exactement à un groupe de plusieurs parties, son titre reprend le nom de ce groupe. Une sélection partielle ne reprend pas ce nom. Vérifie les parties liées et le groupe concerné dans Parties."
  },
  {
    "question": "Où retrouver l’analyse automatique d’un débrief ?",
    "triggers": [
      "analyse automatique du débrief",
      "retrouver l’analyse automatique",
      "notes avant analyse"
    ],
    "answer": "Dans le débrief, les Notes de l’équipe apparaissent en premier. Ouvre ensuite le volet Analyse automatique des parties pour retrouver les constats et les pistes. Vérifie-les dans les parties liées et dans la vidéo avant de retenir une conclusion."
  }

    ,
{
  "question": "Comment réunir plusieurs parties dans un débrief ?",
  "triggers": [
    "réunir plusieurs parties",
    "débrief plusieurs parties",
    "regrouper des parties dans un débrief"
  ],
  "answer": "Dans l’éditeur du débrief, sélectionne les parties concernées, 20 au maximum, ajoute les notes de l’équipe puis enregistre. Tu peux aussi partir d’un groupe dans Parties avec Préparer un débrief. Les parties liées permettent ensuite de vérifier les observations."
}
]
  },
  {
    id: 'trends',
    title: "Analyser plusieurs parties",
    path: '/tendances',
    actionLabel: "Ouvrir Analyses",
    summary: "Analyses rapproche les résultats de plusieurs parties dans Synthèse, Évolution, Comparer, Champions et Objectifs. Les filtres de période et de catégorie définissent les parties étudiées.",
    keywords: ['tendances', 'winrate', 'blue side', 'red side', 'identité', 'pattern', 'rôle moteur', 'bloc', 'contexte', 'filtre', 'game à review', "analyses", "taux de victoire", "côté bleu", "côté rouge", "parties"],
    steps: [
      "Choisis la période et la catégorie de parties à analyser.",
      "Commence par la synthèse, puis regarde les détails utiles à ta question.",
      "Compare les résultats des côtés bleu et rouge avec le nombre de parties jouées.",
      "Ouvre les parties associées avant de retenir une conclusion."
    ],
    suggestions: [
      "Comment lire le taux de victoire par côté ?",
      "Comment choisir les parties à analyser ?",
      "Comment retrouver une partie derrière un indicateur ?"
    ]
  },
  {
    id: 'champion-analysis',
    title: 'Analyser les champions joués',
    path: '/tendances?rubrique=draft',
    actionLabel: 'Ouvrir Analyses',
    summary: "Dans Analyses, Champions permet de chercher un champion, de filtrer par rôle et de retrouver les parties derrière ses résultats.",
    keywords: ['analyses champions', 'analyser', 'champions', 'champions joués', 'rechercher un champion', 'filtrer rôle', 'défaites', 'associations alliées', 'comparer champions'],
    steps: [
      "Dans Analyses, choisis la période et la catégorie, puis ouvre Champions.",
      "Recherche un champion ou filtre le rôle, puis sélectionne le champion à examiner.",
      "Ouvre Voir les parties ou Revoir les défaites pour retrouver les données sources.",
      "Dans Comparer et approfondir, examine les autres champions au même rôle, les adversaires et les associations alliées. Un petit nombre de parties appelle à la prudence."
    ],
    suggestions: ['Comment retrouver les défaites d’un champion ?', 'Comment comparer les champions au même rôle ?', 'Les associations prouvent-elles une synergie ?'],
    faq: [{
      question: 'Les associations alliées prouvent-elles une synergie ?',
      triggers: ['associations alliées', 'prouvent une synergie', 'synergie démontrée'],
      answer: "Les associations alliées décrivent des champions joués ensemble dans la sélection. Elles ne démontrent pas une synergie ni l’effet d’un champion sur le résultat. Ouvre les parties sources et tiens compte du nombre de résultats connus."
    }]
  },
  {
    id: 'champion-pool',
    title: "Champions des joueurs",
    path: '/draft/pool',
    actionLabel: "Voir les champions",
    summary: "Le pool de champions rassemble les choix de chaque joueur. Les niveaux de maîtrise et les statuts aident l’équipe à préparer ses compositions.",
    keywords: ['champion pool', 'pool', 'champion', 'tier', 'maîtrise', 'confiance', 'situationnel', 'validation', 'développement', 'locke', 'pick', "niveau", "entraînement", "champions"],
    steps: [
      "Choisis le joueur et son poste.",
      "Ajoute un champion et indique son niveau de maîtrise réel.",
      "Utilise le statut pour distinguer un choix maîtrisé, situationnel, à valider ou en entraînement.",
      "Retrouve ensuite ces champions dans les compositions."
    ],
    suggestions: [
      "Comment indiquer le niveau de maîtrise d’un champion ?",
      "À quoi servent les statuts ?",
      "Comment utiliser ces champions dans une composition ?"
    ]
  },
  {
    "id": "compositions",
    "title": "Préparer les compositions",
    "path": "/draft/compositions",
    "actionLabel": "Ouvrir les compositions",
    "summary": "Prépare les cinq champions et le plan de jeu de ton équipe. L’aide au choix compare le pool du joueur et ses parties dans l’équipe ; les réponses adverses restent des pistes à vérifier.",
    "keywords": [
      "compo",
      "composition",
      "composition adverse",
      "adversaires",
      "draft",
      "nos drafts",
      "leur draft",
      "leurs drafts",
      "pick",
      "ban",
      "side",
      "counter",
      "drag drop",
      "aide au choix",
      "aide au choix des champions",
      "choix de champions",
      "choix disponibles",
      "champion absent",
      "champion manquant",
      "adversaire",
      "patch",
      "catégorie",
      "classement",
      "mobalytics",
      "brouillon",
      "enregistrer composition"
    ],
    "steps": [
      "Nomme la composition et choisis le joueur et le champion pour chacun des cinq postes.",
      "Ouvre Aide au choix : pool et parties de l’équipe. Choisis le poste à préparer, ajoute éventuellement un champion adverse et filtre les parties par catégorie ou patch.",
      "Compare la maîtrise déclarée et les parties sources. Choisir ajoute le champion au brouillon ; enregistre la composition pour partager le choix avec l’équipe. Tu peux enregistrer une composition incomplète et la compléter plus tard.",
      "Décris le plan de jeu. Approfondir : style de jeu et réponses adverses propose des champions adverses à surveiller ; duplique une composition pour préparer une variante."
    ],
    "suggestions": [
      "Comment utiliser l’aide au choix des champions ?",
      "Comment sont classés les choix de champions ?",
      "Pourquoi mon champion n’apparaît pas dans les choix disponibles ?"
    ],
    "faq": [
      {
        "question": "Comment utiliser l’aide au choix des champions ?",
        "triggers": [
          "aide au choix",
          "préparer nos choix de champions",
          "choisir un champion dans la composition"
        ],
        "answer": "Dans Draft → Compositions, ouvre Aide au choix : pool et parties de l’équipe sous les cinq postes. Choisis le poste à préparer, puis éventuellement un champion adverse. Tu peux filtrer les parties par catégorie et patch. Pour changer de joueur, utilise le poste correspondant dans la composition. Consulte les parties sources, puis clique sur Choisir. Le choix modifie le brouillon : enregistre la composition pour le partager avec l’équipe."
      },
      {
        "question": "Comment sont classés les choix de champions ?",
        "triggers": [
          "classés les choix",
          "classement des champions",
          "ordre des suggestions",
          "taux de victoire classe",
          "meilleur counter"
        ],
        "answer": "L’aide classe les champions du pool manuel du joueur d’abord par maîtrise déclarée, puis par nombre de parties de ce joueur au résultat connu dans l’équipe. Le taux de victoire ne détermine pas l’ordre. Les résultats concernent les parties entières ; ils ne prouvent ni une victoire en lane ni un counter garanti. Consulte les parties sources et le nombre de résultats connus avant de choisir."
      },
      {
        "question": "Pourquoi mon champion n’apparaît pas dans les choix disponibles ?",
        "triggers": [
          "champion n’apparaît pas",
          "champion absent",
          "champion manquant",
          "aucun choix disponible",
          "aucun champion disponible"
        ],
        "answer": "Vérifie le joueur et le poste sélectionnés : seuls les champions de son pool manuel dans cette équipe sont proposés. Les champions déjà pris à un autre poste et le champion adverse sont exclus. Ajoute le champion au pool du bon joueur si nécessaire ; si aucun joueur n’est présent à ce poste, ajoute d’abord son profil."
      },
      {
        "question": "Les statistiques Mobalytics sont-elles utilisées dans les suggestions ?",
        "triggers": [
          "mobalytics",
          "statistiques externes",
          "counters importés"
        ],
        "answer": "Après avoir choisi un champion adverse, le lien Mobalytics ouvre ses counters au poste sélectionné dans un nouvel onglet. Ces statistiques ne sont pas importées et ne modifient pas le classement NXT5. Vérifie le poste, le patch, le rang et le nombre de parties sur la source externe. Un champion absent de sa liste n’est pas un mauvais matchup démontré."
      }
    ]
  },
  {
    id: 'planning',
    title: 'Planning et disponibilités',
    path: '/planning',
    actionLabel: 'Ouvrir le Planning',
    summary: "Le planning rassemble les disponibilités, les séances et les précisions de la semaine. Les précisions enregistrées sont visibles par toute l’équipe.",
    keywords: ['planning', 'disponibilité', 'dispo', 'semaine', 'scrim', 'match', 'session', 'événement', 'horaire', 'staff', 'précisions', 'note planning', 'retard', "séance", "entraînement", "débrief"],
    steps: [
      "Choisis la semaine à préparer.",
      "Renseigne les disponibilités et, si besoin, une précision pour cette semaine (500 caractères maximum).",
      "Ajoute les séances d’équipe avec leur type et leur horaire.",
      "Vérifie les disponibilités avant de confirmer une séance."
    ],
    suggestions: [
      "Comment renseigner une disponibilité ?",
      "Qui peut ajouter une séance ?",
      "Qui voit mes précisions de planning ?"
    ],
    faq: [{
      question: 'Qui voit mes précisions de planning ?',
      triggers: ['précisions de planning', 'note planning', 'notes de planning', 'note visible', 'retard'],
      answer: "Les précisions enregistrées sont visibles par toute l’équipe pour la semaine affichée, avec une limite de 500 caractères. Le staff partage une note commune. Actualiser les précisions recharge les notes enregistrées ; si la sauvegarde échoue, utilise Réessayer l’enregistrement."
    }]
  },
  {
    id: 'player-profile',
    title: "Profil et suivi du joueur",
    path: '/mon-profil',
    actionLabel: "Ouvrir Mon profil",
    summary: "Mon profil réunit Synthèse, Champions, Champions déclarés, Historique, Suivi et Carte & Wrapped. Les notes et carnets restent soumis aux droits d’accès.",
    keywords: ['profil', 'mon profil', 'joueur', 'historique', 'coaching', 'objectif', 'champions', 'matchups', 'carnet', 'dégâts moyens', 'dégâts champions', 'progression', 'notes', "suivi", "duel"],
    steps: [
      "Vérifie que ton compte est lié au bon joueur dans Gestion de l’équipe.",
      "Commence par la synthèse pour repérer le point à travailler.",
      "Dans Champions, ouvre un champion puis Statistiques ou Matchups pour examiner les résultats, les dégâts et les carnets. Champions déclarés conserve les niveaux de maîtrise.",
      "Consulte l’historique et les parties liées pour vérifier une observation, puis le suivi pour les objectifs et les notes."
    ],
    suggestions: [
      "Pourquoi mon profil est vide ?",
      "Où voir mon historique ?",
      "Comment suivre un objectif ?"
    ],
    faq: [
      {
        "question": "Pourquoi mon profil est vide ?",
        "triggers": [
          "profil vide",
          "pas de stats profil",
          "aucune game profil",
          "historique vide",
          "aucune partie profil"
        ],
        "answer": "Vérifie d’abord que ton compte NXT5 est lié au bon joueur dans Gestion de l’équipe. Contrôle ensuite les joueurs associés aux parties importées : une partie attribuée à un profil en double ou à aucun joueur ne peut pas alimenter correctement ton profil."
      },
      {
        question: 'Où lire les dégâts moyens aux champions ?',
        triggers: ['dégâts moyens', 'dégâts aux champions', 'dégâts champions'],
        answer: "Dans Mon profil → Champions, sélectionne un champion puis Statistiques. Dégâts moyens aux champions utilise les parties où la donnée est renseignée ; « — » signifie indisponible. Ouvre une partie pour comparer les joueurs : les écarts de dégâts sont mesurés en fin de partie."
      },
      {
        question: 'Comment enregistrer un carnet de matchup ?',
        triggers: ['carnet de matchup', 'enregistrer le carnet', 'plan de départ', 'préparer le carnet'],
        answer: "Dans Mon profil → Champions, ouvre un champion puis Matchups. Préparer le carnet ou Modifier le carnet permet de renseigner le plan de départ et les essais selon tes droits. Le brouillon est conservé pendant la navigation, mais clique sur Enregistrer le carnet pour sauvegarder les changements."
      }
    ]
  },
  {
    id: 'player-showcase',
    title: 'Carte joueur et Wrapped',
    path: '/mon-profil/carte',
    actionLabel: 'Ouvrir Carte & Wrapped',
    summary: "Carte & Wrapped crée une carte joueur recto/verso et un récit en cinq chapitres à partir des parties reliées au joueur dans la sélection.",
    keywords: ['carte', 'carte joueur', 'wrapped', 'ma fiche', 'poster', 'exporter', 'export png', 'png', 'recto', 'verso', 'chapitre'],
    steps: [
      "Dans Mon profil, choisis le joueur et la catégorie, puis ouvre Carte & Wrapped.",
      "Sur La carte, utilise Voir le verso ou Voir le recto pour changer de face.",
      "Choisis Découvrir le Wrapped pour parcourir les cinq chapitres à ton rythme.",
      "Télécharge le visuel affiché en PNG. Données et méthode de cette édition précise les parties et valeurs utilisées."
    ],
    suggestions: ['Comment exporter ma carte en PNG ?', 'Pourquoi ma carte est vide ?', 'Comment parcourir le Wrapped ?'],
    faq: [{
      question: 'Pourquoi ma carte est vide ?',
      triggers: ['carte vide', 'ma carte est vide', 'wrapped vide', 'aucune carte'],
      answer: "La carte et le Wrapped nécessitent au moins une partie reliée au joueur dans la sélection. Change la catégorie ou importe une partie, puis vérifie que le bon profil joueur lui est associé."
    }]
  },
  {
    id: 'discord',
    title: 'Compte et bot Discord',
    path: '/bot-discord',
    actionLabel: 'Ouvrir Bot Discord',
    summary: "Bot Discord regroupe la liaison du compte personnel, la connexion du serveur de l’équipe et les publications de parties. Chaque équipe conserve ses propres réglages.",
    keywords: ['discord', 'bot', 'lier', 'liaison', 'serveur', 'salon', 'publication', 'diffusion', 'nxt'],
    steps: [
      "Pour ton compte, lance /nxt lier dans Discord et ouvre le lien personnel. Confirme ton compte sur NXT5, puis Vérifier la liaison et Confirmer la liaison dans Discord.",
      "Le propriétaire ou un capitaine configure le serveur dans Bot Discord : Connecter le serveur, puis Choisir les salons.",
      "Associe un salon aux commandes de l’équipe et choisis séparément les salons de publication.",
      "Envoie l’exemple fictif avec Tester et activer, vérifie sa réception, puis active la diffusion. Les anciennes parties ne sont pas republiées à l’installation."
    ],
    suggestions: ['Comment lier mon compte Discord ?', 'Comment connecter le serveur Discord ?', 'Que partagent les publications Discord ?'],
    faq: [
      {
        question: 'Comment lier mon compte Discord ?',
        triggers: ['lier mon compte discord', 'compte discord', 'nxt lier'],
        answer: "Dans Discord, lance /nxt lier et ouvre ton lien personnel. Vérifie les comptes et confirme ton compte NXT5. Reviens dans Discord, clique sur Vérifier la liaison puis Confirmer la liaison. La liaison personnelle est distincte de la connexion du serveur d’équipe. /nxt help reste accessible sans compte lié."
      },
      {
        question: 'Que partagent les publications Discord ?',
        triggers: ['publications discord', 'notes privées discord', 'partage discord', 'publier sur discord'],
        answer: "Depuis une partie, utilise Exporter sur Discord si tes droits le permettent. Choisis le salon, prépare l’aperçu, puis confirme la publication. Le résultat, les statistiques et le visuel sont partagés ; les notes privées du staff ne sont pas incluses. Le message est lisible par les membres du salon ; ouvrir la partie dans NXT5 exige toujours les droits de l’équipe."
      }
    ]
  },
  {
    id: 'permissions-and-account',
    title: "Accès et paramètres du compte",
    path: '/parametres',
    actionLabel: 'Ouvrir les paramètres',
    summary: "Ton rôle dans l’équipe détermine les actions disponibles. Paramètres gère ton compte et ta sécurité ; Gestion de l’équipe organise les joueurs et leurs accès.",
    keywords: ['permission', 'droits', 'accès', 'capitaine', 'coach', 'manager', 'analyste', 'joueur', 'compte', 'email', 'mot de passe', 'sécurité', 'paramètres'],
    steps: [
      "Vérifie ton rôle dans l’équipe active.",
      "Ouvre Paramètres pour ton compte, ton e-mail et ton mot de passe.",
      "Ouvre Gestion de l’équipe pour les profils joueurs et leurs accès.",
      "Si une action reste bloquée, demande au capitaine ou à un membre du staff autorisé."
    ],
    suggestions: ['Pourquoi un bouton est bloqué ?', 'Comment modifier un accès ?', 'Comment sécuriser mon compte ?']
  },
  {
    id: 'troubleshooting',
    title: 'Résoudre un problème courant',
    path: '/parametres',
    actionLabel: 'Ouvrir les paramètres',
    summary: "Un problème peut venir du fichier importé, d’événements absents, d’un joueur mal associé, des droits d’accès ou d’une ancienne version chargée dans le navigateur.",
    keywords: ['problème', 'erreur', 'bloqué', 'ne marche pas', 'cassé', 'figé', 'chargement', 'timeline', 'image', 'permission', 'cache', 'dépannage', "chronologie", "partie"],
    steps: [
      "Recharge la page une fois.",
      "Vérifie l’équipe active, le joueur concerné et ton rôle.",
      "Pour un import, prépare à nouveau le fichier avec une version récente de NXT5 Importer.",
      "Si le problème persiste, note la page, l’action et le message affiché."
    ],
    suggestions: [
      "Pourquoi la page reste en chargement ?",
      "Pourquoi la chronologie est-elle incomplète ?",
      "Pourquoi un bouton est-il désactivé ?"
    ],
    faq: [
      {
        "question": "Pourquoi la chronologie est-elle incomplète ?",
        "triggers": [
          "timeline incomplète",
          "timeline absente",
          "objectifs manquants",
          "pas de timeline",
          "chronologie incomplète",
          "chronologie absente"
        ],
        "answer": "NXT5 n’invente pas les événements absents du fichier. Prépare à nouveau le fichier avec une version récente de NXT5 Importer. Si Riot ne fournit toujours pas la chronologie complète, les statistiques finales restent disponibles mais certains événements et horaires ne peuvent pas être affichés."
      },
      {
        "question": "Pourquoi le site reste-t-il en chargement ?",
        "triggers": [
          "site figé",
          "chargement infini",
          "synchronisation en cours",
          "reste bloqué"
        ],
        "answer": "Recharge la page, puis vérifie ta connexion. Si une erreur apparaît, utilise Réessayer. Si le problème persiste, conserve le message affiché pour le transmettre avec la page concernée."
      }
    ]
  }
];

const STOP_WORDS = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'comment', 'dans', 'de', 'des', 'du', 'elle', 'en', 'est', 'et', 'faire', 'il',
  'je', 'la', 'le', 'les', 'ma', 'mes', 'mon', 'ne', 'ou', 'où', 'par', 'pas', 'pour', 'que', 'qui', 'se', 'sur', 'un', 'une',
  'how', 'why', 'what', 'where', 'who', 'do', 'does', 'the', 'to', 'my', 'is', 'are', 'can', 'of', 'in', 'and', 'with',
  'como', 'por', 'porque', 'donde', 'quien', 'mi', 'mis', 'el', 'los', 'las', 'del', 'una', 'con', 'para', 'esta', 'estan'
]);

export function getAssistantKnowledge(language: AssistantLanguage = 'fr'): AssistantKnowledgeEntry[] {
  const translations = ASSISTANT_TRANSLATIONS[normalizeAssistantLanguage(language)];
  return translations ? ASSISTANT_KNOWLEDGE.map((entry) => ({ ...entry, ...translations[entry.id] })) : ASSISTANT_KNOWLEDGE;
}

const KNOWLEDGE_IDS = new Set(ASSISTANT_KNOWLEDGE.map(({ id }) => id));

/** Only a documented topic may influence the current-page context. */
export function normalizeAssistantSection(value: unknown): string | null {
  if (value === 'player-champions') return 'player-profile';
  return typeof value === 'string' && KNOWLEDGE_IDS.has(value) ? value : null;
}

export function normalizeAssistantText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: unknown): string[] {
  return [...new Set(normalizeAssistantText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token)))];
}

function routeMatches(entryPath: string, route: string): boolean {
  if (entryPath === route) return true;
  return entryPath === '/mon-profil' && route.startsWith('/mon-profil/');
}

function knownAssistantRoute(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const [pathname, search = ''] = value.trim().split('#')[0].split('?');
  const route = pathname.replace(/\/+$/, '');
  if (route === '/equipes') return '/mon-equipe';
  if (route === '/integration' || route === '/statistiques') return '/games';
  if (!ALLOWED_PATH_SET.has(route)) return null;
  // Preserve this public view selector, never private match/player/filter values.
  if (route === '/tendances' && new URLSearchParams(search).get('rubrique') === 'draft') return '/tendances?rubrique=draft';
  return route;
}

export function safeAssistantRoute(value: unknown): string {
  return knownAssistantRoute(value) || '/mon-equipe';
}

export function retrieveAssistantKnowledge(message: unknown, route: unknown, limit = 4, language: AssistantLanguage = 'fr', section: unknown = null): AssistantKnowledgeMatch[] {
  const helpSection = normalizeAssistantSection(section);
  // With an explicit topic, generic help wording must not favour Getting started.
  const query = helpSection
    ? normalizeAssistantText(message).replace(/\b(aide|help|guide|ayuda|guia)\b/g, ' ')
    : normalizeAssistantText(message);
  const queryTokens = tokens(query);
  const safeRoute = safeAssistantRoute(route);
  const boundedLimit = Math.max(1, Math.min(6, Number(limit) || 4));

  return getAssistantKnowledge(language)
    .map((entry) => {
      const searchable = normalizeAssistantText([
        entry.title,
        entry.summary,
        entry.keywords.join(' '),
        entry.steps.join(' '),
        entry.suggestions.join(' '),
        ...(entry.faq || []).flatMap((item) => [item.question, item.triggers.join(' '), item.answer])
      ].join(' '));
      let score = helpSection ? entry.id === helpSection ? 18 : 0 : routeMatches(entry.path, safeRoute) ? 18 : 0;
      for (const token of queryTokens) {
        if (searchable.includes(token)) score += token.length >= 6 ? 4 : 2;
        if (entry.keywords.some((keyword) => normalizeAssistantText(keyword).includes(token))) score += 3;
      }
      for (const keyword of entry.keywords) {
        const normalizedKeyword = normalizeAssistantText(keyword);
        if (normalizedKeyword.length >= 4 && query.includes(normalizedKeyword)) score += 10;
      }
      return { ...entry, score };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, language))
    .slice(0, boundedLimit);
}

function bestFaq(message: unknown, matches: AssistantKnowledgeMatch[]): { faq: AssistantFaq; source: AssistantKnowledgeMatch; score: number } | null {
  const query = normalizeAssistantText(message);
  const queryTokens = tokens(query);
  let best: { faq: AssistantFaq; source: AssistantKnowledgeMatch; score: number } | null = null;
  for (const match of matches) {
    for (const faq of match.faq || []) {
      const question = normalizeAssistantText(faq.question);
      if (query === question) return { faq, source: match, score: 100 };
      const searchable = normalizeAssistantText([faq.question, faq.triggers.join(' ')].join(' '));
      let score = 0;
      let explicitTrigger = false;
      for (const trigger of faq.triggers) {
        if (query.includes(normalizeAssistantText(trigger))) {
          score += 14;
          explicitTrigger = true;
        }
      }
      for (const token of queryTokens) {
        if (searchable.includes(token)) score += token.length >= 6 ? 3 : 1;
      }
      if (!explicitTrigger) {
        const questionTokens = tokens(faq.question);
        const matchedQuery = queryTokens.filter(token => question.includes(token)).length;
        const matchedQuestion = questionTokens.filter(token => query.includes(token)).length;
        // Shared nouns alone (e.g. player/profile) do not establish the same question.
        if (matchedQuery / Math.max(1, queryTokens.length) < 0.6 || matchedQuestion / Math.max(1, questionTokens.length) < 0.6) continue;
      }
      if (!best || score > best.score) best = { faq, source: match, score };
    }
  }
  return best && best.score >= 5 ? best : null;
}

export function buildFallbackAssistantResponse(message: unknown, matches: AssistantKnowledgeMatch[], language: AssistantLanguage = 'fr') {
  const translations = ASSISTANT_TRANSLATIONS[language];
  const selected = matches.length ? matches.map((entry) => ({ ...entry, ...translations?.[entry.id] })) : retrieveAssistantKnowledge(message, '/mon-equipe', 3, language);
  const primary = selected[0] || getAssistantKnowledge(language)[0];
  const faq = bestFaq(message, selected);
  const sourcesByRelevance = faq ? [faq.source, ...selected.filter(entry => entry.id !== faq.source.id)] : selected;
  const answer = faq
    ? faq.faq.answer
    : `${primary.summary}\n\n${primary.steps.slice(0, 4).map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
  const suggestions = sourcesByRelevance.flatMap((entry) => entry.suggestions).filter((value, index, array) => array.indexOf(value) === index).slice(0, 3);
  const actions = sanitizeAssistantActions(sourcesByRelevance.slice(0, 2).map((entry) => ({ label: entry.actionLabel, path: entry.path })));
  const sources = sourcesByRelevance.slice(0, 3).map(({ id, title, path }) => ({ id, title, path }));
  return { answer, actions, suggestions, sources, fallback: true };
}

export function sanitizeAssistantActions(value: unknown): AssistantAction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const actions: AssistantAction[] = [];
  for (const candidate of value) {
    const path = knownAssistantRoute(candidate?.path);
    const label = String(candidate?.label || '').trim().slice(0, 64);
    if (!label || !path || seen.has(path)) continue;
    seen.add(path);
    actions.push({ label, path });
    if (actions.length === 3) break;
  }
  return actions;
}

export function sanitizeAssistantSuggestions(value: unknown, fallback: string[] = []): string[] {
  const candidates = Array.isArray(value) ? value : fallback;
  return candidates
    .map((item) => String(item || '').trim().slice(0, 120))
    .filter((item, index, array) => item.length >= 4 && array.indexOf(item) === index)
    .slice(0, 3);
}

export function assistantSources(matches: AssistantKnowledgeMatch[]): AssistantSource[] {
  return matches.slice(0, 4).map(({ id, title, path }) => ({ id, title, path }));
}
