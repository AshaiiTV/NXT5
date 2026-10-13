# Effets autour du 5 au chargement

L’écran de chargement anime la lumière du verre : un reflet de studio suit la silhouette du 5, deux voiles de réfraction passent derrière la sculpture et des caustiques effilées éclairent le sol. Le titre de phase et la progression conservent leur zone de lecture. Aucun anneau ni éclat flottant ne détourne l’attention de la sculpture.

Le surtitre répétant le nom de la phase est retiré : « Synchronisation en cours » porte seul le message principal, sans « Synchronisation » juste au-dessus. La même simplification s’applique à l’ouverture et à la connexion ; la liste des étapes reste sous la progression.

Les effets sont réalisés dans `AppLoadingScreen.jsx` et `AppLoadingScreen.css`, en CSS local. Ils ne nécessitent aucun package, moteur WebGL ou téléchargement supplémentaire. Le poster original et les cinq rôles sont conservés. L’animation ne conditionne pas la fin du chargement : le contenu apparaît dès que les données sont prêtes, sans durée minimale ni progression inventée.

Les décorations restent ignorées par les technologies d’assistance et ne capturent pas le pointeur. Le masque alpha reprend exactement le poster existant ; seul son gradient intérieur bouge, sans déplacer la silhouette. Si le masque n’est pas pris en charge, le poster reste visible seul. Sur mobile, un seul voile et une seule caustique sont conservés. Les modes mouvement réduit et performance conservent une scène fixe simplifiée.

La [charte canonique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) intègre cette évolution en version 1.66 dans le dépôt principal. Aucune copie de charte n’est créée.

La recherche de plugins a identifié MagicPath pour comparer et affiner des prototypes interactifs. Après sa connexion, son guide `animations` a été consulté pour la fluidité, le coût et le respect du mouvement réduit. Les effets livrés sont natifs et n’en dépendent pas.

## Vérification

Les captures et scripts locaux utilisent le vrai composant avec des phases et compteurs fictifs maintenus dans un harnais. Ils ne modifient aucune donnée ni session de production. Les preuves restent dans `artifacts/home-unified/` et ne sont pas déployées.

- Traductions et typage validés. La suite complète a exécuté 4 049 tests : 4 044 réussis et cinq dépassements du délai de 5 secondes dans `i18n-components` et `review-backfill`, sur une machine fortement sollicitée. Ces deux fichiers relancés avec un seul worker et les délais habituels passent intégralement.
- Les 48 tests existants du chargement passent aussi dans cette relance (64 tests réussis au total) : continuité des phases, sortie immédiate, données vides, erreur/reprise et progression réelle.
- Build de production réussi, avec les 13 pages prérendues et contrôlées.
- Rendu contrôlé à 320 × 568, 360 × 640, 390 × 844, 768 × 1 024, 1 024 × 768, 1 440 × 1 000 et 844 × 390 : pas de débordement horizontal ni d’erreur JavaScript, images et polices chargées. Les caustiques restent au-dessus des icônes sur les écrans mobiles courts.
- Les neuf combinaisons FR/EN/ES et ouverture/connexion/synchronisation restent lisibles à 320 px.
- Le navigateur confirme le mouvement des effets, la conservation du même décor lors d’un changement de phase, l’absence de compteur inventé et l’arrêt complet des animations en mouvement réduit et mode performance.
