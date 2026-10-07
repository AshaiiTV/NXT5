/* Kit commun de la v7 : caméra continue, profondeur, lumière, particules, typographie et matière.
 * Chargé après engine.js et shader.js, avant les scènes. Tout est une fonction pure de t :
 * les seuls caches dépendent des images et de graines fixes, jamais du temps.
 *
 * Conventions de l'espace monde : x et y en px CSS comme la mise en page NX.W×NX.H (1920×1080, ou 1080×1920 en vertical ; y vers le bas),
 * z vers le spectateur (translateZ positif = plus près). La caméra regarde le plan z = 0 depuis D = 2000 px.
 * Résumé des API en fin de fichier et dans ENGINE.md. */
(function () {
  const W = NX.W, H = NX.H, OX = W / 2, OY = H / 2, U = NX.U, D = 2000, RAD = Math.PI / 180;
  /* Ciel : hauteur de la source des rayons, en unités U au-dessus du centre (16:9 : 0,6, soit 108 px au-dessus du bord haut).
   * Lue par « ciel » (NX.bg.rayY) et par NX.sky.src. */
  NX.SKY = { rayY: NX.V ? 0.99 : 0.6 };

  /* ====================================================================================
   * Pistes d'animation : Hermite cubique monotone (Fritsch–Carlson).
   * Vitesse continue, jamais de dépassement entre deux clés. keys = [[t, v], ...] triées.
   * ==================================================================================== */
  NX.track = keys => {
    const n = keys.length, ts = keys.map(k => k[0]), vs = keys.map(k => k[1]);
    if (n === 1) return () => vs[0];
    const d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return t => {
      if (t <= ts[0]) return vs[0];
      if (t >= ts[n - 1]) return vs[n - 1];
      let i = 0; while (t > ts[i + 1]) i++;
      const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  };
  /** Accent d'impact : avancée douce amp·(τ/tp)·e^(1−τ/tp), maximale 0,12 s après le temps fort, éteinte vers 0,8 s. */
  NX.punch = (t, h, amp, tp = 0.12) => (t < h ? 0 : amp * ((t - h) / tp) * Math.exp(1 - (t - h) / tp));

  /* ====================================================================================
   * Caméra continue. Inactive tant que NX.cam.set() n'a pas été appelé : la v6 se rend à l'identique.
   * Canaux : x, y (travelling, px), z (avancée, + = vers la scène), yaw (panoramique, ° vers la droite),
   * pitch (° vers le haut), roll (°). punch : { temps: amplitude en px d'avancée }.
   * Les rotations pivotent autour de l'œil (vrai panoramique) ; pour orbiter, combiner travelling et panoramique.
   * ==================================================================================== */
  const ZERO = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  let tracks = null, punches = [], memoT = NaN, memoC = ZERO;
  NX.cam = {
    D, active: false,
    set(keys, punch = {}) {
      tracks = {};
      for (const ch of ['x', 'y', 'z', 'yaw', 'pitch', 'roll']) tracks[ch] = NX.track(keys[ch] || [[0, 0]]);
      punches = Object.entries(punch).map(([h, a]) => [+h, +a]);
      this.active = true; memoT = NaN;
    },
    at(t) {
      if (!tracks) return ZERO;
      if (t === memoT) return memoC;
      const c = {};
      for (const ch in tracks) c[ch] = tracks[ch](t);
      for (const [h, a] of punches) c.z += NX.punch(t, h, a);
      memoT = t; memoC = c; return c;
    },
    css(c) {
      return `translateZ(${D}px) rotateZ(${c.roll.toFixed(4)}deg) rotateX(${c.pitch.toFixed(4)}deg) rotateY(${c.yaw.toFixed(4)}deg) translateZ(${-D}px) translate3d(${(-c.x).toFixed(3)}px,${(-c.y).toFixed(3)}px,${c.z.toFixed(3)}px)`;
    },
    /** Point du monde → écran : { x, y, s (échelle), depth (distance à l'œil) }. Mêmes calculs que css(). */
    project(X, Y, Z = 0, c = NX.camState || memoC) {
      let x = X - OX - c.x, y = Y - OY - c.y, z = Z + c.z - D, cs, sn;
      cs = Math.cos(c.yaw * RAD); sn = Math.sin(c.yaw * RAD); [x, z] = [x * cs + z * sn, -x * sn + z * cs];
      cs = Math.cos(c.pitch * RAD); sn = Math.sin(c.pitch * RAD); [y, z] = [y * cs - z * sn, y * sn + z * cs];
      cs = Math.cos(c.roll * RAD); sn = Math.sin(c.roll * RAD); [x, y] = [x * cs - y * sn, x * sn + y * cs];
      z += D; const depth = Math.max(1, D - z), s = D / depth;
      return { x: OX + x * s, y: OY + y * s, s, depth };
    },
  };

  /* ====================================================================================
   * Temps forts de la musique (100 BPM). Une seule source pour synchroniser la lumière et l'interface.
   * ==================================================================================== */
  let beatsCache = null;
  Object.defineProperty(NX, 'beats', { configurable: true, get() { return beatsCache || (beatsCache = buildBeats()); } });
  function buildBeats() {
    // v7.1 : les cinq rôles tombent sur des croches ; quatre outils, soit six mesures de groove complètes.
    const T = NX.T, B = NX.BEAT, BAR = NX.BAR, nBars = Math.round((T.end - T.tools) / BAR), bars = Array.from({ length: nBars }, (_, j) => T.tools + j * BAR);
    return {
      hits: T.hits.slice(),
      bells: [0, 1, 2, 3, 4].map(i => T.roles + i * B / 2).concat([1, 2, 3].map(k => T.tools + k * T.tool)),
      lightKicks: [T.emblem + 2 * B, T.emblem + 4 * B],
      dropKicks: bars.flatMap(b => [0, 1.2, 1.5].map(o => b + o)),
      dropSnares: bars.flatMap(b => [0.6, 1.8].map(o => b + o)),
      chimes: [0, 1, 2, 3, 4].map(i => T.end + 0.6 + i * B / 2).concat([T.end + 3.0]),
    };
  }
  /** Somme des décroissances exponentielles des temps passés de la liste : 1 sur le temps, puis retombe. */
  NX.beatPulse = (t, list, decay = 6) => { let s = 0; for (const h of list) if (t >= h) s += Math.exp(-decay * (t - h)); return s; };

  /* ====================================================================================
   * Profondeur : poussière lointaine (canvas arrière, derrière le DOM) et bokeh proche (canvas fx, devant).
   * NX.dust.draw(t, o) à appeler une fois par image (scène « ciel »).
   * o.gain (1), o.drift (1, vitesse de montée), o.beam (1, renfort dans le faisceau),
   * o.gusts [{ t0, x, y, amp }] : souffle radial depuis un point écran,
   * o.wave { x, y, R, w, gain } : anneau lumineux porté par la poussière (onde de choc), en px écran.
   * ==================================================================================== */
  NX.dust = (() => {
    const R = NX.rng(2024), FAR = [], NEAR = [];
    // Le champ (dessiné pour 1920×1080) suit le cadre : en vertical il s'étire en hauteur et se resserre en largeur,
    // même densité à l'écran et mêmes vitesses en px/s. En 16:9, KX = KY = 1 : calculs identiques.
    const KX = W / 1920, KY = H / 1080;
    for (let i = 0; i < 900; i++) FAR.push({ x: -1400 + R() * 4700, y: -900 + R() * 2900, z: -2600 + R() * 2400, s: 0.8 + R() * 1.6, a: 0.25 + R() * 0.6, h: R(), ph: R() * 6.283, vx: (R() - 0.5) * 10, vy: -6 - R() * 12 });
    for (let i = 0; i < 12; i++) NEAR.push({ x: -300 + R() * 2500, y: -200 + R() * 1500, z: 900 + R() * 600, r: 30 + R() * 70, a: 0.025 + R() * 0.04, h: R(), vx: (R() - 0.5) * 16, vy: -4 - R() * 8 });
    const COLORS = ['#A5F3FC', '#C4B5FD', '#F0ABFC'];
    let sprites = null;
    const makeSprites = () => SPEC_RGB.map(([r, g, b]) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
      const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `rgba(${r},${g},${b},0.8)`); gr.addColorStop(0.72, `rgba(${r},${g},${b},0.9)`);
      gr.addColorStop(0.86, `rgba(${r},${g},${b},1)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr; c.fillRect(0, 0, 128, 128); return cv;
    });
    function draw(t, o = {}) {
      // time : temps de dérive intégré (continu même quand la vitesse change) ; par défaut t × drift.
      const { gain = 1, drift = 1, beam: beamK = 1, gusts = [], wave = null, near = 1, time = t * drift } = o;
      const c = NX.cam.at(t), b = NX.fxBack.ctx, f = NX.fx.ctx;
      b.save(); b.globalCompositeOperation = 'lighter';
      const WW = 4700 * KX, HH = 2900 * KY, X0 = -1400 * KX, Y0 = -900 * KY;
      // Trois passes de couleur : peu de changements d'état, coût négligeable.
      for (let pass = 0; pass < 3; pass++) {
        b.fillStyle = COLORS[pass];
        for (const p of FAR) {
          const band = p.h < 0.55 ? 0 : p.h < 0.8 ? 1 : 2; if (band !== pass) continue;
          let x = X0 + ((p.x * KX - X0 + p.vx * time) % WW + WW) % WW, y = Y0 + ((p.y * KY - Y0 + p.vy * time) % HH + HH) % HH;
          let { x: sx, y: sy, s } = NX.cam.project(x, y, p.z, c);
          for (const g of gusts) {
            if (t < g.t0) continue; const k = t - g.t0, dx = sx - g.x, dy = sy - g.y, r = Math.hypot(dx, dy) || 1;
            const push = g.amp * Math.exp(-3 * k) * (1 - Math.exp(-8 * k)); sx += dx / r * push; sy += dy / r * push;
          }
          if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
          const beam = Math.exp(-Math.pow((sx - OX) / (420 + 0.9 * Math.max(0, sy)), 2));
          const tw = 0.6 + 0.4 * Math.sin(t * (1.3 + p.h * 2) + p.ph);
          let a = p.a * tw * (0.25 + 0.75 * Math.min(1, beam * beamK)) * gain;
          if (wave) { const r = Math.hypot(sx - wave.x, sy - wave.y); a *= 1 + (wave.gain || 2.5) * Math.exp(-Math.pow((r - wave.R) / (wave.w || 40), 2)); }
          if (a <= 0.004) continue;
          b.globalAlpha = Math.min(1, a);
          const r = Math.max(0.7, p.s * s); b.fillRect(sx - r / 2, sy - r / 2, r, r);
        }
      }
      b.restore();
      if (near <= 0) return;
      if (!sprites) sprites = makeSprites();
      f.save(); f.globalCompositeOperation = 'lighter';
      for (const p of NEAR) {
        const { x: sx, y: sy, s } = NX.cam.project(p.x * KX + p.vx * t, p.y * KY + p.vy * t, p.z, c), r = p.r * s;
        if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) continue;
        f.globalAlpha = Math.min(0.065, p.a) * near;
        f.drawImage(sprites[Math.min(3, Math.floor(p.h * 4))], sx - r, sy - r, 2 * r, 2 * r);
      }
      f.restore();
    }
    return { draw, far: FAR, near: NEAR };
  })();

  /* ====================================================================================
   * Lumière (canvas fx, additif) : halos, reflet anamorphique, anneaux, étincelles, étoiles, faisceaux.
   * Toutes les coordonnées sont en px écran (utiliser NX.cam.project pour un point du monde).
   * ==================================================================================== */
  const SPEC_RGB = [[103, 232, 249], [129, 140, 248], [167, 139, 250], [232, 121, 249]];
  const tri = x => Math.abs(((x % 1) + 1) % 1 * 2 - 1);
  const fx = () => NX.fx.ctx;
  NX.lk = {
    /** Couleur du spectre de marque à x ∈ [0,1], en [r,g,b]. */
    rgb(x) { x = NX.clamp(x) * 3; const i = Math.min(2, Math.floor(x)), f = x - i; return SPEC_RGB[i].map((v, k) => v + (SPEC_RGB[i + 1][k] - v) * f); },
    glow(x, y, r, rgb, a, ctx = fx()) {
      if (a <= 0.002 || r <= 0.5) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${Math.min(1, a)})`);
      g.addColorStop(0.35, `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${Math.min(1, a) * 0.35})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
    },
    /** Reflet anamorphique : traînée large et douce, ligne chaude fine, cœur, deux fantômes. k = intensité 0..1. */
    flare(x, y, k, { width = 1, tint = [103, 232, 249], ghosts = false } = {}) {
      if (k <= 0.003) return;
      const c = fx(); c.save(); c.globalCompositeOperation = 'lighter';
      const ell = (sx, sy, stops) => {
        c.setTransform(sx, 0, 0, sy, x, y);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); for (const [o, col] of stops) g.addColorStop(o, col);
        c.fillStyle = g; c.fillRect(-1, -1, 2, 2);
      };
      ell(1920 * 0.55 * width, 34, [[0, `rgba(170,240,255,${0.42 * k})`], [0.3, `rgba(${tint},${0.16 * k})`], [1, 'rgba(0,0,0,0)']]);
      ell(1920 * 0.85 * width, 2.4, [[0, `rgba(255,255,255,${0.95 * k})`], [0.12, `rgba(190,245,255,${0.75 * k})`], [0.45, `rgba(129,140,248,${0.28 * k})`], [1, 'rgba(0,0,0,0)']]);
      c.restore();
      NX.lk.glow(x, y, 120, [235, 252, 255], 0.75 * k);
      if (ghosts) {
        NX.lk.glow(OX + (OX - x) * 0.6, OY + (OY - y) * 0.6, 46, [167, 139, 250], 0.12 * k);
        NX.lk.glow(OX + (OX - x) * 1.1, OY + (OY - y) * 1.1, 22, [232, 121, 249], 0.10 * k);
      }
    },
    /** Anneau d'onde de choc au dégradé de marque ; tilt < 1 le couche sur un sol. */
    ring(x, y, r, w, a, { tilt = 1, rot = 0 } = {}) {
      if (a <= 0.003 || r <= 1) return;
      const c = fx(); c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createConicGradient(rot, x, y);
      for (let i = 0; i <= 8; i++) { const [R, G, B] = NX.lk.rgb(tri(i / 8)); g.addColorStop(i / 8, `rgba(${R | 0},${G | 0},${B | 0},${a})`); }
      c.beginPath(); c.ellipse(x, y, r, r * tilt, 0, 0, Math.PI * 2);
      c.strokeStyle = g; c.globalAlpha = 0.2; c.lineWidth = w * 6; c.stroke();
      c.globalAlpha = 1; c.lineWidth = w; c.stroke();
      c.strokeStyle = `rgba(255,255,255,${0.7 * a})`; c.lineWidth = Math.max(0.8, w * 0.35); c.stroke();
      c.restore();
    },
    /** Étincelles analytiques (traînée + gravité), dessinées en traits de vitesse. tau = temps depuis l'émission. */
    sparks(seed, n, x0, y0, tau, o = {}) {
      if (tau < 0) return;
      const { v = [300, 1000], drag = 3, grav = 160, life = [0.45, 1.1], len = 0.03, w = 1.8, hue = [0, 1], dir = 0, spread = Math.PI * 2, squash = 1, gain = 1 } = o;
      const r = NX.rng(seed), c = fx(); c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        // tous les tirages avant tout « continue » : la suite reste identique quelle que soit l'image
        const a = dir + (r() - 0.5) * spread, sp = v[0] + (v[1] - v[0]) * Math.pow(r(), 1.6), L = life[0] + (life[1] - life[0]) * r(), h = hue[0] + (hue[1] - hue[0]) * r();
        if (tau > L) continue;
        const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * squash, f = (1 - Math.exp(-drag * tau)) / drag, e = Math.exp(-drag * tau);
        const px = x0 + vx * f, py = y0 + vy * f + 0.5 * grav * tau * tau, cvx = vx * e, cvy = vy * e + grav * tau, fade = 1 - tau / L, [R, G, B] = NX.lk.rgb(h);
        c.strokeStyle = `rgba(${(R + 255) >> 1},${(G + 255) >> 1},${(B + 255) >> 1},${fade * fade * gain})`;
        c.lineWidth = w * (0.5 + 0.5 * fade);
        c.beginPath(); c.moveTo(px - cvx * len, py - cvy * len); c.lineTo(px, py); c.stroke();
      }
      c.restore();
    },
    /** Étoile de reflet à quatre branches. g = intensité 0..1, rot en degrés. */
    star(x, y, g, { size = 1, rot = 0, rgb = [220, 245, 255] } = {}) {
      if (g <= 0.003) return;
      const c = fx(); c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate(rot * RAD);
      const bar = (len, th, a) => {
        const gr = c.createLinearGradient(-len, 0, len, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(${rgb},${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; c.fillRect(-len, -th / 2, 2 * len, th);
      };
      bar(120 * size, 2, 0.9 * g); c.rotate(Math.PI / 2); bar(60 * size, 2, 0.9 * g);
      c.rotate(Math.PI / 4); bar(30 * size, 1.5, 0.35 * g); c.rotate(Math.PI / 2); bar(30 * size, 1.5, 0.35 * g);
      c.restore();
      NX.lk.glow(x, y, 26 * size, [235, 252, 255], 0.8 * g);
    },
    /** Faisceau trapézoïdal de (x0,y0) à (x1,y1), largeurs w0 → w1, dégradé transversal. */
    beam(x0, y0, x1, y1, w0, w1, a, rgb = [165, 243, 252], ctx = fx()) {
      if (a <= 0.003) return;
      const c = ctx, ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x0, y0); c.rotate(ang);
      const wm = Math.max(w0, w1), gr = c.createLinearGradient(0, -wm / 2, 0, wm / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, `rgba(${rgb},${a * 0.5})`); gr.addColorStop(0.5, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.7, `rgba(${rgb},${a * 0.5})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, -w0 / 2); c.lineTo(len, -w1 / 2); c.lineTo(len, w1 / 2); c.lineTo(0, w0 / 2); c.closePath(); c.fill();
      c.restore();
    },
  };

  /* ====================================================================================
   * Échantillonnage déterministe des vraies images (pour les morphoses de particules).
   * NX.sample(img, n, seed, res, thr) : points pondérés par alpha × luminance (ignore la plaque sombre du logo).
   * NX.sampleSvg(svg, n, seed) : points dans une icône SVG en ligne (viewBox 0 0 34 34), opacités respectées.
   * Retour : [{ u, v, rgb? }] avec u, v ∈ [0,1]. À appeler hors du temps (build, layout ou premier rendu).
   * ==================================================================================== */
  const cache = {};
  function cdfSample(w, Wd, Hd, n, seed) {
    const cdf = new Float64Array(w.length); let s = 0;
    for (let i = 0; i < w.length; i++) { s += w[i]; cdf[i] = s; }
    const r = NX.rng(seed), out = [];
    for (let k = 0; k < n; k++) {
      const x = r() * s; let lo = 0, hi = w.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < x) lo = mid + 1; else hi = mid; }
      out.push({ u: ((lo % Wd) + r()) / Wd, v: (((lo / Wd) | 0) + r()) / Hd, i: lo });
    }
    return out;
  }
  NX.sample = (img, n, seed, res = 256, thr = 0.28) => {
    const key = `${img.src}|${n}|${seed}|${res}|${thr}`; if (cache[key]) return cache[key];
    const Hd = Math.round(res * img.naturalHeight / img.naturalWidth);
    const cv = document.createElement('canvas'); cv.width = res; cv.height = Hd;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0, res, Hd);
    const d = c.getImageData(0, 0, res, Hd).data, w = new Float32Array(res * Hd);
    for (let i = 0; i < w.length; i++) {
      const a = d[i * 4 + 3] / 255, l = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255 * a;
      w[i] = l > thr ? Math.pow(l, 1.6) : 0;
    }
    return (cache[key] = cdfSample(w, res, Hd, n, seed).map(p => ({ u: p.u, v: p.v, rgb: [d[p.i * 4], d[p.i * 4 + 1], d[p.i * 4 + 2]] })));
  };
  NX.sampleSvg = (svg, n, seed, res = 136) => {
    const key = `svg|${svg}|${n}|${seed}|${res}`; if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = res;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.scale(res / 34, res / 34);
    const re = /<(path|polygon)([^>]*)\/>/g; let m;
    while ((m = re.exec(svg))) {
      const at = m[2], op = /opacity="([^"]+)"/.exec(at), fr = /fill-rule="([^"]+)"/.exec(at);
      let dd;
      if (m[1] === 'path') dd = /\sd="([^"]+)"/.exec(at)[1];
      else { const p = /points="([^"]+)"/.exec(at)[1].trim().split(/[\s,]+/).map(Number); dd = 'M' + p[0] + ' ' + p[1]; for (let i = 2; i < p.length; i += 2) dd += 'L' + p[i] + ' ' + p[i + 1]; dd += 'Z'; }
      c.globalAlpha = op ? +op[1] : 1; c.fillStyle = '#fff'; c.fill(new Path2D(dd), fr ? fr[1] : 'nonzero');
    }
    const px = c.getImageData(0, 0, res, res).data, w = new Float32Array(res * res);
    for (let i = 0; i < w.length; i++) w[i] = px[i * 4 + 3] / 255;
    return (cache[key] = cdfSample(w, res, res, n, seed).map(p => ({ u: p.u, v: p.v })));
  };
  /** Image décodée prête à échantillonner (charge une fois, partage les instances). */
  const imgs = {};
  NX.image = src => { if (!imgs[src]) { const i = new Image(); i.src = src; imgs[src] = i; } return imgs[src]; };
  NX.imageRegistry = () => Object.values(imgs);

  /* ====================================================================================
   * Tampon de particules additif : des milliers de points pour un seul drawImage.
   * NX.px.begin() ; NX.px.dot(x, y, r, g, b) (couleurs 0..1, s'additionnent) ; NX.px.line(...) ; NX.px.end(ctx).
   * Remis à zéro à chaque begin : aucune lumière ne fuit d'un rendu à l'autre.
   * ==================================================================================== */
  NX.px = (function () {
    const acc = new Float32Array(W * H * 3);
    let cv, cx, x0 = 0, y0 = 0, x1 = -1, y1 = -1;
    const P = {};
    P.begin = () => {
      if (!cv) { cv = document.createElement('canvas'); cv.width = W; cv.height = H; cx = cv.getContext('2d', { willReadFrequently: true }); }
      acc.fill(0); x0 = W; y0 = H; x1 = -1; y1 = -1;
    };
    P.dot = (x, y, r, g, b) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) return;
      const fx = x - ix, fy = y - iy, a = (1 - fx) * (1 - fy), bb = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
      let i = (iy * W + ix) * 3;
      acc[i] += r * a; acc[i + 1] += g * a; acc[i + 2] += b * a;
      acc[i + 3] += r * bb; acc[i + 4] += g * bb; acc[i + 5] += b * bb;
      i += W * 3;
      acc[i] += r * c; acc[i + 1] += g * c; acc[i + 2] += b * c;
      acc[i + 3] += r * d; acc[i + 4] += g * d; acc[i + 5] += b * d;
      if (ix < x0) x0 = ix; if (ix > x1) x1 = ix; if (iy < y0) y0 = iy; if (iy > y1) y1 = iy;
    };
    /** Point épais : disque de rayon rad (px) avec cœur plus dense. */
    P.blob = (x, y, rad, r, g, b) => {
      if (rad <= 0.8) { P.dot(x, y, r, g, b); return; }
      const n = Math.ceil(rad), k = 1 / (rad * rad);
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
        const q = (i * i + j * j) * k; if (q > 1) continue; const f = (1 - q) * (1 - q);
        P.dot(x + i, y + j, r * f, g * f, b * f);
      }
    };
    P.line = (xa, ya, xb, yb, r, g, b) => {
      const n = Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya)));
      for (let k = 0; k <= n; k++) { const u = k / n; P.dot(xa + (xb - xa) * u, ya + (yb - ya) * u, r / (n + 1) * 2, g / (n + 1) * 2, b / (n + 1) * 2); }
    };
    P.end = ctx => {
      if (x1 < x0) return;
      const w = x1 - x0 + 2, h = y1 - y0 + 2, img = cx.createImageData(w, h), o8 = img.data;
      for (let y = 0; y < h; y++) {
        let i = ((y0 + y) * W + x0) * 3, o = y * w * 4;
        for (let x = 0; x < w; x++, i += 3, o += 4) {
          const r = acc[i], g = acc[i + 1], b = acc[i + 2], m = r > g ? (r > b ? r : b) : (g > b ? g : b);
          if (m <= 0.002) { o8[o + 3] = 0; continue; }
          const A = m < 1 ? m : 1, k = 255 / m;
          o8[o] = r * k; o8[o + 1] = g * k; o8[o + 2] = b * k; o8[o + 3] = A * 255;
        }
      }
      cx.putImageData(img, x0, y0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
      ctx.drawImage(cv, x0, y0, w, h, x0, y0, w, h); ctx.restore();
    };
    return P;
  })();

  /* ====================================================================================
   * Typographie : lignes masquées (le texte monte et sort à travers sa ligne), interlettrage, reflet.
   * Écrire les titres avec une ligne par élément .tz-line ; NX.type.prepare(el) découpe les mots
   * et ajoute les masques. Les jambages (g, p, q) et accents (É, ê, ’) ne sont jamais rognés.
   * ==================================================================================== */
  NX.css(`
  .tz-line{display:block;overflow:hidden;padding:.14em .08em .24em;margin:-.14em -.08em -.24em}
  `);
  const ENTER = NX.bezier(0.16, 1, 0.3, 1), EXIT = NX.bezier(0.7, 0, 0.84, 0);
  NX.ease.enter = ENTER; NX.ease.exit = EXIT;
  NX.ease.glide = NX.bezier(0.33, 0, 0.2, 1);       // objets qui changent de place
  NX.ease.advance = NX.bezier(0.2, 0.9, 0.25, 1.06); // cartes qui avancent dans la pile (~2 % de dépassement)
  NX.ease.lift = NX.bezier(0.45, 0, 0.75, 0.6);      // ce qui est pris dans la lumière
  NX.ease.sheen = NX.bezier(0.45, 0, 0.25, 1);       // reflets et balayages
  NX.ease.sine = p => 0.5 - 0.5 * Math.cos(Math.PI * NX.clamp(p));
  NX.type = {
    /** Découpe chaque .tz-line du bloc en mots ; retourne { lines: [[mots]], words: [mots] }. */
    prepare(block) {
      const lines = [...block.querySelectorAll('.tz-line')].map(l => NX.split(l, 'words').words);
      return { lines, words: lines.flat() };
    },
    /** Les mots montent depuis le bas de leur ligne. start, stagger, dur en secondes. */
    rise(words, t, start, stagger = 0.14, dur = 0.8, ease = ENTER) {
      words.forEach((w, i) => {
        const e = ease(NX.seg(t, start + i * stagger, start + i * stagger + dur));
        w.style.transform = e >= 1 ? '' : `translateY(${((1 - e) * 112).toFixed(2)}%)`;
        w.style.opacity = NX.clamp(e * 2.2);
      });
    },
    /** Les mots sortent par le haut de leur ligne. */
    sink(words, t, start, stagger = 0.04, dur = 0.4, ease = EXIT) {
      if (t < start) return;
      words.forEach((w, i) => {
        const e = ease(NX.seg(t, start + i * stagger, start + i * stagger + dur));
        if (e <= 0) return;
        w.style.transform = `translateY(${(-e * 112).toFixed(2)}%)`;
        // Le mot s'efface avant le dernier tiers, le plus rapide, de sa course : aucun reste de jambage.
        w.style.opacity = 1 - NX.smooth(0.3, 0.7, e);
      });
    },
    /** Interlettrage qui se resserre pendant la tenue (em). */
    track(el, t, a, b, from = -0.012, to = -0.032) {
      el.style.letterSpacing = `${NX.lerp(from, to, NX.ease.outCubic(NX.seg(t, a, b))).toFixed(4)}em`;
    },
    /** Reflet qui traverse les mots en dégradé (.nx-spec) de gauche à droite entre a et b (SHEEN).
     *  La bande parcourt −0,62 → +0,62 de la boîte du mot : environ 0,8 s par passage, sans scintillement. */
    sheen(specEl, t, a, b, strength = 0.35) {
      const p = NX.seg(t, a, b), on = p > 0 && p < 1;
      for (const w of specEl.querySelectorAll('.nx-word, .nx-char')) {
        const d = w.dataset; if (!d.bw) continue;
        if (!on) { w.style.backgroundImage = 'var(--spectrum-text)'; w.style.backgroundSize = `${d.bw}px ${d.bh}px`; w.style.backgroundPosition = `${d.dx}px ${d.dy}px`; w.style.backgroundRepeat = ''; continue; }
        const bw = +d.bw, sx = +d.dx + NX.lerp(-0.62, 0.62, NX.ease.sheen(p)) * bw;
        w.style.backgroundImage = `linear-gradient(100deg,transparent 40%,rgba(255,255,255,${strength}) 50%,transparent 60%),var(--spectrum-text)`;
        w.style.backgroundSize = `${bw}px ${d.bh}px,${bw}px ${d.bh}px`;
        w.style.backgroundPosition = `${sx.toFixed(2)}px ${d.dy}px,${d.dx}px ${d.dy}px`;
        w.style.backgroundRepeat = 'no-repeat,no-repeat';
      }
    },
  };

  /* ====================================================================================
   * Matière « verre » commune aux cartes (rôles, outils) : plaque, liseré éclairé d'en haut, reflet, ombre.
   * NX.glass(html, { w, h, color, wash }) crée la carte ; .gl-content reçoit le contenu.
   * Ne jamais mettre opacity, filter, overflow ou mask sur un conteneur preserve-3d :
   * fondre avec NX.glassFade, éclairer avec NX.glassLight (dans cet ordre, à chaque image).
   * ==================================================================================== */
  NX.css(`
  .gl{position:absolute;transform-style:preserve-3d}
  .gl>*{position:absolute;inset:0;border-radius:16px}
  .gl-shadow{inset:auto -10% -18% -10%!important;height:40%;border-radius:50%!important;background:radial-gradient(closest-side,rgba(0,0,0,.55),transparent);transform:translateZ(-30px)}
  .gl-glow{inset:-18%!important;border-radius:50%!important;background:radial-gradient(closest-side,var(--gl-color,rgba(103,232,249,.35)),transparent)}
  .gl-plate{background:linear-gradient(180deg,rgba(22,38,64,.96),rgba(9,19,34,.97) 38%,rgba(8,16,30,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
  .gl-content{transform-style:preserve-3d;transform:translateZ(1px)}
  .gl-sheen{overflow:hidden;mix-blend-mode:plus-lighter;transform:translateZ(2px)}
  .gl-sheen i{position:absolute;inset:0;width:260%;left:-80%;background:linear-gradient(112deg,transparent 30%,rgba(170,215,255,.06) 42%,rgba(225,242,255,.20) 50%,rgba(170,215,255,.06) 58%,transparent 70%)}
  .gl-rim{padding:1.5px;transform:translateZ(2px);background:linear-gradient(var(--rim,180deg),rgba(186,240,255,.75),rgba(129,140,248,.22) 30%,rgba(154,182,218,.10) 65%,rgba(232,121,249,.30));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
  .gl-wash{mix-blend-mode:plus-lighter;opacity:0;transform:translateZ(4px);background:linear-gradient(170deg,rgba(170,220,255,.38),rgba(170,220,255,.10) 45%,transparent 75%)}
  .gl-fog{background:rgb(5,11,24);opacity:0;transform:translateZ(3px)}
  `);
  NX.glass = (html, { w, h, color, wash = false } = {}) => {
    const el = NX.el(`<div class="gl" style="width:${w}px;height:${h}px;${color ? `--gl-color:${color}` : ''}">
      <div class="gl-shadow"></div><div class="gl-glow"></div><div class="gl-plate"></div>
      <div class="gl-content">${html}</div><div class="gl-sheen"><i></i></div><div class="gl-rim"></div>${wash ? '<div class="gl-wash"></div>' : ''}<div class="gl-fog"></div></div>`);
    const q = s => el.querySelector(s);
    return { el, a: 1, shadow: q('.gl-shadow'), glow: q('.gl-glow'), plate: q('.gl-plate'), content: q('.gl-content'), sheen: q('.gl-sheen'), band: q('.gl-sheen i'), rim: q('.gl-rim'), wash: q('.gl-wash'), fog: q('.gl-fog') };
  };
  /** Seule façon de fondre une carte de verre : chaque feuille reçoit l'opacité, jamais le conteneur 3D. */
  NX.glassFade = (g, a) => {
    g.a = NX.clamp(a);
    for (const k of ['shadow', 'plate', 'content']) g[k].style.opacity = g.a;
  };
  /** Lumière de la carte. pos ∈ [-1, 1] fait glisser le reflet ; lit, rimGain, glow, wash, fog : gains ;
   *  rimAngle en degrés (180 = éclairée d'en haut) ; vis multiplie tout (et l'opacité posée par glassFade). */
  NX.glassLight = (g, { pos = 0, lit = 1, rimAngle = 180, rimGain = 1, fog = 0, glow = 0, wash = 0, vis = 1 } = {}) => {
    const k = vis * (g.a ?? 1);
    g.band.style.transform = `translateX(${(pos * 30).toFixed(2)}%)`;
    g.sheen.style.opacity = NX.clamp(lit * k);
    g.rim.style.setProperty('--rim', `${rimAngle.toFixed(1)}deg`);
    g.rim.style.opacity = NX.clamp(rimGain * k);
    g.fog.style.opacity = NX.clamp(fog * k);
    g.glow.style.opacity = NX.clamp(glow * k);
    if (g.wash) g.wash.style.opacity = NX.clamp(wash * k);
  };

  /* ====================================================================================
   * Ciel couplé à la caméra : la seule formule qui relie le ciel WebGL et la caméra (bible §3.2).
   * NX.sky.at(t) → { zoom, cx, cy } pour NX.bg ; NX.sky.src(t) → source des rayons en px écran.
   * ==================================================================================== */
  NX.sky = {
    at(t) {
      const c = NX.cam.at(t);
      return {
        zoom: (1 + 0.10 * NX.smooth(0, NX.DURATION, t)) * (1 + 0.00008 * c.z),
        cx: -1.85 * Math.tan(c.yaw * RAD) - 0.18 * c.x / U,
        cy: -1.85 * Math.tan(c.pitch * RAD) + 0.18 * c.y / U,
      };
    },
    src(t) { const s = NX.sky.at(t); return { x: OX + U * s.cx, y: OY - U * (s.cy + NX.SKY.rayY * s.zoom), zoom: s.zoom }; },
  };

  /* ====================================================================================
   * Accent d'impact sobre (bible §3.5) : un halo de cœur et une seule traînée anamorphique.
   * x, y : coordonnées écran du cœur du héros. Les rayons, l'avancée et la poussière sont dans « ciel ».
   * ==================================================================================== */
  NX.hit = (t, h, x, y, { flare = 0.6, core = 420, coreA = 0.4, tint = [103, 232, 249], width = 1, s = 1 } = {}) => {
    const tau = t - h; if (tau < 0 || tau >= 1.5) return;
    NX.lk.glow(x, y, core * s, [200, 240, 255], coreA * Math.exp(-5 * tau));
    NX.lk.flare(x, y, flare * Math.exp(-3 * tau), { tint, width });
  };

  /* ====================================================================================
   * Lumière sur les logos (images matricielles jamais redessinées) — v2 (bible §3.4).
   * Feuilles dans une boîte plate positionnée : forge (silhouette de lumière, effacée par le front),
   * img (le PNG, écrit par le front), hot (bande blanche qui suit le front), lum (surexposition légère),
   * sweep (le reflet unique de la tenue). Toutes en plus-lighter, masquées par les traits clairs.
   * À appeler : L.prepare() une fois (dans prepare), puis L.frame({...}) à chaque image.
   * ==================================================================================== */
  const maskCache = {};
  function brightMask(img) {
    if (maskCache[img.src]) return maskCache[img.src];
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
    const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255, a = d[i + 3] / 255;
      const k = NX.smooth(0.35, 0.65, l) * a;
      d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(k * 255);
    }
    c.putImageData(im, 0, 0);
    return (maskCache[img.src] = cv.toDataURL('image/png'));
  }
  const setMask = (el, layers, composite) => {
    const m = layers.filter(Boolean);
    const v = m.length ? m.join(',') : '';
    el.style.maskImage = v; el.style.webkitMaskImage = v;
    el.style.maskSize = m.map(() => '100% 100%').join(','); el.style.webkitMaskSize = el.style.maskSize;
    el.style.maskRepeat = 'no-repeat'; el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskComposite = m.length > 1 ? (composite || 'intersect') : '';
    el.style.webkitMaskComposite = m.length > 1 ? 'source-in' : '';
  };
  NX.logoLight = (box, src) => {
    const leaf = (z, extra = '') => NX.el(`<div style="position:absolute;inset:0;opacity:0;mix-blend-mode:plus-lighter;transform:translateZ(${z}px);${extra}"></div>`, box);
    const forge = leaf(1, 'background:rgb(205,245,255)');
    const img = NX.el(`<img src="${src}" alt="" style="position:absolute;inset:0;width:100%;height:100%;transform:translateZ(2px)">`, box);
    const hot = leaf(3);
    const lum = leaf(3.5, 'background:rgb(200,240,255)');
    const sweep = leaf(4, 'overflow:hidden');
    const band = NX.el(`<div style="position:absolute;top:-10%;bottom:-10%;left:0;width:34%;background:linear-gradient(105deg,transparent,rgba(165,243,252,.35) 35%,rgba(255,255,255,.95) 50%,rgba(196,181,253,.35) 65%,transparent)"></div>`, sweep);
    const L = { box, img, forge, hot, lum, sweep, band, url: null };
    L.prepare = async () => {
      await img.decode().catch(() => {});
      L.url = `url(${brightMask(img)})`;
      for (const el of [hot, lum, sweep]) setMask(el, [L.url]);
      setMask(forge, [L.url]);
    };
    /** front : repère local du front (NX.light.local…) ou null ; written : PNG visible sans front ;
     *  forge, hot, lum : intensités 0..1 ; sweepP ∈ (0,1) position du reflet ; gate : couche de masque en plus sur le PNG. */
    L.frame = ({ front = null, written = true, forge: fA = 0, hot: hA = 0, lum: lA = 0, sweepP = -1, sweepA = 0.316, gate = null, lead = 0 } = {}) => {
      if (front) {
        setMask(img, [NX.light.mask(front, 'write', { feather: 70 }), gate]);
        img.style.opacity = 1;
        setMask(forge, [L.url, NX.light.mask(front, 'burn', { feather: 60, lead })]);
        hot.style.background = NX.light.band(front);
      } else {
        setMask(img, [gate]);
        img.style.opacity = written ? 1 : 0;
        setMask(forge, [L.url]);
      }
      forge.style.opacity = NX.clamp(fA);
      hot.style.opacity = front ? NX.clamp(hA) : 0;
      lum.style.opacity = NX.clamp(lA);
      const on = sweepP > 0 && sweepP < 1;
      sweep.style.opacity = on ? NX.clamp(sweepA) : 0;
      if (on) band.style.transform = `translateX(${NX.lerp(-110, 300, sweepP).toFixed(2)}%)`;
    };
    return L;
  };

  /* ====================================================================================
   * Front de lumière elliptique (bible §3.3) : centré sur la source des rayons, demi-axe horizontal
   * K = 2,5 fois le vertical. R(t) = rayon vertical en px écran (pistes NX.FRONT).
   * Un repère local L = { cx, cy, r } décrit le front dans l'espace d'un élément plat.
   * ==================================================================================== */
  const K = 2.5, RM = 3000;
  const px = v => v.toFixed(1) + 'px', pc = v => (100 * v / RM).toFixed(3) + '%';
  const shape = L => `ellipse ${px(K * RM)} ${px(RM)} at ${px(L.cx)} ${px(L.cy)}`;
  NX.light = {
    K,
    src: t => NX.sky.src(t),
    /** Distance elliptique en px écran d'un point écran à la source s. */
    dist: (x, y, s) => Math.hypot((x - s.x) / K, y - s.y),
    /** Front dans l'espace local d'un élément plat dont le coin haut-gauche est au point monde (X, Y, Z). */
    local(X, Y, Z, R, t) { const o = NX.cam.project(X, Y, Z), s = NX.light.src(t); return { cx: (s.x - o.x) / o.s, cy: (s.y - o.y) / o.s, r: R / o.s }; },
    /** Carte tournée : o = origine locale projetée, sC = échelle projetée au centre de la carte. */
    localCard(o, sC, R, t) { const s = NX.light.src(t); return { cx: (s.x - o.x) / sC, cy: (s.y - o.y) / sC, r: R / sC }; },
    /** Chaîne de dégradé de masque : 'write' visible à l'intérieur du front, 'burn' effacé à l'intérieur. */
    mask(L, mode, { feather = mode === 'write' ? 70 : 60, lead = 0 } = {}) {
      return mode === 'write'
        ? `radial-gradient(${shape(L)},#000 ${pc(L.r - feather)},transparent ${pc(L.r + 10)})`
        : `radial-gradient(${shape(L)},transparent ${pc(L.r + lead - 10)},#000 ${pc(L.r + lead + feather)})`;
    },
    write(el, L, { feather = 70, extra = null } = {}) { setMask(el, [NX.light.mask(L, 'write', { feather }), extra]); },
    burn(el, L, { feather = 60, lead = 0 } = {}) { setMask(el, [NX.light.mask(L, 'burn', { feather, lead })]); },
    clear(el) { setMask(el, []); },
    /** Fond de la bande blanche qui suit le front. */
    band(L, lead = 0) {
      const r = L.r + lead;
      return `radial-gradient(${shape(L)},transparent ${pc(r - 170)},rgba(150,215,255,.28) ${pc(r - 70)},rgba(200,240,255,.75) ${pc(r - 18)},#fff ${pc(r - 3)},transparent ${pc(r + 12)})`;
    },
    /** Premier t (pas de 5 ms) où le front atteint le point monde (X, Y, Z). À n'appeler que dans prepare(). */
    when(track, X, Y, Z = 0, { off = 0, t0 = 0, t1 = NX.DURATION } = {}) {
      for (let t = t0; t <= t1; t += 0.005) {
        const c = NX.cam.at(t), p = NX.cam.project(X, Y, Z, c), s = NX.light.src(t);
        if (track(t) + off >= NX.light.dist(p.x, p.y, s)) return t;
      }
      return t1;
    },
    /** Lueur des glyphes au passage du front. centres : points monde [X, Y, Z] de chaque mot. */
    wordGlow(words, centres, R, t, lead = 0) {
      const s = NX.light.src(t);
      words.forEach((w, i) => {
        const [X, Y, Z = 0] = centres[i], p = NX.cam.project(X, Y, Z), d = NX.light.dist(p.x, p.y, s);
        const g = Math.exp(-Math.pow((R + lead - d) / 70, 2));
        w.style.textShadow = g < 0.03 ? '' : `0 0 ${(10 + 26 * g).toFixed(1)}px rgba(165,243,252,${(0.85 * g).toFixed(3)})`;
      });
    },
    /** Ancienne API (front horizontal), conservée pour compatibilité. */
    front(t, t0, yTop, yBot, dur = 0.75) { return NX.lerp(yTop, yBot, NX.ease.front(NX.seg(t, t0, t0 + dur))); },
  };
  NX.ease.front = NX.bezier(0.3, 0, 0.12, 1);

  /* ====================================================================================
   * Typographie : compteur à rouleau (« 01 » → « 02 »). col = .tz-odo contenant 1, 2, 3 empilés.
   * ==================================================================================== */
  NX.css(`
  .tz-hair{display:inline-block;width:48px;height:2px;background:var(--primary);vertical-align:middle;margin-right:18px;transform-origin:0 50%}
  .tz-odo{display:inline-block;height:1.15em;overflow:hidden;vertical-align:top}
  .tz-odo b{display:block;height:1.15em;font-weight:inherit}
  `);
  NX.type.odometer = (col, t, a, from, to, dur = 0.45) => {
    const d = NX.lerp(from, to, NX.ease.sine(NX.seg(t, a, a + dur)));
    col.firstElementChild.style.transform = `translateY(${(-(d - 1) * 100).toFixed(2)}%)`;
    for (const b of [...col.children].slice(1)) b.style.transform = col.firstElementChild.style.transform;
  };
})();
