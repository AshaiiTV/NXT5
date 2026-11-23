# Durcissement de l’intégration Discord — 23 novembre 2026

Branche : `claude/discord-hardening-20261123`.

## Changements

1. **`/nxt reglages canal`** : en plus des droits du bot, la personne qui lance la commande doit pouvoir **voir** le salon et **y écrire**. Discord fournit ses permissions calculées dans `interaction.data.resolved.channels[id].permissions` ; `parseDiscordCommand` les conserve (`_canalPermissions`) avec la confirmation en attente et l’action les vérifie avant et après confirmation (`DISCORD_MEMBER_CHANNEL_FORBIDDEN`).
2. **Liaison de compte (hameçonnage)** :
   - le libellé Discord inclut le **nom d’utilisateur unique** (`Nom affiché (@pseudo)`), affiché avec l’identifiant sur la page NXT5 et dans la vérification Discord ;
   - avertissement « Ne confirme jamais un lien qu’une autre personne t’a envoyé. » dans Discord et sur la page ;
   - après une liaison réussie, un e-mail est envoyé au compte NXT5 (au mieux, délai maximal 5 s, jamais bloquant). L’interaction Discord est déjà traitée dans `context.waitUntil`. L’e-mail utilise `sendNotification` ;
   - le jeton n’est plus dans une chaîne de requête : le bot envoie `/bot-discord#lier=…` (fragment jamais transmis au serveur) et la page l’envoie dans le corps d’un `POST` (`preview: true` pour la lecture). `?lier=` et `GET ?token=` restent acceptés pour les liens déjà publiés ; la page retire le jeton de l’historique.
3. **Débit de l’outbox du bot** : `deliverBotOutbox(500, { budgetMs: 20 000 })` vide la file pendant environ 20 s à chaque passage (fonction d’arrière-plan, limite de 15 min, déclenchée toutes les 5 min) au lieu de 10 messages fixes. Une seule lecture `getDiscordGuild` par serveur et par passage.
4. **Erreurs avant envoi** : si le `POST` n’a pas été tenté, une erreur réseau, base de données ou 5xx remet le message en file avec un délai exponentiel (60 s à 15 min), jusqu’à 5 tentatives. Une erreur 4xx reste définitive.
5. **`/nxt voir derniere|bilan|stats`** : une publication publique au plus par salon et par sujet toutes les 30 s. Au-delà, le résultat est affiché uniquement à la personne qui l’a demandé, avec une courte explication.
6. **Menus de sélection** : libellés nettoyés, « Sans titre » si vide, 100 caractères au maximum sans couper un emoji.
7. **Envois incertains** : après 3 jours sans confirmation, ils passent en `failed` avec le code `DELIVERY_UNCONFIRMED_REVIEW` à vérifier, puis sont supprimés après 30 jours comme les autres échecs.
8. **HMAC interne** : la signature couvre `chemin.horodatage.corps`. Une signature destinée à une fonction ne peut plus être rejouée sur une autre fonction pendant la fenêtre de 120 s. `tools/configure-discord.mjs` signe dans le même format. Il n’y a pas de compatibilité avec l’ancien format : au déploiement, seuls les appels internes signés dans les 120 s précédentes peuvent être refusés. Le passage cron suivant (5 min) ou la réconciliation les relance. Il n’y a pas de stockage de nonce.
9. **`/nxt reglages rappels` et `reglages bilan`** : leurs écritures, l’annulation des messages en file et l’audit sont regroupés dans une transaction avec `discordTeamWriteQueries`, comme `reglages canal`. Si les droits ont changé, la commande renvoie `DISCORD_CONFIG_CHANGED`.

## Décisions produit ouvertes

- **Permission Administrator (`DISCORD_INSTALL_PERMISSIONS = '8'`)** : inchangée. Ce choix est délibéré et documenté dans `docs/discord-operations.md`. Il reste à réévaluer au profit de permissions minimales.
- **Rôles non mentionnables** : `mentionRoleId` n’est toujours pas limité aux rôles mentionnables. Une décision produit est attendue.

## Vérification

`npm run verify` (i18n, TypeScript, Vitest, build). Les tests ajoutés se trouvent dans `discord-bot-actions`, `discord-bot-identity`, `discord-account-ui`, `discord-bot-router`, `discord-bot-read` et `discord-security`.
