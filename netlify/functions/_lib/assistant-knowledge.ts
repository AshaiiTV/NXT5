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
  '/draft/pool',
  '/draft/compositions',
  '/planning',
  '/mon-profil',
  '/mon-profil/champions',
  '/mon-profil/pool',
  '/mon-profil/historique',
  '/mon-profil/coaching',
  '/guide',
  '/parametres'
] as const;

const ALLOWED_PATH_SET = new Set<string>(ALLOWED_ASSISTANT_PATHS);

export const ASSISTANT_KNOWLEDGE: AssistantKnowledgeEntry[] = [
  {
    id: 'getting-started',
    title: 'Démarrer sur NXT5',
    path: '/equipes',
    actionLabel: 'Voir l’équipe',
    summary: "Crée ou rejoins une équipe, ajoute les joueurs, importe une partie, puis prépare un débrief.",
    keywords: ['commencer', 'débuter', 'première fois', 'guide', 'parcours', 'aide', 'utiliser le site'],
    steps: [
      "Crée une équipe ou rejoins-la avec un code temporaire.",
      "Ajoute les profils des joueurs et vérifie leurs postes. Ils pourront être liés à un compte plus tard.",
      "Dans Parties, choisis Importer une partie. Cinq profils joueurs différents sont nécessaires.",
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
    summary: "Équipe présente les joueurs et l’encadrement. Gestion de l’équipe permet d’ajouter les profils, de choisir les titulaires et remplaçants, de lier les comptes et de régler les accès.",
    keywords: ['équipe', 'team', 'roster', 'joueur', 'staff', 'main team', 'sub', 'remplaçant', 'riot id', 'opgg', 'invitation', 'lier compte', 'modifier nom', 'accès', 'santé des données', 'fiabilité', "titulaire", "encadrement", "effectif"],
    steps: [
      "Ouvre Gestion de l’équipe depuis la page Équipe ou le bouton en haut de l’application.",
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
        "question": "Comment copier l’OP.GG des titulaires ?",
        "triggers": [
          "copier opgg",
          "op gg main team",
          "opgg équipe",
          "opgg roster",
          "opgg titulaires"
        ],
        "answer": "Dans Équipe, utilise Copier OP.GG titulaires. Ce bouton copie le lien du groupe titulaire ; les remplaçants disposent de leur propre bouton et le staff n’est pas inclus."
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
    keywords: ['import', 'importer', 'json', 'game id', 'games', 'partie', 'side', 'lane', 'profil', 'catégorie', 'scrim', 'upload', 'historique'],
    steps: [
      "Prépare le fichier .json avec NXT5 Importer. L’aide Pas encore de fichier ? explique comment l’obtenir.",
      "Dans Parties, choisis Importer une partie, puis Choisir mon fichier.",
      "Choisis le côté de ton équipe, puis vérifie les champions, les postes et les joueurs associés.",
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
        "answer": "Vérifie que tu peux gérer l’équipe et que cinq profils joueurs différents sont disponibles. Utilise un fichier .json produit par une version récente de NXT5 Importer, pour une partie terminée. Si le chargement réussit mais que l’analyse échoue, exporte à nouveau la partie depuis le PC où elle apparaît dans le client LoL."
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
          "matchup",
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
    summary: "Un débrief rassemble les observations et les décisions après une ou plusieurs parties. La bibliothèque permet de les retrouver et de les modifier.",
    keywords: ['review', 'rapport', 'décision', 'notes', 'game source', 'bibliothèque', 'staff', 'groupe', 'créer review', 'modifier review', "débrief", "debrief", "préparer un débrief", "parties liées"],
    steps: [
      "Ouvre une partie ou un groupe depuis Parties.",
      "Choisis Préparer un débrief pour commencer à partir de ce contexte.",
      "Écris ce que l’équipe garde, ce qu’elle doit vérifier et l’action à essayer ensuite.",
      "Enregistre le débrief. Les parties liées permettent de revenir aux données."
    ],
    suggestions: [
      "Comment réunir plusieurs parties dans un débrief ?",
      "Que mettre dans un débrief ?",
      "Comment retrouver les parties liées ?"
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
      }
    ]
  },
  {
    id: 'trends',
    title: "Analyser plusieurs parties",
    path: '/tendances',
    actionLabel: "Ouvrir Analyses",
    summary: "Analyses rapproche les résultats de plusieurs parties : taux de victoire, écarts par poste et points récurrents à vérifier.",
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
    id: 'compositions',
    title: "Préparer les compositions",
    path: '/draft/compositions',
    actionLabel: "Ouvrir les compositions",
    summary: "Prépare les cinq champions de ton équipe à partir des champions déclarés par les joueurs.",
    keywords: ['compo', 'composition', 'draft', 'nos drafts', 'leur draft', 'leurs drafts', 'pick', 'ban', 'side', 'counter', 'drag drop'],
    steps: [
      "Donne un nom à la composition.",
      "Ajoute un champion à chacun des cinq postes.",
      "Indique le côté et les caractéristiques utiles, puis décris comment jouer cette composition.",
      "Duplique une composition existante pour préparer une variante."
    ],
    suggestions: [
      "Comment créer une composition ?",
      "Comment préparer une variante ?",
      "Comment utiliser les niveaux de maîtrise des champions ?"
    ]
  },
  {
    id: 'planning',
    title: 'Planning et disponibilités',
    path: '/planning',
    actionLabel: 'Ouvrir le Planning',
    summary: "Le planning rassemble les disponibilités des joueurs et du staff, ainsi que les entraînements, matchs et débriefs prévus.",
    keywords: ['planning', 'disponibilité', 'dispo', 'semaine', 'scrim', 'match', 'session', 'événement', 'horaire', 'staff', "séance", "entraînement", "débrief"],
    steps: [
      "Choisis la semaine à préparer.",
      "Renseigne les créneaux où le joueur ou le membre du staff est disponible.",
      "Ajoute les séances d’équipe avec leur type et leur horaire.",
      "Vérifie les disponibilités avant de confirmer une séance."
    ],
    suggestions: [
      "Comment renseigner une disponibilité ?",
      "Qui peut ajouter une séance ?",
      "Comment changer de semaine ?"
    ]
  },
  {
    id: 'player-profile',
    title: "Profil et suivi du joueur",
    path: '/mon-profil',
    actionLabel: "Ouvrir Mon profil",
    summary: "Le profil réunit le bilan du joueur, ses champions, son historique et ses objectifs. Les notes de suivi restent soumises aux droits d’accès.",
    keywords: ['profil', 'mon profil', 'joueur', 'historique', 'coaching', 'objectif', 'champions', 'matchups', 'progression', 'notes', "suivi", "duel"],
    steps: [
      "Vérifie que ton compte est lié au bon joueur dans Gestion de l’équipe.",
      "Commence par la synthèse pour repérer le point à travailler.",
      "Ouvre Champions pour comparer les résultats et Champions déclarés pour retrouver les niveaux de maîtrise.",
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
  if (route === '/integration' || route === '/statistiques') return '/games';
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
