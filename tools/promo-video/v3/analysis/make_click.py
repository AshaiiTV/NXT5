# Synthesises a soft, realistic mouse click for the tutorial (press + release of a micro-switch), in two variants
# to alternate (no machine-gun effect). Short band-limited noise bursts (~1.5 ms decay) with a faint body
# resonance (1.6–5.2 kHz, centroid ≈3.5 kHz, softer than the old light-switch sample at 6.6 kHz); the release comes 70–80 ms later, quieter and a little brighter. No tonal ring, no tail.
# usage: python3 analysis/make_click.py  -> public/sfx/mouse-click-a.wav, mouse-click-b.wav
import wave
import numpy as np
from scipy.signal import butter, sosfilt
SR = 48000
def burst(rng, amp, lo, hi, tau, body_f, body_amp):
    n = int(0.025 * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n) * np.exp(-t / tau)
    x = sosfilt(butter(2, [lo, hi], btype='band', fs=SR, output='sos'), x)
    x += body_amp * np.sin(2 * np.pi * body_f * t) * np.exp(-t / 0.0025)
    x[: int(0.0002 * SR)] *= np.linspace(0, 1, int(0.0002 * SR))
    return amp * x / (np.abs(x).max() + 1e-9)
def click(seed, gap):
    rng = np.random.default_rng(seed)
    out = np.zeros(int(0.16 * SR))
    p = burst(rng, 1.0, 1600, 5200, 0.0016, 900, 0.4)
    r = burst(rng, 0.5, 2000, 6000, 0.0012, 1200, 0.3)
    a = int(0.004 * SR); b = a + int(gap * SR)
    out[a:a + len(p)] += p; out[b:b + len(r)] += r
    out *= 10 ** (-4 / 20) / np.abs(out).max()          # peak -4 dBFS
    return out
for name, seed, gap in (('a', 11, 0.074), ('b', 29, 0.081)):
    x = click(seed, gap)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(f'public/sfx/mouse-click-{name}.wav', 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    spec = np.abs(np.fft.rfft(x)); fr = np.fft.rfftfreq(len(x), 1 / SR)
    c = (spec * fr).sum() / spec.sum()
    print(f'mouse-click-{name}.wav: {len(x) / SR * 1000:.0f} ms, spectral centroid {c:.0f} Hz, release after {gap * 1000:.0f} ms')
