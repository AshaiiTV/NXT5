# Effets autour du 5 au chargement

L’écran de chargement enrichit la sculpture existante avec des trajectoires lumineuses en profondeur, des facettes suspendues et une respiration lumineuse liée au reflet au sol. Le titre de phase et la progression conservent leur zone de lecture.

Les effets sont réalisés dans `AppLoadingScreen.jsx` et `AppLoadingScreen.css`, en SVG et CSS locaux. Ils ne nécessitent aucun package, moteur WebGL ou téléchargement supplémentaire. Le poster original et les cinq rôles sont conservés. L’animation ne conditionne pas la fin du chargement : le contenu apparaît dès que les données sont prêtes, sans durée minimale ni progression inventée.

Les décorations restent ignorées par les technologies d’assistance et ne capturent pas le pointeur. Sur mobile, les effets sont moins nombreux et moins intenses. Les modes mouvement réduit et performance conservent une scène fixe simplifiée.

La [charte canonique unique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) intègre cette évolution en version 1.65 dans le dépôt principal. Aucune copie de charte n’est créée.

La recherche de plugins a identifié MagicPath pour comparer et affiner des prototypes interactifs. Après sa connexion, son guide `animations` a été consulté pour la fluidité, le coût et le respect du mouvement réduit. Les effets livrés sont natifs et n’en dépendent pas.

## Vérification

Les captures et scripts locaux utilisent le vrai composant avec des phases et compteurs fictifs maintenus dans un harnais. Ils ne modifient aucune donnée ni session de production. Les preuves restent dans `artifacts/home-unified/` et ne sont pas déployées.

- `npm run verify` : 217 fichiers / 4 049 tests réussis, traductions et typage validés, build et 13 pages prérendues réussis.
- Les 48 tests existants du chargement passent aussi séparément : continuité des phases, sortie immédiate, données vides, erreur/reprise et progression réelle.
- Rendu contrôlé à 320 × 568, 360 × 640, 390 × 844, 768 × 1 024, 1 024 × 768, 1 440 × 1 000 et 844 × 390 : pas de débordement horizontal ni d’erreur JavaScript, images et polices chargées. Le socle est relevé sur les écrans mobiles courts pour rester au-dessus des icônes.
- Les neuf combinaisons FR/EN/ES et ouverture/connexion/synchronisation restent lisibles à 320 px.
- Le navigateur confirme le mouvement des effets, la conservation du même décor lors d’un changement de phase, l’absence de compteur inventé et l’arrêt complet des animations en mouvement réduit et mode performance.
