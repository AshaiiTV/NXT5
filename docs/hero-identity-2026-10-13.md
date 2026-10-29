# Prolonger le Hero dans le site — 13 octobre 2026

Le Hero possède un horizon, un volume en verre et des facettes qui n’étaient pas assez présents dans les pages de travail. Cette passe reprend cette composition dans les introductions et rend les matières du cadre plus lisibles, tout en gardant des zones opaques pour les données.

La [charte graphique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) est mise à jour en version 1.62 dans le dépôt principal. Ce compte rendu ne constitue pas une copie de la charte. Il conserve l’évolution du chargement ajoutée séparément le même jour.

## Réalisation

- `PageHeader` devient une introduction ouverte, avec horizon sous voile nuit, titre 32–50 px et une colonne réservée à la sculpture. Les identités d’équipe et de joueur conservent leur propre composition.
- `Surface` distingue `frame` (défaut, alias `glass` conservé), `scene` et `reading`. Les facettes restent périphériques ; la lecture reste opaque.
- Le cadre connecté et administratif reprend l’horizon et des tranches de verre dans la navigation. L’accueil connecté replace l’identité de l’équipe au premier plan, avec l’action sous le texte.
- `PublicScene` réutilise le poster original sur Fonctionnalités, Démonstration, Guides et Soutien. Les pages suivantes alternent des introductions expressives et des sections ouvertes.
- Authentification, informations et tarifs utilisent une intensité adaptée ; les tarifs intégrés à l’administration ne cumulent pas deux panoramas.
- Les modes performance simplifient les fonds ; aucun moteur, mouvement permanent, police ou asset de marque supplémentaire. Le Hero public validé, les données, les parcours, les prix et les couleurs sémantiques sont conservés.

## Vérifications

Les commandes de `verify` ont été exécutées directement avec Node 24.19.0 (npm absent de l’environnement) : contrôle i18n, TypeScript, Vitest, Vite et prérendu.

- i18n : 3 611 messages explicitement couverts en anglais et espagnol, paramètres valides ; TypeScript valide.
- Suite complète : 212 suites valides sur 214, 3 969 tests valides sur 3 977. Les huit échecs sont des dépassements de délai de 5 secondes dans deux suites SQL (`review-backfill`, `discord-community-announcements`).
- Relance isolée de ces deux suites avec un worker et délai de 30 secondes : 49/49 tests valides. L’ensemble des 3 977 tests est ainsi validé entre les deux passages, sans modification des tests ou du code métier.
- Build et prérendu : 13 pages publiques vérifiées, 404 réelle, routes privées noindex, sitemap et robots. Avertissement préexistant de taille des chunks Vite.
- Navigateur avec données fictives : 11 routes connectées à 320, 360, 390, 768, 1024 et 1440 px ; 24 contrôles supplémentaires en anglais et espagnol ; mode performance de l’accueil. Aucun débordement global et aucune erreur JavaScript sur ces 91 configurations.
- Pages publiques : Fonctionnalités, Démonstration, Guides, Soutien, mentions et connexion, vérifiées de 320 à 1440 px ; anglais/espagnol, champs mobiles 16 px et mode performance. Contrôle supplémentaire des tarifs intégrés à l’administration.
- Contrôle visuel des captures et titres longs ; focus existant conservé, affichage statique en mouvement réduit, aucun canvas ajouté au cadre connecté.

Les captures et journaux locaux sont dans `artifacts/hero-identity/` (hors commit). Les fixtures ne certifient pas les appels de production : quelques portraits distants des pages Profil/Draft ne sont pas disponibles via le faux proxy local. Les éléments de marque locaux sont chargés ; les parcours métier n’ont pas été modifiés.
