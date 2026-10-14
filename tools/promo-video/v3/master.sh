#!/bin/sh
# Masters the two deliveries to YouTube loudness: one static gain measured on the BGM version (target -14 LUFS),
# then a peak limiter at -2.9 dBFS (true peak after AAC about -2 dBTP) that only catches the three slams. The no-BGM version gets the same gain so its
# SFX sit at the same level. Video is copied as is.
# usage: ./master.sh out/full/in.mp4 out/full/in-nobgm.mp4 out/nxt5-promo-v3.mp4 out/nxt5-promo-v3-sans-musique.mp4
set -e
I=$(ffmpeg -hide_banner -i "$1" -af ebur128 -f null - 2>&1 | grep -A3 "Integrated loudness" | awk '/I:/{print $2}')
G=$(python3 -c "print(round(-14 - ($I) + 0.6, 2))")  # +0.6 dB: the limiter takes back a little integrated loudness
echo "measured $I LUFS -> gain $G dB"
AF="volume=${G}dB,alimiter=limit=0.72:attack=3:release=80:level=false"
ffmpeg -v error -y -i "$1" -c:v copy -af "$AF" -c:a aac -b:a 256k -movflags +faststart "$3"
ffmpeg -v error -y -i "$2" -c:v copy -af "$AF" -c:a aac -b:a 256k -movflags +faststart "$4"
for f in "$3" "$4"; do echo "$f"; ffmpeg -hide_banner -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -A20 Summary | grep -E " I:|Peak:"; done
