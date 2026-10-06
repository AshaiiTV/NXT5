#!/usr/bin/env bash
# Encodage seul, à partir des images déjà rendues par tools/render.sh.
#   tools/encode.sh sortie.mp4 [sous-images]
# Moyenne des sous-images de chaque image (flou de mouvement), son à −14 LUFS par gain fixe.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:-out/final/nxt5-teaser.mp4}
SUB=${2:-6}
FR=out/final/frames
SEQ=out/final/seq
# Durée prise sur les images rendues (dernier numéro + 1) / 30 : un changement de NX.DURATION pendant un rendu
# ne fausse pas son encodage.
DUR=$(node -e "
const fs=require('fs'); let m=-1; for (const f of fs.readdirSync(process.argv[1])) { const r=/^f(\d+)_0\.png$/.exec(f); if (r) m=Math.max(m,+r[1]); }
console.log(((m+1)/30).toFixed(4))" "$FR")
rm -rf "$SEQ"; mkdir -p "$SEQ" "$(dirname "$OUT")"
node -e "
const fs=require('fs'); const [fr,seq,sub]=process.argv.slice(1);
for (const f of fs.readdirSync(fr)) { const m=/^f(\d+)_(\d+)\.png$/.exec(f); if(!m) continue;
  const i=(+m[1])*(+sub)+(+m[2]); fs.symlinkSync(fs.realpathSync(fr+'/'+f), seq+'/'+String(i).padStart(7,'0')+'.png'); }" "$FR" "$SEQ" "$SUB"
# Son : un gain fixe amène le film à −14 LUFS sans écraser les écarts entre les parties
# (une normalisation dynamique remontait l'introduction au niveau du drop), puis un limiteur
# suréchantillonné et un fondu sur la dernière seconde.
I=$(ffmpeg -nostats -i out/final/soundtrack.wav -af ebur128 -f null - 2>&1 | awk '/^ +I:/{v=$2} END{print v}')
G=$(awk -v i="$I" 'BEGIN{printf "%.2f", -14 - i}')
FADE=$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d - 0.9}')
echo "son : ${I} LUFS mesurés, gain ${G} dB, fondu à ${FADE} s"
ffmpeg -v error -y -framerate $((30 * SUB)) -i "$SEQ/%07d.png" -i out/final/soundtrack.wav \
  -filter_complex "[0:v]tmix=frames=${SUB},select='not(mod(n+1\,${SUB}))',setpts=N/30/TB,noise=c0s=5:c0f=t,format=yuv420p[v];[1:a]volume=${G}dB,aresample=192000,alimiter=limit=0.8:attack=1:release=60:level=disabled,aresample=48000,afade=t=out:st=${FADE}:d=0.9[a]" \
  -map "[v]" -map "[a]" -r 30 -c:v libx264 -preset slow -crf 16 -profile:v high -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 256k -t "$DUR" "$OUT"
ls -la "$OUT"
