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
  '/equipes',
  '/gestion-equipe',
  '/games',
  '/integration',
  '/statistiques',
  '/rapports',
  '/tendances',
  '/tendances/draft/pick-repere',
  '/tendances/draft/confort',
  '/tendances/draft/profil',
  '/tendances/draft/compositions',
  '/tendances/draft/duos',
  '/tendances/draft/a-revoir',
  '/tendances/draft/roles',
  '/bot-discord',
  '/draft/pool',
  '/draft/compositions',
  '/planning',
  '/mon-profil',
  '/mon-profil/champions',
  '/mon-profil/pool',
  '/mon-profil/historique',
  '/mon-profil/coaching',
  '/guide',
  '/parametres',
  '/soutenir',
  '/contact'
] as const;

const ALLOWED_PATH_SET = new Set<string>(ALLOWED_ASSISTANT_PATHS);

export const ASSISTANT_KNOWLEDGE: AssistantKnowledgeEntry[] = [
  {
    id: 'getting-started',
    title: 'Démarrer sur NXT5',
    path: '/equipes',
    actionLabel: 'Voir l’équipe',
    summary: 'Le parcours de démarrage suit quatre étapes : Roster, Première game, Tendances et Review. Crée ou rejoins une équipe, prépare les profils joueurs puis importe les games.',
    keywords: ['commencer', 'débuter', 'première fois', 'guide', 'parcours', 'démarrage', 'onboarding', 'utiliser le site', 'créer équipe', 'rejoindre équipe'],
    steps: [
      'Crée une équipe ou rejoins-la avec un code temporaire.',
      'Dans Gestion équipe, prépare les postes TOP, JGL, MID, ADC et SUP de la Main Team et lie les comptes.',
      'Importe une première game depuis la page Games.',
      'Ouvre une game dans Games pour consulter ses statistiques, puis crée une review courte.'
    ],
    suggestions: ['Comment importer ma première game ?', 'Pourquoi le parcours demande cinq joueurs ?', 'Comment créer une review utile ?'],
    faq: [
      {
        question: 'Pourquoi le parcours demande cinq joueurs ?',
        triggers: ['cinq joueurs', '5 profils', 'cinq profils', 'compléter le roster', 'parcours bloqué'],
        answer: 'L’import demande au moins 5 profils joueurs distincts, Subs compris. L’étape Roster du parcours est différente : elle se termine lorsque TOP, JGL, MID, ADC et SUP sont renseignés dans la Main Team. Le capitaine ou le staff autorisé peut compléter le roster et importer. Le repère Tendances du parcours se valide après 3 games importées ; ce n’est pas une interdiction générale de consulter Tendances avant.'
      }
    ]
  },
  {
    id: 'teams-and-roster',
    title: 'Équipe, roster et accès',
    path: '/gestion-equipe',
    actionLabel: 'Gérer l’équipe',
    summary: 'La page Équipe présente les joueurs et le staff. Gestion équipe sert à ajouter, modifier, classer Main Team ou Sub, lier les comptes, régler les accès et consulter Santé des données.',
    keywords: ['équipe', 'team', 'roster', 'joueur', 'staff', 'main team', 'sub', 'remplaçant', 'riot id', 'opgg', 'invitation', 'lier compte', 'modifier nom', 'accès', 'santé des données', 'fiabilité'],
    steps: [
      'Ouvre Gestion équipe depuis l’espace de ton équipe.',
      'Ajoute ou modifie le profil, son rôle et son groupe Main Team ou Sub.',
      'Lie le bon compte NXT5 au profil joueur.',
      'Vérifie l’accès attribué avant de partager le code d’invitation.',
      'Consulte Santé des données pour vérifier le roster, les profils liés et les imports de l’équipe sélectionnée.'
    ],
    suggestions: ['Comment ajouter un joueur ?', 'Comment séparer Main Team et Subs ?', 'Comment modifier le nom ou le rôle d’un profil ?'],
    faq: [
      {
        question: 'Comment ajouter un joueur ?',
        triggers: ['ajouter un joueur', 'ajouter joueur', 'ajouter un profil'],
        answer: 'Ouvre Gestion équipe, ajoute le profil puis renseigne son nom, son rôle et son groupe Main Team ou Sub. Lie ensuite le bon compte NXT5 au profil. Si tu ne peux pas modifier le roster, demande au capitaine ou au staff autorisé.'
      },
      {
        question: 'Comment copier l’OP.GG de la Main Team ?',
        triggers: ['copier opgg', 'op gg main team', 'opgg équipe', 'opgg roster'],
        answer: 'Dans Équipe, utilise le groupe Main Team : seuls les cinq titulaires y sont regroupés. Le bouton OP.GG de ce groupe copie ou ouvre la composition titulaire sans inclure les Subs ni le staff.'
      },
      {
        question: 'Pourquoi un joueur a moins de games ?',
        triggers: ['moins de games', 'games manquantes', 'nombre de games différent', 'adc moins'],
        answer: 'Le compteur dépend du profil lié à chaque participant importé. Ouvre la game concernée dans Games, vérifie l’assignation du profil et le rôle, puis corrige les anciennes games si le joueur a changé de Riot ID ou a été associé à un doublon.'
      }
    ]
  },
  {
    id: 'imports-and-games',
    title: 'Importer et gérer les games',
    path: '/games',
    actionLabel: 'Ouvrir Games',
    summary: 'Games réunit l’historique et les statistiques. Le bouton Importer une game ouvre le téléchargement de NXT5 Importer et l’import JSON ; les corrections restent accessibles depuis les options de la game.',
    keywords: ['import', 'importer', 'json', 'game id', 'games', 'partie', 'side', 'lane', 'profil', 'catégorie', 'scrim', 'upload', 'historique'],
    steps: [
      'Génère le JSON avec la dernière version de NXT5 Importer.',
      'Dans Games, clique sur Importer une game, charge le JSON et attends la fin de l’analyse.',
      'Nomme la game, choisis sa Catégorie et ton side.',
      'Confirme chaque lane et chaque profil avant de valider.'
    ],
    suggestions: ['Pourquoi mon import échoue ?', 'Comment corriger un mauvais profil ?', 'Comment retrouver une game importée ?'],
    faq: [
      {
        question: 'Pourquoi mon import ne fonctionne pas ?',
        triggers: ['import échoue', 'import erreur', 'json refusé', 'game introuvable', 'upload bloqué'],
        answer: 'Vérifie que le JSON vient de la dernière version de NXT5 Importer, que la région correspond au Game ID et que la partie est terminée. Si l’upload passe mais que l’analyse échoue, réexporte la game depuis l’ordinateur où elle apparaît dans l’historique du client LoL.'
      },
      {
        question: 'Comment corriger une assignation ?',
        triggers: ['corriger profil', 'mauvaise lane', 'mauvais joueur', 'assignation', 'modifier import'],
        answer: 'Dans Games, ouvre les options de gestion de la game puis Corriger les rôles et profils. Vérifie les postes des deux équipes et les cinq profils alliés. Les postes doivent être uniques dans chaque équipe et les cinq profils alliés distincts. Pour inverser le side, utilise l’action distincte Changer le côté de notre équipe.'
      },
      {
        question: 'J’ai importé la game du mauvais côté, comment changer le side ?',
        triggers: ['mauvais côté', 'changer le side', 'changer de side', 'changer le côté', 'inverser le side'],
        answer: 'Dans les options de la game, choisis Changer le côté de notre équipe, puis le côté bleu ou rouge. Vérifie les cinq postes et réassigne cinq profils distincts de ton équipe. Si les postes sont incomplets, corrige les rôles d’abord. L’enregistrement recalcule le résultat et les statistiques en conservant les notes de review.'
      },
      {
        question: 'Comment retrouver une game importée ?',
        triggers: ['retrouver une game', 'chercher une game', 'rechercher une game', 'filtrer les games'],
        answer: 'Dans Games, utilise la recherche et les filtres Catégorie, side et résultat, puis le tri et la pagination. Ouvre la game pour voir ses statistiques. Pour réunir plusieurs games, utilise Groupes → Créer un groupe ou le formulaire de création d’une review.'
      }
    ]
  },
  {
    id: 'statistics',
    title: 'Statistiques des games',
    path: '/games',
    actionLabel: 'Voir les statistiques',
    summary: 'Games présente les statistiques d’une game ou d’un groupe : KDA, KP, farm, or, vision, builds, écarts à 10 et 20 minutes, objectifs et timeline.',
    keywords: ['statistiques', 'stats', 'kda', 'kp', 'cs10', 'cs20', 'diff10', 'diff20', 'or', 'vision', 'build', 'objectif', 'timeline', 'groupe'],
    steps: [
      'Dans Games, recherche puis ouvre une game pour afficher directement ses statistiques.',
      'Lis les deux sides et les écarts par rôle.',
      'Descends vers les objectifs et la timeline pour replacer les chiffres dans le temps.',
      'Crée un groupe pour comparer plusieurs games du même bloc.'
    ],
    suggestions: ['Comment lire la diff à 20 minutes ?', 'Comment créer un groupe de games ?', 'Comment passer des stats à une review ?'],
    faq: [
      {
        question: 'Comment lire les écarts de lane ?',
        triggers: ['diff10', 'diff20', 'écart lane', 'cs10', 'cs20', 'matchup'],
        answer: 'CS10 et CS20 montrent le farm du joueur. DIFF10 et DIFF20 le comparent à son adversaire direct. Regarde aussi l’or, les morts et les objectifs pris autour de la lane.'
      }
    ]
  },
  {
    id: 'reviews',
    title: 'Créer une review',
    path: '/rapports',
    actionLabel: 'Ouvrir Review',
    summary: 'Review prépare une analyse automatique à partir des games liées et conserve les notes du staff. Commence par la synthèse, puis ouvre les détails et les sources utiles.',
    keywords: ['review', 'rapport', 'décision', 'notes', 'game source', 'bibliothèque', 'staff', 'groupe', 'créer review', 'modifier review', 'analyse automatique', 'checkpoints', 'vod'],
    steps: [
      'Sélectionne une game ou un groupe depuis Games.',
      'Clique sur Créer une review et donne un titre clair.',
      'Attends le chargement des games liées et lis la synthèse automatique ; complète les notes si nécessaire.',
      'Enregistre la review, puis ouvre les détails ou les games sources pour vérifier les constats.'
    ],
    suggestions: ['Comment lier plusieurs games ?', 'Que mettre dans une review ?', 'Comment retrouver la game source ?'],
    faq: [
      {
        question: 'Que mettre dans une review ?',
        triggers: ['quoi écrire review', 'contenu review', 'review utile', 'notes staff'],
        answer: 'L’analyse automatique se prépare à partir des games liées. Tu peux ajouter des notes staff : ce qu’on garde, ce qu’on corrige et une action vérifiable pour la prochaine game. Les notes sont facultatives après le chargement complet des sources. Les checkpoints VOD et les données servent à vérifier les constats ; l’assistant explique la page sans analyser lui-même les performances.'
      },
      {
        question: 'Comment lier plusieurs games à une review ?',
        triggers: ['plusieurs games', '20 games', 'lier plusieurs', 'review groupe'],
        answer: 'Dans Review, clique sur Créer une review puis sélectionne les games, éventuellement à partir d’un groupe. Une review peut lier jusqu’à 20 games. Dans Games → Groupes → Créer un groupe, l’enregistrement du groupe prépare aussi sa review. Attends le chargement complet des sources avant d’enregistrer ; si le chargement échoue, utilise Réessayer. Les notes saisies restent conservées lorsque la sélection change.'
      },
      {
        question: 'Une review disparaît-elle si sa game est supprimée ?',
        triggers: ['game supprimée', 'supprimer game review', 'review conservée'],
        answer: 'La suppression d’une game peut aussi supprimer la review directement rattachée à cette game. Pour les autres reviews contenant cette game dans leur sélection, elle est retirée des sources. Vérifie donc les reviews concernées avant de supprimer une game ; la conservation de toutes les notes n’est pas garantie.'
      }
    ]
  },
  {
    id: 'trends',
    title: 'Tendances d’équipe',
    path: '/tendances',
    actionLabel: 'Ouvrir Tendances',
    summary: 'Tendances propose Synthèse, Évolution, Comparer, Draft et Objectifs. Les filtres Catégorie et période définissent les games observées ; Toutes prend toutes les games disponibles.',
    keywords: ['tendances', 'winrate', 'blue side', 'red side', 'identité', 'pattern', 'rôle moteur', 'bloc', 'contexte', 'catégorie', 'filtre', 'game à review', 'évolution', 'comparer', 'comparaison', 'période'],
    steps: [
      'Choisis la Catégorie et la période : Toutes, 5, 10 ou 20 games.',
      'Ouvre Synthèse pour les repères, Évolution pour la chronologie ou Comparer pour rapprocher deux blocs.',
      'Consulte Draft pour les picks et associations, et Objectifs pour le suivi de progression.',
      'Ouvre la game associée avant de noter une conclusion.'
    ],
    suggestions: ['Comment filtrer les tendances ?', 'Comment comparer deux blocs ?', 'Où trouver les détails de Draft ?'],
    faq: [
      {
        question: 'Comment comparer deux blocs ?',
        triggers: ['comparer deux blocs', 'comparaison blocs', 'bloc récent', 'bloc précédent'],
        answer: 'Dans Tendances → Comparer, choisis le Bloc de référence et le Bloc observé : cinq games précédentes, cinq dernières games, toutes les games ou une catégorie. Pour comparer précédent et récent, conserve une période Toutes ou au moins 10 games avec suffisamment de sources. L’évolution correspond à observé moins référence ; les games communes sont signalées. Les écarts d’or, dégâts et vision concernent la fin des games.'
      },
      {
        question: 'Où trouver les détails de Draft ?',
        triggers: ['détails de draft', 'sous-pages draft', 'pick repère', 'duos', 'confort'],
        answer: 'Dans Tendances, ouvre Draft puis la rubrique souhaitée : pick repère, confort, profil, compositions, duos, à revoir ou rôles. Ces pages détaillent les games observées et conservent la Catégorie et la période lors de la navigation. Pour préparer une composition, utilise la page Compositions de l’espace Draft.'
      }
    ]
  },
  ...[
    { slug: 'pick-repere', title: 'Pick repère', keywords: ['pick repère', 'fréquence'], answer: 'Le pick repère est le pick de confort le plus joué : au moins 2 games et 50 % de victoires. À volume égal, le taux de victoire départage les picks. Si aucun pick ne remplit ces critères, le plus joué sert de repère.' },
    { slug: 'confort', title: 'Picks de confort', keywords: ['picks de confort', 'critères confort'], answer: 'Un pick de confort associe un champion et un rôle avec au moins 2 games et 50 % de victoires sur la période sélectionnée. La page de détail affiche tous les picks qui remplissent ces critères. Vérifie la Catégorie et la période si un pick manque.' },
    { slug: 'profil', title: 'Profil des compositions', keywords: ['profil de draft', 'marqueurs de style'], answer: 'Le profil regroupe les marqueurs de style des champions joués. Un champion peut contribuer à plusieurs marqueurs. Le total compte ces marqueurs et la moyenne les rapporte au nombre de drafts ; cela décrit leurs possibilités, sans prouver comment la game a été jouée.' },
    { slug: 'compositions', title: 'Compositions fréquentes', keywords: ['compositions fréquentes', 'identité composition'], answer: 'Chaque draft est classée selon le marqueur de style le plus présent parmi ses champions. Consulte la fréquence, le taux de victoire et les games sources. L’identité décrit les possibilités de la composition, pas la manière dont elle a été jouée.' },
    { slug: 'duos', title: 'Duos fréquents', keywords: ['duos', 'paires de rôles'], answer: 'Les duos associent deux champions joués dans une même game. Trois paires de rôles sont suivies : Jungle + Mid, ADC + Support et Top + Jungle. Les autres paires ne sont pas comptées. La recherche et le filtre permettent de consulter les duos et leurs sources.' },
    { slug: 'a-revoir', title: 'À revoir en équipe', keywords: ['picks à revoir', 'signaux de style'], answer: 'Les picks à revoir ont au moins 2 games et moins de 50 % de victoires sur la période. Les signaux de style sont des pistes de review : ouvre les games sources avant d’en tirer une conclusion sur les décisions de l’équipe.' },
    { slug: 'roles', title: 'Picks les plus joués par rôle', keywords: ['pool complet par rôle', 'picks par rôle', 'plusieurs rôles'], answer: 'Chaque champion est compté séparément au rôle auquel il a été joué, y compris avec une seule game. Un champion peut donc apparaître à plusieurs rôles. La recherche et le filtre de rôle permettent de retrouver tous les picks et leurs games sources.' },
  ].map(({ slug, title, keywords, answer }): AssistantKnowledgeEntry => ({
    id: `trends-draft-${slug}`,
    title: `Tendances Draft · ${title}`,
    path: `/tendances/draft/${slug}`,
    actionLabel: `Voir ${title}`,
    summary: answer,
    keywords: ['tendances draft', ...keywords],
    steps: [
      'Dans Tendances → Draft, ouvre cette rubrique en conservant la Catégorie et la période souhaitées.',
      'Utilise la recherche et les filtres disponibles, puis ouvre les games sources pour vérifier les signaux.'
    ],
    suggestions: ['Comment filtrer les tendances ?', 'Comment comparer deux blocs ?', 'Comment créer une review utile ?']
  })),
  {
    id: 'champion-pool',
    title: 'Champion Pool',
    path: '/draft/pool',
    actionLabel: 'Ouvrir le Champion Pool',
    summary: 'Champion Pool organise les picks déclarés de chaque joueur dans Confiance, Situationnel, En validation et En training. Ce classement est renseigné par le joueur ou le staff, pas déduit automatiquement des résultats.',
    keywords: ['champion pool', 'pool', 'champion', 'tier', 'maîtrise', 'confiance', 'situationnel', 'validation', 'développement', 'training', 'locke', 'pick'],
    steps: [
      'Choisis le joueur et son rôle.',
      'Place chaque champion dans le tier adapté à son niveau réel.',
      'Utilise le menu ou le glisser-déposer pour classer les picks : Confiance, Situationnel, En validation, En training.',
      'Réutilise ensuite ces picks dans Compos.'
    ],
    suggestions: ['Comment classer un champion par tier ?', 'À quoi servent les statuts ?', 'Comment utiliser le pool dans une compo ?']
  },
  {
    id: 'compositions',
    title: 'Compositions et drafts',
    path: '/draft/compositions',
    actionLabel: 'Ouvrir Compos',
    summary: 'Compositions permet de préparer cinq picks à partir des Champion Pools, puis d’enregistrer un nom, le side, des tags et un résumé du plan de jeu.',
    keywords: ['compo', 'composition', 'draft', 'nos drafts', 'leur draft', 'leurs drafts', 'pick', 'ban', 'side', 'counter', 'drag drop'],
    steps: [
      'Ouvre Compositions dans Draft et prépare les cinq emplacements.',
      'Sélectionne ou glisse les champions depuis les pools de chaque rôle.',
      'Renseigne Nom de la Compo, Blue Side ou Red Side, les tags et le résumé du plan de jeu.',
      'Enregistre, filtre les compositions par side ou duplique une base pour préparer une variante.'
    ],
    suggestions: ['Comment créer une composition ?', 'Comment dupliquer une composition ?', 'Comment utiliser les tiers du pool ?']
  },
  {
    id: 'planning',
    title: 'Planning et disponibilités',
    path: '/planning',
    actionLabel: 'Ouvrir le Planning',
    summary: 'Planning centralise les disponibilités des joueurs et du staff ainsi que les événements Scrim, Match et Review sur les semaines courante et suivante.',
    keywords: ['planning', 'disponibilité', 'dispo', 'semaine', 'scrim', 'match', 'session', 'événement', 'horaire', 'staff'],
    steps: [
      'Choisis la semaine courante ou suivante.',
      'Renseigne les créneaux disponibles du profil.',
      'Ajoute les événements d’équipe avec leur type et leur horaire.',
      'Contrôle les absences avant de confirmer une session.'
    ],
    suggestions: ['Comment renseigner une disponibilité ?', 'Qui peut créer un événement ?', 'Comment changer de semaine ?'],
    faq: [
      {
        question: 'Qui peut créer un événement ?',
        triggers: ['créer un événement', 'modifier les événements', 'qui peut modifier le planning'],
        answer: 'Dans Planning, utilise Modifier les événements, puis un créneau ou le clic droit pour préparer un Scrim, Match ou Review. La création est accessible aux membres disposant d’un profil utilisable pour enregistrer l’événement, pas uniquement au staff. Les disponibilités concernent ton profil lié ; Coaching Staff regroupe la présence du staff. Vérifie l’état de sauvegarde automatique et utilise Réessayer en cas d’échec.'
      }
    ]
  },
  {
    id: 'player-profile',
    title: 'Profil joueur et coaching',
    path: '/mon-profil',
    actionLabel: 'Ouvrir Mon Profil',
    summary: 'Profil permet de choisir le joueur observé puis de consulter Synthèse, Champions, Pool déclaré, Historique et Suivi. La Catégorie filtre les games affichées.',
    keywords: ['profil', 'mon profil', 'joueur', 'historique', 'coaching', 'objectif', 'progression', 'notes', 'profil observé', 'suivi', 'pool déclaré'],
    steps: [
      'Vérifie que ton compte est lié au bon profil dans Gestion équipe.',
      'Utilise Synthèse pour les repères principaux et Historique pour les games.',
      'Choisis le joueur observé dans le sélecteur ; Pool déclaré décrit la maîtrise annoncée des picks.',
      'Consulte Suivi pour les objectifs de la Catégorie choisie et les notes communes du joueur.'
    ],
    suggestions: ['Pourquoi mon profil est vide ?', 'Où voir mon historique ?', 'Comment suivre un objectif de coaching ?'],
    faq: [
      {
        question: 'Pourquoi mon profil est vide ?',
        triggers: ['profil vide', 'pas de stats profil', 'aucune game profil', 'historique vide'],
        answer: 'Vérifie d’abord que ton compte NXT5 est lié au bon profil dans Gestion équipe. Ensuite, contrôle l’assignation de ce profil dans les imports : une game liée à un doublon ou à aucun profil ne peut pas alimenter correctement Mon Profil.'
      }
    ]
  },
  {
    id: 'profile-champions',
    title: 'Champions, matchups et équipements du profil',
    path: '/mon-profil/champions',
    actionLabel: 'Voir les champions du profil',
    summary: 'Dans Profil, Champions présente les picks joués, leurs statistiques, adversaires et équipements. Le filtre Joueur et la Catégorie déterminent les games consultées.',
    keywords: ['matchup', 'matchups', 'adversaires', 'builds', 'équipements', 'achats', 'inventaire', 'champions du profil'],
    steps: [
      'Dans Profil, choisis le joueur et la Catégorie.',
      'Ouvre Champions puis sélectionne le champion voulu.',
      'Déplie Statistiques moyennes et adversaires pour consulter les confrontations.',
      'Consulte les équipements et les games sources pour vérifier le détail.'
    ],
    suggestions: ['Où retrouver les matchups d’un joueur ?', 'Comment consulter ses équipements ?', 'Comment changer le profil observé ?'],
    faq: [
      {
        question: 'Où retrouver les matchups d’un joueur ?',
        triggers: ['matchups', 'matchup joueur', 'confrontations', 'statistiques moyennes et adversaires'],
        answer: 'Dans Profil, choisis le joueur et la Catégorie, ouvre Champions puis un champion. Le bloc Statistiques moyennes et adversaires contient les confrontations. Il n’y a pas d’onglet Matchups séparé : ces informations se trouvent dans Champions.'
      }
    ]
  },
  {
    id: 'importer-download',
    title: 'Télécharger et ouvrir NXT5 Importer',
    path: '/games',
    actionLabel: 'Ouvrir les imports',
    summary: 'Dans Games, Importer une game propose NXT5 Importer pour Windows 64 bits, Mac Apple Silicon et Mac Intel, ainsi qu’une aide de première ouverture.',
    keywords: ['télécharger', 'téléchargement', 'installer importer', 'ouvrir importer', 'windows', 'mac', 'macos', 'apple silicon', 'intel', 'smartScreen', 'gatekeeper', 'application endommagée'],
    steps: [
      'Ouvre Games puis Importer une game.',
      'Choisis la bonne Version de l’application et télécharge-la.',
      'Si le système bloque la première ouverture, consulte Aide à l’ouverture sur Windows et Mac.',
      'Exporte la game depuis le client League, puis utilise Importer un JSON sur le site.'
    ],
    suggestions: ['Comment ouvrir l’Importer sur Mac ?', 'Windows bloque l’Importer, que faire ?', 'Comment importer un JSON ?'],
    faq: [
      {
        question: 'Comment ouvrir l’Importer sur Mac ?',
        triggers: ['ouvrir l importer sur mac', 'mac bloque', 'gatekeeper', 'notarisée', 'apple silicon', 'mac intel'],
        answer: 'Télécharge la version Mac adaptée depuis Games → Importer une game. Consulte Aide à l’ouverture sur Windows et Mac : l’application n’est pas encore notarisée. Pour le blocage décrit dans l’aide, Réglages Système → Confidentialité et sécurité → Ouvrir quand même permet d’autoriser cette application. Si le message parle d’une application endommagée ou d’une menace précise, contacte NXT5 avec le texte exact et garde les protections actives.'
      },
      {
        question: 'Windows bloque l’Importer, que faire ?',
        triggers: ['windows bloque', 'smartscreen', 'exécuter quand même', 'windows a protégé'],
        answer: 'Télécharge NXT5 Importer depuis Games puis consulte Aide à l’ouverture sur Windows et Mac. Pour l’avertissement de première ouverture décrit dans l’aide, utilise Informations complémentaires puis Exécuter quand même si cette option est proposée. Si le message signale une menace précise ou diffère de l’aide, garde les protections actives et contacte NXT5 avec son texte exact.'
      }
    ]
  },
  {
    id: 'png-exports',
    title: 'Exporter les données affichées en PNG',
    path: '/games',
    actionLabel: 'Ouvrir Games',
    summary: 'Les exports rassemblent les sections dans un seul fichier PNG, sans archive ZIP. Games, Tendances, Profil et Champion Pool proposent leurs propres boutons selon les données affichées.',
    keywords: ['export', 'exporter', 'png', 'image', 'zip', 'télécharger image', 'exporter le groupe', 'exporter la synthèse', 'exporter le résumé', 'tier list'],
    steps: [
      'Choisis les filtres et les données à partager avant de lancer l’export.',
      'Dans Games, ouvre une game puis Exporter PNG, ou un groupe puis Exporter le groupe PNG.',
      'Dans Tendances, utilise Exporter la synthèse ; dans Profil, Exporter le résumé.',
      'Dans Champion Pool, utilise Exporter PNG ; dans le Pool déclaré du profil, Exporter la tier list.'
    ],
    suggestions: ['Comment exporter un groupe de games ?', 'Pourquoi un seul PNG et pas un ZIP ?', 'Comment publier une game sur Discord ?'],
    faq: [
      {
        question: 'Pourquoi un seul PNG et pas un ZIP ?',
        triggers: ['un seul png', 'pas un zip', 'archive zip', 'image longue'],
        answer: 'Les sections sont assemblées dans une seule image PNG, même pour un contenu long. Il n’y a plus d’archive ZIP à décompresser. Vérifie les filtres avant l’export : ils définissent les données incluses.'
      }
    ]
  },
  {
    id: 'discord-setup',
    title: 'Connecter le bot Discord',
    path: '/bot-discord',
    actionLabel: 'Ouvrir Bot Discord',
    summary: 'Bot Discord guide le propriétaire ou capitaine pour relier son serveur à l’équipe, choisir les salons, tester puis activer les publications. La connexion au site avec Discord est distincte de cette installation.',
    keywords: ['discord', 'bot', 'connecter serveur', 'installer bot', 'salon', 'liaison', 'code discord', 'test fictif', 'activation', 'rôles discord'],
    steps: [
      'Depuis Bot Discord, invite le bot puis lance /nxt compte lier et confirme sur NXT5 puis dans Discord.',
      'Avec le même compte, génère le code de l’équipe et utilise /nxt connecter code:… ; les codes expirent après 10 minutes.',
      'Enregistre les salons, envoie explicitement le test fictif et vérifie qu’il est reçu sur Discord.',
      'Active les publications après le test ; les anciennes games ne sont pas republiées automatiquement.'
    ],
    suggestions: ['Comment connecter le serveur Discord ?', 'Pourquoi une commande Discord est refusée ?', 'Comment publier une game sur Discord ?'],
    faq: [
      {
        question: 'Comment connecter le serveur Discord ?',
        triggers: ['connecter le serveur discord', 'installer le bot', '/nxt connecter'],
        answer: 'Ouvre Bot Discord. Le propriétaire ou capitaine doit aussi avoir Gérer le serveur ou Administrateur dans Discord. Invite le bot, lie le compte avec /nxt compte lier et confirme sur NXT5 puis Discord. Génère le code avec ce même compte, puis utilise /nxt connecter code:… avant son expiration de 10 minutes. Enregistre les salons, envoie le test fictif et vérifie sa réception, puis choisis Activer la diffusion et Confirmer l’activation.'
      },
      {
        question: 'Pourquoi une commande Discord est refusée ?',
        triggers: ['commande discord refusée', 'commande refusée', 'rôles discord', 'accès aux commandes'],
        answer: 'Vérifie le compte lié au bot, l’équipe sélectionnée et tes droits NXT5. Dans Bot Discord → Accès aux commandes, le capitaine peut exiger certains rôles Discord en plus de ces droits : même un administrateur Discord doit posséder un rôle autorisé. Ce filtre ne règle ni la visibilité des salons ni le rôle mentionné dans les publications.'
      }
    ]
  },
  {
    id: 'discord-commands',
    title: 'Utiliser les commandes et publications Discord',
    path: '/bot-discord',
    actionLabel: 'Voir l’aide du bot',
    summary: 'L’aide /nxt help ou /nxt aide présente le tutoriel et le catalogue NXT5. Les commandes permettent de consulter games, statistiques, planning, pools, compositions, objectifs et reviews selon les droits du compte lié et leur enregistrement côté Discord.',
    keywords: ['commande', 'commandes', '/nxt', 'help', 'aide discord', 'publier', 'publication', 'partager discord', 'dernière game', 'bilan', 'disponibilites'],
    steps: [
      'Lance /nxt help ou /nxt aide pour le catalogue ; le menu /nxt dans Discord montre les commandes effectivement proposées.',
      'Lie ton compte avec /nxt compte lier ; /nxt equipe liste et /nxt equipe choisir nom:… permettent de choisir l’équipe.',
      'Consulte par exemple /nxt derniere, /nxt game chercher, /nxt planning ou /nxt review liste.',
      'Pour les envois, vérifie le salon et les droits ; suis le résultat dans Bot Discord.'
    ],
    suggestions: ['Quelles commandes Discord sont disponibles ?', 'Comment publier une game sur Discord ?', 'Quelle différence entre connexion Discord et liaison au bot ?'],
    faq: [
      {
        question: 'Quelles commandes Discord sont disponibles ?',
        triggers: ['commandes discord', '/nxt help', '/nxt aide'],
        answer: 'Commence par /nxt help ou /nxt aide pour le catalogue NXT5, puis le menu /nxt de Discord pour les commandes effectivement proposées. Le catalogue couvre notamment /nxt derniere, /nxt game chercher, /nxt game comparer, /nxt bilan, /nxt stats equipe, /nxt planning, /nxt pool voir, /nxt draft compositions, /nxt objectifs liste et /nxt review liste. Les actions dépendent du compte lié, de l’équipe choisie et de tes droits ; les nouvelles commandes doivent aussi être enregistrées côté Discord.'
      },
      {
        question: 'Comment publier une game sur Discord ?',
        triggers: ['publier une game', 'publier sur discord', 'partager sur discord', 'publication discord'],
        answer: 'Dans Games, ouvre les statistiques de la game puis Publier sur Discord, si tes droits et la configuration le permettent. Choisis Destination Discord, clique sur Préparer l’aperçu puis confirme avec Publier dans #salon. Le salon doit être configuré dans Bot Discord. Contrôle ensuite le suivi des publications. Un envoi à vérifier n’est pas renvoyé automatiquement ; mettre en pause ou délier le serveur n’efface pas les messages déjà publiés.'
      }
    ]
  },
  {
    id: 'social-sign-in',
    title: 'Connexion Google, Discord et comptes associés',
    path: '/parametres',
    actionLabel: 'Gérer les connexions associées',
    summary: 'Utilise les services proposés à la connexion, comme Google ou Discord lorsqu’ils sont activés. Pour garder un compte NXT5 existant, connecte-toi à celui-ci puis associe le service depuis Paramètres → Connexions associées.',
    keywords: ['google', 'connexion discord', 'connexion sociale', 'connexions associées', 'associer', 'dissocier', 'apple', 'riot', 'fusion compte', 'premier mot de passe'],
    steps: [
      'Connecte-toi au compte NXT5 que tu veux conserver.',
      'Dans Paramètres, ouvre Connexions associées et choisis un service disponible.',
      'Confirme chez le fournisseur puis reviens sur NXT5 pour vérifier l’association.',
      'Les services marqués bientôt disponibles ne sont pas encore utilisables ; une adresse e-mail identique ne fusionne pas automatiquement deux comptes.'
    ],
    suggestions: ['Comment associer Google à mon compte ?', 'Quelle différence entre connexion Discord et liaison au bot ?', 'Comment créer un premier mot de passe ?'],
    faq: [
      {
        question: 'Comment associer Google à mon compte ?',
        triggers: ['associer google', 'connecter google', 'connexion google', 'compte google'],
        answer: 'Si tu as déjà un compte NXT5, connecte-toi à celui-ci puis ouvre Paramètres → Connexions associées → Google, si le service est disponible. Autorise l’association puis vérifie son état. Ne crée pas un autre compte en espérant une fusion par e-mail : elle n’est pas automatique. Seuls les services proposés comme disponibles peuvent être utilisés.'
      },
      {
        question: 'Quelle différence entre connexion Discord et liaison au bot ?',
        triggers: ['connexion discord', 'liaison au bot', 'discord déjà associé', 'connecté avec discord'],
        answer: 'Se connecter au site avec Discord sert à ouvrir ton compte NXT5. La commande /nxt compte lier associe séparément ton identité aux commandes du bot. Enfin, /nxt connecter code:… relie le serveur Discord à l’équipe. Une connexion Discord dans Paramètres ne remplace donc ni la liaison personnelle au bot ni l’installation du serveur.'
      },
      {
        question: 'Comment créer un premier mot de passe ?',
        triggers: ['premier mot de passe', 'sans mot de passe', 'dissocier google', 'dissocier discord'],
        answer: 'Pour un compte créé avec un service externe, Paramètres → Sécurité permet de demander un lien par e-mail pour créer un mot de passe NXT5. Cette opération te déconnecte : il faut ensuite te reconnecter et réassocier les services. Un mot de passe NXT5 est nécessaire pour dissocier un service ou changer l’adresse e-mail.'
      }
    ]
  },
  {
    id: 'support-nxt5',
    title: 'Soutenir NXT5',
    path: '/soutenir',
    actionLabel: 'Voir le soutien facultatif',
    summary: 'Soutenir NXT5 permet une contribution facultative via Ko-fi lorsque le lien est disponible. Le soutien ne donne aucun accès ou outil exclusif et reste distinct d’un abonnement NXT5.',
    keywords: ['soutenir', 'soutien', 'don', 'donation', 'ko-fi', 'kofi', 'contribution', 'mensuel'],
    steps: [
      'Ouvre Soutenir NXT5.',
      'Lis les informations puis utilise le lien Ko-fi si les contributions sont ouvertes.',
      'Choisis le montant et, selon les options proposées, un soutien ponctuel ou mensuel sur la plateforme externe.',
      'Gère la contribution sur cette plateforme ; elle n’active aucun privilège NXT5.'
    ],
    suggestions: ['Le soutien débloque-t-il des fonctionnalités ?', 'Les abonnements NXT5 sont-ils lancés ?', 'Comment contacter NXT5 ?'],
    faq: [
      {
        question: 'Le soutien débloque-t-il des fonctionnalités ?',
        triggers: ['soutien débloque', 'don débloque', 'ko-fi', 'kofi'],
        answer: 'Non. Le soutien via Ko-fi est facultatif et ne donne aucun accès ou fonctionnalité exclusive. Il est distinct d’un abonnement NXT5. Le montant et le caractère ponctuel ou mensuel se choisissent sur la plateforme externe lorsque le lien de contribution est disponible.'
      }
    ]
  },
  {
    id: 'subscriptions',
    title: 'Statut des abonnements',
    path: '/parametres',
    actionLabel: 'Voir les paramètres du compte',
    summary: 'Les abonnements NXT5 ne sont pas encore lancés. Tous les outils restent accessibles quel que soit le statut affiché. Une attribution manuelle n’entraîne ni paiement ni reconduction automatique.',
    keywords: ['abonnement', 'abonnements', 'tarif', 'tarifs', 'prix', 'payer', 'payant', 'offre', 'pass', 'essai', 'gratuit', 'facturation'],
    steps: [
      'Consulte le statut affiché dans ton espace de compte.',
      'Le statut actuel ne bloque pas les outils du site, y compris le bot Discord.',
      'Ne confonds pas une attribution administrative avec un paiement ou une souscription active.',
      'Le soutien facultatif se trouve dans Soutenir NXT5 et ne modifie pas les accès.'
    ],
    suggestions: ['Les abonnements NXT5 sont-ils lancés ?', 'Le bot Discord est-il payant ?', 'Le soutien débloque-t-il des fonctionnalités ?'],
    faq: [
      {
        question: 'Les abonnements NXT5 sont-ils lancés ?',
        triggers: ['abonnements', 'abonnement', 'bot discord payant', 'bot discord est-il payant', 'tarifs', 'facturation'],
        answer: 'Les abonnements NXT5 ne sont pas encore lancés. Tous les outils restent accessibles quel que soit le statut, y compris le bot Discord sous réserve des droits et de sa configuration. Une attribution administrative ne déclenche ni paiement ni reconduction automatique. Le soutien Ko-fi est facultatif et ne change pas les accès.'
      }
    ]
  },
  {
    id: 'contact-support',
    title: 'Contacter NXT5',
    path: '/contact',
    actionLabel: 'Ouvrir Contact',
    summary: 'La page Contact fournit les moyens de contacter NXT5 pour un problème qui persiste ou une question sur le compte.',
    keywords: ['contact', 'contacter', 'signaler bug', 'assistance', 'support technique'],
    steps: [
      'Ouvre Contact pour retrouver les coordonnées à jour.',
      'Décris la page, l’action effectuée et le message exact.',
      'Pour l’Importer, précise Windows ou Mac et la version utilisée.',
      'N’envoie aucun mot de passe, code de connexion ou fichier privé à l’assistant.'
    ],
    suggestions: ['Pourquoi mon import échoue ?', 'Pourquoi le site reste en chargement ?', 'Comment sécuriser mon compte ?']
  },
  {
    id: 'permissions-and-account',
    title: 'Permissions et paramètres',
    path: '/parametres',
    actionLabel: 'Ouvrir les paramètres',
    summary: 'Les permissions dépendent du rôle dans l’équipe. Les paramètres personnels gèrent le compte et la sécurité ; Gestion équipe règle les rôles, liaisons et accès du roster.',
    keywords: ['permission', 'droits', 'accès', 'capitaine', 'coach', 'manager', 'analyste', 'joueur', 'compte', 'email', 'mot de passe', 'sécurité', 'paramètres'],
    steps: [
      'Vérifie ton rôle actuel dans Équipe.',
      'Utilise Paramètres pour ton compte, ton e-mail et ton mot de passe.',
      'Utilise Gestion équipe pour les rôles et accès du roster.',
      'Demande au capitaine ou au staff autorisé si une action reste bloquée.'
    ],
    suggestions: ['Pourquoi un bouton est bloqué ?', 'Comment modifier un accès ?', 'Comment sécuriser mon compte ?']
  },
  {
    id: 'troubleshooting',
    title: 'Résoudre un problème courant',
    path: '/parametres',
    actionLabel: 'Ouvrir les paramètres',
    summary: 'Les problèmes les plus fréquents viennent d’un ancien JSON, d’une timeline Riot incomplète, d’un mauvais profil assigné, d’un rôle insuffisant ou d’un cache navigateur ancien.',
    keywords: ['problème', 'erreur', 'bloqué', 'ne marche pas', 'cassé', 'figé', 'chargement', 'timeline', 'image', 'permission', 'cache', 'dépannage'],
    steps: [
      'Recharge la page une fois pour écarter un ancien cache.',
      'Vérifie le profil, la team active et les permissions.',
      'Pour un import, régénère le JSON avec la dernière version de l’importer.',
      'Si le problème persiste, note la page, l’action et le message affiché.'
    ],
    suggestions: ['Pourquoi la page reste en chargement ?', 'Pourquoi une timeline est incomplète ?', 'Pourquoi un bouton est désactivé ?'],
    faq: [
      {
        question: 'Pourquoi une timeline est incomplète ?',
        triggers: ['timeline incomplète', 'timeline absente', 'objectifs manquants', 'pas de timeline'],
        answer: 'NXT5 n’invente pas les événements absents du fichier. Réexporte la game avec un importer récent. Si Riot ne fournit toujours pas la timeline complète, les statistiques finales restent disponibles mais certains timings et objectifs sont masqués.'
      },
      {
        question: 'Pourquoi le site reste en chargement ?',
        triggers: ['site figé', 'chargement infini', 'synchronisation en cours', 'reste bloqué'],
        answer: 'Recharge d’abord la page. Si l’écran de synchronisation revient, vérifie la connexion puis réessaie. NXT5 doit charger la session et les données de l’équipe ; une erreur serveur doit normalement afficher un bouton Réessayer plutôt que bloquer définitivement l’écran.'
      }
    ]
  }
];

const STOP_WORDS = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'comment', 'dans', 'de', 'des', 'du', 'elle', 'en', 'est', 'et', 'faire', 'il',
  'je', 'la', 'le', 'les', 'ma', 'mes', 'mon', 'ne', 'ou', 'où', 'par', 'pas', 'pour', 'que', 'qui', 'se', 'sur', 'un', 'une',
  'pourquoi', 'quel', 'quelle', 'quels', 'quelles', 'cette', 'sont', 'peut', 'peux'
]);

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
  return normalizeAssistantText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function routeMatches(entryPath: string, route: string): boolean {
  if (entryPath === route) return true;
  if (entryPath === '/games' && ['/integration', '/statistiques'].includes(route)) return true;
  if (entryPath === '/tendances' && route.startsWith('/tendances/draft/')) return true;
  return entryPath === '/mon-profil' && route.startsWith('/mon-profil/');
}

export function safeAssistantRoute(value: unknown): string {
  const route = String(value || '').trim().split('?')[0];
  if (route === '/integration' || route === '/statistiques') return '/games';
  if (ALLOWED_PATH_SET.has(route)) return route;
  const profileRoute = route.replace(/^\/profil(?=\/|$)/, '/mon-profil');
  if (ALLOWED_PATH_SET.has(profileRoute)) return profileRoute;
  if (['/mon-profil/builds', '/mon-profil/matchups'].includes(profileRoute)) return '/mon-profil/champions';
  return '/equipes';
}

export function retrieveAssistantKnowledge(message: unknown, route: unknown, limit = 4): AssistantKnowledgeMatch[] {
  const query = normalizeAssistantText(message);
  const queryTokens = tokens(query);
  const safeRoute = safeAssistantRoute(route);
  const boundedLimit = Math.max(1, Math.min(6, Number(limit) || 4));

  return ASSISTANT_KNOWLEDGE
    .map((entry) => {
      const searchable = normalizeAssistantText([
        entry.title,
        entry.summary,
        entry.keywords.join(' '),
        entry.steps.join(' '),
        ...(entry.faq || []).flatMap((item) => [item.question, item.triggers.join(' '), item.answer])
      ].join(' '));
      let score = entry.path === safeRoute ? 18 : routeMatches(entry.path, safeRoute) ? 8 : 0;
      for (const token of queryTokens) {
        if (searchable.includes(token)) score += token.length >= 6 ? 4 : 2;
        if (entry.keywords.some((keyword) => normalizeAssistantText(keyword).includes(token))) score += 3;
      }
      for (const keyword of entry.keywords) {
        const normalizedKeyword = normalizeAssistantText(keyword);
        if (normalizedKeyword.length >= 4 && query.includes(normalizedKeyword)) score += 10;
      }
      // A documented question should win over the page's contextual boost.
      score += Math.max(0, ...(entry.faq || []).map((faq) => {
        if (query === normalizeAssistantText(faq.question)) return 80;
        return faq.triggers.some((trigger) => query.includes(normalizeAssistantText(trigger))) ? 24 : 0;
      }));
      return { ...entry, score };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'fr'))
    .slice(0, boundedLimit);
}

function bestFaq(message: unknown, matches: AssistantKnowledgeMatch[]): { faq: AssistantFaq; score: number } | null {
  const query = normalizeAssistantText(message);
  const queryTokens = tokens(query);
  let best: { faq: AssistantFaq; score: number } | null = null;
  for (const match of matches) {
    for (const faq of match.faq || []) {
      const searchable = normalizeAssistantText([faq.question, faq.triggers.join(' ')].join(' '));
      let score = query === normalizeAssistantText(faq.question) ? 80 : 0;
      for (const trigger of faq.triggers) {
        if (query.includes(normalizeAssistantText(trigger))) score += 14;
      }
      for (const token of queryTokens) {
        if (searchable.includes(token)) score += token.length >= 6 ? 3 : 1;
      }
      if (!best || score > best.score) best = { faq, score };
    }
  }
  return best && best.score >= 5 ? best : null;
}

export function buildFallbackAssistantResponse(message: unknown, matches: AssistantKnowledgeMatch[]) {
  const selected = matches.length ? matches : retrieveAssistantKnowledge(message, '/equipes', 3);
  const primary = selected[0] || ASSISTANT_KNOWLEDGE[0];
  // A broad FAQ from a secondary source must not replace a more specific result.
  const faq = bestFaq(message, selected.slice(0, 1));
  const answer = faq
    ? faq.faq.answer
    : `${primary.summary}\n\n${primary.steps.slice(0, 5).map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
  const suggestions = selected.flatMap((entry) => entry.suggestions).filter((value, index, array) => array.indexOf(value) === index).slice(0, 3);
  const actions = sanitizeAssistantActions(selected.slice(0, 2).map((entry) => ({ label: entry.actionLabel, path: entry.path })));
  const sources = selected.slice(0, 3).map(({ id, title, path }) => ({ id, title, path }));
  return { answer, actions, suggestions, sources, fallback: true };
}

export function sanitizeAssistantActions(value: unknown): AssistantAction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const actions: AssistantAction[] = [];
  for (const candidate of value) {
    const requestedPath = String(candidate?.path || '').trim().split('?')[0];
    const path = requestedPath === '/integration' || requestedPath === '/statistiques' ? '/games' : requestedPath;
    const label = String(candidate?.label || '').trim().slice(0, 64);
    if (!label || !ALLOWED_PATH_SET.has(path) || seen.has(path)) continue;
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
