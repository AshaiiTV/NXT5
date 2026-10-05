#!/usr/bin/env bash
# Version légère (~10 Mo) pour l'envoi sur téléphone.   tools/mobile.sh entrée.mp4 sortie.mp4
set -euo pipefail
ffmpeg -v error -y -i "$1" -c:v libx264 -preset slow -b:v 1700k -maxrate 2400k -bufsize 4800k -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k "$2"
ls -la "$2"
