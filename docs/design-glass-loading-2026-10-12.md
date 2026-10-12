# Chargement en verre violet — 12 octobre 2026

L’écran de chargement de l’espace connecté reprend la matière et l’atmosphère de l’accueil : fond bleu nuit, nuages assombris, verre violet, reflets cyan/lavande/fuchsia et emblème officiel. La charte unique reste celle indiquée dans [AGENTS.md](../AGENTS.md).

Sur ordinateur, le titre « Cinq rôles. Une même direction. » et la progression occupent la gauche ; l’emblème suspendu dans un cadre prismatique et les cinq rôles League of Legends composent la droite. Le mobile empile ces éléments. Une disposition compacte conserve la lecture en paysage.

## Réalisation

- `AppLoadingScreen.jsx` et son CSS portent la composition. Le panneau de progression utilise les tokens de verre partagés du site.
- Le décor WebP existant de l’accueil est réutilisé, avec des voiles bleu nuit. Un WebP de l’emblème officiel en 512 px, de 43 460 octets, complète la source 256 px pour les écrans denses.
- Le prisme, ses biseaux et ses reflets sont dessinés en SVG. L’arrivée, le reflet initial, le léger flottement et les cinq signaux utilisent CSS, sans dépendance supplémentaire ni moteur 3D JavaScript.
- Le composant décoratif reste monté pendant les changements de phase. Les modes mouvement réduit et performance affichent la composition complète sans animation.

Le cycle réel Ouverture / Connexion / Synchronisation, les annonces accessibles et les valeurs issues des parties reçues restent inchangés. Les valeurs connues sont bornées entre zéro et le total ; sans total exploitable, l’état reste indéterminé. Aucun délai ni pourcentage simulé n’est ajouté. Les sorties de chargement et le pré-rendu des routes publiques conservent leur fonctionnement.

## Vérification

- `npm run verify` réussi : 209 suites, 3 915 tests, typage, 3 574 messages explicites couverts en anglais et espagnol, build et 13 pages prérendues.
- Tests ciblés du chargement, du démarrage, de la récupération et des traductions : 6 suites et 83 tests réussis.
- Audit des dépendances conforme à la politique du dépôt, avec son exception temporaire de build préexistante ; revue indépendante et `git diff --check` réussis.
- 108 combinaisons du composant réel : FR/EN/ES, trois phases, 1440 × 1000, 390 × 844, 320 × 740 et 844 × 390, en modes normal, mouvement réduit et performance. Aucun débordement horizontal, aucune erreur JavaScript/CSP ou image manquante relevée.
- Progression 0 → 7 → 18 sur 18, valeurs négatives ou excessives et total nul contrôlés. Une seule instance conserve la scène pendant le cycle.
- 276 mesures sur 36 scénarios couvrent le cycle complet du flottement : distance minimale de 26,17 px entre le contour visible du prisme et les rôles, au-delà des 24 px requis. Les modes sans mouvement sont statiques.
- Inspection visuelle des captures ordinateur, téléphone et paysage. À 320 × 740, le titre et la barre restent dans la première vue ; les dernières étapes et le pied peuvent nécessiter un défilement vertical naturel. Les formats 390 × 844 et 844 × 390 tiennent intégralement.

Les contrôles utilisent des données fictives et un serveur compilé soumis à la CSP du site. Ils ne lisent ni ne modifient les données privées de production. Les captures, rapports et contrôles de publication sont conservés localement dans `artifacts/glass-loading/` du checkout de livraison ; ils ne sont pas embarqués dans le site. La charte canonique consigne la publication une fois celle-ci vérifiée.
