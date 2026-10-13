import json, numpy as np, librosa
from scipy.signal import butter, sosfilt, find_peaks
SK = '/root/.claude/plugins/synced/9f6a26a5-8917-441e-8ced-f4e8e05c7234_7bc15173-7037-40de-8e33-2cf48c45337d/74655670-1540-4e3d-8509-c2f446898c2c'
y, sr = librosa.load(f'{SK}/assets/audio/bgm/g-eazy-nba-type.mp3', sr=None, mono=True)
yp = librosa.effects.percussive(y)
g = json.load(open('geazy_grid.json')); T = g['T']
def band(lo, hi, hop=128):
    sos = butter(4, [lo, hi], btype='band', fs=sr, output='sos')
    env = librosa.onset.onset_strength(y=sosfilt(sos, yp), sr=sr, hop_length=hop)
    return env, librosa.times_like(env, sr=sr, hop_length=hop)
k, kt = band(30, 120)
p, pr = find_peaks(k, height=np.percentile(k, 95), distance=int(0.2 * sr / 128))
ev, st = kt[p], k[p]
strong = ev[st > np.percentile(st, 50)]
# phase search on the beat period using strong kicks only, fine resolution
best = None
for ph in np.arange(0, T, 0.002):
    d = ((strong - ph) / T + 0.5) % 1 - 0.5
    sc = np.mean(np.abs(d * T) < 0.02)
    if best is None or sc > best[0]: best = (sc, ph)
print('beat phase from strong kicks:', best, ' (beat_track t0 mod T =', g['t0'], ')')
# same on bar period to find the downbeat
bar = 4 * T
bestb = None
for ph in np.arange(0, bar, 0.004):
    d = ((strong - ph) / bar + 0.5) % 1 - 0.5
    sc = np.mean(np.abs(d * bar) < 0.03)
    if bestb is None or sc > bestb[0]: bestb = (sc, ph)
print('downbeat phase (bar period):', bestb)
# kick distribution within the bar from that downbeat, 16 bins (16ths)
ph = bestb[1]
pos = (((ev - ph) / bar) % 1) * 16
print('kick 16th-position histogram:', np.histogram(pos, bins=16, range=(-0.5, 15.5))[0].tolist())
sn, snt = band(150, 400)
ps, _ = find_peaks(sn, height=np.percentile(sn, 95), distance=int(0.2 * sr / 128))
spos = (((snt[ps] - ph) / bar) % 1) * 16
print('snare-body 16th-position histogram:', np.histogram(spos, bins=16, range=(-0.5, 15.5))[0].tolist())
# energy per bar from the downbeat
rms = librosa.feature.rms(y=y, hop_length=512)[0]; rt = librosa.times_like(rms, sr=sr, hop_length=512)
def db(a, b):
    m = (rt >= a) & (rt < b); return round(float(20*np.log10(rms[m].mean()+1e-9)), 1)
d0 = ph % bar
print('bars from', round(d0, 4), [(b, round(d0 + b*bar, 2), db(d0 + b*bar, d0 + (b+1)*bar)) for b in range(int((len(y)/sr - d0)/bar))])
json.dump(dict(T=T, beat_phase=best[1], downbeat=d0, bar=bar, strong_kicks=[float(x) for x in strong]), open('geazy_downbeat.json', 'w'))
