# Cohérence des textes NXT5 — 29 septembre 2026

Lot réalisé pour relecture par Claude. Les consignes du checkout, celles de `/Users/sachadegouzon/Documents/Codex/AGENTS.md` et la charte canonique ont été consultées en lecture seule. Aucun commit, push, installation de dépendances, changement visuel ou modification de logique d’accès.

## Points traités

1. **Découverte et bot Discord.** Le compte, la page Fonctionnalités et les deux documents de préparation distinguent la gratuité actuelle de la future exclusion du bot de Découverte. Toutes les formulations équivalentes du plan de financement sont alignées sur la décision du 22 septembre 2026 (PR #54), y compris les tableaux, parcours, critères de recette et décision finale. Le bot reste réservé au Pass Équipe au lancement. La documentation distingue cette décision de la règle générale déjà préparée dans `pass-access.js`, sans modifier cette règle.
2. **Tarifs en préparation.** La confidentialité décrit explicitement la page `/tarifs` et son formulaire comme réservés à l’administrateur. Les champs, finalités et conservation des demandes restent décrits. Les cookies distinguent les événements commerciaux prévus de la mesure actuelle et rappellent l’exclusion de l’administrateur.
3. **Traitements personnels.** Ajout de quatre descriptions fondées sur les migrations et fonctions existantes : liaison personnelle Discord, carnets de matchups, exports de groupes et annonces communautaires. Chaque description indique les données, finalités, accès, conservation observée et moyens de demander un effacement. La liaison du bot est distinguée de la connexion OAuth Discord. La déliaison utilise les boutons réellement disponibles dans NXT5 ; aucune commande de déliaison obsolète n’est annoncée.
4. **Documents légaux.** Suppression des dates dans les titres de section, clôtures remises en dernière position, version `2026-09-29` et libellé « 29 septembre 2026 ». L’entrée « Durées de conservation » et les trois lignes précédentes et suivantes sont strictement identiques à HEAD, comparaison automatique effectuée.
5. **Règlement.** Tutoiement harmonisé : « N’ajoute », « N’importe », « Ne publie », « Indique ». Accord corrigé pour « Un débrief sportif doit rester factuel, proportionné… ».
6. **Connexions externes.** La description de SocialAccounts utilise les fournisseurs activés déjà reçus par le composant. La récupération du mot de passe parle de « toutes tes connexions externes associées », ce qui décrit aussi les associations devenues indisponibles. La politique ne présente plus Riot comme une connexion actuellement proposée. Aucun fournisseur ni parcours technique n’est retiré.
7. **Manifest.** Description identique à celle de l’accueil, sans « premium » ni « semi-pro », langue `fr`, icônes PNG existantes de 192 et 512 pixels. Les couleurs du manifest sont conservées.
8. **SEO.** La description de `/reseaux` cite Discord et YouTube. `Organization.sameAs` réutilise les destinations officielles définies en dur par `getSocialLinks({})`. La constante Discord est définie dans `social-links.js` et réexportée sans changement de valeur depuis `constants.jsx`, pour que les outils SEO Node puissent importer les métadonnées sans charger de JSX. Les tests vérifient les liens structurés, leur présence sur la page, la description du manifest et les dimensions réelles des icônes.
9. **Formulations provisoires.** YouTube est présenté comme la chaîne officielle existante. L’état vide des réseaux décrit l’absence de liens sur la page sans promettre une disponibilité future.
10. **Audience.** `/soutenir` rejoint la liste des chemins autorisés. Contrôle direct effectué : les paramètres et fragments sont retirés, un sous-chemin inconnu reste rejeté. Les règles de consentement restent inchangées.
11. **En-têtes.** « Se connecter » et « Mon équipe » sont retenus, car déjà majoritaires dans les en-têtes publics. Les pages légales, Réseaux et Soutenir sont alignées sur Fonctionnalités, Démo et Guides. Les liens de connexion de la page introuvable et de récupération sont également harmonisés.
12. **Vocabulaire.** « Parties » et « Débriefs » remplacent les libellés génériques Games/Review dans les fichiers ciblés, y compris les descriptions et choix du catalogue Discord historique. Les identifiants, valeurs des commandes, routes et clés sont conservés. Le vocabulaire documentaire et la description SEO du guide de débrief sont alignés.
13. **Typographie.** Vérification des apostrophes et de « e-mail » dans les textes concernés. Les formulations ajoutées emploient ’ ; l’apostrophe droite de l’ancien manifest disparaît. Les occurrences techniques `email`, les délimiteurs et les URL restent intactes. Les tests qui dépendaient des anciens textes ou de l’ancienne version légale sont adaptés ; les tests d’authentification utilisent désormais la constante partagée.

## Sources vérifiées pour la confidentialité

Fichiers consultés sans modification :

- [Schéma de liaison personnelle Discord](../database/migrations/20260922_discord_bot_identity.sql), [liaison et déliaison](../netlify/functions/_lib/discord-bot-account.ts), [endpoint du compte](../netlify/functions/discord-account.ts), [nettoyage périodique](../netlify/functions/_lib/discord-bot-schedule.ts) et [boutons de déliaison](../src/components/discord/DiscordAccount.jsx).
- [Schéma des carnets](../database/migrations/20260915_player_matchups.sql), [droits et enregistrement](../netlify/functions/player-matchups.ts) et [champs des essais](../netlify/functions/_lib/player-matchups.ts).
- [Schéma des exports de groupes](../database/migrations/20260924_discord_group_exports.sql), [envoi et suivi](../netlify/functions/_lib/discord-group-export.ts), [données du bilan](../shared/publications/group-publication.js) et [rendu de son image](../shared/publications/group-publication-canvas.js).
- [Schéma des annonces](../database/migrations/20260924_discord_community_announcements.sql), [extension aux destinations multiples](../database/migrations/20260925_discord_community_destinations.sql) et [publication des annonces](../netlify/functions/_lib/discord-community-announcements.ts).

## Points de doute et formulations arbitrées

- **Conservation des annonces communautaires :** « Aucun délai d’effacement automatique n’est actuellement prévu » décrit le code observé. Aucun délai n’a été inventé. Définir une politique et ajouter un nettoyage relèverait d’un autre lot.
- **Exports de groupes :** leurs traces persistent jusqu’à la suppression de l’équipe, même après suppression du groupe ou de la destination. Elles ne sont pas assimilées au nettoyage à 30/90 jours des publications de parties. La description du groupe et les détails individuels sont annoncés seulement lorsqu’un PNG est joint.
- **Liaison personnelle :** « éligible au nettoyage périodique une heure après son expiration » évite de promettre un effacement à la minute exacte. La liaison durable n’a pas de date d’expiration automatique. La procédure publiée est celle du site, pas l’ancienne commande `/nxt compte delier`.
- **Fournisseurs :** une liste dynamique convient à SocialAccounts, qui dispose du statut. Le texte de réinitialisation reste générique pour couvrir toutes les associations supprimées, sans annoncer Riot comme actif.
- **Retour à l’application :** « Mon équipe » est retenu pour les en-têtes ; les appels à l’action de découverte « Ouvrir mon équipe » restent des invitations contextuelles dans le corps des pages.
- **YouTube :** aucune publication de guide ni calendrier de sortie n’est affirmé ; seul le lien vers la chaîne officielle est présenté.
- **Ko-fi :** aucun compte officiel n’est configuré en dur dans `social-links.js`. Le soutien dépend de `VITE_NXT5_SUPPORT_URL`. Aucun lien Ko-fi n’est donc inventé dans `sameAs`.

## Périmètre laissé intact

Tous les points demandés sont traités dans leur périmètre. Les fonctions Netlify, migrations, fichiers partagés exclus et fichiers des autres lots restent inchangés. Les réponses rédigées directement dans les fonctions du bot et `shared/discord-help.js` peuvent encore employer l’ancien vocabulaire : elles sont explicitement hors périmètre. La mise à jour effective du catalogue de commandes sur Discord nécessitera le déploiement et l’enregistrement habituels ; aucune opération distante n’a été effectuée.

Le présent rapport est le seul document daté créé, conformément à la livraison explicitement demandée. Aucun autre document `docs/*-2026-*.md` n’est modifié.

## Vérification

**`npm run verify` : réussi, code de sortie 0.**

- TypeScript : réussi.
- Vitest : **127 fichiers, 2 241 tests réussis**, aucun échec.
- Compilation Vite : réussie.
- Prérendu SEO : **13 pages rendues et vérifiées**, page 404, routes privées non indexées, sitemap et robots validés.
- `git diff --check` et les contrôles complémentaires ci-dessous : réussis.

Pendant le prérendu, Vite affiche `Error: listen EPERM: operation not permitted 0.0.0.0:24678` : le bac à sable interdit l’ouverture de ce port de développement. Ce message ne bloque pas le prérendu ni les vérifications SEO, qui se terminent correctement ; la commande complète retourne 0. Aucun changement du serveur ou de sa configuration n’a été ajouté à ce lot.

Le premier essai a passé TypeScript puis rencontré une erreur `EPERM` : `node_modules` pointe vers des dépendances partagées hors du checkout, où Vite veut écrire ses caches. Une vue temporaire locale des mêmes dépendances, par liens symboliques, permet les écritures de cache dans le seul dossier courant, sans installation. Le lien initial a été restauré et la vue locale, ses caches et les fichiers temporaires de vérification ont été retirés après vérification.

La première exécution complète des tests a signalé deux assertions utilisant encore la version légale du 23 septembre : 2 échecs, 2 239 réussites. Ces tests ont été adaptés à `LEGAL_VERSION` avant la relance finale.

Contrôles complémentaires : `git diff --check`, liens documentaires locaux, intégrité des sept lignes autour de la conservation, clôture de chaque document légal et import direct des métadonnées par Node.

## Fichiers modifiés

- [docs/pass-feature-access.md](../docs/pass-feature-access.md)
- [docs/plan-financement.md](../docs/plan-financement.md)
- [public/manifest.webmanifest](../public/manifest.webmanifest)
- [shared/discord-command.js](../shared/discord-command.js)
- [shared/legal.js](../shared/legal.js)
- [src/__tests__/auth-security-regressions.test.ts](../src/__tests__/auth-security-regressions.test.ts)
- [src/__tests__/discord-bot-help.test.ts](../src/__tests__/discord-bot-help.test.ts)
- [src/__tests__/games-navigation.test.jsx](../src/__tests__/games-navigation.test.jsx)
- [src/__tests__/seo.test.jsx](../src/__tests__/seo.test.jsx)
- [src/__tests__/social-account-ui.test.jsx](../src/__tests__/social-account-ui.test.jsx)
- [src/__tests__/social-password-recovery.test.ts](../src/__tests__/social-password-recovery.test.ts)
- [src/__tests__/support-page.test.jsx](../src/__tests__/support-page.test.jsx)
- [src/app/audience-paths.js](../src/app/audience-paths.js)
- [src/app/constants.jsx](../src/app/constants.jsx)
- [src/app/routing.js](../src/app/routing.js)
- [src/app/social-links.js](../src/app/social-links.js)
- [src/components/account/AccountSubscription.jsx](../src/components/account/AccountSubscription.jsx)
- [src/components/account/SocialAccounts.jsx](../src/components/account/SocialAccounts.jsx)
- [src/pages/public/FeaturesPage.jsx](../src/pages/public/FeaturesPage.jsx)
- [src/pages/public/PublicPages.jsx](../src/pages/public/PublicPages.jsx)
- [src/pages/public/SocialPage.jsx](../src/pages/public/SocialPage.jsx)
- [src/pages/public/SupportPage.jsx](../src/pages/public/SupportPage.jsx)
- [src/seo/metadata.js](../src/seo/metadata.js)
- [docs/coherence-textes-2026-09-29.md](../docs/coherence-textes-2026-09-29.md)
