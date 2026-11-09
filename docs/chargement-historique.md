# Chargement des historiques

L’ouverture de l’espace d’équipe récupère une première page de **100 parties au maximum**. L’accueil, l’effectif, la gestion d’équipe et le planning deviennent utilisables sans télécharger systématiquement toutes les anciennes parties. Un historique de **500 parties au plus** est ensuite complété en arrière-plan (voir [Chargement parallèle et en arrière-plan](#chargement-parallèle-et-en-arrière-plan)).

La liste Parties affiche immédiatement le premier lot, trié par date d’import, avec le total serveur et le nombre de parties chargées. « Charger la suite » ajoute au maximum 100 parties. Au-delà de 500 parties, la liste n’enchaîne pas automatiquement les autres pages. La pagination d’affichage de 10, 25 ou 50 lignes parcourt les parties déjà chargées.

Une recherche, un filtre ou un autre tri demande l’historique complet avant d’afficher ses résultats. Les vues de détail d’une partie, de groupes et d’adversaires, l’import, Débriefs, Analyses, Profil et Draft demandent également cet historique. Leur contenu reste en chargement tant que toutes les pages n’ont pas été reçues et validées. Sur l’effectif et la gestion d’équipe, les statistiques de champions et le contrôle des données se chargent avec l’action « Charger les analyses de l’équipe ».

## Un seul écran d’attente

- **Ouverture directe** d’une de ces vues (lien, rechargement) ou **changement d’équipe** pendant qu’elle est affichée : l’écran de chargement partagé reste ouvert jusqu’à l’historique complet. Son étape « Synchronisation » affiche « PARTIES REÇUES » et le compteur, par exemple 200 / 437. La navigation de l’espace est disponible dès que cet écran se ferme. Une erreur sur la suite de l’historique ferme l’écran et laisse la page proposer « Réessayer ». Un échec du premier lot garde son message habituel.
- **Navigation interne** vers une de ces vues : l’espace reste affiché et la page indique « {reçues} parties reçues sur {total} » avec une barre de progression. Le compteur n’est pas annoncé à chaque lot par les lecteurs d’écran : il est exposé par la barre (`role="progressbar"`, `aria-valuetext`). Sans total connu, la page garde son squelette.

## Données partielles et analyses

- `bootstrapReady` indique que le premier jeu de données appartient à l’équipe sélectionnée et peut être affiché.
- `data.historyComplete` indique que toutes les parties sont présentes. Il reste faux pour une première page ayant une suite.
- `loadNextPage()` ajoute une seule page validée à la liste. Des clics concurrents partagent la même requête.
- `ensureHistory()` demande les pages restantes et déduplique les appels concurrents. Elles ne sont publiées qu’ensemble, après validation de leur équipe, de leurs identifiants uniques, de leur total et de leur position. Si une page manuelle est déjà en vol, la demande complète attend sa fin puis reprend au curseur suivant.
- `historyLoading`, `historyError` et `loadingProgress` pilotent le chargement, le réessai et sa progression. `loadingProgress` alimente le compteur de l’écran partagé et celui de la page. Un échec de pagination conserve la première page utilisable et ne transforme jamais les données partielles en analyse complète.
- Une nouvelle tentative après erreur repart d’un premier bootstrap frais : elle ne réutilise pas un total devenu obsolète.

L’accueil utilise le total de parties calculé par le serveur. Ses compteurs exhaustifs et ses conclusions sur l’ensemble de l’historique restent réservés aux données complètes. Une première page triée par date d’import ne permet pas de conclure à l’absence de partie jouée récemment dans toute l’équipe.

## Chargement parallèle et en arrière-plan

**Lots en parallèle.** La première page fixe le total, donc la position de chaque lot restant. `useTeamData` demande ces lots de 100 parties **trois à la fois au plus** (`HISTORY_CONCURRENCY`) au lieu d’un seul à la fois. Chaque lot est validé dès sa réception : équipe, position, total inchangé, taille exacte (100 ou le reste) et cohérence de la suite annoncée. Les lots peuvent arriver dans n’importe quel ordre. Ils sont assemblés dans l’ordre du serveur, contrôlés contre les doublons, puis publiés ensemble. Le premier échec annule les lots encore en vol et ne lance pas les suivants. Une page manuelle (« Charger la suite ») reste une requête unique.

**Complétion en arrière-plan.** `AppContent` active l’option `prefetchHistory` de `useTeamData`. Après l’ouverture, l’historique est complété sans action de l’utilisateur si toutes ces conditions sont réunies :

- au plus **500 parties** au total (`BACKGROUND_HISTORY_MAX_GAMES`) ;
- pas de demande complète déjà faite, pas de page manuelle en cours et pas d’échec pour ce premier lot ;
- **1,5 s** écoulée après l’affichage, onglet visible, puis un moment d’inactivité du navigateur (`requestIdleCallback`, 2 s au plus) ;
- connexion sans économiseur de données et plus rapide que la 2G (`navigator.connection`, lorsqu’il existe).

Un changement d’équipe ou un rafraîchissement annule la complétion prévue ; la nouvelle équipe est évaluée à son tour. Un échec en arrière-plan n’affiche aucune erreur et ne déclenche pas de nouvel essai automatique. La prochaine demande explicite repart d’un premier lot frais. Si une demande explicite rejoint une complétion en cours, son échec redevient visible. C’est aussi le cas de l’ouverture d’une vue qui exige l’historique complet : elle rejoint la complétion en cours et, en cas d’échec, affiche « Réessayer » au lieu d’un nouveau chargement automatique. Une complétion réussie compte comme une demande : les rafraîchissements après modification conservent l’historique complet jusqu’à sa republication atomique, comme pour un utilisateur ayant ouvert Analyses.

Les historiques de plus de 500 parties restent chargés à la demande. Le [retest de capacité](bench-history/capacity-2026-10-13.md) montrait une saturation à 25 ouvertures par seconde d’équipes de 1 000 parties. La limite, le délai et le nombre de lots simultanés sont des choix prudents, à ajuster après mesure en production.

## Rafraîchissements et changement d’équipe

Un changement d’équipe annule les chargements précédents. Les réponses tardives ne remplacent pas les données de l’équipe active. Une révocation d’accès pendant la pagination retire immédiatement les données de l’équipe concernée, puis recharge les appartenances encore autorisées.

Après une modification dans une vue qui exige tout l’historique, `refreshAll({ throwOnError: true })` attend le rafraîchissement complet. Le précédent historique complet reste disponible jusqu’à sa publication atomique. Les disponibilités du planning confirmées pendant cette attente sont fusionnées à nouveau au moment de la publication pour ne pas écraser un enregistrement récent.

## Coût SQL

Les résumés remplacent le champ `raw` par `null` dans le record PostgreSQL **avant** sa conversion JSON, puis retirent sa clé. Cela évite de sérialiser une timeline complète uniquement pour la supprimer immédiatement. Les autres colonnes, y compris les colonnes ajoutées ultérieurement, et les projections compactes utiles aux analyses sont conservées.

La taille des pages, les totaux et les autorisations serveur ne changent pas. Les métadonnées, débriefs et archives du bootstrap conservent leurs règles existantes ; cette correction ne rend donc pas tout le bootstrap indépendant du volume de données.

## Vérification et mesure

```sh
npm run verify
npm run bench:history
```

Le banc `bench:history` mesure séparément l’ouverture après la première page et la demande explicite d’analyse complète. Sa méthode 3 écrit `docs/bench-history/results-2026-10-13-progressive.json` et préserve les résultats antérieurs. Ce banc utilise PGlite local ; il ne mesure pas le réseau, le CDN Netlify ou les ressources Neon en production.

Les tests couvrent la pagination manuelle et complète, les données partielles, la déduplication, une analyse demandée pendant une page manuelle, les filtres exhaustifs, les réponses obsolètes, les changements d’équipe, les révocations, le réessai et un enregistrement du planning pendant le chargement. Ils couvrent aussi la limite de trois lots simultanés, l’assemblage de réponses arrivées dans le désordre, l’arrêt des lots voisins après un échec, la complétion en arrière-plan et ses conditions, ainsi que l’écran partagé maintenu puis libéré en cas d’erreur. Les tests SQL comparent exactement les anciennes et nouvelles projections, avec des valeurs nulles et des colonnes supplémentaires.

### Lots parallèles : mesure locale du 9 novembre 2026

Le banc `bench:history` a été rejoué avec le gestionnaire `bootstrap` réel, sur la version précédente puis sur la version parallèle, sur la même machine (Node 22.23, PGlite 0.5.13, une répétition chacune). Les durées comprennent l’ouverture et l’analyse complète demandée.

| Parties | Avant (lots successifs) | Après (3 lots simultanés) |
| --- | --- | --- |
| 100 | 208 ms | 166 ms |
| 500 | 985 ms | 900 ms |
| 1 000 | 1 917 ms | 1 627 ms |
| 3 000 | 5 208 ms | 5 444 ms |

Les écarts restent dans le bruit d’une répétition unique. Ce banc exécute les requêtes SQL une à une sur un moteur local, sans réseau : il vérifie l’historique complet, l’ordre et la validation des lots avec les réponses réelles du serveur, et l’absence de régression. Il ne peut pas montrer le gain attendu, qui porte sur les allers-retours réseau. Avec trois lots simultanés, 1 000 parties demandent 3 vagues de requêtes au lieu de 9. Ce gain reste une hypothèse tant qu’il n’est pas mesuré entre navigateur, Netlify et Neon.

Le [retest de capacité du 13 octobre 2026](bench-history/capacity-2026-10-13.md) utilise les handlers réels et un PostgreSQL natif local, avec des données synthétiques et sans accès aux services de production.

Une mesure de capacité doit distinguer le premier affichage et le téléchargement complet, conserver les échecs et les arrivées abandonnées, et indiquer l’infrastructure utilisée. Une faible latence d’ouverture locale ne certifie pas la tenue de 100 000 utilisateurs simultanés en production.
