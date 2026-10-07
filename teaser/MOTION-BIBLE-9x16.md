# NXT5 teaser — 9:16 amendment (vertical version for TikTok, Reels and Shorts)

**Status (7 Oct 2026).** The owner asked for « une version verticale pour TikTok etc. ». The 16:9 film v7.2 (`MOTION-BIBLE.md`) is final and stays byte-identical: every 9:16 value lives behind `NX.V` (`?format=v`). This document is the vertical bible. It was produced by a design panel (three art directors with rendered mockups, two judges, one synthesis) and is followed by every scene package. Read `MOTION-BIBLE.md` first for the motion language, then this file.

## Lead decisions on the open questions (§7)

1. **Hook split « sur League / of Legends ? »** — kept: six phrase lines at 88 px read as a poster and meet the hold, burn-speed and clean-hit constraints together. The five-line alternative (« … / ton équipe sur / League of Legends ? » at ≤ 76 px) remains the fallback if the owner prefers the game's name unbroken.
2. **« Legends ? » rises as one unit** — accepted (question complete at 3.22, hold 1.058 s).
3. **Card 1 stats** — stacked tiles (phone read, no dead band).
4. **End settle crane** (y −34 → −80) — accepted.
5. **New logo scales** E5 500 and L9 720 (dock 335.86) — accepted; the §6.9 dock check, the baked footprint and the §6.8 determinism at 9.6 and 27.6 must be re-validated in 9:16.
6. **Hit band phase** (0.75 of NXT5 at 4.8, 0.71 at 27.6) — accepted.
7. **S2 plate edge** reaching x 963 in the rail band at the 6.6 push — accepted as decorative (strokes stay ≤ 930).
8. **Thin margins** (hook line 3 at 915, title 4 at 916, front rim at 926) — accepted; `camcheck --format v` enforces them.
9. **Charte** — the brand rules come from `AGENTS.md`, `engine.css` and this file.

## Shared infrastructure (lead, already in the code)

- `engine.js`: `NX.FORMAT`, `NX.V`, `NX.W × NX.H` = 1080 × 1920, `NX.U` = 1080; `.nx-spec[data-spec-run]` spans share one gradient (and `NX.type.sheen` sweeps the run as one line).
- `shader.js`: uniforms `uFall`, `uNebY`, `uFoot` (16:9 defaults 1.15 / 0 / 0); `kit.js`: `NX.SKY.rayY` (0.99 in 9:16), dust field following the frame.
- `scenes/vertical.js`: vertical `NX.G` (hook, L2, E5, pent, dir, tools, L9, dock, end, ret) and `NX.FRONT` (hook, hookLead, hookEnv, unwrite, end, endLead, endEnv); `NX.SKY.fall / nebY / foot`.
- `scenes/camera.js`: vertical keys (§2.3). `scenes/ciel.js`: vertical sky uniforms, front bands and gust centres.
- Tools: `--format v` / `NX_FORMAT=v`; `camcheck --format v` reads `NX.CHECK` and `NX.CHECK_HOLDS` (declared by the scenes) and applies the platform rules of §1.2; `metrics.mjs` reads the format from the video.

## Ownership (V4)

| Package | Files | Shots |
|---|---|---|
| C | `scenes/accroche.js` | S1 hook (six lines, spectral run, burn by the hook front) |
| M | `scenes/logo.js`, `scenes/equipe.js`, `scenes/direction.js`, and the `NX.FRONT.unwrite` entry of `scenes/vertical.js` (read only by logo.js) | the continuous logo moment: S2 writing, hold and exit, S3′ roles and fusion, S5 direction and spear (as in v7.2, one package because the emblem is one object) |
| F | `scenes/outils.js` | S6–S8 tools, drop, hand-overs, anticipation rims, the S8 burn |
| G | `scenes/fin.js` | S9 return, dock, final lockup and end card |
| Lead | everything else (engine, kit, shader, style, `vertical.js` with every `NX.FRONT` track, camera, ciel, tools, audio) | requests from packages go in their reports |

Every 9:16 change is inside an `NX.V` branch; the 16:9 render stays byte-identical (`node out/v73/lead/regress-h.mjs --against out/v73/base-h`).

---

The vertical teaser (TikTok, Reels, Shorts) is the approved v7.2 film rebuilt natively for 1080 × 1920. It uses the same 32.4 s, the same `NX.T`, the same music, copy, motion grammar and brand. This spec merges the three panel proposals (continuity, legibility, native) under the two judges (A: art direction, B: platform and feasibility). For each shot it takes the winning layout, adds the named grafts and fixes every must-fix item.

- **Final mockups:** `out/v73/design/final/png/` (8 moments plus 3 transition frames, each with a `-guides` twin; `out/` is not versioned). The pages are in `out/v73/design/final/html/`.
- **Single source of numbers during design:** `out/v73/design/final/tools/geo9.mjs`. The checks that prove them are in `out/v73/design/final/tools/*.mjs`, with outputs in `out/v73/design/final/checks/`. In the engine, the shared values live in `scenes/vertical.js`.
- **Engine maths:** every check uses the engine's own formulas (kit `NX.track`, `NX.punch`, the bezier eases, `NX.cam.project`, `NX.sky.src`, elliptical fronts with K = 2.5), ported in `final/tools/kit9.mjs`.

**Reading order:** §1 global rules → §2 shared geometry (the values V3 puts behind `NX.V`) → §3 per shot → §4 safe-zone boxes → §5 mockups → §6 implementation checks → §7 open questions → Appendix A must-fix ledger.

---

## 1. Global rules

### 1.1 Frame, axis, switch
- World = screen = 1080 × 1920. The camera is the engine's (D = 2000, perspective origin (540, 960)), and pushes scale about (540, 960). `NX.U` = 1080, the short side, so sky and front units match 16:9.
- Every centred subject sits on **x = 540**: question, lockup, emblem, pentagon, « Une même direction. », end card. The card stack is centred too (left 90, width 840). Only the tools title column is left-aligned, and it shares its left edge with the card content (§3.6).
- Every 9:16 value lives behind `NX.V` (`?format=v`):
  - vertical `NX.G`, camera keys, `NX.FRONT` tracks and card CSS sizes;
  - three shader uniforms whose 16:9 defaults reproduce the current sky (§2.5).

  The 16:9 film must stay byte-identical (V1 regression guard).

### 1.2 Platform zones (checked on every frame of every window; §4)

| Zone | Box (screen px) | Rule |
|---|---|---|
| Top UI (status bar, tabs) | y 0–220 | Light only (rays, glow, the front's band). No text. No logo or emblem at opacity > 0.3. |
| Text-safe | x 100–940 × y 250–1450 | All text, at least 16 px inside, at every camera extreme. |
| Key visuals | x 60–980 × y 200–1500 | Logos, emblem, tiles, cards. |
| Right rail (like / comment / share) | x ≥ 940, y 700–1500 | In that band, text right edge ≤ 920, and logo strokes, tiles and card rims ≤ 930. Only decorative light, halos and the logo's dark plate may reach toward 980. |
| Deepest text | y ≤ 1380 | Long captions climb to ~1350. Publish with a short caption. |
| Caption band | y 1500–1920 | Nothing. It stays the darkest part of the frame (sky foot darkening, §2.5). |

### 1.3 Vertical rhythm
- **Hero band:** about y 300–950. Lockups, emblem, roles and cards live here, under the light.
- **Words band:** about y 950–1380. S5 title, tool titles and end-card text.
- **Eye line:** about 760–800 on screen.
  - Hook block centre: 762 at 2.6.
  - Emblem ring: 746 (5.6) → 709 (9.6) → 714 (10.8).
  - End-card centre: 797 at 31.5.
- Each shot replaces the previous one in the same band:
  - the card stack lands where the emblem and the S5 beam were;
  - the S9 lockup lands where the planning card burned;
  - the button and end line land where the S8 title burned.
- **Fixed gaps (world px):**
  - S5: emblem art → title line box 100.
  - Tools:
    - card bottom → kicker ≥ 60 on screen (61.6 measured);
    - kicker line box → title line box 30;
    - kicker ink → title cap ≥ 50.
  - End card: art → button 107, button → end line 67. These are the 16:9 ratios 92/58 × 720/620.

### 1.4 Type scale (Inter, the kit's type CSS)

| Role | Spec |
|---|---|
| Hook (six phrase lines) | 800, **88 px**, lh 1.06 (93.28), tracking −0.012 → −0.032em (outCubic 0.20–3.60), `.tz-line` masks |
| S5 title and all four tool titles | 800, **104 px**, lh 1.06, −0.032em. One size for all titles; the second line carries `.nx-spec` as in 16:9. |
| Kicker | 700, **34 px**, .28em, uppercase, cyan, 48 × 2 hairline + 18 px. Separator « · » keeps its spaces (`white-space:pre`). |
| Card UI minimum | **29 px** (slot times). Everything else 30–54 px; values 96 px. Table in §2.2. |
| End card | CTA « nxt5.org » 800, **64 px**, padding 24/76, radius 2 (428 × 125). End line 700, **56 px**, lh 1.2, two lines. |

### 1.5 What never changes from 16:9
- **Timing:** `NX.T` and all beats, hits 4.8 / 9.6 / 13.2 / 27.6, punches 24 / 24 / 16 / 24, music, the eight eases, and every micro-event time in the scenes. Exceptions are listed in §1.6.
- **Copy, word for word:**
  - Never « Cinq rôles », « sans compte », a price or « gratuit ».
  - Keep the non-breaking space before « ? ».
  - « League of Legends » is unbroken on the end card.
- **Logos:** real PNGs only (`nxt5-logo.png` 1254 × 989, `nxt5-loader-favicon.png` 512 × 512), uniform scale, never redrawn, filtered, recoloured or rotated.
- **Light grammar:**
  - Elliptical fronts from the ray source (K = 2.5).
  - Write mask at R − 70 and burn feather 60 + lead.
  - White-hot band on bright chrome, glyph glow on burning words, logo light leaves (forge, img, hot, lum, sweep).
- **Glass material and card identity:**
  - two Analyser stats;
  - the Drafter badge with the header and the 5/5 counter;
  - the Planning as LUN–VEN columns with Match lower in Jeu.
- **S2 lockup and S2 exit:**
  - L2 is 800 px, so the S2 exit recipe (relay 6.95–7.12, pixel-matched cross-dissolve 7.10–7.25, M72 `S0` 0.72887) keeps its §6.9 numbers.
  - The M72 growth window is 8.6–9.6, SINE.
- **Determinism rules (§6.8):**
  - `display:none` hygiene.
  - Constant leaves rather than animated masks on large leaves.
  - Frame-quantised counters.

### 1.6 What changes in 9:16 (all behind `NX.V`)
1. **Geometry:**
   - every `NX.G` box (§2.1);
   - E5 500 instead of 460, L9 720 instead of 620 (dock 335.86 instead of 289.2);
   - pentagon r 275, tile scale 0.70;
   - card 840 × 625 with 9:16 card CSS.
2. **Camera keys:**
   - opening orbit with x compensation;
   - tools orbit cut to ±0.86° with x compensation;
   - end settle crane (§2.3).
3. **Fronts:** `FRONT.hook`, the burn lead ramps `hookLead` and `endLead`, `UNWRITE9`, `FRONT.end` (§2.4).
4. **Sky:** `rayY` 0.99 (already in V1), ray falloff, nebula centre, foot darkening (§2.5).
5. **Hook rise unit:** « Legends ? » rises as one word, so the question is complete at 3.22 instead of 3.36. This buys the ≥ 1.0 s hold with a clean hit (§3.1).
6. **Spectral run across a line break:** « comprendre » / « ton équipe » share one gradient and one sheen (small kit extension, §3.1).
7. **S5 condensation group 0.10 s earlier:** COND 12.50–12.85, DIM 12.60–12.70, SPEAR_LUM 12.55–12.90, RISE 12.60–13.18. The longer 320 px rise keeps its speed down this way. FADE (12.95–13.18) and the drop are unchanged.
8. **S8 Match slot:** top 120 in a 396 px column (the 16:9 px offset), so the slot burns before the 27.6 hit frame.

---

## 2. Shared geometry (vertical `NX.G`), world px at z = 0

### 2.1 Boxes

| Key | Value | Derived / notes (16:9 value) |
|---|---|---|
| `hook` | top 492 (first line box), 88 px, lh 1.06, centred on 540 | Six lines. Ink boxes:<br>1. « Envie d’analyser » 202.8–877.2 × 502.6–588.6 (674.4 px)<br>2. « tes games » 328.6–751.5 × 603.9–683.9 (422.9)<br>3. « et de comprendre » 179.9–900.1 × 693.2–775.2 (720.2)<br>4. « ton équipe » 323.5–756.5 × 782.4–868.4 (433.0)<br>5. « sur League » 312.7–767.3 × 878.7–963.7 (454.6)<br>6. « of Legends ? » 279.8–800.2 × 970.0–1057.0 (520.4)<br>Baselines 570.6 / 663.9 / 757.2 / 850.4 / 943.7 / 1037.0. Block centre 779.8, screen 762 at 2.6 (16:9: top 400, three lines). |
| `L2` (S2 lockup) | **left 141.27, top 520, w 800** | h 630.94, k 0.63796.<br>Ring centre (540, 747.11), spear tip y 587.62.<br>Rows: emblem 587.6–800.1, wordmark 800.7–1004.2, tagline 1004.8–1031.6, ornament to 1085.2.<br>Bright box 202.5–896.6 × 587.0–1031.6.<br>Alpha box 170.0–936.2 × 551.9–1114.6.<br>Lockup favicon box (355.31, 550.94) size 373.18 (s 0.72887).<br>(16:9: 560, 225, 800) |
| `M72` (emblem path) | S0 0.72887, BOX0 (355.31, 550.94), C0 (540.08, 747.01) → C1 (540, 680), S1 0.97656, GROW 8.6–9.6 SINE | OPT (optical centre) (539.35, 725.50).<br>Rise 67 px while the team charges it; growth ×1.34.<br>Z0 −0.5 → Z1 2.6.<br>Swap and dissolve unchanged (16:9: rise 10 px, ×1.23). |
| `E5` (S5 emblem) | **left 292.44, top 417.30, size 500** (favicon scale 0.97656) | Ring centre C (540, 680), spear tip y 468.1.<br>Art (alpha) box 339.3–738.7 × 465.2–834.3.<br>Halo disc ≈ 980 px on C (16:9 900 × 500/460).<br>(16:9: 732.25, 200, 460) |
| `pent` (S3′) | **c = OPT (539.35, 725.50), r 275**, deg 126/198/270/342/54, **scale 0.70** | Tile 216 × 0.70 = 151.2 px (icon 92.4).<br>Centres:<br>- Top (377.7, 948.0)<br>- Jungle (277.8, 640.5)<br>- Mid (539.4, 450.5)<br>- ADC (800.9, 640.5)<br>- Support (701.0, 948.0)<br>Stage pool: ellipse rx 620 × ry 720 on c.<br>(16:9: c (960, 441.7), r 200, 0.62) |
| `dir` (S5 title) | **top 934** (line box), 104 px, lh 1.06, z 3 | Baselines 1026.9 / 1137.1.<br>Ink « Une même » 280.9–799.0 × 945.9–1028.9 (518.1 px), « direction. » 308.1–772.0 × 1056.1–1139.1 (463.9).<br>Art bottom → title box 100 px. |
| `tools.col` | **left 154, top 982** (kicker line box), z 40 | Kicker 34 px (box 41.1 → 1023.1, ink baseline ≈ 1015).<br>Title line box top 1053.1 (gap 30); baselines 1146.0 / 1256.2.<br>Title ink tops 1065–1069, bottoms ≤ 1277.2.<br>Widest line: « entraînements. » 742.8 px → x 896.8. |
| `tools.stack` | **left 90, top 300, w 840, h 625, z −60, rotY 4, rotX 3**, origin 0 0 | Slots [0,0,0] [0,−80,−150] [0,−160,−300] [0,−240,−450]; fog 0 / 0.42 / 0.84 / 1; padding 48/44 (inner 752).<br>World corners (90, 300, −59) (928, 300, −117.6) (930.2, 924.1, −85) (92.3, 924.1, −26.4).<br>(16:9: 975, 300, 830 × 540, rotY 10, rotX 2, slots −46 y) |
| `L9` (S9 lockup) | **left 181.15, top 225, w 720** | h 567.85, k 0.57416.<br>Ring (540, 429.40), spear tip 285.9.<br>Rows: wordmark 477.6–660.8, tagline 661.4–685.5, ornament to 733.7.<br>Bright box 236.3–861.0 × 285.3–685.5.<br>Alpha box 207.0–896.6 × 253.7–760.1.<br>(16:9: 650, 70, 620) |
| `dock` | **left 373.78, top 252.85, size 335.86** (favicon s 0.65598) | Favicon × 1.1425 at (335.5, 48.5) lockup px, as in 16:9 (16:9 size 289.2). |
| `end` | **buttonTop 841, line1Top 1033**; CTA 64 px (428 × 125), end line 56 px lh 1.2 | Button x 326–754.<br>Line 1 « Pour les équipes et coachs » 718.3 px (x 180.9–899.2, box 1033–1100.2).<br>Line 2 « League of Legends » 510.6 px (x 284.7–795.3, box 1100.2–1167.4), unbroken.<br>Gaps: art bottom 733.7 → button 107, button → line 67.<br>(16:9: 600 / 770, 56 / 48 px, one line) |
| `RETURN` (S9 emblem) | Ring travels from (540, −1150, −4000) to the dock ring (540, 429.40, 0), **SINE 27.0–27.6** | Opacity smooth(27.0, 27.2). Fastest emblem pixel 833 px/s. Gate and swap rules as in 16:9 (16:9: from (959.1, −850, −4000), GLIDE 26.8–27.6). |

### 2.2 Card layouts (local px of the 840 × 625 glass, padding 48/44, inner 752)

The cards are rebuilt from `outils.js` (same copy, same micro-events) at phone sizes.

| Card | Layout (top → bottom) |
|---|---|
| 1 « 01 · ANALYSER » | - Header « Scrim 3 · Aurore » 700 44 px (339 px) with the « Victoire » badge (700 30 px, padding 6/14, green) 16 px after it.<br>- Sub-line « Équipe Horizon · démo fictive » 34 px.<br>- Two **stacked** stat tiles, 752 × 180, gap 18, radius 12, z 26:<br>  - « Écart d’or » label 40 px, value 800 **96 px** green « +4 000 » (counter 13.95–15.0);<br>  - « Écart de vision » label 40 px, value « +20 » (counter 14.5–15.6, focus ring on the vision tile at 16.2–16.4).<br>- No dead band.<br>Option for the owner: the 16:9 side-by-side tiles (2 × 367 px). |
| 2 « 02 · DÉBRIEFER » | - « QUESTION DU DÉBRIEF » 700 30 px .2em cyan.<br>- Question 700 **54 px** on two lines: « La vision a-t-elle facilité » (617.5 px) / « nos décisions ? » (nbsp).<br>- Separator 2 px (auto margin).<br>- « POINTS À TRAVAILLER » 30 px.<br>- Two items 40 px with **60 px** numbered discs (30 px numerals), gap 22: « Revoir un objectif dans le replay » (604.5 + 82 px), « Choisir une consigne commune ». |
| 3 « 03 · DRAFTER » | - Header « Composition principale » 700 44 px (489) + badge « Très maîtrisée » 30 px (padding 6/14, 236.5 px wide), total 741.5 of 752. The badge stays with the header.<br>- Sub row: « Équipe Horizon · démo fictive » 34 px left, « 5/5 champions » right (counter frame-quantised).<br>- Five pick rows **74 px** (gap 8, radius 12), each with:<br>  - role icon **46 px** with a role-colour ring and halo on its pick;<br>  - role label 700 30 px .1em in 84 px (TOP, JGL, MID, ADC, SUP);<br>  - champion 700 **44 px** (Gnar, Vi, Ahri, Jinx, Braum);<br>  - tier 700 32 px, right-aligned (« Confiance » green, « Situationnel » amber). |
| 4 « 04 · PLANIFIER » | - Header « Planning de l’équipe » 700 44 px (local 48–103).<br>- Day labels 700 **32 px** .12em (LUN MAR MER JEU VEN, local 131–169).<br>- Five columns 142.4 px wide (gap 10), local 181–577 (radius 12).<br>- Slots 101 px tall, left/right 6, radius 10: title 700 **32 px**, time 600 **29 px**.<br>  - Lun « Scrim / 19:00 » top 12.<br>  - Mer « Débrief / 19:00 » top 12.<br>  - **Jeu « Match / 20:00 » top 120** (16:9 offset).<br>  - Ven « Scrim / 19:00 » top 12.<br>  - Mar empty.<br>- Slot padding 12/4/12/10 so that « Débrief » (116 px at 32 px) fits the 130 px slot. |

### 2.3 Camera keys (vertical `scenes/camera.js`; punches 4.8: 24, 9.6: 24, 13.2: 16, 27.6: 24, unchanged)

```js
z:     [[-1,-126],[0,-90],[3.6,54],[4.8,90],[6.6,126],[7.2,118],[9.6,110],[11.4,128],[13.2,50],[14.6,-30],[16.8,-12],[20.4,4],[24.0,22],[27.2,40],[27.6,40],[28.8,24],[32.4,70],[33.2,70]]   // = v7.1
x:     [[-1,59],[0,51],[4.5,-5],[4.8,-7],[7.2,0],[13.2,0],[14.8,-30],[27.2,30],[28.8,0],[33.2,0]]        // x = (z − 2000)·tan(yaw): the axis stays still
y:     [[-1,30],[0,24],[4.5,-4],[4.8,-6],[7.2,-16],[9.6,-30],[12.4,-40],[13.2,-44],[14.6,-24],[27.2,-20],[27.6,-20],[28.8,-34],[32.4,-80],[33.2,-80]]   // v7.1 until 27.6, then the end settle crane
yaw:   [[-1,-1.6],[0,-1.4],[4.5,0.15],[4.8,0.2],[7.2,0],[9.6,0.2],[13.2,0],[14.8,0.86],[27.2,-0.86],[28.8,0],[33.2,0]]   // tools orbit ±0.86° (16:9 ±1.4°)
pitch: [[-1,-0.7],[0,-0.6],[4.5,0],[7.2,0.1],[9.6,0.4],[12.4,0.6],[13.2,1.0],[14.6,0.3],[27.2,0.2],[28.8,0],[33.2,0]]  // opening tilt −0.6° (16:9 −0.4°): rises toward the light
```

**Camera state at key times** (z / x / y / yaw / pitch → ray source):
- 0.0: −90 / 51 / 24 / −1.40 / −0.60 → (580, −126.7)
- 2.6: 16 / 18 / 8 / −0.48 / −0.23 → (554, −121.9)
- 4.8: 90 / −7 / −6 / 0.20 / 0.02 → (534, −121.5)
- 6.6: 126 / −1 / −13 / 0.03 / 0.07 → (539, −126.8)
- 9.6: 110 / 0 / −30 / 0.20 / 0.40 → (533, −122.1)
- 13.2: 50 / 0 / −44 / 0 / 1.0 → (540, −109.6)
- 15.5: −25 / −29 / −23 / 0.84 / 0.28 → (516, −143.0)
- 22.9: 16 / 13 / −20 / −0.38 / 0.22 → (551, −184.3)
- 27.6: 40 / 25 / −20 / −0.73 / 0.17 → (561, −204.1)
- 31.5: 63 / 0 / −75 / 0 / 0 → (540, −208.3)
- Rest at 32.4 (velocity 0).

### 2.4 Light fronts (vertical `NX.FRONT`; R = vertical radius in screen px from the ray source, ellipse K = 2.5)

```js
hook:     NX.track([[3.84,40],[4.10,290],[4.28,487],[4.50,750],[4.80,1081],[5.02,1300],[5.30,1470],[5.60,1540]])
hookLead: t => 60 + 86 * SINE(seg(t, 4.20, 4.78))      // burn edge of the question = R + lead (60 → 146)
unwrite:  NX.track([[6.66,1360],[6.83,1208],[7.00,1057],[7.17,905]])     // S2 exit, reverse front (16:9 6.78:1070 → 7.17:590)
end:      NX.track([[26.6,120],[26.85,260],[27.10,395],[27.30,538],[27.60,830],[27.85,1080],[28.15,1420],[28.5,1600],[28.8,1660]])
endLead:  t => 100 + 45 * SINE(seg(t, 27.30, 27.55))   // S8 burn lead 100 (16:9) → 145; lockup writing keeps lead 0
```

**Measured peaks** (all within the limits):

| Track | Peak | At | Limit / notes |
|---|---|---|---|
| hook front | 1,220 px/s | 4.39 | |
| hook burn edge | 1,432 px/s | 4.43 | ≤ 1,500 |
| unwrite | 895 px/s | | |
| end front | 1,240 px/s | | |
| end burn edge | 1,275 px/s | | |

**Shader front bands** (`uFront`, `uFrontR = R / NX.U / zoom`) follow the vertical tracks:
- hook: env(3.84, 3.94, 5.30, 5.60) (16:9 4.2 / 4.3 / 5.3 / 5.6);
- end: env(26.55, 26.65, 28.5, 28.8) (16:9 27.1 / 27.2 / 28.4 / 28.7).

### 2.5 Sky (vertical)
- **Ray source:** `NX.SKY.rayY` = 0.99 (V1), so the source sits at the same height above the top edge as in 16:9 (rayY 0.6 in a 1080-tall frame).
  - About 110–127 px above the frame through S1–S5 (−109.6 at the drop).
  - Rising to −204 at 27.6 and −208 at the end: zoom 0.993 → 1.106, the 16:9 formula.
  - x follows the orbit: 580 → 534 (S1), 516 (S6) → 565 (S8).
- **Three new uniforms** (patch of `shader.js`; the 16:9 defaults in brackets keep 16:9 byte-identical):
  - `uFall` **0.80** [1.15]: ray falloff `exp(−r·uFall)`. Content is lit down to about y 1350 (about +60% ray light at 1350 against 1.15).
  - `uNebY` **0.10** [0]: nebula mass centre raised 0.10 U (108 px), behind the hero and words bands, not the caption band.
  - `uFoot` **0.28** [0]: foot darkening `col *= 1 − uFoot·(1 − smoothstep(−0.80, −0.42, uv.y))`, from y 1414 (0%) to 1824 (28%). The caption band stays the darkest part.
- Every other sky event is unchanged from `ciel.js`: hit flashes, the burn and lift relays, the S5 focus, the pre-drop swell, the groove pulse, the end hold, the sky clock.
- Dust: the kit field follows the frame (V1: positions × (1080/1920, 1920/1080), so x −787…1856, y −1600…3556; same density on screen, same drift in px/s).

---

## 3. Shots

### 3.1 S1 Accroche, 0.00–4.80: « the question as a poster on the eye line »

**Layout:**
- Six phrase lines, centred, 88 px (§2.1). Block 482–1042 on screen at 2.6, centre 762.
- Line 3 « et de comprendre » is the widest (720 px). Its right edge peaks at x 915 at 4.40, just before it burns (rail rule ≤ 920).
- **One spectral gradient** runs across « comprendre » (end of line 3) and « ton équipe » (line 4):
  - both spans use `background-size` 958 px (the 16:9 run × 88/96);
  - « ton équipe » takes `background-position` −(width(comprendre) + gap);
  - « comprendre » therefore runs cyan → lavender and « ton équipe » lavender → fuchsia.
- **One sheen** crosses both spans in reading order (16:9 sheen window).
- Kit extension: `NX.layout` groups `.nx-spec` spans by `data-spec-run` and lays the run out along the reading path. `NX.type.sheen` takes the group.
- Line 6 is « of Legends ? » with a non-breaking space before « ? ».
- The S2 lockup waits behind the block with its forge silhouette (0 → 0.24 4.0–4.5, → 0.30, swell 0.42 4.55–4.78, as in 16:9).

**Motion:**
- Words keep their 16:9 rise times: the 16:9 lines become line pairs.
  - Lines 1–2 words at −0.30 + 0.16 i.
  - Lines 3–4 at 1.20 + 0.14 i.
  - Lines 5–6 at 2.00 + 0.14 i, with **« Legends ? » as one unit**.
  - The question is complete at **3.22**.
- Tracking −0.012 → −0.032em (outCubic 0.20–3.60).
- Hold of the complete question: 3.22 → 4.278 = **1.058 s**.
- Burn per line (burn edge R + lead reaches the ink; gone when R + lead − 10 passes the bottom corners), with glyph glow per word as in 16:9:

  | Line | On | Gone |
  |---|---|---|
  | 1 | 4.278 | 4.406 |
  | 2 | 4.358 | 4.469 |
  | 3 | 4.424 | 4.544 |
  | 4 | 4.489 | 4.611 |
  | 5 | 4.563 | 4.691 |
  | 6 | 4.636 | **4.7791** |

  The question is gone before the first sub-frame of the 4.80 frame (4.7917, shutter 0.5 × 6), with a 12.6 ms margin.

**Light front: required order.** The front starts at 3.84 (R 40). It falls ~600 px through empty sky, and the sky's front band is visible (3.84–4.27), before it touches line 1. Then:

| t | Event |
|---|---|
| 4.278 | line 1 burns |
| 4.358 | line 2 burns |
| 4.424 | line 3 burns |
| 4.446 | **spear tip lit** (written 4.515): the burn uncovers the emblem being written behind the words |
| 4.489 | line 4 burns |
| 4.563 | line 5 burns |
| 4.636 | line 6 burns |
| 4.642 | wordmark lit |
| 4.664 | ring written |
| 4.774 | **emblem complete** |
| 4.80 | **hit**: core flash and streak; white-hot band at 0.75 of NXT5 (y 959.5 on screen, wordmark 800–1013) |
| 4.817 | wordmark mid |
| 4.931 | wordmark done |
| 4.954 | tagline done |
| ~5.0 | lockup complete |

In 9:16 the emblem sits behind lines 1–3 instead of above the question (spear tip at y 587.6, under line 1). « Emblem above the question first » (16:9) therefore becomes « each burned line uncovers the logo being written ». The logo's write edge (R − 70) always trails the burn edge (R + lead) by 130–216 px, so no glyph is ever over written chrome.

**Camera:**
- The opening orbit swings the sky and dust while the text stays centred:
  - yaw −1.4° → 0.2°;
  - x = (z − 2000)·tan(yaw), 51 → −7.
- Push z −90 → 54 (3.6) → 90 (4.8) plus punch 24.
- Tilt −0.6° → 0 (rises toward the light).
- Scale 0.957 → 1.047.

**Sky:**
- Source at about (580 → 534, −127 → −121).
- Rays +0.25 on the burn (4.45–4.78), hit flash 0.9.
- The question sits in the brightest ray fan. The foot band below 1414 is darkened.

**Judges:**
- A preferred legibility's poster; B preferred native's timing.
- Kept: legibility's centred block, spectral run across the break and rising camera.
- 88 px instead of 92–94: 92 px could not meet hold ≥ 1.0, edge ≤ 1500 and a clean hit together (§7).
- Grafts:
  - native's x-compensated orbit;
  - continuity's early front and per-line burn table;
  - native-style lead, ramped 60 → 146.
- Must-fixes met:
  - centre 760–800 (762);
  - ≤ 92 px;
  - six lines with the non-breaking space;
  - one gradient and one sheen;
  - edge 1,432 ≤ 1,500;
  - clean hit;
  - hold 1.058.

### 3.2 S2 Logo, 4.80–6.66: lockup hold

**Layout:**
- **L2 = 800 px, the 16:9 object** (left 141.27, top 520), axis x 540.
- On screen at 5.6: bright strokes 183–918 × 577–1048, ring centre (540, 746), art centre 841.
- At the 6.6 push the strokes reach x 921 (rail rule ≤ 930) and the dark plate x 963 (decorative, ≤ 980).
- Portrait halo 1100 × 980 centred on the art (z −2.5), breath 0.7 + 0.3·e^(−3τ) (16:9 recipe).
- Sparks rise from the bright pixels into the empty sky above (16:9 physics).

**Motion:**
- 16:9 unchanged: forge, writing, hot band, hit, sparks, halo bloom in phase with the writing, glint.
- The leaves and bright masks keep their 16:9 scale.

**Camera:** z 90 → 126 (6.6); x −7 → 0 and yaw 0.2 → 0 by 7.2 (centred exit); y −6 → −16; pitch 0 → 0.1.

**Sky:** source (536, −124); hit flash decays; the burn relay returns light to the rays 5.0–5.8.

**Judges:**
- Both chose continuity's 800 px lockup.
- Grafts: native's portrait halo, B's rail test (921 ≤ 930), the halo bloom in phase.
- **Deviation from A's graft (lockup centre 800–815):** the art centre stays at 841 on screen.
  - The emblem, the object that continues into S3′ and S5, sits on the eye line: ring 746 → 709.
  - Raising the lockup 26–40 px would put the hit band at 0.85–0.94 of NXT5 instead of 0.75 (16:9: 0.51). The wordmark's middle would then be written before the hit (4.776–4.796 instead of 4.817), so the letters would be nearly complete when it lands (measured with `hook.mjs 492 480–500`).

### 3.3 S2 exit, 6.66–7.25: « the light takes the words back »

**Layout:** the emblem stays in place at S0 (screen ring ≈ 746). The wordmark, tagline, ornament and plate leave.

**Motion:** the v7.2 recipe is unchanged:
- region R around the emblem;
- plate fade 6.80–6.98 SINE;
- relay 6.95–7.12, absorption 7.04–7.15;
- pixel-matched cross-dissolve 7.10–7.25 (`SWAP` 7.1833) with the white band on the leaving strokes.

S0, BOX0 and the favicon box are the 16:9 values, so §6.9 keeps its numbers.

**Light:**
- `UNWRITE9` = 1360 → 905 over 6.66–7.17: a flat curtain climbing back toward the source.
- Its entry changes no pixel: 1360 − 70 ≥ 1280, the farthest plate pixel. It touches the first pixel at 6.671.
- Peak 895 px/s. It ends 32.6 px (front distance) above the wordmark top (937.6).

**Camera:** centred exit (x 0, yaw 0 by 7.2), z 126 → 118.

**Sky:** lift relay 6.6–7.4 (rays +0.45, nebula +0.24): the sky takes the light.

**Judges:** native's reading of the curtain (A) and continuity's 16:9 scale (B) are both satisfied. The 16:9 S0 keeps the swap validated, and the reverse curtain peaks at 895, below native's ~910.

### 3.4 S3′ Rôles, 7.20–9.60: five players become one team

**Layout:**
- Pentagon on the emblem's optical centre (539.35, 725.50), r 275, angles 126/198/270/342/54.
- Tiles 151 px (scale 0.70; icons 92 px), glass, role colours.
- On screen at 8.3:

  | Tile | Box |
  |---|---|
  | Top | 285–445 × 899–1059 |
  | Jungle | 179–339 × 574–734 |
  | Mid | 456–616 × 373–533 |
  | ADC | 733–893 × 574–734 |
  | Support | 627–788 × 899–1059 |

- Emblem (S0) 378–694 × 597–888.
- Clearances:
  - every tile is ≥ 51.9 px from the emblem's opaque pixels (Jungle 51.9, ADC 52.6, Support 59.2, Mid 65.7, Top 70.7);
  - Top and Support inner corners, (453.3, 872.4) and (625.4, 872.4), stay outside the ring's open sector: they sit 152.5 and 151.7 px from the ring centre (540.08, 747.01), beyond the ring's outer radius at S0 (186 × 0.72887 = 135.6);
  - ADC right edge ≤ 895 at its birth (35 px inside the 930 rail rule);
  - Mid top ≥ 365 (145 px under the top band).
- Stage pool: portrait ellipse 620 × 720 (alpha 0.15) on c.
- Waiting orbs for unborn roles as in 16:9.

**Motion (16:9 unchanged):**
- Births on the bells 7.2 / 7.5 / 7.8 / 8.1 / 8.4: SPRING rotateX 55° → 0, rise 14 px, z −84 → 0, flash.
- Lean toward the centre 8.30–8.50.
- Fusion particles stream into their sectors and the pointillist emblem resolves on the 9.6 hit.
- The emblem grows ×1.34 and **rises 67 px** (C0 747 → C1 680, SINE 8.6–9.6):
  - ring peak 101 px/s, tip 190 px/s;
  - screen ring at 9.6: (533, 709).

**Light:**
- Bell beams fall almost vertically from the source to each tile's foot (571–1117 px long).
- Beams to Top and Support cross the emblem and keep 25% alpha inside the ring (continuity's rule; 16:9 v7.2 erase in emblem).

**Camera:** nearly still: z 118 → 110, y −16 → −30, yaw 0 → 0.2, pitch 0.1 → 0.4; punch 24 at 9.6.

**Sky:** source (537, −124); the lift continues until 9.6 ± 0.5; sky clock as in 16:9.

**Judges:**
- A chose native; B chose continuity.
- Kept: native's layout (r 275, portrait pool, vertical beams, emblem lift).
- Tiles 0.70 (151 px), between native's 0.69 and legibility's ~160. B accepted 0.69 if the probe passes.
- Grafts: legibility's clearance rule and continuity's ring rule.
- **Required in V4:** the fusion particle probe (p99.5 ≤ 900, max ≤ 1,400) with r 275, ×1.34 growth and the 67 px rise.

### 3.5 S5 Direction, 9.60–13.20: « one column of light »

**Layout:**
- Emblem E5 **500 px** (art 339–739 × 465–834), with a 100 px gap above the title « Une même / direction. » at **104 px** (the tool-title size; ink 946–1139; « direction. » spectral).
- On screen at 10.8: emblem art 321–747 × 485–878, title 258–811 × 997–1204.
- Halo ≈ 980 px periwinkle on C1, +20% on the light kicks.

**Motion:**
- 16:9 times (direction.js):
  - title in 9.75 / 9.87 / 9.99 (ENTER 0.8);
  - breath 9.8–12.6 (−10 px, ×1.025);
  - sheen on « direction. » 10.5–11.3;
  - glint 11.35–12.05.
- The title sinks at 12.80 / 12.85 / 12.90 (EXIT 0.30) and is **gone at 13.20**.
- Condensation group 0.10 s earlier (§1.6).
- **Spear rise 320 px**, LIFT 12.60–13.18, peak **898 px/s** at 13.13.
- FADE 12.95–13.18 is unchanged. The tip crosses y 220 at 13.158, when its alpha is ≈ 0.02, so the spear's fade ends inside the source glow and nothing solid enters the top band.

**Light:**
- Direction beam from the spear tip to the source (611–615 px).
- Drawn **10.75–12.0 (SINE)**, landing on the 12.0 light kick. Head peak 769 px/s (≤ 800).
- Swell 12.6–13.15; off at 13.2, relayed to the drop beam.

**Anticipation rims (13.0–13.185):**
- The stack above eases in its rims (ENTER) while the title sinks below. Front-card rim bottom 1000–1003 on screen; title ink top 1023–1026.
- **A constant mask on the rim leaf only** hides the front card's rim below local y 607 (3%; back cards 0%). Every visible rim stays ≥ 40 px above the title ink.
- No animated mask on large leaves (§6.8).

**Camera:** z 110 → 128 (11.4) → 50 (13.2); y −30 → −44; yaw 0.2 → 0; pitch 0.4 → 0.6 → 1.0.

**Sky:**
- Focus 9.8–10.8 (rayFocus 0.45) aims the rays at the spear.
- Source (535, −126) → (540, −110) at the drop.

**Judges:**
- A chose native's hierarchy; B chose continuity's scale.
- E5 500 sits between 460 and 520. The static 1:1 canvas copy must be rebuilt at 500 px and §6.8 re-run at 9.6.
- Grafts:
  - continuity's 100 px gap and calmer spear (320 px, ≤ 930);
  - native's beam timing on the 12.0 kick;
  - B's constant rim mask.
- Must-fixes met: the title is gone at 13.20, and the rims never overlap it.

### 3.6 S6 « 01 · ANALYSER », 13.20–16.80: card on top, words below

**Layout:**
- Stack 840 × 625 at (90, 300), z −60, rotY 4°, rotX 3° (§2.1).
- Kicker « 01 · ANALYSER » at (154, 982), with the title « Comprends tes / parties. » under it (« parties. » spectral).
- **Shared left edge:** the title ink and the card content's left edge stay within −2.8 / +1.4 px through the orbit.
- Card bottom → kicker ≥ 61.6 px on screen.
- On screen at 15.5:
  - card 101–907 × 358–958;
  - kicker 150–593 × 1015–1057;
  - title 150–896 × 1103–1314.
- Card 1 (§2.2) has stacked stat tiles with 96 px values, so it has no dead band.

**Motion:** 16:9 times:
- power-on 13.185–13.285 on the drop;
- badge on the snare 13.8;
- counters 13.95–15.0 and 14.5–15.6;
- vision focus 16.2–16.4;
- rows sink from bell − 0.40 + 0.03 i, the vision tile last (readable until 16.60).

**Lift into the light** (bell − 0.30, LIFT 0.6 s):
- −300 y, −360 z, rotateX −18° (16:9 values);
- visibility 1 → 0 over bell − 0.05 → bell + 0.30;
- fastest corner 616 px/s;
- top edge ≥ 242 on screen while visible (> 0.3).

The card rises straight up, away from the words, and never passes behind the incoming title.

**Light (drop):**
- At 13.2 the beam comes straight down from the source (540, −110), through the top band, onto the top rim at the point plumb under the source (local x 452; screen (541, 394); 504 px from the source).
- It flares along the rim from the centre outward (anamorphic line plus core).
- Beam alpha 0.8·e^(−5τ). No text lies under the beam.

**Camera:**
- Drop push z 50 + punch 16, pitch 1.0 → 0.3 (14.6).
- **Tools orbit cut to ±0.86°** with x compensation (x −30 at 14.8 ↔ +30 at 27.2), so the column of words stays still while the rim angle (180 + 6·yaw) and the card sheen move.

**Sky:** source (516, −143) at 15.5; groove pulse from 13.0; the drop swell and flash are 0.3 of a hit.

**Extremes:**
- deepest text 1376 at 13.3 (drop punch) ≤ 1380;
- title right edge 914 at 13.3 (≤ 920);
- front card rim 926 (≤ 930);
- left margin 24 (card) and 32 (text).

**Judges:**
- Both chose native.
- Grafts:
  - continuity's long fall and rim flare (stack top 300);
  - legibility's shared left edge and 96 px values;
  - continuity's ~4° yaw;
  - B's 16:9 lift values.
- The side-by-side stat tiles are kept as an owner option (§7).

### 3.7 S7 « 02 · DÉBRIEFER », 16.80–20.40: hand-over

**Layout:** card 2 (§2.2) in the same stack and column; title « Prépare tes / débriefs. ».

**Hand-over** (16:9 times, bell B1 = 16.8):

| t | Event |
|---|---|
| 16.30 / 16.36 | title 1 line 1 / line 2 sink (EXIT 0.30, gone 16.66) |
| 16.50 | card 1 lift starts |
| 16.55 | verb « ANALYSER » sinks |
| 16.58 | card 2 advance starts (ADVANCE 0.74 s, peak 413 px/s) |
| 16.60 | odometer rolls 1 → 2; « Prépare » rises (ENTER, step 0.14); vision tile last readable |
| 16.70 | card 1 empty |
| 16.75 | « DÉBRIEFER » rises; card 2's first row rises (« QUESTION DU DÉBRIEF », readable ≈ 16.80); card 1 fades out by 17.10 |
| 16.82 / 16.89 | question lines rise |

- **Blank plates plus one word:** ≈ 0.14 s (16.66–16.80), under 0.3 s.
- Sinking words are clipped at their own line box. The mask top (1038.5) is 15 px below the kicker box and 24 px below its ink. The kicker ink → cap gap is ≥ 50 px, so sinking words never touch the kicker.
- Overlap check (V4 strip 16.30–17.30 at 12 img/s): no readable copy under a plate of alpha > 0.5, and nothing behind the lifting plate.

**Camera:** orbit continues (x −26, yaw 0.74 at 16.8); z −12 → 4.

**Judges:**
- Both chose native.
- Grafts: ≥ 24 px kicker → cap (50), line-box exit masks, continuity's overlap check, P2's lift values, blank window < 0.3 s.

### 3.8 S7b « 03 · DRAFTER », 20.40–24.00

**Layout:**
- Card 3 (§2.2): the approved hierarchy at phone size. Badge with the header; « 5/5 champions » in the sub row; five 74 px rows; tiers right-aligned (≥ 31 px from the rail on screen).
- On screen at 22.9: card 95–918 × 343–952, title 143–741 × 1100–1296.

**Motion (16:9 event order):**
- Picks on the drum hits 21.0 / 21.6 / 21.9 / 22.2 / 22.8. Champion names start 0.05 s early; counter, ring, halo, icon and tier land on the hit.
- Role-colour ring and halo on each pick: sin^1.5 over 0.5 s.
- Badge SPRING 0.85 → 1 from **22.85**, with a constant-size glow leaf whose opacity only changes.
- Rows sink before the lift at about 23.9; card 4 advances on 24.0.

**Judges:**
- A chose legibility's card; B chose native's.
- Kept legibility's hierarchy. A's must-fix 6 keeps « the Drafter badge with the header », so native's verdict row is not used.
- Grafts:
  - native's 46 px role icons with ring and halo, and its SPRING badge glow;
  - continuity's exact event order.
- Rows are 74 px instead of P2's 78: 78 px rows would leave 4 px between the sub row and the picks.

### 3.9 S8 « 04 · PLANIFIER », 24.00–27.60, and the end burn

**Layout:**
- Card 4 (§2.2): the LUN–VEN grid at phone size, Match in Jeu at top 120.
- Title « Organise tes / entraînements. » (widest line 742.8 px; right edge ≤ 916 on screen at 27.7).
- On screen at 25.5: card 92–922 × 338–952, title 139–910 × 1097–1299.

**Motion:**
- Slots land 24.6 (Lun) / 24.9 (Mer) / 25.2 (Jeu) / **25.8** (Ven), 16:9 SLOT_T. The planning is complete at 25.80.
- The late sweep 26.40–27.00 is kept: it ends before the front touches the card.

**End front: required order** (lead 100 → 145, card first, title held):

| t | Event |
|---|---|
| 26.55 | front band appears in the rays |
| 26.6 | R 120, falling through the sky |
| 27.0–27.6 | emblem flight (opacity 27.0–27.2) |
| **27.157** | front touches the card header (complete planning untouched for **1.357 s**) |
| 27.26–27.39 | day labels burn |
| 27.245 | emblem closest to unburned copy: **46.4 px** (≥ 40) |
| 27.33–27.48 | Lun, Mer and Ven slots burn (all slots intact for **1.53 s**) |
| 27.42–**27.570** | Jeu « Match / 20:00 » burns |
| 27.459 | wordmark lit |
| **27.60** | **hit**: dock, core flash and streak; band at 0.71 of NXT5. No card copy remains under the lockup (all copy gone by 27.570 < 27.5917). The S8 title is still intact. |
| 27.722–27.809 | card bottom (plate) burns |
| 27.737 / 27.756 | wordmark / tagline done |
| 27.785–27.90 | kicker burns (S8 title complete since 24.88: held **2.905 s**) |
| 27.839 | button area clear |
| 27.868–28.023 | line 1 burns |
| 27.964–28.106 | line 2 burns |
| 28.016 | end-line area clear |

**Emblem return:**
- The emblem rides down the axis above the burn (native's choreography): ring from (540, −1150, −4000) to the dock, SINE 27.0–27.6.
- It emerges just under the top band inside the source glow:
  - tip at y 219 at opacity 0 (27.0);
  - full opacity at 27.2 with the tip at 228.
  - No emblem pixel above y 220 at opacity > 0.3.
- Fastest pixel 833 px/s (≤ 860 target).

**Camera:** z 22 → 40, x 20 → 30, yaw −0.58 → −0.86 (orbit); y −20.

**Judges:**
- Both chose legibility.
- Grafts:
  - native's return choreography;
  - continuity's longer holds and burn-lead check;
  - the late sweep.
- New fix for B's must-fix 1, applied to S8: the lead ramp (100 → 145, 27.30–27.55) and Match back to the 16:9 px offset (120), so the 27.6 hit frame is clean of card copy.
- The 16:9 acceptance at the hit (« S8 card header and kicker gone ») becomes « all card copy under the lockup gone; S8 title still held ». This follows the card-first order that both judges chose. There is no double exposure: the title sits below the lockup, in the zone the button and line take later.

### 3.10 S9 Fin, 27.60–32.40

**Layout:**
- L9 **720 px** at (181.15, 225); dock 335.86 at (373.78, 252.85).
- Button « nxt5.org » 64 px (428 × 125) at top 841.
- End line 56 px on two lines (top 1033): « Pour les équipes et coachs » / « League of Legends ».
- Gaps 107 / 67 (16:9 92 / 58 × 720/620).
- On screen at 31.5:
  - strokes 226–872 × 340–754;
  - button 319–761 × 914–1044;
  - line 1 169–911 × 1113–1182, line 2 276–804 × 1182–1252;
  - end-card centre 797.
- Halo 1100 × 940 on the art (z −1, 0.75).
- Each element lands where an S8 element burned:
  - lockup where the card was;
  - button and line where the kicker and title were.

**Motion:** 16:9 times −1.2 s:
- gate and dock at 27.6. The flying favicon is masked to world y < 477.6 (top of the L9 wordmark band), and the lockup's emblem rows stay gated until the hit (the §5.3 swap form);
- sparks 27.55–28.1, halo 27.5–28.0;
- button at chime 1, **28.2** (clip from the centre, ENTER 0.45, bloom);
- end line at chime 2, **28.5** + 0.04 i (ENTER 0.6);
- lockup glint 29.1–29.75, button glint 29.4–30.0, bell star 30.6.
- Readable:
  - lockup ~27.76 → 32.4;
  - button ~28.65 → 32.4;
  - line ~29.0 → 32.4.

**Light:** `FRONT.end` writes the lockup (lead 0) with the emblem rows gated until the dock.

**Camera:**
- The orbit unwinds to frontal by 28.8 (x 30 → 0, yaw −0.86 → 0, pitch 0.2 → 0).
- z 40 → 24 (28.8) → 70 (32.4).
- **End settle crane** y −20 → −34 (28.8) → −80 (32.4). The docked end card (high, so the return stays out of the top band) settles onto the eye line: centre 797 (12.8 px/s on average, 17 px/s at most).
- Rest at 32.4.

**Sky:**
- Source (540, −208).
- Hold glow 27.65–28.5; the groove fades by 29.5.
- The foot band stays darkest under the end card.

**Judges:**
- A chose native's scale; B chose continuity's.
- Kept: native's 720 / 64 / 56 scale, with « League of Legends » unbroken on line 2.
- Grafts:
  - continuity's spacing ratios and short emergence inside the source glow (A wanted ≤ 0.2 s in the top band: the emblem never enters it above 0.3 opacity);
  - B's slow return (833 ≤ 860), CTA margins ≥ 40 (218 / 178), and the « same zone » rule.
- **New scale (dock 335.86):** V4 must re-run the §6.9 dock check and rebake the favicon footprint.

---

## 4. Safe-zone boxes (screen px; `final/checks/camcheck9.txt`, every 0.05 s of each window)

Margins: L/R/T/B to the text box (text) or the key-visual box (visuals); rail = 920 (text) or 930 (visuals) minus the right edge while the box overlaps y 700–1500; deep = lowest text y.

| Element | Kind | Window | World box | Screen extent over window | Worst margins | Status |
|---|---|---|---|---|---|---|
| S1 line 1 « Envie d’analyser » | text | 0–4.278 | 202.8–877.2 × 502.6–588.6 | 189–890 × 475–576 | L 89, R 50 | ok |
| S1 line 2 « tes games » | text | 0–4.358 | 328.6–751.5 × 603.9–683.9 | 320–760 × 574–675 | L 220, R 180 | ok |
| S1 line 3 « et de comprendre » | text | 0–4.424 | 179.9–900.1 × 693.2–775.2 | 165–915 × 659–771 | L 65, R 25, **rail 5** (915 ≤ 920 at 4.40) | ok, thin |
| S1 line 4 « ton équipe » | text | 0–4.489 | 323.5–756.5 × 782.4–868.4 | 314–765 × 746–868 | rail 155 | ok |
| S1 line 5 « sur League » | text | 0–4.563 | 312.7–767.3 × 878.7–963.7 | 303–777 × 838–969 | rail 143 | ok |
| S1 line 6 « of Legends ? » | text | 0–4.636 | 279.8–800.2 × 970–1057 | 268–812 × 926–1066 | rail 108; deep 1066 | ok |
| S2 lockup strokes | visual | 4.8–6.95 | 202.5–896.6 × 587.0–1031.6 | 180–921 × 572–1055 | L 120, rail 9 (921 at 6.6) | ok |
| S2 lockup plate (alpha) | decorative | 4.8–6.95 | 170.0–936.2 × 551.9–1114.6 | 145–963 × 534–1143 | R 17 to 980; in the rail band | decorative, see §7 |
| S3′ emblem (S0 → E5) | visual | 6.95–9.6 | path §2.1 | 320–743 × 482–892 | top 262, rail 187 | ok |
| S3′ tile Top | visual | 7.1–8.6 | 302.1–453.3 × 872.4–1023.6 | 284–448 × 887–1063 | B 437 | ok |
| S3′ tile Jungle | visual | 7.4–8.6 | 202.2–353.4 × 564.9–716.1 | 178–342 × 563–737 | L 118 | ok |
| S3′ tile Mid | visual | 7.7–8.6 | 463.8–615.0 × 374.9–526.1 | 455–619 × 365–537 | top 145 | ok |
| S3′ tile ADC | visual | 8.0–8.6 | 725.3–876.5 × 564.9–716.1 | 732–895 × 570–738 | rail 35 | ok |
| S3′ tile Support | visual | 8.3–8.6 | 625.4–776.6 × 872.4–1023.6 | 626–788 × 899–1063 | rail 142 | ok |
| S5 emblem (art) | visual | 9.6–12.5 | 339.3–738.7 × 465.2–834.3 | 318–749 × 466–893 | top 246, rail 181 | ok |
| S5 title « Une même / direction. » | text | 10.0–12.85 | 280.9–799.0 × 945.9–1139.1 | 257–814 × 993–1240 | L 157, R 126, B 210; deep 1240 | ok |
| S5 spear (rise) | visual | 12.60–13.18 | x ≈ 515–565 | tip → 201 at 13.18 | alpha 0.02 when the tip crosses 220 (13.158) | ok |
| Tools front card (plate) | visual | 13.25–27.0 | corners §2.1 | 84–926 × 336–1003 | L 24, **rail 4** (926 ≤ 930 at 13.3) | ok |
| Tools front card (text) | text | 13.3–27.0 | local 44–796 × 48–577 | 127–888 × 374–953 | L 27, rail 32 | ok |
| Tools back card 2 (top edge) | visual | 13.3–27.0 | slot 2 | 133–852 × 296–356 | top 76 | ok |
| Title 1 « Comprends tes / parties. » | text | 13.3–16.45 | 154–894 × 982–1277 | 132–914 × 1014–1376 | L 32, R 26, rail 6, **deep 1376** (≤ 1380 at 13.3) | ok |
| Title 2 « Prépare tes / débriefs. » | text | 16.6–20.05 | 154–703.7 × 982–1258 | 145–708 × 1012–1295 | rail 212; deep 1295 | ok |
| Title 3 « Compose ta / draft. » | text | 20.2–23.65 | 154–735.8 × 982–1258 | 142–742 × 1011–1296 | rail 178; deep 1296 | ok |
| Title 4 « Organise tes / entraînements. » | text | 23.8–27.9 | 154–896.8 × 982–1258 | 132–916 × 1010–1302 | R 24, **rail 4** (916 ≤ 920 at 27.7) | ok |
| S9 lockup strokes | visual | 27.6–32.4 | 236.3–861.0 × 285.3–685.5 | 225–873 × 288–758 | top 68, rail 57 | ok |
| S9 returning emblem | visual | 27.0–27.6 | flight §2.1 | tip 219 → 302 | > 0.3 opacity only below y 220 | ok |
| S9 button « nxt5.org » | text | 28.2–32.4 | 326–754 × 841–966 | 318–762 × 867–1049 | L 218, R 178 | ok |
| S9 end line (two lines) | text | 28.5–32.4 | 180.9–899.2 × 1033–1167.4 | 168–912 × 1073–1252 | R 28, rail 8, deep 1252 | ok |

Also checked:
- **Text-safe minimum:** 24 px (title 4 right; 16 required).
- **Visual-safe minimum:** 17 px (the S2 plate).
- **Every rail test passes:** text ≤ 920, strokes and rims ≤ 930.
- **Deepest text:** 1376.

---

## 5. Mockups (`out/v73/design/final/`)

**How they are built:** `tools/build.mjs` builds each page from `geo9.mjs`, the vertical camera and the kit maths, and renders it with playwright-core (Chromium 1194, 1080 × 1920, `document.fonts.ready`).
- **Linked styles:** `file:///home/user/NXT5/teaser/engine.css` for the brand tokens and Inter, plus `html/final.css`.
- **Sky:** the real WebGL `shader.js` with the three uniforms of §2.5.
- **Dust:** the kit's far dust.
- **Canvas light:** halos, beams and shadows projected with the film's camera.
- **Objects:** DOM objects in a CSS 3D world under the engine's camera transform.
- **Logos:** the real PNGs (uniform scale, no filter).
- **Light fronts:** the kit's elliptical masks and bright-mask leaves.
- **Cards:** **rebuilt**, not cropped: the kit's glass CSS and `outils.js` content at the 9:16 sizes of §2.2.

Every mockup has a `-guides.png` twin showing:
- the platform UI zones (red);
- the text-safe and key-visual boxes;
- the axis, the rail limit and the deepest-text line;
- element boxes;
- a caption with the camera and source.

| File | Moment |
|---|---|
| `png/m-02.60.png` | S1, the question shown complete (as from 3.22) |
| `png/m-05.60.png` | S2 lockup hold |
| `png/m-08.30.png` | S3′ five roles around the emblem |
| `png/m-10.80.png` | S5 « Une même direction. » with the beam drawing |
| `png/m-15.50.png` | S6 card 1, kicker and title |
| `png/m-22.90.png` | S7b draft card, 5/5 with the Support ring and the badge popping |
| `png/m-25.50.png` | S8 planning (Lun, Mer, Jeu landed; Ven lands at 25.8) |
| `png/m-31.50.png` | S9 end card |
| `png/m-x-04.62.png` | Transition: the front burns lines 1–4, line 5 glowing; the lockup written behind (with arcs in guides) |
| `png/m-x-13.25.png` | Transition: the drop beam on the rim, card 1 powering on |
| `png/m-x-27.40.png` | Transition: the end curtain burns the planning top-down; the emblem returns above unburned copy; the S8 title is intact |
| `sheet-final.png` | Contact sheet of the eight moments at phone size (270 × 480 each) |

**Checks:**
- `tools/hook.mjs` → `checks/hook.json`
- `tools/end.mjs` → `checks/end.json`
- `tools/motion.mjs` → `checks/motion.json`
- `tools/camcheck9.mjs` → `checks/camcheck9.txt`
- `tools/layoutcheck.mjs` → `checks/layout.json`

---

## 6. Implementation checks (V3 → V5)

1. **`NX.V` switch:**
   - vertical `NX.G`, card CSS, camera keys, `NX.FRONT` (`hook`, `hookLead`, `unwrite`, `end`, `endLead`) and the three shader uniforms with 16:9 defaults;
   - re-run the V1 byte-identity guard on 16:9 frames.
2. **Scenes declare `NX.CHECK` / `NX.CHECK_HOLDS`:**
   - with the §4 boxes, so that `tools/camcheck.mjs --format v` tests text 100–940 × 250–1450 (≥ 16 inside), visuals 60–980 × 200–1500, the rail (920 / 930 in y 700–1500), deepest text ≤ 1380 and the top band;
   - it should reproduce `camcheck9.txt` within ±2 px.
3. **Hook:**
   - Kit extension for the spectral run and the sheen across spans (`data-spec-run`).
   - « Legends ? » as one rise unit.
   - 6-sub-frame check that no glyph is present in 4.7917–4.8083.
   - Hold ≥ 1.0 s.
   - Burn edge ≤ 1,500 px/s.
4. **§6.9 swap and dock:**
   - Swap at L2 800 / S0 0.72887 unchanged; re-measure anyway in 9:16.
   - **Dock at 335.86** (new): footprint rebake and difference check at 27.6 − 1/180.
5. **S5 static emblem canvas at 500 px:** §6.8 two-order determinism at 9.6 (the 16:9 fix assumed 460).
6. **Particle probe for the fusion (S3′):** p99.5 ≤ 900, max ≤ 1,400 with r 275, scale 0.70, ×1.34 growth and the 67 px rise.
7. **Speeds probe at the fastest point:** emblem return ≤ 900 (833), spear ≤ 930 (898), beam heads ≤ 800 (769), card corners ≤ 1,000 (616), fronts ≤ 1,600.
8. **S7 hand-over strip** 16.30–17.30 at 12 img/s: blank-plate window < 0.3 s, no copy under the lifting plate, kicker untouched by sinking words.
9. **Anticipation rims:** a constant mask leaf on the rims (cut at local y 607 of the front card), never an animated mask.
10. **S8 → S9:**
    - 6-sub-frame check that no card copy lies under the lockup in 27.5917–27.6083 (Jeu gone at 27.570);
    - burn lead ≥ 40 px between the emblem and unburned copy (46.4);
    - holds: planning 1.53 / 1.357, title 2.905.
11. **§6.5 luminance:**
    - Re-baseline the floors at 270 × 480 for 9:16 (fps 4, gray).
    - The bottom 420 px must be the darkest band in every sample.
    - The hand-over dips 16.45–16.7, 19.95–20.45 and 23.55–24.05 stay ≥ 15.
12. **§6.8 two-order determinism in 9:16** at 4.8, 4.95, 7.2, 8.4, 9.6, 13.2, 16.8 and 27.6.
13. **Delivery:**
    - Custom cover (the 3.4 s complete question, or the 5.6 s lockup).
    - Check against real TikTok, Reels and Shorts overlays. The rails sit at different heights: Reels icons ~1150–1700, Shorts ~900–1600.
    - Publish with a short caption.

---

## 7. Open questions for the owner

1. **« sur League / of Legends ? »**
   - The six-line split breaks the game's name across lines 5–6. It is the owner's call.
   - The alternative keeps « League of Legends ? » whole, which needs ≤ 79 px type: it measures 840 px at 88 px, and a centred line may take about 760 px under the push.
   - Example: « Envie d’analyser / tes games / et de comprendre / ton équipe sur / League of Legends ? ».
2. **« Legends ? » rises as one unit.** The « ? » no longer arrives 0.14 s after « Legends ». Without it the hold falls to 0.92 s with a clean hit.
3. **Card 1 stats:** stacked tiles (phone read, no dead band) or the 16:9 side-by-side look.
4. **End settle crane (y −34 → −80).** It brings the end card onto the eye line after a high dock, which keeps the return out of the top band. The 16:9 crane was −10 → −16.
5. **New logo scales:**
   - E5 500 (16:9 460) and L9 720 / dock 335.86 (16:9 620 / 289.2) read better on a phone.
   - They need the §6.9 and §6.8 re-validation.
   - The fallback (16:9 sizes) is lower risk but smaller.
6. **Hit band phase:**
   - At the 4.80 hit the band is at 0.75 of NXT5 (16:9: 0.51, « upper half »), and at 27.6 at 0.71 (16:9: 0.59).
   - This follows from the six-line question that must be gone before 4.7917 and the card copy that must be gone before 27.5917.
7. **S2 plate edge:** the lockup's dark plate (not its strokes) reaches x 963 in the rail band at the 6.6 push. Accept it as decorative, or feather the plate's right edge in 9:16.
8. **Thin, passing margins:**
   - hook line 3 at 915 of 920 (4.40);
   - title 4 at 916 of 920 (27.7);
   - front card rim at 926 of 930 (13.3).
9. **Charte:** the charte link in `AGENTS.md` (`../../2026-05-05/.../docs/charte-graphique.md`) is missing from this checkout. The brand rules here come from the brief and `engine.css`.

---

## Appendix A: must-fix ledger

**Judge A (art direction):**

| # | Item | Resolution |
|---|---|---|
| 1 | Safe zones at every extreme, rail test | `camcheck9` every 0.05 s.<br>Text ≥ 24 px inside; rail ≤ 916 (text) / ≤ 926 (visuals).<br>Fixed cases:<br>- legibility's 0.7 px title → 32 px;<br>- hook 2.5 px → 25;<br>- 880 lockup → 800 (921);<br>- ADC → 895;<br>- native's rim → 926. |
| 2 | Top band light only | The emblem never shows > 0.3 opacity above y 220 (tip 228 at full opacity). The spear's fade ends as its tip crosses 220 (alpha 0.02). |
| 3 | Hook | Centre 762; 88 px; six lines; non-breaking space; one gradient and sheen; edge 1,432; gone 4.7791; split → §7. |
| 4 | One type scale | 88 / 104 / 34; card ≥ 29; CTA 64, line 56; kicker → cap 50. |
| 5 | Card on top, words below | Drop, lifts and burn cross no copy. Blank window ≈ 0.14 s. Card → kicker 61.6. Deepest text 1376. |
| 6 | Card identities, near-frontal stack | Two stats (stacked, option §7); badge with the header; LUN–VEN with Match in Jeu; rotY 4°, rotX 3°. |
| 7 | Holds and overlaps | S8 title 2.905 s; planning 1.53 s with the late sweep; S5 title gone 13.20; rims masked (constant). |
| 8 | Logos | PNG only; L2 800; L9 720 with 16:9 ratios; emblem 46.4 px from unburned copy; swap at the 16:9 scale; new dock scale re-validated in V4. |
| 9 | Speeds | Spear 898; return 833; beam head 769; fronts ≤ 1,275 edge; particle probe in V4. |
| 10 | Camera | x-compensated orbits (opening, tools ±0.86°); push extremes 6.6 and 13.2–13.35 measured. |
| 11 | Sky | `uNebY` 0.10, `uFall` 0.80, `uFoot` 0.28; §6.5 re-baseline at 270 × 480 in V4. |
| 12 | Copy | Word for word; « League of Legends » unbroken on the end card; no forbidden words; everything behind `NX.V`. |

**Judge B (platform and feasibility):**

| # | Item | Resolution |
|---|---|---|
| 1 | Clean hit frames | Hook gone 4.7791 < 4.7917. S8 card copy under the lockup gone 27.570 < 27.5917 (lead ramp 100 → 145; Match at 120). |
| 2 | Fastest-point speeds | Return 833 ≤ 900; spear 898 ≤ 930; burn edge 1,432. |
| 3 | Right rail | Text ≤ 916, strokes ≤ 921, rims ≤ 926. |
| 4 | Bottom | Deepest text 1376 ≤ 1380 including the 13.2 punch; short caption. |
| 5 | Card UI ≥ 29–30 px | Minimum 29 (slot times), otherwise ≥ 30. |
| 6 | Holds | Hook 1.058; planning 1.357 before the front touches the card; tool titles ≥ 2.4. |
| 7 | Anticipation rims | Constant mask on the rim leaf only. |
| 8 | Drop beam over text | None: card on top. |
| 9 | Non-16:9 logo scales | L2 and S0 unchanged. E5 500 and dock 335.86 listed for §6.9 / §6.8 re-measure. |
| 10 | Particle probe | Required in V4 (§6 item 6). |
| 11 | 16:9 byte-identical | `NX.V` values; shader uniforms with 16:9 defaults; `NX.CHECK` for `camcheck --format v`. |
| 12 | Spectral accent across the break | Kit extension `data-spec-run` (gradient run 958 px and one sheen). |
| 13 | Luminance and determinism | Foot darkening; re-baseline; two-order runs at 4.8, 7.2, 9.6, 13.2, 16.8 and 27.6. |
| 14 | Delivery | Custom cover; real overlays check. |
| 15 | Copy | Non-breaking space kept; the split is the owner's call (§7); no forbidden words. |
