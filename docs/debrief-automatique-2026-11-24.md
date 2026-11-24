# Débrief automatique fusionné — 24/11/2026

Dans l'onglet Résumé d'une partie, la section « Débriefs enregistrés » affichait deux entrées pour le même contenu :

- « Lecture automatique de la partie » : le texte coach généré à l'affichage (verdict, à garder, à corriger, points vidéo, plan…) ;
- « Review — <équipe> — <identifiant> » : le compte rendu enregistré à l'import (`source = 'auto'`), une liste Markdown brute des statistiques joueurs.

## Changement

- Une seule entrée, « Débrief automatique de la partie » (`src/components/games/AutoDebrief.jsx`), datée par le compte rendu d'import quand il existe.
- Le compte rendu d'import n'est plus listé à part quand le débrief automatique est affiché (`isGeneratedImportReport` : `source = 'auto'` et contenu commençant par `## Review —`). Un rapport automatique modifié, ou dont la partie n'a pas encore ses données, reste lisible comme avant.
- Contenu visuel : signal principal chiffré, trois cartes À garder / À corriger / Standard attendu, une carte par joueur (champion, poste, K/D/A, or, dégâts, vision, sbires, or face à l'adversaire de poste, morts sans échange), points à revoir en vidéo numérotés, plan Avant / Pendant / Après, questions de débrief et critère de validation.
- Retirés car redondants ou génériques : textes « weakside / strongside » identiques pour chaque joueur, bloc « Repères » déjà présent dans le récapitulatif visuel.
- Styles dans `auto-debrief.css` (charte Prisme : succès `#6EE7B7`, danger rose, cyan/violet, requêtes de conteneur pour mobile).

## Vérification

- Test `unified-games-view` : un seul débrief automatique, compte rendu brut absent, joueurs et points vidéo affichés.
- Aperçu à 1 100 px et 375 px, sans débordement horizontal.
