# Documentation NXT5

Sommaire des documents du dépôt. Les **guides** décrivent l’état actuel et sont tenus à jour ; les **rapports datés** (`<sujet>-AAAA-MM-JJ.md`) gardent la trace d’un chantier à la date indiquée et ne sont pas réécrits ensuite. Les règles de la charte graphique sont indiquées dans [`AGENTS.md`](../AGENTS.md).

## Guides

### Exploitation

- [Migrations de la base](../database/MIGRATIONS.md)
- [Politique de sécurité](../SECURITY.md)
- [Réécriture des reviews historiques](review-backfill.md)
- [Fréquentation : contrat et exploitation](audience-api.md)
- [Référencement et présentation publique](seo.md)

### Bot Discord

- [Installation et exploitation](discord-operations.md)
- [Commandes du bot](discord-bot-commandes.md)
- [Annonces communautaires](discord-community-announcements.md)
- [Rendu des publications](../shared/publications/README.md)

### Comptes et connexions

- [Inscription et connexions externes](social-auth.md)
- [Configuration des fournisseurs Google, Discord, Apple et Riot](social-provider-configuration.md)
- [Interface et vérifications des connexions externes](social-auth-ui-qa.md)

### Produit

- [Carnets de matchups](carnets-matchups.md)
- [Assistant NXT5](assistant/README.md)
- [Administration : achats et navigation](administration-achats.md)

### Offres, abonnements et soutien

- [Validation commerciale avant paiement](validation-commerciale.md)
- [Accès Découverte et Pass Équipe](pass-feature-access.md)
- [Abonnements manuels des profils](abonnements-manuels.md)
- [Plan de financement](plan-financement.md)
- [Brief d’intégration du paiement](brief-integration-paiement-ia.md)
- [Shopify, réseaux et préparation juridique](shopify-et-checklist-juridique.md)
- [Soutenir NXT5](soutenir-nxt5.md) et [page Ko-fi](kofi-nxt5.md)

### Communication

- [Teaser vidéo NXT5](../teaser/README.md)

### NXT5 Importer

- [Changements](../importer-app/CHANGELOG.md)
- [Validation Electron](../importer-app/docs/testing.md)

## Rapports datés

| Date | Rapport |
| --- | --- |
| 2026-09-06 | [Corrections complémentaires de l’audit](audit-followup-2026-09-06.md) |
| 2026-09-08 | [Audit de cohérence visuelle](audit-da-2026-09-08.md) |
| 2026-09-15 | [Livraison NXT5 → Discord](discord-delivery-2026-09-15.md) |
| 2026-09-15 | [Discord : contrôle de l’interface](discord-qa-2026-09-15.md) |
| 2026-09-21 | [Bot Discord : installation guidée et dashboard d’équipe](discord-dashboard-2026-09-21.md) |
| 2026-09-22 | [Statistiques du bot Discord](bot-analytics-2026-09-22.md) |
| 2026-09-23 | [Information sur le bot Discord](discord-policies-2026-09-23.md) |
| 2026-09-23 | [Refonte de toutes les pages](design-all-pages-2026-09-23.md) |
| 2026-09-23 | [Démarrage NXT5 : correction](onboarding-actions-2026-09-23.md) |
| 2026-09-23 | [Vérification de sécurité](security-review-2026-09-23.md) |
| 2026-09-24 | [Audit SEO et plan d’acquisition](audit-seo-2026-09-24.md) |
| 2026-09-24 | [Clarté des autres pages](clarte-pages-restantes-2026-09-24.md) |
| 2026-09-24 | [Bot Discord : refonte de lecture](discord-clarity-2026-09-24.md) |
| 2026-09-24 | [Actions d’une partie](game-discord-actions-2026-09-24.md) |
| 2026-09-24 | [Export Discord des groupes](group-discord-export-2026-09-24.md) |
| 2026-09-24 | [Plan de clarté et de prise en main](plan-clarte-parcours-2026-09-24.md) |
| 2026-09-24 | [Contrôle des accents colorés](subtle-gradients-2026-09-24.md) |
| 2026-09-24 | [Vérification du parcours de prise en main](verification-clarte-parcours-2026-09-24.md) |
| 2026-09-28 | [Corrections de l’audit](audit-corrections-2026-09-28.md) |
| 2026-09-29 | [Plafond journalier de l’assistant IA](assistant-plafond-2026-09-29.md) |
| 2026-09-29 | [Cohérence des textes publics](coherence-textes-2026-09-29.md) |
| 2026-09-29 | [Nettoyage du dépôt](nettoyage-depot-2026-09-29.md) |
| 2026-09-29 | [Mesure du chargement de l’historique](perf-historique-2026-09-29.md) |
| 2026-09-30 | [Factorisation des doublons](factorisation-2026-09-30.md) |
| 2026-09-30 | [Correctifs repris de feat/pricing-validation](pricing-validation-restes-2026-09-30.md) |
| 2026-09-30 | [Importer 0.3.5 : Electron et actions GitHub](importer-0-3-5-2026-09-30.md) |
| 2026-09-30 | [Passage à React 19](react-19-2026-09-30.md) |

Ajouter chaque nouveau rapport daté à ce tableau dans la même pull request.
