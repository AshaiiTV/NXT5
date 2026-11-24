# Documentation NXT5

Sommaire des documents du dépôt, au 24 novembre 2026.

- Les **guides** (fichiers sans date dans `docs/`) décrivent l’état actuel du site et sont mis à jour avec le code qu’ils décrivent.
- Les **rapports datés** (`docs/rapports/<sujet>-AAAA-MM-JJ.md`) gardent la trace d’un chantier à la date indiquée et ne sont pas réécrits ensuite. Ils sont listés dans l’[index chronologique](#rapports-datés).
- La [charte graphique unique NXT5](charte-graphique.md) est la référence visuelle du site et de l’Importer ; [`AGENTS.md`](../AGENTS.md) en impose la consultation pour chaque tâche NXT5.

Pour une vue d’ensemble du dépôt, de son installation et de ses scripts, voir le [README principal](../README.md).

## Guides

### Identité et présentation publique

- [Charte graphique Prisme](charte-graphique.md)
- [Référencement et présentation publique](seo.md)
- [Accueil public : scène 3D et provenance des ressources](home-release/README.md) (état d’octobre 2026 ; le 5 et ses couleurs suivent désormais la charte)
- [Internationalisation : français, anglais et espagnol](internationalisation.md)
- [Publications YouTube](youtube-playbook.md)

### Produit : espace équipe

- [Chargement des historiques et garanties des analyses](chargement-historique.md)
- [Import automatique des parties](import-automatique.md)
- [Équipes adverses et drafts des parties (Drafter, salle de draft)](drafter-opponents-prototype.md)
- [Aide au choix des champions](draft-assistance.md)
- [Carnets de matchups](carnets-matchups.md)
- [Scrims entre équipes NXT5](scrims.md)
- [Assistant NXT5](assistant/README.md) et ses fiches de connaissances
- [Réécriture des reviews historiques](review-backfill.md)

### Nexus Rising

- [Portail, accès et collecte automatique](nexus-rising-importer.md)
- [Saisons et formats de tournoi](nexus-rising-tournois.md)

### Comptes et connexions

- [Inscription et connexions externes](social-auth.md)
- [Configuration des fournisseurs Google, Discord, Apple et Riot](social-provider-configuration.md)
- [Interface et vérifications des connexions externes](social-auth-ui-qa.md)
- [Suppression de compte en libre-service](suppression-compte-2026-11-24.md) (rapport daté qui sert aussi de référence des décisions par clé étrangère)

### Bot Discord

- [Installation et exploitation](discord-operations.md)
- [Commandes du bot](discord-bot-commandes.md)
- [Annonces communautaires](discord-community-announcements.md)
- [Rendu des publications](../shared/publications/README.md)

### Administration et exploitation

- [Administration, comptes et statistiques globales](administration-achats.md)
- [Fréquentation : contrat et exploitation](audience-api.md)
- [Migrations de la base](../database/MIGRATIONS.md)
- [Politique de sécurité](../SECURITY.md)
- [Banc de mesure local de l’historique](../tools/bench-history/README.md)

### NXT5 Importer

- [Changements de l’Importer](../importer-app/CHANGELOG.md)
- [Validation Electron](../importer-app/docs/testing.md)
- [Import automatique](import-automatique.md) (liaison côté site et côté Importer)

### Soutien

Le service est gratuit : les parcours commerciaux ont été retirés le 30 octobre 2026.

- [Soutenir NXT5](soutenir-nxt5.md) et [page Ko-fi](kofi-nxt5.md)

### Archives (documents historiques)

Ces documents conservent un contexte antérieur. Ils ne décrivent ni des fonctionnalités actives ni une commercialisation prévue.

- [Plan de financement et de monétisation](plan-financement.md) (septembre 2026)
- [Validation commerciale avant paiement](validation-commerciale.md)
- [Abonnements manuels des profils](abonnements-manuels.md)
- [Accès Découverte et Pass Équipe](pass-feature-access.md)
- [Brief d’intégration de la monétisation](brief-integration-paiement-ia.md)
- [Shopify, réseaux et préparation juridique](shopify-et-checklist-juridique.md) (la checklist juridique reste à reprendre pour tout changement de collecte ou de traceurs, voir [`AGENTS.md`](../AGENTS.md))
- [Ancien calendrier des publications](social-calendar.md)

## Sorties de travail et preuves

Les sorties de travail nouvelles vont dans `artifacts/`, `tmp/` ou `output/`, ignorés par Git. Les captures, scripts et résultats historiques déjà versionnés restent suivis : les exclusions ne les retirent pas du dépôt. Pour versionner une nouvelle preuve citée par un rapport, l’ajouter explicitement avec `git add -f`. Conserver les preuves citées par les rapports (`artifacts/`, `docs/assets/`, `docs/bench-history/`), les jeux de données synthétiques nécessaires aux comparaisons et les outils permettant de refaire les contrôles. Une capture ancienne ne certifie pas le rendu courant ni la production.

## Rapports datés

Un nouveau rapport s’écrit dans `docs/rapports/<sujet>-AAAA-MM-JJ.md` et s’ajoute en tête de ce tableau dans la même pull request. Les rapports marqués † restent directement dans `docs/` parce que du code, une migration SQL ou la charte graphique citent leur chemin.

| Date | Rapport |
| --- | --- |
| 2026-11-24 | [Rangement de la documentation](rapports/rangement-documentation-2026-11-24.md) |
| 2026-11-24 | [Suppression de compte en libre-service](suppression-compte-2026-11-24.md) † |
| 2026-11-24 | [Effectif : hauteur stable des cartes joueur](rapports/roster-hauteur-stable-2026-11-24.md) |
| 2026-11-24 | [Rangement des guides et des sorties de travail](rapports/rangement-guides-2026-11-24.md) |
| 2026-11-24 | [Parties : onglet Équipes sans rechargement](rapports/parties-onglet-equipes-2026-11-24.md) |
| 2026-11-24 | [Objectifs joueur : nouvelles mesures et refonte visuelle](rapports/objectifs-joueur-2026-11-24.md) |
| 2026-11-24 | [Liste des parties plus visuelle](rapports/liste-parties-visuelle-2026-11-24.md) |
| 2026-11-24 | [Historique : lots parallèles](rapports/historique-lots-paralleles-2026-11-24.md) |
| 2026-11-24 | [Bot Discord : mentions limitées aux rôles mentionnables](rapports/discord-mentions-2026-11-24.md) |
| 2026-11-24 | [Débrief automatique fusionné](rapports/debrief-automatique-2026-11-24.md) |
| 2026-11-24 | [Compositions : champions hors pool](rapports/compositions-hors-pool-2026-11-24.md) |
| 2026-11-24 | [Charte 1.116 reportée sur main](rapports/charte-1116-2026-11-24.md) |
| 2026-11-24 | [Assistant et aide du bot Discord](rapports/assistant-aide-2026-11-24.md) |
| 2026-11-23 | [Sécurité des comptes](securite-comptes-2026-11-23.md) † |
| 2026-11-23 | [Performance de chargement du site](rapports/performance-chargement-2026-11-23.md) |
| 2026-11-23 | [NXT5 Importer 0.4.9 — durcissement de la collecte](rapports/importer-durcissement-2026-11-23.md) |
| 2026-11-23 | [Écran de vérification d'import simplifié](rapports/import-verification-simplifiee-2026-11-23.md) |
| 2026-11-23 | [Durcissement de l’API](rapports/durcissement-api-2026-11-23.md) |
| 2026-11-23 | [Durcissement de l’intégration Discord](rapports/discord-durcissement-2026-11-23.md) |
| 2026-11-23 | [Corrections de l’espace connecté](rapports/corrections-espace-connecte-2026-11-23.md) |
| 2026-11-23 | [Cartes des titulaires plus visuelles](rapports/cartes-titulaires-2026-11-23.md) |
| 2026-11-23 | [Audit public de nxt5.org](rapports/audit-public-2026-11-23.md) |
| 2026-11-23 | [Corrections du back-office d’administration](rapports/administration-corrections-2026-11-23.md) |
| 2026-11-23 | [Performance des requêtes serveur](performance-requetes-2026-11-23.md) † |
| 2026-11-09 | [Pistes de logo dans la direction « 5 en verre »](rapports/logo-verre-pistes-2026-11-09.md) |
| 2026-11-09 | [Logo NXT5 : le 5 de la page d’accueil partout](rapports/logo-verre-integration-2026-11-09.md) |
| 2026-10-15 | [Enseignements des trois Reels pour NXT5](rapports/enseignements-reels-2026-10-15.md) |
| 2026-10-13 | [Lecture détaillée d’une partie](rapports/match-reading-2026-10-13.md) |
| 2026-10-13 | [Chargement NXT5 — verre sculptural](rapports/loading-glass-2026-10-13.md) |
| 2026-10-13 | [Effets autour du 5 au chargement](rapports/loading-effects-2026-10-13.md) |
| 2026-10-13 | [Accueil connecté : scène unifiée et débrief personnel](rapports/home-unified-2026-10-13.md) |
| 2026-10-13 | [Prolonger le Hero dans le site](rapports/hero-identity-2026-10-13.md) |
| 2026-10-13 | [Finition du verre violet](rapports/design-polish-2026-10-13.md) |
| 2026-10-13 | [Retest de capacité](bench-history/capacity-2026-10-13.md) |
| 2026-10-12 | [Verre violet dans l’ensemble du site](rapports/design-glass-sitewide-2026-10-12.md) |
| 2026-10-12 | [Chargement Nexus en verre violet](rapports/design-glass-loading-2026-10-12.md) |
| 2026-10-12 | [Verre violet dans les exports](rapports/design-glass-exports-2026-10-12.md) |
| 2026-10-07 | [Lecture des pages](rapports/lecture-globale-2026-10-07.md) |
| 2026-10-06 | [Affichage initial des pages publiques](rapports/performance-affichage-public-2026-10-06.md) |
| 2026-10-06 | [Historique : pagination avant projection JSON](rapports/perf-historique-2026-10-06.md) |
| 2026-10-06 | [Démarrage guidé](rapports/demarrage-guide-2026-10-06.md) |
| 2026-10-06 | [Corrections de l’audit SEO](rapports/corrections-seo-2026-10-06.md) |
| 2026-10-06 | [Dépendances de construction et audit](rapports/build-dependency-security-2026-10-06.md) |
| 2026-10-06 | [Audit SEO de NXT5](rapports/audit-seo-2026-10-06.md) |
| 2026-10-06 | [Audit général NXT5](rapports/audit-general-2026-10-06.md) |
| 2026-09-30 | [Passage à React 19](rapports/react-19-2026-09-30.md) |
| 2026-09-30 | [Reprise des correctifs restés sur `feat/pricing-validation`](rapports/pricing-validation-restes-2026-09-30.md) |
| 2026-09-30 | [NXT5 Importer 0.3.5 — Electron 44.4.5 et actions GitHub](rapports/importer-0-3-5-2026-09-30.md) |
| 2026-09-30 | [Factorisation des doublons](rapports/factorisation-2026-09-30.md) |
| 2026-09-29 | [Mesure du chargement de l’historique](rapports/perf-historique-2026-09-29.md) |
| 2026-09-29 | [Nettoyage du dépôt](rapports/nettoyage-depot-2026-09-29.md) |
| 2026-09-29 | [Journaux serveur sécurisés](rapports/logs-securises-2026-09-29.md) |
| 2026-09-29 | [NXT5 Importer 0.3.4 — noms de champions, détection du client, logo et ton](rapports/importer-champions-2026-09-29.md) |
| 2026-09-29 | [Cohérence des textes NXT5](rapports/coherence-textes-2026-09-29.md) |
| 2026-09-29 | [Audit croisé Claude ↔ GPT](rapports/audit-croise-2026-09-29.md) |
| 2026-09-29 | [Plafond journalier de l’assistant IA](rapports/assistant-plafond-2026-09-29.md) |
| 2026-09-28 | [Corrections de l’audit NXT5](rapports/audit-corrections-2026-09-28.md) |
| 2026-09-24 | [Vérification du parcours de prise en main](rapports/verification-clarte-parcours-2026-09-24.md) |
| 2026-09-24 | [Contrôle des accents colorés](rapports/subtle-gradients-2026-09-24.md) |
| 2026-09-24 | [Plan de clarté et de prise en main NXT5](rapports/plan-clarte-parcours-2026-09-24.md) |
| 2026-09-24 | [Export Discord des groupes](rapports/group-discord-export-2026-09-24.md) |
| 2026-09-24 | [Actions d’une partie](rapports/game-discord-actions-2026-09-24.md) |
| 2026-09-24 | [Bot Discord — refonte de lecture](rapports/discord-clarity-2026-09-24.md) |
| 2026-09-24 | [NXT5 — audit SEO et plan d’acquisition](rapports/audit-seo-2026-09-24.md) |
| 2026-09-24 | [Clarté des autres pages](clarte-pages-restantes-2026-09-24.md) † |
| 2026-09-23 | [Vérification de sécurité](rapports/security-review-2026-09-23.md) |
| 2026-09-23 | [Démarrage NXT5 — correction](rapports/onboarding-actions-2026-09-23.md) |
| 2026-09-23 | [Information sur le bot Discord](rapports/discord-policies-2026-09-23.md) |
| 2026-09-23 | [Refonte de toutes les pages NXT5](design-all-pages-2026-09-23.md) † |
| 2026-09-22 | [Statistiques du bot Discord](rapports/bot-analytics-2026-09-22.md) |
| 2026-09-21 | [Bot Discord : installation guidée et dashboard d’équipe](discord-dashboard-2026-09-21.md) † |
| 2026-09-15 | [Livraison NXT5 → Discord](rapports/discord-delivery-2026-09-15.md) |
| 2026-09-15 | [Discord NXT5 - contrôle de l’interface](discord-qa-2026-09-15.md) † |
| 2026-09-08 | [Audit de cohérence visuelle NXT5](rapports/audit-da-2026-09-08.md) |
| 2026-09-06 | [Corrections complémentaires de l’audit NXT5](rapports/audit-followup-2026-09-06.md) |
