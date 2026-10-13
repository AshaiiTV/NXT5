# Beat grid + structure for g-eazy-nba-type.mp3 (music-beat-sync §1–3), kick-based like catwalk.
import json, numpy as np, librosa
from scipy.signal import butter, sosfilt, find_peaks
SK = '/root/.claude/plugins/synced/9f6a26a5-8917-441e-8ced-f4e8e05c7234_7bc15173-7037-40de-8e33-2cf48c45337d/74655670-1540-4e3d-8509-c2f446898c2c'
y, sr = librosa.load(f'{SK}/assets/audio/bgm/g-eazy-nba-type.mp3', sr=None, mono=True)
yp = librosa.effects.percussive(y)
def band(sig, lo, hi, hop=256):
    sos = butter(4, [lo, hi], btype='band', fs=sr, output='sos')
    env = librosa.onset.onset_strength(y=sosfilt(sos, sig), sr=sr, hop_length=hop)
    return env, librosa.times_like(env, sr=sr, hop_length=hop)
k, kt = band(yp, 40, 160)
s, st = band(yp, 1000, 3000)
h, ht = band(yp, 6000, 14000)
def peaks(env, t, pct=90, dist=0.15):
    p, _ = find_peaks(env, height=np.percentile(env, pct), distance=int(dist * sr / 256))
    return t[p], env[p]
kicks, kstr = peaks(k, kt)
snares, sstr = peaks(s, st)
# all onsets for grid voting
on = librosa.onset.onset_detect(y=yp, sr=sr, units='time', hop_length=256)
best = None
for bpm in np.arange(85.5, 88.0, 0.01):
    T = 60 / bpm
    for ph in np.arange(0, T, 0.002):
        fr = ((on - ph) / T * 2 + 0.5) % 1 - 0.5   # half-beat grid (8ths) to vote with all onsets
        sc = np.mean(np.abs(fr * T / 2) < 0.015)
        if best is None or sc > best[0]:
            best = (sc, bpm, ph)
sc, bpm, ph = best
T = 60 / bpm
n = np.round((on - ph) / (T / 2)); res = on - (ph + n * T / 2); m = np.abs(res) < 0.02
A = np.vstack([n[m], np.ones(m.sum())]).T
(T2h, t0), *_ = np.linalg.lstsq(A, on[m], rcond=None)
T2 = 2 * T2h
res2 = on[m] - (t0 + n[m] * T2h)
print(f'8th-grid vote match={sc:.3f}; refined BPM={60/T2:.3f} T={T2:.5f} t0={t0:.4f} mean={np.mean(np.abs(res2))*1000:.1f}ms drift={np.polyfit(on[m], res2, 1)[0]*1000:.3f}ms/s')
# which phase of the 8th grid is the beat? kicks should mostly sit on beats (even 8ths)
for name, ev in [('kick', kicks), ('snare', snares)]:
    idx = np.round((ev - t0) / T2h).astype(int); off = np.abs(ev - (t0 + idx * T2h)) < 0.03
    even = np.mean(idx[off] % 2 == 0); print(f'{name}: {off.mean():.2f} on 8th grid; share on even 8ths={even:.2f}')
rms = librosa.feature.rms(y=y, hop_length=512)[0]; rt = librosa.times_like(rms, sr=sr, hop_length=512)
def db(a, b):
    mm = (rt >= a) & (rt < b); return round(float(20*np.log10(rms[mm].mean()+1e-9)), 1)
beat0 = t0 % T2  # first beat >=0 (assuming even 8ths are beats)
nb = int((len(y)/sr - beat0) / T2)
print('beat0', round(beat0, 4), 'beats', nb, 'dur', round(len(y)/sr, 2))
row = []
for b in range(nb):
    a = beat0 + b * T2
    kk = int(np.sum((kicks >= a - 0.03) & (kicks < a + T2 - 0.03))); ss = int(np.sum((snares >= a - 0.03) & (snares < a + T2 - 0.03)))
    row.append((b, round(a, 3), db(a, a + T2), kk, ss))
for r in row: print(r)
json.dump(dict(bpm=60/T2, T=T2, t0=beat0, kicks=[float(x) for x in kicks], snares=[float(x) for x in snares], beats=row), open('geazy.json', 'w'))
