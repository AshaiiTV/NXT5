# NXT5 teaser v7: motion bible

This brief is final for v7. Implementers follow it to the letter. A deviation needs the lead's approval and is recorded here.

**Base treatment.** « Vers la lumière » (product-film) won all three judges (41.5 / 43.5 / 43). Grafts from « Le Faisceau » (esports-ident) and « Un seul plan » (one-shot) are marked **[graft]**. Ideas the judges flagged as risky have been dropped.

**How it was checked:**
- Geometry was measured on the PNGs (Appendix B).
- Text widths were measured in the capture Chromium with Inter loaded.
- Camera framing and speeds were computed with the kit's own `NX.track` and `NX.cam.project` maths.
- The five riskiest moments were prototyped in `out/design/motion-bible/sandbox/` (Appendix A, reference sheet `out/design/motion-bible/prototype-keyframes.jpg`).

**Fixed and unchanged:**
- `NX.T`: 4.8, 7.2, 9.6, 12.6, 14.4, 18.0, 21.6, 25.2, 28.8, 33.6.
- `audio.js`.
- All on-screen copy.
- Brand rules: charte graphique (see `AGENTS.md`), Inter, panels with 16 px radius, the CTA button with 2 px radius.

Wherever a value is given here, it is the value to implement. "≈" marks a measured consequence, not a parameter.

---

## 9:16 version (7 Oct)

The vertical version for TikTok, Reels and Shorts has its own bible: `MOTION-BIBLE-9x16.md`. Everything below stays the reference for the 16:9 film, which must remain byte-identical.

## v7.2 amendment (7 Oct, owner feedback on the v7.1 preview): read this first

« On a deux fois le logo en deux slides (2 et 3), ça ne sert pas à grand-chose. Fusionne un peu les deux. » In v7.1 the full lockup is written at 4.8, is taken into the light at 7.15, and a new emblem is born again at 9.6 under « Une même direction. ». The owner sees the logo twice.

**Decision: one continuous logo moment, 4.8–13.2.** The logo is written once; its emblem stays the subject through the roles and « Une même direction. ». It is never taken away and reborn. `NX.T`, the duration (32.4), the music, the camera, the tools act and the end are unchanged (v7.1 amendment below still applies to everything else).

| Time | Event |
|---|---|
| 4.20–5.05 | Unchanged: the light writes NXT5 and burns the question; hit at 4.8. |
| 5.0–≈6.6 | Lockup hold, readable (≥ 1.5 s). |
| ≈6.6–7.25 | The wordmark, the tagline and the lockup's dark plate are taken into the light (whitening and the reverse front, never a grey ghost), while the emblem's bright strokes stay crisp in place. The lockup's emblem then hands over to the favicon emblem through a 0.15 s cross-dissolve (7.10–7.25), pixel-matched (§6.9 measure on the emblem rows: mean < 2/255, max < 24/255 outside a 2 px fringe). See the deviation table for the exact recipe. |
| swap → 9.6 | The emblem (favicon PNG) starts at the lockup's geometry (favicon ×1.1425 at (335.5, 48.5) in lockup px of `NX.G.L2`: ring centre (958.7, 452.1), world scale ≈ 0.729) and reaches the E5 geometry (ring centre (960, 441.7), scale ≈ 0.898) by the 9.6 hit, without pop, rotation or filter. |
| 7.2–8.4 | The five roles are born around the emblem, from its light, one per eighth note (bells unchanged), as the v7.1 glass tiles, on a pentagon centred on the emblem's optical centre (958.07, 430.50) with r = 262, clear of the ring. |
| 8.5–9.6 | They dissolve into particles of their colour that stream into their own sector of the emblem, which charges with their light (its light leaves rise within the brand cap). No pointillist birth from nothing: the particles land on an emblem that is already there. On the 9.6 hit the emblem resolves at E5 size with the existing hit (core flash, one streak, the one shockwave). |
| 9.6–13.2 | Unchanged from v7.1: « Une même direction. », beam, glint, condensation into the spear, the spear rides the beam up, the drop at 13.2. |

**Ownership for this change:** one package (M) owns `scenes/logo.js` (S2 exit and swap), `scenes/direction.js` (the emblem from the swap to 13.2) and `scenes/equipe.js` (the roles around the emblem and the fusion into it), because the moment is continuous. `ciel.js` stays with the lead: its relay « take » (7.11–7.8) was tuned for the whole lockup's light and will be retuned from the measured luminance.

**Acceptance:**
- No frame between 4.8 and 13.0 where the emblem jumps, doubles, pops, disappears or changes crispness; the swap is invisible at 1:1 and in motion.
- The lockup reads complete for at least 1.5 s; the wordmark leaves as light.
- The five roles read as five players joining the emblem, on a phone, in about 2.4 s; tiles never overlap the emblem's ring; particles p99.5 ≤ 900 px/s, max ≤ 1,400 px/s; objects ≤ 1,000 px/s.
- §6.5 luminance continuity over 4.8–13.2 (≤ 4.5 between samples outside the hit windows, ≤ 9 inside), mean Y 7.0–9.5 ≥ 15, S5 guard 10.45–12.7 ≥ 17.1.
- Determinism in two orders and after a long history; no page errors; brand rules (logos never rotated, recoloured or filtered).

**End card (owner feedback on the v7.2 preview, 7 Oct):** « Retire la notion actuellement gratuite à la toute fin. » The line « Accès actuellement gratuit » is removed from S9; the button and « Pour les équipes et coachs League of Legends » keep their place (`NX.G.end.line2Top` is gone). Chime 3 is kept so the arpeggio stays whole: it now sounds under the end of line 1's rise (« League of Legends » rises 28.70–29.38).

---

## v7.1 amendment (6 Oct, owner feedback on the v7 preview): read this first

This section supersedes every time, copy and camera value of §2–§6 that it changes. Everything else in the bible still applies (motion language, easing, speed limits, brand rules, light rules, glass, type kit, determinism, verification method).

**Owner feedback:**
1. The opening question must say it is about League of Legends.
2. The roles passage is « super belle » but its relevance is unclear. The owner chose to make it a **simple transition of about 2 s, with no title**: the five roles appear quickly and fuse straight into the emblem.
3. The tools act is « top »: add a **fourth tool**.

**New timeline (`NX.T`, `scenes/style.js`):**

| Anchor | v7 | v7.1 |
|---|---|---|
| `hookEnd` (logo hit) | 4.8 | 4.8 |
| `roles` (first role) | 7.2 | 7.2 |
| `team` / `fuse` | 9.6 / 12.6 | 8.4 / 8.4 (fifth role, the fusion starts) |
| `emblem` (hit) | 14.4 | **9.6** |
| `tools` (drop) | 18.0 | **13.2** |
| `tool` | 3.6 | 3.6 (four tools) |
| `end` (hit) | 28.8 | **27.6** |
| `NX.DURATION` | 33.6 | **32.4** |

`NX.T.hits` = 4.8, 9.6, 13.2, 27.6. Light fronts: `NX.FRONT.hook` unchanged; `NX.FRONT.end` keys all −1.2 s (27.10 … 28.60).

**Shot mapping (apply exactly):**

| Shot | v7 window | v7.1 window | Rule |
|---|---|---|---|
| S1 Accroche | 0–4.8 | 0–4.8 | Same timing grammar. Copy now three lines: « Envie d’analyser tes games » / « et de comprendre ton équipe » / « sur League of Legends ? » (non-breaking space before « ? »). Line 3 in plain text colour (the spectral accent stays on « comprendre ton équipe »). All three lines must be complete and readable by about 3.4 s, burnt line by line by `NX.FRONT.hook` (lead 0), and gone before the lockup's letters need the space. |
| S2 Logo | 4.8–7.2 | 4.8–7.2 | Unchanged, except the camera no longer drifts left at the end (x stays 0, yaw goes 0.2 → 0 by 7.2): the exit is centred. |
| S3 + S4 Rôles, équipe, fusion | 7.2–14.4 | **7.2–9.6, new S3′ below** | « Toute ton équipe. », the row of tiles, the labels and the link line are removed. |
| S5 Direction | 14.4–18.0 | 9.6–13.2 | Every S5 time −4.8 s, unchanged otherwise. The camera is identical, shifted by −4.8 s. |
| S6 Outil 1 « 01 · ANALYSER » | 18.0–21.6 | 13.2–16.8 | Every time −4.8 s. Camera identical through the reveal (13.2–14.6); the orbit is slower afterwards. |
| S7 Outil 2 « 02 · DÉBRIEFER » | 21.6–25.2 | 16.8–20.4 | Every time −4.8 s. |
| **S7b Outil 3 « 03 · DRAFTER »** | — | **20.4–24.0** | New, spec below. |
| S8 Outil 4 « 04 · PLANIFIER » | 25.2–28.8 | 24.0–27.6 | Every S8 time −1.2 s (its burn by `NX.FRONT.end`, lead 100, included). Kicker digit 04. |
| S9 Fin | 28.8–33.6 | 27.6–32.4 | Every S9 time −1.2 s (emblem return 26.8–27.6, dock, hit 27.6, chimes, rest at 32.4). The camera is identical, shifted by −1.2 s. |

**S3′ Rôles, a transition (7.2–9.6, `equipe.js`, window about 7.0–9.75):**
- The logo is absorbed into its ring centre at 7.09–7.15 (S2) and the sky takes its light (relay, `ciel`). The five roles are born **from that light**, one per eighth note: Top 7.2, Jungle 7.5, Mid 7.8, ADC 8.1, Support 8.4 (`NX.beats.bells`), each with its brand bell.
- They appear directly at their places on the emblem's pentagon (`NX.G.pent`: centre (960, 441.7), r 200, angles 126/198/270/342/54°, scale 0.62), as the small glass tiles of v7 (same material, role icons, role colours). No labels, no title, no long travel: the tiles must not cross the frame. Speeds stay within §2.6 (objects ≤ 1,000 px/s).
- The fusion of §3.9 follows at once: tiles dissolve into particles of their colour that stream into their own sector of the emblem (ring first, then the rest), a pointillist emblem reads briefly, and E's PNG resolves on the 9.6 hit (E fades its emblem in over 9.48–9.62 under D's particles; D owns its particles until 9.95). Particle speeds: p99.5 ≤ 900 px/s, max ≤ 1,400 px/s.
- It must read on a phone as « five players become one team », in about 2.4 s, beautiful and calm: no strobe, no flash beyond the bible's hit, nothing faster than v6.
- Camera (keys below): nearly still and centred, z 118 → 110, crane up 14 px, tilt 0.1° → 0.4°.

**S7b Outil 3 « 03 · DRAFTER » (20.4–24.0, `outils.js`):**
- Same choreography grammar as S7: the card advances in the stack on 20.4 (ADVANCE) while card 2 is taken up into the light; rows rise as it advances; micro-events land on drop kicks and snares; rows sink just before the card is taken up at about 23.9; the planning card advances on 24.0.
- Title column: kicker « 03 · DRAFTER » (the odometer rolls 02 → 03, the verb sinks and the next rises), title « Compose ta / draft. » with « draft. » spectral, like the other titles.
- Card copy, from the product's draft workspace (`src/pages/workspace/DraftWorkspace.jsx`, `workspace-shared.jsx`) and the public demo team (`src/pages/public/demo-data.js`): header « Composition principale », badge « Très maîtrisée » (product mastery label, green tone like « Victoire »), sub-line « Équipe Horizon · démo fictive », counter « 5/5 champions ». Five rows, one per role, with the same role icons as S3′: TOP Gnar « Confiance », JGL Vi « Confiance », MID Ahri « Situationnel », ADC Jinx « Confiance », SUP Braum « Confiance » (product tier labels). That set scores « Très maîtrisée » in the product's own formula. Never use champion images or any Riot artwork: text and our role icons only.
- Micro-events: the five picks land one per drum hit (counter 1/5 → 5/5, frame-quantised), then the badge pops (SPRING). Each row must stay readable at phone size (row text at least about 26 px on screen).
- The stack now holds four cards; only three are visible at a time (the fourth enters the back slot when the first leaves). Card 3 lifts into the light like cards 1 and 2. The last card (planning) is still the one burned by the end front.

**Camera keys v7.1 (`scenes/camera.js`):**
```js
z:     [[-1,-126],[0,-90],[3.6,54],[4.8,90],[6.6,126],[7.2,118],[9.6,110],[11.4,128],[13.2,50],[14.6,-30],[16.8,-12],[20.4,4],[24.0,22],[27.2,40],[27.6,40],[28.8,24],[32.4,70],[33.2,70]]
x:     [[-1,0],[13.2,0],[14.8,-50],[27.2,50],[28.8,0],[33.2,0]]
y:     [[-1,30],[0,24],[4.5,-4],[4.8,-6],[7.2,-16],[9.6,-30],[12.4,-40],[13.2,-44],[14.6,-24],[27.2,-20],[27.6,-20],[28.8,-10],[32.4,-16],[33.2,-16]]
yaw:   [[-1,-1.6],[0,-1.4],[4.5,0.15],[4.8,0.2],[7.2,0],[9.6,0.2],[13.2,0],[14.8,1.4],[27.2,-1.4],[28.8,0],[33.2,0]]
pitch: [[-1,-0.5],[0,-0.4],[4.5,0],[7.2,0.1],[9.6,0.4],[12.4,0.6],[13.2,1.0],[14.6,0.3],[27.2,0.2],[28.8,0],[33.2,0]]
punch: 4.8: 24, 9.6: 24, 13.2: 16, 27.6: 24
```
Reveal window for the dolly limit (≤ 150 px/s): 13.2–14.6. Orbit (≤ 1.6°/s): 13.2–28.8. Rest on the last frame (32.4).

**Music (`audio.js`, all anchored on `NX.T`):** role bells on eighth notes from 7.2 with short whooshes and eighth-note hats up to the fusion; the team pulse is gone; fusion pad, riser and reverse into the 9.6 impact as before. The groove runs six full bars (D, B♭, F, C, B♭, C: the last two lead into the D major of the end card); tool-change whooshes and bells on 16.8, 20.4 and 24.0 (A5, C6, E6).

**Beats (`NX.beats`):** `bells` = 7.2, 7.5, 7.8, 8.1, 8.4 (roles) then 16.8, 20.4, 24.0 (tool changes); `lightKicks` = 10.8, 12.0 (S5 beam draws, beam pulse); `dropKicks` / `dropSnares` over six full bars from 13.2; `chimes` from 27.6.

**Verification windows v7.1 (§6):**
- §6.5 metrics: hits 4.8, 9.6, 13.2, 27.6. Roles 7.0–9.5 mean Y ≥ 15. Darkening guard of S5 over 10.45–12.7 ≥ 17.1. Hand-over dips (≥ 15): 16.45–16.7, 19.95–20.45 and 23.55–24.05.
- §6.8 determinism times: 4.8, 4.95, 7.2, 8.4, 9.6, 13.2, 16.8, 27.6.
- Readability: S5 title as in v7 shifted −4.8 s; tools titles at least 2.4 s each once complete; the hook's three lines complete by about 3.4 s and readable until the burn.

---

## 1. Concept and signature moments

**Concept.** One continuous camera drifts through the luminous nebula. The light from above is the film's only actor and follows four rules:
- It **writes** the logo.
- It **burns off** what it replaces.
- It **takes up** what is finished.
- It **sends down** what comes next.

One material is shared by every object of both halves: dark glass with a cyan rim lit from above and a fuchsia bounce. The five role tiles and the three tool cards are made of it, so the film reads as one art direction at the level of objects, not only through the sky.

Quality comes from four things: continuity (every hand-over is one motivated gesture), depth (camera parallax, dust, raised layers), light on objects, and precise timing. It never comes from speed. Every message is held at least as long as in v6.

**The light's journey, one chain with no cut:**
1. The question.
2. The light writes NXT5.
3. The logo is taken into the light, and five lights mark the slots.
4. The players step into their light, one per bell.
5. The team is linked.
6. The five gather into a circle; the link becomes the emblem's ring.
7. The players become light; the emblem is born.
8. A beam rises: « direction ».
9. The emblem condenses into its spear and rides the beam up into the light.
10. The light comes back down on the drop and ignites the glass tools.
11. Each finished tool rises into the light while the next advances.
12. The emblem comes back down and docks.
13. The light writes NXT5 again and burns the tools away.
14. The end card arrives on the chimes, and the camera comes to rest.

### Signature moments

1. **« La lumière écrit NXT5 » (4.20–5.05).**
   - Order of events:
     - From 4.0, the lockup glows faintly behind the question as a light silhouette.
     - A light front descends from the ray source, with an elliptical arc that is nearly flat across the text.
     - It writes the emblem above the question (4.42–4.67), then burns the question line by line (4.49–4.85) while it writes NXT5.
   - On the 4.80 hit, the emblem is complete and crisp. Its core flashes with one anamorphic streak, and the white-hot band is writing the letters.
   - Prototyped: `hook-sheet-v3.png`, `stills-hook3/`.
2. **« Cinq deviennent un » (12.30–14.40).**
   - The five glass tiles glide into a circle around the future emblem.
   - The light line that linked them (10.8) relaxes into the emblem's own ring at its measured radius.
   - Each tile dissolves into about 1,000 particles of its colour. The particles stream into their own sector of the emblem: Top cyan lower left, Mid white the spear, Support fuchsia lower right.
   - The ring locks first, then a shimmering pointillist emblem reads for 0.24 s before the PNG resolves on the 14.4 hit.
   - Prototyped: `fusion-sheet.png`, `stills-fusion2/`.
3. **« La flèche monte, la lumière redescend » (17.40–18.10).**
   - The emblem condenses into its spear and rides the « direction » beam up into the source.
   - On the 18.0 drop, the light comes straight back down. The beam hits the front glass card, which powers on: its rim ignites, light washes the glass and its content lights up. The hero is complete on the drop frame.
   - Prototyped: `drop-sheet.png`, `stills-drop/`.
4. **« Le retour » (28.00–29.30).**
   - The emblem comes back out of the source, grows down the axis and docks pixel-exactly into the final lockup on 28.8.
   - In the same pass, the light front writes NXT5 under it and burns the tools act away. The burn edge leads the write edge by 100 px, so old and new never overlap. This is the bookend of moment 1.
   - Prototyped: `end-sheet.png`, `stills-end2/`.

### What stays from v6 and from what the owner liked

- The opening: same two centred lines, same word cadence, readable at least as long as v6. The camera moves from frame 1 (v1 note « pas un plan fixe »).
- The roles land one per bell, and the fusion is now the centrepiece.
- Every transition is now a motivated gesture (« une transition comme pour les autres »). There is no crossfade and no dark gap.
- The same layouts and type sizes, title left and card right in the tools act, the same end card, frame-quantised counters, and one sky in every frame.

---

## 2. Motion language

### 2.1 Easing vocabulary (only these eight, plus tracks)

| Name | Definition | Used for | Duration |
|---|---|---|---|
| ENTER | `NX.ease.enter` = `NX.bezier(0.16,1,0.3,1)` | type rising through line masks; label tracking; UI rows; button clip | 0.8 s titles; 0.5–0.6 s UI, end lines, labels |
| EXIT | `NX.ease.exit` = `NX.bezier(0.7,0,0.84,0)` | type leaving upward through masks; card rows leaving | 0.30–0.35 s titles; 0.25 s rows |
| GLIDE | `NX.ease.glide` = `NX.bezier(0.33,0,0.2,1)` | objects changing place: tile rise from depth, tile lift, emblem dock, spear mask, hairline | 0.3–1.05 s |
| ADVANCE | `NX.ease.advance` = `NX.bezier(0.2,0.9,0.25,1.06)` | stack cards moving forward (about 2% overshoot) | 0.74 s |
| SPRING | `NX.ease.spring(p, 1.0, 6.2)` | tile stand-up (6.9% overshoot, settled by 0.5 s); badge, disc and number pops | 0.9 s tiles; 0.5 s pops |
| LIFT | `NX.ease.lift` = `NX.bezier(0.45,0,0.75,0.6)` | anything taken up into the light; end slope 1.6, so it leaves with speed but no snap | 0.48–0.6 s |
| SHEEN | `NX.ease.sheen` = `NX.bezier(0.45,0,0.25,1)` | glints and sweeps | 0.6–0.7 s |
| SINE | `NX.ease.sine` = `p => 0.5 - 0.5*Math.cos(Math.PI*p)` | link line, direction beam, gather, odometer, breathing, rays focus, particle angle | — |
| tracks | `NX.track(keys)` (monotone cubic, kit) | camera channels and the two light fronts | — |
| particles | radius `inOutCubic`, angle SINE | fusion flights only | 0.55–0.8 s |

**Forbidden curves:**
- `outBack` and `outElastic` on any text.
- `NX.ease.whip` and `snappy`.
- ENTER on object travel above 60 px: an expo-out start is a snap.
- Linear on anything except dust.
- Blur-in or blur-out on any text or logo. v6's generic gesture is gone.

### 2.2 Standard durations and cadence

- **Titles (96 px):**
  - Word rise 0.8 s, stagger 0.14 s. The hook keeps v6's 0.16 s on line 1.
  - Word exit 0.30–0.35 s, stagger 0.05 s.
- **UI rows:** rise 0.5 s, stagger 0.07 s. Leave 0.25 s, stagger 0.03 s.
- **Transitions:** every hand-over component is 0.8 s or less, including front passes, which are under 0.8 s over the visible content. The only longer movement is the fusion gather (1.05 s), which is a formation inside the fusion window, not a hand-over.
- **Overlap choreography:** the outgoing and incoming layers overlap by 0.05–0.15 s. No moment without a readable message lasts more than 0.3 s.
- **Holds:** never shorter than v6. Measured windows are listed per shot in §4.

### 2.3 Entrance and exit grammar

| Element | Enters | During the hold | Leaves |
|---|---|---|---|
| Titles and claims (Inter 800, 96 px, -0.032em) | Words rise through `.tz-line` masks (ENTER 0.8, stagger 0.14) | One SHEEN pass over the spectral word. The hook also gets the tracking settle. | Words sink upward through the masks (EXIT). Exception: the light front burns the hook question (4.8) and the S8 title and card (28.8). |
| Kicker (Inter 700, 32 px, .28em, cyan) | 48×2 px primary hairline draws (GLIDE 0.35); text tracks in from .6em to .28em with opacity (ENTER 0.5) | — | Digit odometer (SINE 0.45); the verb sinks and the next verb rises |
| Role labels (Inter 700, 34 px, uppercase) | Track in from .6em to .2em with opacity (ENTER 0.58) | — | Fade 12.55–12.80 at the start of the gather |
| Glass role tiles | Materialise in their light, standing up from rotateX 55° (SPRING) out of depth (z −120 → 0, GLIDE) | 4 px breathing wave | Dissolve into particles (fusion) |
| Glass tool cards | Card 1 powers on at the drop. Cards 2 and 3 advance in the stack (ADVANCE). | Reflections slide with the orbit; rim pulses on snares | Cards 1 and 2 are taken up into the light (LIFT). Card 3 is burned by the final front. |
| Card content | Card 1: lights up with the glass on 18.0. Cards 2 and 3: rows rise (ENTER 0.5) as the card advances. | Counters, pops and wipes on drum hits | Rows sink (EXIT 0.25) just before the card lifts. Card 3: burned. |
| Logos (lockup, emblem) | Only by light: front writing, pointillist resolve, docking | One glint per hold (bright-mask sweep, fx spill and one star) | Only into light: recede and brighten (S2), condense to the spear and rise (S5), or stay (S9) |
| Light | Fronts descend from the ray source. Beams always start at the source. Particles converge before an impact and release after it. | Dust rises toward the source | — |

**Logo rules (brand):**
- Logos may be masked, moved in depth, uniformly scaled and lit through bright-mask leaves.
- Never rotate them in 3D, skew, recolour, outline, overlay rings, or apply a CSS `filter` (no blur, brightness or drop-shadow). Glow comes from separate halo divs and canvas light.
- Added light on bright pixels is at most 0.30 (plus-lighter, cold white) and decays by 0.3 s. That is the 1.4× brightness overshoot cap.

### 2.4 Camera rules

The film is one take. The camera never cuts, never shakes and never stops: at any time at least one channel is moving.

- **Conventions:** kit `NX.cam`, D = 2000. +z dollies in, +yaw pans right, +pitch tilts up, negative y cranes up. Roll stays at 0.
- **Dolly:** at most 75 px/s, or 150 px/s between 18.0 and 19.4 (reveal).
- **Pan and tilt:** at most 0.8°/s, except the orbit (truck plus counter-pan), which may reach 1.6°/s.
- **Subjects:** drift on screen during holds stays at or below 60 px/s (measured ≤ 36).
- **Scale:** the text plane stays within 0.95–1.08. Titles are never below 91 px on screen (hook minimum 0.951 × 96 = 91.3 px).
- **Safe frame:** content edges stay at least 154 px from the sides and 86 px from the top and bottom at every camera extreme (camcheck, §6).
- **Intent:** push in on intimate beats (hook, fusion, end card); pull out on reveals (team, tools); orbit through the tools act so that reflections slide.
- **Impacts:** a smooth dolly accent, `amp·(τ/0.12)·e^(1−τ/0.12)` (24 px at 4.8, 14.4 and 28.8; 20 px at 18.0). It peaks 0.12 s after the hit at about 1.2% scale and is gone by 0.8 s. `NX.post.shake` is always 0.
- **End:** the camera comes to rest on the last frame (zero velocity at 33.6).

### 2.5 Beat usage

| Beat | Times | Gets |
|---|---|---|
| Impacts | 4.8, 14.4, 18.0, 28.8 | The hero complete and crisp on the beat frame, plus one restrained hit accent: a core flash, one anamorphic streak (k ≤ 0.6, decay 3/s, no ghosts), the rays surge and the camera accent. The shockwave (sky refraction plus dust ring) is used at 14.4 only. |
| Role bells | 7.2, 7.8, 8.4, 9.0, 9.6 | That tile becomes face-on on the bell, its light beam flashes (0.35 s) and its backlight swells. Nothing else: no rings, no sparks. |
| Tool bells | 21.6, 25.2 | A sheen sweep and a rim flare on the arriving card |
| Light kicks | 10.8, 13.2, 15.6, 16.8 | 10.8 the link line draws; 13.2 the link pulses; 15.6 the direction beam draws; 16.8 the beam and glow pulse |
| Drop kicks and snares | `NX.beats.dropKicks`, `NX.beats.dropSnares` | UI micro-events (badge, counters landing, discs, slots); rim gain ×(1 + 0.25·beatPulse(snares, 7)) |
| Chimes | 29.4, 29.7, 30.0, 30.3, 30.6 and bell 31.8 | Button, line 1, (line 2 removed 7 Oct: the chime sounds under line 1), lockup glint, button glint, final soft star |
| Hats | — | Nothing. Exception: the 26.1 accented hat lands the Wednesday slot. |
| Risers and reverses | 3.6–4.8, 12.3–14.4, 15.6–18.0, 27.6–28.8 | Anticipation: rays swell, dust accelerates toward the light, cores grow |

v6's sky groove pulse in the drop is kept unchanged (approved, sky only). New beat accents change frame luminance by 10% or less and never pulse text.

### 2.6 Speed limits and restraint quotas

- **Speed limits:**
  - Objects: peak screen speed ≤ 1,000 px/s, and ≤ 600 px/s while they carry readable text.
  - Particles: 99.5th percentile ≤ 900 px/s, maximum ≤ 1,400 px/s.
  - Line and beam heads: ≤ 800 px/s.
  - Light fronts: ≤ 1,600 px/s. They must carry a band of 60 px or more and glow, so they read as light.
- **Quotas:**
  - One glint or sweep per hold per object.
  - One shockwave in the film (14.4).
  - Sparks only at the two light writings (4.8 and 28.8).
  - No rings anywhere.
  - Anything drawn over text that is still being read stays at alpha ≤ 0.25.
  - Every new effect must replace an existing one.

### 2.7 Forbidden

**Composition:**
- Near-black, empty or uniformly washed frames.
- A frame whose only element is an empty glass panel or a lone line.
- Double exposure of copy.
- Half-eaten words lasting more than 0.15 s.

**Effects:**
- Rings or shockwave circles drawn on canvas.
- Lens ghosts, RGB split, `NX.post.chroma`, `glitch`, `blur` or `exposure`.
- Full-frame CSS filters, `backdrop-filter`, large-blur `box-shadow` (blur > 40 px) on cards.
- Per-particle canvas strokes or `drawImage` above 500 particles. Use `NX.px`.

**Text and logos:**
- Text planes tilted beyond 10° while being read.
- Logos rotated in 3D.
- `will-change` on title words.

**CSS 3D:**
- `opacity`, `filter`, `mask`, `clip-path` or `overflow` on any `preserve-3d` container. Fade leaves only.
- Coplanar overlays without an explicit `translateZ` of 1–4 px.

**Determinism:**
- `Math.random`, `Date`, CSS transitions or animations.
- Caches that depend on the first `t` rendered.
- Calling `NX.cam.at(other t)` inside `render`.

---

## 3. Shared systems (build first, engine level)

All of these are WP-A unless stated otherwise. Costs below are measured per sub-frame (render plus CDP PNG capture, one page, idle 4-core machine). v6 references: 448–950 ms depending on t (Appendix C).

### 3.1 Scene lifecycle: fonts, images, `prepare()`

**Files:** `boot.js`, `engine.js`, `ENGINE.md`.

**Why.**
- `NX.layout()` currently measures before Inter 700 and 800 are loaded (verified by the TD). Spectral boxes come out 13–16% too wide: « comprendre ton équipe » measures 1,211 px against 1,045 px.
- Images created with `NX.image()` are not in `document.images`, so sampling can run on an undecoded image.

**Change in `boot.js`:**
```js
await Promise.all([400, 600, 700, 800, 900].map(w => document.fonts.load(`${w} 100px Inter`)));
// decode every <img> in the DOM plus the NX.image registry, before layout
await Promise.all([...document.images, ...NX.imageRegistry()].map(i => i.decode().catch(() => {})));
NX.layout();
for (const s of NX.scenes) if (s.prepare) await s.prepare(s.root, s);   // new hook
NX.render(0);
```

**New scene key:** `prepare(root, self)`, which may be async.
- All sampling, bright masks, particle tables, spark tables and `NX.light.when()` emission times are built here, once, from assets and fixed seeds only.
- `render()` must never build caches.
- `prepare()` may call `NX.cam.at()` for any t. `NX.render` re-evaluates the camera for the current frame before any scene renders.

**Kit addition:** `NX.imageRegistry()` returns the `NX.image()` instances.

**Determinism and cost:** caches are independent of render order; zero cost per frame.

### 3.2 Camera rig and sky coupling

**Files:**
- `kit.js`: punch shape and `NX.sky`.
- `scenes/camera.js` (new, WP-B): the key table.
- `scenes/ciel.js` (WP-B): consumes `NX.sky`.
- `scenes/index.js` (WP-A): load order.

**Punch (kit), replacing the current two-frame impulse:**
```js
NX.punch = (t, h, amp, tp = 0.12) => (t < h ? 0 : amp * ((t - h) / tp) * Math.exp(1 - (t - h) / tp));
```

**Keys (`scenes/camera.js`, loaded right after `style`, not an `NX.scene`):**
```js
NX.cam.set({
  z:     [[-1,-126],[0,-90],[3.6,54],[4.8,90],[6.6,126],[7.2,118],[9.6,0],[12.6,30],[14.4,110],[16.2,128],[18.0,72],[19.4,-30],[21.6,-12],[25.2,14],[28.4,40],[28.8,40],[30.0,24],[33.6,70],[34.4,70]],
  x:     [[-1,0],[4.8,0],[7.2,-30],[9.6,30],[12.0,0],[18.0,0],[19.6,-50],[28.4,50],[30.0,0],[34.4,0]],
  y:     [[-1,30],[0,24],[4.5,-4],[4.8,-6],[7.2,-16],[9.6,-10],[12.6,-10],[14.4,-30],[17.2,-40],[18.0,-44],[19.4,-24],[28.4,-20],[28.8,-20],[30.0,-10],[33.6,-16],[34.4,-16]],
  yaw:   [[-1,-1.6],[0,-1.4],[4.5,0.15],[4.8,0.2],[7.2,-0.5],[9.6,0.5],[12.0,0],[14.4,0.2],[18.0,0],[19.6,1.4],[28.4,-1.4],[30.0,0],[34.4,0]],
  pitch: [[-1,-0.5],[0,-0.4],[4.5,0],[7.2,0.1],[9.6,0],[12.6,0],[14.4,0.4],[17.2,0.6],[18.0,1.0],[19.4,0.3],[28.4,0.2],[30.0,0],[34.4,0]],
}, { 4.8: 24, 14.4: 24, 18.0: 20, 28.8: 24 });
```
- The −1 keys put the camera in motion on frame 0.
- The keys at 34.4 make the velocity zero at 33.6.

**What each segment does:**

| Window | Movement |
|---|---|
| 0–4.5 | Push in about 38 px/s with a crane up, a tilt up of 0.4° and a pan right of 1.55° |
| 4.5–4.8 | The push eases (inhale) |
| 4.8–7.2 | Slow push to 6.6, then the camera eases back as the logo is taken into the light; drift left to frame Top |
| 7.2–9.6 | Follow pan left→right while dollying out 118 px (peak 67 px/s) to reveal the team |
| 9.6–12.6 | Re-centre |
| 12.6–14.4 | Gentle push and crane up into the fusion |
| 14.4–16.2 | Nearly still (+18 px) |
| 16.2–18.0 | Slow pull back of 56 px (peak 52 px/s); from 17.2 a tilt up following the spear |
| 18.0–19.4 | Pull back 100 px and tilt down following the light (reveal) |
| 19.6–28.4 | One orbit: truck x −50 → +50 with counter-pan +1.4° → −1.4° (0.32°/s) |
| 28.4–30.0 | Unwind to frontal |
| 30.0–33.6 | Final push, then rest |

**Measured with the kit maths (scratch check, §6):**
- Peak dolly 108 px/s at 18.62, inside the reveal window. Outside it, every segment stays at or below 67 px/s (monotone tracks peak at about 1.5× the segment average; check this whenever you move a key).
- Peak pan 1.31°/s (orbit unwind at 29.2).
- Peak tilt 0.74°/s.
- Subject drift ≤ 36 px/s in every hold.
- Every content box stays inside the 8% safe frame. Tightest: tools card at 18.1 and tools title at 28.5, both 9 px inside the limit.

**`NX.sky` (kit; the only formula that couples sky and camera):**
```js
NX.sky = {
  at(t) { const c = NX.cam.at(t), R = Math.PI / 180;
    return { zoom: (1 + 0.10 * NX.smooth(0, NX.DURATION, t)) * (1 + 0.00008 * c.z),
             cx: -1.85 * Math.tan(c.yaw * R) - 0.18 * c.x / 1080,
             cy: -1.85 * Math.tan(c.pitch * R) + 0.18 * c.y / 1080 }; },
  src(t) { const s = NX.sky.at(t);          // screen px of the ray source (rayX 0, rayY 0.6)
    return { x: 960 + 1080 * s.cx, y: 540 - 1080 * (s.cy + 0.6 * s.zoom), zoom: s.zoom }; },
};
```
- 1.85 = 2000/1080: a sky at infinity moves with pans exactly like the content does.
- The 18% truck parallax gives depth.
- `NX.sky.src` reads only `t`, so it is pure and usable from `prepare()`.

**Ownership rule:**
- `ciel.js` is the only writer of `NX.bg` and `NX.post`, and the only caller of `NX.dust.draw`.
- Scenes own the DOM, `#fx` and `#fxback` drawing of their own elements.

**Cost:** the CSS 3D camera is about 0 ms.

### 3.3 Elliptical light front (write and burn)

**Files:**
- `kit.js`: `NX.light` v2. The current flat helpers stay for compatibility, unused.
- `shader.js`.
- `engine.js`: `BG_DEFAULT` gets `frontR` instead of `frontY`.
- `scenes/style.js`: the two tracks.

**Geometry.** The front is an ellipse centred on the ray source `NX.sky.src(t)`. Its horizontal semi-axis is K = 2.5 times its vertical one, with vertical radius R(t) in screen px. It reads as light descending from the source, gently curved.

A circle was tried first (prototype `hook-sheet.png`). Its edges lagged about 300 px behind the centre, which left half-eaten words at the ends of the question for 0.3 s. The ellipse limits the lag to about 60 px (`hook-sheet-ellipse.png`).

**API (kit):**
```js
NX.light.K = 2.5;
NX.light.src(t)                          // = NX.sky.src(t)
NX.light.dist(x, y, s)                   // Math.hypot((x - s.x) / K, y - s.y): elliptical distance in screen px
NX.light.local(X, Y, Z, R, t)            // front in the local space of a flat element whose top-left is world (X,Y,Z):
                                         // o = NX.cam.project(X,Y,Z); s = src(t); -> { cx:(s.x-o.x)/o.s, cy:(s.y-o.y)/o.s, r:R/o.s }
NX.light.localCard(o, sCentre, R, t)     // rotated card: o = projected local origin, sCentre = projected scale at the card centre
                                         // (error under 7% on a 10° card, hidden by the band)
NX.light.mask(L, mode, { feather, lead }) // CSS gradient string, RM = 3000 px, shape `ellipse ${K*RM}px ${RM}px at cx cy`
     // 'write': #000 at (r - feather)/RM, transparent at (r + 10)/RM       -> visible above (inside) the front
     // 'burn' : transparent at (r + lead - 10)/RM, #000 at (r + lead + feather)/RM -> erased inside the front
NX.light.write(el, L, { feather = 70, extra })   // extra: more mask layers, combined with mask-composite: intersect
NX.light.burn(el, L, { feather = 60, lead = 0 })
NX.light.band(L, lead = 0)               // background for the white-hot band leaf:
     // transparent r-170, rgba(150,215,255,.28) r-70, rgba(200,240,255,.75) r-18, #fff r-3, transparent r+12
NX.light.when(track, X, Y, Z, { off = 0, t0, t1 })  // first t (5 ms steps) with track(t) + off >= dist(project(X,Y,Z,cam(t)), src(t)); prepare() only
NX.light.wordGlow(words, worldCentres, R, t, lead)  // per word: g = exp(-((R + lead - d)/70)^2);
                                                    // textShadow `0 0 ${10+26g}px rgba(165,243,252,${0.85g})`, cleared when g < 0.03
```
Percentages in an elliptical gradient scale both radii, so `(r ± f)/RM` gives a vertical radius r ± f and a horizontal one K·(r ± f). This is verified in the prototype.

**Tracks (`style.js`, screen px of vertical radius):**
```js
NX.FRONT = {
  hook: NX.track([[4.20,40],[4.42,392],[4.52,520],[4.80,735],[5.02,960],[5.30,1090],[5.55,1115]]),   // burn lead 0
  end:  NX.track([[28.30,120],[28.55,330],[28.80,560],[29.10,880],[29.45,1200],[29.80,1300]]),       // burn lead 100
};
```

**Shader (`shader.js`, rays block).** Replace the horizontal front with an elliptical band around the ray source. `d` is already `q - uRayPos`:
```glsl
if(uFront>0.001) col += spectrum(tri(.25+dir.x*.22+uHue*.5))*s*fallr*exp(-pow((length(d*vec2(.4,1.))-uFrontR)/.09,2.))*uFront*.9;
```
- Rename the uniform `uFrontY` → `uFrontR` in the shader source and in its `names` list; `draw()` passes `B.frontR`.
- `ciel` sets `NX.bg.front` (envelope) and `NX.bg.frontR = R / 1080 / zoom`.
- Effect: a pulse of light travels down the rays exactly where the front is.

**Burn lead.** The burn edge may lead the write edge so that old and new content never overlap:
- Lead 0 at 4.8, where readability comes first. The 60 px write feather already trails.
- Lead 100 px at 28.8, where the UI is dense. Validated in `stills-end2/`: no NXT5-over-card double exposure.

**Determinism and cost:** a few gradient strings per frame. The hook moment measured 847 ms against v6's 947 ms (cheaper, because there is no 14 px CSS blur any more).

### 3.4 Logo light leaves

**File:** `kit.js` (`NX.logoLight` v2).

**Why.**
- `mask-mode: luminance` is nearly invisible on this PNG (lead feasibility test).
- An alpha mask bleeds onto the dark plate.
- The kit's canvas bright mask works but is faint without additive blending (TD: forge at 1.0 adds only +3/255).

**Structure.** `NX.logoLight(box, src)` builds these leaves inside a flat, positioned box. All light leaves use `mix-blend-mode: plus-lighter` and `mask-size: 100% 100%`, and are lifted with `translateZ(1–4px)`.

| Leaf | Mask | Content | Use |
|---|---|---|---|
| `forge` | bright mask ∩ `NX.light.mask(L,'burn')` (`mask-composite: intersect`, `-webkit-mask-composite: source-in`) | `rgb(205,245,255)` | Silhouette: the full logo as cold light where the chrome is not yet written |
| `img` | `NX.light.mask(L,'write')` (∩ gate at S9) | the PNG | The chrome, written by the front |
| `hot` | bright mask | `NX.light.band(L)` | White-hot band riding the front on bright chrome |
| `lum` | bright mask | `rgb(200,240,255)` | Hit overexposure (≤ 0.30, `e^(−6τ)`); glow while taken into the light |
| `sweep` | bright mask | 34%-wide band moved with `translateX(−110% → 300%)` | The one glint per hold (SHEEN 0.65 s) |

- **Bright mask:** `alpha × smoothstep(0.35, 0.65, luma)`, built once into a data URL. This is the existing `brightMask()`.
- **Built in `prepare()`:** `L.layout()`, which exposes `L.url`.
- **Every glint is paired with:**
  - an unmasked fx spill: a soft vertical band, 30% of the box wide, alpha 0.06, following the sweep;
  - one `NX.lk.star` at an anchor when the band centre crosses it (lockup spear tip u .498 v .107; top right of the 5 u .86 v .46; emblem spear tip u .494 v .102).
- **Halos:** radial-gradient divs behind the logo (v6 style). Never a `drop-shadow` filter.

**Cost:** about 0 ms per leaf (verified in the prototype).

### 3.5 Hit accent

**File:** `kit.js`.

```js
NX.hit(t, h, x, y, { flare = 0.6, core = 420, coreA = 0.4, tint = [103,232,249], width = 1 } = {})
// for τ = t - h in [0, 1.5): NX.lk.glow(x, y, core*s, [200,240,255], coreA*e^(-5τ)) and
// NX.lk.flare(x, y, flare*e^(-3τ), { tint, width, ghosts: false }). x, y are screen coordinates of the hero core.
```
- `NX.lk.flare`'s ghosts default to `false`.
- `NX.lk.ring` stays in the kit but is forbidden in the film.
- Rays surge, intensity, the push accent and the dust gust are in `ciel`/camera, not here.

### 3.6 Depth dust (existing; usage only)

**File:** `kit.js` (`NX.dust`, unchanged). Called by `ciel.js`.

Options per window:

| Option | Value |
|---|---|
| `gain` | 1.0 until 18.3, eased to 0.75 for 18.3–28.4 (less noise around UI), 0.9 from 28.8 |
| `drift` | 1 + 0.6 during the swells 3.6–4.8, 16.8–17.98 and 27.6–28.8 |
| `gusts` | `{t0:4.8, x,y: S2 ring centre, amp:30}`, `{t0:13.8, x,y: C, amp:-20}` (pull), `{t0:14.4, C, 30}`, `{t0:18.0, card-1 corner, 24}`, `{t0:28.8, docked ring centre, 30}` |
| `wave` (14.4 only) | `{x,y: C screen, R: 60 + 1100·outCubic(τ/1.1), w:40, gain:2.5}` for τ in [0, 1.1] |

Positions come from `NX.G` through `NX.cam.project`. Cost: about 10 ms.

### 3.7 Glass material

**File:** `kit.js` (`NX.glass` exists).

**Additions:**
- `NX.glass(html, { w, h, color, wash = false })`. `wash` adds `.gl-wash`: plus-lighter, `linear-gradient(170deg, rgba(170,220,255,.38), rgba(170,220,255,.10) 45%, transparent 75%)`, `translateZ(4px)`, opacity 0.
- `NX.glassLight(g, { pos, lit, rimAngle, rimGain, fog, glow, wash, vis = 1 })`. Fog, glow, sheen and rim are multiplied by `vis`. In the prototype, the back cards' fog showed as dark panels before the stack existed.
- `NX.glassFade(g, a)` sets the shadow, glow, plate, content, sheen, rim and wash opacity, each times `a`. It is the only way to fade glass.

**Look values (validated in `stills-deal3/`, `stills-drop/`):**
- Plate gradient as in the kit.
- Rim `linear-gradient(var(--rim), rgba(186,240,255,.75), rgba(129,140,248,.22) 30%, rgba(154,182,218,.10) 65%, rgba(232,121,249,.30))`.
- `--rim = 180deg + 6·cam.yaw`.
- Sheen band position = `−0.43·cam.yaw` (±0.6 across the orbit), plus event sweeps from 1.1 to −0.1.
- Shadow leaf instead of `box-shadow`.

**CSS hygiene:** prefix classes with the scene id and never reuse a class across scenes. The product-film prototype's "hard sheen seam" came from a duplicated `.eq-sheen` rule.

**Cost:** rim mask and plus-lighter are about 0. The stack hold measured 519–779 ms against v6's 408–465 ms. That is the most expensive passage, within budget.

### 3.8 Type kit

**Files:** `kit.js`, `scenes/style.js`, `engine.css`.

**Existing:** `NX.type.prepare`, `rise`, `sink`, `track`, `sheen`, and `.tz-line` masks padded `.14em .08em .24em` (É, ê, ’, g and p are never clipped).

**Additions and changes:**
- **Remove `will-change`** from `.nx-char,.nx-word` (`engine.css`), `.tz-title .nx-word` (`style.js`) and `.tz-line .nx-word` (`kit.js`). Chrome then re-rasterises text at its real camera scale. Check crispness on 1:1 crops (§6).
- **All titles are `.tz-title`** at 96 px, 800, line-height 1.06, `letter-spacing: -.032em`, including the tools act (v6 used 100 px). Measured widths: hook 1,215 / 1,346 px; « Toute ton équipe. » 777; « Une même direction. » 924; tools lines 683 / 347 / 507 / 405 / 563 / 686.
- **`NX.type.odometer(col, t, a, from, to, dur = 0.45)`:** `col` is a `.tz-odo` inline-block (`height: 1.15em; overflow: hidden; vertical-align: top`) containing the digits 1, 2, 3 stacked. Apply `translateY(−(digit−1)·100%)` with SINE between `from` and `to`.
- **Kicker markup:** `<div class="tz-kicker"><i class="tz-hair"></i><span>0</span><span class="tz-odo"><b>1</b><b>2</b><b>3</b></span><span> · </span><span class="tz-line tz-verb">…three stacked verbs…</span></div>`. The copy reads « 01 · Analyser », « 02 · Débriefer », « 03 · Planifier », uppercased by CSS.

**Cost:** about 0.

### 3.9 Particles: splat buffer, sampling, fusion pairing

**Files:**
- `kit.js` (`NX.px`, `NX.sample`, `NX.sampleSvg` exist).
- The algorithm lives in `scenes/equipe.js` (WP-D).

**Rendering:**
- Anything above 500 points goes through `NX.px`: `begin`, then `blob(x, y, 1.3, r, g, b)` for a 2.6 px core and `line()` for tails, then `end(NX.fx.ctx)`.
- Energy is `k = 1.3/255 · alpha`. 0.5/255 read too dim in the prototype.
- Sparks (240 or 200) may use `fillRect`.

**Fusion pairing (validated, `stills-fusion2/`):**
- **Targets:** `NX.sample(favicon, 5000, 4242, 256, 0.28)` mapped to the S5 emblem box. Ring targets are those with favicon radius 140–190 px from (253.5, 269).
- **Sectors:** five angular sectors around C = (960, 441.7) in screen orientation (y down). Each is centred on its pentagon angle plus SPIN 20° and spans ±36°:

  | Role | Pentagon angle | Sector centre |
  |---|---|---|
  | Top | 126° | 146° |
  | Jungle | 198° | 218° |
  | Mid | 270° | 290° |
  | ADC | 342° | 2° |
  | Support | 54° | 74° |

  Each role gets every target in its sector, so counts vary: Mid gets more because of the spear.
- **Sources:** 85% `NX.sampleSvg(icon, n, 100+k)` and 15% points on the tile perimeter, in tile-local coordinates.
- **Pairing:** sort sources and targets by angle relative to the sector centre, and pair by index.
- **Flight per particle:**
  - Source position at release time: `tile(k, te)` pose (centre and scale, analytic) plus the local offset times scale. There is no jump between tile and particles.
  - `te = rel[k] + 0.08h`, with `rel` = Top 13.45, Jungle 13.40, Mid 13.35, ADC 13.40, Support 13.45.
  - `ta = 14.00 + 0.06h'` for ring targets, else `14.08 + 0.10h'`.
  - `rs, ps` = polar coordinates of the source at `te`; `dp = atan2(sin(pe−ps), cos(pe−ps))`.
  - `r = rs + (re−rs)·inOutCubic(u)`, `φ = ps + dp·sine(u)`, `z = zA·sin(πu)` with `zA ∈ [−60, 160]`.
  - Colour: role colour → target pixel colour over u 0.7 → 1.
  - Tail: line from u − 0.02.
  - Lock sparkle: `+0.8·e^(−12(t−ta))`.
- **Measured:** peak 1,338 px/s; 0.37% of samples above 900 px/s; median well below.
- **First attempt (do not use):** global angular rank pairing with SPIN 40° peaked at 2,377 px/s, with 12% of samples above 900.

**Determinism:** seeded samplers and stable sorts, built in `prepare()`. `NX.px.begin()` clears with `fill(0)`.

**Cost:** fusion 617–682 ms against v6's 501–553 ms.

### 3.10 Shared constants (`scenes/style.js`, frozen after WP-A)

```js
NX.G = {
  hook: { top: 400 },
  LOGO: { W: 1254, H: 989, axisX: 625, ringC: [625, 356], spearTip: [625, 106],
          rows: { emblem: [106, 439], wordmark: [440, 759], tagline: [760, 802] },
          stars: { spear: [0.498, 0.107], five: [0.86, 0.46] } },
  FAV:  { W: 512, ringC: [253.5, 269.0], ringR: 176, ringBand: [168, 186], innerBand: [144, 158],
          arcDeg: [148, 392], spearCols: [0.445, 0.547], spearTip: [253, 52], spearBottom: [254, 415],
          toLockup: { s: 1.1425, x: 335.5, y: 48.5 }, star: [0.494, 0.102] },
  L2:   { left: 560, top: 225, w: 800 },            // S2 lockup, h 631, ring centre world (958.7, 452.1)
  L9:   { left: 650, top: 70,  w: 620 },            // S9 lockup, h 489, ring centre world (959.1, 246.0)
  dock: { left: 815.9, top: 94.0, size: 289.2 },    // favicon exactly over the L9 emblem
  E5:   { left: 732.25, top: 200, size: 460 },      // S5 emblem; ring centre C = (960, 441.7), ring radius 158.1
  roles: { y: 430, x: i => 960 + (i - 2) * 300, tile: 216, icon: 132, labelTop: 562 },
  pent:  { c: [960, 441.7], r: 200, deg: [126, 198, 270, 342, 54], scale: 0.62 },
  tools: { col: { left: 190, top: 360, z: 40 },
           stack: { left: 975, top: 300, w: 830, h: 540, z: -60, rotY: 10, rotX: 2, origin: '0 0',
                    slots: [[0, 0, 0], [0, -46, -150], [0, -92, -300]], fog: [0, 0.42, 0.84] } },
  end:   { buttonTop: 600, line1Top: 770, line2Top: 850 },
};
```
`NX.FRONT` lives here too (§3.3). Scene ids and z order: `ciel −10`, `logo −1`, `accroche 0`, `equipe 1`, `direction 1.2`, `outils 2`, `fin 3`.

---

## 4. Shot list

Conventions:
- τ = t − (named hit).
- "Readable" means every word is fully legible.
- World coordinates are layout px at z = 0 unless a z is given.
- Each scene's window is given in its heading.

### S1 Accroche, 0.00–4.80 (`accroche.js`, window 0–5.6, z 0; silhouette and writing in `logo.js`)

**Layers, back to front:**
1. Sky: nebula 0.58, rays 0.9, `rayStrength` 1 + 0.25·swell(3.6→4.75, released 4.8→5.4).
2. `#fxback` far dust: drift ×1.6 over 3.6–4.8.
3. Logo silhouette (from 4.0).
4. Question block: world top 400, centred, `letter-spacing: -.032em` in CSS (measured at the final value).
5. `#fx`: near bokeh and sparks.

**Camera:** as listed in §3.2. Question scale 0.951 → 1.047 (91–100 px). The subject drifts up to 16 px/s.

| t | Element | Action |
|---|---|---|
| −0.30 + 0.16i (i = 0…3) | Line 1 « Envie d’analyser tes games » | Words rise through the mask (ENTER 0.8). At t = 0, « Envie » is 90% risen. |
| 1.50 + 0.14i (i = 0…5) | Line 2 « et de comprendre ton équipe ? » | Words rise (ENTER 0.8); complete 3.00 |
| 0.20–3.60 | Block | Tracking −0.012em → −0.032em (outCubic) |
| 2.70–3.50 | « comprendre ton équipe » | One sheen (strength 0.35) |
| 4.00–4.50, 4.50–4.80 | Lockup silhouette (`forge`) | Alpha 0 → 0.24 (inQuad), then → 0.30, behind the text |
| 4.20 | Front | `NX.FRONT.hook` starts. From 4.25 the shader band pulses down the rays from the source. |
| 4.42–4.48 | Spear tip | Written above the question |
| 4.49 / 4.54 | Line 1 | Burn starts at the centre, then at the ends. The centre is gone at 4.64 and the ends at 4.72. Glyph glow per word. |
| 4.60 / 4.69 | Line 2 | Burn starts at the centre, then at the ends. The centre is gone at 4.795 and the ends at 4.85. |
| 4.67 | Emblem | Fully written: ring centre at 4.67, lower arcs at 4.745 |

**Typography:** Inter 800, 96 px, line-height 1.06, centred, `#F3F7FF`; « comprendre ton équipe » in `--spectrum-text`.

**Readable:**
- Line 1: 0.45–4.49 (v6 0.5–4.50).
- Line 2: 2.55–4.60 (v6 2.75–4.55).

**Beat sync:** intro ticks are left alone. The reverse swell (3.6–4.8) drives the rays, the dust and the silhouette.

**Transition out:** the front writes the lockup while it burns the question (see S2). There is no gap: the emblem exists from 4.42.

**A/B fallback (decide on the first sheet):** v6 `NX.wordsIn` entrance plus the same camera, dust and writing. Keep the mask rise unless a reviewer finds it less fluid at 0–3 s.

**Acceptance:**
- t = 0.00: « Envie » ≥ 80% risen; the question's scale differs from t = 0.20 by ≥ 0.3% (the camera is already moving).
- 2.90: both lines complete and crisp, with a continuous gradient across the three spectral words.
- 3.10: one sheen band on the spectral words.
- 4.45: silhouette visible but subtle; the question fully readable; the spear tip lit above line 1.
- **4.80 (hit):**
  - The emblem is complete and crisp, with a core flash and a horizontal streak through its centre.
  - The white-hot band is in the upper half of NXT5.
  - Line 1 is gone; only the ends of line 2 remain, glowing.
- 4.95: no question text; NXT5 almost complete.

### S2 Logo, 4.80–7.20 (`logo.js`, window 4.0–7.2, z −1)

**Layers:**
- Halo div (1,300×1,000, v6 gradient).
- Lockup box `NX.G.L2` with the `NX.logoLight` leaves.
- `#fx`: sparks and hit.

**Camera:** push from z 90 to 126 (6.6), easing back to 118 at 7.2; drift x 0 → −30; yaw 0.2 → −0.5. Lockup scale 1.05–1.07 (≈ 840–855 px wide). The core drifts ≤ 36 px/s.

| t | Element | Action |
|---|---|---|
| 4.30–5.40 | `hot` band | Rides the front on bright chrome |
| 4.765–5.015 | Wordmark, then tagline | Written. The lockup is complete at 5.02. |
| 4.80 | Hit | `NX.hit(4.8)` at the ring centre (screen of world 958.7, 452.1): core 420 px, alpha 0.40; flare 0.6. `lum` 0.30·e^(−6τ). Rays surge, push accent 24 px, dust gust 30. |
| 4.45–5.05 | Sparks | 240 points from `NX.sample(lockup, 240, 77, 400, 0.45)`. Emission at `NX.light.when(FRONT.hook)`. Each rises 40–120 px (outCubic) over a life of 0.8–1.5 s, with 6 px noise wobble, 1.5–3 px squares, pixel colour·0.7 + 77, alpha (1−u)². All dead by 6.5. |
| 4.6–5.0 | Halo | Fades in; breath ×(0.6 + 0.4·e^(−3τ)) |
| 5.95–6.65 | Glint | `sweep` (SHEEN), fx spill 0.06, star at the spear tip ≈ 6.20 and at the 5 ≈ 6.45 |
| 6.65–7.15 | Exit: taken into the light | Box `translate3d(0, −120q, −700q)`, q = LIFT(seg(6.65, 7.15)). `lum` +0.45 (6.65–6.95). All leaves and the halo fade 6.90–7.15. |

**Readable and crisp:** 5.02–6.95 (v6 crisp about 5.3–6.75).

**Beat sync:** 4.8 hit. The glint starts just before the 6.0 hat (hats get no accent of their own). The 6.65 whoosh is the exit.

**Transition out:** while the lockup recedes, five lights appear on the slots (S3). The Top tile is face-on on 7.20.

**Acceptance:**
- 5.30: lockup crisp, no blur, no ring, sparks rising.
- 6.30: one diagonal glint mid-chrome with a star.
- 7.00: lockup smaller (~0.8) and glowing, five soft slot lights, the Top tile appearing tilted back.
- 7.20: the Top tile face-on (±4°) with its beam at peak; the lockup gone.
- **No frame in 6.6–7.6 has mean Y below 13 (§6).**

### S3 Rôles, 7.20–9.60 (`equipe.js`, window 6.7–14.8, z 1)

**Layers:**
- Sky lift: `rays` +0.45·L, `nebula` +0.24·L and `intensity` +0.08·L, where L = smooth(6.6, 7.4)·(1 − smooth(10.2, 11.4)). Validated: 7.5 → +2.2 and 8.4 → +3.7 against v6, on the PNG mean-gray scale.
- `#fxback`:
  - Stage glow: ellipse at the row (r 1,050·s, scaleY 0.36, rgb 120/170/255, alpha 0.14·on).
  - Five waiting lights: role colour, r 210·s, alpha (0.22 + 0.24·flash)·on, with onᵢ = smooth(6.80 + 0.08d, 7.10 + 0.08d) and d = |i − 2|.
  - Bell beams.
- DOM: tiles and labels.
- `#fx`: dust bokeh.

**Tiles:**
- `NX.glass` 216×216, colour = role colour at 19%.
- Icon 132 px SVG with a vertical gradient fill (`#fff` .9 → role → role .85) at `translateZ(14px)`.
- `transform-origin: 50% 100%`.
- Tᵢ = 7.2 + 0.6i (Top, Jungle, Mid, ADC, Support).

| t (per role i) | Element | Action |
|---|---|---|
| Tᵢ − 0.25 → Tᵢ − 0.05 | Tile leaves | Opacity 0 → 1 (`NX.glassFade`) |
| Tᵢ − 0.30 → Tᵢ + 0.20 | Tile | y +18 → 0 and z −120 → 0 (GLIDE) |
| Tᵢ − 0.225 → Tᵢ + 0.675 | Tile | rotateX 55°·(1 − SPRING): face-on exactly on Tᵢ, overshoot −3.8° at Tᵢ + 0.11, settled by Tᵢ + 0.5 |
| Tᵢ − 0.12 → Tᵢ, then decay | Bell beam (`#fxback`, behind the tile) | `NX.lk.beam` from the source to the tile centre + 60·s: w0 8, w1 300·s, alpha 0.45·flash. flash = inQuad up to Tᵢ, then e^(−6(t−Tᵢ)). Colour (role + white)/2. |
| Tᵢ | Rim and glow | Rim ×(1 + 0.6·flash); backlight +0.24·flash |
| Tᵢ + 0.12 → Tᵢ + 0.70 | Label | Letter-spacing .6em → .2em and opacity (ENTER). Inter 700, 34 px, uppercase, `--text2`, world top 562. |

**Camera:** follow pan x −30 → +30 and yaw −0.5 → +0.5; dolly out z 118 → 0 (tiles 230 → 216 px, peak 67 px/s). The Top tile's worst margin is 202 px from the left edge at 9.5.

**Readable:** each tile from Tᵢ + 0.15; each label from Tᵢ + 0.5; both until 12.55 (labels) or 13.35 (icons).

**Beat sync:** whooshes at Tᵢ − 0.55 are the tiles rising; bells at Tᵢ make them face-on.

**Transition out:** none. The row holds and S4's title rises at 9.70.

**Acceptance:**
- 7.50 / 8.10 / 8.70 / 9.30: one more tile each, face-on, with a fading beam.
- The waiting lights read as soft orbs, never as hard wedges.
- The mean Y of the 7.0–9.5 samples is ≥ 15.0 (v6 12.9), with no sample below 13.
- 9.90: five tiles and four labels complete; SUPPORT tracking in.

### S4 Équipe and fusion, 9.60–14.40 (`equipe.js`)

| t | Element | Action |
|---|---|---|
| 9.70, 9.84, 9.98 | « Toute ton équipe. » (world top 700, centred, « équipe. » spectral) | Rise (ENTER 0.8); complete 10.78 |
| 9.60–12.30 | Tiles and labels | Breathing y = 4·sin(2π(t−9.6)/2.4 − 0.6i), amplitude faded in and out over 0.4 s |
| 10.50–11.30 | « équipe. » | One sheen |
| 10.80–12.20 | Link line (`#fxback`, behind the tiles) | Polyline through the tile centres in role order, drawn from Mid outward (SINE; head ≤ 720 px/s). Core 2.5 px at alpha 0.85, glow 14 px at alpha 0.22, gradient through the role colours. Each rim flashes +0.8 (decay 6) as the head reaches it: Mid 10.8, Jungle and ADC about 11.5, Top and Support about 12.2. |
| 12.30–12.50 | Tiles | Anticipation: lean 4° toward C (rotateZ), drift 6 px toward C, glow +40% |
| 12.50–13.55 | Tiles | **Gather** (SINE) to the pentagon (`NX.G.pent`), scale 1 → 0.62. Peak 787 px/s (outer tiles). Labels fade 12.55–12.80. Waiting lights follow and fade 13.45–13.75. Stage glow fades 12.5–13.4. |
| 13.20 | Light kick | Link +30% (beatPulse decay 6); rims +0.5 |
| 13.35 / 13.40 / 13.45 | Release Mid / Jungle and ADC / Top and Support | Glass leaves fade over 0.20 s; the icon hands over to its particles in place |
| 13.35–14.18 | Particles | Flights per §3.9. Ring targets lock 14.00–14.06, the rest 14.08–14.18. Peak 1,338 px/s, 99.6% under 900. |
| 13.50–14.00 | Link line | Relaxes (SINE) from the polyline into an arc centred on C: radius 200 → 158.1, angles 148° → 392° (open at the bottom, like the emblem's ring). It never rotates. Fades 14.00–14.20 as the particle arcs replace it. |
| 13.80–14.40 | Core glow (`#fx`) | r (40 + 130g)·s, alpha 0.12 + 0.33g, g = inQuad. Dust pulled toward C (gust −20 at 13.8). |
| 13.90, 13.95, 14.00 | Title | Words sink (EXIT 0.30); gone by 14.30 |
| 14.12–14.36 | Pointillist emblem | Shimmer ×(0.85 + 0.15·sin(φᵢ + 14t)), brightness ×(1 + 0.35·smooth(14.12, 14.36)) |
| 14.40–14.75 | Particles | Burst outward from their targets: bv ∈ [100, 400] px/s, drag 3, alpha 1.4·e^(−6τ). 8% become embers rising 50 px/s with alpha e^(−1.2τ), gone by 16.5. |

**Camera:** re-centre (x 30 → 0 by 12.0), then push z 0 → 30 → 110 and crane y −10 → −30, tilt 0 → 0.4°.

**Readable:**
- « Toute ton équipe. »: 10.26–13.90, 3.64 s (v6 10.5–14.05, 3.55 s).
- Roles recognisable until about 13.40, through the whole gather.

**Beat sync:** 10.8 link; 13.2 pulse; the riser (12.3–14.4) drives the gather and the flights; the reverse (13.6–14.4) the lock and the core.

**Transition out:** the pointillist emblem hands over to the PNG (S5) on the 14.4 hit.

**Acceptance:**
- 11.40: a line joins Mid to Jungle and ADC between the tiles.
- 13.00: tiles about halfway, labels gone.
- 13.55: a clean pentagon of five recognisable tiles linked by the line; the title readable.
- 13.85: five coloured petals of particles converging inside the arc. Mid white at the top, Top cyan lower left, Support fuchsia lower right.
- 14.10: pointillist emblem inside the fading arc; ring arcs formed.
- 14.30: pointillist emblem with its real broken ring arcs; no continuous ring outline; title gone.
- **The first 14.40 sub-frame:** PNG emblem complete and crisp; no ring drawn anywhere.
- Particle speed check passes (§6).

### S5 Direction, 14.40–18.00 (`direction.js`, new, window 14.25–18.1, z 1.2)

**Layers:**
- Emblem box `NX.G.E5` with `NX.logoLight(favicon)` leaves.
- A halo div behind it (radial `rgba(129,140,248,.35)` → transparent, 900 px).
- Title.
- `#fxback`: the direction beam.

| t | Element | Action |
|---|---|---|
| 14.28–14.42 | Emblem | Opacity 0 → 1 (smooth) under the particles |
| 14.40 | Hit | `NX.hit(14.4)` at C: core 400, alpha 0.40; flare 0.6, tint `[167,139,250]`. `lum` 0.30·e^(−6τ). `ciel`: the one **shockwave**, `uWave` (x, y = C; R = 0.05 + 0.95·outCubic(seg(τ, 0, 1.1)); S = 0.025·(1−p)²) plus the dust wave. Rays surge, push 24. |
| 14.55, 14.67, 14.79 | « Une même direction. » (top 700) | Rise (ENTER 0.8); complete 15.59 |
| 14.60–15.60 | Sky | `rayFocus` 0 → 0.45 and `rayStrength` 1 → 1.25 (SINE). The rays converge without darkening (focus is capped at 0.45 for the whole film). |
| 14.60–17.40 | Emblem | Breathes: y −10 px, scale 1 → 1.025 (SINE). Halo +20% on the kicks 15.6 and 16.8 (decay 2.5). |
| 15.30–16.10 | « direction. » | One sheen |
| 15.60–16.50 | Direction beam (`#fxback`, behind the emblem) | Draws from the spear tip (world 960, 246.7 + breath) up to the source (SINE; head ≤ 730 px/s). Two `NX.lk.beam` layers: core w 3 at alpha 0.6k, glow w 24 → 30 at alpha 0.16k, with k = 0.5 + 0.3·beatPulse([16.8], 3) + 0.4·smooth(17.4, 17.95). |
| 16.15–16.85 | Emblem glint | `sweep` (SHEEN), spill 0.06, star at the spear tip ≈ 16.45 |
| 17.20–17.98 | Sky | `rayStrength` → 1.5; dust drift ×1.6 |
| 17.40–17.75 | Emblem → spear | Horizontal soft mask on the box: `linear-gradient(to right, transparent L−3%, #000 L, #000 R, transparent R+3%)`, with L 0 → 44.5% and R 100 → 54.7% (GLIDE). `lum` on the spear 0 → 0.5 (17.45–17.80). Use a soft mask, not a hard `clip-path`: the prototype's clip left cut tick marks. |
| 17.50–17.98 | Spear | Rises 260 px up the beam (LIFT; ≈ 870 px/s at the end). Opacity 1 → 0 over 17.75–17.98. Beam ×1.4. |
| 17.62, 17.67, 17.72 | Title | Words sink (EXIT 0.32); gone by 18.04 |
| 17.90–18.00 | Source | Flare swell (rays +0.4) |
| 18.00 | Direction beam | Off; handed over to the drop beam (S6) |

**Camera:** nearly still (z 110 → 128 by 16.2), then a slow pull to 72 by 18.0 (≤ 52 px/s); from 17.2 a tilt up to 1.0° following the spear. Emblem scale 1.055–1.072.

**Readable:**
- « Une même direction. »: 15.07–17.66, 2.59 s (v6 15.34–17.75, 2.41 s).
- Emblem complete and crisp 14.40–17.40.

**Beat sync:** 14.4 birth; 15.6 beam; 16.8 pulse; the snare roll (16.8–17.85) carries the spear and the source swell.

**Transition out:** see S6 at 18.00.

**Acceptance:**
- 14.60: refraction ripple in the nebula and a brighter dust ring; no drawn circle.
- 15.40: title complete; rays visibly converged.
- **Mean Y of the 15.25–17.5 samples ≥ 17.1 (v6 17.6 − 0.5; darkening guard).**
- 16.00: the beam half drawn.
- 17.60: only the spear remains, with soft edges; the title readable.
- 17.85: the spear high on the beam; the stack outlines visible on the right; the title sinking.

### S6 Outil 1 « 01 · Analyser », 18.00–21.60 (`outils.js`, window 17.7–29.9, z 2)

**Layers:**
- Title column `NX.G.tools.col` at `translateZ(40px)`: hairline, kicker, two title lines.
- Stack `NX.G.tools.stack`: three `NX.glass(830×540, {wash: true})` cards, each with a 4 px primary rule at `translateZ(3px)` and content in `.gl-content`. Padding 48/44 px.

**Card text (v6 size or larger):**
- Header 44 px, 700.
- Sub 28 px.
- Stat label 36 px.
- Value 80 px, 800, `#6EE7B7`, tabular figures.
- Badge 22 px.
- Debrief label 28 px, 700, .2em, cyan; question 44 px, 700; items 40 px; discs 50 px.
- Days 28 px, 700, .12em; slots 30 px plus 24 px, slot padding 12px 6px. « Débrief » fits the 113 px inner column; measured 109 px at 30 px.

**Stat tiles:**
- Background `linear-gradient(180deg, #13233B, #0D1A2D)`, 1 px border `rgba(154,182,218,.16)`, radius 12.
- Small shadow 0 22px 34px −16px.

| t | Element | Action |
|---|---|---|
| 17.80–17.98 | Three card rims | Fade in to 0.25. Outlines only, as anticipation: no plates, no content. That avoids overlapping the S5 title. |
| 18.00 | **Drop: the light comes back down** | Beam (`#fx`) from the source to card 1's top-left corner (projected world 975, 300, −60): w 6 → 40, alpha 0.8·e^(−5τ), colour (210,245,255). `NX.hit(18.0)` at the corner + 60 px along the top edge: flare 0.5, width 0.5, core 160 at alpha 0.3. Card 1's plate and content go 0 → 1 over 18.00–18.10 (power on). Wash e^(−5τ). Rim ×(1 + 1.5·e^(−3τ)). `ciel`: rays surge, `rayFocus` 0.45 → 0 by 18.30 (the light bursts open), push 20, dust gust from the corner. |
| 18.05–18.25 | Back cards | Plates fade in under fog 0.42 / 0.84; rim ×(1 + 0.6·e^(−3τ)); wash 0.4·e^(−5τ) |
| 18.00–18.35 | Hairline | scaleX 0 → 1 from the left (GLIDE) |
| 18.10–18.60 | Kicker « 01 · ANALYSER » | Tracks in (ENTER) |
| 18.12, 18.26, 18.40 | « Comprends tes / parties. » | Rise (ENTER 0.8); complete 19.20 |
| 18.30 / 18.42 | Stat tiles | translateZ 0 → 26 (GLIDE 0.5): parallax against the plate |
| 18.60 | Snare | « Victoire » badge pop (scale 0.85 → 1, SPRING 0.5) with a green glow |
| 18.60–19.20 | Card 1 | Sheen sweep (SHEEN) |
| 18.75–19.80 | « Écart d’or » | +0 → +4 000, outCubic on frame-quantised t; lands on the 19.8 snare; tile glow pulse (decay 4) |
| 19.30–20.40 | « Écart de vision » | +0 → +20; lands on the 20.4 kick; glow pulse |
| 19.30–20.10 | « parties. » | One sheen |
| 18.0–28.8 | Stack | Rim ×(1 + 0.25·beatPulse(dropSnares, 7)); sheen position and `--rim` follow the orbit (§3.7) |
| 21.00 | Snare **[graft]** | Vision tile focus: 2 px cyan inner rim plus a 24 px glow (0.2 s); translateZ 26 → 46 (GLIDE 0.35). The vision stat leads into the debrief question. |
| 21.10 / 21.16 | Title lines | Sink (EXIT 0.30) |
| 21.20 + 0.03i | Card 1 rows | Sink (EXIT 0.25); the vision tile goes last (21.40) |
| 21.30–21.90 | Card 1 **taken up into the light** | `translate3d(0, −300e, −360e) rotateX(−18e°)`, e = LIFT. Wash +0.3 (21.30–21.55). Leaves fade 21.55–21.90 (`NX.glassFade`). |
| 21.35–21.60 / 21.40–21.85 / 21.55–22.05 | Kicker | « ANALYSER » sinks; digit 1 → 2 (odometer, SINE); « DÉBRIEFER » rises |
| 21.38–22.12 | Card 2 | Slot 1 → 0 (ADVANCE); fog 0.42 → 0 |
| 21.46–22.20 | Card 3 | Slot 2 → 1 (ADVANCE); fog 0.84 → 0.42 |
| 21.45, 21.59, 21.73 | « Prépare tes / débriefs. » | Rise (ENTER 0.8) |
| 21.55 + 0.07·row | Card 2 rows | Rise in order: label, question line 1, question line 2, separator (draws 21.95–22.35), label 2 (22.05), item 1 (22.15), item 2 (22.30; items at `translateZ(18px)`). They stay hidden behind card 1's plate until it lifts away. There is no double exposure, because card 1's rows have gone by 21.45. |
| 21.60 | Bell | Card 2 sheen sweep; rim ×1.6 (decay 4) |

**Camera:** pull back z 72 → −30 by 19.4 and tilt 1.0 → 0.3° (the light comes down). Then the orbit starts (x → −50, yaw → +1.4 at 19.6). Card scale 0.925–0.965; title 1.01–1.035.

**Readable:**
- Title: 18.68–21.10, 2.42 s (v6 about 2.18 s).
- Card 1: from 18.05 (lit). Final numbers 19.80–21.20; vision tile until 21.40.

**Beat sync:** drop 18.0; snares 18.6, 19.8, 21.0; kick 20.4; bell 21.6.

**Transition out:** the hand-over 21.10–22.20 above. A readable message is missing for at most about 0.28 s (21.45–21.73).

**Acceptance:**
- **18.03:** beam on the corner; card 1 fully lit with readable content; flare along the top rim. Not a dark slab.
- 18.20: kicker and first title word rising.
- 19.00: tiles visibly raised.
- 19.80 and 20.40: integer final values, no ghosted digits.
- 21.05: focus rim on the vision tile.
- 21.50: card 1 blank and bright, lifting; no card 2 text visible through it.
- 21.80: the first question line and « Prépare » readable.

### S7 Outil 2 « 02 · Débriefer », 21.60–25.20 (`outils.js`)

| t | Element | Action |
|---|---|---|
| 22.60–23.40 | « débriefs. » | One sheen |
| 22.80 | Kick | Disc 1 fills (primary gradient through a conic mask 0 → 360°, 0.25 s outCubic). « 1 » pops (SPRING 0.5). A glint runs along the row (0.4 s, plus-lighter band, peak alpha 0.16). |
| 23.40 | Snare | Same for disc 2 |
| 24.70 / 24.76 | Title lines | Sink |
| 24.80 + 0.03i | Card 2 rows | Sink |
| 24.90–25.50 | Card 2 | Taken up into the light (same as card 1) |
| 24.95–25.20 / 25.00–25.45 / 25.15–25.65 | Kicker | « DÉBRIEFER » sinks; digit 2 → 3; « PLANIFIER » rises |
| 24.98–25.72 | Card 3 | Slot 1 → 0 (ADVANCE) |
| 25.05, 25.19, 25.33 | « Organise tes / entraînements. » | Rise; complete 26.13 |
| 25.15 / 25.25 + 0.06·col | Card 3 | Header rises; day labels and columns rise to translateZ 18 |
| 25.20 | Bell | Card 3 sweep and rim flare |

**Camera:** orbit only (x −37 → +20, yaw +1.03 → −0.56); no other move.

**Readable:**
- Title: 22.00–24.70, 2.70 s (v6 about 2.42 s).
- Question: 21.85–24.80.
- Both points lit: 23.65–24.80.

**Acceptance:**
- 22.40: question and both items visible.
- 22.90 and 23.50: discs filled.
- 25.30: card 3 advancing with its sweep; « 03 » rolled.
- No frame in 24.7–25.4 has mean Y below 15 (v6 dip 13.7).

### S8 Outil 3 « 03 · Planifier », 25.20–28.80 (`outils.js` and `fin.js`)

| t | Element | Action |
|---|---|---|
| 25.80 / 26.10 / 26.40 / 26.70 | Slots | Lun « Scrim 19:00 » (snare), Mer « Débrief 19:00 » (accented hat), Jeu « Match 20:00 » (kick), Ven « Scrim 19:00 » (kick). Each drops in from translateZ 60 and y −16 over 0.30 s with `NX.bezier(0.2,1.2,0.3,1)` (≤ 4% settle), opacity over 0.1 s, colour glow once (0.5 s). Mardi stays empty. |
| 26.40–27.20 | « entraînements. » | One sheen |
| 27.60–28.20 | Card 3 | Sheen sweep (bar downbeat) |
| 28.00–28.80 | (`fin.js`) emblem | Returns from the source (S9). `ciel`: `rayStrength` +0.3·smooth(28.0, 28.75). |
| 28.25 → | Burn (`outils.js`) | `NX.FRONT.end` with **lead 100 px**, glyph glow per word, and a band leaf on the card glass (`NX.light.band`, alpha 0.6). Card 3 uses `NX.light.localCard`; the title column uses `NX.light.local(190, 360, 40, …)`. Measured: card corner starts 28.565 and is gone 28.63; header gone 28.77; kicker 28.655–28.82; title line 1 28.70–28.915; line 2 28.805–29.005; card grid gone 29.16–29.19. |

**Camera:** last third of the orbit (x → 50, yaw → −1.4 at 28.4), then the unwind begins.

**Readable:**
- Title: 25.60–28.70, 3.10 s (v6 until 28.45).
- Complete planning: 27.00–28.56 (v6 about 27.2–28.5).

**Acceptance:**
- 26.80: four slots, Mardi empty.
- 28.40: a small emblem high on the axis; S8 content intact.
- 28.70: the card corner and header gone, with a glowing edge; the emblem nearly docked; **no emblem pixel over unburned card content.**

### S9 Fin, 28.80–33.60 (`fin.js`, window 27.95–33.6, z 3)

**Layers:**
- Halo div (v6, top 320).
- Lockup box `NX.G.L9` with `NX.logoLight` leaves.
- Docking favicon `NX.G.dock`.
- Button and line 1 (line 2 removed 7 Oct, see the v7.2 amendment).

**Emblem return (28.00–28.80):**
- The favicon's ring centre travels in world space from (959.1, −850, −4000) to (959.1, 246.0, 0) with GLIDE. On screen, size 97 → 295 px and peak 365 px/s.
- Opacity smooth(28.00, 28.20). It emerges from the source glow.
- The favicon is always masked to world y < 287.5, the wordmark band, so its spear bottom never doubles the lockup's.
- It is hidden from the first sub-frame where t ≥ 28.80. On that same sub-frame, the lockup's emblem rows are ungated. Pixels are identical: favicon ×1.1425 at (335.5, 48.5) in lockup px.

**Lockup writing:**
- `img` mask = write(`NX.FRONT.end`, lead 0) ∩ gate. Before 28.80 the gate keeps only rows at world y ≥ 287.5; after 28.80 it is full.
- Measured: wordmark top 28.79, bottom 28.915–28.945, tagline 28.965.

| t | Element | Action |
|---|---|---|
| 28.80 | **Hit** | `NX.hit(28.8)` at the docked ring centre (screen of world 959.1, 246.0): core 420, alpha 0.40; flare 0.55. `lum` 0.30·e^(−6τ). `ciel`: rays surge, push 24, dust gust. |
| 28.75–29.30 | Sparks | 200 from the lockup's bright pixels in rows v ≥ 440, emitted with `NX.light.when(FRONT.end)`; same physics as S2 |
| 28.70–29.20 | Halo | Fades in |
| 29.40 | Chime 1 | « nxt5.org » button: primary gradient `#22D3EE → #3B82F6 → #D946EF`, Inter 800, 56 px, `#020611`, padding 22/64, radius 2, top 600. `clip-path: inset(0 50% 0 50%)` → `inset(0)` over 0.45 s (ENTER), revealing the label from the centre. Bloom: fx glow r 260 at alpha 0.25·e^(−3τ). |
| 29.70 + 0.04i | Chime 2 | « Pour les équipes et coachs League of Legends » (Inter 700, 48 px, `#F3F7FF`, top 770) rises through its mask (ENTER 0.6) |
| 30.00 | Chime 3 | Removed 7 Oct (owner): no line 2. The chime sounds under the end of line 1's rise. |
| 30.30–30.95 | Chime 4 | Lockup glint (`sweep` plus spill, star at the spear tip ≈ 30.55) |
| 30.60–31.20 | Chime 5 | Button glint: an inner band, `overflow: hidden` on the button (a flat leaf), plus-lighter, peak alpha 0.16 |
| 31.80 | Bell | Soft star on the spear tip (g 0.5, 0.4 s) |
| → 33.60 | Hold | Dust keeps drifting; rays settle; the groove ends about 31.2; the camera comes to rest at 33.60 |

**Camera:** the orbit unwinds to frontal by 30.0, then z 24 → 70 and rest. Lockup scale 1.012–1.036; all margins inside the safe frame.

**Readable:**
- Lockup: 28.97–33.6.
- Button: 29.85–33.6 (v6 30.0).
- Line 1: 30.20–33.6 (v6 30.4).
- S8 remains are gone before each line appears: the button area is clear at 29.04, line 1's at 29.175.

**Acceptance:**
- **28.80:**
  - Emblem docked, complete and crisp, with a core flash and a streak.
  - Upper NXT5 being written by the band.
  - The S8 card header and kicker gone; no double exposure.
- 28.95: lockup complete; only the remains of « entraînements. » and the card bottom still burning.
- 29.35: clean end card (lockup only).
- 30.70: button and both lines complete.
- 33.50–33.60: camera velocity 0.
- **Dock difference check passes (§6).**

---

## 5. Implementation plan

### 5.1 Work packages and file ownership

Each file has exactly one owner. Anything shared goes through WP-A or WP-B.

| WP | Owner files | Content | Depends on |
|---|---|---|---|
| **A: Engine and kit** (lead, first, about ½ day) | `engine.js`, `boot.js`, `engine.css`, `kit.js`, `shader.js`, `scenes/index.js`, `scenes/style.js`, `ENGINE.md`, `README.md` (v7 section) | §3.1 lifecycle and `prepare`; §3.2 punch and `NX.sky`; §3.3 `NX.light` v2 and shader `frontR`; §3.4 `logoLight` v2; §3.5 `NX.hit`; §3.7 glass additions; §3.8 type kit and the `will-change` removal; `NX.lk.beam(..., ctx)`, flare ghosts off; the `NX.ease` additions; §3.10 constants, `NX.FRONT`, 96 px titles; load order `['style','camera','ciel','accroche','logo','equipe','direction','outils','fin']` | — |
| **B: Camera and sky** | `scenes/camera.js` (new), `scenes/ciel.js`, `tools/camcheck.mjs` (new) | Key table (§3.2). `ciel`: base sky, `NX.sky.at` coupling, hit light, swells, S3 lift, S5 focus, front bands (both tracks), `uWave` at 14.4, dust options (§3.6), shake 0, vignette 0.8, the v6 groove | A |
| **C: S1 + S2** | `scenes/accroche.js`, `scenes/logo.js` | §4 S1 and S2 | A, B for final framing |
| **D: S3 + S4** | `scenes/equipe.js` | §4 S3 and S4, fusion §3.9 | A |
| **E: S5** | `scenes/direction.js` (new) | §4 S5 | A |
| **F: S6–S8** | `scenes/outils.js` | §4 S6–S8 including the S8 burn | A |
| **G: S9** | `scenes/fin.js` | §4 S9 | A |
| **H: Verification tooling** | `tools/metrics.mjs`, `tools/determinism.mjs`, `tools/bench.mjs`, `tools/clip.sh` (all new) | §6 scripts | A |

**Order:**
1. A lands first: a smoke test renders without errors, and `tools/capture.mjs sheet` works with the camera active.
2. B through H then proceed in parallel.
3. Scene owners use the camera keys from this bible from day one. Retiming the camera is B's job only, on a camcheck failure or a lead request.
4. Integration order for review sheets: B, then C, D, E, F, G. Each WP posts its own signature sheet (§6) before the full render.

### 5.2 Interfaces between scenes

All of these are pure functions of t, so no runtime coupling is needed.

| Boundary | Contract |
|---|---|
| C ↔ B | Both read `NX.FRONT.hook`. C burns with lead 0 and writes with feather 70; B draws the shader band. |
| C → D | C's leaves fade 6.90–7.15. D's waiting lights start at 6.80; the Top tile becomes visible at 6.95. |
| D → E | D owns the particles until 14.75 and never draws the PNG. E owns the emblem element (opacity 14.28–14.42) and `NX.hit(14.4)`. B owns `uWave` and the dust wave at 14.4. The geometry is `NX.G.E5` for everyone. |
| E → F | E's direction beam ends at exactly 18.00; F's drop beam starts at 18.00. F's rims fade in from 17.80. E's title is gone by 18.04. |
| F ↔ G ↔ B | `NX.FRONT.end`: F burns with lead 100; G writes with lead 0 behind the 28.80 gate; B draws the band. G's emblem flies 28.00–28.80. |
| All | Only `ciel` writes `NX.bg` and `NX.post`. Scene roots are ordered by z (§3.10). Inside a scene, coplanar overlays get `translateZ` of 1–4 px. CSS is prefixed with the scene id. |

**Scene windows (start, end, z):**

| Scene | Window | z |
|---|---|---|
| `ciel` | 0–33.6 | −10 |
| `accroche` | 0–5.6 | 0 |
| `logo` | 4.0–7.2 | −1 |
| `equipe` | 6.7–14.8 | 1 |
| `direction` | 14.25–18.1 | 1.2 |
| `outils` | 17.7–29.9 | 2 |
| `fin` | 27.95–33.6 | 3 |

### 5.3 Fallbacks (decide on sheets, one at a time)

| Risk | Fallback |
|---|---|
| Hook mask rise less fluid than v6 | v6 `NX.wordsIn` plus everything else |
| Bell beams read busy | Keep the waiting lights and drop the beams (bells keep the stand-up and rim flash) |
| Link-to-ring arc reads as a loading ring | End the link at the gather (fade 13.45–13.75) and let the particles alone form the ring |
| Spear condensation reads as a cut logo | Launch the full emblem: same path, LIFT, 0.5 s |
| Docked emblem misaligned by more than 1 px | Fade the favicon out over 28.78–28.86 under the hit flash while the gate opens at 28.78 |
| Particles smear on mobile | Raise particle cores to 3 px, and/or the mobile `maxrate` to 3,500k |

---

## 6. Verification protocol

Run all of this on WP sheets as they land, then on the full render. Every tool runs from `teaser/`.

**1. Contact sheets at 4 images/s** (compare side by side with the v6 sheets in `out/design/`):

```
node tools/capture.mjs sheet --from 0    --to 8.25  --n 34 --cols 4 --out out/v7/sheet-0.jpg
node tools/capture.mjs sheet --from 8.5  --to 16.75 --n 34 --cols 4 --out out/v7/sheet-8.5.jpg
node tools/capture.mjs sheet --from 17.0 --to 25.25 --n 34 --cols 4 --out out/v7/sheet-17.jpg
node tools/capture.mjs sheet --from 25.5 --to 33.5  --n 33 --cols 4 --out out/v7/sheet-25.5.jpg
```

**2. Signature sheets at 12 images/s:**
- 4.30–5.30 (n 13)
- 6.50–7.50 (n 13)
- 12.40–14.80 (n 29)
- 17.30–18.60 (n 16)
- 28.00–29.60 (n 20)

**3. Full-resolution stills** at every acceptance time in §4. Add 1:1 crops for text crispness at 2.0, 10.6, 15.6, 19.6, 22.4, 26.8 and 31.0. No soft glyphs under camera scale; that is the `will-change` check.

**4. Motion review.** Encode motion-blurred clips (`tools/clip.sh`: `capture.mjs frames --sub 6`, then the `tmix` of `encode.sh`) for 4.3–5.4, 6.5–7.5, 12.4–14.8, 17.3–18.6 and 28.0–29.6. Review them in motion, at phone size too:
- Fronts must read as light, not as a scanner wipe.
- Particles must read as ribbons, not fur.
- No moment may feel faster than v6.

**5. Metrics** (`tools/metrics.mjs`, on the final mp4; same measure as the v6 baseline in Appendix C):
```
ffmpeg -v error -i VIDEO -vf "fps=4,scale=480:270,format=gray" -f rawvideo -pix_fmt gray - > v.gray
# per frame: Y = mean(gray); E = mean |gray[x] - gray[x-1]| (content edge energy)
```

| Check | Threshold |
|---|---|
| Not empty | E ≥ 1.0 for every sample. v6 had 8 samples below, minimum 0.46 at 7.0. |
| Not near-black | Y ≥ 13.0 for every sample from 0.5 s (v6 minimum 11.9) |
| Roles passage | Mean Y over 7.0–9.5 ≥ 15.0 (v6 12.9) |
| Direction passage | Mean Y over 15.25–17.5 ≥ 17.1. This guards against `rayFocus` darkening. |
| Hand-over dips | 21.25–21.5 and 24.75–25.25 ≥ 15.0 (v6 13.7–15.5) |
| Continuity | \|ΔY\| between consecutive samples ≤ 4.5, except within 0.5 s after a hit, where a rise of up to 9 is allowed |

**6. Readability windows.** For every message in §4, render stills at window start + 0.05 and end − 0.05. Each message must be fully legible in both, and every window must be at least the v6 value quoted in §4.

**7. Camera** (`tools/camcheck.mjs`, which uses the kit maths on the real keys and `NX.G` boxes):
- Every content box is ≥ 154 px from the sides and ≥ 86 px from the top and bottom at every 0.05 s of its window.
- Title scale ≥ 0.945.
- Subject drift ≤ 60 px/s in holds.
- Dolly ≤ 75 px/s (≤ 150 in 18.0–19.4).
- Pan and tilt ≤ 0.8°/s (orbit ≤ 1.6°/s).
- Velocity is zero at 33.6.
- It also reports peak speeds for the movers: tile gather ≤ 1,000; spear ≤ 1,000; dock ≤ 1,000; card lifts ≤ 1,000 px/s; link and direction-beam heads ≤ 800.
- Particle speeds come from a page probe like the sandbox's `tools/speed.mjs`: 99.5th percentile ≤ 900, maximum ≤ 1,400.

**8. Determinism** (`tools/determinism.mjs`):
- Render t = 4.80, 4.95, 7.20, 13.90, 14.40, 18.00, 21.60 and 28.80 in two fresh pages, one in ascending order and one in descending order.
- The PNGs must be pixel-identical.

**9. Dock check:**
- At t = 28.80 − 1/180, render with the lockup's emblem rows forced visible (debug flag) and compare them to the favicon-only render.
- In the emblem rows: mean absolute difference < 2/255, maximum < 24/255 outside a 2 px fringe.

**10. Brand:**
- In the holds at 6.0, 16.0 and 31.0, logo pixels must match a render with all light leaves off: mean difference < 3/255 outside glint windows.
- Grep: no `rotate` on logo boxes; no `filter` anywhere on logos; no `NX.lk.ring`, `NX.post.chroma`, `glitch` or `blur`.

**11. Render cost** (`tools/bench.mjs`, median of 5 per t, same machine and same script for v6 and v7):
- Sample times: 2.0, 4.8, 5.0, 8.4, 13.65, 13.9, 14.45, 18.04, 19.6, 21.7, 26.0, 28.8, 31.0.
- Each sample ≤ 1.6× v6; the mean ≤ 1.35×; the projected full render at 6 sub-frames ≤ 2 h.
- Prototype numbers are in Appendix A.

**12. Console:** no `[page …]` errors in any capture.

**13. Mobile:** run `tools/mobile.sh` and review 13.6–14.5, 4.4–5.1 and 28.6–29.2 on a phone-sized player. The pointillist emblem must read as the emblem, and the sparks and particles must not turn into a block of mush.

---

## Appendix A: prototypes and measurements (`out/design/motion-bible/`)

**Sandbox code:** `sandbox/scenes/{style,camera,ciel,accroche,logo,equipe,direction,outils,outils3,fin}.js`. Prototype quality, not production code. It also contains a one-line shader change and a `beam` ctx default in the sandbox kit. Tools: `sandbox/tools/bench.mjs`, `bench-root.mjs`, `speed.mjs`.

**Sheets and stills:**

| File | Shows |
|---|---|
| `hook-sheet.png` | Circular front: half-eaten edge words |
| `hook-sheet-ellipse.png` | Elliptical front |
| `hook-sheet-v3.png`, `stills-hook3/` | Final timing |
| `deal-sheet.png` | Persistent rays: rejected (hard wedges) |
| `stills-deal2/`, `stills-deal3/`, `stills-deal4/` | Bell beams, waiting lights, sky lift |
| `fusion-sheet.png`, `stills-fusion/` | Global pairing |
| `stills-fusion2/` | Final per-sector pairing |
| `drop-sheet.png` | Fog and anticipation bugs visible |
| `stills-drop/` | Power-on drop |
| `end-sheet.png`, `stills-end/` | No burn lead: overlap |
| `stills-end2/` | Lead 100: clean |
| `prototype-keyframes.jpg` | One frame per signature moment |

**Cost per sub-frame, median ms (v6 → prototype, idle machine):**

| t | Moment | v6 | Prototype |
|---|---|---|---|
| 2.0 | Hook | 448 | 498 |
| 4.8 | Light writes NXT5 | 947 | 847 |
| 8.4 | Roles | 556 | 671 |
| 13.65 | Fusion | 501 | 682 |
| 13.9 | Fusion | 553 | 617 |
| 14.3 | Fusion | 446 | 530 |
| 18.04 | Drop | 898 | 864 |
| 19.6 | Glass stack | 465 | 519–779 |
| 28.5 | Return | 857 | 997 |
| 28.8 | Bookend | 1,190 | 899 |
| 29.0 | Bookend | 789 | 835 |

That is about 1.0–1.4× v6 per moment, roughly 1.15–1.25× for the whole film, so about 70–75 min at 6 sub-frames against a 2 h ceiling.

**Speeds (prototype probes):**
- Particles: 1,338 px/s peak, 0.37% of samples above 900.
- Tile gather: 787 px/s.
- Dock: 365 px/s.

## Appendix B: measured geometry (raw PNG analysis)

**Lockup `nxt5-logo.png` (1254×989):**
- Spear axis x 625; spear tip (625, 106); ring centre about (625, 356); outer ring radius about 198.
- Bright rows: emblem 106–439, wordmark 440–759, tagline 760–802.
- Dark plate alpha 0.1–0.6 around the art. Never alpha-mask light onto it.

**Emblem `nxt5-loader-favicon.png` (512×512):**
- Alpha box (48, 52)–(457, 427).
- Spear tip (253, 52), spear bottom (254, 415).
- Ring centre (253.5, 269.0).
- Two arc bands: outer r 168–186 (peak 176), inner r 144–158.
- Arcs span 148° → 392° (y down, clockwise), open at the bottom.
- Colour runs from cyan on the left to fuchsia on the right.

**Favicon → lockup:** scale 1.1425, offset (335.5, 48.5). The ring radii ratio (198.2/172.6) and the spear tip match within 2 px.

**Derived placements:**
- Emblem S5 at 460 px, left 732.25, top 200: ring centre (960, 441.7), radius 158.1, spear tip y 246.7.
- Dock in the 620 px lockup at (650, 70): favicon 289.2 px at (815.9, 94.0); ring centre (959.1, 246.0).

**Text widths (Chromium, Inter):**

| Text | Width |
|---|---|
| Hook line 1 | 1,215 px |
| Hook line 2 | 1,346 px |
| « Toute ton équipe. » | 777 px |
| « Une même direction. » | 924 px |
| Tool title lines | 683 / 347 / 507 / 405 / 563 / 686 px |
| Kickers | 350–365 px |
| End line 1 | 1,064 px |
| « nxt5.org » at 56 px | 242 px |
| SUPPORT at .2em / .6em | 210 / 305 px |
| Question at 44 px | 2 lines |
| « +4 000 » at 80 px | about 279 px (tile inner width 295) |

## Appendix C: v6 baseline (final mp4, `fps=4,scale=480:270,format=gray`)

**Mean Y:**

| Window | v6 mean Y |
|---|---|
| 0–1.5 | 11.8–13.7 |
| 2.0–4.25 | 17.0–19.0 |
| 4.75 (hit) | 25.6 |
| 5.0–6.75 | 15.1–20.6 |
| **7.0–9.5** | **11.9–15.2** (dimmest passage) |
| 9.75–13.25 | 16.9–20.7 |
| 14.25 | 15.2 |
| 15.0–17.5 | 17.2–19.0 |
| 18.0 (hit) | 26.1 |
| 18.25–21.0 | 18.9–21.4 |
| **21.25–21.5** | **15.1–15.5** |
| 21.75–24.5 | 17.7–20.3 |
| **24.75–25.25** | **13.7–17.1** |
| 25.5–28.25 | 16.8–20.6 |
| 28.75 (hit) | 27.3 |
| 29.0–33.25 | 17.3–22.2 |

**Edge energy E:**
- Below 1.0 at 7.0–7.75 (0.46–0.64), 8.0–8.25 (0.85–0.87), 14.25 (0.74) and 21.5 (0.97).
- Holds are 2.4–4.7.

**Render cost per sub-frame:** 448–1,190 ms by moment (Appendix A). The full v6 film takes about 60 min at 6 sub-frames.

---

## Deviations recorded by the lead

| Date | Section | Change | Reason |
|---|---|---|---|
| 6 Oct | §3.2 camera keys | `z` key at 18.0 is 50 (was 72); impact accent at 18.0 is 16 px (was 20) | `tools/camcheck.mjs` found the tools title column 17 px inside the 154 px safe margin at 18.1–18.25 (the bible's estimate ignored the accent). Now 0 px or more everywhere; dolly peak stays under 75 px/s outside the reveal window. |
| 6 Oct | §6.5 metrics | Continuity rule tolerates up to 9 luma in either direction within −0.1 to +0.75 s of a hit | A flash's natural decay right after the hit was flagged as a jump. |
| 6 Oct | §6.8 determinism, all capture tools | Chromium is launched with `--disable-gpu-rasterization` (capture, determinism, bench, camcheck) | With SwiftShader GPU rasterization, text and image tiles depended on earlier renders (±1 level on up to 50 px, 14.40 and 18.00 in the official set). Software rasterization is order-independent; interleaved bench: same cost (0.84 s against 0.93 s per sub-frame); images identical to the eye (PSNR 49–64 dB against the GPU path). |
| 6 Oct | §2.7 « half-eaten words ≤ 0.15 s », S1 burn | Accepted: each hook word takes 0.21–0.265 s from the first touch of the 60 px feather to gone | The ellipse burns each line across its whole width at once, which was the purpose of the rule (the circle left the ends half-eaten for 0.3 s). Shortening it needs either a faster front, which is already near the 1,600 px/s limit, or a harder edge, against §2.6. A 40 px feather gains only 0.02 s. |
| 6 Oct | §3.3 `NX.FRONT.hook` | First key at 4.18 (was 4.20); every other key unchanged | The monotone track peaked at 1,653 px/s at 4.27, above the 1,600 px/s light-front limit of §2.6. Now 1,498 px/s. R(4.42) = 392 and R(4.80) = 735 as before. |
| 6 Oct | S2 exit (`logo.js`) | 6.65–6.95 lum whitens to 0.45; 6.97–7.10 the chrome cross-fades into its own cold-light silhouette (forge 0 → 0.85, img 1 → 0); 7.085–7.15 a radial mask draws that light into the ring centre while the core light peaks at 7.13 (0 by 7.18). The bible gave one group fade over 6.90–7.15. | Any frame with the lockup between about 0.11 and 0.5 opacity read as a grey ghost (review C, finding 1). Brightness now never drops: p98 ≥ 229 while the logo is visible; all leaves are still at 0 by 7.15 and the 7.20 frame is identical to a render without the logo. |
| 6 Oct | S3–S4 (`equipe.js`) | Lock energy gets a continuity term +1.3·e^(−4(t−ta)) and a white overexposure core on locked dots (up to 1.5 energy at the dot centre); the ×0.9 head factor is removed. The gather is timed per axis instead of the z-arc: Top/Support y over 12.50–13.10 and x over 12.55–13.55, Jungle/ADC x over 12.50–13.10, Mid and all scales 12.50–13.55. The burst gate smooth(1.5, 6, d) also applies to embers. Particles keep following their tile until 13.55; post 1.7 s (embers fade 15.9–16.5). | Review D: the hero dimmed before the hit (now −9% at worst instead of −18%), the straight gather made Top/Support overlap their neighbours by 64 px (now 6.3 px clear at ≤ 782 px/s), and the burst stipple sat on E's PNG on the hit frame (now 0.000% of pixels over 24/255). |
| 6 Oct | S4 acceptance « 13.55: five recognisable tiles » | Read as « 13.40: the last clean glass pentagon; at 13.55 five recognisable roles, three of them already as particle icons » | The release timings of §3.9 turn Mid, Jungle and ADC into particles before 13.55, as in the validated prototype. |
| 6 Oct | §3.2 `ciel`, S2 → S3 | Added a relay: as the logo is absorbed (7.11–7.17) the rays take its light (rays +0.7, intensity +0.14, the size of a hit flash) and settle by 7.8 | Without it the frame lost 4.7 luma in one frame at 7.167 and the §6.5 samples stepped −5.46 (7.10 → 7.367). Now −2.8 for that frame, −3.4 and −2.2 between samples; it lands with the Top bell at 7.2. |
| 6 Oct | S5 (`direction.js`) | Title sinks at 17.60/17.65/17.70 with EXIT 0.30 (gone exactly on the 18.00 drop frame). The condensation band is kept and combined with a soft spear mask from the PNG alpha; what the band leaves outside the spear dims over 17.50–17.60. Extra beam volume layer (gaussian column up to 180 px at 0.22·k, width following the drawn length, full strength 60 px above the tip, head faded over 120 px); the beam foot rides the rising spear. Halo on `#fxback` (0.35 at rest, +20% on the kicks; fades in 14.42–15.00, narrows and rises with the arrow, fades 17.75–17.98). Emblem box laid out at 2× and scaled ½. Glint star at 16.40. | Review E: with the bible's times the frame before the drop was empty and the 17.60 frame showed cut wings and ring end caps; the bible's two beam layers were a hairline at phone size; the halo div rasterised differently by render order. Title still legible 15.07–17.70 (2.63 s, v6 2.41 s). |
| 6 Oct | S9 (`fin.js`) dock and gate | The baked gate holds back only the strokes of the lockup's emblem (max-channel stroke law); the dark plate is written by `NX.FRONT.end` like S2 and revealed with the landing (write × SINE 28.64–28.80). Strokes open 28.80–28.83 and the flying emblem fades 28.81–28.86 (the §5.3 fallback form, started on the hit). The y < 287.5 favicon mask is replaced by the docked emblem's baked footprint (grown 4 px, 4 px feather). The emblem flies 2 px in front of the lockup with an eye-centred rescale; its lum leaf carries a 0.22 birth light (27.98–28.36) plus the hit's 0.30; core light on `#fxback`; sparks filtered to outside the footprint; button bloom attack 0.06 s; lockup glint uses S2's band at 0.30/0.95; both logo boxes drawn at 2× and scaled ½. | The lockup PNG has a dark plate in the emblem rows that the favicon lacks: a hard swap at 28.80 popped it (0 → 17.2 luma in one frame) and failed §6.9 (mean 4.86/255, max 60). Now §6.9 passes (mean 0.79/255, max 6) and the plate arrives at ≤ 3.5 luma per frame. |
| 6 Oct | ENGINE rule (found in S9) | A DOM element that becomes empty or invisible under the preserve-3d root gets `display:none`, not only opacity 0 | Chromium keeps an emptied layer's stale texture: rendering 33.5 → 31.0 → 29.0 showed a 40 × 68 px patch of an end-card line at 29.0. |
| 6 Oct | S6–S8 (`outils.js`) | Anticipation rims ease in with ENTER over 17.80–17.98. Front card power-on 17.985–18.085 (beam and `NX.hit` stay at 18.00). Card 1 rows sink from 21.15 + 0.03i (vision tile 21.24); card 2 rows from 24.70 + 0.03i. Vision focus ENTER 21.00–21.20. « Prépare tes débriefs. » rises at 21.40 and « Organise tes entraînements. » at 25.00; the odometer rolls 2 → 3 from 24.95. Lift wash +0.45; a light hand-off wash of 0.45 on the advancing card at the depth crossing. Own burn band (narrow white core, cyan halo onto the remaining glass, 26 px trail, alpha 0.85, falloff 1 → 0.75 from 600 to 1330 px, fades over the last 100 px). Card 3's halo fades 28.40–28.60 instead of burning. Card shadows on `#fxback`; badge glow as a fixed-blur leaf; slot glow as an inset ring plus a canvas halo; constant row masks. The debrief question wraps on two rows. | Review F and its fixes: card 2's plate crosses card 1's face at 21.51–21.56 (rows would be cut); the hero must be lit on the 18.00 beat frame; the kit band read as a grey scanner bar on dark glass (core ≈ 130/255); a burning halo leaf brought back a stale texture of card 2 at 28.7; box-shadows and the kit's shadow leaf rasterised by render order. |
| 6 Oct | S5 → S6 interface (17.80–17.95) | Kept: the rising, fading spear crosses the rims' top-left corners | The corner (975, 300) sits under the spear's axis by design: the light goes up with the spear and comes straight back down on that corner at 18.00. Masking the rims in from the right would need an animated mask on large leaves, which brought back stale textures elsewhere. |
| 6 Oct | §2.5 hits, §3.2 `ciel` | Sky flash weight per hit: 1 at 4.8 and 14.4, 0.3 at 18.0, 0.5 at 28.8 (rays +0.65, intensity +0.14 at weight 1). Source swell as the spear enters the light: rays +0.45, intensity +0.06 over 17.72–17.97, gone by 18.12 (replaces the bible's 17.90–18.00 rays +0.4). After the end hit the rays hold (rays +0.5, intensity +0.1 over 28.85–29.15, settled by 29.7). | On the full-film preview, the §6.5 samples stepped +11.1 into the drop (the title and spear fade made the frame darker just before it), +10.8 into the end hit and −12.0 after it (the card burns away while the flash decays). Now +7.1, +7.2 and −6.3. |
| 7 Oct | v7.1 S1 (`accroche.js`) | Three-line block at world top 350 (was 400; optical centre unchanged at screen y ≈ 500). Line 2 rises from 1.20 and line 3 from 2.00 (0.14 s steps); all lines complete at 3.36. Burn lead ramps 0 → 90 px over 4.58–4.80 (SINE), one continuous edge ≤ 1,400 px/s; the question is gone on the 4.80 hit frame. | Line 3 sits on the middle of NXT5, written at 4.74–4.86: with lead 0 it covered NXT5's unwritten half on the hit frame. |
| 7 Oct | v7.1 S3′ (`equipe.js`) | Top tile appears 7.125–7.20 and each place light comes on with its tile (the pentagon sits where the logo was). Added stage light (soft pool plus a heart that grows with each role) in place of the removed stage glow and link line. Team moment 8.30–8.50 (all five brighten and lean 12 px inward, no rotation). Release in birth order (8.50 + 0.04 s per role). Tile transform translate · rotateX · scale; bell beam and rise ×0.62. Embers fade 11.1–11.7. | Without the stage light the passage measured mean Y 11.7 (≥ 15 required); now 15.6. A rotation on tiles in a circle read as a wobble. Births and release run clockwise like the particle swirl. |
| 7 Oct | v7.1 S5 (`direction.js`) | Every time relative to `NX.T`; the emblem is shown from a static 1:1 canvas copy of the PNG (the kit `<img>` stays for the masks, display:none). | The composited `<img>` rasterised differently after S1–S3′ history (§6.8 failed at 9.6, 3 px by one level) and alternated between crisp and 4–5 % softer. Pixels match the PNG within 3 levels; no logo is redrawn or recoloured. |
| 7 Oct | v7.1 `ciel` | Sky clock: the shader time is τ = t + 4.8·smooth(7.2, 9.6, t) (speed τ/t) and the hue follows τ over v7's 33.6 s, so S5–S9 see the validated v7 sky; groove pulse phase computed without float residue. | Moving S5 4.8 s earlier had put it on a sparse part of the ray noise (the converging fan of « Une même direction. » was gone, guard 18.9 instead of 21.2). Now 21.5. The sky moves at most twice as fast per frame during the fusion. |
| 7 Oct | v7.1 S6–S8 (`outils.js`) | Every time relative to `NX.T`. Four-card stack, three visible (card 4 enters the back slot as card 1 leaves). S7b picks land on 21.0, 21.6, 21.9, 22.2, 22.8 (names start 0.05 s early, half-landed on the hit), badge at 22.85 at 26 px; « Situationnel » in the product's amber (#FCD34D). S8's Friday slot lands at 25.80 (snare) instead of 25.50 (a hat after the −1.2 s shift). Card details fade by opacity only, except champion names (display:none while transparent). | Product grammar and readability at phone size; the −1.2 s shift moved S8 half a bar against the drum grid; opacity-only fades and display:none were each measured for render-order independence. |
| 7 Oct | v7.1 S2 (`logo.js`) | Cold silhouette swells 0.30 → 0.42 (SINE 4.55–4.78); halo blooms with the writing (0.5·SINE 4.42–4.78 + 0.5·SINE 4.78–5.10) and rests at 0.7. Absorption 7.04–7.15 (SINE), opaque core 55 %, core light fades 7.13 → 7.20. Box and halo display:none when empty. | Review C v7.1: pre-hit luminance dip as the three-line question burns, S2 hold margin, and a one-frame collapse at 7.167. With the sky's burn swell (below) the pre-hit step is −4.1 (limit 4.5). |
| 7 Oct | v7.1 `ciel` | Burn swell rays +0.25, intensity +0.042 over 4.45–4.78, released 5.0–5.8; logo hit flash weight 0.9. | The question's light is taken by the rays while the front writes the logo; the swell multiplies the 4.8 flash, hence 0.9 (post-hit decay stays ≤ 9). |
| 7 Oct | v7.1 S3′ (`equipe.js`) | Top is born as light first (hot rim and halo 7.08–7.18; plate, icon and shadow 7.14–7.32); a centre flare takes over from the logo's core (7.06–7.14, then decays); waiting orbs (four unborn roles, from 7.15, peak 0.09, 160 px); stage heart fades 9.52–9.92 and the pool 9.52–10.20 (D draws soft light behind the DOM until 10.2). | Review D v7.1: the Top place sits under the old wordmark until the absorption passes (≈ 7.115); the light hand-over must not dip after the 9.6 hit. Passage mean Y 18.9, lowest sample 15.6. |
| 7 Oct | §6.8 determinism, end card and logo layers | Accepted: the « nxt5.org » label varies by at most 1/255 on ≤ 191 px with render history (28.2–32.4), and the S2 lockup layer by ±1 on 8 px at 7.0 in a shuffled order. | Chromium text and compositor raster, present since v7, invisible under the encode grain. An image-based label changed the validated CTA by up to 67/255. The official §6.8 times are identical. |
| 7 Oct | v7.1 S9 (`fin.js`) | Every time relative to `NX.T.end`; end-card events keyed on `NX.beats.chimes`; display:none instants computed in prepare() (box from 27.42, band leaf until 27.9725, halo from 27.5065, returning chrome from 26.8026). | ENGINE emptied-layer rule; pixel-identical to the v7.1 render before the fix, cheaper (27.3: 1,217 → 789 ms). |
| 7 Oct | v7.2 exit and hand-over (`logo.js`, `direction.js`) | The one-sub-frame swap became a 0.15 s cross-dissolve, `NX.M72.DISSOLVE` 7.10–7.25 (centre `NX.M72.SWAP` = 7.1833; §6.9 passes throughout: emblem rows mean 0.53/255, max 9 outside the 2 px fringe). Region R around the emblem: the dark plate fades early (6.80–6.98, SINE); everything outside R leaves only with the reverse front (`UNWRITE` 1070 → 590 px over 6.78–7.17, white band on the leaving strokes). The favicon flies 2 px in front of the lockup with an eye-centred rescale, the lift reaching 0 at 9.6. Shared path `NX.M72` (in `logo.js`): holds the lockup geometry until 8.6, then grows (SINE) to E5 by 9.6. | Review M (motion and QA): the plate turned into grey blotches when the light behind the emblem was revealed; the last strokes faded instead of leaving as light; the two rasters differ by about 8 % in fine detail, so a one-sub-frame swap was a visible tick. |
| 7 Oct | v7.2 roles and fusion (`equipe.js`) | Pentagon centred on the emblem's optical centre (958.07, 430.50), r = 262 (not `NX.G.pent`). Relay lights drawn flat in phase with the exit (core orb 6.92–7.60, heart, a relay annulus instead of the flare); Top and Support bell beams keep 25 % of their light inside the ring. Fusion arrivals per role (rings 9.26–9.44, other strokes 9.30–9.585; Top and Support first, Mid last); particles fade over the last 20 % of their flight and the last 3–16 px; targets moved up to 8 px inward onto opaque pixels; particles over the emblem drawn on `#fxback`, behind the strokes; lock sparkle, trail energy and white hot dots removed. Pool light builds into the hit (+60 %, 9.25–9.6) and decays e^(−5τ). | Review M: tiles must clear the emblem's ring; the fusion into an existing emblem read as fur then glitter on a crisp logo; the relay was out of phase (blink then flash). |
| 7 Oct | v7.2 emblem charge (`direction.js`) | A plus-lighter sector leaf (`.dir-sec`, five conic wedges masked by the bright mask) pulses ≤ 0.12 on each bell and charges ≤ 0.22 over 9.2–9.6; the hit takes over at 0.30. | The roles are born from the emblem's light and the emblem visibly charges before resolving on the 9.6 hit. |
| 7 Oct | v7.2 `ciel` | The relay « take » (7.11–7.8) is removed. | It was tuned for the whole lockup vanishing; with the emblem staying it arrived after the letters and flashed outside any hit (+2.2 in one frame at 7.167). The scenes now relay the light in phase. |
| 7 Oct | §6.5 reading | `tools/metrics.mjs` samples land 0.1 s after their labelled time (ffmpeg fps filter keeps the last frame of each quarter second): the sample labelled 9.50 is the 9.6 hit frame. | Recorded so that hit-window readings are interpreted correctly. |
