# Livraison NXT5 → Discord — 15 septembre 2026

Branche : `codex/discord-publications-20260915`, préparée depuis `origin/main` (`da046af`) dans un checkout isolé, avec la refonte PNG `6139f1a` et la correction des noms d’objets `ddbd407` arrivées pendant le développement. Le checkout initial et ses modifications en cours sont conservés.

[PR de revue #40](https://github.com/AshaiiTV/NXT5/pull/40) · [Prévisualisation Netlify](https://deploy-preview-40--nxt5.netlify.app)

## Périmètre livré

| Lot du plan | Réalisation |
| --- | --- |
| Moteur NXT5 commun | Un même modèle alimente la fiche game, les lectures existantes et Discord ; les données manquantes restent distinctes de zéro. |
| Rendu | PNG serveur factuel sans navigateur utilisateur, police et logo embarqués ; pistes de review optionnelles dans le message uniquement, réemploi du PNG entre salons et repli texte au-delà de 3 Mio. |
| Persistance | Migration additive, snapshots immuables, révisions, file durable, livraison transactionnelle après import et corrections atomiques de rôles. |
| Transport | Création puis modification du même message, respect des réponses 429, reprise des préparations, rapprochement des confirmations perdues. |
| Liaison | Code NXT5 à usage unique, commande Discord signée, vérification des deux responsabilités et permissions par salon. |
| Interface | Réglages équipe, catégories et salons, aperçu texte/PNG, publication manuelle, historique, pause/reprise, retrait et rapprochement. |
| Exploitation | Diagnostic administrateur, nettoyage quotidien, références conservées pour retrait, documentation d’installation et de restauration. |

Les notes humaines et reviews privées ne sont pas publiées implicitement. Les extensions après le pilote — reviews approuvées, bilans, Tendances et profils — restent celles décrites dans le plan, hors du premier parcours game.

## Vérifications effectuées

- `npm run verify` : TypeScript, **1 142 tests sur 71 suites**, compilation Vite réussis.
- Build Netlify local complet : fonctions synchrones, planifiées et en arrière-plan empaquetées.
- Contrôle des archives produites localement : Node 24, binaire natif **Linux x64 ELF**, quatre polices Inter et wordmark présents.
- Rendu réel sur un déploiement Netlify de test : PNG synthétique **1 440 × 2 519 px**, 496 388 octets, **860 ms** de rendu, réponse HTTP 200. L’environnement distant observé utilisait **Linux x64 / Node 22.23.2** ; cette mesure unique ne représente ni un percentile ni un engagement de délai.
- PostgreSQL local via PGlite : vrais SQL, transactions, contraintes et déclencheurs ; transports externes simulés dans les tests.
- Pannes couvertes : rollback d’import, réimport identique, correction concurrente, pause pendant rendu, limitation de débit, confirmation perdue, reprise atomique, retrait réessayable et suppression de game pendant un envoi incertain.
- Isolation : équipe/game/destination, rôles staff/gestion, signatures, rejeu de commandes, mentions et mutations des previews. Le contexte fiable de chaque invocation Netlify est propagé aux 14 entrées Discord et aux réveils après import ; le contexte hébergé inconnu bloque les mutations.
- Une barrière protège également les six entrées pouvant modifier les sources des games ou leurs cascades. Un import effectué en preview ne peut donc pas alimenter indirectement le bot de production via les déclencheurs d’une base partagée ; les lectures et les imports en mode aperçu restent disponibles.
- [QA responsive et charte 1.23](discord-qa-2026-09-15.md) : 360, 390, 768, 1024 et 1440 px ; aperçu texte seul et image ; 23 pages de charte PDF vérifiées.
- [Exemples PNG synthétiques](../artifacts/discord-render/benchmark.json) : cinq cas, dont données absentes, côté rouge et noms longs. Les mesures locales ne représentent pas un engagement de délai en production.

La concurrence des tests est bornée à quatre workers pour éviter de lancer trop de moteurs PostgreSQL WASM simultanément. Une fixture existante d’achats a également été stabilisée : deux appels d’horloge pouvaient placer la commande après son paiement d’une milliseconde. Aucun comportement métier d’achat n’a été modifié.

Preuves machine : [vérification complète](../artifacts/discord-render/verification.json), [contrôle des paquets](../artifacts/discord-render/bundle-check.json), [mesure Netlify](../artifacts/discord-render/netlify-runtime.json) et [PNG généré sur Netlify](../artifacts/discord-render/netlify-runtime.png).

## Activation du pilote

Les essais locaux n’ont appliqué aucune migration distante et n’ont envoyé aucun message Discord réel.

Pour terminer l’installation réelle, il reste à renseigner l’équipe pilote, son serveur et ses salons, puis configurer l’application Discord et ses secrets dans l’environnement serveur. La migration, l’enregistrement des commandes, la liaison et l’activation suivent le [guide d’exploitation](discord-operations.md).

Le pilote doit ensuite vérifier un import réel, un réimport identique, une correction, la pause/reprise, un retrait et l’affichage dans Discord mobile, puis effectuer l’exercice de restauration du guide. Les délais et coûts sont à mesurer avant une ouverture générale. L’objectif proposé reste 95 % des publications sous deux minutes après disponibilité dans NXT5 ; il n’est pas encore mesuré sur une équipe réelle.

## Limites de cette première version

- Une équipe active par serveur Discord ; au maximum dix destinations par équipe.
- Aucun rattrapage automatique de tout l’historique à l’activation.
- Le premier PNG est une fiche détaillée, sans variante compacte distincte. Le navigateur peut enrichir les données d’icônes ; le serveur utilise les libellés de sorts et un renvoi NXT5 pour les builds, sans dépendre d’un téléchargement externe.
- La supervision livrée repose sur le diagnostic, l’historique et les journaux. Les alertes indépendantes de Discord, le suivi du dernier passage planifié et le relevé régulier des délais/coûts restent à mettre en place avec l’opérateur avant ouverture générale.
- Un envoi incertain reste bloqué tant que son message ne peut pas être retrouvé avec certitude. L’absence dans les cent derniers messages ne déclenche pas un renvoi.
- Une copie téléchargée sur Discord ne peut pas être rappelée par le bot.
- Le nettoyage est borné ; un entretien régulièrement tronqué nécessite un ajustement du volume et du budget. Une image retirée du cache reste régénérable depuis le snapshot conservé, sous contrôle d’accès.
- Aucun déploiement en production ni activation du bot ne découle du seul build de prévisualisation.
