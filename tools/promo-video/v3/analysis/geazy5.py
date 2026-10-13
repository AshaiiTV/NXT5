import numpy as np, librosa, json
SK = '/root/.claude/plugins/synced/9f6a26a5-8917-441e-8ced-f4e8e05c7234_7bc15173-7037-40de-8e33-2cf48c45337d/74655670-1540-4e3d-8509-c2f446898c2c'
y, sr = librosa.load(f'{SK}/assets/audio/bgm/g-eazy-nba-type.mp3', sr=None, mono=True)
hop = 128
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
o = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, units='time')
s = env[librosa.time_to_frames(o, sr=sr, hop_length=hop)]
strong = o[s > np.percentile(s, 60)]
best = None
for bpm in np.arange(129.5, 130.5, 0.005):
    E = 60 / bpm / 2  # eighth
    for ph in np.arange(0, E, 0.001):
        d = ((strong - ph) / E + 0.5) % 1 - 0.5
        sc = np.mean(np.abs(d * E) < 0.015)
        if best is None or sc > best[0]: best = (sc, bpm, ph)
sc, bpm, ph = best
E = 60 / bpm / 2
n = np.round((strong - ph) / E); r = strong - (ph + n * E); m = np.abs(r) < 0.02
(E2, p2), *_ = np.linalg.lstsq(np.vstack([n[m], np.ones(m.sum())]).T, strong[m], rcond=None)
r2 = strong[m] - (p2 + n[m] * E2)
T = 2 * E2
print(f'8th-grid on strong onsets: match15ms={sc:.3f} BPM={60/T:.3f} T={T:.5f} eighth={E2:.5f} mean|r|={np.abs(r2).mean()*1000:.1f}ms drift={np.polyfit(strong[m], r2, 1)[0]*1000:.4f}ms/s')
drop = 16.3759
k = np.round((drop - p2) / E2); dropg = p2 + k * E2
print('drop transient 16.376 -> nearest 8th', round(dropg, 4), 'err', round((drop-dropg)*1000, 1), 'ms')
bar = 4 * T
rms = librosa.feature.rms(y=y, hop_length=512)[0]; rt = librosa.times_like(rms, sr=sr, hop_length=512)
def db(a, b):
    mm = (rt >= a) & (rt < b); return round(float(20*np.log10(rms[mm].mean()+1e-9)), 1)
b0 = dropg - np.floor(dropg / bar) * bar
rows = [(b, round(b0 + b*bar, 3), db(b0 + b*bar, b0 + (b+1)*bar)) for b in range(int((len(y)/sr - b0)/bar))]
print(rows)
# beat-level energy around the end of the main section
for a in np.arange(40, 48, T):
    pass
json.dump(dict(bpm=60/T, T=T, eighth=E2, phase8=p2, drop=float(dropg), bar=bar, bar0=float(b0), bars=rows), open('geazy130.json', 'w'))
