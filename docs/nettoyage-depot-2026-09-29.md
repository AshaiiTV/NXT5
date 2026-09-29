# Nettoyage du dépôt — 29 septembre 2026

Premier lot de l’audit de nettoyage : fichiers obsolètes, documentation d’entrée et configuration Dependabot. Aucun comportement du site ni de l’Importer n’est modifié.

## Retiré

| Fichier | Raison |
| --- | --- |
| `DEPLOY_NO_GIT_WINDOWS.bat`, `INIT_GIT_WINDOWS.bat` | Déploiement manuel depuis un poste Windows (`netlify deploy --prod`), remplacé par les PR GitHub et le build Netlify. |
| `README_GIT.md`, `README_DEPLOY_SANS_GIT.md` | Procédures de mise en place initiale devenues fausses (anciens noms d’onglets, chemin local d’un poste). |
| `tools/nxt5-importer.mjs` et les scripts `local-importer` / `local-import-export` | Ancien exportateur HTTP local qui demandait une clé Riot, remplacé par NXT5 Importer. |
| `public/og-image.png` | Remplacée par `public/og-nxt5.png` (`src/seo/metadata.js`). |
| `public/favicon.png`, `public/favicon-512x512.png` | Copies identiques d’`android-chrome-512x512.png`, référencées nulle part. |
| `importer-app/assets/nxt5-logo.png`, `importer-app/assets/nxt5-wordmark.png` | Référencés nulle part, mais embarqués dans chaque build Electron (`assets/**/*`), soit environ 2 Mo. |

## Mis à jour

- `README.md` : lien vers nxt5.org, stack complète, prérequis Node 24 et CLI Netlify, commande de build identique à `netlify.toml`, `PUBLIC_SITE_URL=https://nxt5.org` (l’ancien exemple faisait échouer le build), noms de menus actuels, Riot ID d’exemple fictif, section des offres condensée et bot Discord réservé au Pass Équipe (décision du 22 septembre 2026).
- `.env.example` : `PUBLIC_SITE_URL=https://nxt5.org`.
- `docs/README.md` : nouveau sommaire des guides et des rapports datés.
- `docs/seo.md` : nombre de pages publiques (treize, et non dix).
- `CHANGELOG.md` : indique qu’il n’est plus tenu depuis juin 2026 et renvoie aux PR et aux rapports.
- `.github/dependabot.yml` : mises à jour mineures et correctives regroupées par écosystème ; react, react-dom et react-test-renderer toujours proposés ensemble.

## Conservé volontairement

- `artifacts/` : captures et relevés cités comme preuves par les rapports datés. Les retirer casserait ces liens sans réduire la taille de l’historique Git.
- `public/assets/objectives/herald.png` : non référencé, mais c’est l’icône locale de secours absente de la liste du Héraut dans `GameWorkspace.jsx`, contrairement aux autres objectifs. À rebrancher plutôt qu’à supprimer.
- `public/android-chrome-192x192.png` et `-512x512.png` : à déclarer dans le manifest (lot « cohérence des textes »).
- `importer-app/assets/nxt5-mark.png` : dessin complet propre à l’Importer, distinct du symbole web abandonné.
- Double vérification web dans `build-importer.yml` : elle conditionne la publication des versions de l’Importer.
- Rapports datés : laissés à leur place pour ne pas casser leurs liens ; le sommaire les rend accessibles.

## Vérification

`npm run verify` : voir la description de la pull request.
