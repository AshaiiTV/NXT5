# QA locale · Drafts & bans

Ce harness affiche les **vrais `TrendsPage`, `DrafterAnalysis`, `GameWorkspace`, `Sidebar` et `Topbar`** avec leurs CSS de production. Le menu développé réserve réellement 264 px à partir de 1 024 px. Les seules données remplacées sont les réponses API et le contenu `data` : tout est fictif, défini dans `fixtures.mjs` et signalé à l’écran.

Il ne charge aucun `.env`, n’ouvre aucune base et ne contacte aucune API d’équipe. Le mode par défaut n’effectue aucun appel externe. Les liens sources des drafts restent locaux. Les actions de navigation générales du cadre sont neutralisées ; les filtres et interactions des pages d’analyse et des dossiers adverses sont réels, avec des écritures simulées uniquement en mémoire.

## Lancer

Depuis la racine du checkout, avec ses dépendances disponibles :

```sh
node tools/draft-analysis-qa.mjs
```

Ouvrir <http://127.0.0.1:5192/tendances?rubrique=drafts&qa=full>.

Pour vérifier les vrais portraits publics à la place du fallback natif :

```sh
NXT5_QA_PUBLIC_ASSETS=1 node tools/draft-analysis-qa.mjs
```

Ce flag ne permet que la lecture d’images publiques Riot/CommunityDragon ; aucun cookie ni identifiant n’est transmis. Le cache d’images est en mémoire. `NXT5_QA_PORT` permet de changer le port. Le serveur écoute exclusivement sur `127.0.0.1` et refuse les autres en-têtes Host.

## Équipes adverses et dossiers

Le même serveur propose désormais le vrai `GameWorkspace`, sa vue Équipes, les détails de parties et les groupes, avec le même cadre AppChrome :

- Annuaire : <http://127.0.0.1:5192/games?view=teams&qa=full>.
- Dossier riche Orion : <http://127.0.0.1:5192/games?view=teams&opponent=qa-orion&qa=full>.
- Nom et notes longs : <http://127.0.0.1:5192/games?view=teams&opponent=qa-long-name&qa=full>.
- Dossier sans partie : <http://127.0.0.1:5192/games?view=teams&qa=empty-dossier>.
- Lecture seule : <http://127.0.0.1:5192/games?view=teams&opponent=qa-orion&qa=readonly>.
- Aucun adversaire : <http://127.0.0.1:5192/games?view=teams&qa=no-opponents>.
- Erreur, chargement et aucune équipe : remplacer `qa` par `error`, `loading` ou `no-team`.

Les dossiers utilisent six fiches, quatorze parties et six groupes fictifs. Orion comprend neuf parties, dont deux dont les champions viennent de la draft liée et une sans composition exploitable. Trois groupes Orion se chevauchent : les parties communes ne doivent pas gonfler les compteurs du dossier. Des résultats inconnus sont présents. Le dossier sans partie conserve un groupe vide pour vérifier l’état « prochaine rencontre ».

Les réponses de `opponents-drafts` respectent le contrat réel : `opponents`, `drafts`, `opponentMatches`, `opponentGroups` et `canEdit`. Les entrées `opponentMatches` portent `id`, `opponentId`, `gameId`, `label`, `date`, `result`, `enemyPicks` et `enemyPicksComplete`. Les groupes portent `id`, `name`, `opponentId`, `matchIds` et `updatedAt`. `GameWorkspace` reçoit séparément ses enregistrements de parties et groupes au format bootstrap.

Les actions locales `list`, `list-opponents`, `get-match-draft`, `get-match-opponent`, `get-group-opponent` et l’endpoint `match-details` permettent d’ouvrir les sources. La création de fiche est simulée **uniquement en mémoire**, par scénario, avec réutilisation d’un nom déjà créé. Elle reste visible après Actualiser et disparaît au redémarrage du serveur. Le scénario `readonly` la refuse. Les autres écritures répondent explicitement qu’elles ne sont pas simulées ; aucune ne sort du harness.

Le scénario est conservé dans la session locale pendant les liens vers une partie ou un groupe. Le client lui ajoute des en-têtes QA seulement vers les endpoints du serveur local. Un lien contenant `qa=full` permet de revenir explicitement au scénario normal.

Après une modification du runner `.mjs`, redémarrer le serveur ; les changements JSX/fixtures côté navigateur sont pris par Vite. Ne pas arrêter une session de QA d’un autre agent sans coordination.

## Scénarios

Le sélecteur « Scénario QA » recharge le scénario demandé. On peut également modifier `qa` dans l’URL.

| Scénario | Contenu vérifiable |
| --- | --- |
| `full` | 12 drafts, 10 liées à une partie, 5 joueurs et 20 champions déclarés ; 3 adversaires dont un au nom long, plus une équipe sans draft. |
| `missing-order` | Même échantillon, sans preuve de chronologie. Les fréquences générales restent disponibles ; aucune rotation ne doit être inventée. |
| `partial-bans` | Deux drafts, dont une avec un ban inconnu et l’autre avec un ban explicitement passé. Leurs couvertures et chronologies doivent les distinguer. |
| `no-pools` | Historique joué présent, aucun champion déclaré. Les explications doivent respecter la source de l’information. |
| `unlinked` | Toutes les drafts sont sans partie ni adversaire liés ; aucun participant joué ne permet de confirmer un rôle dans une draft. |
| `empty` | API réussie, aucune draft. |
| `error` | Erreur API simulée ; « Réessayer » reproduit l’erreur pour vérifier la stabilité. |
| `loading` | Réponse volontairement en attente ; vérifier le chargement dans les premières secondes, avant le délai réel d’`apiFetch` (20 s). |
| `no-team` | Aucune équipe sélectionnée ; aucune requête de drafts ne devrait partir. |

Dans `full`, Aatrox et Poppy reviennent dans les bans de première phase ; Ahri revient en seconde phase. Les champions réellement sélectionnés ne sont jamais aussi bannis. La composition des participants est définie par rôle et **diffère de l’ordre des picks**, pour détecter une confusion entre rôle et emplacement. Les drafts 4, 8 et 12 ont le côté rouge au premier pick global. La draft 10 ne possède pas de preuve de chronologie. La draft 11 contient un ban inconnu et la draft 12 un ban passé.

## Matrice de vérification

Tester `full` à **360, 390, 768, 1 024 et 1 440 px**, avec une hauteur d’au moins 900 px. Au bureau, conserver le menu développé pour la première passe ; vérifier aussi le menu réduit à 1 024 px. Contrôler :

1. Le document ne déborde pas horizontalement ; filtres, titres, cartes et liens restent lisibles sans clipping.
2. Les bans dirigés contre notre équipe ne deviennent pas les bans effectués par elle lors d’un changement de camp.
3. Filtrer un adversaire, le camp et le rattachement actualise compteurs, couvertures, sources et sélection de draft. L’équipe sans draft produit un état vide local.
4. Revoir la draft 4 montre le rouge en premier. Revoir la 10 n’invente pas une chronologie. Les 11 et 12 distinguent absence d’information et ban passé.
5. Les rôles confirmés viennent des participants liés ; aucun rôle n’est déduit du simple numéro du pick.
6. Les menus, filtres, détails et actions fonctionnent au clavier. Le focus reste visible. Le menu mobile se ferme avec Échap et rend le focus.
7. Répéter les principaux états à 390 px ; vérifier `missing-order`, `partial-bans`, `no-pools`, `unlinked`, `empty`, `error`, `loading` et `no-team`.
8. Activer `prefers-reduced-motion: reduce` et vérifier l’absence d’animation gênante.

Les captures et conclusions de QA doivent préciser qu’il s’agit d’un échantillon fictif, pas de statistiques d’équipe ni d’un test utilisateur.
