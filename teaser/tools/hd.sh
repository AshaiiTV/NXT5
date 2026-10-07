#!/usr/bin/env bash
# Version 1080p de diffusion (~27 Mo, sous la limite d'envoi de 30 Mo), en deux passes.   tools/hd.sh entrée.mp4 sortie.mp4
set -euo pipefail
LOG=$(mktemp -d)/x264
ffmpeg -v error -y -i "$1" -c:v libx264 -preset slow -b:v 6700k -maxrate 11M -bufsize 16M -profile:v high -pix_fmt yuv420p -pass 1 -passlogfile "$LOG" -an -f null /dev/null
ffmpeg -v error -y -i "$1" -c:v libx264 -preset slow -b:v 6700k -maxrate 11M -bufsize 16M -profile:v high -pix_fmt yuv420p -pass 2 -passlogfile "$LOG" -movflags +faststart -c:a aac -b:a 192k "$2"
rm -rf "$(dirname "$LOG")"; ls -la "$2"
