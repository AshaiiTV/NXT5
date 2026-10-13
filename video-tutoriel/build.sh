#!/bin/sh
# Chaîne complète : voix ElevenLabs -> rendu recalé -> mixage
set -e
cd "$(dirname "$0")"
python3 voice.py
python3 render.py tuto_v3_muet.mp4
python3 mix.py tuto_v3_muet.mp4 nxt5-tuto-voix.mp4
