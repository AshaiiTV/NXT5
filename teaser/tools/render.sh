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
SEQ=out/final/seq
DUR=$(node -e "const s=require('fs').readFileSync('engine.js','utf8'); console.log(/NX\.DURATION = ([\d.]+)/.exec(s)[1])")
mkdir -p out/final "$(dirname "$OUT")"
rm -rf "$FR" "$SEQ"
echo "== musique"
node tools/capture.mjs audio --out out/final/soundtrack.wav
echo "== images (${SUB} sous-images, ${DUR} s)"
node tools/capture.mjs frames --fps 30 --sub "$SUB" --workers "$WORKERS" --from 0 --to "$DUR" --out "$FR"
echo "== séquence"
mkdir -p "$SEQ"
node -e "
const fs=require('fs'); const [fr,seq,sub]=process.argv.slice(1);
for (const f of fs.readdirSync(fr)) { const m=/^f(\d+)_(\d+)\.png$/.exec(f); if(!m) continue;
  const i=(+m[1])*(+sub)+(+m[2]); fs.symlinkSync(fs.realpathSync(fr+'/'+f), seq+'/'+String(i).padStart(7,'0')+'.png'); }" "$FR" "$SEQ" "$SUB"
echo "== encodage"
# Moyenne des sous-images de chaque image (flou de mouvement), puis grain léger et volume ramené à −14 LUFS.
ffmpeg -v error -y -framerate $((30 * SUB)) -i "$SEQ/%07d.png" -i out/final/soundtrack.wav \
  -filter_complex "[0:v]tmix=frames=${SUB},select='not(mod(n+1\,${SUB}))',setpts=N/30/TB,format=yuv420p[v];[1:a]loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000[a]" \
  -map "[v]" -map "[a]" -r 30 -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 256k -t "$DUR" "$OUT"
ls -la "$OUT"
