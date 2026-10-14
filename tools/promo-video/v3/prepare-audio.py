# Builds public/audio/bgm.wav from g-eazy-nba-type.mp3 (Mixkit "G Eazy NBA type", Arulo, Mixkit Stock Music
# Free License) as a montage of whole bars, following MUSIC_SEGMENTS in src/timeline.ts (film beat → source time):
# the build and the drop (film k8–36), the song's hollow bar and its return (k36–52), one full bar (k52–56), then
# bar 39's build so the song's second drop lands on film k60. Each splice sits on a bar line, with a 10 ms
# equal-power crossfade just BEFORE it so the next downbeat's attack plays intact. Everything is shifted 42.3 ms
# (2032 samples = the output AAC priming, measured by analysis/sync_check.py) so beats are heard on beatF frames.
# usage: python3 prepare-audio.py /path/to/g-eazy-nba-type.mp3
import subprocess, sys, wave
import numpy as np
SR, T, B0, K0 = 48000, 0.46152823, 9.0085, 8
SEGMENTS = [(8, B0 + 8 * T), (36, B0 + 44 * T), (52, B0 + 68 * T), (56, 73.622)]  # = MUSIC_SEGMENTS
PRIMING = 2032 / SR
LENGTH = 34.0  # s, longer than the film
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).reshape(-1, 2)
s = lambda t: int(round(t * SR))
xf = s(0.010)
w = np.linspace(0, np.pi / 2, xf)[:, None]
out = None
for i, (k, src) in enumerate(SEGMENTS):
    t0 = (k - K0) * T                                             # film time of the segment start
    t1 = (SEGMENTS[i + 1][0] - K0) * T if i + 1 < len(SEGMENTS) else LENGTH + PRIMING
    u0, u1 = max(0.0, t0 - PRIMING), t1 - PRIMING                 # file time range
    a = src + (u0 + PRIMING - t0)                                 # source time at the file range start
    n = s(u1) - s(u0)
    if out is None:
        out = x[s(a): s(a) + n].copy()
    else:
        piece = x[s(a) - xf: s(a) + n].copy()                     # starts 10 ms before the bar line
        mix = out[-xf:] * np.cos(w) + piece[:xf] * np.sin(w)
        out = np.concatenate([out[:-xf], mix, piece[xf:]])
    print(f'film k{k:>2} ({t0:6.3f} s) <- music {src:7.3f} s')
pcm = (np.clip(out, -1, 1) * 32767).astype('<i2')
with wave.open('public/audio/bgm.wav', 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
print(f'bgm.wav {len(out) / SR:.2f} s')
