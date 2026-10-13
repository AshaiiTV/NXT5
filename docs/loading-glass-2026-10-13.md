# Chargement NXT5 — verre sculptural

13 octobre 2026. L’utilisateur demande une refonte complète de l’écran de chargement autour du 5 en verre existant, dans la nouvelle direction artistique, et autorise sa publication directe.

Ce document consigne l’implémentation et ses contrôles. La [charte graphique canonique](../../../2026-05-05/utilise-github-pour-examiner-mes-pr/NXT5/docs/charte-graphique.md) reste l’unique référence graphique ; ce rapport n’en est pas une copie.

## Composition et comportement

`AppLoadingScreen.jsx` et `AppLoadingScreen.css` remplacent la scène Nexus par une composition asymétrique : sculpture 5 à gauche, titre de phase et progression à droite, wordmark en haut à gauche et repère de phase en haut à droite. Le décor garde le côté du texte calme. Les cinq rôles apparaissent dans une rangée ouverte sous la sculpture, avec les composants de marque existants.

Sous 761 px, la scène et l’état s’empilent. Des règles dédiées resserrent les petites hauteurs ; en paysage, à partir de 640 px de large et jusqu’à 540 px de haut, les deux colonnes compactes conservent l’état et ses étapes, tandis que la signature décorative disparaît. Les trois étapes peuvent revenir à la ligne.

Le poster du 5 est une image immédiate (`loading="eager"`, `fetchPriority="high"`), sans moteur WebGL. Le mouvement utilise uniquement CSS : entrée brève par opacité et transformation, suspension verticale de 5 px de part et d’autre et barre indéterminée. `prefers-reduced-motion: reduce` et `html.nxt5-low-gpu` coupent animations et transitions ; le mode performance retire aussi l’atmosphère bitmap et les filtres.

Le modèle de chargement reste celui d’`AppLoadingProvider` : une seule instance traverse l’ouverture du module, la vérification de session et la synchronisation initiale. Le titre et la description reflètent ces phases. Une synchronisation paginée affiche le nombre réellement reçu sur son total connu ; sinon la barre reste indéterminée. Aucun pourcentage n’est extrapolé depuis le temps écoulé. Aucun délai minimal, minutage de sortie ou attente d’asset ne retarde l’ouverture des données prêtes, même vides.

La décoration est `aria-hidden`. Le statut réel conserve son annonce polie ; la barre expose les valeurs uniquement lorsqu’elles sont connues et les étapes annoncent leur état courant ou terminé. Les libellés utilisent les traductions déjà existantes. La refonte ne modifie pas l’authentification, les requêtes, les droits ou les données.

## Contrôles réalisés

Le navigateur charge le vrai composant React dans un harnais local permettant de maintenir les trois phases et des compteurs de démonstration. Ce harnais ne fait pas partie de l’application publiée et ne modifie aucune session ni donnée de production.

- **Responsive :** 320 × 568, 360 × 640, 390 × 844, 768 × 1 024, 1 024 × 768, 1 440 × 1 000 et 844 × 390 px. Aucun débordement horizontal global ; titre, compteur et étapes restent dans la fenêtre. Captures relues sur bureau, mobile, petit mobile de 320 px et paysage.
- **Langues et phases :** les neuf combinaisons français/anglais/espagnol et ouverture/connexion/synchronisation ont été contrôlées à 320 × 568 px, sans débordement. Le compteur connu correspond à 48 parties reçues sur 154 dans cet exemple de test.
- **Mode performance :** contrôle dans le navigateur en synchronisation sans total connu. L’animation de la sculpture et celle de la barre sont à `none`, l’atmosphère est masquée, le 5 et l’état restent affichés et la barre ne possède pas de `aria-valuenow` inventé.
- **Mouvement réduit :** règle CSS relue, couvrant toutes les animations et transitions du composant. La préférence système n’a pas été émulée dans le navigateur ; ce contrôle ne constitue donc pas une certification d’exécution de ce mode.
- **Documentation :** lien vers la charte canonique vérifié et mise à jour à son emplacement unique. Aucun doublon de charte ni PDF créé.

`npm run verify` réussit : **215 suites et 3 991 tests**, vérification TypeScript, couverture de **3 611 messages explicites en anglais et espagnol**, build Vite et validation SEO des **13 pages pré-rendues**. Le premier lancement concurrent avait atteint le délai maximal sur six tests de `review-backfill` ; cette suite passe ensuite seule (9 tests), puis le contrôle complet passe à nouveau en 127,10 s, sans modification de son code. Le build conserve l’avertissement existant sur certains bundles de plus de 500 Ko.

Les preuves locales sont enregistrées dans `artifacts/loading-glass/responsive-checks.json`, `language-phase-checks.json` et les captures du même dossier. Ces fichiers de travail ne sont pas déployés.

## Assets et provenance

- **Sculpture :** `public/assets/home-motion/glass-poster.webp`, 729 × 665 px, 46 460 octets. Poster transparent existant, réutilisé sans modification. La silhouette, les facettes et les couleurs du 5 restent celles de l’accueil et de la connexion.
- **Fond :** `public/assets/loading/glass-atmosphere.webp`, 1 600 × 900 px, 22 656 octets. Image de décor créée le 13 octobre 2026 avec l’outil intégré ImageGen, puis optimisée par `optimizeAsset` du dépôt en WebP, qualité 82. Elle apporte le sol de verre fumé, la lumière violette et les caustiques ; aucun logo, chiffre ou texte n’y est généré.
- **Source du décor :** `/Users/sachadegouzon/.codex/generated_images/01a13476-a35c-7400-addf-8f694a6857fd/exec-272e6630-e3b0-4f5c-9283-6d3bf5d3eaaa.png`. Cette source locale ne fait pas partie des fichiers publiés.

Prompt exact transmis à ImageGen :

```text
Use case: stylized-concept. Asset type: atmospheric background for NXT5 premium esports app loading screen, landscape 16:9. Generate ONLY the backdrop: an exquisitely rendered, almost-black midnight navy (#111827) infinity studio with a low glossy smoked-glass floor, soft violet volumetric haze and delicate prismatic cyan-to-amethyst-to-fuchsia caustics refracting across the lower left third. A luminous broad elliptical pool of violet light around 35% across and 68% down grounds a separate floating glass sculpture that will be added in code. The upper two thirds and entire right half are very dark, smooth clean negative space for UI and the sculpture. Subtle diagonal sheets of refracted light at the far left edge, physically beautiful optical depth, editorial 3D product campaign, polished luxury esports mood, quiet and rich, extraordinarily refined. Restrained purple light, no blown-out bloom, no grain. Seamless fading to #111827 at all edges. No numeral, no letters, no logo, no icons, no interface, no visible objects or props, no planets, no sparks, no stars, no watermark. Background only, not a website mockup. Landscape composition.
```
