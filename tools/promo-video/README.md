# Vidéo promo NXT5

Film de motion design d’environ 80 s (1080p60) pour YouTube. Chaque image est dessinée en code (canvas 2D) et la musique est synthétisée en Python. Les deux lisent la même partition à 150 BPM, ce qui garde l’image calée sur le son.

## Prérequis

- Node 22 ou plus récent ;
- Python 3 avec `numpy` et `scipy` ;
- `ffmpeg`.

```bash
cd tools/promo-video
npm install
python3 music.py out/music.wav     # musique + out/music.events.json (kicks, snares, impacts…)
node src/render.mjs                # rendu complet multi-process -> out/nxt5-promo.mp4
node src/thumbnail.mjs             # miniatures -> out/thumbnail.png, out/thumbnail-alt.png
```

## Organisation

| Fichier | Rôle |
|---|---|
| `music.py` | Bande-son originale : intro, montée, drop 1, break jazz-funk, montée 2, drop 2, outro. Normalisée à −13 LUFS, true peak −1 dB. |
| `script.json` | Script final : concept, règles globales, 12 scènes avec leurs cartes texte calées à la mesure. |
| `scenes/Sxx.mjs` | Une scène par fichier : fonction pure du temps. |
| `src/kit.mjs` | Kit de motion design : palette de la charte, easing, enveloppes musicales, textes Persona, halftone, rune, logo, captures 2.5D. |
| `src/render.mjs` | Transitions (slash, star, shatter…), post-FX calés sur la musique, encodage ffmpeg parallèle. |
| `assets/ui/` | Captures de la démo publique de nxt5.org (données fictives). |
| `ENGINE.md` | API des scènes. |
| `YOUTUBE.md` | Titre, description, tags, commentaire épinglé, idée de Short. |

## Aperçus

```bash
node src/render.mjs --sheet S04                     # planche contact d’une scène
node src/render.mjs --stills 19.2,24,51.2           # images à des instants précis
node src/render.mjs --from 17 --to 26 --scale 0.5   # extrait avec le son
```
