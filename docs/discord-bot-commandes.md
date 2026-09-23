# Commandes du bot Discord NXT5

Version du 23 septembre 2026. Ce document décrit le code préparé dans ce checkout, pas un déploiement, un enregistrement des commandes ou un envoi réel. Les tests utilisent une base PostgreSQL locale et un transport Discord simulé.

## Parcours et droits

`/nxt help` et `/nxt aide` ouvrent le même guide privé : accueil, compte, préparation, games et bilan, reviews, installation. Les boutons Précédent / Accueil / Suivant et le sélecteur changent uniquement la page d’aide. Le catalogue par catégories provient du même fichier que l’enregistrement des commandes : [discord-command.js](../shared/discord-command.js). Aucune liaison n’est nécessaire pour lire l’aide.

Le guide et les fiches de commandes décrivent aussi les parcours actuels du site : Importer Windows/Mac et aide d’ouverture, correction d’une game, export PNG unique, partage Discord avec aperçu, cinq rubriques Tendances, profils Champions / Pool déclaré / Suivi, reviews multi-games et soutien facultatif. Les commandes de lecture réutilisent un PNG déjà publié et à jour lorsqu’il est disponible ; elles ne génèrent pas d’export à la demande. Le catalogue d’aide est statique : il ne prouve pas l’enregistrement distant de chaque commande. Le menu `/nxt` de Discord montre les commandes effectivement proposées.

La connexion au **site avec Google ou Discord**, lorsqu’elle est proposée, ouvre le compte NXT5 et se gère dans **Paramètres → Connexions associées**. Elle ne réalise ni la liaison personnelle du bot ni la connexion d’un serveur. Se connecter au compte NXT5 existant avant d’associer un service évite de créer un second compte ; aucune fusion automatique par adresse e-mail n’est promise. `/nxt compte delier` retire la liaison personnelle du bot en conservant le compte et les connexions au site.

Le soutien Ko-fi reste facultatif et ne débloque aucun accès exclusif. Les abonnements ne sont pas encore lancés ; l’utilisation du bot dépend des droits et de sa configuration. Ces précisions figurent dans le parcours responsable de l’aide.

La liaison d’un **serveur à une équipe** et celle d’un **compte personnel** sont distinctes. Après avoir invité le bot sur le serveur :

1. Chaque personne, **y compris le responsable qui installe le bot**, lance `/nxt compte lier`, ouvre son lien privé, se connecte sur NXT5 et confirme son compte. Elle revient dans Discord, vérifie les deux comptes affichés et confirme la liaison. Le lien expire après dix minutes et n’accorde aucune appartenance à une équipe.
2. Le responsable crée le code de son équipe dans NXT5 avec **le même compte que celui lié à Discord** et utilise `/nxt connecter code:…`. Il doit être propriétaire ou capitaine NXT5 de cette équipe et disposer de la permission Discord **Gérer le serveur** ou **Administrateur**. Seul le créateur du code peut l’utiliser. Plusieurs équipes peuvent partager le même serveur, chacune avec ses destinations.
3. Le responsable peut ouvrir **Bot Discord → Accès** sur NXT5 et choisir les **rôles Discord autorisés pour cette équipe**. S’il en sélectionne, chaque personne doit posséder au moins un de ces rôles **et** conserver ses droits NXT5 sur cette équipe. La sélection est propre à l’équipe, même si plusieurs équipes utilisent le même serveur. Aucun rôle Discord ne donne à lui seul les droits de capitaine ou de staff NXT5.
4. `/nxt equipe liste` montre uniquement ses équipes autorisées reliées à ce serveur. `/nxt equipe choisir nom:…` mémorise un choix **par personne et par serveur** ; il ne change pas l’équipe des autres membres.
5. Chaque consultation, bouton et confirmation retrouve les droits actuels du compte NXT5 et les rôles Discord fournis par l’interaction. Un changement d’équipe active ne détourne pas une confirmation : celle-ci conserve l’équipe de son aperçu. Si le rôle Discord requis est retiré avant une confirmation, celle-ci est refusée.

Un compte Discord ne peut être lié qu’à un compte NXT5 et réciproquement. Délier le compte révoque les choix personnels et les formulaires/confirmations en attente sans supprimer le compte NXT5, ses équipes ou son historique métier.

Cette actualisation conserve les six rubriques et les cinquante commandes du catalogue. Les nouveaux textes sont livrés avec les fonctions du site ; ils ne nécessitent pas de réenregistrement de commandes Discord.

| Accès du catalogue | Contrôle effectif |
| --- | --- |
| Tous | Aide et démarrage de la liaison personnelle, dans un serveur. |
| Compte lié | Consultation ou révocation de sa propre association. |
| Membre | Compte lié et appartenance NXT5 à l’équipe concernée, reliée au serveur courant ; si l’équipe a configuré des rôles Discord autorisés, au moins l’un d’eux est aussi requis. |
| Staff | Propriétaire, capitaine, coach, assistant, analyste, manager ou board NXT5. |
| Responsable | Compte personnel lié, propriétaire ou capitaine NXT5 de l’équipe concernée. `/nxt connecter`, `/nxt statut`, `/nxt pause` et `/nxt reprendre` exigent aussi la permission Discord **Gérer le serveur** ou **Administrateur**. Pour connecter, le compte lié doit être le créateur du code. Après connexion, les rôles Discord autorisés de l’équipe s’appliquent aussi aux commandes d’équipe, sans exception administrateur. |

Sur un serveur partagé, gérer le serveur Discord ne donne aucun accès aux autres équipes NXT5. Les suggestions de `statut`, `pause` et `reprendre` ne proposent que les équipes dont le compte lié est propriétaire ou capitaine **et** dont il possède un rôle Discord autorisé si l’équipe a activé ce filtre ; saisir le nom ou l’identifiant d’une autre équipe ne contourne pas ce contrôle. Les commandes de lecture et leurs menus restent limités aux équipes dont le compte est membre et satisfait le même filtre. Les liens NXT5 revérifient également les droits sur le site.

L’aide et les commandes de liaison/consultation du compte personnel restent accessibles pour permettre à chacun de se connecter et de comprendre un refus. `/nxt connecter` reste disponible pour établir la première liaison d’une équipe, avec le code personnel, les droits NXT5 et les permissions Discord indiqués ci-dessus. Une équipe sans filtre de rôles conserve ses contrôles NXT5 actuels. Retirer explicitement le filtre dans **Bot Discord → Accès** revient à ce comportement. Si la liaison de l’équipe passe à un autre serveur alors qu’un filtre existe, ses anciens rôles ne deviennent pas valables dans le nouveau serveur : les commandes d’équipe sont refusées jusqu’à une nouvelle configuration ou à la suppression explicite du filtre.

La commande racine est découvrable par tous (`default_member_permissions: null`). Cela n’accorde aucun accès aux données : les contrôles serveur restent appliqués commande par commande. Les interactions sont limitées aux serveurs, pas aux messages privés.

## Catalogue des 50 chemins

Les options obligatoires figurent sous la forme `nom:<valeur>` ; les options facultatives sont entre crochets. Les identifiants de game, review, événement ou objectif sont ceux des données NXT5 présentés par les commandes de lecture. Les dates utilisent `AAAA-MM-JJ`, les heures `HH:MM`, les salons le sélecteur Discord et `actif` un booléen.

### Aide, comptes et équipes

| Commande | Usage | Accès |
| --- | --- | --- |
| `/nxt help [rubrique:<accueil / compte / preparer / games / review / responsable>] [commande:<valeur>]` | Ouvrir le tutoriel et le catalogue. | Tous |
| `/nxt aide` | Ouvrir le tutoriel NXT5. | Tous |
| `/nxt compte lier` | Lier ton compte Discord à NXT5. | Tous |
| `/nxt compte profil` | Voir ton compte et ton équipe active. | Compte lié |
| `/nxt compte delier` | Délier ton compte après confirmation. | Compte lié |
| `/nxt equipe liste` | Lister tes équipes autorisées ici. | Membre |
| `/nxt equipe choisir [nom:<valeur>]` | Choisir ton équipe active. | Membre |

### Games, statistiques et bilans

| Commande | Usage | Accès |
| --- | --- | --- |
| `/nxt derniere [equipe:<valeur>]` | Retrouver la dernière game. | Membre |
| `/nxt game voir game:<valeur>` | Consulter la fiche d’une game. | Membre |
| `/nxt game chercher [periode:<semaine / mois>] [categorie:<valeur>]` | Rechercher des games par période. | Membre |
| `/nxt game comparer game_a:<valeur> game_b:<valeur>` | Comparer deux games accessibles. | Membre |
| `/nxt bilan [periode:<session / semaine / mois>] [groupe:<valeur>] [categorie:<valeur>]` | Résumer une session ou une période. | Membre |
| `/nxt stats equipe [periode:<semaine / mois>] [categorie:<valeur>]` | Afficher les statistiques d’équipe. | Membre |
| `/nxt stats tendance [periode:<semaine / mois>]` | Comparer deux périodes successives. | Membre |
| `/nxt reglages bilan actif:<oui / non> [jour:<lundi / mardi / mercredi / jeudi / vendredi / samedi / dimanche>] [heure:<valeur>] [equipe:<valeur>]` | Planifier le bilan hebdomadaire. | Responsable |

### Joueurs et objectifs

| Commande | Usage | Accès |
| --- | --- | --- |
| `/nxt joueur profil joueur:<valeur>` | Consulter le profil d’un joueur. | Membre |
| `/nxt joueur stats joueur:<valeur> [periode:<semaine / mois>]` | Consulter ses statistiques récentes. | Membre |
| `/nxt joueur comparer joueur:<valeur> [periode:<semaine / mois>]` | Comparer ses résultats dans le temps. | Membre |
| `/nxt objectifs liste [joueur:<valeur>]` | Lire les objectifs autorisés. | Membre |
| `/nxt objectifs definir objectif:<valeur> [joueur:<valeur>] [echeance:<valeur>]` | Créer un objectif après aperçu. | Staff |
| `/nxt objectifs terminer objectif:<valeur> [commentaire:<valeur>]` | Clôturer un objectif après confirmation. | Staff |
| `/nxt objectifs point objectif:<valeur> note:<valeur>` | Ajouter un point de suivi. | Membre |

### Pools et préparation de draft

| Commande | Usage | Accès |
| --- | --- | --- |
| `/nxt pool voir [joueur:<valeur>] [role:<top / jungle / mid / adc / support>]` | Consulter les pools de champions. | Membre |
| `/nxt stats champions [periode:<semaine / mois>] [joueur:<valeur>]` | Résumer les champions joués. | Membre |
| `/nxt pool suggerer joueur:<valeur> [objectif:<valeur>]` | Préparer des pistes de travail du pool. | Staff |
| `/nxt draft compositions [role:<top / jungle / mid / adc / support>] [champion:<valeur>]` | Retrouver les compositions enregistrées. | Membre |
| `/nxt draft preparer evenement:<valeur>` | Préparer une draft pour un événement. | Staff |
| `/nxt draft notes evenement:<valeur> texte:<valeur>` | Ajouter une consigne de draft. | Staff |

### Planning et présences

| Commande | Usage | Accès |
| --- | --- | --- |
| `/nxt planning [periode:<aujourdhui / semaine / mois>]` | Consulter les prochains rendez-vous. | Membre |
| `/nxt evenement creer type:<scrim / match / review> date:<valeur> heure:<valeur> duree:<nombre>` | Créer un événement après aperçu. | Staff |
| `/nxt evenement modifier evenement:<valeur> [titre:<valeur>] [date:<valeur>] [heure:<valeur>] [duree:<nombre>] [details:<valeur>]` | Modifier un événement par formulaire. | Staff |
| `/nxt evenement annuler evenement:<valeur> [motif:<valeur>]` | Annuler un événement après confirmation. | Staff |
| `/nxt presence repondre evenement:<valeur> statut:<present / absent / retard> [retard:<nombre>]` | Confirmer ta présence à un événement. | Membre |
| `/nxt presence liste evenement:<valeur>` | Voir les réponses et les sans-réponse. | Staff |
| `/nxt presence relancer evenement:<valeur>` | Préparer une relance ciblée. | Staff |
| `/nxt disponibilites definir date:<valeur> debut:<valeur> fin:<valeur>` | Renseigner ton créneau disponible. | Membre |

### Reviews et consignes

| Commande | Usage | Accès |
| --- | --- | --- |
| `/nxt review liste [periode:<semaine / mois>] [joueur:<valeur>]` | Retrouver les reviews accessibles. | Membre |
| `/nxt review voir review:<valeur>` | Ouvrir les points clés d’une review. | Membre |
| `/nxt review creer game:<valeur> titre:<valeur> [resume:<valeur>] [corrections:<valeur>] [actions:<valeur>]` | Rédiger une review en brouillon. | Staff |
| `/nxt review partager review:<valeur> canal:<salon> [resume:<valeur>]` | Partager une review après aperçu. | Staff |
| `/nxt review lire review:<valeur>` | Confirmer la lecture de cette version. | Membre |
| `/nxt review lectures review:<valeur>` | Voir les lectures de la version partagée. | Staff |

### Connexion et réglages

| Commande | Usage | Accès |
| --- | --- | --- |
| `/nxt connecter code:<valeur>` | Après `/nxt compte lier`, utiliser son propre code pour relier son équipe. | Responsable |
| `/nxt statut [equipe:<valeur>]` | Afficher l’état de la connexion. | Responsable |
| `/nxt pause [equipe:<valeur>]` | Suspendre les publications de l’équipe. | Responsable |
| `/nxt reprendre [equipe:<valeur>]` | Reprendre les publications de l’équipe. | Responsable |
| `/nxt reglages canal type:<games / planning / reviews / bilans> canal:<salon> [equipe:<valeur>]` | Choisir un salon de publication. | Responsable |
| `/nxt reglages rappels actif:<oui / non> [delai:<nombre>] [equipe:<valeur>]` | Configurer les rappels de session. | Responsable |
| `/nxt reglages fuseau fuseau:<valeur> [equipe:<valeur>]` | Régler le fuseau horaire de l’équipe. | Responsable |
| `/nxt diffusion test [equipe:<valeur>]` | Tester le salon configuré. | Responsable |

## Écritures, aperçus et confirmations

Les objectifs à créer/clôturer, les événements à créer/modifier/annuler, les reviews à enregistrer/partager, les changements de salon/fuseau, les relances et les tests présentent un aperçu ou une confirmation. Les actions personnelles simples, comme sa présence, sa disponibilité, sa lecture ou un point de suivi, enregistrent directement la demande autorisée. Les réglages booléens des rappels et du bilan prennent effet sur demande explicite.

Quand un formulaire est nécessaire, le bot affiche d’abord « Ouvrir le formulaire ». La soumission renvoie vers la validation prévue pour l’action. Les jetons sont aléatoires, stockés sous forme d’empreinte, liés au compte/serveur/équipe, valables dix minutes et consommés une seule fois. Les droits sont revérifiés à l’ouverture et à la confirmation. Le reçu d’interaction empêche le traitement répété du même événement Discord.

L’aide et sa navigation répondent immédiatement sans accès à la base et ne créent pas de reçu de commande. Les autres nouvelles commandes et leurs boutons conservent un reçu dont le nom est normalisé, sans UUID ni jeton de formulaire ; le contenu de la réponse privée n’y est pas enregistré. Les statistiques des publications de games existantes portent sur leur file et leurs livraisons : elles ne doivent pas être interprétées comme un compteur complet des messages de la nouvelle `discord_bot_outbox`.

- Une modification d’événement vérifie sa révision et signale les chevauchements. Une annulation conserve le motif, désactive les rappels en attente et prépare une information de mise à jour dans le salon de planning configuré.
- Les présences sont personnelles et distinctes des disponibilités. La liste attendue repose sur les profils actifs de joueurs liés à des membres de l’équipe ; les comptes non liés ne sont pas présentés comme ayant répondu. La relance vise les sans-réponse, sans mention générale, avec une limite d’une relance par événement toutes les trente minutes.
- Les objectifs collectifs et individuels conservent les points de suivi et leur clôture. Les objectifs de progression déjà présents dans `player_goals` restent utilisables, en plus des nouveaux objectifs textuels.
- Une review créée depuis Discord est un brouillon staff. Le partage utilise seulement les consignes explicitement saisies ou validées dans l’aperçu, pas le contenu libre privé du staff. Une ancienne review sans résumé partageable demande un résumé avant envoi.
- Les confirmations « Lu » sont attachées à une version. Une modification du titre, du contenu ou du résumé incrémente la version ; la lecture d’une version précédente ne valide pas la suivante. Le partage mémorise les destinataires attendus, et le suivi des lectures est réservé au staff.
- Si le titre ou le contenu change sans nouveau résumé, l’ancien résumé doit être revalidé. Le bot le conserve pour le staff mais ne le présente plus comme une consigne actuelle aux membres et refuse sa confirmation de lecture avant revalidation.

Les sessions créées par le bot sont visibles dans Planning sur le site. Les nouveaux objectifs apparaissent dans le suivi du profil concerné, avec les objectifs collectifs. Ces données utilisent le même stockage serveur que les commandes ; leur modification passe par les commandes du bot. Les anciens événements inscrits dans la grille de disponibilités restent consultables dans `/nxt planning` et se modifient sur le site ; ils n’acquièrent pas automatiquement un registre de présences Discord.

## Salons, pause et planification

Les destinations `planning`, `reviews` et `bilans` sont propres à l’équipe. Le salon choisi pour partager une review doit correspondre à sa destination autorisée. Le bot vérifie l’appartenance du salon au serveur et ses droits d’envoi. Le responsable doit vérifier son audience : une publication devient lisible par **toute personne ayant accès au salon**, même si elle n’est pas membre de l’équipe NXT5. L’aperçu l’indique explicitement ; les droits NXT5 protègent les commandes privées et les liens du site, pas la lecture du texte déjà publié dans Discord.

`/nxt reglages canal type:games` ajoute ou retrouve une destination de game sans activer sa publication automatique. La page **Bot Discord** guide d’abord la connexion, le choix des salons et le test ; les catégories, mentions et options d’automatisation se trouvent dans les réglages du salon. La limite existante de dix destinations de games par équipe reste appliquée.

| Commande ou état | Effet |
| --- | --- |
| `/nxt pause` | Met la connexion de l’équipe en pause : bloque les publications de games et les nouveaux envois de rappels, bilans, reviews, relances et mises à jour. Les consultations et réglages restent accessibles. |
| `/nxt reprendre` | Réactive la connexion déjà configurée ; conserve les réglages de rappels et du bilan. Les contrôles de salons existants s’appliquent. |
| `/nxt reglages rappels actif:non` | Désactive les rappels automatiques avant événement ; ne désactive pas les autres types de publication ni une relance demandée explicitement. |
| `/nxt reglages bilan actif:non` | Désactive seulement le bilan hebdomadaire automatique. |
| `/nxt diffusion test` | Envoi explicite de données fictives par le circuit de test existant, utilisable pour une connexion active ou en pause. Ne valide pas une game réelle. |
| `DISCORD_PUBLISHING_ENABLED=false` | Coupe-circuit global des envois ; ne remplace pas les réglages individuels d’équipe. |

La pause ne promet pas un rattrapage intégral : des travaux non envoyés peuvent être annulés par revalidation, et les fenêtres temporelles expirent. Après une reprise, les rappels encore pertinents peuvent être remis en file ; un ancien partage manuel annulé doit être redemandé explicitement. L’historique des games n’est pas republié par cette évolution.

Le point d’entrée planifié [discord-bot-tick.ts](../netlify/functions/discord-bot-tick.ts) s’exécute toutes les cinq minutes dans le contexte de production fourni par Netlify, si sa configuration est complète. Il appelle un traitement en arrière-plan par une requête signée avec le secret existant. Le worker entretient les données temporaires ; lorsque les envois sont activés, il prépare aussi les rappels et les bilans puis traite jusqu’à dix envois par passage. L’horaire est donc approximatif et dépend aussi de la file et de Discord.

Les rappels rattrapent au plus les cinq minutes suivant le début d’un événement. Le bilan hebdomadaire dispose d’une fenêtre de rattrapage d’une heure ; sans game, un message le précise. Les dates saisies utilisent le fuseau IANA de l’équipe et sont stockées en UTC. Changer le fuseau conserve l’instant des événements existants. Une heure locale inexistante ou ambiguë lors d’un changement d’heure est refusée à la saisie ; une occurrence hebdomadaire à cette heure est ignorée.

### File durable et réponse perdue

`discord_bot_outbox` est distincte de la file des PNG de games existante. Elle conserve un identifiant de dédoublonnage, le contenu, la destination, la révision d’événement ou de review, les réglages de planification, une éventuelle expiration et l’état de livraison.

Avant l’envoi, le worker revérifie la connexion active, son serveur/version, la destination actuelle, les droits du bot, la révision du contenu, les réglages et la validité temporelle. Une modification ou annulation ne doit pas laisser partir une ancienne version en attente. Une réponse Discord `429` peut être réessayée dans la limite prévue ; un délai d’attente, un envoi au résultat ambigu ou une perte de confirmation après envoi passe en `uncertain`.

**Un envoi incertain n’est jamais republié automatiquement.** Le rapprochement cherche la référence du bot dans l’historique du salon. Ne pas trouver le message ne prouve pas qu’il n’a pas été reçu. Ne pas remettre manuellement un travail `uncertain` en `queued` pour « essayer » : vérifier d’abord le salon et conserver la trace de l’incident. Une relance automatique peut reprendre un travail annulé dont l’absence de message est connue, jamais un résultat incertain.

## Architecture et données

Le guide reçoit une réponse immédiate. Pour les commandes métier, l’endpoint accuse réception par une réponse différée privée, puis termine le travail avec `context.waitUntil` et met à jour cette réponse. Discord exige l’accusé initial sous trois secondes ; une instance sans ce mécanisme renvoie une indisponibilité explicite au lieu de promettre un traitement. `waitUntil` est fourni par le runtime Netlify même si la version locale des types du SDK ne le déclare pas. Références vérifiées : [interactions Discord](https://docs.discord.com/developers/interactions/receiving-and-responding) et [API Netlify Functions — waitUntil](https://docs.netlify.com/build/functions/api/#waituntil).

| Élément | Source |
| --- | --- |
| Catalogue, paramètres, accès annoncés | [shared/discord-command.js](../shared/discord-command.js) |
| Six pages du tutoriel et catalogue interactif | [shared/discord-help.js](../shared/discord-help.js) |
| Réception signée et réponses privées | [discord-interactions.ts](../netlify/functions/discord-interactions.ts) |
| Routage, paramètres, formulaires, confirmations et reçus | [discord-bot.ts](../netlify/functions/_lib/discord-bot.ts) |
| Liaison personnelle et sélection d’équipe | [discord-bot-account.ts](../netlify/functions/_lib/discord-bot-account.ts), [discord-bot-common.ts](../netlify/functions/_lib/discord-bot-common.ts) |
| Consultations et agrégats | [discord-bot-read.ts](../netlify/functions/_lib/discord-bot-read.ts) |
| Écritures métier | [discord-bot-actions.ts](../netlify/functions/_lib/discord-bot-actions.ts) |
| Planification, dédoublonnage et livraison | [discord-bot-schedule.ts](../netlify/functions/_lib/discord-bot-schedule.ts) |
| Données de sessions et objectifs pour le site | [discord-bot-bootstrap.ts](../netlify/functions/_lib/discord-bot-bootstrap.ts), [DiscordWorkflows.jsx](../src/components/discord/DiscordWorkflows.jsx) |

Les migrations ajoutent les associations personnelles, demandes de liaison, préférences d’équipe, confirmations/formulaires, événements, présences, objectifs textuels et journaux, notes de draft, réglages, destinataires/lectures de reviews, la file durable et les éventuelles listes de rôles Discord autorisés par équipe. Les reviews existantes sont conservées avec un état publié par défaut ; seuls les nouveaux brouillons sont privés au staff. La liaison personnelle et les préférences peuvent être révoquées sans effacer les données métier.

Le traitement planifié purge les demandes de liaison et formulaires expirés depuis plus d’une heure ainsi que les messages terminés depuis plus de trente jours. Il conserve les envois incertains pour leur rapprochement et les historiques métier. Le nettoyage reste actif lorsque le coupe-circuit des publications est fermé, si la configuration du service est complète.

Les réponses des commandes sont privées. Les messages destinés à un salon passent par une action de partage ou une planification explicitement activée. Les notes individuelles, objectifs d’un autre joueur et brouillons suivent les droits du compte ; la présence dans un serveur Discord ne suffit jamais. Les textes échappent les mentions involontaires. Aucune clé Riot, clé de session ou identité technique secrète n’est placée dans un embed.

## Limites concrètes

- Les statistiques portent uniquement sur les données importées dans NXT5. Les valeurs manquantes restent indisponibles et les résultats inconnus sont séparés des victoires/défaites. Les comparaisons décrivent une évolution ; elles ne prouvent pas sa cause.
- Les consultations de bilans refusent un périmètre de plus de 1 000 games afin d’éviter un agrégat silencieusement partiel. Réduire la période ou choisir un groupe. Les listes Discord sont des aperçus bornés ; leurs compteurs, indications de limite et liens permettent de poursuivre sur le site. Les limites usuelles d’affichage sont dix games/reviews, douze objectifs/pools/événements et vingt équipes personnelles ; tous les écrans ne constituent pas une pagination complète.
- Les descriptions et champs des embeds ont un budget de caractères. Un texte long peut être raccourci ; le détail reste accessible sur NXT5. Les options de texte du catalogue sont elles-mêmes bornées, généralement à 100 caractères pour un identifiant/libellé et 1 000 pour un texte de commande. Les formulaires prévoient leurs propres limites.
- Les disponibilités s’ajoutent par heures entières dans la grille existante, entre 10:00 et 00:00. Un créneau peut traverser minuit si toutes ses heures sont prises en charge ; les autres créneaux et anciens événements sont conservés. Une disponibilité ne confirme pas une présence à une session.
- Le roster de préparation est le roster renseigné dans NXT5. Il n’est pas présenté comme une sélection de joueurs confirmée pour l’événement. Les compositions restent celles enregistrées ; aucune donnée adverse externe ni lecture de méta en direct n’est supposée.
- Les suggestions de pool suivent des règles explicites sur les statuts de confiance/travail et les données existantes. Elles restent des pistes à valider par le staff ; aucune analyse d’IA ou garantie de performance n’est inventée.
- Le changement d’un horaire conserve les réponses de présence enregistrées ; les participants doivent vérifier leur réponse pour le nouvel horaire. Une confirmation « Lu » indique une lecture déclarée, pas un accord avec le contenu.
- Les tests automatisés et captures locales ne prouvent ni l’installation du bot, ni le fonctionnement de la planification hébergée, ni une première livraison réelle.

## Développement et activation

Les trois migrations sont inscrites dans [migration-runner.mjs](../tools/migration-runner.mjs) :

| Clé de disponibilité | Migration |
| --- | --- |
| `discord-bot-identity-20260922-v1` | [20260922_discord_bot_identity.sql](../database/migrations/20260922_discord_bot_identity.sql) |
| `discord-bot-workflows-20260922-v1` | [20260922_discord_bot_workflows.sql](../database/migrations/20260922_discord_bot_workflows.sql) |
| `discord-bot-role-access-20260923-v1` | [20260923_discord_bot_role_access.sql](../database/migrations/20260923_discord_bot_role_access.sql) |

Le contexte Netlify de production exécute déjà `npm run verify && npm run db:migrate` avant la publication. Le moteur de migration utilise sa transaction/verrou et son registre de checksum. Les nouvelles commandes métier vérifient les trois clés de disponibilité ; l’aide reste utilisable si la mise à jour n’est pas encore appliquée. Ne pas modifier une migration déjà appliquée : une correction ultérieure doit avoir sa propre migration.

L’évolution réutilise les secrets et la configuration décrits dans [Discord : exploitation](discord-operations.md), notamment `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_WORKER_SECRET`, `PUBLIC_SITE_URL` et la base Neon. Aucun nouveau jeton personnel ni accès privilégié au contenu des messages n’est requis. Le site, les fonctions et les migrations doivent être livrés ensemble.

Ordre de validation :

1. Exécuter `npm run verify`, puis le build Netlify et la vérification des bundles de rendu selon le guide d’exploitation. Les tests métiers emploient PGlite et un transport simulé.
2. Pour le pilote, utiliser un site de test autonome en contexte `production`, une base séparée, un bot/serveur de test et `DISCORD_ENVIRONMENT=test`. Les Deploy Previews ne servent pas à envoyer : leurs mutations et secrets Discord sont bloqués.
3. Déployer le serveur et le site, appliquer les migrations via le flux de build, puis vérifier l’endpoint d’interactions et les trois clés de disponibilité.
4. **Après disponibilité du serveur compatible**, enregistrer le catalogue dans le serveur pilote avec les secrets de cette application dans l’environnement :

   ```sh
   node tools/register-discord-commands.mjs --guild=IDENTIFIANT_DU_SERVEUR
   ```

5. Vérifier sur ce serveur : guide, liaison personnelle **avant connexion de l’équipe**, refus d’un code créé par un autre compte, sélection entre équipes et refus d’accès à une autre équipe même pour un gestionnaire du serveur Discord. Contrôler aussi aperçu/annulation/confirmation, présence, review et lecture versionnée, événement annulé, connexion mise en pause et tâche hébergée de cinq minutes. Les tests d’envoi sont explicites.
6. Après validation du pilote, enregistrer la même commande pour l’application publique :

   ```sh
   node tools/register-discord-commands.mjs --global
   ```

Le script enregistre uniquement `/nxt` et ne remplace pas les autres commandes de l’application. L’enregistrement Discord est une opération distante distincte du déploiement ; les nouvelles sous-commandes n’apparaissent pas simplement parce que le code est compilé. Ne pas enregistrer simultanément `--guild` et `--global`. Conserver la même version du catalogue que celle du serveur déployé.

Avant l’ouverture, vérifier les destinations et leur audience, le contexte de déploiement, l’exécution planifiée, les trois migrations, les rôles Discord d’une équipe pilote et la possibilité de consulter les envois incertains. Cette vérification ne nécessite pas de toucher aux données de production pendant le développement. Ce document n’autorise ni n’atteste un déploiement ou un message réel.
