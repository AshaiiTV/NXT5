# Discord, compte et soutien

## Bot Discord

`/bot-discord` regroupe la liaison du compte personnel, la connexion du serveur, le salon des commandes de chaque équipe et les publications. Le bot n’expose que cinq commandes : `/nxt help`, `/nxt lier`, `/nxt profil`, `/nxt voir` et `/nxt connecter` (catalogue : [shared/discord-command.js](../../shared/discord-command.js)).

1. **Liaison personnelle** : `/nxt lier` donne un lien valable 10 minutes. Le compte NXT5 doit avoir un e-mail vérifié. Après confirmation sur NXT5, **Vérifier la liaison** affiche dans Discord le nom d’utilisateur et l’identifiant Discord ; **Confirmer la liaison** termine. Le bot rappelle de ne jamais confirmer un lien envoyé par une autre personne, et un e-mail prévient le compte NXT5. **Délier mon compte** se trouve dans Bot Discord.
2. **Connexion du serveur** : le propriétaire ou un capitaine crée un code dans Bot Discord, puis lance `/nxt connecter code:<code>` avec le même compte lié et la permission Discord Gérer le serveur ou Administrateur.
3. **Salon des commandes** : chaque équipe choisit son salon ; il détermine l’équipe. **Accès aux commandes** peut exiger des rôles Discord en plus des droits NXT5, y compris pour un administrateur Discord.
4. **Publications** : les salons de publication se choisissent séparément. **Tester et activer** envoie un exemple fictif avant d’activer la diffusion ; les anciennes parties ne sont pas republiées.

`/nxt voir sujet:<derniere|bilan|stats|planning|objectifs|reviews|draft>` lit les données sans les modifier. La dernière partie, le bilan et les statistiques sont publiés dans le salon, au plus une fois par sujet toutes les 30 secondes ; au-delà, et pour les autres sujets, la réponse reste privée.

## Connexions au site

Se connecter au site avec Google ou Discord (selon les services activés) est distinct de la liaison du bot. **Paramètres → Connexions associées** ajoute un service au compte existant ; il faut s’y connecter d’abord. Dissocier un service ou modifier l’e-mail demande un mot de passe NXT5.

## Soutien

`/soutenir` présente un soutien facultatif. Lorsque les contributions sont ouvertes, **Soutenir le projet** ouvre Ko-fi dans un nouvel onglet. Le soutien ne modifie aucun accès et ne débloque aucune fonction ; NXT5 ne collecte aucune donnée de paiement.
