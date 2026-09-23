# Discord, connexions et soutien

## Configurer le bot Discord

[Bot Discord](/bot-discord) regroupe la connexion du serveur, les salons, les accès aux commandes, l’activité et la liaison personnelle. Le propriétaire ou un capitaine configure le bot ; le staff peut suivre les publications et partager des games selon ses droits. La disponibilité dépend de la configuration du service.

1. Inviter le bot avec **Ajouter à Discord** si nécessaire. L’invitation demande l’autorisation Administrateur, à valider par un responsable du serveur.
2. Dans Discord, lancer `/nxt compte lier`, ouvrir le lien personnel et confirmer son compte NXT5. Revenir dans Discord, vérifier les deux comptes puis confirmer la liaison. Le lien expire après dix minutes et ne rejoint aucune équipe.
3. Avec ce même compte NXT5, créer le code de l’équipe puis utiliser `/nxt connecter code:…` dans le serveur. Il faut être propriétaire ou capitaine NXT5 et avoir la permission Discord Gérer le serveur ou Administrateur. Seul le créateur du code peut l’utiliser ; le code expire après dix minutes.
4. Choisir et enregistrer les salons de publication. Les catégories, mentions et pistes de review sont facultatives. Chaque destination peut diffuser automatiquement les nouvelles games ou servir aux partages manuels.
5. Envoyer explicitement le test fictif, vérifier sa réception puis confirmer l’activation. L’aperçu seul n’envoie rien. La première activation demande un test confirmé ; les anciennes games ne sont pas republiées automatiquement.

Une équipe est reliée à un seul serveur ; plusieurs équipes peuvent partager ce serveur avec leurs propres réglages. **Accès aux commandes** permet d’exiger un ou plusieurs rôles Discord en plus des droits NXT5. Même un administrateur Discord doit posséder un rôle sélectionné si cette restriction est active. Ces rôles sont distincts du rôle mentionné dans les annonces et des permissions de lecture des salons.

Les messages et visuels publiés sont visibles aux personnes ayant accès au salon ; les liens vers les games conservent les permissions NXT5. Les notes privées du staff ne sont pas incluses dans les publications de games. Pause ou déliaison arrête la diffusion de l’équipe sans retirer les messages déjà envoyés ni modifier les autres équipes. Un envoi incertain doit être vérifié, jamais relancé aveuglément.

## Retrouver une commande

`/nxt help` et `/nxt aide` ouvrent le tutoriel et le catalogue, même avant liaison. Le catalogue de référence est [shared/discord-command.js](../../shared/discord-command.js) ; sa présence dans le code ne prouve pas l’enregistrement de toutes les commandes sur un serveur Discord.

| Besoin | Commande |
| --- | --- |
| Vérifier son compte lié | `/nxt compte profil` |
| Retrouver ses équipes autorisées | `/nxt equipe liste` |
| Choisir son équipe active sur ce serveur | `/nxt equipe choisir nom:…` |
| Voir la dernière game | `/nxt derniere` |
| Voir une game précise | `/nxt game voir game:…` |
| Lire le bilan d’une période | `/nxt bilan periode:semaine` |
| Consulter les rendez-vous | `/nxt planning` |
| Lire les objectifs accessibles | `/nxt objectifs liste` |
| Lire les pools | `/nxt pool voir` |
| Retrouver les reviews | `/nxt review liste` |

Les commandes d’équipe exigent le compte lié, l’appartenance NXT5 et, si configurés, les rôles Discord autorisés. Les actions de création, modification, partage et réglage suivent leurs droits staff ou responsable. Choisir une équipe ne change pas celle des autres personnes.

## Connexions au site

La connexion au site avec un fournisseur externe, la liaison personnelle `/nxt compte lier` et la connexion du serveur au bot sont trois parcours distincts.

[Paramètres → Connexions associées](/parametres) permet d’ajouter les méthodes disponibles au compte NXT5 existant. Les services non activés restent signalés comme indisponibles. Ne pas créer un second compte pour ajouter une connexion : se connecter au compte existant puis associer le service. Aucune fusion automatique n’a lieu si une adresse e-mail est déjà utilisée.

## Soutien et accès

[Soutenir NXT5](/soutenir) présente le soutien facultatif au développement. Lorsque les contributions sont ouvertes, le bouton conduit à une plateforme externe où choisir un montant ponctuel ou mensuel. Le soutien ne modifie aucun accès et ne débloque aucune fonctionnalité exclusive.

**Mon abonnement**, dans [Paramètres](/parametres), affiche une formule attribuée par l’administration. Les abonnements ne sont pas encore lancés et tous les outils restent accessibles selon les droits de l’équipe. L’attribution manuelle ne facture rien et ne déclenche aucune reconduction automatique. Pour une modification, contacter l’administration. Ne pas orienter les utilisateurs ordinaires vers la page administrative des tarifs.
