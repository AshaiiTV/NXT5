# Annonces communautaires Discord

Dans **Administration → Statistiques du bot → Annonces communautaires**, enregistrer le salon de destination, coller le texte de la patch note et préparer l’aperçu. Le bouton **Publier sur Discord** envoie le texte vérifié avec le bot NXT5. Le résultat donne le lien du message ; les vingt dernières annonces restent accessibles dans l’historique. Cette fonction ne programme pas de publications automatiques.

L’endpoint `admin-discord-announcements` est réservé à l’administrateur de plateforme authentifié. Il utilise le bot déjà configuré dans Netlify : aucun jeton Discord n’est renvoyé au navigateur. Les déploiements de prévisualisation, les branches et le contexte local sont refusés avant tout appel Discord. Le coupe-circuit `DISCORD_PUBLISHING_ENABLED` reste appliqué.

La migration additive `discord-community-announcements-20260924-v1` crée les réglages et reçus des annonces, indépendamment des équipes et des files de games. Le serveur par défaut est la communauté NXT5 `1509552311972790332` ; `DISCORD_COMMUNITY_GUILD_ID` permet une surcharge explicite. Le bot doit être installé sur ce serveur et disposer des droits requis dans le salon texte ou d’annonces choisi. Son identité est comparée à l’application configurée avant chaque opération.

- `GET` : serveur, salons accessibles, salon enregistré et vingt derniers reçus.
- `POST configure` avec `channelId` : enregistrer le salon communautaire.
- `POST preview` avec `reference` et `content` : préparer l’aperçu exact et un `previewToken` valable dix minutes.
- `POST publish` avec les mêmes champs et `previewToken` : publier une seule fois, ou vérifier une tentative existante.
- `POST recover` avec `reference` : vérifier une tentative enregistrée, même après rechargement de la page, expiration de l’aperçu ou changement du salon configuré. Cette action lit uniquement Discord et utilise le salon immuable du reçu ; elle n’envoie jamais un nouveau message.

Une annonce tient dans un embed de 4 096 caractères maximum, avec sa référence en pied de message. Le texte Markdown est conservé exactement. Les mentions sont désactivées ; aucune diffusion vers les serveurs abonnés au salon d’annonces (« crosspost ») n’est déclenchée.

Une référence de 1 à 80 caractères (`A-Z`, `a-z`, chiffres, point, tiret, underscore) désigne un contenu et une destination immuables. Le reçu est créé avant le premier envoi et empêche deux publications concurrentes. Un refus explicite peut être réessayé manuellement ; une réponse perdue reste `uncertain` et n’est jamais renvoyée. Une vérification recherche le même bot, la référence et l’empreinte du texte parmi les 100 derniers messages du salon. L’absence d’un résultat ne prouve pas l’absence de livraison : conserver le reçu et vérifier Discord, sans créer une nouvelle référence pour contourner cet état. Un aperçu signé expiré ne permet que cette vérification d’une tentative déjà enregistrée, jamais une nouvelle émission.

Les tests utilisent PostgreSQL local (PGlite) et un transport Discord simulé. Ils ne publient aucun message réel et ne constituent pas une preuve de disponibilité en production.

Validation locale du 24 septembre 2026 : TypeScript et build Vite réussis ; 105 suites et 1 823 tests réussis, avec deux workers et une limite de 30 secondes par test pour les moteurs PostgreSQL locaux. Le parcours de choix du salon, aperçu et confirmation a été contrôlé dans le navigateur avec un transport simulé à 1 440 et 360 px, sans débordement horizontal ni appel Discord réel.
