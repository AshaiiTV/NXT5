# Teaser NXT5

Teaser vidéo de NXT5, rendu image par image dans Chromium. Tout le film est une fonction pure du temps : HTML, CSS et un fond WebGL2 pour l’image, une musique synthétisée par Web Audio pour le son. Aucun fichier vidéo ou audio externe, donc aucune question de licence.

## Version 6 (5 octobre 2026)

Retours sur la v5 : le teaser était trop long (43 s), trop rapide et difficile à comprendre. La première partie et la suite avaient aussi deux directions artistiques différentes. La v6 repart du moteur d’origine avec ces décisions :

- **Une seule direction artistique.** La nébuleuse et les rayons venus du haut restent allumés de la première à la dernière image (scène `ciel`). Pas d’écran noir, pas d’effet hyperespace. Le même logo complet ouvre et ferme le film.
- **Moins de messages, tenus plus longtemps.** Six messages au lieu de neuf. Chaque texte reste au moins 2,4 s à l’écran une fois complet. Les cartons « Comprends tes parties. Prépare la suite. », « Du constat au travail d’équipe. » et « Joueurs et coachs. Un seul espace. » sont retirés.
- **Trois outils au lieu de cinq verbes en rafale.** Chaque outil a 3,6 s, un titre lisible et un seul écran agrandi.
- **Tempo plus lent.** 100 BPM (une mesure = 2,4 s) au lieu de 105,9 BPM ; durée 31,2 s au lieu de 43,07 s.

| Temps (s) | Scène | À l’écran |
|---|---|---|
| 0 → 4,8 | `accroche` | « Envie d’analyser tes games et de comprendre ton équipe ? », mot à mot puis tenu |
| 4,8 → 7,2 | `logo` | Logo complet NXT5 qui naît de la lumière |
| 7,2 → 12,0 | `equipe` | Cinq étincelles quittent le logo et deviennent Top, Jungle, Mid, ADC, Support ; « Toute ton équipe. » |
| 12,0 → 15,6 | `equipe` | Les rôles fusionnent, l’emblème naît ; « Une même direction. » |
| 15,6 → 19,2 | `outils` | 01 · Analyser : « Comprends tes parties. » + résumé de partie de la démo |
| 19,2 → 22,8 | `outils` | 02 · Débriefer : « Prépare tes débriefs. » + question et points à travailler |
| 22,8 → 26,4 | `outils` | 03 · Planifier : « Organise tes entraînements. » + planning de la semaine |
| 26,4 → 31,2 | `fin` | Logo, nxt5.org, « Pour les équipes et coachs League of Legends », « Accès actuellement gratuit » |

Les temps forts sont centralisés dans `NX.T` (`scenes/style.js`) et lus à la fois par l’image et par la musique (`audio.js`). Les données affichées viennent de la démo publique (`src/pages/public/demo-data.js`, équipe fictive).

Règles de contenu toujours valables : jamais « Cinq rôles », jamais « sans compte » (un compte est nécessaire), au plus six mots par titre, logos jamais redessinés.

## Rendu

```bash
cd teaser
npm install
./tools/render.sh out/final/nxt5-teaser-v6.mp4      # 6 sous-images par image, environ 15 min sur 4 cœurs
./tools/mobile.sh out/final/nxt5-teaser-v6.mp4 out/final/nxt5-teaser-v6-mobile.mp4
```

- Aperçu interactif : ouvrir `index.html` dans un navigateur (servi en local), avec lecture, son et navigation par scène.
- Planche de contrôle : `node tools/capture.mjs sheet --from 0 --to 31 --n 32 --cols 4 --out out/sheet.png`.
- Chromium : variable `CHROME_PATH`, sinon détection automatique (conteneur cloud ou Playwright sur Mac). `ffmpeg` est nécessaire pour l’encodage.
- Le guide du moteur pour écrire une scène est dans `ENGINE.md`. Le dossier `out/` n’est pas versionné.

## Historique

Les versions 1 à 5 (29 et 30 septembre 2026) ont été faites sur le Mac, dans `~/Documents/NXT5-teaser`, hors de ce dépôt. Leurs scènes et leur musique n’existent que là-bas. La v6 a été reconstruite dans ce dossier à partir du moteur d’origine, pour que le projet soit versionné.
