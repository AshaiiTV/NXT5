# Actions d’une partie — 24 septembre 2026

L’import appartient à la bibliothèque et à la liste des groupes. Dès qu’une partie est ouverte, son bouton et son dialogue disparaissent, même avec une ancienne URL combinant `match` et `import=1`. Les changements de sélection, le retour et la suppression retirent le paramètre d’import pour éviter une réouverture involontaire. L’[extension aux groupes](group-discord-export-2026-09-24.md) applique également cette règle dans le détail d’un groupe.

« Exporter sur Discord » remplace « Publier sur Discord » près d’« Exporter PNG ». Cet accès reste visible pour le propriétaire et le staff autorisé. La fenêtre explique un bot indisponible, une équipe non reliée, une erreur ou un salon manquant. L’unique destination de publication accessible est présélectionnée ; plusieurs destinations exigent un choix. L’aperçu puis « Publier dans #… » réutilisent le circuit du bot existant, avec les mêmes droits, révisions, pauses et protections contre les doublons. Le salon des commandes ne remplace pas la destination de publication.

Le clic « Publier » traite immédiatement la publication demandée, sans attendre les huit secondes réservées aux imports automatiques ni les autres travaux de la file. Une ancienne tentative bloquée est remise en traitement. La fenêtre affiche « Envoi en cours… », puis la confirmation « Publié sur Discord » et le lien du message, ou le motif actuel de refus. L’historique n’est plus chargé ni affiché dans cette fenêtre ; les références techniques restent conservées pour éviter les doublons et permettre le suivi administratif.

Chaque clic reçoit un identifiant de demande associé aux travaux réellement créés ou repris. Si la réponse réseau se perd ou si un traitement est encore en cours, la fenêtre vérifie automatiquement cette demande, sans nouvel envoi. Une confirmation incertaine reste à vérifier ; une demande sans reçu peut être relancée explicitement avec le même contrôle serveur contre les doublons. Aucune migration ou purge de données n’est nécessaire.

Vérification de ce parcours : contrôle TypeScript, 2 020 tests et build de production réussis ; audit des dépendances sans vulnérabilité. Les tests couvrent l’envoi immédiat, la reprise après un jeton refusé, les doubles clics, les réponses perdues, les erreurs précises et la corrélation des reçus par équipe. Le navigateur de contrôle local ayant refusé l’URL de test, aucune nouvelle validation visuelle ou livraison Discord réelle n’est revendiquée.

La [charte unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) a été mise à jour en version 1.45 à son emplacement canonique ; aucune copie locale n’est créée.

## Validation

- Contrôle TypeScript et build de production réussis, avec le runtime Node fourni par l’espace de travail.
- Suite complète : 108 suites réussies et un timeout à 5 secondes dans un test de migration sans rapport avec le changement. La suite de migrations relancée seule réussit ses 15 tests.
- Après la correction du retour par suppression : 92 tests réussis dans `discord-ui.test.jsx` et `unified-games-view.test.jsx`.
- Audit du routage et 121 tests backend réussis dans `discord-queue`, `discord-security` et `discord-runtime` : correspondance équipe/partie/destination, droits, révision et gestion des doublons.
- Navigateur Chromium, vrais composants `GameWorkspace`, `Sidebar` et `Topbar`, avec données et API simulées : 360, 390, 768, 1024 et 1440 px. Barre d’actions et fenêtre sans débordement horizontal, contrôles d’au moins 44 px, présélection du salon unique, aperçu, retour au groupe, état non relié, fermeture Échap et retour du focus vérifiés.

Le harness et les captures restent dans le dossier local ignoré `responsive-audit-shots/game-discord-actions/`. Aucun envoi Discord réel ni déploiement de production n’a été effectué pendant ces contrôles.
