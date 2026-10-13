import json, math, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter
W, H, FPS = 1920, 1080, 60
OUT = sys.argv[1] if len(sys.argv) > 1 else "tuto_v2.mp4"
M = json.load(open("cap/meta.json"))
T = json.load(open("texts.json"))
img = lambda n: Image.open(f"cap/{n}.webp").convert("RGB")
ov = lambda n: Image.open(f"ov/{n}.png").convert("RGBA")
SC = {n: img(n) for n in ["home", "demo", "detail", "analyses", "debrief", "features"]}
TYPE = [img(f"demo_type{i}") for i in [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]]
SC["intro"] = Image.open("ov/intro.png").convert("RGB"); SC["outro"] = Image.open("ov/outro.png").convert("RGB")
CAP = {k: ov(k) for k in T["captions"]}; STEP = {k: ov(k) for k in T["steps"]}
import re
import os
VO = json.load(open("voice/durations.json")) if os.path.exists("voice/durations.json") and os.environ.get("SILENT") != "1" else {}
VOLEAD = 0.15
def read(k):
    if k in VO: return max(2.0, VOLEAD + VO[k] + 0.4)
    n = len(re.sub("<[^>]+>", "", T["captions"][k]))
    return max(2.4, min(5.0, 1.1 + n / 16))

# arrow cursor, supersampled
def make_cursor(scale):
    s = 4; pts = [(0, 0), (0, 34), (9, 26), (15, 40), (21, 37), (15, 24), (27, 24)]
    k = 1.25 * scale * s; pad = 12 * s
    im = Image.new("RGBA", (int(40 * k / s * s + pad * 2), int(48 * k / s * s + pad * 2)))
    P = [(pad + x * k, pad + y * k) for x, y in pts]
    sh = Image.new("RGBA", im.size); ImageDraw.Draw(sh).polygon([(x + 3 * s, y + 4 * s) for x, y in P], fill=(0, 0, 0, 120))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(4 * s)))
    d = ImageDraw.Draw(im); d.polygon(P, fill=(255, 255, 255, 255)); d.line(P + [P[0]], fill=(15, 23, 42, 255), width=int(2.2 * s), joint="curve")
    return im.resize((im.width // s, im.height // s), Image.LANCZOS), pad // s
CUR, CPAD = make_cursor(1.0); CURP, CPADP = make_cursor(0.86)

def ease(p, kind="io"):
    if kind == "lin": return p
    if kind == "out": return 1 - (1 - p) ** 3
    return 4 * p ** 3 if p < .5 else 1 - (-2 * p + 2) ** 3 / 2

class Movie:
    def __init__(s):
        s.t = 0.0; s.f = 0; s.tw = []
        s.S = dict(y=0.0, z=1.0, xf=0.0, cx=960.0, cy=640.0, ca=0.0, press=0.0, cap_a=0.0, step_a=0.0, blk=1.0)
        s.scene = None; s.cap = None; s.step = None; s.prev = None; s.ripples = []; s.last = None
        s.ff = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    def anim(s, key, to, dur, kind="io", delay=0.0):
        s.tw.append([key, None, to, s.t + delay, max(dur, 1e-6), kind])
        return dur + delay
    def _apply(s):
        keep = []
        for tw in s.tw:
            key, fr, to, st, du, kind = tw
            if s.t < st: keep.append(tw); continue
            if fr is None: tw[1] = fr = s.S[key]
            p = min(1.0, (s.t - st) / du)
            s.S[key] = fr + (to - fr) * ease(p, kind)
            if p < 1: keep.append(tw)
        s.tw = keep
    def _base(s):
        S = s.S; im = s.scene; z = S["z"]
        y = max(0.0, min(S["y"], im.height - H))
        if abs(z - 1) < 1e-4:
            yi = int(round(y)); fr = im.crop((0, yi, W, yi + H))
        else:
            w, h = W / z, H / z; cx, cy = W / 2, y + H / 2
            fr = im.resize((W, H), Image.BICUBIC, box=(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
        if s.prev is not None and S["xf"] > 0.001: fr = Image.blend(fr, s.prev, S["xf"])
        return fr
    def _paste(s, fr, o, pos, a):
        if a <= 0.004: return
        m = o.getchannel("A")
        if a < 0.999: m = m.point(lambda v: int(v * a))
        fr.paste(o, pos, m)
    def frame(s):
        s._apply(); S = s.S
        fr = s._base().copy(); s.lastbase = fr.copy()
        if s.step: o = STEP[s.step]; s._paste(fr, o, ((W - o.width) // 2, 6), S["step_a"])
        for (x, y, t0) in s.ripples:
            p = (s.t - t0) / 0.55
            if 0 <= p <= 1:
                r = 12 + 44 * ease(p, "out"); a = int(230 * (1 - p)); k = 2; sz = 130
                rg = Image.new("RGBA", (sz * k, sz * k)); d = ImageDraw.Draw(rg)
                c = sz * k / 2; d.ellipse((c - r * k, c - r * k, c + r * k, c + r * k), outline=(103, 232, 249, a), width=4 * k, fill=(103, 232, 249, a // 5))
                rg = rg.resize((sz, sz), Image.LANCZOS); fr.paste(rg, (int(x - sz / 2), int(y - sz / 2)), rg)
        if S["ca"] > 0.004:
            o, pad = (CURP, CPADP) if S["press"] > .5 else (CUR, CPAD)
            s._paste(fr, o, (int(S["cx"] - pad), int(S["cy"] - pad)), S["ca"])
        if s.cap: o = CAP[s.cap]; s._paste(fr, o, ((W - o.width) // 2, H - o.height - 6 + int(14 * (1 - S["cap_a"]))), S["cap_a"])
        if S["blk"] > 0.004: fr = Image.blend(fr, Image.new("RGB", (W, H)), S["blk"])
        s.ff.stdin.write(fr.tobytes()); s.f += 1; s.t = s.f / FPS
    def wait(s, d):
        end = s.t + d
        while s.t < end - 1e-9: s.frame()
    # helpers
    def cut(s, scene, y=0.0, xf=0.6, z=1.0):
        s.prev = s.lastbase if s.scene else None
        s.scene = SC[scene] if isinstance(scene, str) else scene
        s.S["y"] = y; s.S["z"] = z; s.S["xf"] = 1.0 if s.prev else 0.0
        if s.prev: s.anim("xf", 0.0, xf)
    def swap(s, im):  # instant swap of page state (typing)
        s.scene = im
    def show(s, k):
        LOG.append(["cap", k, s.t]); s.capstart = s.t
        if k in VO: LOG.append(["vo", k, s.t + VOLEAD])
        s.cap = k; s.S["cap_a"] = 0.0; s.anim("cap_a", 1.0, 0.35, "out")
    def hide(s, gap=0.3):
        rem = s.capstart + read(s.cap) - s.t
        if rem > 0: s.wait(rem)
        LOG.append(["end", s.cap, s.t + 0.28])
        s.anim("cap_a", 0.0, 0.28); s.wait(gap)
    def say(s, k, extra=0.0):
        s.show(k); s.wait(read(k) + extra); s.hide()
    def step_to(s, k):
        if s.step and s.S["step_a"] > 0.5:
            s.anim("step_a", 0.0, 0.2); s.wait(0.2)
        LOG.append(["step", k, s.t]); s.step = k; s.anim("step_a", 1.0, 0.35, "out")
    def scroll(s, y, dur=None, block=True):
        dur = dur or 0.7 + abs(y - s.S["y"]) / 900
        s.anim("y", y, dur)
        if block: s.wait(dur)
        return dur
    def move(s, x, y, block=True, extra=0.0):
        d = math.hypot(x - s.S["cx"], y - s.S["cy"]); dur = 0.45 + d / 2200
        s.anim("cx", x, dur); s.anim("cy", y, dur)
        if block: s.wait(dur + extra)
        return dur
    def click(s):
        s.anim("press", 1.0, 0.06, "lin"); s.wait(0.08)
        s.ripples.append((s.S["cx"], s.S["cy"], s.t)); s.anim("press", 0.0, 0.06, "lin"); s.wait(0.22)
    def close(s):
        s.ff.stdin.close(); s.ff.wait()

def ctr(r, y): return (r[0] + r[2] / 2, r[1] + r[3] / 2 - y)
LOG = []
m = Movie(); D = M["demo"]
# ---- intro
m.cut("intro"); m.anim("blk", 0.0, 0.7, "out")
if "n0" in VO: LOG.append(["vo", "n0", 0.6]); m.wait(max(2.8, 0.6 + VO["n0"] + 0.5))
else: m.wait(2.8)
# ---- accueil
m.cut("home", 0, xf=0.7); m.anim("z", 1.07, 11.0, "lin"); m.wait(0.5)
m.say("c1"); m.say("c2")
m.tw = [t for t in m.tw if t[0] != "z"]
m.anim("z", 1.0, 1.6); m.scroll(1010, 1.6, block=False); m.wait(0.9)
m.show("c3"); m.wait(read("c3") + 0.4); m.hide()
# ---- démo : liste
m.cut("demo", 0, xf=0.7); m.step_to("s1"); m.wait(0.3)
m.say("c4")
YL = 590; m.scroll(YL, 1.3, block=False); m.S["cx"], m.S["cy"] = 1250, 820; m.anim("ca", 1.0, 0.4, delay=0.6); m.wait(1.3)
sx, sy = D["search"][0] + 330, D["search"][1] + D["search"][3] / 2 - YL
m.move(sx, sy); m.click()
m.show("c5")
for i, im in enumerate(TYPE):
    m.swap(im); m.wait(0.1 + (0.05 if i in (3, 4) else 0.0) + 0.02 * (i % 3))
m.wait(max(0.8, read("c5") - 1.4)); m.hide()
m.move(D["search"][0] + D["search"][2] - 34, sy); m.click(); m.cut("demo", YL, xf=0.25)
m.show("c6"); m.wait(0.5)
rx, ry = D["row1"][0] + 420, D["row1"][1] + D["row1"][3] / 2 - YL
m.move(rx, ry, extra=0.5); m.click(); m.hide(0.1)
# ---- bilan
m.cut("detail", YL, xf=0.5); m.step_to("s2"); m.move(1560, 900, block=False); m.wait(0.4)
m.say("c7")
m.scroll(820, 1.4, block=False); m.wait(0.5); m.show("c8"); m.wait(read("c8")); m.hide()
YT = 590; m.scroll(YT, 1.1, block=False)
t2 = ctr(M["detail"]["t2"], YT); m.move(*t2, extra=0.15); m.click()
# ---- analyses
m.cut("analyses", YT, xf=0.45); m.step_to("s3"); m.move(1500, 780, block=False); m.wait(0.3)
m.say("c9")
m.scroll(700, 1.0, block=False); m.wait(0.4); m.show("c10"); m.wait(read("c10") + 0.3); m.hide()
m.scroll(YT, 1.0, block=False)
t3 = ctr(M["analyses"]["t3"], YT); m.move(*t3, extra=0.15); m.click()
# ---- débrief
m.cut("debrief", YT, xf=0.45); m.step_to("s4"); m.move(1560, 860, block=False); m.wait(0.3)
m.show("c11"); m.scroll(700, 2.4, block=False); m.wait(read("c11")); m.hide()
m.say("c12"); m.scroll(470, 4.0, "io", ) if False else None
m.anim("y", 800, 4.5); m.say("c13")
# ---- espace
m.anim("ca", 0.0, 0.3); m.cut("features", 0, xf=0.7); m.step_to("s5"); m.wait(0.3)
cr = ctr(M["features"]["create"], 0)
m.show("c14"); m.S["cx"], m.S["cy"] = 1100, 900; m.anim("ca", 1.0, 0.3); m.wait(0.4)
m.move(*cr, extra=read("c14") - 1.6); m.click(); m.hide()
m.anim("ca", 0.0, 0.3); m.anim("y", 260, 7.0, "io")
m.say("c15"); m.say("c16", 0.2)
# ---- fin
m.anim("step_a", 0.0, 0.3); m.cut("outro", 0, xf=0.8)
if "n99" in VO: LOG.append(["vo", "n99", m.t + 0.6]); m.wait(max(4.2, 0.6 + VO["n99"] + 1.2))
else: m.wait(4.2)
m.anim("blk", 1.0, 0.9); m.wait(1.0)
json.dump(LOG, open("log.json", "w")); m.close(); print("frames", m.f, "dur", round(m.t, 2))
