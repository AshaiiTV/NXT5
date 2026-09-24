# Commandes du bot Discord NXT5

Version du 24 septembre 2026. Ce guide décrit le parcours simplifié préparé dans ce checkout. Le catalogue réellement visible dans Discord dépend encore du déploiement du serveur compatible et du réenregistrement de `/nxt` sur l’application Discord concernée.

## Le principe

Chaque équipe reliée à un serveur Discord possède **un seul salon de commandes**, choisi par son responsable dans **NXT5 → Bot Discord**. Le joueur lance une commande dans ce salon ; le bot retrouve l’équipe grâce au serveur et au salon, sans demander de nom, d’identifiant ni de sélection d’équipe. Deux équipes du même serveur doivent avoir des salons de commandes distincts. Le salon de commandes peut aussi être une destination de publication si le responsable le décide ; ce sont deux réglages indépendants.

Pour lire les données de l’équipe, il faut réunir les trois conditions suivantes au moment de chaque commande :

1. Son compte Discord est lié à son compte NXT5.
2. Son compte NXT5 est membre de l’équipe associée à ce salon.
3. Si l’équipe a défini des rôles Discord autorisés dans **Bot Discord → Accès**, il possède au moins un de ces rôles.

Le droit métier reste vérifié pour chaque donnée. La présence dans le salon, un rôle Discord ou la permission **Gérer le serveur** ne donnent jamais à eux seuls accès aux données d’une équipe. Une commande d’équipe envoyée hors du salon configuré reçoit un refus privé et ne modifie ni ne publie rien. Le bot ne déduit jamais l’équipe de la préférence personnelle enregistrée sur le site.

L’aide, la liaison du compte et la connexion initiale de l’équipe peuvent être utilisées avant qu’un salon de commandes soit configuré. Elles répondent en privé. Les commandes sont réservées aux interactions dans un serveur Discord ; le bot ne traite pas de commande en message privé.

## Tutoriel `/nxt help` dans Discord

L’aide s’ouvre dans un **embed visible uniquement par son auteur**. Elle donne un parcours en trois étapes, sans imposer de lire un long catalogue :

1. **Lier son compte** — lancer `/nxt lier`, ouvrir le lien privé, se connecter à NXT5 et confirmer les deux comptes affichés en revenant dans Discord.
2. **Trouver le salon de son équipe** — demander le salon de commandes au responsable. Il est configuré dans **Bot Discord** ; un serveur peut héberger plusieurs équipes, chacune dans son propre salon de commandes.
3. **Demander une information** — dans ce salon, lancer `/nxt voir`, choisir un sujet et laisser le bot retrouver automatiquement l’équipe.

L’embed explique aussi la visibilité : dernière game, bilan et statistiques d’équipe sont envoyés dans le salon après autorisation ; profil, planning, objectifs, reviews, brouillons et notes restent privés.

L’embed indique quoi faire si le compte n’est pas lié, si le salon n’est pas configuré ou si l’accès à l’équipe manque. Il renvoie le responsable à la page **Bot Discord** pour connecter le serveur, choisir le salon et régler les rôles. Lire l’aide n’exige aucun compte lié.

## Cinq chemins visibles

| Commande | Ce qu’elle fait | Où et pour qui |
| --- | --- | --- |
| `/nxt help` | Ouvre le tutoriel en embed privé. | Tout membre du serveur. |
| `/nxt lier` | Démarre la liaison personnelle Discord ↔ NXT5. | Tout membre du serveur ; réponse privée. |
| `/nxt profil` | Affiche sa propre liaison et ses indications d’accès. | Compte lié ; réponse privée. |
| `/nxt voir sujet:<derniere / bilan / stats / planning / objectifs / reviews / draft>` | Montre une information de l’équipe reconnue par le salon. | Dans le salon de commandes de l’équipe, après vérification du compte, de l’appartenance et du rôle Discord éventuel. |
| `/nxt connecter code:<code>` | Relie une équipe NXT5 au serveur pendant l’installation. | Le créateur du code, propriétaire ou capitaine NXT5 de cette équipe, avec **Gérer le serveur** ou **Administrateur** dans Discord ; réponse privée. |

Le bot ne demande plus de choisir une équipe ou de recopier un identifiant de game, d’événement ou de review pour les consultations courantes. Les réglages, créations et modifications se font sur le site NXT5. Les boutons de présence ou de lecture déjà publiés avec un rappel ou une review restent utilisables dans leur salon d’origine après vérification des droits. Les anciennes sous-commandes ne font plus partie du parcours proposé par Discord.

### Ce que `/nxt voir` montre

| Sujet | Réponse | Visibilité |
| --- | --- | --- |
| `derniere` | Dernière game importée et son résultat connu. | Salon de l’équipe, si la fiche ne contient que des données partageables. |
| `bilan` | Résumé des games récentes de l’équipe. | Salon de l’équipe. |
| `stats` | Statistiques agrégées de l’équipe. | Salon de l’équipe. |
| `planning` | Prochains rendez-vous de l’équipe. | Réponse privée depuis le salon de commandes. |
| `objectifs` | Suivi des objectifs accessibles au membre. | Réponse privée, même depuis le salon de commandes. |
| `reviews` | Reviews et points de lecture autorisés. | Réponse privée, même depuis le salon de commandes. |
| `draft` | Préparation et notes accessibles au membre. | Réponse privée, même depuis le salon de commandes. |

Une réponse dans un salon Discord est lisible par **toute personne qui a accès à ce salon**, y compris si elle n’est pas membre NXT5. Le responsable choisit donc l’audience du salon avant d’autoriser l’usage du bot. Les liens vers le site NXT5 conservent leurs propres contrôles d’accès. Les notes personnelles, objectifs individuels, consignes non publiées et brouillons ne doivent jamais être révélés dans un message public. Les textes du bot neutralisent les mentions involontaires.

## Installer une équipe

1. Inviter le bot NXT5 sur le serveur Discord une seule fois. Plusieurs équipes NXT5 peuvent partager ce serveur.
2. Le responsable lie d’abord son propre compte avec `/nxt lier`. Dans NXT5, il ouvre **Bot Discord** pour son équipe et crée un code temporaire avec ce même compte.
3. Dans le serveur Discord, il lance `/nxt connecter code:<code>`. Le code est personnel, à usage unique et expire après dix minutes. Sa validation vérifie la présence du bot, l’identité du compte lié, le droit NXT5 sur l’équipe et la permission Discord de gestion du serveur.
4. Dans **NXT5 → Bot Discord**, il choisit **un salon de commandes** pour cette équipe. Ce salon ne doit pas déjà appartenir à une autre équipe du même serveur. Il configure séparément les destinations de publication, les rôles Discord autorisés et les éventuels réglages automatiques.
5. Les membres lient leur compte avec `/nxt lier`, rejoignent le salon de leur équipe et utilisent `/nxt voir`. Le responsable teste la diffusion avant d’activer les publications automatiques.

Changer ou retirer le salon de commandes prend effet pour les prochaines interactions : l’ancien salon ne cible plus l’équipe. Si une équipe change de serveur, ses anciens rôles Discord ne deviennent pas des droits sur le nouveau serveur ; ils doivent être reconfigurés ou retirés explicitement. Délier un compte personnel révoque immédiatement son accès aux commandes d’équipe sans supprimer ses données NXT5.

## Contrôles techniques et activation

Le catalogue de référence est [shared/discord-command.js](../shared/discord-command.js). La réception signée et les réponses Discord se trouvent dans [discord-interactions.ts](../netlify/functions/discord-interactions.ts), et le contrôle des comptes, salons et droits dans les modules `discord-bot-*` du serveur. Les réponses publiques et privées doivent utiliser les options de visibilité de Discord dès la première réponse à l’interaction ; un contenu privé ne peut pas devenir public par accident lors d’un traitement différé.

Les contrôles à répéter sur chaque interaction, bouton ou confirmation sont : serveur et salon exacts, équipe associée sans ambiguïté, compte lié, appartenance courante, filtre de rôles Discord courant et droit métier. Seuls les boutons de présence et de lecture provenant d’un message de publication enregistré peuvent fonctionner dans leur salon de publication distinct. Un changement de salon, de liaison ou de rôle rend une interaction préparée caduque. Les reçus de commande évitent le traitement répété de la même interaction Discord. Aucun contenu de réponse privée ni jeton d’interaction n’est conservé dans ces reçus.

Après déploiement du code et de sa migration, l’opérateur enregistre la nouvelle définition de `/nxt` sur le serveur pilote :

```sh
node tools/register-discord-commands.mjs --guild=IDENTIFIANT_DU_SERVEUR_PILOTE
```

Une fois le pilote validé, il peut enregistrer la même définition globalement avec `--global`. L’enregistrement est une opération distante distincte du déploiement ; il ne publie aucun message. Ne pas enregistrer un catalogue nouveau sur un serveur qui exécute encore l’ancien code.

Avant une ouverture plus large, vérifier dans Discord : aide sans compte, liaison personnelle, refus hors salon, refus d’un membre d’une autre équipe, refus après retrait du rôle autorisé, isolation de deux équipes du même serveur, réponse publique des sujets d’équipe et réponse privée des sujets sensibles. Contrôler aussi sur le site la configuration du salon, sa modification et l’audience réelle. Les tests locaux ne remplacent pas ces essais réels.

Les publications automatiques de games, leurs destinations et leurs files restent décrites dans [le guide d’exploitation](discord-operations.md). `/nxt voir` lit les données existantes ; il ne déclenche pas un nouvel envoi automatique ni une modification métier.
