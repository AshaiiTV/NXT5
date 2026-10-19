#!/bin/sh
# Masters the tutorial's two deliveries with ONE static gain (measured on the music version, target -16 LUFS: a
# calm, voice-less tutorial) and the same peak limiter, so the foley sits at the same level in both files.
# usage: ./master-tuto.sh in.mp4 in-nobgm.mp4 out.mp4 out-nobgm.mp4
set -e
I=$(ffmpeg -hide_banner -i "$1" -af ebur128 -f null - 2>&1 | grep -A3 "Integrated loudness" | awk '/I:/{print $2}')
G=$(python3 -c "print(round(-16 - ($I) + 0.2, 2))")
echo "measured $I LUFS -> gain $G dB"
AF="volume=${G}dB,alimiter=limit=0.6:attack=1:release=60:level=false"
VF="-vf scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709 -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
ffmpeg -v error -y -i "$1" $VF -af "$AF" -ar 48000 -c:a aac -b:a 192k -movflags +faststart "$3"
ffmpeg -v error -y -i "$2" $VF -af "$AF" -ar 48000 -c:a aac -b:a 192k -movflags +faststart "$4"
for f in "$3" "$4"; do echo "$f"; ffmpeg -hide_banner -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -A20 Summary | grep -E " I:|Peak:"; done
