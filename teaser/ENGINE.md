# NXT5 teaser engine — guide for scene builders

Workspace: this folder. Film = 1920×1080, 30 fps, 33.6 s, 100 BPM (beat 0.6 s, bar 2.4 s). Key moments live in `NX.T` (`scenes/style.js`).
Everything is a **pure function of absolute time `t`**: `NX.render(t)` can be called for any t in any order
(frames are rendered out of order by parallel workers, plus motion-blur sub-frames per frame).
**Never keep state between render calls** (no accumulators, no "previous value", no Math.random, no Date, no CSS transitions/animations — CSS `animation`/`transition` are forbidden because capture seeks time).

## Files
- `engine.js` — core (read it, it is short): easing, noise, scene registry, shared bg/post params, fx canvas helpers.
- `shader.js` — shared WebGL2 background, driven by `NX.bg`.
- `engine.css` — tokens (`--cyan`, `--spectrum-text`, `--primary`…) and shared classes (`.nx-title`, `.nx-kicker`, `.nx-spec`, `.nx-screen`, `.nx-cta`, `.nx-panel`…).
- `scenes/<id>.js` — ONE FILE PER SCENE. You only write your own scene file (and optional CSS injected with `NX.css`, prefixed with your scene id).
- `scenes/index.js` — the ordered list `window.NX_SCENES = [...]` (owned by the lead; do not edit).
- Images : the logos are read directly from the site, `../public/assets/nxt5-logo.png` (1254×989) and `../public/assets/nxt5-loader-favicon.png` (512×512 emblem). `assets/` only holds the Inter woff2 files from `@fontsource/inter`. Role icons are inlined (paths below).

## Scene API
```js
NX.scene({
  id: 'my-scene', start: 4, end: 8,   // absolute seconds (on the 0.5 s grid)
  pre: 0, post: 0,                    // extra visible time before start / after end (for overlapping transitions)
  z: 0,                               // stacking order among scenes
  build(root, self) { /* create DOM once; store refs on `this` */ },
  layout(root, self) { /* optional: after fonts load, measure text (offsetWidth…) */ },
  render(S) { /* S = { t, lt, p, dur, root } — lt = t - start, p = clamp(lt/dur) */ },
});
```
- `root` is a full-screen absolutely positioned div (`transform-style: preserve-3d`). Set `root.style.perspective` for 3D.
- In `render`, set styles on elements from `t` only. Hide elements outside their window with `opacity:0` or `display:none`.

## Helpers (NX.*)
- Time: `NX.seg(t,a,b)` → 0..1 ; `NX.env(t,a,b,c,d,easeIn,easeOut)` in-hold-out envelope ; `NX.pulse(t, period, decay, offset)` beat-synced 1→0 decay ; `NX.lerp`, `NX.map`, `NX.clamp`, `NX.smooth`.
- Easing `NX.ease.*`: in/out/inOut × Quad/Cubic/Quart/Quint/Expo/Circ/Back, `outElastic`, `spring(p,freq,damp)`, `snappy`, `whip` (for whip-pans), `soft`; `NX.bezier(x1,y1,x2,y2)` = CSS cubic-bezier.
- Random/noise (deterministic): `NX.rng(seed)` → function ; `NX.hash(n)` ; `NX.noise(x,y,z)` simplex [-1,1] ; `NX.fbm`.
- Colour: `NX.C.{bg,surface,raised,text,text2,muted,cyan,peri,violet,pink,win,loss}` ; `NX.spectrum(x, alpha)` brand spectrum at x∈[0,1].
- DOM: `NX.el(html, parent)` ; `NX.css(text)` ; `NX.set(el, styles)` ; `NX.split(el, 'chars'|'words')` → `{chars, words}` spans (`.nx-char`/`.nx-word`, inline-block) — `.nx-spec` gradient text keeps a continuous gradient across split chars automatically.
- FX canvas (2D, cleared every frame, on top of the DOM world): `NX.fx.ctx` ; `NX.fx.streak(x,y,len,angle,color,alpha,width)` ; `NX.fx.glow(x,y,r,color,alpha)`. Use `ctx.globalCompositeOperation='lighter'` for additive light. Particles must be computed from `t` (seeded positions + analytic motion).

## Shared background & post FX (reset to defaults every frame, then scenes write)
`NX.bgMix(params, w)` and `NX.postMix(params, w)` move values toward targets with weight w (use your fade-in/out envelope as w so neighbouring scenes cross-fade smoothly). `NX.bgAdd` / `NX.postAdd` add.
- `NX.bg`: `intensity`(1) `nebula`(.55) `warp`(.6) `hue`(0: cyan…1: fuchsia) `rays`(0) `rayX`,`rayY` (centred screen units, y up, ±0.5 = top/bottom, x ±0.89) `rayStrength`(1) `grid`(0) `gridSpeed`(.6) `gridHorizon`(-.08) `tunnel`(0) `tunnelSpeed`(1) `stars`(.25) `zoom`(1) `cx`,`cy` `flash`(0) `speed`(1) `pulse`(0).
- `NX.post`: `grain`(.16) `vignette`(.85) `chroma`(px RGB split, 0) `glitch`(0..1 horizontal displacement) `flash`(0..1) `flashColor`('#A5F3FC') `exposure`(1) `saturate`(1) `blur`(px) `letterbox`(0..1 → 132 px bars) `fade`(0..1 to night blue) `shake`(px) `shakeFreq`(18) `leak`(0..1 light leak) `leakX`,`leakY`(0..1) `leakHue`(0..1).
- Chroma/glitch/blur/exposure are applied as a filter on the whole world + fx canvas (not the WebGL bg) — keep them for accents (hits), not constant.

## Brand rules (mandatory)
Night blue `#020611`, surfaces `#091322`/`#0E1B2E`, text `#F3F7FF`/`#BFCCDF`/`#97ABC4`; accents cyan `#67E8F9`, periwinkle `#818CF8`, violet `#A78BFA`, fuchsia `#E879F9`; primary gradient `#22D3EE→#3B82F6→#D946EF` with dark text `#020611`, button radius 2 px; panels radius 16 px. Inter only (400/600/700/800/900). Titles 800, letter-spacing ≈ -0.03em. **Logos are raster: never redraw, recolor, stretch or rebuild them with text** (masking, reveals, light sweeps, glow, scale, blur-in are fine). No invented stats or claims. All on-screen copy in French with correct typography (’ apostrophes, non-breaking space before « : ; ! ? » where relevant).

Role icon paths (viewBox 0 0 34 34), can be recoloured:
- TOP: `<path opacity=".45" fill-rule="evenodd" d="M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z"/><polygon points="4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4"/>`
- JGL: `<path fill-rule="evenodd" d="M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z"/>`
- MID: `<path opacity=".45" fill-rule="evenodd" d="M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z"/><polygon points="25 4 4 25 4 30 9 30 30 9 30 4 25 4"/>`
- ADC: `<path opacity=".45" fill-rule="evenodd" d="M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z"/><polygon points="29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955"/>`
- SUP: `<path fill-rule="evenodd" d="M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z"/>`

## Testing your scene (do this repeatedly)
From this folder, after `npm install` (Chromium path: `CHROME_PATH`, or auto-detected):
- Contact sheet of your scene only: `node tools/capture.mjs sheet --only <id> --from <start-pre> --to <end+post> --n 16 --cols 4 --out out/<id>/sheet.png` then Read the PNG and critique it like a senior motion designer.
- Full-res stills: `node tools/capture.mjs stills --only <id> --times 4.5,5.25 --out out/<id>/stills`.
- Motion check (real motion blur): `node tools/capture.mjs frames --only <id> --from A --to B --fps 30 --sub 4 --workers 4 --out out/<id>/frames ` (look at a few frames if needed).
- `--only` accepts a comma list to preview your transition with a neighbour scene if it exists.
- Page JS errors are printed as `[page …]` lines — there must be none.
Only write inside `scenes/` and `out/<your id>/`. Do not modify engine files; if you need an engine feature, implement it locally in your scene and mention it in your report.
