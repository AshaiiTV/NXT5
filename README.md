# NXT5

Espace de travail des équipes et coachs League of Legends : import et lecture des parties, débriefs, préparation des champions et des drafts, planning et scrims. Site public : [nxt5.org](https://nxt5.org). Le service est gratuit ; un [soutien facultatif](docs/soutenir-nxt5.md) passe par Ko-fi.

- [Documentation du dépôt](docs/README.md) : guides par thème et index chronologique des rapports.
- [Charte graphique unique NXT5](docs/charte-graphique.md) : identité Prisme du site et de l’Importer, à consulter avant tout travail visuel ([`AGENTS.md`](AGENTS.md)).

## Par où commencer

1. Lire [`AGENTS.md`](AGENTS.md) : règles permanentes du projet (charte, vérifications, traçabilité).
2. Installer le projet (section suivante) et lancer `npm run verify` une première fois.
3. Repérer la zone concernée dans la [carte du dépôt](#carte-du-dépôt), puis le guide correspondant dans le [sommaire de la documentation](docs/README.md).
4. Pour l’historique d’un chantier, chercher son rapport dans l’[index des rapports](docs/README.md#rapports-datés) : les guides décrivent l’état actuel, les rapports l’état à leur date.
5. Livrer par pull request vers `main`, après `npm run verify` ; documenter un travail notable dans `docs/rapports/<sujet>-AAAA-MM-JJ.md`.

## Installation locale

Prérequis : Node 24 (`>=24.15.0 <25`, voir `package.json`) et la [CLI Netlify](https://docs.netlify.com/cli/get-started/), utilisée par `npm run dev`.

```bash
npm ci
cp .env.example .env
```

Renseigner dans `.env` la connexion d’une base de développement dédiée (`DATABASE_URL`) et un `SESSION_SECRET` aléatoire d’au moins 64 caractères ; remplacer toutes les valeurs d’exemple. Initialiser ensuite la base, puis lancer le site et ses fonctions :

```bash
node --env-file=.env tools/migrate.mjs
npm run dev
```

## Scripts npm

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Site et fonctions en local (`netlify dev`). |
| `npm run verify` | Contrôle complet avant toute pull request : traductions (`i18n:check`), TypeScript (`typecheck`), tests Vitest (`test`) puis `build`. |
| `npm run build` | Build Vite puis pré-rendu des pages publiques (`tools/prerender.mjs`). |
| `npm run build:preview` | Build destiné aux prévisualisations (`tools/build-preview.mjs`). |
| `npm run test:layout` | Mesures Playwright de l’effectif et des panneaux partagés de 320 à 1 920 px (Chromium requis : `npx playwright install chromium`). |
| `npm run test:framing` | Contrôle Playwright des cadrages de l’interface. |
| `npm run db:migrate` | Schéma et migrations versionnées de `database/` ([guide](database/MIGRATIONS.md)). |
| `npm run discord:commands` | Enregistre la commande `/nxt` auprès de Discord ([guide](docs/discord-bot-commandes.md)). |
| `npm run discord:check-bundle` | Vérifie le paquet des fonctions du bot. |
| `npm run bench:history` | Banc local du chargement des historiques ([guide](tools/bench-history/README.md)). |
| `npm run optimize:assets` | Optimisation des images servies. |
| `npm run prototype:drafter` | Prototype local d’import Drafter. |

## Carte du dépôt

| Dossier | Contenu |
| --- | --- |
| `src/` | Application React. `AppRouter.jsx` choisit la page ; routes et navigation dans `src/app/` (`constants.jsx`, `routing.js`, `admin-navigation.js`). Pages dans `src/pages/` (`public/`, `workspace/`, `admin/`, `nexus/`, `home/`), composants dans `src/components/`, traductions dans `src/i18n/`, métadonnées SEO dans `src/seo/`, tests dans `src/__tests__/`. |
| `netlify/functions/` | API serveur (TypeScript), une fonction par point d’entrée, tâches planifiées comprises ; code commun dans `_lib/`. |
| `shared/` | Code commun au navigateur, aux fonctions et aux outils : champions, Riot ID, rôles, commandes Discord, rendu des [publications](shared/publications/README.md). |
| `database/` | `schema.sql`, migrations datées et [guide des migrations](database/MIGRATIONS.md). |
| `tools/` | Scripts de build, pré-rendu, SEO, migrations, audit des dépendances, enregistrement Discord et contrôles Playwright. |
| `public/` | Fichiers statiques servis tels quels (icônes, logos sous `assets/`, manifeste). |
| `importer-app/` | Application desktop Electron **NXT5 Importer** ; toute fusion qui la modifie publie une release. |
| `docs/` | Guides tenus à jour, charte graphique et rapports datés (`docs/rapports/`). |
| `artifacts/` | Preuves (captures, relevés) citées par les rapports ; les nouvelles sorties de travail y sont ignorées par Git sauf ajout explicite. |
| `.github/` | Intégration continue (`web-ci.yml`, `build-importer.yml`) et Dependabot. |

## Stack

- React 19, Vite 8, Tailwind CSS 4 ; pages publiques pré-rendues ; three.js et GSAP pour la scène 3D du 5.
- Netlify Hosting et Netlify Functions (TypeScript, esbuild), tâches planifiées Netlify.
- Neon PostgreSQL ; migrations versionnées dans `database/`.
- Authentification par cookie HttpOnly et sessions en base ; connexions Google, Discord, Apple et Riot Sign On optionnelles, désactivées par défaut.
- Riot Match-V5 côté serveur uniquement ; Resend pour les e-mails ; modèle OpenAI via Netlify AI Gateway pour l’assistant intégré, avec repli sur une aide locale.
- Bot Discord (`/nxt` et publications d’équipe) ; NXT5 Importer (Electron) dans `importer-app/`.
- Vitest pour les tests, Playwright pour les contrôles de mise en page.

## Ce que propose le site

**Pages publiques** : accueil, `/fonctionnalites`, démonstration sans compte (`/demo` et ses vues), guides du [premier import](https://nxt5.org/guides/importer-premier-scrim) et du [premier débrief](https://nxt5.org/guides/preparer-debrief), `/reseaux`, `/soutenir`, pages légales et `/contact`, salle de draft invitée (`/salle-de-draft`) et portail Nexus Rising (`/nexus-rising`). Connexion à `/connexion`, inscription à `/creer-un-compte`. Interface en français, anglais et espagnol ([guide](docs/internationalisation.md)).

**Espace équipe** (connecté) :

- **Accueil** (`/accueil`), **Mon équipe** (`/mon-equipe`, effectif et invitations) et **Gestion équipe** (`/gestion-equipe`).
- **Parties** (`/games`) : liste des parties, groupes et fiches des équipes adverses (`/games?view=teams`) ; **Importer une partie** depuis un fichier de NXT5 Importer, avec la liaison de l’[import automatique](docs/import-automatique.md). Chaque partie s’ouvre sur un résumé avec débrief automatique ; les notes d’équipe sont à `/notes`.
- **Analyses** (`/tendances`), **Planning** (`/planning`), **[Scrims](docs/scrims.md)** entre équipes (`/scrims`).
- **Draft & Pool** (`/draft/pool`, `/draft/compositions`, `/draft/salle`) : champions des joueurs, compositions avec [aide au choix](docs/draft-assistance.md), salle de draft.
- **Mon profil** (`/mon-profil`) : synthèse, champions joués et [carnets de matchups](docs/carnets-matchups.md), champion pool, historique, objectifs et notes de suivi.
- **Bot Discord** (`/bot-discord`), **Paramètres** (`/parametres`, dont la suppression du compte), **Guide d’utilisation** (`/guide`) et [assistant NXT5](docs/assistant/README.md).

**Administration** (administrateur de plateforme, `/admin`) : vue d’ensemble, comptes et profils, équipes, statistiques globales, usage, [fréquentation](docs/audience-api.md), publications et statistiques du bot, journal, exports, rappels e-mail et intégrations ([guide](docs/administration-achats.md)).

## Déploiement Netlify

La production est publiée par Netlify à chaque fusion dans `main` ; les changements y arrivent uniquement par pull request. Configuration dans `netlify.toml` (Node 24) :

```txt
Build (production) : npm run verify && node tools/audit-dependencies.mjs && npm run db:migrate
Build (autres contextes) : npm run verify && node tools/audit-dependencies.mjs
Publish directory : dist
Functions directory : netlify/functions
```

Les migrations ne s’exécutent qu’en production, après réussite des contrôles. Le déploiement de production effectue aussi la [réécriture unique des reviews historiques](docs/review-backfill.md). Les fonctions planifiées (nettoyages nocturnes, rappels d’inactivité, file et réconciliation du bot Discord) déclarent leur horaire dans leur propre fichier.

## Variables d’environnement

Dans Netlify : Site configuration → Environment variables. La liste complète et commentée est dans [`.env.example`](.env.example) ; les intégrations ont leur guide dans [la documentation](docs/README.md). Aucun secret ne porte le préfixe `VITE_`.

| Domaine | Variables |
| --- | --- |
| Base et sessions | `DATABASE_URL`, `MIGRATION_DATABASE_URL` (facultative, contexte production / Builds), `SESSION_SECRET` (64 caractères minimum), `APP_ENV`, `PUBLIC_SITE_URL` (facultative ; si définie, exactement `https://nxt5.org`, sinon le build échoue) |
| Riot | `RIOT_API_KEY`, `RIOT_EXPORT_HOURLY_LIMIT` (appels par heure de l’export public, 1 500 par défaut), `RIOT_PROFILE_SYNC_MAX_MATCHES` (80 au plus), `RIOT_RSO_*` ([configuration](docs/social-provider-configuration.md)) |
| E-mails | `RESEND_API_KEY`, `RESET_EMAIL_FROM` (domaine validé dans Resend) ; réponses vers `contact@nxt5.org` (`shared/legal.js`) |
| Administration | `PLATFORM_ADMIN_USER_ID`, `PLATFORM_ADMIN_EMAIL` |
| Discord | `DISCORD_PUBLISHING_ENABLED`, `DISCORD_ENVIRONMENT`, `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_WORKER_SECRET`, `DISCORD_COMMUNITY_GUILD_ID`, `DISCORD_LOCAL_PILOT` ([exploitation](docs/discord-operations.md)) |
| Connexions externes | `SOCIAL_AUTH_SITE_ORIGIN`, `GOOGLE_AUTH_*`, `DISCORD_AUTH_*`, `APPLE_AUTH_*` ([guide](docs/social-auth.md)) |
| Assistant | `NXT5_ASSISTANT_DAILY_USER_LIMIT`, `NXT5_ASSISTANT_DAILY_TOTAL_LIMIT` ; autres options serveur dans le [guide de l’assistant](docs/assistant/README.md) |
| Soutien | `VITE_NXT5_SUPPORT_URL` (URL publique Ko-fi, définie dans `netlify.toml`) |

Ne pas partager les identifiants de production avec les Deploy Previews.

## Base Neon

`npm run db:migrate` applique le schéma et les migrations versionnées dans une transaction, sous verrou PostgreSQL ; la commande s’exécute automatiquement avant la publication de production. Les fonctions ne modifient pas le schéma pendant une requête : sans le marqueur de migration attendu, elles répondent temporairement 503. Voir [le guide des migrations](database/MIGRATIONS.md).

## NXT5 Importer

Le dossier `importer-app/` contient **NXT5 Importer 0.4.9** pour Windows, Mac Intel et Mac Apple Silicon ([changements](importer-app/CHANGELOG.md), [validation Electron](importer-app/docs/testing.md)).

- **Exporter** : saisir le numéro de la partie ou un identifiant complet (`EUW1_7861632138`), puis enregistrer le fichier JSON. L’application interroge d’abord NXT5/Riot, puis le client League of Legends local. Dans NXT5, **Parties → Importer une partie** charge ce fichier, fait confirmer côté, postes et joueurs, puis l’ajoute à l’équipe.
- **Collecte automatique** : liée à une équipe par un code à usage unique généré dans NXT5, elle envoie seule chaque partie personnalisée observée dans le client ; les autres parties restent sur l’ordinateur ([guide](docs/import-automatique.md)).
- **Historique** des 30 derniers exports et **Paramètres** (dossier du jeu, mises à jour par architecture).

Une pull request touchant `importer-app/` lance les tests et les trois builds dans GitHub Actions ; la release n’est publiée que depuis `main`.

```sh
cd importer-app
pnpm install --frozen-lockfile   # version de pnpm déclarée dans importer-app/package.json
pnpm test
pnpm start
# Packaging : pnpm dist:win / pnpm dist:mac / pnpm dist:mac:arm
```

## Bot Discord

Le bot propose cinq commandes : `/nxt help`, `/nxt lier`, `/nxt profil`, `/nxt voir` et `/nxt connecter` (catalogue dans `shared/discord-command.js`). Après la liaison personnelle Discord–NXT5, l’équipe est reconnue par le salon de commandes qui lui est réservé ; `/nxt voir` rassemble les consultations courantes. `/nxt connecter` exige d’être propriétaire ou capitaine de l’équipe et de disposer de **Gérer le serveur** ou **Administrateur** dans Discord. Partager un serveur Discord ne donne aucun accès aux autres équipes. Voir [les commandes](docs/discord-bot-commandes.md) et [l’installation et l’exploitation](docs/discord-operations.md) ; les contrôles locaux n’attestent ni un enregistrement ni un envoi réel.

## Sécurité

La [politique de sécurité](SECURITY.md) précise les versions maintenues, le signalement privé d’une vulnérabilité, les contrôles d’exploitation et la réponse aux incidents. Pour un signalement sensible, suivre la [page Contact](https://nxt5.org/contact) et joindre l’équipe en message privé.

Le front ne stocke aucune donnée métier en localStorage : les données passent par Neon. La clé Riot n’est jamais exposée côté navigateur. La mesure de fréquentation est interne, sans service tiers, et reste désactivée sans consentement ([guide](docs/audience-api.md)).

## Licence

Code consultable publiquement, tous droits réservés. Aucune réutilisation, copie ou redistribution n’est autorisée sans accord écrit préalable. Voir [LICENSE](LICENSE).
