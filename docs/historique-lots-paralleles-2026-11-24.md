# Historique : lots parallèles — 24 novembre 2026

Remplace la PR #244, restée en conflit avec `main`.

## Repris

- `src/hooks/useTeamData.js` : une fois le total connu grâce au premier lot, les lots suivants de 100 parties sont demandés **trois à la fois au plus** (`HISTORY_CONCURRENCY`). Pour 1 000 parties, l’écran de synchronisation attend 3 vagues de requêtes au lieu de 9.
- Validation stricte de chaque lot (équipe, position, total, taille exacte, suite annoncée), assemblage dans l’ordre du serveur, arrêt des lots voisins au premier échec. `loadNextPage()` reste une requête unique.
- Tests : limite de trois lots simultanés, réponses arrivées dans le désordre, arrêt après échec ; tests de l’écran de chargement adaptés.

## Abandonné

- **Un seul écran d’attente** : déjà livré par #250 (« Charger toute l’équipe sur l’écran initial »), qui maintient l’écran partagé jusqu’à l’historique complet pour tout l’espace d’équipe.
- **Complétion en arrière-plan** (`prefetchHistory`, seuil de 500 parties) et **compteur dans la page** : depuis #250, l’historique complet est chargé avant l’ouverture de l’espace ; il ne reste rien à compléter après coup, et la page n’affiche plus qu’une erreur avec « Réessayer ».

## Limite

Le gain sur les allers-retours réseau n’est pas mesuré par `npm run bench:history` (SQL séquentiel, sans réseau). Chaque visiteur peut désormais émettre jusqu’à trois requêtes `bootstrap?matchesOnly=1` simultanées : à surveiller en production au regard du retest de capacité du 13 octobre.
