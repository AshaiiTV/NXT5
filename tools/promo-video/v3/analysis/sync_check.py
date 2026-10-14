# Render-back sync test (music-beat-sync §5b, sound-design §4.6): where do known sounds sit in the rendered mp4?
# usage: python3 analysis/sync_check.py <with-bgm.mp4> <no-bgm.mp4>
import subprocess, sys, json
import numpy as np
SR = 48000
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def xcorr_lag(ref, sig, center, win):
    """lag (samples) of ref inside sig around `center` (samples), normalised cross-correlation via FFT"""
    a = max(0, center - win); b = min(len(sig), center + win + len(ref))
    seg = sig[a:b]
    n = 1 << int(np.ceil(np.log2(len(seg) + len(ref))))
    c = np.fft.irfft(np.fft.rfft(seg, n) * np.conj(np.fft.rfft(ref, n)), n)[: len(seg) - len(ref) + 1]
    e = np.sqrt(np.convolve(seg ** 2, np.ones(len(ref)), 'valid') * (ref ** 2).sum() + 1e-12)
    r = c / e
    i = int(r.argmax())
    return a + i, float(r[i])
withb, nob = load(sys.argv[1]), load(sys.argv[2])
# 1) SFX probes in the no-BGM render: Sequence.from frames as designed (sfx.ts) -> measured start
probes = json.loads(sys.argv[3]) if len(sys.argv) > 3 else []
for src, frm in probes:
    ref = load(f'public/sfx/{src}')[: int(0.25 * SR)]
    pos, r = xcorr_lag(ref, nob, int(frm / 30 * SR), int(0.3 * SR))
    print(f'SFX {src:24s} designed start f{frm:5d}  measured {pos / SR * 30:8.2f} f  offset {(pos / SR * 30 - frm):+.2f} f  (r={r:.2f})')
# 2) BGM: the residual (with - without) is the BGM alone; find bgm.wav in it at 3 points
bg = load('public/audio/bgm.wav')
res = withb[: min(len(withb), len(nob))] - nob[: min(len(withb), len(nob))]
for t in (5.0, 16.4, 31.2):
    i = int(t * SR); ref = bg[i: i + int(0.5 * SR)]
    pos, r = xcorr_lag(ref, res, i, int(0.2 * SR))
    print(f'BGM at {t:5.1f}s  offset {(pos - i) / SR * 30:+.2f} f  ({(pos - i)} samples, r={r:.2f})')
