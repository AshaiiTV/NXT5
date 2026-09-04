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
  '/integration',
  '/statistiques',
  '/rapports',
  '/tendances',
  '/champion-pool',
  '/compositions-types',
  '/planning',
  '/mon-profil',
  '/mon-profil/champions',
  '/mon-profil/pool',
  '/mon-profil/historique',
  '/mon-profil/coaching',
  '/parametres'
] as const;

const ALLOWED_PATH_SET = new Set<string>(ALLOWED_ASSISTANT_PATHS);

export const ASSISTANT_KNOWLEDGE: AssistantKnowledgeEntry[] = [
  {
    id: 'getting-started',
    title: 'Démarrer sur NXT5',
    path: '/equipes',
    actionLabel: 'Voir l’équipe',
    summary: 'Le parcours le plus simple est de créer ou rejoindre une équipe, préparer le roster, importer une game, lire les tendances puis transformer les constats en review.',
    keywords: ['commencer', 'débuter', 'première fois', 'guide', 'parcours', 'aide', 'utiliser le site'],
    steps: [
      'Crée une équipe ou rejoins-la avec un code temporaire.',
      'Ajoute les joueurs, lie leurs comptes et vérifie leurs rôles.',
      'Importe une première game depuis la page Games.',
      'Ouvre Statistiques ou Tendances, puis crée une review avec une décision claire.'
    ],
    suggestions: ['Comment importer ma première game ?', 'Comment préparer correctement le roster ?', 'Comment créer une review utile ?']
  },
  {
    id: 'teams-and-roster',
    title: 'Équipe, roster et accès',
    path: '/gestion-equipe',
    actionLabel: 'Gérer l’équipe',
    summary: 'La page Équipe présente les joueurs et le staff. Gestion équipe sert à ajouter, modifier, classer Main Team ou Sub, lier les comptes et régler les accès.',
    keywords: ['équipe', 'team', 'roster', 'joueur', 'staff', 'main team', 'sub', 'remplaçant', 'riot id', 'opgg', 'invitation', 'lier compte', 'modifier nom', 'accès'],
    steps: [
      'Ouvre Gestion équipe depuis le bouton Gestion en haut de l’application.',
      'Ajoute ou modifie le profil, son rôle et son groupe Main Team ou Sub.',
      'Lie le bon compte NXT5 au profil joueur.',
      'Vérifie l’accès attribué avant de partager le code d’invitation.'
    ],
    suggestions: ['Comment ajouter un joueur ?', 'Comment séparer Main Team et Subs ?', 'Comment modifier le nom ou le rôle d’un profil ?'],
    faq: [
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
    path: '/integration',
    actionLabel: 'Ouvrir Games',
    summary: 'Games permet d’importer un JSON NXT5, de nommer la partie, choisir le contexte, confirmer le side, les lanes et les profils, puis corriger l’import plus tard.',
    keywords: ['import', 'importer', 'json', 'game id', 'games', 'partie', 'side', 'lane', 'profil', 'catégorie', 'scrim', 'upload', 'historique'],
    steps: [
      'Génère le JSON avec la dernière version de NXT5 Importer.',
      'Dépose le fichier dans Games et attends la fin de l’analyse.',
      'Nomme la game, choisis le contexte et ton side.',
      'Confirme chaque lane et chaque profil avant de valider.'
    ],
    suggestions: ['Pourquoi mon import échoue ?', 'Comment corriger un mauvais profil ?', 'Comment retrouver une game importée ?'],
    faq: [
      {
        question: 'Pourquoi mon import ne fonctionne pas ?',
        triggers: ['import échoue', 'import erreur', 'json refusé', 'game introuvable', 'upload bloqué'],
        answer: 'Vérifie que le JSON vient de la dernière version de NXT5 Importer, que la région correspond au Game ID et que la partie est terminée. Si l’upload passe mais que l’analyse échoue, réexporte la game depuis le PC où elle apparaît dans l’historique du client LoL.'
      },
      {
        question: 'Comment corriger une assignation ?',
        triggers: ['corriger profil', 'mauvaise lane', 'mauvais joueur', 'assignation', 'modifier import'],
        answer: 'Dans Games, ouvre la game importée puis utilise Modifier. Réassigne le side, les lanes et les profils concernés ; les pages Statistiques, Tendances, Profil et Review se recalculent avec la correction.'
      }
    ]
  },
  {
    id: 'statistics',
    title: 'Statistiques et lecture de game',
    path: '/statistiques',
    actionLabel: 'Voir les statistiques',
    summary: 'Statistiques donne une lecture de game ou de groupe : joueurs, KDA, KP, farm, or, vision, builds, écarts à 10 et 20 minutes, objectifs et déroulé de la partie.',
    keywords: ['statistiques', 'stats', 'kda', 'kp', 'cs10', 'cs20', 'diff10', 'diff20', 'or', 'vision', 'build', 'objectif', 'timeline', 'groupe'],
    steps: [
      'Recherche puis sélectionne une game dans la bibliothèque.',
      'Lis les deux sides et les écarts par rôle.',
      'Descends vers les objectifs et la timeline pour replacer les chiffres dans le temps.',
      'Crée un groupe pour comparer plusieurs games du même bloc.'
    ],
    suggestions: ['Comment lire la diff à 20 minutes ?', 'Comment créer un groupe de games ?', 'Comment passer des stats à une review ?'],
    faq: [
      {
        question: 'Comment lire les écarts de lane ?',
        triggers: ['diff10', 'diff20', 'écart lane', 'cs10', 'cs20', 'matchup'],
        answer: 'Dans la lecture par rôle, CS10 et CS20 montrent le farm du joueur ; DIFF10 et DIFF20 comparent ce farm à son adversaire direct. Un écart positif indique une avance, mais il faut le relire avec l’or, les morts et les objectifs pris autour de la lane.'
      }
    ]
  },
  {
    id: 'reviews',
    title: 'Créer et exploiter une review',
    path: '/rapports',
    actionLabel: 'Ouvrir Review',
    summary: 'Review transforme une ou plusieurs games en décisions staff. La bibliothèque sert à rechercher, ouvrir, modifier et relier les reviews à leurs games sources.',
    keywords: ['review', 'rapport', 'décision', 'notes', 'game source', 'bibliothèque', 'staff', 'groupe', 'créer review', 'modifier review'],
    steps: [
      'Sélectionne une game ou un groupe depuis Games ou Statistiques.',
      'Clique sur Créer une review et donne un titre clair.',
      'Écris ce qu’on garde, ce qu’on corrige et l’action de la prochaine game.',
      'Enregistre puis utilise le lien source pour revenir aux données.'
    ],
    suggestions: ['Comment lier plusieurs games ?', 'Que mettre dans une review ?', 'Comment retrouver la game source ?'],
    faq: [
      {
        question: 'Que mettre dans une review ?',
        triggers: ['quoi écrire review', 'contenu review', 'review utile', 'notes staff'],
        answer: 'Garde la review courte : une décision conservée, un problème à corriger et une action vérifiable pour la prochaine game. Lie les games sources afin que le staff puisse contrôler le constat sans recopier toutes les statistiques.'
      }
    ]
  },
  {
    id: 'trends',
    title: 'Tendances d’équipe',
    path: '/tendances',
    actionLabel: 'Ouvrir Tendances',
    summary: 'Tendances agrège toutes les games du contexte choisi pour montrer winrate global et par side, identité de jeu, rôles moteurs, écarts récurrents et games à revoir.',
    keywords: ['tendances', 'winrate', 'blue side', 'red side', 'identité', 'pattern', 'rôle moteur', 'bloc', 'contexte', 'filtre', 'game à review'],
    steps: [
      'Choisis le contexte de games à analyser.',
      'Compare le winrate Blue Side et Red Side avec le volume joué.',
      'Lis les rôles moteurs et les écarts récurrents.',
      'Ouvre une game source avant de transformer un signal en décision.'
    ],
    suggestions: ['Comment interpréter le winrate par side ?', 'Comment changer le contexte ?', 'Comment ouvrir une game à review ?']
  },
  {
    id: 'champion-pool',
    title: 'Champion Pool',
    path: '/champion-pool',
    actionLabel: 'Ouvrir le Champion Pool',
    summary: 'Champion Pool organise les picks de chaque joueur par tier de maîtrise et statut : confiance, situationnel, validation ou développement.',
    keywords: ['champion pool', 'pool', 'champion', 'tier', 'maîtrise', 'confiance', 'situationnel', 'validation', 'développement', 'locke', 'pick'],
    steps: [
      'Choisis le joueur et son rôle.',
      'Place chaque champion dans le tier adapté à son niveau réel.',
      'Utilise le statut pour distinguer confiance, situationnel, validation et développement.',
      'Réutilise ensuite ces picks dans Compos.'
    ],
    suggestions: ['Comment classer un champion par tier ?', 'À quoi servent les statuts ?', 'Comment utiliser le pool dans une compo ?']
  },
  {
    id: 'compositions',
    title: 'Compositions et drafts',
    path: '/compositions-types',
    actionLabel: 'Ouvrir Compos',
    summary: 'Compos permet de préparer Nos drafts et Leurs drafts à partir des Champion Pools, avec rôles, side, tags, conditions de jeu et réponses possibles.',
    keywords: ['compo', 'composition', 'draft', 'nos drafts', 'leur draft', 'leurs drafts', 'pick', 'ban', 'side', 'counter', 'drag drop'],
    steps: [
      'Choisis Nos drafts ou Leurs drafts.',
      'Glisse les champions du bon rôle dans les cinq emplacements.',
      'Ajoute le side, les tags et une condition de jeu lisible.',
      'Duplique une base existante pour préparer une variante.'
    ],
    suggestions: ['Comment créer une composition ?', 'Quelle différence entre Nos drafts et Leurs drafts ?', 'Comment utiliser les tiers du pool ?']
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
    suggestions: ['Comment renseigner une disponibilité ?', 'Qui peut créer un événement ?', 'Comment changer de semaine ?']
  },
  {
    id: 'player-profile',
    title: 'Profil joueur et coaching',
    path: '/mon-profil',
    actionLabel: 'Ouvrir Mon Profil',
    summary: 'Mon Profil regroupe la synthèse du joueur, ses champions, son pool, son historique, ses objectifs et les notes de coaching liées à son compte.',
    keywords: ['profil', 'mon profil', 'joueur', 'historique', 'coaching', 'objectif', 'champions', 'matchups', 'progression', 'notes'],
    steps: [
      'Vérifie que ton compte est lié au bon profil dans Gestion équipe.',
      'Utilise Synthèse pour les repères principaux et Historique pour les games.',
      'Ouvre Pool pour la maîtrise des picks.',
      'Consulte Coaching pour les objectifs et notes autorisés.'
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
  'je', 'la', 'le', 'les', 'ma', 'mes', 'mon', 'ne', 'ou', 'où', 'par', 'pas', 'pour', 'que', 'qui', 'se', 'sur', 'un', 'une'
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
  return entryPath === '/mon-profil' && route.startsWith('/mon-profil/');
}

export function safeAssistantRoute(value: unknown): string {
  const route = String(value || '').trim().split('?')[0];
  if (ALLOWED_PATH_SET.has(route)) return route;
  if (route.startsWith('/mon-profil/') && ALLOWED_PATH_SET.has(route)) return route;
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
      let score = routeMatches(entry.path, safeRoute) ? 18 : 0;
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
      let score = 0;
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
  const faq = bestFaq(message, selected);
  const answer = faq
    ? faq.faq.answer
    : `${primary.summary}\n\n${primary.steps.slice(0, 4).map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
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
    const path = String(candidate?.path || '').trim().split('?')[0];
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
