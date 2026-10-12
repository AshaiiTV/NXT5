# QA locale · Drafts & bans

Ce harness affiche les **vrais `TrendsPage`, `DrafterAnalysis`, `Sidebar` et `Topbar`** avec leurs CSS de production. Le menu développé réserve réellement 264 px à partir de 1 024 px. Les seules données remplacées sont les réponses API et le contenu `data` : tout est fictif, défini dans `fixtures.mjs` et signalé à l’écran.

Il ne charge aucun `.env`, n’ouvre aucune base et ne contacte aucune API d’équipe. Le mode par défaut n’effectue aucun appel externe. Les liens sources des drafts restent locaux. Les actions de navigation générales du cadre sont neutralisées ; seuls les filtres et interactions de la page d’analyse sont réels.

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
