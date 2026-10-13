#!/bin/sh
# Trims the BGM (video-shotcraft assets/audio/bgm/g-eazy-nba-type.mp3, Mixkit Stock Music Free License) so that the
# file starts exactly 16 beats before the drop (9.0085 s) of the grid in analysis/geazy130.json.
# usage: ./prepare-audio.sh /path/to/g-eazy-nba-type.mp3
set -e
ffmpeg -v error -y -i "$1" -af "atrim=start=9.0085:duration=41,asetpts=PTS-STARTPTS" -ar 48000 public/audio/bgm.wav
