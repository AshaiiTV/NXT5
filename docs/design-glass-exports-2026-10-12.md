# Verre violet dans les exports — 12 octobre 2026

Les images exportées reprennent la direction artistique de l’accueil et du site : fond bleu nuit, verre violet, reflets cyan/lavande/fuchsia, portraits officiels et repères League of Legends. La charte unique reste celle indiquée dans [AGENTS.md](../AGENTS.md). Ce rapport décrit la réalisation et ses contrôles.

## Périmètre

| Visuel | Composition conservée et habillage ajouté |
| --- | --- |
| Partie, site et Discord | Même PNG complet de 1440 px : dix joueurs, sorts, builds, statistiques et cinq objectifs illustrés par les assets locaux. Verre dans les en-têtes et le bilan, fond stable sous les lignes. |
| Groupe du site | Rapport de 1600 px avec bilan, toutes les parties et les champions joués ; colonne de l’équipe repérée, sections et portraits accordés au verre violet. |
| Groupe Discord | Format compact de 960 px, bilan et toutes les parties, panneaux de verre par match. |
| Tendances | Rapport de 1600 px, résultats par côté, cinq icônes de rôle, portraits des champions et tables lisibles. |
| Profil analytique | Rapport de 1440 px, identité et rôle du joueur, mesures et table complète des champions. |
| Pool déclaré | Rapport de 1440 px, regroupement par statut, lignes de champions et portraits encadrés. |
| Carte joueur et Wrapped | Sept compositions de 1080 × 1620 px : recto, verso, bilan, signature, partie marquante, évolution, équipe. Plans de verre et reflets internes, portraits entiers, données et règles de sélection conservées. |
| Partage du site | Image Open Graph de 1200 × 630 px régénérée depuis les assets existants : atmosphère de l’accueil, emblème officiel et cinq rôles. |

Cela représente **13 compositions PNG exportables**, auxquelles s’ajoute l’image Open Graph. Les cinq modèles PNG et le CSV de la bibliothèque administrative restent les mêmes. Les exports de données CSV/JSON et les textes Discord ne changent pas.

## Implémentation

`src/utils/png-report.js` centralise les couleurs et surfaces Canvas. Les panneaux de lecture gardent un fond stable ; les remplissages sémantiques explicites ne reçoivent pas le dégradé de marque. Les reflets sont déterministes et dessinés sans texture distante ni nouvelle dépendance. Les couleurs de côté restent distinctes de victoire/défaite.

Les calculs, périmètres, unités, dénominateurs, valeurs absentes et zéros mesurés sont conservés. Les listes longues sont réunies dans **un fichier PNG unique**, sans ZIP ni retrait de lignes. Carte & Wrapped exporte toujours la face ou le chapitre choisi.

Les adaptateurs de partie partagent les cinq objectifs locaux par une liste fixe. Le serveur ne récupère aucune URL ou aucun chemin fourni par le snapshot ; une icône absente conserve le libellé et les chiffres. Netlify embarque ces PNG avec le logo, Inter et le moteur Canvas natif existants. Les versions de rendu deviennent `nxt5-game-png-5` et `nxt5-discord-group-2` pour invalider les anciens visuels lors des nouvelles publications. Aucun historique n’est renvoyé automatiquement.

## Vérification

- `npm run verify` réussi : 209 suites / 3 915 tests, typage, 3 577 messages traduits, build et 13 pages prérendues.
- 20 rendus réels du navigateur en FR/EN/ES : aucune erreur JavaScript, image manquante ou position de texte hors limites relevée. Inspection des fichiers PNG, dont les cas vides, longs et volumineux.
- Groupes de 50 parties, profils de 50 champions et pools de 50 champions : tous les éléments présents. À 390 px, la chaîne de téléchargement produit exactement un PNG par cas, identique au fichier contrôlé ; aucun ZIP.
- Les sept compositions Carte & Wrapped sont générées par les fonctions de production, avec Inter et de vrais portraits officiels. Cas sans données, sans images, nom long et image horizontale contrôlés.
- Rendu serveur : cinq cas de partie et trois groupes synthétiques, parité avec la composition navigateur, objectifs indisponibles et invalidation des caches couverts par les tests. Mesures Windows locales : environ 765–809 ko par partie et 2 356 967 octets pour 80 parties, sous le budget existant de 3 Mio. Ce benchmark n’est pas une mesure de performance de Netlify.
- Audit des dépendances conforme à la politique du dépôt, avec son exception temporaire de build préexistante ; revue indépendante et `git diff --check` réussis.

Le build local servi confirme quatre routes et 79 ressources JavaScript/CSS, la nouvelle palette Canvas, le modèle de partie version 5, les cinq objectifs et l’image Open Graph identique au fichier généré. Les contrôles de publication sont consignés dans la charte et les preuves locales `artifacts/glass-exports/` du checkout de livraison. Les scripts et captures de contrôle ne sont pas embarqués dans le site.

Ces vérifications utilisent des données fictives ; aucun message Discord n’a été envoyé et aucune donnée privée de production n’a été modifiée. Le script `npm run discord:check-bundle` vérifie les cinq objectifs, quatre polices, logo et binaire Linux x64 dans les sept ZIP Netlify, lorsqu’il est exécuté après leur construction. Il n’est pas exécuté automatiquement par la CI actuelle ; les tests locaux Windows ne certifient pas à eux seuls le contenu des ZIP Lambda.
