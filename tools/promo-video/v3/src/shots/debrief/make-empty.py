# Builds debrief-empty.png: the real debrief texture with the three steps, the footer and the button erased
# (the header "Exemple rédigé… / Préparer la prochaine séance / Scrim 3 · Aurore" is kept). The card background is
# a smooth glass gradient, so every erased rectangle is refilled column by column with a linear blend between the
# clean rows just above and below it. The shot reveals the original texture over this base, box by box.
# Run: python3 src/shots/debrief/make-empty.py  (from tools/promo-video/v3)
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
layout = json.load(open(os.path.join(ROOT, 'src', 'layout.json')))['debrief']
src = np.asarray(Image.open(os.path.join(ROOT, 'public', layout['file']))).astype(np.float64)
S = src.shape[1] / layout['w']  # texture px per CSS px (2)
PAD = 4  # CSS px around each text box (accents, descenders)

rects = []  # CSS rects x0, y0, x1, y1
for ln in layout['boxes']['lines'][3:12]:
    rects.append((ln['x'] - PAD, ln['y'] - PAD, ln['x'] + ln['w'] + PAD, ln['y'] + ln['h'] + PAD))
for st in layout['boxes']['steps']:  # 1px divider = top border of each step box
    rects.append((st['x'] - 3, st['y'] - 3, st['x'] + st['w'] + 3, st['y'] + 3))
rects.append((33 - 4, 642 - 4, 231 + 4, 687 + 4))  # "Revoir la partie source" button (measured box)

def smooth(row, k=17):
    kern = np.ones(k) / k
    return np.stack([np.convolve(row[:, c], kern, mode='valid') for c in range(row.shape[1])], axis=1)

out = src.copy()
for x0, y0, x1, y1 in rects:
    X0, Y0, X1, Y1 = int(np.floor(x0 * S)), int(np.floor(y0 * S)), int(np.ceil(x1 * S)), int(np.ceil(y1 * S))
    top = smooth(src[Y0 - 3:Y0, X0 - 8:X1 + 8].mean(axis=0))  # clean rows above / below (3-row average,
    bot = smooth(src[Y1:Y1 + 3, X0 - 8:X1 + 8].mean(axis=0))  # 17px horizontal box: no vertical streaks)
    t = ((np.arange(Y0, Y1) - (Y0 - 1)) / (Y1 - Y0 + 1))[:, None, None]
    out[Y0:Y1, X0:X1] = top[None] * (1 - t) + bot[None] * t

Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8)).save(os.path.join(HERE, 'debrief-empty.png'), optimize=True)
print('rects', len(rects))
