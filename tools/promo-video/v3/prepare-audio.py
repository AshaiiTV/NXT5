# Builds public/audio/bgm.wav from g-eazy-nba-type.mp3 (Mixkit "G Eazy NBA type", Arulo, Mixkit Stock Music
# Free License): music from film beat FILM_K0, spliced on a bar line at SPLICE_K to bar 39 so the song's second
# drop lands on k76. Everything is shifted 42.3 ms (2032 samples = the output AAC priming, measured by
# analysis/sync_check.py) so the beats are heard on the beatF frames. 10 ms equal-power crossfade at the splice.
# usage: python3 prepare-audio.py /path/to/g-eazy-nba-type.mp3
import subprocess, sys, wave
import numpy as np
SR, T, B0 = 48000, 0.46152823, 9.0085
FILM_K0, SPLICE_K, BAR39 = 8, 72, 73.622
PRIMING = 2032 / SR
LENGTH = 38.0  # s, longer than the film
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).reshape(-1, 2)
s = lambda t: int(round(t * SR))
a0 = B0 + FILM_K0 * T + PRIMING          # music time at file start
a1 = B0 + SPLICE_K * T                   # splice point in music time (bar line, k72)
xf = s(0.010)
first = x[s(a0): s(a1) + xf].copy()
second = x[s(BAR39) - 0: s(BAR39) + s(LENGTH - (a1 - a0)) + xf].copy()
w = np.linspace(0, np.pi / 2, xf)[:, None]
mix = first[-xf:] * np.cos(w) + second[:xf] * np.sin(w)
out = np.concatenate([first[:-xf], mix, second[xf:]])
pcm = (np.clip(out, -1, 1) * 32767).astype('<i2')
with wave.open('public/audio/bgm.wav', 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
print(f'bgm.wav {len(out) / SR:.2f} s; splice at file {a1 - a0:.4f} s (film {a1 - a0 + PRIMING:.4f} s = k{SPLICE_K})')
