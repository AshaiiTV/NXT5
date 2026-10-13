# Tutoriel complet dans l’Aide — 13 octobre 2026

Le Guide d’utilisation propose un tutoriel illustré de tout NXT5, dans la direction verre violet. Seule l’Aide change : le reste du site garde son apparence actuelle. La charte unique reste celle indiquée dans [AGENTS.md](../AGENTS.md) ; le tutoriel réutilise ses jetons et ses visuels sans faire évoluer l’identité.

## Accès

- Adresse : `/guide?section=tutoriel`.
- Points d’entrée dans le Guide :
  - la carte « Tutoriel complet », en tête de page ;
  - l’entrée « 00 Tutoriel complet », en tête du sommaire ;
  - la première option du sélecteur sur mobile.
- Le bouton « Aide » de la barre supérieure reste sur le tutoriel quand il est ouvert.
- Les autres sections du Guide ne changent pas.
- Le tutoriel est chargé à la demande (`React.lazy`, environ 22 kB compressés). Le Guide habituel ne le télécharge pas.

## Contenu

- **Ouverture** : un anneau autour du 5 en verre donne accès aux trois actes (Joue, Analyse, Recommence).
- **Point de départ** :
  - choix du parcours, staff ou joueur ;
  - liste « première soirée » de quatre étapes à cocher ;
  - plan de l’espace, repris des rubriques réelles de la navigation.
- **Quinze chapitres**, du choix de l’équipe au bot Discord. Chacun comprend :
  - la rubrique et l’adresse de la page ;
  - des étapes numérotées, reliées aux zones d’un écran d’exemple (au survol ou au clic) ;
  - un conseil ;
  - un lien vers la vraie page.
- **Mention « Pour toi »** sur les chapitres du parcours choisi.
- **Trois écrans manipulables** :
  - la draft rejouée étape par étape ;
  - la courbe d’écart d’or, avec un curseur et des objectifs ;
  - la carte joueur, qui se retourne.
- **Exemples fictifs** : l’équipe Horizon contre Aurore et Orbite, comme dans la démonstration publique. Les visuels sont ceux déjà publiés dans `public/assets`.
- **Fin du tutoriel** : droits par rôle, questions fréquentes et glossaire.

Sources : le dossier [src/pages/guide/](../src/pages/guide/) (contenu, écrans d’exemple, page et styles), [GuidePage.jsx](../src/pages/GuidePage.jsx) et [guide.css](../src/pages/guide.css).

## Fonctionnement

- **Styles** :
  - limités à `.nxt5-tutorial` (préfixe `tuto-`) et appuyés sur les jetons `--nxt5-*` ;
  - écrans d’exemple mis à l’échelle par des container queries.
- **CSP** :
  - aucun attribut `style` ni police externe ;
  - les mots en verre utilisent un filtre SVG et un reflet SMIL.
- **Animations** :
  - le reflet est en pause hors de l’écran ;
  - en mouvement réduit ou en mode performance, les reflets disparaissent et les tracés sont fixes ;
  - le contenu reste complet dans tous les cas.
- **Stockage** :
  - le parcours et les cases cochées sont gardés dans le navigateur, sous `nxt5_tutorial_v1` ;
  - si le stockage est indisponible, le tutoriel reste utilisable.
- **Liens** : une adresse avec une ancre `#tuto-<chapitre>` ouvre directement le chapitre.
- **Traductions** :
  - 332 nouvelles phrases en anglais et en espagnol, dans [tutorial-overrides.js](../src/i18n/tutorial-overrides.js) ;
  - les libellés d’interface déjà traduits gardent la traduction du site ;
  - en français, des espaces insécables maintiennent la ponctuation haute avec son mot.

## Vérification

- **`npm run verify`** a réussi :
  - 3 740 messages couverts en anglais et en espagnol ;
  - typage ;
  - 215 fichiers de tests, soit 3 985 tests ;
  - build et 13 pages prérendues.
- **Tests du tutoriel** : [guide-tutorial.test.jsx](../src/__tests__/guide-tutorial.test.jsx) couvre :
  - les accès depuis le Guide et la conservation de la section par le bouton Aide ;
  - les liens vers des pages existantes et l’absence d’attribut `style` ;
  - le lien entre chaque étape et une zone de son écran ;
  - le parcours et la liste à cocher ;
  - la draft, la courbe d’or et la carte ;
  - les traductions anglaise et espagnole.
- **Contrôle visuel**, sur un serveur local avec données fictives :
  - largeurs de 1 440 et 390 px ;
  - en français, en anglais et en espagnol ;
  - aucun débordement horizontal ni erreur JavaScript.
- **Build de production** :
  - servi avec la CSP de `netlify.toml` et la page `app-shell.html`, comme en ligne ;
  - `/guide` et `/guide?section=tutoriel` en 1 440 et 390 px ;
  - aucune violation de CSP, erreur JavaScript ou image manquante ;
  - quinze chapitres affichés.

Ces essais interceptent les API avant le réseau. Ils ne lisent ni ne modifient aucune donnée réelle.

## Hors périmètre

Certaines traductions espagnoles du site, reprises par le tutoriel, sont littérales :

- « robot de discordia » pour « Bot Discord » ;
- « Partidos abiertos » pour « Ouvrir les parties ».

Elles se trouvent dans `src/i18n/messages/es.json` et s’affichent aussi ailleurs sur le site. Elles n’ont pas été modifiées ici.
