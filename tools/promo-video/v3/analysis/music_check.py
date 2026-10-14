# Render-back check of the music position (music-beat-sync §5b): at the beatF frame of film beat k, the rendered
# BGM must hold the source music mapped to that beat by MUSIC_SEGMENTS (src/timeline.ts / prepare-audio.py).
# usage: python3 analysis/music_check.py <with-bgm.mp4> <no-bgm.mp4> <g-eazy-nba-type.mp3>
import subprocess, sys
import numpy as np
SR, T, B0, K0 = 48000, 0.46152823, 9.0085, 8
SEGMENTS = [(8, B0 + 8 * T), (36, B0 + 44 * T), (52, B0 + 68 * T), (56, 73.622)]
def src_of(k):
    seg = [g for g in SEGMENTS if g[0] <= k][-1]
    return seg[1] + (k - seg[0]) * T
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
w, n, src = load(sys.argv[1]), load(sys.argv[2]), load(sys.argv[3])
res = w[: len(n)] - n
for k in (9, 12, 16, 24, 32, 36, 40, 48, 52, 56, 60, 64, 72):
    t = (k - K0) * T; m = src_of(k)
    i = int(t * SR); ref = src[int(m * SR): int(m * SR) + SR // 2]
    win = int(0.15 * SR); seg = res[i - win: i + win + len(ref)]
    if len(seg) < len(ref) + 2 * win: print(f'k{k:2d}: past the end'); continue
    c = np.correlate(seg, ref, 'valid'); j = int(np.argmax(c)) - win
    print(f'k{k:2d} (frame {round(t * 30):4d}, music {m:7.3f} s): heard {j / SR * 30:+.2f} f from its beat frame')
