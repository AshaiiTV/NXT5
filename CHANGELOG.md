# Changelog

> Le site n’a plus de numéro de version depuis 0.1.2 (juin 2026) : il est publié à chaque fusion sur `main`. Ce journal résume les fusions par mois depuis novembre 2026, avec le numéro de pull request ; le détail est dans les pull requests et dans les [rapports datés](docs/README.md#rapports-datés). Le journal de NXT5 Importer est tenu dans [`importer-app/CHANGELOG.md`](importer-app/CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Novembre 2026

### Ajouté

- Suppression de compte en libre-service dans Paramètres, sans perte de données pour les autres équipes (#315).
- Objectifs joueur : sept nouvelles mesures et suggestions par poste (#319).
- Compositions : champions hors pool autorisés (#310).
- Débrief visuel automatique dans le résumé de chaque partie, fusionnant lecture automatique et compte rendu d’import (#309).
- Salle de draft NXT5 publiée avec les voix des champions (#274), puis refondue avec l’historique des choix (#276) ; capitaines prêts avant la draft, suppression et correction après la draft.
- Démonstration publique avec de vraies adresses, courbe d’or (#284), joueurs, champions, draft, planning et bilan (#301).
- Import automatique des parties : liaison de NXT5 Importer et réception serveur (#238), réunie à l’import de partie (#277), limitée aux parties à finaliser (#271).
- Recherche de scrims entre équipes (#236) ; Nexus Rising publié dans le portail NXT5 (1er novembre), avec départage explicite des saisons (#237).
- Notes d’équipe et débriefs réunis dans le résumé de la partie (#265) ; Notes retiré du menu latéral (#269).
- Historique des profils lisible par journée et par duel (#278), nombre de parties par page au choix (#280).
- Guide YouTube et licence tous droits réservés (#287, #290, #293).

### Modifié

- Identité : 5 en verre partout (#243), Prisme (#248, #253, #256, #259), signature lumineuse (#261, #262), dégradé Signature NXT des actions principales (#266), signature soudée et charte 3.0 (#292), charte 1.116 sur `main` : tokens sémantiques, rayons, titres, boutons (#311).
- Liste des parties plus visuelle (#318), onglet Équipes des Parties sans rechargement (#320), cartes des titulaires plus visuelles (#295, #297, #299), écran de vérification d’import simplifié (#298), fenêtre d’import illustrée (#279).
- Drafts & bans : lecture visuelle et retrait des conseils génériques (#308) ; liens Drafter et analyses de picks et bans rétablis (#264, #268).
- Synthèse du profil allégée (#246, #251, #252) et retrait du bloc « À vérifier en débrief » (#321) ; textes du site et de l’assistant raccourcis (#247, #254).
- Assistant et aide du bot Discord actualisés (#245, #314).
- NXT5 Importer 0.4.0 à 0.4.9 : collecte automatique, nouvelle interface, simplification, puis collecte réservée aux customs et durcissement (#238, #239, #272, #294) ; empreintes SHA-256 publiées dans la release (#300).

### Performance

- Historique demandé par lots de trois en parallèle (#312), requêtes lourdes accélérées et index (#296), notes d’équipe chargées par budget (#291).
- Traductions par langue et pages publiques à la demande (#305), moteur three.js différé sur l’accueil (#282), équipe complète chargée sur l’écran initial (#250).

### Sécurité et fiabilité

- Comptes : changement d’e-mail confirmé, essais de mot de passe bornés, alertes (#303) ; réponses d’authentification clarifiées et HSTS étendu aux sous-domaines (#283) ; session courte par défaut (#285).
- API de l’espace membre durcie : scrims, équipes, joueurs, imports (#289) ; consommation de la clé Riot par l’export public limitée (#281).
- Bot Discord : salons vérifiés, liaison protégée, envois fiables (#302), mentions limitées aux rôles mentionnables (#317).
- Administration : garde Nexus sur la suppression d’équipe et journal complet (#304).

### Corrigé

- Espace connecté : invitation sur iPhone, brouillons de coaching, scrims et planning (#288).
- Bannière cookies lisible sur petits téléphones et bouton principal visible au-dessus (#286, #307).
- Hauteur stable des cartes joueur de l’effectif (#316).

### Documentation

- Guides actualisés et sorties de travail isolées (#313) ; rapports datés rangés dans `docs/rapports/` et README réécrit.

## [0.1.2] - 2026-06-18

### Added

- NXT5 Importer desktop app packaging for Windows and macOS.
- Local JSON export flow from a Riot Game ID for safer match imports.

### Changed

- Importer release artifacts are produced for Windows, Mac x64, and Mac arm64.

## [0.1.0] - 2026-06-18

### Added

- Initial NXT5 web dashboard with React, Vite, Netlify Functions, and Neon PostgreSQL.
- Auth with HttpOnly cookie sessions stored in the database.
- Team creation, team joining, roster management, and player profiles.
- Riot match import, local match-file import, match archive groups, and reports.
- Champion pool views, composition builder, planning tools, and match archive groups.
