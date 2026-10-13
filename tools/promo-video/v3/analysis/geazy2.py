import json, numpy as np, librosa
from scipy.signal import butter, sosfilt, find_peaks
SK = '/root/.claude/plugins/synced/9f6a26a5-8917-441e-8ced-f4e8e05c7234_7bc15173-7037-40de-8e33-2cf48c45337d/74655670-1540-4e3d-8509-c2f446898c2c'
y, sr = librosa.load(f'{SK}/assets/audio/bgm/g-eazy-nba-type.mp3', sr=None, mono=True)
yp = librosa.effects.percussive(y)
tempo, beats = librosa.beat.beat_track(y=yp, sr=sr, tightness=400, units='time')
i = np.arange(len(beats)); A = np.vstack([i, np.ones_like(i)]).T
(T, t0), *_ = np.linalg.lstsq(A, beats, rcond=None)
res = beats - (t0 + i * T)
print(f'beat_track fit: BPM={60/T:.3f} T={T:.5f} t0={t0:.4f} n={len(beats)} resid max={np.abs(res).max()*1000:.0f}ms mean={np.abs(res).mean()*1000:.1f}ms')
def band(lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=sr, output='sos')
    env = librosa.onset.onset_strength(y=sosfilt(sos, yp), sr=sr, hop_length=256)
    return env, librosa.times_like(env, sr=sr, hop_length=256)
for name, lo, hi in [('kick', 40, 160), ('snare', 1000, 3000), ('hat', 6000, 14000)]:
    env, t = band(lo, hi)
    p, _ = find_peaks(env, height=np.percentile(env, 92), distance=int(0.12 * sr / 256))
    ev = t[p]
    ph = ((ev - t0) / T) % 1
    hist = np.histogram(ph, bins=8, range=(0, 1))[0]
    print(f'{name:5s} n={len(ev)} beat-phase histogram (8 bins from beat):', hist.tolist())
# per-beat energy, first beat >= 0
b0 = t0 - np.ceil(t0 / T) * T if t0 > 0 else t0
b0 = t0 % T
rms = librosa.feature.rms(y=y, hop_length=512)[0]; rt = librosa.times_like(rms, sr=sr, hop_length=512)
def db(a, b):
    mm = (rt >= a) & (rt < b); return round(float(20*np.log10(rms[mm].mean()+1e-9)), 1)
nb = int((len(y)/sr - b0) / T)
line = []
for b in range(nb):
    a = b0 + b * T
    line.append(f'{b}:{a:.2f}:{db(a, a+T)}')
print(' '.join(line))
json.dump(dict(bpm=60/T, T=float(T), t0=float(b0), beats=[float(x) for x in beats]), open('geazy_grid.json', 'w'))
