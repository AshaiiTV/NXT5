import numpy as np, librosa, json
SK = '/root/.claude/plugins/synced/9f6a26a5-8917-441e-8ced-f4e8e05c7234_7bc15173-7037-40de-8e33-2cf48c45337d/74655670-1540-4e3d-8509-c2f446898c2c'
y, sr = librosa.load(f'{SK}/assets/audio/bgm/g-eazy-nba-type.mp3', sr=None, mono=True)
hop = 128
env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
t = librosa.times_like(env, sr=sr, hop_length=hop)
# drop: biggest rise of short-term energy between 12 and 17 s
rms = librosa.feature.rms(y=y, hop_length=hop, frame_length=1024)[0]
rt = librosa.times_like(rms, sr=sr, hop_length=hop)
m = (rt > 12) & (rt < 17)
d = np.diff(20*np.log10(rms + 1e-9))
i = np.argmax(np.where(m[1:], d, -99))
print('largest energy jump 12–17 s at', round(rt[i+1], 4))
o = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=hop, units='time', backtrack=False)
s = env[librosa.time_to_frames(o, sr=sr, hop_length=hop)]
w = (o > 14) & (o < 45)
ow, sw = o[w], s[w]
strong = ow[sw > np.percentile(sw, 70)]
print('strong onsets 14–20 s:', [round(x, 3) for x in strong[strong < 20]])
ioi = np.diff(strong)
h, e = np.histogram(ioi, bins=np.arange(0.1, 1.6, 0.0346))
top = np.argsort(h)[-6:][::-1]
print('IOI peaks (s):', [(round((e[j]+e[j+1])/2, 3), int(h[j])) for j in top])
tg = librosa.feature.tempogram(onset_envelope=env, sr=sr, hop_length=hop)
ac = tg.mean(axis=1); lags = np.arange(len(ac)) * hop / sr
cand = [(round(60/lags[j], 1), round(float(ac[j]), 3)) for j in np.argsort(ac)[::-1] if 0.25 < lags[j] < 1.5][:8]
print('tempogram peaks (BPM, strength):', cand)
