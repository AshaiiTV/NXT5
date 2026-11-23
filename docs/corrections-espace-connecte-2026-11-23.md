# Corrections de l’espace connecté — 23 novembre 2026

Corrections issues d’une relecture de l’espace connecté (équipe, profil, scrims, planning, tendances, draft).

1. **Lien d’invitation (Équipe)** : l’actualisation suit toujours la création du code, même si le presse-papiers est refusé (Safari/iOS). En cas de refus, un avertissement non bloquant s’affiche et le lien apparaît dans un champ « Lien d’invitation à copier ».
2. **Bilan coaching (Profil)** : une note non enregistrée est conservée par joueur ; changer de profil puis revenir la restitue.
3. **Scrims — erreur de chargement** : la dernière liste reste affichée sous le message d’erreur ; l’état vide n’apparaît plus quand aucune liste n’a été chargée.
4. **Scrims — changement d’équipe** : chaque chargement annule le précédent et une réponse tardive pour l’ancienne équipe est ignorée.
5. **Scrims — publication** : le bouton « Publier la proposition » est désactivé pendant toute autre action ; la date ne peut plus être dans le passé (`min` et contrôle avec message).
6. **Planning — actualiser les précisions** : l’enregistrement préalable ne concerne que l’équipe affichée ; un échec d’enregistrement est désormais signalé (le brouillon reste conservé pour une nouvelle tentative) et une erreur d’actualisation est interceptée.
7. **Tendances** : une actualisation en arrière-plan ne ferme plus la fenêtre des sources ni le statut d’export ; seul un changement de sélection de parties les réinitialise.
8. **Compositions (Draft)** : supprimer la composition en cours d’édition réinitialise le formulaire ; l’enregistrement suivant crée une nouvelle composition.
9. **Planning — menu de séance** : le menu se ferme quand le focus clavier le quitte ou lors d’un défilement, et le focus revient à la cellule.
10. **Image d’équipe** : le champ de fichier est réinitialisé, choisir de nouveau la même image relance le chargement.

Tests ajoutés : `team-access`, `frontend-async-regressions`, `scrims-ui`, `draft-workspace`, `planning-interactions`.
