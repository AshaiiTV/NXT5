#!/bin/sh
# Trims the BGM (video-shotcraft assets/audio/bgm/cat-walk.mp3, Mixkit Stock Music Free License) so that the
# file starts exactly on music beat 48 (22.172 s) of the grid in analysis/catwalk_grid.json.
# usage: ./prepare-audio.sh /path/to/cat-walk.mp3
set -e
ffmpeg -v error -y -i "$1" -af "atrim=start=22.1720:duration=42,asetpts=PTS-STARTPTS" -ar 48000 public/audio/bgm.wav
