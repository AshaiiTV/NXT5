"""NXT5 promo v2 — hybrid trailer cue (orchestra from the MuseScore General soundfont + synthesized
hits), 120 BPM, D minor, 18 bars + tail: hook (0-8 s) / build (8-16 s) / drop (16-32 s) / end (32-38 s).
Usage: python3 music2.py out/music2.wav   -> wav + .events.json (sync points for the picture)."""
import json, os, subprocess, sys, tempfile, wave
import numpy as np
import mido
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 18
DUR = BARS * BAR + 2.0
N = int(DUR * SR)
SF = '/usr/share/sounds/sf3/MuseScore_General_Full.sf3'
rng = np.random.default_rng(11)
T = lambda bar, beat=0.0: bar * BAR + beat * BEAT
events = {k: [] for k in ('impact', 'kick', 'snare', 'braam', 'hit', 'taiko')}

# ------------------------------------------------------------------ harmony (D minor: i - VI - III - VII)
D2, F2, A2, Bb1, C2, E2, G2 = 38, 41, 45, 34, 36, 40, 43
CHORDS = [[38, 50, 53, 57, 62], [34, 46, 50, 53, 58], [41, 48, 53, 57, 60], [36, 48, 52, 55, 60]]  # Dm Bb F C
ROOTS = [26, 22, 29, 24]  # D1 Bb0 F1 C1 (sub)
MOTIF = [(0, 74, 1.5), (1.5, 69, 0.5), (2, 72, 1), (3, 70, 1)]  # brass hook over each chord (shifted per chord)

# ------------------------------------------------------------------ orchestra stems via fluidsynth
def render_midi(notes, program, gain=1.0, channel=0):
    """notes: list of (start_s, midi, dur_s, velocity). Returns stereo float array (2, N)."""
    mid = mido.MidiFile(ticks_per_beat=480)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
    tr.append(mido.Message('program_change', program=program, channel=channel))
    evs = []
    for s, n, d, v in notes:
        evs.append((s, 1, mido.Message('note_on', note=int(n), velocity=int(v), channel=channel)))
        evs.append((s + d, 0, mido.Message('note_off', note=int(n), velocity=0, channel=channel)))
    evs.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for t, _, msg in evs:
        tick = int(round(t / BEAT * 480))
        msg.time = tick - last
        last = tick
        tr.append(msg)
    with tempfile.TemporaryDirectory() as td:
        mp, wp = os.path.join(td, 'a.mid'), os.path.join(td, 'a.wav')
        mid.save(mp)
        subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', str(SR), '-o', 'synth.reverb.active=0',
                        '-o', 'synth.chorus.active=0', '-F', wp, SF, mp], check=True, capture_output=True)
        with wave.open(wp) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).T / 32768.0
    out = np.zeros((2, N))
    n = min(N, x.shape[1])
    out[:, :n] = x[:, :n]
    return out * gain

# ------------------------------------------------------------------ dsp helpers
def lp(x, fc, o=2):
    return sosfilt(butter(o, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x, axis=-1)
def hp(x, fc, o=2):
    return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x, axis=-1)
def tt(d):
    return np.arange(int(d * SR)) / SR
def place(bus, t0, sig, g=1.0, pan=0.0):
    i = int(t0 * SR)
    if sig.ndim == 1:
        sig = np.vstack([sig * np.sqrt(0.5 - pan / 2), sig * np.sqrt(0.5 + pan / 2)]) * 1.414
    n = min(sig.shape[1], N - i)
    if n > 0:
        bus[:, i:i + n] += sig[:, :n] * g
def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)
def saw_blep(f, d, ph0=0.0):
    """Band-limited saw (polyBLEP) — the cheap naive saw was a big part of the v1 'cheap' sound."""
    t = tt(d)
    f = np.broadcast_to(f, t.shape) if np.ndim(f) else np.full(t.shape, f)
    dt = f / SR
    ph = (np.cumsum(dt) + ph0) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y

# ------------------------------------------------------------------ synthesized hybrid layer
def kick(d=0.6):
    t = tt(d)
    f = 42 + 110 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 400) * 0.35
    return np.tanh((body + click) * 2.0) * 0.9

def snare():
    t = tt(0.5)
    body = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 22) * 0.6
    nz = lp(hp(rng.standard_normal(len(t)), 1200), 9000) * np.exp(-t * 11)
    return np.tanh((body + nz) * 1.4) * 0.7

def hat(open_=False):
    t = tt(0.35 if open_ else 0.07)
    return hp(rng.standard_normal(len(t)), 7500) * np.exp(-t * (10 if open_ else 65)) * 0.4

def crash(d=2.6):
    t = tt(d)
    x = hp(rng.standard_normal(len(t)), 5000) + 0.4 * hp(rng.standard_normal(len(t)), 2500)
    return x * np.exp(-t * 1.6) * 0.35

def taiko():
    t = tt(1.6)
    f = 58 + 60 * np.exp(-t * 18)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    skin = lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 30) * 0.8
    return np.tanh((body * 1.3 + skin) * 1.6) * 0.85

def braam(notes=(26, 38, 45), d=3.2):
    """Low brass 'braam': detuned band-limited saws through an opening/closing filter, saturated."""
    t = tt(d)
    x = np.zeros(len(t))
    for m in notes:
        for det in (-0.08, 0.0, 0.09):
            x += saw_blep(mtof(m + det), d, rng.random())
    x /= 3 * len(notes)
    env_f = 150 + 2200 * (1 - np.exp(-t * 9)) * np.exp(-t * 0.9)
    out = np.zeros_like(x)
    blk = 512
    zi = np.zeros((2, 2))
    for s in range(0, len(x), blk):
        sos = butter(4, env_f[s], 'low', fs=SR, output='sos')
        if zi.shape[0] != sos.shape[0]:
            zi = np.zeros((sos.shape[0], 2))
        out[s:s + blk], zi = sosfilt(sos, x[s:s + blk], zi=zi)
    amp = np.minimum(1, t / 0.03) * np.exp(-t * 0.7)
    return np.tanh(out * amp * 3.2) * 0.8

def sub(m, d):
    t = tt(d)
    e = np.minimum(1, t / 0.01) * np.minimum(1, (d - t) / 0.05)
    return np.sin(2 * np.pi * mtof(m) * t) * e * 0.8

def pulse(m, d, cutoff):
    t = tt(d)
    x = saw_blep(mtof(m), d) * 0.6 + saw_blep(mtof(m) * 1.005, d) * 0.4
    return lp(x, cutoff) * np.exp(-t * 9) * 0.5

def riser(d, f0=200, f1=8000):
    n = int(d * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    zi = None
    for s in range(0, n, 1024):
        fc = f0 * (f1 / f0) ** (s / n)
        sos = butter(2, [fc * 0.7, min(fc * 1.5, SR * 0.45)], 'band', fs=SR, output='sos')
        zi = np.zeros((sos.shape[0], 2)) if zi is None else zi
        out[s:s + 1024], zi = sosfilt(sos, x[s:s + 1024], zi=zi)
    return out * (np.arange(n) / n) ** 2.2

def rev_swell(d):
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 4000) * (t / d) ** 3 * 0.5

# ------------------------------------------------------------------ arrangement
orch = {}
strings, brass, horns, choir, timp, low_brass = [], [], [], [], [], []

# HOOK (bars 0-3): impact + braam on frame 0, strings tremolo pad, choir from bar 2, timpani pulses
for bar in range(4):
    c = CHORDS[0] if bar < 2 else CHORDS[bar % 4]
    strings += [(T(bar), n, BAR, 70 + bar * 8) for n in c[1:]]
    if bar >= 2:
        choir += [(T(bar), n + 12, BAR, 75) for n in c[2:]]
    timp += [(T(bar, b), 38, 0.3, 90 if b == 0 else 60) for b in (0, 2.5, 3)]
low_brass += [(T(0), 38, 3.0, 120), (T(0), 26 + 12, 3.0, 120)]
low_brass += [(T(2), 34, 2.0, 105), (T(2), 46, 2.0, 100)]

# BUILD (bars 4-7): string ostinato in 8ths -> 16ths, brass swells, timpani roll, last beat silent
for bar in range(4, 8):
    c = CHORDS[bar % 4]
    div = 2 if bar < 6 else 4
    for i in range(4 * div):
        if bar == 7 and i >= 3 * div:
            break
        n = [c[1], c[2], c[1] + 12, c[2]][i % 4]
        strings.append((T(bar, i / div), n, BEAT / div * 0.8, 70 + (bar - 4) * 12))
    horns += [(T(bar), n, BAR - (BEAT if bar == 7 else 0), 60 + (bar - 4) * 15) for n in c[1:4]]
    choir += [(T(bar), n + 12, BAR - (BEAT if bar == 7 else 0), 70 + (bar - 4) * 10) for n in c[2:]]
    if bar == 7:
        timp += [(T(7, i / 8), 38, 0.1, 50 + i * 3) for i in range(24)]

# DROP (bars 8-15): brass hook + full orchestra
for bar in range(8, 16):
    c = CHORDS[bar % 4]
    strings += [(T(bar), n, BAR, 105) for n in c] + [(T(bar), c[-1] + 12, BAR, 95)]
    choir += [(T(bar), n + 12, BAR, 95) for n in c[1:]]
    horns += [(T(bar), n, BAR, 100) for n in c[1:4]]
    low_brass += [(T(bar), c[0], BAR * 0.9, 115), (T(bar), c[0] + 12, BAR * 0.9, 110)]
    shift = c[0] - 38
    for b, n, d in MOTIF:
        brass.append((T(bar, b), n + shift, d * BEAT * 0.95, 118))
    timp += [(T(bar, b), c[0] % 12 + 36, 0.3, 110 if b == 0 else 80) for b in (0, 1.5, 2, 3.5)]
# END (bars 16-17): one held chord
for n in CHORDS[0]:
    strings.append((T(16), n, 2 * BAR + 1.5, 110))
    horns.append((T(16), n, 2 * BAR, 110))
choir += [(T(16), n + 12, 2 * BAR + 1.5, 100) for n in CHORDS[0][1:]]
low_brass += [(T(16), 38, 3.5, 127), (T(16), 26 + 12, 3.5, 127)]
timp += [(T(16), 38, 0.5, 127)]

print('rendering orchestra stems…', flush=True)
orch['strings'] = render_midi(strings, 48, 1.0)          # String Ensemble 1
orch['brass'] = render_midi(brass, 61, 1.1)              # Brass Section
orch['horns'] = render_midi(horns, 60, 0.8)              # French Horns
orch['low_brass'] = render_midi(low_brass, 57, 0.9)      # Trombone
orch['choir'] = render_midi(choir, 52, 0.7)              # Choir Aahs
orch['timp'] = render_midi(timp, 47, 1.0)                # Timpani

# synthesized hybrid layer
hyb = np.zeros((2, N))
drums = np.zeros((2, N))
fx = np.zeros((2, N))

def impact(t0, big=1.0):
    place(fx, t0, braam(), 0.9 * big)
    place(drums, t0, crash(), 0.9 * big)
    place(drums, t0, taiko(), 1.0 * big)
    place(drums, t0, kick(1.2), 0.9 * big)
    events['impact'].append(round(t0, 4))
    events['braam'].append(round(t0, 4))

impact(0.0, 1.0)
impact(T(2), 0.7)
for bar in range(4):  # heartbeat taikos in the hook
    for b in (1.5, 3):
        place(drums, T(bar, b), taiko(), 0.45)
        events['taiko'].append(round(T(bar, b), 4))
for bar in range(4, 8):  # build: pulse ostinato + taiko 8ths, opening filter
    c = CHORDS[bar % 4]
    for i in range(8):
        if bar == 7 and i >= 6:
            continue
        place(hyb, T(bar, i / 2), pulse(c[0], BEAT / 2, 500 + (bar - 4) * 900 + i * 60), 0.7)
        if bar >= 6:
            place(drums, T(bar, i / 2), hat(), 0.35)
        if i % 2 == 0 or bar >= 6:
            place(drums, T(bar, i / 2), taiko(), 0.35 + (bar - 4) * 0.08)
            events['taiko'].append(round(T(bar, i / 2), 4))
place(fx, T(4), riser(BAR * 4 - BEAT), 0.5)
place(fx, T(7, 1), rev_swell(BEAT * 3), 1.0)

# drop: kick/snare groove, sub, braams every 2 bars, pulse 16ths
impact(T(8), 1.25)
for bar in range(8, 16):
    c = CHORDS[bar % 4]
    for b in (0, 1.5, 2, 2.75) if bar % 2 else (0, 1, 2, 2.5):
        place(drums, T(bar, b), kick(), 0.85)
        events['kick'].append(round(T(bar, b), 4))
    for i in range(16):
        place(drums, T(bar, i / 4), hat(i % 4 == 2), 0.5 if i % 2 else 0.32, pan=0.25 if i % 2 else -0.2)
    if bar % 4 == 0 and bar > 8:
        place(drums, T(bar), crash(), 0.7)
    for b in (1, 3):
        place(drums, T(bar, b), snare(), 0.75)
        events['snare'].append(round(T(bar, b), 4))
    place(hyb, T(bar), sub(ROOTS[bar % 4] + 12, BAR), 0.9)
    for i in range(16):
        place(hyb, T(bar, i / 4), pulse(c[0] + 12 + (12 if i % 4 == 2 else 0), BEAT / 4, 3200), 0.45, pan=0.3 * np.sin(i))
    if bar % 2 == 0 and bar > 8:
        place(fx, T(bar), braam((c[0] - 12, c[0], c[0] + 7)), 0.55)
        events['braam'].append(round(T(bar), 4))
        events['hit'].append(round(T(bar), 4))
impact(T(16), 1.3)

# ------------------------------------------------------------------ mix
kt = np.array(sorted(events['kick'] + events['impact']))
t = np.arange(N) / SR
idx = np.clip(np.searchsorted(kt, t, side='right') - 1, 0, None)
since = np.where(np.searchsorted(kt, t, side='right') > 0, t - kt[idx], 9)
duck = 1 - 0.55 * np.exp(-since * 9)

o = orch
music = (o['strings'] * 0.9 + o['brass'] * 1.0 + o['horns'] * 0.7 + o['low_brass'] * 0.8 + o['choir'] * 0.55 + o['timp'] * 0.9)
music = hp(music, 40)
music = (music + hp(music, 3500) * 0.9) * duck   # ~+5 dB shelf above 3.5 kHz: the GM orchestra is dark
hyb = hyb * duck

# room reverb (stereo exponential noise IR), on orchestra + snare
ir_t = tt(2.8)
ir = np.vstack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))]) * np.exp(-ir_t * 2.2)
ir = lp(hp(ir, 200), 7000)
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
send = music * 0.6 + drums * 0.15 + fx * 0.25
wet = np.vstack([fftconvolve(send[i], ir[i])[:N] for i in range(2)])

# silence: last beat of bar 7 (held breath before the drop)
g = np.ones(N)
a, b = int(T(7, 3) * SR), int(T(8) * SR)
g[a:b] = 0.0
r = int(0.015 * SR)
g[a - r:a] = np.linspace(1, 0, r)
wet_g = g.copy()
wet_g[a:b] = 0.15
mix = (music * 2.8 + hyb * 0.35 + drums * 0.62 + fx * 0.7) * g + wet * 0.9 * wet_g
mix = hp(mix, 28)
mix /= np.abs(mix).max()
knee = 0.75
over = np.abs(mix) > knee
mix[over] = np.sign(mix[over]) * (knee + (1 - knee) * np.tanh((np.abs(mix[over]) - knee) / (1 - knee)))
fade = int(1.2 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)

if os.environ.get('STEMS'):
    for name, bus in [("orchestra", music * 2.8), ("hybrid", hyb * 0.35), ("drums", drums * 0.62), ("fx", fx * 0.7), ("wet", wet * 0.9)]:
        row = []
        for a0, b0 in [(0, 4), (4, 8), (8, 16), (16, 18)]:
            seg = bus[:, int(T(a0) * SR):int(T(b0) * SR)]
            row.append(f"{10 * np.log10((seg ** 2).mean() + 1e-12):6.1f}")
        print(name.ljust(9), ' '.join(row))

out = sys.argv[1] if len(sys.argv) > 1 else 'out/music2.wav'
tmp = out + '.tmp.wav'
with wave.open(tmp, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1).T * 32767).astype('<i2').tobytes())
# EBU R128: -14 LUFS (YouTube reference), true peak -1 dBTP, two-pass linear
meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', tmp, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])
subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', tmp, '-af',
                f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
                '-ar', str(SR), out], check=True)
os.remove(tmp)
for k in events:
    events[k] = sorted(set(events[k]))
events.update(bpm=BPM, beat=BEAT, bar=BAR, bars=BARS, duration=DUR)
json.dump(events, open(out.replace('.wav', '.events.json'), 'w'))
print('ok', round(DUR, 2), {k: len(v) for k, v in events.items() if isinstance(v, list)})
