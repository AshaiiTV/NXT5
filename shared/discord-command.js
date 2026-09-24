// Shared by registration, setup checks and the help catalogue. Keep all public
// command paths here so the guide cannot advertise an unregistered command.
export const DISCORD_INSTALL_PERMISSIONS = '8';
export const DISCORD_INSTALL_SCOPES = ['bot', 'applications.commands'];

const text = (name, description, required = false, extra = {}) => ({ type: 3, name, description, required, min_length: 1, max_length: 100, ...extra });
const choice = (name, description, values, required = false) => text(name, description, required, { choices: values.map(([value, label]) => ({ name: label, value })) });
const id = (name, description, required = true) => text(name, description, required);
const prose = (name, description, required = true) => text(name, description, required, { max_length: 1000 });
const integer = (name, description, required, min_value, max_value) => ({ type: 4, name, description, required, min_value, max_value });
const team = () => text('equipe', 'Équipe de ce serveur.', false, { autocomplete: true });
const player = (required = false) => id('joueur', 'Joueur de l’équipe.', required);
const period = (values = ['semaine', 'mois']) => choice('periode', 'Période du bilan.', values.map(value => [value, ({ session: 'Une session', semaine: '7 derniers jours', mois: '30 derniers jours', aujourdhui: 'Aujourd’hui' })[value]]));
const category = () => text('categorie', 'Catégorie des games.');
const event = () => id('evenement', 'Identifiant de l’événement.');
const review = () => id('review', 'Identifiant de la review.');
const role = () => choice('role', 'Rôle dans la composition.', [['top', 'Top'], ['jungle', 'Jungle'], ['mid', 'Mid'], ['adc', 'ADC'], ['support', 'Support']]);
const active = () => ({ type: 5, name: 'actif', description: 'Activer cette diffusion.', required: true });
const channel = () => ({ type: 7, name: 'canal', description: 'Salon de publication.', required: true, channel_types: [0, 5] });
const date = (name = 'date', required = true) => text(name, 'Date au format AAAA-MM-JJ.', required, { min_length: 10, max_length: 10 });
const time = (name = 'heure', required = true) => text(name, 'Heure au format HH:MM.', required, { min_length: 5, max_length: 5 });

export const discordHelpSections = [
  { id: 'accueil', label: 'Démarrer', description: 'Les trois étapes pour utiliser NXT5' },
  { id: 'joueur', label: 'Pour les joueurs', description: 'Consulter les données dans le salon de son équipe' },
  { id: 'responsable', label: 'Pour les responsables', description: 'Relier une équipe et choisir son salon' },
];
export const discordCommandCategories = [
  { id: 'joueur', label: 'Joueurs' },
  { id: 'gestion', label: 'Responsables' },
];
// Kept solely to validate interactions sent from guilds that still have the
// previous registration. New registrations use discordCommandCatalog below.
const legacyHelpSections = [
  { id: 'accueil', label: 'Accueil' }, { id: 'compte', label: 'Mon compte' },
  { id: 'preparer', label: 'Avant la session' }, { id: 'games', label: 'Games et bilan' },
  { id: 'review', label: 'Reviews et progression' }, { id: 'responsable', label: 'Installer le bot' },
];
const command = (path, description, categoryId, access, options = []) => ({ path, description, category: categoryId, access, options });

export const discordLegacyCommandCatalog = [
  command('help', 'Ouvrir le tutoriel et le catalogue.', 'comptes', 'Tous', [choice('rubrique', 'Page du tutoriel.', legacyHelpSections.map(section => [section.id, section.label])), text('commande', 'Commande à expliquer, par exemple bilan.')]),
  command('aide', 'Ouvrir le tutoriel NXT5.', 'comptes', 'Tous'),
  command('compte lier', 'Lier ton compte Discord à NXT5.', 'comptes', 'Tous'),
  command('compte profil', 'Voir ton compte et ton équipe active.', 'comptes', 'Compte lié'),
  command('compte delier', 'Délier ton compte après confirmation.', 'comptes', 'Compte lié'),
  command('equipe liste', 'Lister tes équipes autorisées ici.', 'comptes', 'Membre'),
  command('equipe choisir', 'Choisir ton équipe active.', 'comptes', 'Membre', [text('nom', 'Équipe autorisée sur ce serveur.', false, { autocomplete: true })]),

  command('derniere', 'Retrouver la dernière game.', 'games', 'Membre', [team()]),
  command('game voir', 'Consulter la fiche d’une game.', 'games', 'Membre', [id('game', 'Identifiant de la game.')]),
  command('game chercher', 'Rechercher des games par période.', 'games', 'Membre', [period(), category()]),
  command('game comparer', 'Comparer deux games accessibles.', 'games', 'Membre', [id('game_a', 'Première game.'), id('game_b', 'Deuxième game.')]),
  command('bilan', 'Résumer une session ou une période.', 'games', 'Membre', [period(['session', 'semaine', 'mois']), id('groupe', 'Groupe de games de la session.', false), category()]),
  command('stats equipe', 'Afficher les statistiques d’équipe.', 'games', 'Membre', [period(), category()]),
  command('stats tendance', 'Comparer deux périodes successives.', 'games', 'Membre', [period()]),
  command('reglages bilan', 'Planifier le bilan hebdomadaire.', 'games', 'Responsable', [active(), choice('jour', 'Jour du bilan.', [['lundi', 'Lundi'], ['mardi', 'Mardi'], ['mercredi', 'Mercredi'], ['jeudi', 'Jeudi'], ['vendredi', 'Vendredi'], ['samedi', 'Samedi'], ['dimanche', 'Dimanche']], false), time('heure', false), team()]),

  command('joueur profil', 'Consulter le profil d’un joueur.', 'joueurs', 'Membre', [player(true)]),
  command('joueur stats', 'Consulter ses statistiques récentes.', 'joueurs', 'Membre', [player(true), period()]),
  command('joueur comparer', 'Comparer ses résultats dans le temps.', 'joueurs', 'Membre', [player(true), period()]),
  command('objectifs liste', 'Lire les objectifs autorisés.', 'joueurs', 'Membre', [player()]),
  command('objectifs definir', 'Créer un objectif après aperçu.', 'joueurs', 'Staff', [prose('objectif', 'Objectif mesurable.'), player(), date('echeance', false)]),
  command('objectifs terminer', 'Clôturer un objectif après confirmation.', 'joueurs', 'Staff', [id('objectif', 'Identifiant de l’objectif.'), prose('commentaire', 'Note de validation.', false)]),
  command('objectifs point', 'Ajouter un point de suivi.', 'joueurs', 'Membre', [id('objectif', 'Identifiant de l’objectif.'), prose('note', 'Bilan de ta progression.')]),

  command('pool voir', 'Consulter les pools de champions.', 'draft', 'Membre', [player(), role()]),
  command('stats champions', 'Résumer les champions joués.', 'draft', 'Membre', [period(), player()]),
  command('pool suggerer', 'Préparer des pistes de travail du pool.', 'draft', 'Staff', [player(true), text('objectif', 'Objectif de travail.')]),
  command('draft compositions', 'Retrouver les compositions enregistrées.', 'draft', 'Membre', [role(), text('champion', 'Champion recherché.')]),
  command('draft preparer', 'Préparer une draft pour un événement.', 'draft', 'Staff', [event()]),
  command('draft notes', 'Ajouter une consigne de draft.', 'draft', 'Staff', [event(), prose('texte', 'Consigne de préparation.')]),

  command('planning', 'Consulter les prochains rendez-vous.', 'planning', 'Membre', [choice('periode', 'Période du planning.', [['aujourdhui', 'Aujourd’hui'], ['semaine', '7 prochains jours'], ['mois', '30 prochains jours']])]),
  command('evenement creer', 'Créer un événement après aperçu.', 'planning', 'Staff', [choice('type', 'Type de rendez-vous.', [['scrim', 'Scrim'], ['match', 'Match'], ['review', 'Review']], true), date(), time(), integer('duree', 'Durée en minutes.', true, 1, 1440)]),
  command('evenement modifier', 'Modifier un événement par formulaire.', 'planning', 'Staff', [event(), text('titre', 'Titre du rendez-vous.'), date('date', false), time('heure', false), integer('duree', 'Durée en minutes.', false, 1, 1440), prose('details', 'Détails du rendez-vous.', false)]),
  command('evenement annuler', 'Annuler un événement après confirmation.', 'planning', 'Staff', [event(), prose('motif', 'Motif de l’annulation.', false)]),
  command('presence repondre', 'Confirmer ta présence à un événement.', 'planning', 'Membre', [event(), choice('statut', 'Ta réponse.', [['present', 'Présent'], ['absent', 'Absent'], ['retard', 'En retard']], true), integer('retard', 'Retard prévu en minutes.', false, 1, 1440)]),
  command('presence liste', 'Voir les réponses et les sans-réponse.', 'planning', 'Staff', [event()]),
  command('presence relancer', 'Préparer une relance ciblée.', 'planning', 'Staff', [event()]),
  command('disponibilites definir', 'Renseigner ton créneau disponible.', 'planning', 'Membre', [date(), time('debut'), time('fin')]),

  command('review liste', 'Retrouver les reviews accessibles.', 'reviews', 'Membre', [period(), player()]),
  command('review voir', 'Ouvrir les points clés d’une review.', 'reviews', 'Membre', [review()]),
  command('review creer', 'Rédiger une review en brouillon.', 'reviews', 'Staff', [id('game', 'Game à analyser.'), text('titre', 'Titre de la review.', true), prose('resume', 'Résumé de la review.', false), prose('corrections', 'Points à corriger.', false), prose('actions', 'Actions de suivi.', false)]),
  command('review partager', 'Partager une review après aperçu.', 'reviews', 'Staff', [review(), channel(), prose('resume', 'Consignes validées à partager.', false)]),
  command('review lire', 'Confirmer la lecture de cette version.', 'reviews', 'Membre', [review()]),
  command('review lectures', 'Voir les lectures de la version partagée.', 'reviews', 'Staff', [review()]),

  command('connecter', 'Relier le serveur à une équipe NXT5.', 'gestion', 'Responsable', [text('code', 'Code temporaire fourni par NXT5.', true, { min_length: 16, max_length: 24 })]),
  command('statut', 'Afficher l’état de la connexion.', 'gestion', 'Responsable', [team()]),
  command('pause', 'Suspendre les publications de l’équipe.', 'gestion', 'Responsable', [team()]),
  command('reprendre', 'Reprendre les publications de l’équipe.', 'gestion', 'Responsable', [team()]),
  command('reglages canal', 'Choisir un salon de publication.', 'gestion', 'Responsable', [choice('type', 'Type de publication.', [['games', 'Games'], ['planning', 'Planning'], ['reviews', 'Reviews'], ['bilans', 'Bilans']], true), channel(), team()]),
  command('reglages rappels', 'Configurer les rappels de session.', 'gestion', 'Responsable', [active(), integer('delai', 'Minutes avant le rendez-vous.', false, 1, 10080), team()]),
  command('reglages fuseau', 'Régler le fuseau horaire de l’équipe.', 'gestion', 'Responsable', [text('fuseau', 'Fuseau IANA, par exemple Europe/Paris.', true), team()]),
  command('diffusion test', 'Tester le salon configuré.', 'gestion', 'Responsable', [team()]),
];

export const discordCommandCatalog = [
  command('help', 'Découvrir comment utiliser le bot NXT5.', 'joueur', 'Tous', [
    choice('rubrique', 'Page du tutoriel.', discordHelpSections.map(section => [section.id, section.label])),
    text('commande', 'Nom d’une commande, par exemple voir.'),
  ]),
  command('lier', 'Associer ton compte Discord à NXT5.', 'joueur', 'Tous'),
  command('profil', 'Vérifier ton compte NXT5 lié.', 'joueur', 'Compte lié'),
  command('voir', 'Consulter les données de ton équipe dans son salon.', 'joueur', 'Membre', [
    choice('sujet', 'Données à afficher.', [
      ['derniere', 'Dernière game'], ['bilan', 'Bilan'], ['stats', 'Statistiques'],
      ['planning', 'Planning'], ['objectifs', 'Objectifs'], ['reviews', 'Reviews'], ['draft', 'Draft'],
    ], true),
  ]),
  command('connecter', 'Relier une équipe NXT5 à ce serveur.', 'gestion', 'Responsable', [
    text('code', 'Code temporaire fourni par NXT5.', true, { min_length: 16, max_length: 24 }),
  ]),
];

export function nxtDiscordCommand() {
  const options = discordCommandCatalog.map(entry => ({
    type: 1, name: entry.path, description: entry.description,
    ...(entry.options.length ? { options: structuredClone(entry.options) } : {}),
  }));
  return {
    type: 1, name: 'nxt', description: 'Préparer, suivre et partager la vie de ton équipe NXT5.',
    // Opening the root makes help and member reads discoverable. Every handler
    // must independently enforce its own NXT5 and Discord permissions.
    default_member_permissions: null, contexts: [0], integration_types: [0], options,
  };
}
