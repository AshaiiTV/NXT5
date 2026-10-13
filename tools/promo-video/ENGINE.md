# Moteur de la vidéo promo NXT5 — API des scènes

Tout est dessiné en canvas 2D (`@napi-rs/canvas`), 1920×1080 à 60 fps, et calé sur `out/music.events.json` produit par `music.py`.

## Une scène

`scenes/Sxx.mjs` :

```js
export default {
  id: 'S04', startBar: 12, endBar: 16,
  transitionOut: 'slash',          // cut | flash | slash | star | shatter | glitch | zoom | iris
  // cards: [...]                  // optionnel ; sinon les cartes de script.json pour cet id
  draw(ctx, f, K) {                // fonction PURE de f.t : jamais Math.random / Date.now / état mutable entre frames
    K.background(ctx, f);
    K.renderCards(ctx, f, f.cardsOf);
    return { shake: 0, rgb: 0, zoom: 0, flash: 0 };   // FX supplémentaires (optionnel), auto: false pour couper les FX automatiques
  },
};
```

Le renderer applique automatiquement : secousse + aberration RGB + zoom + flash sur chaque impact, et pendant les drops (énergie ≥ 0,9) un léger shake/zoom sur les kicks et un split RGB sur les snares. Il ajoute aussi le vignettage, le grain et les scanlines. Les transitions sont gérées par le renderer à partir de `transitionOut` : la scène suivante peut être appelée avec un `f.lt` légèrement négatif (jusqu'à −0,4 s), elle doit donc dessiner un état initial propre quand `f.lt < 0`.

## Contexte de frame `f`

| champ | sens |
|---|---|
| `f.t` | secondes absolues |
| `f.lt`, `f.lb`, `f.p`, `f.dur` | secondes locales, mesures locales, progression 0..1, durée de la scène |
| `f.bar`, `f.beat`, `f.beatPhase`, `f.barPhase` | position musicale absolue (150 BPM : 1 temps = 0,4 s, 1 mesure = 1,6 s) |
| `f.kick`, `f.snare`, `f.hat`, `f.impact`, `f.stab` | enveloppes 1→0 après chaque événement musical |
| `f.env(kind, decay)`, `f.since(kind)` | enveloppe à décroissance choisie / secondes depuis le dernier événement |
| `f.energy` | 0,2 intro … 1 drop |
| `f.at(bar, beat)` | instant local (s) d'une position musicale absolue |
| `f.cardsOf` | cartes texte de la scène |
| `f.W`, `f.H` | 1920, 1080 |

## Kit `K`

- **Palette `K.C`** : `night bg surface text text2 cyan cyan2 blue indigo violet violet2 fuchsia fuchsia2 red gold ink`. `K.rgba(hex, a)`, `K.linearSpectrum(ctx, x0,y0,x1,y1)` (cyan→indigo→violet→fuchsia).
- **Maths** : `K.clamp`, `K.lerp`, `K.seg(t,a,b)` (progression bornée), `K.map`, `K.E.*` (outExpo, inOutExpo, outBack, outElastic, inOutSine, brand…), `K.rng(seed)`, `K.noise1(t, seed)`, `K.BEAT`, `K.BAR`, `K.barT(bar, beat)`.
- **Polices `K.F`** : `anton(px)`, `bebas(px)`, `russo(px)`, `inter(px, weight)`, `display(px, weight)`.
- **Texte** : `K.text(ctx, str, x, y, {size, font, color, emph, align, glow, stroke, alpha, spacing})`, `K.jaggedText` (lettres découpées Persona), `K.slamText` (arrivée géante + traînées), `K.typeText` (machine à écrire), `K.stamp` (tampon), `K.fitSize`, `K.measure`, `K.renderCards(ctx, f, cards, {x, y, size, subSize, maxW, styleOverride})`.
- **Fonds** : `K.background(ctx, f, {warm, intensity, grid})`, `K.particles`, `K.halftone(ctx, f, {color, alpha, angle, band, spacing, maxR})`, `K.speedLines(ctx, f, {density, angle, color, speed})`.
- **FX** : `K.shockwave(ctx, x, y, p, {color, maxR})`, `K.rune(ctx, x, y, r, f, {draw, spin, gold})` (cercle hextech).
- **Formes** : `K.roundRect`, `K.polyPath`, `K.hexPath`, `K.starPath`, `K.panel(ctx, x, y, w, h, {header, accent, tilt, alpha})`, `K.icon(ctx, kind, x, y, size, {color, p})` avec kind ∈ graph, clipboard, calendar, chat, window, hex, users, sword.
- **Logo** : `K.logo(ctx, cx, cy, width, {draw, fill, glow, lineWidth})` : contour « NXT » du site + « 5 » assorti.
- **Captures réelles** : `K.screen(ctx, 'ui-xxx.png', cx, cy, width, {tilt, skew, p, scroll, glare, frame, src, h})` affiche une capture de `assets/ui/` dans un écran de verre 2.5D. Voir `assets/ui/manifest.json`.
- **Offscreen** : `K.offscreen(key)` → `[canvas, ctx]` vidé, réutilisable.

## Commandes

```bash
python3 music.py out/music.wav                      # musique + out/music.events.json
node src/render.mjs --sheet S04                     # planche contact de 8 images -> out/stills/sheet-S04.png
node src/render.mjs --scene S04 --stills 0.1,1.6,3  # images à des temps locaux -> out/stills/
node src/render.mjs --from 19 --to 26 --scale 0.5   # extrait vidéo avec le son
node src/render.mjs                                 # rendu complet -> out/nxt5-promo.mp4
```

## Règles

- Règles de sécurité : aucun asset Riot (art de champion, emblèmes, polices, bannières) ; seulement de la géométrie originale. Aucune statistique inventée. Les affirmations produit doivent être vraies.
- Garder le texte dans la zone sûre : marge de 5 % sur chaque bord.
- Une carte reste lisible au moins 2 temps.
- Les coupes et les frappes tombent sur les événements musicaux.
