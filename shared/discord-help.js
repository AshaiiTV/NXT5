import { discordCommandCatalog, discordCommandCategories, discordHelpSections } from './discord-command.js';

const HELP_PREFIX = 'nxt:help:';
const COLOR = 0x5865f2;
const field = (name, value) => ({ name, value, inline: false });

// This tutorial contains only static copy. Help never reads team or player data.
const tutorialPages = [
  {
    title: 'NXT5 dans le salon de ton équipe',
    description: 'Trois étapes suffisent pour consulter les données de ton équipe sur Discord.',
    fields: [
      field('1 · Lie ton compte', 'Utilise `/nxt lier` et confirme la liaison de ton compte Discord sur NXT5. Ton profil NXT5 doit appartenir à l’équipe concernée. `/nxt profil` permet de vérifier ton compte lié.'),
      field('2 · Rejoins le bon salon', 'Un responsable choisit dans NXT5 un seul salon de commandes Discord pour chaque équipe. Ouvre le salon lié à ton équipe avant d’utiliser `/nxt voir`.'),
      field('3 · Demande ce que tu veux voir', 'Par exemple, `/nxt voir sujet:derniere`. Le bot retrouve l’équipe grâce au salon, puis vérifie ton compte, ton appartenance à cette équipe et, si nécessaire, ton rôle Discord. Tu n’as aucun nom d’équipe ni identifiant à saisir.'),
    ],
  },
  {
    title: 'Joueur · consulter les données',
    description: 'Toutes les consultations passent par `/nxt voir` dans le salon de ton équipe.',
    fields: [
      field('Les sujets disponibles', '`derniere` · dernière game\n`bilan` · résultats récents\n`stats` · statistiques d’équipe\n`planning` · prochains rendez-vous\n`objectifs` · tes objectifs\n`reviews` · reviews accessibles\n`draft` · préparation de draft'),
      field('Où apparaît la réponse ?', 'Les informations d’équipe qui peuvent être partagées apparaissent dans le salon. Ton profil, tes objectifs personnels, les reviews privées et les brouillons restent visibles uniquement par toi.'),
      field('Accès refusé ?', 'Vérifie la liaison avec `/nxt profil`, ton appartenance à l’équipe sur NXT5 et ton salon Discord. Si l’équipe exige un rôle Discord, demande au responsable de vérifier ce rôle.'),
    ],
  },
  {
    title: 'Responsable · préparer le salon',
    description: 'Chaque équipe dispose de son propre salon de commandes et de ses propres contrôles d’accès.',
    fields: [
      field('1 · Relie l’équipe', 'Lie d’abord ton compte avec `/nxt lier`. Dans NXT5, ouvre Bot Discord pour ton équipe et génère un code temporaire. Sur Discord, utilise `/nxt connecter code:<code>` avec ce même compte lié.'),
      field('2 · Choisis un seul salon', 'Dans les réglages Bot Discord de NXT5, sélectionne le salon de commandes de cette équipe et, si besoin, les rôles Discord autorisés. Une autre équipe peut avoir son propre salon et ses propres rôles.'),
      field('3 · Vérifie le parcours', 'Un membre lie son compte, rejoint le salon de son équipe et utilise `/nxt voir`. Le bot refuse les demandes faites dans un autre salon ou par un membre sans accès à cette équipe.'),
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
  const previous = entries[Math.max(0, index - 1)];
  const next = entries[Math.min(entries.length - 1, index + 1)];
  const selected = route(entries[index]);
  const buttons = [
    button('Précédent', route(previous), index === 0),
    button('Accueil', 'page:accueil', !catalog && index === 0),
    button('Suivant', route(next), index === entries.length - 1, 1),
  ];
  if (!catalog) buttons.push(button('Commandes', 'catalogue:joueur'));
  return [
    { type: 1, components: buttons },
    { type: 1, components: [{
      type: 3, custom_id: HELP_PREFIX + 'select', placeholder: 'Choisir une rubrique', min_values: 1, max_values: 1,
      options: [
        ...discordHelpSections.map(section => ({ label: section.label, value: 'page:' + section.id, description: section.description, default: selected === 'page:' + section.id })),
        ...discordCommandCategories.map(category => ({ label: 'Commandes · ' + category.label, value: 'catalogue:' + category.id, default: selected === 'catalogue:' + category.id })),
      ],
    }] },
  ];
}

function optionPlaceholder(option) {
  if (option.choices) return option.choices.map(choice => choice.value).join('|');
  return option.name === 'code' ? 'code' : 'texte';
}
function usage(entry, requiredOnly = false) {
  const options = entry.options.filter(option => !requiredOnly || option.required);
  return '/nxt ' + entry.path + options.map(option => ' ' + option.name + ':<' + optionPlaceholder(option) + '>').join('');
}
function example(entry) {
  if (entry.path === 'help') return '/nxt help';
  if (entry.path === 'voir') return '/nxt voir sujet:derniere';
  if (entry.path === 'connecter') return '/nxt connecter code:<code NXT5>';
  return '/nxt ' + entry.path;
}
function payload(embed, components) {
  // The router sets EPHEMERAL on the initial interaction response; edits use
  // the same payload without a response flag.
  return { embeds: [{ color: COLOR, ...embed }], components, allowed_mentions: { parse: [] } };
}
function catalogPage(index, matches = null) {
  const category = discordCommandCategories[index];
  const commands = matches || discordCommandCatalog.filter(command => command.category === category.id);
  return payload({
    title: matches ? 'Commandes correspondantes' : 'Commandes · ' + category.label,
    description: 'Cinq commandes visibles. Le salon détermine automatiquement l’équipe pour `/nxt voir`.',
    fields: commands.map(entry => field('/nxt ' + entry.path, entry.description + '\n**Accès :** ' + entry.access + '\n`' + usage(entry, true) + '`')),
    footer: { text: 'Catalogue NXT5 · ' + (index + 1) + '/' + discordCommandCategories.length + ' · /nxt help commande:<nom>' },
  }, navigation({ categoryIndex: index }));
}
function commandPage(entry) {
  const index = discordCommandCategories.findIndex(category => category.id === entry.category);
  const required = entry.options.filter(option => option.required);
  const optional = entry.options.filter(option => !option.required);
  const details = list => list.map(option => '`' + option.name + '` : ' + option.description + (option.choices ? ' Choix : ' + option.choices.map(choice => '`' + choice.value + '`').join(', ') + '.' : '')).join('\n');
  const fields = [
    field('Utilisation', '`' + usage(entry) + '`'),
    field('Exemple', '`' + example(entry) + '`'),
    field('Accès', entry.access === 'Tous' ? 'Accessible avant la liaison de compte.' : entry.access + '. Le bot vérifie tes droits à chaque demande.'),
  ];
  if (entry.path === 'voir') fields.push(field('Contexte', 'Utilise cette commande dans le salon lié à ton équipe. Le bot retrouve l’équipe automatiquement ; les contenus personnels restent privés.'));
  if (entry.path === 'connecter') fields.push(field('Avant de connecter', 'Lie ton compte avec `/nxt lier`, puis génère un code pour cette équipe dans NXT5. Le compte Discord lié doit appartenir au responsable qui a généré le code.'));
  if (required.length) fields.push(field('Option obligatoire', details(required)));
  if (optional.length) fields.push(field('Options facultatives', details(optional)));
  if (!entry.options.length) fields.push(field('Paramètres', 'Cette commande ne demande aucun paramètre.'));
  return payload({
    title: '/nxt ' + entry.path, description: entry.description, fields,
    footer: { text: 'Aide NXT5 · ' + discordCommandCategories[index].label + ' · Visible uniquement par toi' },
  }, navigation({ categoryIndex: index }));
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
  if (query) fields.unshift(field('Commande introuvable', 'Ouvre le catalogue avec le bouton Commandes, puis utilise un nom affiché, par exemple `/nxt help commande:voir`.'));
  return payload({
    title: source.title, description: source.description, fields,
    footer: { text: 'Guide NXT5 · ' + (pageIndex + 1) + '/' + discordHelpSections.length + ' · ' + discordHelpSections[pageIndex].label + ' · Visible uniquement par toi' },
  }, navigation({ pageIndex }));
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
