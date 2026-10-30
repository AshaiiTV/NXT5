# Administration, comptes et statistiques globales

Évolution du 30 octobre 2026. La première refonte est publiée par la PR #231 (`165cfdeb`). Les outils supplémentaires ci-dessous doivent être validés et leur publication vérifiée séparément.

## Navigation et recherche

- `/admin` : synthèse des comptes, équipes, imports et raccourcis opérationnels.
- `/admin/comptes` : annuaire paginé des comptes et des profils joueurs/staff. Recherche par nom,
  pseudonyme, e-mail ou identifiant ; les profils peuvent aussi être retrouvés par Riot ID ou équipe.
  Les filtres distinguent les e-mails vérifiés, les comptes sans équipe et les profils non liés.
- `/admin/comptes?userId=…` : identité, équipes, rôles, profils liés, activité et sessions actives.
  Le nom affiché peut être corrigé ; les sessions d’un autre compte peuvent être révoquées après confirmation.
  Les e-mails, mots de passe et droits administrateur ne sont pas modifiables ici.
- `/admin/equipes?teamId=…` : dossier d’équipe consultable depuis la fiche d’un compte. Recherche serveur paginée sur toutes les équipes, avec filtres opérationnels ; elle ne se limite plus aux 600 dernières équipes.
- `/admin/journal` : actions, intervenants et dates ; les contenus privés des équipes et métadonnées
  brutes d’audit ne sont pas exposés.
- Usage, fréquentation, publications Discord, rappels et intégrations restent disponibles.

L’administration reste réservée au compte configuré côté serveur. Les nouvelles actions vérifient
la session à nouveau au moment de l’écriture et refusent une révision de compte périmée. Écriture
et audit sont atomiques ; une erreur d’audit annule la modification. Une réponse réseau incertaine
ne déclenche jamais une répétition automatique. Il faut recharger la fiche avant une nouvelle tentative.

## Outils de gestion des équipes et profils

`admin-team-tools` est réservé à l’administrateur de plateforme, y compris pour les lectures.
Le dossier équipe ouvre les profils, membres et droits, participants des parties, débriefs,
compositions avec joueurs/champions, séances, objectifs et drafts. Chaque liste est paginée
par 20 et filtrable. Les débriefs sont limités à 20 000 caractères par aperçu, avec un signalement.
Aucun code d’invitation, mot de passe, jeton ou payload Riot brut n’est exposé.

- Équipe : modifier nom/tag/région ; modifier les droits d’un membre ou retirer son accès.
  Le propriétaire et les propres accès de l’administrateur sont protégés. Retirer un membre
  délie ses profils de ce compte dans cette équipe, sans les effacer ni affecter ses autres équipes.
- Profil `/admin/comptes?profileId=…` : modifier nom, Riot ID, poste et statut d’effectif ;
  délier le compte sans retirer ses droits de membre. Staff = inactif sans Riot ID, SUB = remplaçant.
  Un titulaire déjà en place n’est jamais déplacé implicitement ; un conflit est refusé.
  Le dossier présente jusqu’à 50 champions déclarés, 50 objectifs et les 20 dernières parties liées.
- Suppression d’équipe : saisir son nom exact et confirmer l’effacement définitif de tous ses
  contenus/configurations. L’inventaire visible est revérifié côté serveur : un changement impose
  un rechargement. Les comptes restent conservés. Les messages déjà envoyés sur Discord restent externes.
- Suppression de profil : saisir son nom exact. Objectifs, disponibilités, pool et notes suivent
  les cascades existantes. Les parties, participants et comptes restent ; les participants sont déliés.

Les suppressions qui affectent des parties sont bloquées en Deploy Preview selon la protection
existante des sources Discord. Elles sont testées sur une base PostgreSQL locale fictive.
Toutes les écritures prennent les verrous de session et d’équipe, revérifient les droits et révisions
courantes, et enregistrent leur audit dans la même transaction. Échec d’audit = annulation complète.
Une double soumission ou un dossier périmé est refusé. Après une réponse incertaine, le formulaire
exige un rechargement avant une nouvelle tentative. Aucune suppression réelle n’est faite par les tests.

## Statistiques globales et réseaux sociaux

`/admin/stats-globales` utilise les imports NXT5, sans transmettre les noms, e-mails, équipes,
Riot IDs ou identifiants de parties aux exports. La période filtre la date d’import, pas la date de jeu.
Les filtres proposent 7/30/90/365 jours ou l’historique, le patch et, pour les champions joués, le poste.

- **Champions joués** : participants des parties importées. Un même identifiant de partie est regroupé
  entre équipes. La part compare les sélections du champion à toutes les sélections du poste choisi.
  Le taux de victoire utilise seulement les résultats connus et affiche ce dénominateur.
- **Bans en partie** : données Riot des parties importées. Seules les parties avec les dix emplacements
  connus sont prises en compte. Un emplacement explicitement passé est accepté ; un emplacement
  inconnu exclut la partie de cette mesure. La présence d’un champion est comptée une fois par partie.
- **Picks et bans en draft** : sources Drafter regroupées par identifiant de source et numéro de partie,
  même quand plusieurs équipes les ont importées. Les picks complets et bans complets ont des
  dénominateurs distincts. Un champion compte au plus une fois dans une draft pour chaque mesure.

Les identités de champions sont vérifiées dans le catalogue public Riot. Une chaîne inconnue est
exclue et signalée dans la couverture ; elle n’est jamais exportée comme nom de champion.
Les matchs et drafts ne sont pas fusionnés dans un dénominateur commun.

Le CSV contient le classement complet. Le PNG propose un post 1080 × 1350 (8 champions) ou une
story 1080 × 1920 (10 champions), avec période, patch, effectif et source. Recherche et tri du tableau
n’altèrent pas le classement exporté : l’export conserve le classement par volume, clairement annoncé.
Ces données décrivent uniquement l’échantillon NXT5 ; elles ne représentent pas tout League of Legends.

## Retraits

Les pages Achats, Demandes d’accès, Comptes et abonnements, Offres et tarifs et Préparer la vente,
leurs API de lecture/écriture, les restrictions Pass, le catalogue commercial et Shopify sont retirés.
Les migrations historiques restent en place. Les anciennes demandes de contact restent soumises
à leur purge de six mois, sans nouvelle collecte ni formulaire actif.

`/calendrier` et `social-calendar` sont retirés. `/planning`, ses disponibilités, ses séances,
son enregistrement et son intégration Discord sont conservés.

## Vérifications

`npm run verify`, `npm run test:layout` et `node tools/admin-redesign-qa.mjs` contrôlent le code,
les droits, les compteurs, les anciennes routes et le rendu responsive. Le dernier script utilise
uniquement des données fictives et vérifie 40 combinaisons de pages et de largeurs de 320 à 1 920 px,
ainsi que les téléchargements PNG et CSV. Il ne mesure pas les données de production.

## Suspension et suppression des comptes

Depuis le dossier de compte : suspension réversible, réactivation et suppression complète du compte.
Chaque action demande l’identifiant exact et une révision courante. Le compte administrateur utilisé
est protégé. Une suspension ferme les sessions et bloque leur création, y compris par connexion
externe, au niveau du trigger PostgreSQL `sessions_active_account`. Les sessions et commandes du
bot vérifient aussi l’état du compte. Une réactivation ne restaure aucune session révoquée.

L’effacement supprime le compte et les relations en cascade : sessions, identités externes, équipes
possédées et leur contenu. Le dossier affiche les équipes, profils et parties concernés ; cet inventaire
est revérifié après verrouillage. Dans les équipes d’autres propriétaires, les profils et contributions
restent, déliés du compte selon les clés étrangères existantes. Les messages Discord déjà publiés,
les sauvegardes et les journaux soumis à leur rétention ne sont pas effacés par cette action.
Ce bouton ne constitue donc pas une promesse d’effacement de toute trace ou de conformité juridique.
Les suppressions en cascade restent désactivées en Deploy Preview. Audit et effacement sont atomiques.
La migration incrémentale `20261030_account_lifecycle.sql` est appliquée par le build de production.
Aucune opération de suspension ou suppression réelle n’est nécessaire aux tests.

## Transférer une équipe avant de supprimer son propriétaire

Dans le dossier équipe, « Transférer la propriété » recherche un compte actif avec e-mail vérifié,
même s’il n’est pas encore membre. Sélectionner le destinataire, puis saisir le nom exact de l’équipe.
Le nouveau propriétaire reçoit le statut capitaine ; l’ancien propriétaire devient membre joueur.
L’équipe conserve son identifiant et ses contenus. Les profils ne sont pas réattribués au nouveau
compte. L’audit conserve les identifiants des deux propriétaires et de l’intervenant.

Depuis la confirmation de suppression d’un compte, chaque équipe possédée mène à son dossier
pour permettre son transfert. Recharger ensuite le dossier du compte : les équipes transférées ne
figurent plus dans l’inventaire d’effacement. Une confirmation d’effacement ancienne est refusée.
La suppression du compte délie ses profils dans l’équipe conservée et retire ses participations
personnelles selon les clés étrangères existantes ; elle ne supprime pas les données de l’équipe.

Le transfert verrouille les comptes avant l’équipe, comme l’effacement de compte, et revérifie
propriétaire, révisions, nom, vérification e-mail et suspension dans la transaction d’audit.
Un doublon de nom chez le destinataire impose de renommer l’équipe avant de transférer.
Aucun compte, équipe ou contenu n’est recréé après un conflit ou une interruption.

## Présentation compacte — 30 octobre 2026

Le cadre admin conserve toutes les destinations, routes, filtres et outils. Il retire les répétitions
visuelles : fil d’Ariane/menu/titre, badge d’administration permanent, grands raccourcis de l’accueil
et recherche globale dans l’annuaire. L’accueil place graphique et équipes à examiner côte à côte.
Le total du graphique est omis seulement s’il est égal au KPI visible de même mesure/période ; une
valeur différente ou une période différente reste affichée. Les calculs/API ne sont pas modifiés.
Les explications secondaires de suspension et de statistiques sont dépliables ; les confirmations,
avertissements d’effacement, erreurs et protections des formulaires restent explicites.
La densité est appliquée par `admin-compact.css`, limitée au cadre admin et prioritaire sur les
feuilles des modules chargés à la demande. Les dimensions tactiles et le focus sont conservés.
Le contrôle navigateur couvre les quinze écrans de recette (dont dossiers, fréquentation,
statistiques et publications du bot, intégrations et exports) à sept largeurs (320 à 1 920 px), avec des données fictives.
