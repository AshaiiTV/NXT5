# Teaser NXT5

Teaser vidéo de NXT5, rendu image par image dans Chromium. Tout le film est une fonction pure du temps : HTML, CSS et un fond WebGL2 pour l’image, une musique synthétisée par Web Audio pour le son. Aucun fichier vidéo ou audio externe, donc aucune question de licence.

## Version 7.2 (7 octobre 2026)

Retour sur l’aperçu de la v7.1 : le logo apparaissait deux fois de suite (le logo complet, puis un emblème qui renaissait après les rôles). La v7.2 en fait un seul logo continu, de 4,8 à 13,2 s. La durée, la musique, les outils et la fin sont inchangés. Les décisions sont consignées en tête de `MOTION-BIBLE.md` (amendement v7.2) et dans son tableau des écarts.

- **Un seul logo.** La lumière écrit le logo une seule fois. Le mot NXT5, la devise et le fond du logo repartent dans la lumière ; l’emblème reste en place et passe à l’emblème seul par un fondu de 0,15 s, au pixel près.
- **Les rôles naissent de l’emblème.** Les cinq rôles naissent autour de lui, de sa lumière, un par croche. Ils se dissolvent ensuite en particules qui rejoignent chacune son secteur ; l’emblème se charge de leur lumière et grandit jusqu’à l’impact de 9,6 s.
- **« Une même direction. »** s’écrit sous ce même emblème, puis la flèche monte jusqu’au drop de 13,2 s, comme dans la v7.1.

| Temps (s) | Scène | À l’écran |
|---|---|---|
| 0 → 4,8 | `accroche` | La question monte sur trois lignes, puis la lumière la brûle en écrivant le logo |
| 4,8 → 7,2 | `logo` | Logo complet, impact, reflet ; le mot NXT5 et la devise repartent dans la lumière, l’emblème reste |
| 7,2 → 9,6 | `equipe`, `direction` | Les cinq rôles naissent autour de l’emblème, puis s’y fondent ; il grandit jusqu’à l’impact |
| 9,6 → 13,2 | `direction` | « Une même direction. », le faisceau, la flèche monte |
| 13,2 → 27,6 | `outils` | Quatre cartes de verre : Analyser, Débriefer, Drafter, Planifier |
| 27,6 → 32,4 | `fin` | L’emblème revient se poser, la lumière réécrit NXT5, carte finale |

Le trajet commun de l’emblème entre les trois scènes (`NX.M72`, défini dans `scenes/logo.js`) est décrit dans `ENGINE.md`.

## Version 7.1 (7 octobre 2026)

Retours sur l’aperçu de la v7 : l’ouverture doit dire qu’il s’agit de League of Legends ; le passage des rôles, « super beau », manquait de sens et devient une simple transition ; la partie des outils, « top », reçoit un quatrième outil. Les décisions sont consignées en tête de `MOTION-BIBLE.md` (amendement v7.1) et dans son tableau des écarts.

- **Accroche sur trois lignes.** « Envie d’analyser tes games / et de comprendre ton équipe / sur League of Legends ? », complète à 3,4 s et brûlée par la lumière avant l’impact du logo.
- **Rôles en transition (7,2 → 9,6 s).** Les cinq rôles naissent de la lumière du logo, un par croche, autour du futur emblème, puis se dissolvent en particules qui forment l’emblème sur l’impact de 9,6 s. Plus de titre ni de ligne de liens.
- **Quatre outils.** « 03 · DRAFTER » s’ajoute avant le planning : « Compose ta draft. » avec la composition de l’équipe de démo (Gnar, Vi, Ahri, Jinx, Braum), les statuts du produit (« Confiance », « Situationnel »), le compteur « 5/5 champions » et le badge « Très maîtrisée ».
- **32,4 s au lieu de 33,6.** La musique, la caméra et le ciel suivent la nouvelle frise ; le ciel garde la phase et la teinte validées de la v7 pour chaque plan.

| Temps (s) | Scène | À l’écran |
|---|---|---|
| 0 → 4,8 | `accroche` | La question monte sur trois lignes, puis la lumière la brûle en écrivant le logo |
| 4,8 → 7,2 | `logo` | Logo complet, impact, reflet, puis le logo est emporté dans la lumière |
| 7,2 → 9,6 | `equipe` | Les cinq rôles naissent en rafale et fusionnent en emblème |
| 9,6 → 13,2 | `direction` | « Une même direction. », le faisceau, la flèche monte |
| 13,2 → 27,6 | `outils` | Quatre cartes de verre : Analyser, Débriefer, Drafter, Planifier |
| 27,6 → 32,4 | `fin` | L’emblème revient se poser, la lumière réécrit NXT5, carte finale |

## Version 7 (6 octobre 2026)

Retour sur la v6 : le rythme et la lisibilité sont validés, mais la mise en mouvement devait atteindre le meilleur niveau possible. La v7 garde la durée (33,6 s), le tempo, la musique, les textes et les temps forts de la v6 (`NX.T`). Toute la mise en mouvement est refaite d’après une bible, `MOTION-BIBLE.md` : un panel de trois traitements, trois juges, puis des prototypes des cinq moments les plus risqués.

- **Un seul plan.** Une caméra continue (`scenes/camera.js`) dérive dans la nébuleuse de la première à la dernière image, avec une avancée douce sur chaque temps fort. Il n’y a plus de fondu enchaîné ni de trou noir : chaque passage est un geste motivé.
- **La lumière comme seul acteur.** Une onde de lumière descend des rayons. Elle écrit le logo, efface la question, emporte ce qui est fini et fait descendre la suite. Le logo de fin est écrit par la même onde que celui du début.
- **Un seul matériau.** Les cinq rôles et les trois outils sont en verre sombre, avec un bord cyan éclairé par le haut et un reflet fuchsia. Les deux moitiés du film ont ainsi la même direction artistique jusque dans les objets.
- **Profondeur.** Poussière en parallaxe, ciel couplé à la caméra, une seule onde de choc (la naissance de l’emblème), et aucune secousse : c’est la caméra qui marque les impacts.

Quatre moments forts :

1. **« La lumière écrit NXT5 »** (4,2 → 5,05 s). L’onde écrit l’emblème au-dessus de la question, brûle la question ligne par ligne et écrit NXT5 ; l’emblème est complet et net sur l’impact de 4,8 s.
2. **« Cinq deviennent un »** (12,3 → 14,4 s). Les cinq tuiles se rassemblent en cercle, le lien lumineux devient l’anneau de l’emblème, chaque tuile se dissout en particules de sa couleur qui rejoignent leur secteur, puis l’emblème apparaît sur l’impact.
3. **« La flèche monte, la lumière redescend »** (17,4 → 18,1 s). L’emblème se condense en sa flèche et monte dans le faisceau ; au drop, la lumière redescend et allume la première carte.
4. **« Le retour »** (28 → 29,3 s). L’emblème ressort de la lumière et se pose au pixel près dans le logo final pendant que l’onde réécrit NXT5 et efface les outils.

| Temps (s) | Scène | À l’écran |
|---|---|---|
| 0 → 4,8 | `accroche` | La question monte mot à mot, puis l’onde de lumière la brûle en écrivant le logo |
| 4,8 → 7,2 | `logo` | Logo complet, impact, reflet, puis le logo est emporté dans la lumière |
| 7,2 → 9,6 | `equipe` | Cinq tuiles de verre, un rôle par temps, chacune dans sa lumière |
| 9,6 → 14,4 | `equipe` | « Toute ton équipe. », lien lumineux, rassemblement et fusion en particules |
| 14,4 → 18,0 | `direction` | L’emblème naît, « Une même direction. », le faisceau, la flèche monte |
| 18,0 → 28,8 | `outils` | Trois cartes de verre : le drop allume la première, chaque carte terminée monte dans la lumière |
| 28,8 → 33,6 | `fin` | L’emblème revient se poser, la lumière réécrit NXT5, carte finale |

Nouveaux fichiers : `kit.js` (caméra, lumière, verre, typographie, particules), `scenes/camera.js`, `scenes/direction.js` (« Une même direction. », auparavant dans `equipe`) et les outils de vérification de la bible (§6) : `tools/metrics.mjs`, `tools/camcheck.mjs`, `tools/determinism.mjs`, `tools/bench.mjs`, `tools/clip.sh`. Le guide du kit pour écrire une scène est dans `ENGINE.md`.

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
./tools/render.sh out/final/nxt5-teaser-v7.2.mp4    # 6 sous-images par image, environ 1 h sur 4 cœurs sans GPU
./tools/encode.sh out/final/nxt5-teaser-v7.2.mp4 6  # réencode seul, si les images sont déjà rendues
./tools/mobile.sh out/final/nxt5-teaser-v7.2.mp4 out/final/nxt5-teaser-v7.2-mobile.mp4
```

- Rendu par tranches, pour rester sous la durée maximale d’une commande : `node tools/capture.mjs audio --out out/final/soundtrack.wav`, puis `node tools/capture.mjs frames --fps 30 --sub 6 --workers 4 --from 0 --to 12 --out out/final/frames --resume 1` (et ainsi de suite jusqu’à 32,4), puis `./tools/encode.sh`. `--resume 1` saute les images déjà complètes.
- Aperçu interactif : ouvrir `index.html` dans un navigateur (servi en local), avec lecture, son et navigation par scène.
- Planche de contrôle : `node tools/capture.mjs sheet --from 0 --to 32 --n 54 --cols 6 --out out/sheet.png`.
- Vérifications de la bible (§6) : `node tools/metrics.mjs VIDEO` (luminance et contours ; `--v7` pour l’ancienne frise), `node tools/camcheck.mjs` (marges et vitesses de la caméra), `node tools/determinism.mjs` (même image quel que soit l’ordre de rendu), `node tools/bench.mjs` (coût de rendu), `tools/clip.sh DEBUT FIN sortie.mp4` (extrait avec flou de mouvement).
- Chromium : variable `CHROME_PATH`, sinon détection automatique (conteneur cloud ou Playwright sur Mac). Les outils le lancent avec `--disable-gpu-rasterization`, pour que chaque image ne dépende pas des précédentes. `ffmpeg` est nécessaire pour l’encodage.
- Le guide du moteur pour écrire une scène est dans `ENGINE.md`. Le dossier `out/` n’est pas versionné.

## Historique

Les versions 1 à 5 (29 et 30 septembre 2026) ont été faites sur le Mac, dans `~/Documents/NXT5-teaser`, hors de ce dépôt. Leurs scènes et leur musique n’existent que là-bas. La v6 a été reconstruite dans ce dossier à partir du moteur d’origine, pour que le projet soit versionné.
