#!/usr/bin/env bash
# Extrait en mouvement avec flou réel (bible §6.4) : tools/clip.sh DEBUT FIN sortie.mp4 [sous-images] [--only ids]
set -euo pipefail
cd "$(dirname "$0")/.."
A=$1; B=$2; OUT=$3; SUB=${4:-6}; ONLY=${5:-}
TMP=out/clip-$$; rm -rf "$TMP"; mkdir -p "$TMP/seq" "$(dirname "$OUT")"
node tools/capture.mjs frames --fps 30 --sub "$SUB" --workers 2 --from "$A" --to "$B" --out "$TMP/frames" ${ONLY:+--only "$ONLY"} >/dev/null
node -e "
const fs=require('fs'); const [fr,seq,sub]=process.argv.slice(1); const fs0=fs.readdirSync(fr).filter(f=>/^f\d+_\d+\.png$/.test(f)).sort();
const base=Math.min(...fs0.map(f=>+/^f(\d+)/.exec(f)[1]));
for (const f of fs0){const m=/^f(\d+)_(\d+)\.png$/.exec(f); const i=(+m[1]-base)*(+sub)+(+m[2]); fs.symlinkSync(fs.realpathSync(fr+'/'+f), seq+'/'+String(i).padStart(7,'0')+'.png');}" "$TMP/frames" "$TMP/seq" "$SUB"
ffmpeg -v error -y -framerate $((30 * SUB)) -i "$TMP/seq/%07d.png" -vf "tmix=frames=${SUB},select='not(mod(n+1\,${SUB}))',setpts=N/30/TB,noise=c0s=5:c0f=t,format=yuv420p" -r 30 -c:v libx264 -crf 17 -movflags +faststart "$OUT"
rm -rf "$TMP"; ls -la "$OUT"
