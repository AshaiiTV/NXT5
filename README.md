# NXT5 — Netlify + Neon

Outil de suivi LoL pour équipes et coachs.

## Stack

- React + Vite
- Tailwind CSS
- Netlify Hosting
- Netlify Functions
- Neon PostgreSQL
- Riot Match-V5 API côté serveur
- Auth par cookie HttpOnly + sessions en DB

## Installation locale

```bash
npm install
npm run dev
```

## Passage à GitHub

Lis `README_GIT.md` si tu veux connecter NXT5 à GitHub puis à Netlify.
Le dépôt est préparé pour éviter d'envoyer les secrets (`.env`, clés Riot, URL Neon).

## Déploiement Netlify

Tu peux uploader ce dossier sur Netlify ou le connecter à GitHub.

Netlify doit utiliser :

```txt
Build command (production): npm run verify && npm run db:migrate
Publish directory: dist
Functions directory: netlify/functions
```

Le fichier `netlify.toml` est déjà configuré avec Node 24. Les contrôles TypeScript, tests et build doivent réussir avant les migrations et la publication.

## Variables d'environnement Netlify

Dans Netlify : Site configuration → Environment variables.

```txt
DATABASE_URL=postgresql://...
RIOT_API_KEY=RGAPI-...
SESSION_SECRET=une_phrase_longue_random_64_caracteres_minimum
APP_ENV=production
RIOT_PROFILE_SYNC_MAX_MATCHES=300
PUBLIC_SITE_URL=https://ton-site.netlify.app
RESEND_API_KEY=re_...
RESET_EMAIL_FROM=NXT5 <noreply@ton-domaine.fr>
```

`DATABASE_URL` vient de Neon et doit être disponible pour les fonctions. Pour les migrations, donne accès au contexte **production / Builds** à `MIGRATION_DATABASE_URL` (ou à `DATABASE_URL` en son absence). Ne partage pas les identifiants de production avec les Deploy Previews.
`RIOT_PROFILE_SYNC_MAX_MATCHES` est optionnel. Il limite le nombre de matchs scannés par profil quand le bouton "Analyser profils" recalcule les champions joués sur la saison courante.
`RESEND_API_KEY` et `RESET_EMAIL_FROM` servent à envoyer les e-mails de mot de passe oublié. Le domaine utilisé dans `RESET_EMAIL_FROM` doit être validé dans Resend.

## Neon

Après `npm ci`, initialise ou mets à jour une base avec la connexion appropriée dans l'environnement :

```txt
npm run db:migrate
```

Cette commande applique le schéma et les migrations versionnées dans une transaction avec verrou PostgreSQL. Elle s'exécute automatiquement avant la publication Netlify en production. Les fonctions ne modifient plus le schéma pendant une requête. Voir [le guide des migrations](database/MIGRATIONS.md).

## Test rapide

1. Crée un compte.
2. Crée ou sélectionne une team.
3. Ajoute un joueur avec son Riot ID exact, exemple : `Ashaii#8942`.
4. Importe une game où ce joueur était présent, exemple : `EUW1_7123456789`.
5. Va dans Reviews, Champion Pool, Compos Types et Rapports.

## Import local NXT5

Si tu veux préparer un import sans coller de clé Riot dans un outil local, tu peux générer un JSON complet depuis un Game ID.

Colle un Game ID du type `EUW1_7123456789`. L'outil demande les données à NXT5 côté serveur et génère un fichier `nxt5-...json` contenant le match Riot complet. Il ne demande aucune clé Riot.

Dans NXT5 : Intégration → Importer un fichier NXT5 local → Choisir le JSON.

NXT5 importe ensuite ce JSON local sans avoir besoin de relire Riot.

## Application NXT5 Importer

Le dossier `importer-app` contient l’application desktop **NXT5 Importer 0.3.2** pour Windows, Mac Intel et Mac Apple Silicon.

1. Lancez le `.exe` Windows ou ouvrez `NXT5 Importer.app` après extraction du zip Mac adapté à votre processeur.
2. Collez le numéro de game ou un ID complet comme `EUW1_7861632138`. Vérifiez la région.
3. Cliquez sur **Exporter la game**, suivez la progression et choisissez l’emplacement du fichier.
4. Dans NXT5, ouvrez **Intégration → Importer un fichier NXT5 local** pour ajouter le JSON à votre équipe.

L’application vérifie d’abord les données auprès de NXT5/Riot puis essaie le client League of Legends local. Pour cette seconde méthode, ouvrez le client et son historique. Si le jeu est installé ailleurs, choisissez son dossier dans **Paramètres**. Les identifiants complets fonctionnent aussi avec le client local, et la région sélectionnée est respectée.

Les 30 derniers exports sont accessibles dans **Exports récents** : recherche, affichage dans Finder/Explorateur et réexport. Le récapitulatif précise la présence de la timeline ; son absence n’empêche pas l’export du match. Les fichiers sont enregistrés atomiquement et restent sur cet appareil jusqu’à leur import manuel dans NXT5. L’application nécessite un match de deux équipes de cinq joueurs, conformément au format du site.

Raccourcis : `Ctrl/⌘ + Entrée` pour exporter, `Ctrl/⌘ + 1`, `2`, `3` pour changer de vue.

Les mises à jour sont proposées pour l’architecture de l’appareil. Les liens du site suivent la dernière version publiée ; une version demandée explicitement n’est jamais remplacée par une autre.

À chaque pull request touchant `importer-app`, GitHub Actions exécute les tests puis compile les trois applications. La publication de la release est réservée à `main`, après réussite des tests web et des builds desktop.

```sh
cd importer-app
pnpm install --frozen-lockfile
pnpm test
pnpm start
# Packaging : pnpm dist:win / pnpm dist:mac / pnpm dist:mac:arm
```

Voir [les changements 0.3.2](importer-app/CHANGELOG.md) et [la validation Electron](importer-app/docs/testing.md).

## Important

Le front ne stocke aucune donnée métier en localStorage. Les données importantes passent par Neon. La clé Riot n'est jamais exposée côté navigateur.


## Connexion à la base de données

Pour créer un compte, les fonctions Netlify doivent recevoir `DATABASE_URL` et `npm run db:migrate` doit avoir réussi sur cette base. Sans le marqueur de migration attendu, les fonctions répondent temporairement 503.
