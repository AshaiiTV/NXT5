"""NXT5 promo — original track, synthesized from scratch (no samples, no copyrighted material).
150 BPM, F minor, 48 bars: intro / build / DROP 1 / persona-funk breakdown / build 2 / DROP 2 / outro.
Writes music.wav + events.json (kick/snare/impact times for the visual sync)."""
import json, os, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
BPM = 150
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 48
TAIL = 3.0
DUR = BARS * BAR + TAIL
N = int(DUR * SR)
rng = np.random.default_rng(5)

drums = np.zeros((2, N))
music = np.zeros((2, N))   # sidechained bus
fx = np.zeros((2, N))      # not sidechained (impacts, risers)
send = np.zeros((2, N))    # reverb send
events = {"kick": [], "snare": [], "impact": [], "hat": [], "stab": []}


def b2t(bar, beat=0.0):
    return bar * BAR + beat * BEAT


def place(bus, t0, sig, gain=1.0, pan=0.0, rev=0.0):
    i = int(round(t0 * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        sig = np.vstack([sig * l * 1.414, sig * r * 1.414])
    n = min(sig.shape[1], N - i)
    bus[:, i:i + n] += sig[:, :n] * gain
    if rev:
        send[:, i:i + n] += sig[:, :n] * gain * rev


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x, axis=-1)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x, axis=-1)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x, axis=-1)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def saw(f, d, phase=None):
    t = tt(d)
    ph = (f * t + (rng.random() if phase is None else phase)) % 1.0
    return 2 * ph - 1


def env_adsr(d, a=0.005, dec=0.1, s=0.7, r=0.1):
    n = int(d * SR)
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(dec, 1e-4)))
    rel = int(r * SR)
    if rel and n > rel:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e

# ---------------------------------------------------------------- drums

def kick(big=False):
    t = tt(0.55 if big else 0.42)
    f = 46 + (130 if big else 115) * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * (5 if big else 9))
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 350) * 0.5
    return np.tanh((body + click) * 2.2) * 0.9


def snare():
    t = tt(0.32)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * 0.7
    nz = bp(rng.standard_normal(len(t)), 900, 9000) * np.exp(-t * 14)
    return np.tanh((tone + nz) * 1.6) * 0.75


def clap():
    t = tt(0.28)
    nz = bp(rng.standard_normal(len(t)), 900, 4000)
    e = np.zeros(len(t))
    for k, o in enumerate([0, 0.011, 0.022]):
        e += np.where(t >= o, np.exp(-(t - o) * (180 if k < 2 else 16)), 0)
    return nz * e * 0.9


def hat(open_=False):
    t = tt(0.3 if open_ else 0.06)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (11 if open_ else 70)) * 0.35


def crash():
    t = tt(2.4)
    return hp(rng.standard_normal(len(t)), 4500) * np.exp(-t * 1.8) * 0.35


def impact():
    t = tt(3.0)
    f = 30 + 70 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    nz = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 5) * 0.6
    return np.tanh((boom * 1.4 + nz) * 1.8) * 0.9


def rev_cymbal(d):
    t = tt(d)
    e = (t / d) ** 3
    return hp(rng.standard_normal(len(t)), 5000) * e * 0.45


def noise_riser(d, f0=300, f1=9000):
    n = int(d * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 1024
    zi = None
    for s in range(0, n, blk):
        p = s / n
        fc = f0 * (f1 / f0) ** p
        sos = butter(2, [fc * 0.6, min(fc * 1.6, SR * 0.45)], 'band', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[s:s + blk], zi = sosfilt(sos, x[s:s + blk], zi=zi)
    return out * (np.arange(n) / n) ** 2 * 1.2


def pitch_riser(d, m0=41, m1=77):
    t = tt(d)
    f = mtof(m0 + (m1 - m0) * (t / d) ** 1.6)
    ph = np.cumsum(f) / SR
    x = sum((2 * ((ph * (1 + dt) + o) % 1) - 1) for dt, o in [(0, 0), (0.007, .3), (-0.006, .6)])
    return lp(x, 5000) * (t / d) ** 2 * 0.18


def downlifter(d):
    t = tt(d)
    f = 1800 * np.exp(-t * 4) + 60
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * 0.25

# ---------------------------------------------------------------- synths

def supersaw(notes, d, cutoff=4000, voices=7, spread=0.22, a=0.01, r=0.15):
    L = np.zeros(int(d * SR)); R = np.zeros_like(L)
    for m in notes:
        for v in range(voices):
            det = (v - (voices - 1) / 2) / ((voices - 1) / 2) * spread
            s = saw(mtof(m + det), d)
            if v % 2:
                L += s * 0.8; R += s * 0.2
            else:
                L += s * 0.2; R += s * 0.8
    e = env_adsr(d, a, 0.3, 0.85, r)
    st = np.vstack([L, R]) * e / (voices * len(notes)) * 2.2
    return lp(st, cutoff, 2)


def reese(m, d, cutoff=550):
    f = mtof(m)
    x = saw(f * 1.004, d) + saw(f * 0.996, d) + 0.55 * np.sin(2 * np.pi * f / 2 * tt(d))
    return np.tanh(lp(x, cutoff) * 1.4) * env_adsr(d, 0.004, 0.08, 0.8, 0.03) * 0.5


def pluck(m, d=0.22, bright=5000):
    f = mtof(m)
    t = tt(d)
    x = saw(f, d) * 0.6 + (np.sign(np.sin(2 * np.pi * f * t))) * 0.4
    x = lp(x, bright) * np.exp(-t * 14)
    return x * 0.38


def brass(notes, d):
    out = np.zeros(int(d * SR))
    t = tt(d)
    for m in notes:
        for o in (0, 12):
            out += saw(mtof(m + o) * (1 + 0.003 * np.sin(2 * np.pi * 5 * t)), d) * (1 if o == 0 else 0.5)
    e = env_adsr(d, 0.025, 0.25, 0.55, 0.12)
    return lp(out * e, 2600, 2) / len(notes) * 0.75


def choir(notes, d):
    t = tt(d)
    out = np.zeros(len(t))
    for m in notes:
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.3 * t + rng.random() * 6)
        ph = np.cumsum(mtof(m) * vib) / SR
        s = 2 * (ph % 1) - 1
        out += bp(s, 550, 900) * 1.2 + bp(s, 1050, 1350) * 0.6
    e = np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.4)
    return out * e / len(notes) * 0.9


def epiano(notes, d):
    t = tt(d)
    out = np.zeros(len(t))
    for m in notes:
        f = mtof(m)
        mod = np.sin(2 * np.pi * f * 14 * t) * 1.3 * np.exp(-t * 9)
        out += np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.6)
    return out / len(notes) * 0.55


def pad(notes, d, cutoff=900):
    return supersaw(notes, d, cutoff=cutoff, voices=5, spread=0.12, a=0.6, r=0.8) * 0.8


def sub_hit(m=29, d=0.5):
    t = tt(d)
    return np.sin(2 * np.pi * mtof(m) * t) * np.exp(-t * 6) * 0.9

# ---------------------------------------------------------------- harmony
# F minor: Fm - Db - Ab - Eb   (i VI III VII)
CH = [[53, 56, 60, 65], [49, 53, 56, 61], [48, 51, 56, 60], [51, 55, 58, 63]]
ROOT = [29, 25, 32, 27]           # F1 Db1 Ab1 Eb1
JAZZ = [[53, 56, 60, 63, 67], [49, 53, 56, 60, 63], [48, 51, 55, 56, 60], [51, 55, 58, 61, 65]]  # Fm9 Dbmaj9 Abmaj7 Eb7
ARP = [0, 2, 1, 3, 2, 1, 3, 2]


def k(bar, beat, big=False, g=1.0):
    place(drums, b2t(bar, beat), kick(big), g)
    events["kick"].append(round(b2t(bar, beat), 4))


def sn(bar, beat, g=1.0, withclap=True):
    place(drums, b2t(bar, beat), snare(), g, rev=0.25)
    if withclap:
        place(drums, b2t(bar, beat), clap(), g * 0.8, rev=0.3)
    events["snare"].append(round(b2t(bar, beat), 4))


def imp(bar, beat=0, g=1.0):
    place(fx, b2t(bar, beat), impact(), g, rev=0.5)
    place(drums, b2t(bar, beat), crash(), 0.8)
    events["impact"].append(round(b2t(bar, beat), 4))


def hats(bar, pattern, open_beats=()):
    for b in pattern:
        o = b in open_beats
        place(drums, b2t(bar, b), hat(o), 0.9 if o else 0.6, pan=0.25 if int(b * 4) % 2 else -0.15)
        events["hat"].append(round(b2t(bar, b), 4))

# --- INTRO 0-8
imp(0, g=1.1)
place(fx, 0, downlifter(2.5), 1.0, rev=0.4)
for bar in range(8):
    c = bar % 4
    place(music, b2t(bar), pad(CH[c], BAR + 0.3, cutoff=500 + bar * 180), 0.9, rev=0.5)
    place(drums, b2t(bar), sub_hit(ROOT[c] + 12), 0.8)       # heartbeat
    place(drums, b2t(bar, 0.75), sub_hit(ROOT[c] + 12), 0.5)
    if bar >= 2:
        place(music, b2t(bar), choir([m + 12 for m in CH[c][1:]], BAR), 0.5, rev=0.6)
    if bar >= 4:
        for i in range(16):
            m = CH[c][ARP[i % 8]] + 12
            place(music, b2t(bar, i / 4), pluck(m, bright=900 + (bar - 4) * 700 + i * 30), 0.55, pan=0.4 * np.sin(i), rev=0.3)
        hats(bar, [x / 2 for x in range(8)])
    if bar in (4, 6):
        place(music, b2t(bar), brass(CH[c], BEAT * 1.5), 1.0, rev=0.5)
        events["stab"].append(round(b2t(bar), 4))
    if bar >= 6:
        for b in range(4):
            k(bar, b, g=0.85)
imp(4, g=0.7)

# --- BUILD 8-12
for bar in range(8, 12):
    c = bar % 4
    p = (bar - 8) / 4
    place(music, b2t(bar), supersaw(CH[c], BAR, cutoff=700 + p * 3500), 0.5, rev=0.3)
    place(music, b2t(bar), reese(ROOT[c] + 12, BAR), 0.5)
    div = [1, 2, 4, 8][bar - 8]
    for i in range(4 * div):
        if bar == 11 and i >= 4 * div - div:   # 1-beat gap before the drop
            continue
        sn(bar, i / div, g=0.15 + 0.32 * (bar - 8 + i / (4 * div)) / 4, withclap=False)
    for b in range(4 if bar < 11 else 3):
        k(bar, b, g=0.7)
    if bar == 10:
        for b in (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5):
            k(bar, b, g=0.7)
place(fx, b2t(8), noise_riser(BAR * 4 - BEAT), 0.3, rev=0.3)
place(fx, b2t(8), pitch_riser(BAR * 4 - BEAT), 0.7, rev=0.3)
place(fx, b2t(11, 1), rev_cymbal(BEAT * 3), 1.0)


def drop_bars(start, n, hype=False):
    for bar in range(start, start + n):
        c = bar % 4
        local = bar - start
        place(music, b2t(bar), supersaw(CH[c], BAR, cutoff=7500 if hype else 6500), 2.2, rev=0.25)
        place(music, b2t(bar), hp(supersaw([m + 12 for m in CH[c]], BAR, cutoff=9000, voices=5), 900), 0.9, rev=0.3)
        if hype:
            place(music, b2t(bar), supersaw([m + 12 for m in CH[c][1:]], BAR, cutoff=7000, voices=5), 0.4, rev=0.3)
            place(music, b2t(bar), choir([m + 12 for m in CH[c]], BAR), 0.7, rev=0.5)
        for i in range(8):                       # driving reese 8ths
            oct_ = 12 if i % 4 == 3 else 0
            place(music, b2t(bar, i / 2), reese(ROOT[c] + 12 + oct_, BEAT / 2 * 0.95, cutoff=1300), 0.6)
        for i in range(16):                      # 16th lead arp
            m = CH[c][ARP[i % 8]] + (24 if hype else 12)
            place(music, b2t(bar, i / 4), pluck(m, bright=8000), 0.95, pan=0.5 * np.sin(i * 1.3), rev=0.2)
        # drums: big halftime-ish epic groove
        for b in (0, 1.5, 2, 2.75) if local % 2 else (0, 1, 2, 2.5, 3):
            k(bar, b)
        for b in (1, 3):
            sn(bar, b)
        hats(bar, [x / 2 + 0.5 for x in range(0, 8, 2)] + [x / 4 for x in range(16) if x % 2], open_beats=(0.5, 1.5, 2.5, 3.5))
        if hype and local % 2 == 0:
            place(music, b2t(bar), brass(CH[c], BEAT * 0.9), 1.0, rev=0.4)
            place(music, b2t(bar, 1.5), brass(CH[c], BEAT * 0.5), 0.8, rev=0.4)
            events["stab"] += [round(b2t(bar), 4), round(b2t(bar, 1.5), 4)]
        if local % 4 == 0 and local:
            place(drums, b2t(bar), crash(), 0.7)

# --- DROP 1 12-20
imp(12, g=1.2)
drop_bars(12, 8)
place(fx, b2t(19, 2), rev_cymbal(BEAT * 2), 0.6)

# --- BREAKDOWN 20-28  (persona-funk halftime)
imp(20, g=0.7)
place(fx, b2t(20), downlifter(2), 1.0, rev=0.4)
FUNK = [(0, 0, .45), (0.75, 12, .2), (1.5, 0, .25), (2, 7, .2), (2.5, 10, .2), (3.25, 12, .2), (3.5, 0, .2)]
for bar in range(20, 28):
    c = bar % 4
    place(music, b2t(bar), epiano(JAZZ[c], BAR * 0.9), 0.9, rev=0.4)
    place(music, b2t(bar, 2.5), epiano(JAZZ[c][2:], BEAT), 0.5, rev=0.4)
    for b, o, d in FUNK:
        place(music, b2t(bar, b), reese(ROOT[c] + 24 + o, d, cutoff=1400), 0.7)
    if bar < 26:
        k(bar, 0); k(bar, 2.5, g=0.7)
        sn(bar, 2)
        hats(bar, [x / 4 for x in range(16)], open_beats=(1.5, 3.5))
    else:
        hats(bar, [x / 2 for x in range(8)])
    if bar >= 24:
        place(music, b2t(bar), choir(CH[c], BAR), 0.6, rev=0.6)

# --- BUILD 2 28-32
for bar in range(28, 32):
    c = bar % 4
    p = (bar - 28) / 4
    place(music, b2t(bar), supersaw(CH[c], BAR, cutoff=900 + p * 5000), 0.7, rev=0.3)
    place(music, b2t(bar), choir([m + 12 for m in CH[c]], BAR), 0.6, rev=0.6)
    place(music, b2t(bar), reese(ROOT[c] + 12, BAR), 0.55)
    div = [2, 4, 8, 16][bar - 28]
    for i in range(4 * div):
        if bar == 31 and i >= 4 * div - div:
            continue
        sn(bar, i / div, g=0.15 + 0.35 * (bar - 28 + i / (4 * div)) / 4, withclap=False)
    for b in range(4 if bar < 31 else 3):
        k(bar, b, g=0.75)
place(fx, b2t(28), noise_riser(BAR * 4 - BEAT, 400, 12000), 0.35, rev=0.3)
place(fx, b2t(28), pitch_riser(BAR * 4 - BEAT, 46, 84), 0.8, rev=0.3)
place(fx, b2t(31, 1), rev_cymbal(BEAT * 3), 1.1)

# --- DROP 2 32-44
imp(32, g=1.3)
drop_bars(32, 8, hype=True)
# bars 40-42: "all-out attack" stutter — halftime hits on brass
for bar in (40, 41):
    c = bar % 4
    for b in (0, 0.75, 1.5, 2.5, 3, 3.5):
        place(music, b2t(bar, b), brass(CH[c], BEAT * 0.4), 1.1, rev=0.4)
        place(music, b2t(bar, b), supersaw(CH[c], BEAT * 0.4, cutoff=6000), 0.7)
        k(bar, b, g=0.95)
        events["stab"].append(round(b2t(bar, b), 4))
    sn(bar, 2)
    if bar == 41:
        for i in range(8):
            sn(bar, 3 + i / 8, g=0.5 + i * 0.06, withclap=False)
place(fx, b2t(41), noise_riser(BAR, 1000, 12000), 0.8)
imp(42, g=1.1)
drop_bars(42, 2, hype=True)

# --- OUTRO 44-48
imp(44, g=1.4)
place(music, b2t(44), supersaw(CH[0] + [41], BAR * 2.5, cutoff=4500, r=1.5), 1.0, rev=0.7)
place(music, b2t(44), brass(CH[0], BAR * 1.2), 1.0, rev=0.7)
place(music, b2t(44), choir([m + 12 for m in CH[0]], BAR * 3), 0.8, rev=0.7)
place(drums, b2t(44), sub_hit(29, 3.0), 1.0)
for bar in (44, 45):
    for b in (0, 1, 2, 3):
        k(bar, b, g=0.6 if bar == 45 else 0.9)
place(music, b2t(46), pad(CH[0], BAR * 2 + TAIL, cutoff=700), 0.9, rev=0.8)
imp(46, 2, g=0.9)
place(fx, b2t(46, 2), downlifter(3), 0.8, rev=0.5)

# ---------------------------------------------------------------- mix
kt = np.array(sorted(set(events["kick"])))
t = np.arange(N) / SR
idx = np.searchsorted(kt, t, side='right') - 1
since = np.where(idx >= 0, t - kt[np.clip(idx, 0, None)], 10)
duck = 1 - 0.72 * np.exp(-since * 11)
music *= duck
# true silence on the last beat before each drop (only the reverse cymbal breathes in)
for gb in (11, 31):
    a, b = int(b2t(gb, 3) * SR), int(b2t(gb + 1) * SR)
    g = np.ones(N)
    g[a:b] = 0
    r = int(0.012 * SR)
    g[a - r:a] = np.linspace(1, 0, r)
    music *= g
    send[:, a:b] *= 0.2

ir_t = np.arange(int(2.6 * SR)) / SR
ir = np.vstack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))]) * np.exp(-ir_t * 2.4)
ir = lp(ir, 6000)
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
wet = np.vstack([fftconvolve(hp(send[i], 250), ir[i])[:N] for i in range(2)])

music = hp(music, 35)
if os.environ.get('STEMS'):
    for nm, bus in [('drums', drums * 0.55), ('music', music), ('fx', fx * 0.7), ('wet', wet * 0.6)]:
        row = []
        for a, b in [(0, 8), (8, 12), (12, 20), (20, 28), (28, 32), (32, 44), (44, 48)]:
            seg = bus[:, int(a * BAR * SR):int(b * BAR * SR)]
            row.append(f"{10 * np.log10((seg ** 2).mean() + 1e-12):6.1f}")
        print(nm.ljust(6), ' '.join(row))
mix = drums * 0.55 + music * 1.0 + fx * 0.7 + wet * 0.6
mix = hp(mix, 25)
# gentle glue: normalise, then soft-knee clip only the transients above ~-3 dBFS
mix /= np.abs(mix).max()
knee = 0.7
over = np.abs(mix) > knee
mix[over] = np.sign(mix[over]) * (knee + (1 - knee) * np.tanh((np.abs(mix[over]) - knee) / (1 - knee)))
mix /= np.abs(mix).max() / 0.89
fade = int(1.5 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)

out = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'
import wave
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype('<i2').tobytes())
import subprocess, os
tmp = out + '.tmp.wav'
os.replace(out, tmp)
meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', tmp, '-af', 'loudnorm=I=-13:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])
subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', tmp, '-af',
                f"loudnorm=I=-13:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
                '-ar', str(SR), out], check=True)
os.remove(tmp)
for kk in events:
    events[kk] = sorted(set(events[kk]))
events.update(bpm=BPM, bar=BAR, beat=BEAT, bars=BARS, duration=DUR)
json.dump(events, open(out.replace('.wav', '.events.json'), 'w'))
print('ok', DUR, {kk: len(v) for kk, v in events.items() if isinstance(v, list)})
