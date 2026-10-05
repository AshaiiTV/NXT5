#!/usr/bin/env bash
# Rendu complet du teaser : musique, images avec flou de mouvement, encodage H.264 + AAC.
#   tools/render.sh [sortie.mp4] [sous-images] [workers]
# Version légère pour téléphone : tools/render.sh out/x.mp4 puis tools/mobile.sh out/x.mp4 out/x-mobile.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/final/nxt5-teaser.mp4}
SUB=${2:-6}
WORKERS=${3:-4}
FR=out/final/frames
DUR=$(node -e "const s=require('fs').readFileSync('engine.js','utf8'); console.log(/NX\.DURATION = ([\d.]+)/.exec(s)[1])")
mkdir -p out/final "$(dirname "$OUT")"
rm -rf "$FR" out/final/seq
echo "== musique"
node tools/capture.mjs audio --out out/final/soundtrack.wav
echo "== images (${SUB} sous-images, ${DUR} s)"
node tools/capture.mjs frames --fps 30 --sub "$SUB" --workers "$WORKERS" --from 0 --to "$DUR" --out "$FR"
echo "== encodage"
./tools/encode.sh "$OUT" "$SUB"
