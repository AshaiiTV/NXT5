# Beat grid + energy structure for the candidate BGMs (music-beat-sync.md §1–3).
import json, sys
import numpy as np, librosa
from scipy.signal import butter, sosfilt

def band_env(y, sr, lo, hi):
    sos = butter(4, [lo, hi], btype="band", fs=sr, output="sos")
    env = librosa.onset.onset_strength(y=sosfilt(sos, y), sr=sr)
    return env, librosa.times_like(env, sr=sr)

def grid(beats):
    i = np.arange(len(beats))
    A = np.vstack([i, np.ones_like(i)]).T
    (T, t0), *_ = np.linalg.lstsq(A, beats, rcond=None)
    res = beats - (t0 + i * T)
    return T, t0, res

def analyze(path):
    y, sr = librosa.load(path, sr=None, mono=True)
    yp = librosa.effects.percussive(y)
    tempo, beats = librosa.beat.beat_track(y=yp, sr=sr, tightness=400, units="time")
    T, t0, res = grid(beats)
    onsets = librosa.onset.onset_detect(y=yp, sr=sr, units="time")
    out = {}
    for mult in (0.5, 1, 2):
        Tm = T / mult
        n = int((len(y) / sr - t0) / Tm)
        g = t0 + np.arange(n) * Tm
        d = np.array([np.min(np.abs(onsets - x)) for x in g])
        out[mult] = dict(match=float((d < 0.035).mean()), mean_abs_ms=float(d[d < 0.035].mean() * 1000) if (d < 0.035).any() else None)
    rms = librosa.feature.rms(y=y, hop_length=2048)[0]
    rt = librosa.times_like(rms, sr=sr, hop_length=2048)
    kick, kt = band_env(yp, sr, 40, 160)
    # per-bar (4 beats) loudness, for structure
    bars = []
    nb = int((len(y) / sr - t0) / (4 * T))
    for b in range(nb):
        a, z = t0 + b * 4 * T, t0 + (b + 1) * 4 * T
        m = (rt >= a) & (rt < z)
        bars.append(round(float(20 * np.log10(rms[m].mean() + 1e-9)), 1))
    # strongest kick hits on integer beats
    hits = []
    for n in range(int((kt[-1] - t0) / T)):
        tb = t0 + n * T
        hits.append((n, float(kick[np.argmin(np.abs(kt - tb))])))
    hits.sort(key=lambda h: -h[1])
    return dict(bpm=60 / T, T=T, t0=t0, resid_ms=float(np.abs(res).max() * 1000), grids=out, bars_db=bars,
                top_kick_beats=[h[0] for h in hits[:12]], duration=len(y) / sr)

SK = sys.argv[1]
res = {}
for name in ['g-eazy-nba-type', 'tonight-hiphop', 'cat-walk', 'house-vibez', 'bgm-tech-house']:
    r = analyze(f"{SK}/assets/audio/bgm/{name}.mp3")
    res[name] = r
    print(f"\n== {name}: BPM {r['bpm']:.2f}  t0 {r['t0']:.3f}  resid ±{r['resid_ms']:.0f}ms  dur {r['duration']:.0f}s")
    print('   grids', {k: (round(v['match'], 2), v['mean_abs_ms'] and round(v['mean_abs_ms'], 1)) for k, v in r['grids'].items()})
    print('   bar dB', ' '.join(f"{x:.0f}" for x in r['bars_db'][:48]))
    print('   top kick beats', r['top_kick_beats'])
json.dump(res, open('candidates.json', 'w'), indent=1)
