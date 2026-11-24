# Rangement des guides et des sorties de travail — 24 novembre 2026

Reprise sur `main` de la [PR #121](https://github.com/AshaiiTV/NXT5/pull/121) (« Isoler les sorties de travail et actualiser les guides NXT5 »), restée en conflit avec environ 74 commits de retard. Seule la documentation, les exemples de configuration, les exclusions Git et la destination locale du banc d’historique changent ; aucune source du site ou de l’Importer n’est modifiée.

## Repris

- `.gitignore` : les nouveaux fichiers de `artifacts/`, `tmp/` et `output/` à la racine sont ignorés. Les fichiers déjà versionnés, dont les preuves de `artifacts/discord-render/` et `artifacts/admin-redesign/`, restent suivis ; une nouvelle preuve citée par un rapport s’ajoute avec `git add -f`.
- Banc `bench:history` : il écrit `artifacts/bench-history/results.json` au lieu d’un fichier daté de `docs/bench-history/`, et dispose d’un [guide](../../tools/bench-history/README.md).
- `.env.example` : `MIGRATION_DATABASE_URL` et `RIOT_PROFILE_SYNC_MAX_MATCHES` (plafond de 80, `shared/riot-sync-policy.js`).
- `README.md` : installation par `npm ci`, initialisation de la base, plafond de 80 matchs, liens vers la démonstration et les guides publics, étape de rattachement des joueurs lors de l’import.
- `SECURITY.md` : audit des dépendances sans exception, règles de journalisation `logFailure`, reprise des rappels d’inactivité.
- `database/MIGRATIONS.md` : commande de build Netlify avec l’audit des dépendances et rappel sur `20261006_riot_sync.sql`.
- Guides de l’assistant (budgets quotidiens et variables), du bot (statistiques `/admin/bot-discord`, sorties du banc de rendu), du référencement, des connexions externes, du soutien Ko-fi et du rendu des publications.

## Adapté au `main` actuel

- Fréquentation : `main` a retiré la vente ; le serveur n’accepte plus que `signup`, `login`, `first_import` et `first_review`, et la conversion repose sur l’inscription seule. Le guide est aligné sur ce code, et non sur la version de la PR.
- Connexions externes : la suite `pricing-routing.test.jsx` n’existe plus et sort de la commande de vérification.
- `docs/chargement-historique.md` : `main` a réécrit ce guide (historique complet à l’ouverture) ; il est conservé tel quel. Le guide du banc ne reprend pas l’affirmation de la PR sur l’absence de pagination automatique.

## Abandonné

- Le rapport `docs/nettoyage-depot-2026-10-29.md` de la PR : il décrivait un nettoyage de branches et des vérifications propres à la branche de Codex, non reproduits ici.

## Vérifications

- `npm ci`, puis `npm run verify`.
- Liens internes des fichiers modifiés vérifiés.
