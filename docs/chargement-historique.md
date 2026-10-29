# Chargement des historiques

L’ouverture de l’espace d’équipe récupère une première page de **100 parties au maximum**. L’accueil, l’effectif, la gestion d’équipe et le planning deviennent utilisables sans télécharger systématiquement toutes les anciennes parties.

La liste Parties affiche immédiatement le premier lot, trié par date d’import, avec le total serveur et le nombre de parties chargées. « Charger la suite » ajoute au maximum 100 parties, sans enchaîner automatiquement les autres pages. La pagination d’affichage de 10, 25 ou 50 lignes parcourt les parties déjà chargées.

Une recherche, un filtre ou un autre tri demande l’historique complet avant d’afficher ses résultats. Les vues de détail d’une partie, de groupes et d’adversaires, l’import, Débriefs, Analyses, Profil et Draft demandent également cet historique. Leur contenu reste en chargement tant que toutes les pages n’ont pas été reçues et validées ; la navigation reste disponible. Sur l’effectif et la gestion d’équipe, les statistiques de champions et le contrôle des données se chargent avec l’action « Charger les analyses de l’équipe ».

## Données partielles et analyses

- `bootstrapReady` indique que le premier jeu de données appartient à l’équipe sélectionnée et peut être affiché.
- `data.historyComplete` indique que toutes les parties sont présentes. Il reste faux pour une première page ayant une suite.
- `loadNextPage()` ajoute une seule page validée à la liste. Des clics concurrents partagent la même requête.
- `ensureHistory()` demande les pages restantes et déduplique les appels concurrents. Elles ne sont publiées qu’ensemble, après validation de leur équipe, de leurs identifiants uniques, de leur total et de la progression de pagination. Si une page manuelle est déjà en vol, la demande complète attend sa fin puis reprend au curseur suivant.
- `historyLoading`, `historyError` et `loadingProgress` pilotent le chargement, le réessai et sa progression. Un échec de pagination conserve la première page utilisable et ne transforme jamais les données partielles en analyse complète.
- Une nouvelle tentative après erreur repart d’un premier bootstrap frais : elle ne réutilise pas un total devenu obsolète.

L’accueil utilise le total de parties calculé par le serveur. Ses compteurs exhaustifs et ses conclusions sur l’ensemble de l’historique restent réservés aux données complètes. Une première page triée par date d’import ne permet pas de conclure à l’absence de partie jouée récemment dans toute l’équipe.

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

Le banc `bench:history` mesure séparément l’ouverture après la première page et la demande explicite d’analyse complète. Sa méthode 3 écrit `artifacts/bench-history/results.json`, ignoré par Git, et préserve les résultats historiques de `docs/bench-history/`. La [procédure du banc](../tools/bench-history/README.md) précise les répétitions et la conservation des campagnes. Ce banc utilise PGlite local ; il ne mesure pas le réseau, le CDN Netlify ou les ressources Neon en production.

Les tests couvrent la pagination manuelle et complète, les données partielles, la déduplication, une analyse demandée pendant une page manuelle, les filtres exhaustifs, les réponses obsolètes, les changements d’équipe, les révocations, le réessai et un enregistrement du planning pendant le chargement. Les tests SQL comparent exactement les anciennes et nouvelles projections, avec des valeurs nulles et des colonnes supplémentaires.

Le [retest de capacité du 13 octobre 2026](bench-history/capacity-2026-10-13.md) utilise les handlers réels et un PostgreSQL natif local, avec des données synthétiques et sans accès aux services de production.

Une mesure de capacité doit distinguer le premier affichage et le téléchargement complet, conserver les échecs et les arrivées abandonnées, et indiquer l’infrastructure utilisée. Une faible latence d’ouverture locale ne certifie pas la tenue de 100 000 utilisateurs simultanés en production.
