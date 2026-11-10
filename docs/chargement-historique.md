# Chargement des historiques

À l’ouverture de l’espace d’équipe, l’écran de synchronisation initial récupère **toutes les parties de l’équipe** avant d’afficher la page demandée. Le serveur envoie les parties par lots de 100 au maximum ; le compteur de cet écran suit les lots reçus. L’accueil, l’effectif, la gestion d’équipe, le planning, les parties et les analyses utilisent ensuite le même historique complet en mémoire. La navigation entre ces pages ne déclenche aucun second chargement d’équipe.

Un rafraîchissement du navigateur redémarre l’application et refait cette synchronisation complète dans le même écran initial. Le changement d’équipe synchronise également la nouvelle équipe avant de montrer ses données. Les paramètres du compte restent accessibles indépendamment des données d’équipe.

Si une page de l’historique échoue, l’écran de synchronisation se ferme et une vue d’erreur propose « Réessayer ». Les analyses partielles ne sont pas présentées comme complètes. Le réessai repart d’un premier lot frais pour vérifier le total actuel. Si le compte n’a encore aucune équipe, le premier lot vide ouvre directement l’espace de création.

## Garanties des données

- `bootstrapReady` indique que le premier lot appartient à l’équipe sélectionnée ; l’espace d’équipe attend aussi `data.historyComplete` avant de s’afficher.
- `data.historyComplete` n’est vrai que lorsque toutes les parties ont été reçues et validées. Les pages supplémentaires sont contrôlées pour l’équipe, les identifiants uniques, le total et la progression de pagination.
- `loadingProgress` suit chaque lot dans l’écran initial. Les parties complètes sont publiées ensemble après validation ; les vues ne passent pas par un état d’analyse partielle.
- `refreshAll()` récupère par défaut l’historique complet. Lors d’une actualisation interne de l’équipe déjà affichée, les anciennes données complètes restent visibles jusqu’à la publication du nouvel ensemble.
- `ensureHistory()` et `loadNextPage()` restent disponibles pour les flux techniques et dédupliquent les requêtes concurrentes. Un réessai après erreur repart d’un nouveau bootstrap.
