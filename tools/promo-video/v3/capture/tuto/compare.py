"""Pixel comparison of two captures of the same size: share of differing pixels and their bounding box.
Usage: python3 -I compare.py a.png b.png [threshold=24]"""
import sys

from PIL import Image, ImageChops

a = Image.open(sys.argv[1]).convert("RGB")
b = Image.open(sys.argv[2]).convert("RGB")
threshold = int(sys.argv[3]) if len(sys.argv) > 3 else 24
if a.size != b.size:
    sys.exit(f"tailles différentes : {a.size} / {b.size}")
diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > threshold else 0)
changed = diff.histogram()[255]
total = a.size[0] * a.size[1]
print(f"{changed} px différents sur {total} ({100 * changed / total:.3f} %), zone : {diff.getbbox()}")
