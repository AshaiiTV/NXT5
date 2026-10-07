# NXT5

Espace de travail des équipes et coachs League of Legends : analyse des parties, débriefs, préparation des champions et organisation des entraînements. Site public : [nxt5.org](https://nxt5.org).

La [documentation du dépôt](docs/README.md) regroupe les guides d’exploitation et l’historique des travaux.

## Stack

- React 19 + Vite + Tailwind CSS, pages publiques pré-rendues (`tools/prerender.mjs`)
- Netlify Hosting et Netlify Functions (TypeScript)
- Neon PostgreSQL, migrations versionnées dans `database/`
- Auth par cookie HttpOnly + sessions en base, connexions Google, Discord et Apple optionnelles
- Riot Match-V5 API côté serveur
- Resend pour les e-mails, OpenAI pour l’assistant intégré
- Bot Discord (commandes `/nxt` et publications d’équipe)
- NXT5 Importer, application desktop Electron dans `importer-app/`
- Vitest pour les tests

## Installation locale

Prérequis : Node 24 (`>=24.15.0 <25`) et la [CLI Netlify](https://docs.netlify.com/cli/get-started/), utilisée par `npm run dev`.

```bash
npm install
cp .env.example .env
npm run dev
```

Avant toute pull request, lancer le contrôle complet :

```bash
npm run verify
```

Il enchaîne TypeScript, les tests et le build. Les changements arrivent sur `main` uniquement par pull request.

## Sécurité

La [politique de sécurité](SECURITY.md) précise les versions maintenues, le signalement privé d’une vulnérabilité, les contrôles d’exploitation et la réponse aux incidents. Pour un signalement sensible, suivre la [page Contact](https://nxt5.org/contact) et joindre l’équipe en message privé.

Le front ne stocke aucune donnée métier en localStorage. Les données importantes passent par Neon. La clé Riot n’est jamais exposée côté navigateur.

## Déploiement Netlify

La production est publiée par Netlify à chaque fusion dans `main`. La configuration est dans `netlify.toml` (Node 24) :

```txt
Build command (production): npm run verify && node tools/audit-dependencies.mjs && npm run db:migrate
Publish directory: dist
Functions directory: netlify/functions
```

Les contrôles TypeScript, tests, build et audit des dépendances doivent réussir avant les migrations et la publication.

## Variables d’environnement Netlify

Dans Netlify : Site configuration → Environment variables. La liste complète et commentée est dans [`.env.example`](.env.example). Les principales :

```txt
DATABASE_URL=postgresql://...
RIOT_API_KEY=RGAPI-...
SESSION_SECRET=une_phrase_longue_random_64_caracteres_minimum
APP_ENV=production
RIOT_PROFILE_SYNC_MAX_MATCHES=300
PUBLIC_SITE_URL=https://nxt5.org
RESEND_API_KEY=re_...
RESET_EMAIL_FROM=NXT5 <noreply@ton-domaine.fr>
```

`DATABASE_URL` vient de Neon et doit être disponible pour les fonctions. Pour les migrations, donne accès au contexte **production / Builds** à `MIGRATION_DATABASE_URL` (ou à `DATABASE_URL` en son absence). Ne partage pas les identifiants de production avec les Deploy Previews.
`RIOT_PROFILE_SYNC_MAX_MATCHES` est optionnel. Il limite le nombre de matchs scannés par profil quand le bouton « Analyser profils » recalcule les champions joués sur la saison courante.
`PUBLIC_SITE_URL` est facultative ; si elle est définie, elle doit valoir exactement `https://nxt5.org`, sinon le build échoue pour ne pas publier de mauvaise URL canonique.
`RESEND_API_KEY` et `RESET_EMAIL_FROM` servent à envoyer les e-mails de mot de passe oublié. Le domaine utilisé dans `RESET_EMAIL_FROM` doit être validé dans Resend.

## Neon

Après `npm ci`, initialise ou mets à jour une base avec la connexion appropriée dans l’environnement :

```txt
npm run db:migrate
```

Cette commande applique le schéma et les migrations versionnées dans une transaction avec verrou PostgreSQL. Elle s’exécute automatiquement avant la publication Netlify en production. Les fonctions ne modifient plus le schéma pendant une requête. Voir [le guide des migrations](database/MIGRATIONS.md).

Pour créer un compte, les fonctions Netlify doivent recevoir `DATABASE_URL` et `npm run db:migrate` doit avoir réussi sur cette base. Sans le marqueur de migration attendu, les fonctions répondent temporairement 503.

Le déploiement de production effectue aussi la [réécriture unique des reviews historiques](docs/review-backfill.md), avec sauvegarde des anciennes versions et conservation des notes.

## Présentation publique et référencement

L’accueil et la page `/fonctionnalites` présentent les usages de NXT5. L’[audit SEO du 24 septembre 2026](docs/audit-seo-2026-09-24.md) documente l’état initial et le plan de suivi de l’acquisition. Les [consignes de maintenance SEO](docs/seo.md) précisent le pré-rendu, les métadonnées et les vérifications avant publication.

## Test rapide du suivi d’équipe

1. Crée un compte et vérifie ton adresse e-mail.
2. Dans **Équipe**, crée ou rejoins une équipe.
3. Ajoute un joueur avec son Riot ID exact, par exemple `Pseudo#EUW`.
4. Exporte une partie de ce joueur avec NXT5 Importer, puis dans **Parties**, choisis **Importer une partie** et charge le fichier JSON.
5. Ouvre la partie, puis consulte **Débriefs**, **Analyses** et **Draft**.

## Application NXT5 Importer

Le dossier `importer-app` contient l’application desktop **NXT5 Importer 0.3.5** pour Windows, Mac Intel et Mac Apple Silicon.

1. Lance le `.exe` Windows ou ouvre `NXT5 Importer.app` après extraction du zip Mac adapté à ton processeur.
2. Colle le numéro de la partie ou un ID complet comme `EUW1_7861632138`. Vérifie la région.
3. Clique sur **Exporter la game**, suis la progression et choisis l’emplacement du fichier.
4. Dans NXT5, ouvre **Parties → Importer une partie** et charge le JSON pour l’ajouter à ton équipe.

L’application vérifie d’abord les données auprès de NXT5/Riot puis essaie le client League of Legends local. Pour cette seconde méthode, ouvrez le client et son historique. Sous Windows, une installation sur un autre disque est retrouvée grâce aux informations du Riot Client ; sinon, choisissez le dossier du jeu dans **Paramètres**. Les champions reçoivent le même nom que dans les parties récupérées auprès de Riot, y compris hors ligne grâce au catalogue du client. Les identifiants complets fonctionnent aussi avec le client local, et la région sélectionnée est respectée.

Les 30 derniers exports sont accessibles dans **Exports récents** : recherche, affichage dans Finder/Explorateur et réexport. Le récapitulatif précise la présence de la timeline ; son absence n’empêche pas l’export du match. Les fichiers sont enregistrés atomiquement et restent sur cet appareil jusqu’à leur import manuel dans NXT5. L’application nécessite un match de deux équipes de cinq joueurs, conformément au format du site.

Raccourcis : `Ctrl/⌘ + Entrée` pour exporter, `Ctrl/⌘ + 1`, `2`, `3` pour changer de vue.

Les mises à jour sont proposées pour l’architecture de l’appareil. Les liens du site suivent la dernière version publiée ; une version demandée explicitement n’est jamais remplacée par une autre.

À chaque pull request touchant `importer-app`, GitHub Actions exécute les tests puis compile Windows et les deux aperçus Mac. La publication de la release est réservée à `main`, après réussite des tests web et des builds desktop. Les archives Mac de release doivent être signées avec Developer ID, notarisées et acceptées par Gatekeeper après extraction du ZIP final. Configurer les accès Apple suivant [la procédure de signature macOS](importer-app/docs/macos-signing.md) avant d'activer cette publication.

```sh
cd importer-app
pnpm install --frozen-lockfile
pnpm test
pnpm start
# Packaging : pnpm dist:win / pnpm dist:mac / pnpm dist:mac:arm
# Aperçus Mac sans compte Apple : pnpm dist:mac:preview
```

La fenêtre d’enregistrement reprend le dossier du dernier export réussi, même après réouverture de l’application. Si ce dossier n’existe plus, elle revient dans Téléchargements.

Voir [les changements de l’Importer](importer-app/CHANGELOG.md) et [la validation Electron](importer-app/docs/testing.md).

## Commandes du bot Discord

Le bot propose cinq commandes visibles : `/nxt help`, `/nxt lier`, `/nxt profil`, `/nxt voir` et `/nxt connecter`. Après la liaison personnelle Discord–NXT5, l’équipe est reconnue grâce au salon de commandes qui lui est réservé ; `/nxt voir` rassemble les consultations courantes. Le [guide de développement et d’activation](docs/discord-bot-commandes.md) décrit les droits, les rappels/bilans planifiés et l’ordre déploiement serveur → enregistrement de la commande Discord. Les contrôles locaux n’attestent pas un enregistrement ou un envoi réel.

Le responsable commence par `/nxt lier` avant `/nxt connecter` et génère le code avec ce même compte NXT5. `/nxt connecter` exige d’être propriétaire ou capitaine de l’équipe visée et de disposer de **Gérer le serveur** ou **Administrateur** dans Discord. Chaque équipe configure son propre salon de commandes et, si nécessaire, les rôles Discord autorisés. Partager un serveur Discord ne donne aucun accès aux autres équipes NXT5.

## Offres et abonnements (en préparation)

**Les abonnements ne sont pas lancés : aucune fonction n’est bloquée aujourd’hui.** `/tarifs` et `/admin/demandes-acces` sont des prévisualisations réservées à l’administrateur plateforme, sans lien public ni paiement.

La proposition de lancement comporte deux formules pour une équipe de 15 membres maximum : **Découverte**, 14 jours d’accès complet sans carte bancaire, puis **Pass Équipe** à 9,90 € TTC/mois/équipe, résiliable à tout moment. Le bot Discord est réservé au Pass Équipe (décision du 22 septembre 2026). L’administrateur peut attribuer manuellement l’une des deux formules à un profil depuis `/admin/abonnements`, sans effet sur les accès avant le lancement.

Détails : [validation commerciale](docs/validation-commerciale.md), [périmètre des fonctions Pass](docs/pass-feature-access.md), [abonnements manuels](docs/abonnements-manuels.md) et [plan de financement](docs/plan-financement.md).

## Statistiques de fréquentation et cookies

L’administrateur de plateforme dispose de **Administration → Fréquentation du site** (`/admin/frequentation`) : périodes 7/30/90 jours, comparaison, acquisition, campagnes, pages, engagement, conversions, appareils, pays, carte horaire et export CSV. La collecte interne reste désactivée sans consentement, et « Gérer mes cookies » dans le pied de page permet de modifier ou retirer son choix. Le bandeau et le bouton flottant disparaissent une fois le choix enregistré. Les données sont pseudonymisées et distinctes des comptes et des équipes.

Avant la mise en ligne, appliquer la migration `audience-20260914-v1` via le flux habituel `npm run db:migrate`, puis déployer le front et les fonctions ensemble. Aucun nouveau secret ni service tiers n’est requis. Voir [le contrat, les durées et les consignes d’exploitation](docs/audience-api.md). Les chiffres démarrent avec les premières visites consenties ; les visites antérieures ne sont pas reconstituées.
