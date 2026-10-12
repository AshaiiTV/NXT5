# Accueil NXT5 — 12 octobre 2026

La scène « verre violet » et les trois aperçus interactifs validés remplacent l'ancien accueil public. Le point d'entrée reste `/`, avec le pré-rendu, les métadonnées, le consentement et la navigation de l'application.

- Le volume 5 est une géométrie Three.js locale. GSAP/ScrollTrigger animent la scène au défilement natif. Ces bibliothèques sont chargées à la demande dans des modules distincts.
- Le poster conserve une entrée complète sans WebGL, en mouvement réduit ou en mode GPU limité. Le bouton de réduction des animations conserve la position dans le contenu. Les ressources et observateurs sont libérés à la sortie.
- Analyse, Draft et Planning présentent uniquement des données fictives. Le curseur, le montant d'or, l'heure et les notes partagent le même instant sélectionné. Le Dragon à 20:00 et le Nashor à 28:30 sont des repères illustratifs sélectionnables.
- Les contrôles, traductions FR/EN/ES et liens légaux restent accessibles. Les positions et couleurs statiques utilisent le CSS pour respecter la CSP existante.

Les images de champions proviennent de Data Dragon : [provenance et empreintes](champion-assets.json). Le décor généré et le poster de la géométrie sont décrits dans [la provenance du décor](asset-provenance.json). Les icônes de rôles, les objectifs et les logos réutilisent les ressources du site.

Vérifications : `npm run verify`, `node tools/audit-dependencies.mjs`, contrôles visuels du rendu prérendu avec la CSP, navigation et interactions sur ordinateur et mobile. Le test `src/__tests__/home-motion.test.jsx` couvre le rendu sans navigateur, les valeurs de la courbe, les objectifs, les trois outils et la navigation clavier/modifiée.
