# Corrections complémentaires de l’audit NXT5

Ce lot traite les points restants de l’audit du 5 septembre, après les corrections du planning et des imports atomiques (`1d55738`).

| Point | Correction |
| --- | --- |
| Validation d’e-mail | Une seule écriture vérifie le jeton courant et son expiration. Les jetons remplacés et rejoués sont refusés. |
| Invitations | Les réponses d’équipe passent par une projection explicite. Les codes ne figurent que dans la liste filtrée par autorisation. |
| Lien direct vers une game | Chargement annulable par équipe/game, relance après annulation et invalidation au rafraîchissement. Une game hors de la page courante reste consultable. |
| Deuxième équipe | Création et jonction accessibles même avec une équipe existante ; liens d’invitation pris en compte. |
| Champion Pool | Agrégation par identifiant joueur et champion, remplacement transactionnel, préservation des entrées manuelles et avertissement si le recalcul échoue après un import réussi. |
| Build desktop | Node 24 et pnpm 11.19.0 alignés ; Windows, Mac Intel et ARM construits avant publication. Publication réservée à main et conditionnée aux contrôles web. Version importer 0.2.11. |
| Envois de vérification | Budget commun inscription/profil/renvoi, par compte et destinataire ; mot de passe actuel requis pour changer d’adresse. |
| Dépendances | Vite 7.3.6, Vitest 4.1.11 et plugin React 5.2.0 ; dépendances transitives corrigées. Audits npm et pnpm sans alerte connue au contrôle du 6 septembre. |
| Livraison web | CI sur PR et main : TypeScript, tests, build et audit de dépendances. Les contrôles précèdent aussi la publication Netlify. |
| Charge et maintenance | Sept pages chargées à la demande. AppContent passe d’environ 616 à 134 ko minifiés ; aucun module produit ne dépasse 500 ko. Bootstrap charge toutes les games de l’équipe active automatiquement, par lots de 100 avec participants associés ; détails de timeline différés. |
| Statistiques et pagination | L’analyse utilise tout l’historique par défaut, sans bouton de chargement manuel. Les pages sont assemblées avant d’exposer les données aux écrans d’analyse ; une erreur conserve le dernier historique complet et permet de réessayer. Résumés d’objectifs conservés pour les tendances, rapports liés accessibles et limites de compositions/archives appliquées à l’équipe active. |
| Migrations | DDL retiré des fonctions ; runner transactionnel, verrou PostgreSQL, empreintes et contrôle de version au démarrage. Voir [MIGRATIONS.md](../database/MIGRATIONS.md). |
| Exactitude et compatibilité | CS à 10/20 minutes indisponible avant le jalon, y compris dans l’importer desktop ; affectations adverses transmises par l’ancien endpoint d’import. |
| Partage | URL publique substituée au build, URL d’image absolue et véritable PNG livré à `/og-image.png`. |

Les vérifications combinent les composants React réels et les handlers exécutés avec PostgreSQL embarqué, via le constructeur de requêtes Neon. Elles couvrent les jetons concurrents, les quotas, les permissions, les navigations, la pagination, les réimports, les pools et les migrations (dont conservation d’un ancien planning et annulation des DDL en cas d’échec). L’accueil et la connexion compilés ont été ouverts dans un navigateur ; le PNG et les métadonnées ont été contrôlés par HTTP local.

Les tests n’envoient aucun e-mail et ne modifient aucune base distante. PGlite ne reproduit pas la contention entre plusieurs connexions Neon. Les parcours authentifiés sont validés sur fixtures React/PostgreSQL, sans compte de production. Les durées de migration et de chargement sur les volumes réels restent à mesurer en recette. La configuration distante Netlify n’a pas pu être inspectée avec le connecteur, qui demande une réauthentification.
