import json, numpy as np
d = json.load(open('catwalk.json'))
kicks = np.array(d['kicks'])
best = None
for bpm in np.arange(129.80, 130.20, 0.01):
    T = 60 / bpm
    for ph in np.arange(0, T, 0.001):
        frac = ((kicks - ph) / T + 0.5) % 1 - 0.5
        score = np.mean(np.abs(frac * T) < 0.02)
        if best is None or score > best[0]:
            best = (score, bpm, ph)
score, bpm, ph = best
T = 60 / bpm
n = np.round((kicks - ph) / T)
res = kicks - (ph + n * T)
m = np.abs(res) < 0.02
A = np.vstack([n[m], np.ones(m.sum())]).T
(T2, t02), *_ = np.linalg.lstsq(A, kicks[m], rcond=None)
res2 = kicks[m] - (t02 + n[m] * T2)
print(f'best phase search: match={score:.3f} bpm={bpm:.2f} phase={ph:.3f}')
print(f'refined: BPM={60/T2:.4f} t0={t02:.4f} T={T2:.5f} mean_abs={np.mean(np.abs(res2))*1000:.1f}ms max={np.max(np.abs(res2))*1000:.1f}ms drift_slope={np.polyfit(kicks[m], res2, 1)[0]*1000:.3f}ms/s')
# downbeat: which beat mod 4 holds the strongest kicks / section starts? use energy jump at ~29.7s
json.dump(dict(bpm=60/T2, T=T2, t0=float(t02 % T2), match=score), open('catwalk_grid.json', 'w'))
