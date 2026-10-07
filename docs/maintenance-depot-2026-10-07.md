# Maintenance du dépôt — 7 octobre 2026

Revue des textes, de la documentation et des ressources suivies par Git, à partir du commit `9b14cb3` de `main`.

## Corrections

- Les opérations sur les parties, leurs notifications et les compteurs d’équipe emploient les termes « partie » et « débrief », comme la navigation. Les sélecteurs des tests existants suivent les nouveaux libellés.
- Le guide et la navigation du profil distinguent les champions déclarés des champions observés dans les parties. Le guide reste accessible par sa route et l’aide contextuelle ; le bouton retiré du menu latéral n’est pas réintroduit.
- Le README décrit une installation reproductible avec `npm ci`, l’initialisation de la base locale et le plafond réel de synchronisation Riot : 80 parties par profil. `.env.example` documente ce plafond et la connexion facultative réservée aux migrations.
- Les guides d’exploitation reprennent la commande de publication complète, les événements de fréquentation actuels, les quotas de l’assistant et les informations réellement envoyées au modèle.
- Le sommaire documentaire référence les rapports manquants et les classe du plus récent au plus ancien. Les rapports historiques restent inchangés.

## Ressources examinées

| Ensemble suivi par Git | Fichiers | Taille totale | Conclusion |
| --- | ---: | ---: | --- |
| `public/` | 34 | 3 233 045 octets | Ressources du site, secours PNG, sources d’optimisation, icônes et licences conservés. |
| `artifacts/` | 30 | 9 209 638 octets | Captures, scripts et relevés synthétiques cités par les rapports ; conservés comme preuves historiques. |
| `importer-app/assets/` | 9 | 2 037 494 octets | Ressources nécessaires au paquet Electron et licences conservées. |

Aucune suppression n’a été retenue : les recherches dans les imports, les chargements dynamiques, les configurations, les outils de génération et la documentation n’ont pas établi de ressource ou de dépendance inutilisée. Les copies de marque du site et de l’Importer servent deux distributions autonomes. Les rendus identiques `complete` et `facts-only` appartiennent à deux cas de vérification distincts.

Les pistes encore ouvertes dans le [rapport du 29 septembre](nettoyage-depot-2026-09-29.md) ont été revérifiées : le secours du Héraut est branché, les icônes Android sont déclarées dans le manifest et les deux anciennes images inutilisées de l’Importer ont déjà été retirées.

## Sorties locales exclues de Git

Les exclusions suivantes évitent de publier les fichiers de travail lors d’un ajout global :

- `/tmp/` : journaux, fixtures et captures de vérification temporaires ;
- `/output/` : exports locaux ;
- `/artifacts/discord-render/benchmark-runner.mjs` : fichier compilé par la commande de benchmark du guide Discord.

Les exclusions sont limitées à ces chemins. Les preuves déjà suivies sous `artifacts/` restent versionnées. Aucun fichier local ni artefact GitHub Actions n’a été supprimé.

## Vérification

- Installation propre par `npm ci`, avec Node 24.15.0.
- `npm run verify` réussi : TypeScript, 169 suites / 2 955 tests, build de production et 13 pages pré-rendues vérifiées.
- 426 liens documentaires locaux contrôlés dans 74 fichiers Markdown : aucune cible manquante dans cet environnement ; tous les rapports datés sont référencés au sommaire. La charte citée par `AGENTS.md` reste une référence locale extérieure au dépôt.
- `git diff --check` et contrôle ciblé des exclusions Git réussis.
- Relecture indépendante des textes, des chemins et du périmètre : aucun défaut supplémentaire établi.

L’audit des dépendances passe avec l’exception temporaire existante pour `braces`, limitée aux outils de compilation et expirant le 5 novembre 2026. Aucun changement de cette politique n’est inclus.

Ce lot ne modifie ni les migrations, ni les dépendances, ni l’Importer. Les contrôles locaux ne valent pas vérification d’un déploiement en production.
