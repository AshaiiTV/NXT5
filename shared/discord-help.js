import { discordCommandCatalog, discordCommandCategories, discordHelpSections } from './discord-command.js';

const HELP_PREFIX = 'nxt:help:';
const COLOR = 0x5865f2;
const field = (name, value) => ({ name, value, inline: false });
const connectionCommands = new Set(['connecter', 'statut', 'pause', 'reprendre']);
const accessLabel = entry => connectionCommands.has(entry.path)
  ? 'Compte lié · propriétaire ou capitaine NXT5 de cette équipe · Gérer le serveur Discord (ou Administrateur)'
  : entry.access;

// Static copy only: opening or navigating help never reads a team, identity,
// review, token or any other private data. Permission checks belong to actions.
const tutorialPages = [
  {
    title: 'Bienvenue dans le bot NXT5',
    description: 'Prépare ta session, retrouve tes games et suis les objectifs de ton équipe depuis Discord. Ce guide reste accessible avant de lier ton compte.',
    fields: [
      field('1 · Choisis ton parcours', 'Joueur : ouvre « Mon compte » ou clique sur Suivant. Responsable : ouvre « Installer le bot » dans le menu.'),
      field('2 · Comprends les deux connexions', '`/nxt compte lier` associe ton compte Discord personnel à NXT5. Le responsable effectue aussi cette liaison avant `/nxt connecter code:<code>`, qui relie son équipe NXT5 au serveur. Chaque personne lie son propre compte.'),
      field('3 · Retrouve une commande', '`/nxt help` et `/nxt aide` ouvrent ce guide privé. Le bouton « Commandes » donne accès au catalogue. `/nxt help commande:bilan` explique une commande précise.'),
    ],
  },
  {
    title: 'Étape 1 · Lie ton compte et choisis ton équipe',
    description: 'Le bot vérifie ton compte NXT5 et tes droits avant de montrer les données d’une équipe.',
    fields: [
      field('1 · Lie ton compte personnel', 'Saisis `/nxt compte lier`, puis ouvre le lien privé. Connecte-toi à NXT5 et confirme sur le site. Reviens dans Discord, clique sur « Vérifier la liaison », contrôle le compte affiché puis clique sur « Confirmer la liaison ». Si le lien expire, relance la commande. Aucun mot de passe n’est à envoyer dans Discord.'),
      field('2 · Choisis ton équipe', 'Saisis `/nxt equipe choisir` et sélectionne une équipe autorisée sur ce serveur. Le bot confirme l’équipe active pour tes prochaines commandes. `/nxt equipe liste` retrouve les choix disponibles.'),
      field('3 · Vérifie ton profil', '`/nxt compte profil` affiche le compte lié et le contexte sélectionné. `/nxt compte delier` te permet de retirer cette association après confirmation.'),
      field('Aucune équipe disponible ?', 'Fais vérifier ton invitation NXT5, la liaison du serveur et, si ton équipe les exige, tes rôles Discord par ton responsable. Relance ensuite `/nxt equipe choisir`.'),
    ],
  },
  {
    title: 'Étape 2 · Prépare la prochaine session',
    description: 'Retrouve le rendez-vous, les présences et les priorités avant de rejoindre le vocal.',
    fields: [
      field('1 · Consulte le planning', '`/nxt planning` affiche les prochains événements de l’équipe active, leurs horaires et un lien NXT5. `/nxt planning periode:semaine` limite la liste aux sept prochains jours.'),
      field('2 · Confirme ta présence', 'Retrouve l’identifiant de l’événement dans le planning, puis saisis `/nxt presence repondre evenement:<id> statut:present`. Tu peux aussi répondre Présent, Absent ou En retard sous le rappel envoyé par le bot.'),
      field('3 · Relis les objectifs', '`/nxt objectifs liste` affiche les objectifs que tu peux consulter. Les objectifs individuels sont filtrés selon ton rôle. Le bot indique clairement si aucun objectif ou rendez-vous n’est disponible.'),
    ],
  },
  {
    title: 'Étape 3 · Retrouve les games et le bilan',
    description: 'Les résultats proviennent des games importées dans NXT5 et accessibles à ton équipe.',
    fields: [
      field('1 · Retrouve la dernière game', '`/nxt derniere` affiche son résultat, sa date et le lien NXT5, avec son visuel lorsqu’il est disponible. `/nxt game chercher` retrouve d’autres games par période ou catégorie.'),
      field('2 · Choisis la période du bilan', '`/nxt bilan` propose une session, les sept derniers jours ou les trente derniers jours. Pour une session, sélectionne un groupe de games NXT5 ; sans groupe, choisis une période. Accès direct : `/nxt bilan periode:semaine`.'),
      field('3 · Lis les chiffres dans leur contexte', 'Le bilan précise l’équipe, la période, les filtres et le nombre de games. Une donnée absente reste indisponible. `/nxt stats tendance` compare deux périodes successives sans attribuer de note automatique.'),
    ],
  },
  {
    title: 'Étape 4 · Passe du résultat à la review',
    description: 'Retrouve les analyses autorisées et les consignes pour la prochaine session.',
    fields: [
      field('1 · Retrouve une review', '`/nxt review liste` affiche les reviews accessibles et leurs identifiants. Utilise `/nxt review voir review:<id>` pour consulter leurs points clés et ouvrir NXT5.'),
      field('2 · Confirme la lecture d’une consigne', 'Sur une review partagée, clique sur Lu ou saisis `/nxt review lire review:<id>`. La confirmation concerne cette version ; elle ne valide pas le contenu de la review.'),
      field('3 · Garde ton rituel', 'Avant la session : `/nxt planning`. Après la session : `/nxt bilan`. Avant la suivante : `/nxt objectifs liste`. Lire une review ne crée pas automatiquement un objectif.'),
      field('Pour le staff', '`/nxt review partager review:<id> canal:<salon>` prépare un aperçu. Vérifie les consignes et la destination avant de confirmer la publication. Les brouillons restent privés.'),
    ],
  },
  {
    title: 'Responsable · Connecte et contrôle le bot',
    description: 'Pour connecter, consulter le statut, mettre en pause ou reprendre : compte lié, propriétaire ou capitaine NXT5 de l’équipe visée, et permission Discord « Gérer le serveur » ou « Administrateur ». Lire cette page n’accorde aucun accès supplémentaire.',
    fields: [
      field('1 · Lie d’abord ton compte personnel', 'Invite le bot si nécessaire, puis termine `/nxt compte lier`. Vérifie le compte associé avec `/nxt compte profil`. Cette étape est requise même pour un administrateur Discord.'),
      field('2 · Relie ton équipe au serveur', 'Avec ce même compte NXT5, ouvre Bot Discord, choisis ton équipe et génère son code temporaire. Saisis `/nxt connecter code:<code>` dans Discord. Le compte lié doit être celui qui a créé le code ; le code d’un autre responsable est refusé.'),
      field('3 · Configure et teste', 'Dans NXT5, choisis les salons, catégories et rôles Discord autorisés pour cette équipe, puis teste et active les publications. Un rôle autorisé ne remplace jamais les droits NXT5. `/nxt statut equipe:<équipe>` vérifie la connexion.'),
      field('4 · Maîtrise la diffusion', '`/nxt pause equipe:<équipe>` suspend les publications de l’équipe. `/nxt reprendre equipe:<équipe>` reprend une diffusion configurée. Les consultations restent accessibles. Les rappels ont leur propre réglage : `/nxt reglages rappels`. Vérifie toujours l’équipe ciblée.'),
      field('5 · Accompagne les membres', 'Chaque joueur commence avec `/nxt help`, `/nxt compte lier`, puis `/nxt equipe choisir`. Vérifie son invitation NXT5 et son rôle Discord en cas de refus. Sur un serveur partagé, chaque équipe choisit ses propres rôles autorisés ; même un administrateur Discord ne contourne pas cette règle.'),
    ],
  },
];

function button(label, route, disabled = false, style = 2) {
  const action = ({ 'Précédent': 'previous', Accueil: 'home', Suivant: 'next', Commandes: 'catalogue' })[label];
  return { type: 2, style, label, custom_id: HELP_PREFIX + route + ':' + action, disabled };
}
function navigation({ pageIndex = 0, categoryIndex = -1 } = {}) {
  const catalog = categoryIndex >= 0;
  const entries = catalog ? discordCommandCategories : discordHelpSections;
  const index = catalog ? categoryIndex : pageIndex;
  const route = item => (catalog ? 'catalogue:' : 'page:') + item.id;
  const first = entries[Math.max(0, index - 1)];
  const last = entries[Math.min(entries.length - 1, index + 1)];
  const buttons = [
    button('Précédent', route(first), index === 0),
    button('Accueil', 'page:accueil', !catalog && index === 0),
    button('Suivant', route(last), index === entries.length - 1, 1),
  ];
  if (!catalog) buttons.push(button('Commandes', 'catalogue:comptes'));
  const selected = catalog ? 'catalogue:' + entries[index].id : 'page:' + entries[index].id;
  return [
    { type: 1, components: buttons },
    { type: 1, components: [{ type: 3, custom_id: HELP_PREFIX + 'select', placeholder: 'Choisir une rubrique', min_values: 1, max_values: 1, options: [
      ...discordHelpSections.map(section => ({ label: section.label, value: 'page:' + section.id, description: section.description, default: selected === 'page:' + section.id })),
      ...discordCommandCategories.map(category => ({ label: 'Commandes · ' + category.label, value: 'catalogue:' + category.id, default: selected === 'catalogue:' + category.id })),
    ] }] },
  ];
}

function optionPlaceholder(option) {
  if (option.choices) return option.choices.map(choice => String(choice.value)).join('|');
  if (option.type === 5) return 'true|false';
  if (option.type === 7) return 'salon';
  if (option.type === 4) return 'minutes';
  if (['date', 'echeance'].includes(option.name)) return 'AAAA-MM-JJ';
  if (['heure', 'debut', 'fin'].includes(option.name)) return 'HH:MM';
  if (option.name === 'fuseau') return 'Europe/Paris';
  if (['game', 'game_a', 'game_b', 'evenement', 'review', 'groupe'].includes(option.name)) return 'id';
  if (option.name === 'equipe' || option.name === 'nom') return 'équipe';
  return option.name === 'joueur' ? 'joueur' : 'texte';
}
function usage(entry, requiredOnly = false) {
  const options = entry.options.filter(option => !requiredOnly || option.required);
  return '/nxt ' + entry.path + options.map(option => ' ' + option.name + ':<' + optionPlaceholder(option) + '>').join('');
}
function example(entry) {
  const samples = { code: '0123-4567-89AB-CDEF', objectif: entry.path === 'objectifs definir' ? 'Améliorer la communication avant objectif' : '<id>', note: 'Communication revue après la séance', texte: 'Prévoir deux engageurs', titre: 'Review de la dernière game', date: '2026-10-01', debut: '20:00', fin: '22:00', heure: '20:00', duree: '120', fuseau: 'Europe/Paris', canal: '#équipe', joueur: '<joueur>', game: '<id>', game_a: '<id-a>', game_b: '<id-b>', evenement: '<id>', review: '<id>' };
  if (entry.path === 'help') return '/nxt help commande:bilan';
  if (entry.path === 'bilan') return '/nxt bilan periode:semaine';
  return '/nxt ' + entry.path + entry.options.filter(option => option.required).map(option => ' ' + option.name + ':' + (samples[option.name] || (option.type === 5 ? 'true' : option.choices?.[0]?.value) || '<' + option.name + '>')).join('');
}
function payload(embed, components) {
  // The router sets EPHEMERAL on the initial interaction response. Omitting
  // flags here also makes the same payload valid for subsequent message edits.
  return { embeds: [{ color: COLOR, ...embed }], components, allowed_mentions: { parse: [] } };
}
function catalogPage(index, matches = null) {
  const category = discordCommandCategories[index];
  const commands = matches || discordCommandCatalog.filter(command => command.category === category.id);
  return payload({
    title: matches ? 'Commandes correspondantes' : category.label,
    description: 'Les réponses sont privées. Une commande de publication affiche un aperçu et vérifie tes droits. Les paramètres entre chevrons sont à remplacer ; la fiche de chaque commande distingue les options obligatoires.',
    fields: commands.map(entry => field('/nxt ' + entry.path, entry.description + '\n**Accès :** ' + accessLabel(entry) + '\n`' + usage(entry, true) + '`')),
    footer: { text: 'Catalogue NXT5 · ' + (index + 1) + '/7 · /nxt help commande:<nom> pour les options' },
  }, navigation({ categoryIndex: index }));
}
function commandPage(entry) {
  const index = discordCommandCategories.findIndex(category => category.id === entry.category);
  const required = entry.options.filter(option => option.required);
  const optional = entry.options.filter(option => !option.required);
  const details = list => list.map(option => '`' + option.name + '` : ' + option.description + (option.choices ? ' Choix : ' + option.choices.map(choice => '`' + choice.value + '`').join(', ') + '.' : '')).join('\n');
  const fields = [field('Utilisation', '`' + usage(entry) + '`'), field('Exemple', '`' + example(entry) + '`'), field('Accès', entry.access === 'Tous' ? 'Disponible avant la liaison de compte. Cette aide reste privée.' : accessLabel(entry) + '. Ton compte, ton équipe et tes droits sont vérifiés à chaque action.')];
  if (entry.path === 'connecter') fields.push(field('Avant de connecter', 'Termine `/nxt compte lier`, puis crée le code de ton équipe avec ce même compte NXT5. Seul le créateur du code peut l’utiliser depuis son compte Discord lié.'));
  if (connectionCommands.has(entry.path)) fields.push(field('Serveur partagé', 'Gérer le serveur Discord ne donne aucun accès aux autres équipes NXT5. Tu dois être propriétaire ou capitaine de l’équipe visée.'));
  if (required.length) fields.push(field('Options obligatoires', details(required)));
  if (optional.length) fields.push(field('Options facultatives', details(optional)));
  if (!entry.options.length) fields.push(field('Paramètres', 'Cette commande ne demande aucun paramètre.'));
  return payload({ title: '/nxt ' + entry.path, description: entry.description, fields, footer: { text: 'Aide NXT5 · ' + discordCommandCategories[index].label + ' · Visible uniquement par toi' } }, navigation({ categoryIndex: index }));
}

export function buildDiscordHelp({ page = 'accueil', command = '' } = {}) {
  // Never reflect arbitrary caller input in an embed or component identifier.
  const query = typeof command === 'string' ? command.slice(0, 100).trim().toLowerCase().replace(/^\/?nxt\s+/, '').replace(/\s+/g, ' ') : '';
  if (query) {
    const exact = discordCommandCatalog.find(entry => entry.path === query);
    if (exact) return commandPage(exact);
    const matches = discordCommandCatalog.filter(entry => entry.path.split(' ').includes(query));
    if (matches.length) return catalogPage(discordCommandCategories.findIndex(category => category.id === matches[0].category), matches);
  }
  if (typeof page === 'string' && page.startsWith('catalogue:')) {
    const index = discordCommandCategories.findIndex(category => category.id === page.slice(10));
    if (index >= 0) return catalogPage(index);
  }
  const pageIndex = Math.max(0, discordHelpSections.findIndex(section => section.id === page));
  const source = tutorialPages[pageIndex];
  const fields = source.fields.map(item => ({ ...item }));
  if (query) fields.unshift(field('Commande introuvable', 'Ouvre le catalogue avec le bouton Commandes, puis utilise le nom exact affiché : par exemple `/nxt help commande:review liste`.'));
  return payload({ title: source.title, description: source.description, fields, footer: { text: 'Guide NXT5 · ' + (pageIndex + 1) + '/6 · ' + discordHelpSections[pageIndex].label + ' · Visible uniquement par toi' } }, navigation({ pageIndex }));
}

// The router can pass this result directly to buildDiscordHelp and use an
// UPDATE_MESSAGE response. Unknown or forged routes do not resolve.
export function resolveDiscordHelpInteraction(customId, values = []) {
  if (typeof customId !== 'string' || !customId.startsWith(HELP_PREFIX)) return null;
  const route = customId === HELP_PREFIX + 'select' ? (Array.isArray(values) && values.length === 1 ? values[0] : null) : customId.slice(HELP_PREFIX.length).replace(/:(previous|home|next|catalogue)$/, '');
  if (typeof route !== 'string') return null;
  if (route.startsWith('page:') && discordHelpSections.some(section => section.id === route.slice(5))) return { page: route.slice(5) };
  if (route.startsWith('catalogue:') && discordCommandCategories.some(category => category.id === route.slice(10))) return { page: route };
  return null;
}
