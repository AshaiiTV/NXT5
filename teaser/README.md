# Teaser NXT5

Teaser vidéo de NXT5, rendu image par image dans Chromium. Tout le film est une fonction pure du temps : HTML, CSS et un fond WebGL2 pour l’image, une musique synthétisée par Web Audio pour le son. Aucun fichier vidéo ou audio externe, donc aucune question de licence.

## Version 6 (5 octobre 2026)

Retours sur la v5 : le teaser était trop long (43 s), trop rapide et difficile à comprendre. La première partie et la suite avaient aussi deux directions artistiques différentes. La v6 repart du moteur d’origine avec ces décisions :

- **Une seule direction artistique.** La nébuleuse et les rayons venus du haut restent allumés de la première à la dernière image (scène `ciel`). Les impacts font jaillir les rayons au lieu de voiler l’image. Pas d’écran noir, pas d’effet hyperespace. Le même logo complet ouvre et ferme le film, et la scène des rôles garde la lumière de l’ouverture.
- **Moins de messages, tenus plus longtemps.** Six messages au lieu de neuf. Une fois complets, les titres restent lisibles entre 2,2 et 3,6 s. Les cartons « Comprends tes parties. Prépare la suite. », « Du constat au travail d’équipe. » et « Joueurs et coachs. Un seul espace. » sont retirés.
- **Trois outils au lieu de cinq verbes en rafale.** Chaque outil a 3,6 s, un titre lisible et un seul écran agrandi. Les textes des écrans et de la carte finale sont dimensionnés pour rester lisibles sur un téléphone.
- **Tempo plus lent.** 100 BPM (une mesure = 2,4 s) au lieu de 105,9 BPM ; durée 33,6 s au lieu de 43,07 s.

| Temps (s) | Scène | À l’écran |
|---|---|---|
| 0 → 4,8 | `accroche` | « Envie d’analyser tes games et de comprendre ton équipe ? », mot à mot puis tenu |
| 4,8 → 7,2 | `logo` | Logo complet NXT5 qui se forme derrière la question puis s’éclaire |
| 7,2 → 9,6 | `equipe` | Cinq étincelles quittent le logo et deviennent Top, Jungle, Mid, ADC, Support, un rôle par temps |
| 9,6 → 14,4 | `equipe` | « Toute ton équipe. », puis les rôles fusionnent lentement (1,8 s) et l’emblème naît |
| 14,4 → 18,0 | `equipe` | « Une même direction. » sous l’emblème |
| 18,0 → 21,6 | `outils` | 01 · Analyser : « Comprends tes parties. » + résumé de partie de la démo |
| 21,6 → 25,2 | `outils` | 02 · Débriefer : « Prépare tes débriefs. » + question et points à travailler |
| 25,2 → 28,8 | `outils` | 03 · Planifier : « Organise tes entraînements. » + planning de la semaine |
| 28,8 → 33,6 | `fin` | Logo, nxt5.org, « Pour les équipes et coachs League of Legends », « Accès actuellement gratuit » |

Les temps forts sont centralisés dans `NX.T` (`scenes/style.js`) et lus à la fois par l’image et par la musique (`audio.js`). Les données affichées viennent de la démo publique (`src/pages/public/demo-data.js`, équipe fictive). Le planning n’utilise que des créneaux à l’heure et les types du produit (scrim, match, débrief), et le débrief montre des points numérotés plutôt que des cases à cocher, que le produit n’a pas.

Le son est mis au volume à l’encodage par un gain fixe (−14 LUFS), suivi d’un limiteur et d’un fondu sur la dernière seconde. Une normalisation dynamique remontait l’introduction au niveau du drop.

Règles de contenu toujours valables : jamais « Cinq rôles », jamais « sans compte » (un compte est nécessaire), au plus six mots par titre, logos jamais redessinés.

## Rendu

```bash
cd teaser
npm install
./tools/render.sh out/final/nxt5-teaser-v6.mp4      # 6 sous-images par image, environ 1 h sur 4 cœurs sans GPU
./tools/encode.sh out/final/nxt5-teaser-v6.mp4 6    # réencode seul, si les images sont déjà rendues
./tools/mobile.sh out/final/nxt5-teaser-v6.mp4 out/final/nxt5-teaser-v6-mobile.mp4
```

- Aperçu interactif : ouvrir `index.html` dans un navigateur (servi en local), avec lecture, son et navigation par scène.
- Planche de contrôle : `node tools/capture.mjs sheet --from 0 --to 31 --n 32 --cols 4 --out out/sheet.png`.
- Chromium : variable `CHROME_PATH`, sinon détection automatique (conteneur cloud ou Playwright sur Mac). `ffmpeg` est nécessaire pour l’encodage.
- Le guide du moteur pour écrire une scène est dans `ENGINE.md`. Le dossier `out/` n’est pas versionné.

## Historique

Les versions 1 à 5 (29 et 30 septembre 2026) ont été faites sur le Mac, dans `~/Documents/NXT5-teaser`, hors de ce dépôt. Leurs scènes et leur musique n’existent que là-bas. La v6 a été reconstruite dans ce dossier à partir du moteur d’origine, pour que le projet soit versionné.
