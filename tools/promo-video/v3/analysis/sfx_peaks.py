# Peak lag (frames @30fps) of each SFX in public/sfx: frame of the max of the 10 ms RMS envelope, plus attack onset
# (first frame above -20 dB of peak). Used by src/sfx.ts (sound-design §4.6, offset two).
import json, subprocess, sys, glob, os
import numpy as np
out = {}
for p in sorted(glob.glob('public/sfx/*.mp3')):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    hop = 480
    n = len(x) // hop
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    pk = int(rms.argmax())
    on = int(np.argmax(rms > rms[pk] * 0.1))
    out[os.path.basename(p)] = {'dur_s': round(len(x) / 48000, 3), 'peak_f': round(pk * hop / 48000 * 30, 2), 'onset_f': round(on * hop / 48000 * 30, 2), 'peak_db': round(float(20 * np.log10(np.abs(x).max() + 1e-9)), 1)}
json.dump(out, open('analysis/sfx_peaks.json', 'w'), indent=1)
for k, v in out.items(): print(f'{k:32s} {v}')
