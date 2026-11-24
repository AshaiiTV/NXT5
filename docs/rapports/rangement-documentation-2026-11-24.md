# Rangement de la documentation — 24 novembre 2026

Remise à jour de la documentation du dépôt pour qu’elle décrive le site de `main` au 24 novembre 2026. Aucun fichier de code, de configuration, de migration ni de `importer-app/` n’est modifié ; le contenu de la [charte graphique](../charte-graphique.md) est inchangé et le fichier reste à son emplacement.

## Changements

- **README principal** réécrit et vérifié dans le code : prérequis Node 24, scripts réels de `package.json`, variables regroupées d’après `.env.example`, commandes de build de `netlify.toml`, pages et routes issues de `src/app/` et `src/AppRouter.jsx`, NXT5 Importer 0.4.9, cinq commandes `/nxt` de `shared/discord-command.js`. Ajout d’un « par où commencer » et d’une carte des dossiers racine. Retrait des passages devenus redondants ou inexacts (version 0.4.6 de l’Importer, raccourcis et détails déjà portés par les guides).
- **Rapports datés** : 66 rapports déplacés de `docs/` vers `docs/rapports/` avec `git mv`. Tous les liens qui les citent ont été réécrits (`AGENTS.md`, `SECURITY.md`, `docs/README.md`, `docs/assistant/README.md`, liens croisés entre rapports) ainsi que les liens relatifs internes des rapports déplacés (`../` supplémentaire vers `src/`, `artifacts/`, `docs/assets/`…).
- **Rapports laissés dans `docs/`** (7), parce qu’un chemin `docs/<fichier>` est cité ailleurs : `suppression-compte-2026-11-24.md` (commentaires de `src/` et migration SQL), `performance-requetes-2026-11-23.md` et `securite-comptes-2026-11-23.md` (migrations SQL), `discord-dashboard-2026-09-21.md`, `discord-qa-2026-09-15.md`, `clarte-pages-restantes-2026-09-24.md` et `design-all-pages-2026-09-23.md` (charte graphique). Ils sont marqués † dans l’index.
- **Sommaire `docs/README.md`** : guides classés par thème, archives commerciales regroupées, index chronologique de tous les rapports (75 lignes, plus récent en haut).
- **Guides vérifiés dans le code** et corrigés au besoin : bot Discord (commandes, sujets de `/nxt voir`, bouton « Exporter sur Discord »), administration, connexions externes, soutien et Ko-fi, SEO, scrims, import automatique, Nexus Rising, Drafter, assistant (onglets Résumé et Notes, `/rapports` → `/notes`, champions hors pool), internationalisation, carnets de matchups. `audience-api.md`, `discord-community-announcements.md`, `chargement-historique.md` et `draft-assistance.md` étaient exacts.
- **Marqués historiques** : `plan-financement.md` et la section « Lecture visuelle des débriefs » de `review-backfill.md` (la page « En 10 secondes » n’est plus servie).
- **CHANGELOG** : nouvelle section « Novembre 2026 » résumant les fusions de #236 à #321.
- **Règle de traçabilité** ajoutée à `AGENTS.md` : nouveaux rapports dans `docs/rapports/<sujet>-AAAA-MM-JJ.md`.
- **Liens cassés préexistants corrigés** : `social-auth.md` pointait vers un rapport de suppression de compte inexistant ; trois liens de rapports vers des fichiers de code supprimés sont devenus du texte.

## Vérifications

- Contrôle de tous les liens Markdown relatifs du dépôt (hors `node_modules` et `importer-app/`) : aucun lien cassé.
- `npm ci`, puis `npm run verify`.

## Points ouverts

- `CLAUDE.md` n’est pas versionné (exclu localement) : sa règle de traçabilité est à mettre à jour hors dépôt.
- `src/pages/workspace/GameWorkspace.jsx` mentionne encore la commande retirée `/nxt review partager` ; les composants `Reports` et `VisualDebrief` ne sont plus montés. Relève du nettoyage du code.
- `administration-achats.md` ne traite plus d’achats ; un renommage demanderait de mettre à jour ses liens entrants.
