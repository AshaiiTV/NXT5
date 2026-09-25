# Annonces communautaires Discord

Dans **Administration → Bot → Publications**, à `/admin/bot-discord/publications`, cocher les serveurs destinataires, choisir un salon pour chacun puis **Enregistrer les destinations**. Rédiger l’annonce, préparer l’aperçu et confirmer avec **Publier sur Discord**. Une annonce peut viser jusqu’à dix serveurs, avec un salon par serveur. Aucun salon n’est choisi implicitement et aucune publication n’est automatique.

La liste vient des serveurs où le bot est installé, avec pagination Discord. L’absence du serveur communautaire ne bloque pas les autres serveurs ni la rédaction. Le serveur du lien Contact (`https://discord.gg/esPcQAeNWu`, serveur NXT5 `1509552311972790332`) dispose d’un lien d’installation OAuth ciblé quand le bot est absent. Un second lien permet de choisir un autre serveur dans Discord. Ces liens réutilisent les permissions d’installation existantes, dont Administrateur ; l’installation doit être autorisée dans Discord, puis la liste actualisée. Ils ne publient aucun message. `DISCORD_COMMUNITY_GUILD_ID` permet de remplacer le serveur communautaire repéré.

L’aperçu présente chaque serveur et salon ainsi que le texte exact. Après confirmation, chaque destination affiche son propre résultat : envoyée, en attente, en cours, à vérifier ou échec, avec le lien du message lorsqu’il existe. Une réussite partielle ne masque jamais une destination non livrée. Les vingt derniers envois restent visibles dans l’historique repliable.

**Vérifier le résultat** consulte Discord sans renvoyer de message. **Préparer la reprise des envois** ouvre un nouvel aperçu du même contenu et des mêmes destinations, puis la confirmation reprend uniquement les envois en attente ou définitivement refusés. Après rechargement, **Reprendre cette annonce** retrouve le texte et les destinations depuis l’historique ; un brouillon déjà ouvert doit être terminé ou vidé avant cette action. Si les destinations enregistrées ont changé, les rétablir explicitement avant de préparer la reprise. Les messages déjà confirmés ou incertains ne sont jamais renvoyés.

Le groupe Bot contient Publications puis Statistiques, dans la sidebar et le sélecteur mobile Rubrique. Statistiques conserve `/admin/bot-discord` et ses paramètres de période, sans charger les annonces. `BotPublicationsPage.jsx` accueille `CommunityAnnouncementsPanel.jsx` ; la garde `AdminNavigationContext` protège les brouillons et les opérations en cours lors des changements de rubrique, du retour à l’app et de la déconnexion. La fermeture ou le rechargement de la page protège aussi le brouillon.

## API et installation

Les appels de la page annoncent la version du contrat via `X-NXT5-Announcements-Version: 2`. Un onglet resté ouvert sur l’ancienne interface reçoit une erreur explicite demandant de recharger la page, avant toute lecture Discord ou opération de publication. Aucun rechargement automatique n’est imposé : le brouillon reste disponible pour être copié. Les contrôles d’accès administrateur et de contexte de production précèdent cette vérification.

L’endpoint `admin-discord-announcements` exige un administrateur de plateforme authentifié et le contexte de production, avant tout appel Discord. Aucun jeton n’est envoyé au navigateur. Le coupe-circuit `DISCORD_PUBLISHING_ENABLED` reste appliqué. Les identités du bot et de l’application sont comparées avant chaque opération ; les salons sont vérifiés côté serveur.

La migration `discord-community-announcements-20260924-v1` crée les réglages et reçus. La migration suivante, `discord-community-destinations-20260925-v1`, ajoute la sélection JSON versionnée, les lots immuables et l’unicité d’un reçu par référence et serveur. Elle convertit les réglages et reçus historiques, conserve les anciennes colonnes de configuration rendues facultatives et autorise l’état `queued`. Elle est enregistrée dans `tools/migration-runner.mjs`. Appliquer les migrations lors du déploiement avant d’utiliser cette nouvelle version ; l’endpoint renvoie une erreur de maintenance si elles manquent.

- `GET` : `guilds` avec salons et permissions, `destinations` enregistrées, `installUrl`, état et invitation `community`, derniers reçus (50 pour réconcilier l’envoi courant, 20 affichés dans l’historique). L’indisponibilité des salons d’un serveur produit une erreur locale et conserve les autres serveurs.
- `POST configure { destinations, reference? }` : enregistrer la liste `{guildId, channelId}`. Pour reprendre une annonce existante, `reference` exige exactement son ensemble immuable et revalide les destinations encore à envoyer.
- `POST preview { reference, content, destinations }` : renvoyer l’aperçu exact, les destinations nommées et un jeton signé valable dix minutes, lié à l’utilisateur, au contenu, à toute la sélection et à sa version.
- `POST publish { reference, content, destinations, previewToken }` : créer atomiquement le lot et tous ses reçus, puis envoyer aux destinations sélectionnées. Retour `{ reference, status, results }`, avec un reçu par serveur. Les états globaux sont `sent`, `partial`, `uncertain`, `failed` ; les reçus distinguent aussi `queued`.
- `POST recover { reference, guildId? }` : vérifier tous les reçus ou celui d’un serveur, à leur destination d’origine, même après un changement de réglages. Aucun nouvel envoi.
- `POST restore { reference }` : retrouver le texte, les destinations immuables et leurs résultats pour reprendre une annonce après rechargement. Aucun réglage modifié ni message envoyé.

Une annonce utilise un embed de 4 096 caractères maximum, avec sa référence en pied de message. Le Markdown est conservé exactement. Les mentions sont désactivées, et aucun crosspost vers les abonnés d’un salon d’annonces n’est déclenché. Les publications des équipes et leurs réglages restent indépendants.

## Livraison et vérification

Une référence de 1 à 80 caractères (`A-Z`, `a-z`, chiffres, point, tiret, underscore) désigne un contenu et un ensemble immuables. Tous les reçus sont enregistrés avant le premier envoi. Le passage atomique `queued` ou `failed` vers `sending` empêche deux appels simultanés d’émettre le même message ; le nonce Discord complète cette protection. Un refus explicite peut être retenté, une réponse perdue reste incertaine. Une vérification cherche le même bot, la référence et l’empreinte du texte parmi les 100 derniers messages. Une absence ne prouve pas que le message n’a pas été livré.

Les appels vers les serveurs sont limités en concurrence. Le budget d’envoi conserve les destinations non commencées dans l’état `queued` si la requête approche de sa limite ; elles restent reprenables. Un aperçu expiré ne permet que la réconciliation de reçus déjà tentés, jamais une nouvelle émission.

Les tests utilisent PGlite et un transport Discord simulé. Le contrôle visuel utilise les vrais composants administratifs avec des données fictives, sans appel ni publication sur un serveur réel. Ces contrôles ne constituent pas un test de livraison en production.
