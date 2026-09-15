# Discord NXT5 - contrôle de l’interface

15 septembre 2026. Référence : [charte graphique 1.22](charte-graphique.md).

## Périmètre vérifié

Les vrais composants React et le CSS du checkout ont été ouverts dans Chromium avec des réponses API locales simulées. Les noms d’équipe et de salon sont fictifs. L’aperçu utilise un PNG produit par le véritable moteur partagé. Aucun message n’a été envoyé à un serveur Discord pendant ces contrôles d’interface.

- Réglages d’équipe : salons, catégories, mention, mode automatique, pause, erreurs et historique.
- Partage d’une game : ouverture à la demande, choix du salon, aperçu texte et PNG, demande de publication puis affichage dans l’historique.
- Envoi incertain : association à un identifiant de message valide, sans commande de renvoi.
- États React : service indisponible, droits insuffisants, connexion expirée ou déconnectée, annulation d’un ancien aperçu après changement d’équipe ou de game.

## Résultats navigateur

| Vue | Largeurs testées | Résultat |
| --- | --- | --- |
| Réglages | 360, 390, 768, 1 024, 1 440 px | Largeur du document égale à celle de la fenêtre ; aucun débordement horizontal global. |
| Partage avec aperçu | 360 px | PNG de 1 200 px affiché à environ 289 px, sans déformation ; message lisible séparément et téléchargement du PNG disponible. |
| Association d’un message | 360 px | Formulaire et actions empilés, champ à 16 px, identifiant entier lisible. |
| Contrôles | Réglages aux cinq largeurs | Boutons de 2 px de rayon ; sélecteurs à 16 px sur les deux largeurs mobiles. |
| Exécution | Tous les scénarios ci-dessus | Aucune erreur JavaScript de page. |

Les captures ont été inspectées visuellement : titres, boutons, formulaires, messages d’erreur et images restent dans leur surface. Les autres pages du produit et les interactions avec un vrai serveur Discord relèvent de validations distinctes.

## Captures conservées

- [Réglages sur mobile, 360 px](assets/discord-qa/settings-360.webp).
- [Réglages sur bureau, 1 440 px](assets/discord-qa/settings-1440.webp).
- [Aperçu et publication sur mobile](assets/discord-qa/share-360.webp).
- [Association d’un message incertain sur mobile](assets/discord-qa/association-360.webp).

## Vérifications automatisées

Les suites `discord-ui`, `unified-games-view`, `review-match-details`, `workspace-pages` et `team-data` passent ensemble : **60 tests**, au moment de cette vérification. Elles couvrent notamment :

- Paramètre d’équipe transmis à bootstrap, pagination complète et refus d’un lien non autorisé.
- Prévisualisation obligatoire, révision numérique conservée, y compris zéro, et publication de texte seul si le visuel est indisponible.
- Absence de réglages pour les joueurs et de renvoi aveugle pour un état incertain.
- Validation de l’identifiant Discord avant association et confirmation du retrait d’un message.
- Annulation des réponses obsolètes lors d’un changement de contexte.

Le contrôle complet du dépôt reste `npm run verify` ; le nombre ci-dessus décrit les seules suites ciblées de cette intervention.

## Charte PDF

Le [PDF de la charte](charte-graphique.pdf) a été régénéré depuis le Markdown 1.22 : **23 pages**, métadonnées à jour et douze sections principales conservées. Toutes les pages ont été rendues avec Poppler, puis inspectées ; la page Discord a aussi été lue à taille supérieure. Le code d’exemple reste sur une même page. Aucun caractère ne dépasse la zone de sécurité vérifiée dans le PDF.

Le générateur réutilisable est `tools/render-charte-graphique.py`. Il nécessite Python avec ReportLab et utilise Arial sur macOS ou DejaVu Sans sur Linux pour la documentation ; la fiche PNG des games utilise bien sa police Inter dédiée, décrite dans la charte.
