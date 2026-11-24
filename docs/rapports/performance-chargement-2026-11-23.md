# Performance de chargement du site — 2026-11-23

Objectif : réduire ce que télécharge chaque visiteur sans changer l’affichage.
Mesures : `npx vite build --manifest`, tailles gzip (niveau 9) des fichiers
`dist/assets` sur le chemin critique de chaque page.

## Changements

- **Catalogues i18n aplatis au build** (`tools/i18n-catalogue-plugin.mjs`, branché
  dans `vite.config.js`). Pendant `vite build`, `catalogue-en.js` et
  `catalogue-es.js` sont évalués dans Node (même fusion, même priorité) et
  remplacés par un objet JSON. Chaque langue ne télécharge plus que ses propres
  textes (avant : un bloc partagé contenait l’anglais **et** l’espagnol).
  Rien n’est généré dans le dépôt ; le développement, les tests, le prerender et
  `npm run i18n:check` lisent toujours les sources. Test d’égalité :
  `src/__tests__/i18n-flat-catalogue.test.js`.
- **Pages publiques découpées** :
  - `PublicChrome.jsx` (en-tête, pied de page, liens), `AuthPages.jsx`
    (connexion, inscription, mot de passe, 404), `LegalPage.jsx`, `HomePage.jsx`.
    `PublicPages.jsx` ne fait plus que réexporter le chrome et les pages
    d’authentification (compatibilité, il ne tire aucune page lourde).
  - Accueil, Fonctionnalités, guides, Réseaux, Soutenir et pages légales sont
    chargés à la demande (`src/app/public-pages.jsx`, `src/app/lazy-page.jsx`).
    Le routeur ne connaît que les chemins (`src/app/public-paths.js`).
  - Hydratation : `main.jsx` précharge la page prérendue en parallèle du
    routeur, et `seo/render.jsx` fournit les modules au rendu serveur. Le HTML
    prérendu est identique (hors marqueurs Suspense `<!--$-->`) et l’hydratation
    conserve le DOM existant (vérifié dans Chromium sur 9 pages publiques).
- **Espace connecté sans cascade** : sur une URL privée, `main.jsx` lance en même
  temps le routeur, `AppContent` et le module de la page
  (`src/app/workspace-pages.js`). L’envoi du formulaire de connexion démarre le
  téléchargement d’`AppContent`. Les liens de la barre latérale préchargent leur
  page au survol ou au focus.
- **CSS** : `imported-games.css` n’est plus global (importé par
  `ImportedGames.jsx` et `GameOperations.jsx`). L’ordre des imports CSS de
  `main.jsx` reproduit l’ordre de cascade déjà en production : les règles
  bloquantes sont identiques à avant, hormis celles des parties importées.
- **Icônes Lucide** : le groupe `vendor-icons` est supprimé. Une icône utilisée
  par une seule page est livrée avec cette page ; les icônes partagées sont
  regroupées (`icons-shared`, `minShareCount: 2`) pour éviter une quarantaine de
  fichiers de 200 octets.
- **Symbole NXT5** : `BrandIcon` propose `srcSet` 64/128/256/512 px et `sizes`
  (56 px par défaut, 112 px pour l’identité d’équipe).
- **Tendances** : `SourceLink` est sorti dans `components/opponents/SourceLink.jsx`
  (avec son CSS) ; l’analyse Drafter ne charge plus l’espace Adversaires.

## Mesures (Ko gzip)

| Parcours | Avant | Après |
|---|---:|---:|
| Accueil : entrée + modulepreload + CSS bloquante | 145,6 | 138,8 |
| Accueil : jusqu’à l’hydratation (routeur + page) | 219,1 | 192,1 |
| `/connexion` | 219,1 | 175,7 |
| `/accueil` connecté (entrée, routeur, `AppContent`) | 249,4 | 208,0 |
| Catalogue anglais | 360,9 | 294,2 |
| `/tendances` premier chargement | 355,3 | 303,8 |
| Tendances depuis l’espace déjà chargé | 106,0 | 95,8 |

En connecté, les trois téléchargements (routeur → `AppContent` → page) ne se
suivent plus : ils partent ensemble. Contrepartie : 83 fichiers JS au lieu de
66 (accueil : 25 requêtes JS/CSS au lieu de 19), sans fichier minuscule.

## Non traité

Police, scène three.js/poster et injection de CSS par route dans le prerender
(hors périmètre). Sur `vite preview`, les URL privées servent l’accueil prérendu
faute des réécritures Netlify (erreur d’hydratation #418 déjà présente avant) ;
en production `_redirects` sert `app-shell.html`.
