# Render-back check of the music position (music-beat-sync §5b): at the beatF frame of film beat k, the rendered
# BGM must hold the source music of that beat (k < SPLICE_K: 9.0085 + k·T; k ≥ SPLICE_K: spliced to bar 39).
# usage: python3 analysis/music_check.py <with-bgm.mp4> <no-bgm.mp4> <g-eazy-nba-type.mp3>
import subprocess, sys
import numpy as np
SR, T, B0, K0, SPLICE_K, BAR39 = 48000, 0.46152823, 9.0085, 8, 72, 73.622
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
w, n, src = load(sys.argv[1]), load(sys.argv[2]), load(sys.argv[3])
res = w[: len(n)] - n
for k in (9, 12, 16, 32, 48, 64, 70, 76, 80):
    t = (k - K0) * T
    m = B0 + k * T if k < SPLICE_K else BAR39 + (k - SPLICE_K) * T
    i = int(t * SR); ref = src[int(m * SR): int(m * SR) + SR // 2]
    win = int(0.15 * SR); seg = res[i - win: i + win + len(ref)]
    c = np.correlate(seg, ref, 'valid'); j = int(np.argmax(c)) - win
    print(f'k{k:2d} (frame {round(t * 30):4d}, music {m:7.3f} s): heard {j / SR * 30:+.2f} f from its beat frame')
