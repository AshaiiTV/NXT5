import json, numpy as np, librosa
from scipy.signal import butter, sosfilt, find_peaks
SK = '/root/.claude/plugins/synced/9f6a26a5-8917-441e-8ced-f4e8e05c7234_7bc15173-7037-40de-8e33-2cf48c45337d/74655670-1540-4e3d-8509-c2f446898c2c'
y, sr = librosa.load(f'{SK}/assets/audio/bgm/cat-walk.mp3', sr=None, mono=True)
yp = librosa.effects.percussive(y)
def band(lo, hi):
    sos = butter(4, [lo, hi], btype='band', fs=sr, output='sos')
    env = librosa.onset.onset_strength(y=sosfilt(sos, yp), sr=sr, hop_length=256)
    return env, librosa.times_like(env, sr=sr, hop_length=256)
k, kt = band(40, 160)
pk, _ = find_peaks(k, height=np.percentile(k, 90), distance=int(0.25 * sr / 256))
kicks = kt[pk]
# fit grid on kicks (4-on-the-floor => kicks ≈ beats)
T0 = 60 / 130
n = np.round((kicks - kicks[0]) / T0)
A = np.vstack([n, np.ones_like(n)]).T
(T, t0), *_ = np.linalg.lstsq(A, kicks, rcond=None)
res = kicks - (t0 + n * T)
good = np.abs(res) < 0.03
(T, t0), *_ = np.linalg.lstsq(A[good], kicks[good], rcond=None)
res = kicks - (t0 + n * T)
print(f'kick grid: BPM={60/T:.3f} t0={t0:.4f} T={T:.5f} kicks={len(kicks)} within±15ms={np.mean(np.abs(res)<0.015):.2f} mean={np.mean(np.abs(res[np.abs(res)<0.03]))*1000:.1f}ms')
# integer vs half-beat kick placement
frac = ((kicks - t0) / T) % 1
print('kicks on integer beats:', np.mean((frac < 0.1) | (frac > 0.9)).round(2), ' on half beats:', np.mean(np.abs(frac - 0.5) < 0.1).round(2))
rms = librosa.feature.rms(y=y, hop_length=1024)[0]; rt = librosa.times_like(rms, sr=sr, hop_length=1024)
bar = 4 * T
# move t0 back to first downbeat >= 0
first = t0 - np.floor(t0 / bar) * bar
print(f'first downbeat at {first:.4f}s, bar={bar:.4f}s')
rows = []
for b in range(int((len(y)/sr - first) / bar)):
    a = first + b * bar
    m = (rt >= a) & (rt < a + bar)
    kk = np.sum((kicks >= a) & (kicks < a + bar))
    rows.append((b, round(a, 3), round(float(20*np.log10(rms[m].mean()+1e-9)), 1), int(kk)))
for r in rows[:40]: print(r)
json.dump(dict(bpm=60/T, T=T, t0=first, kicks=[float(x) for x in kicks], bars=rows), open('catwalk.json', 'w'))
