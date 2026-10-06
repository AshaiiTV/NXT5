/* NXT5 teaser engine — tout le film est une fonction pure de t (secondes).
 * Aucune scène ne doit garder d'état entre deux appels de render : même t → même image. */
(function () {
  const NX = (window.NX = {});
  NX.W = 1920; NX.H = 1080; NX.FPS = 30; NX.DURATION = 33.6;
  /* v6 : 100 BPM, un temps = 0,6 s, une mesure = 2,4 s. Le film dure 14 mesures. */
  NX.BPM = 100; NX.BEAT = 0.6; NX.BAR = 2.4;
  NX.beat = n => n * NX.BEAT;
  NX.bar = n => n * NX.BAR;

  /* ---------- Maths ---------- */
  const clamp = (NX.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)));
  NX.lerp = (a, b, p) => a + (b - a) * p;
  NX.mix = NX.lerp;
  NX.seg = (t, a, b) => clamp((t - a) / (b - a));
  NX.map = (v, a, b, c, d, doClamp = true) => { const p = (v - a) / (b - a); return c + (d - c) * (doClamp ? clamp(p) : p); };
  NX.smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
  /** Enveloppe : monte de a→b, tient, redescend de c→d. */
  NX.env = (t, a, b, c, d, ein = NX.ease.outCubic, eout = NX.ease.inOutCubic) =>
    Math.min(ein(NX.seg(t, a, b)), 1 - eout(NX.seg(t, c, d)));
  /** Pulsation calée sur le tempo : 1 au temps, décroît ensuite. */
  NX.pulse = (t, period = NX.BEAT, decay = 8, offset = 0) => {
    const x = ((t - offset) % period + period) % period;
    return Math.exp(-x * decay);
  };

  /* ---------- Courbes ---------- */
  const E = (NX.ease = {
    linear: p => p,
    inQuad: p => p * p, outQuad: p => 1 - (1 - p) * (1 - p),
    inOutQuad: p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    inCubic: p => p * p * p, outCubic: p => 1 - Math.pow(1 - p, 3),
    inOutCubic: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inQuart: p => p ** 4, outQuart: p => 1 - Math.pow(1 - p, 4),
    inOutQuart: p => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
    inQuint: p => p ** 5, outQuint: p => 1 - Math.pow(1 - p, 5),
    inOutQuint: p => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2),
    inExpo: p => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
    outExpo: p => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutExpo: p => (p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
    inCirc: p => 1 - Math.sqrt(1 - p * p), outCirc: p => Math.sqrt(1 - Math.pow(p - 1, 2)),
    inBack: (p, s = 1.70158) => (s + 1) * p ** 3 - s * p * p,
    outBack: (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
    inOutBack: (p, s = 1.70158 * 1.525) => (p < 0.5
      ? (Math.pow(2 * p, 2) * ((s + 1) * 2 * p - s)) / 2
      : (Math.pow(2 * p - 2, 2) * ((s + 1) * (p * 2 - 2) + s) + 2) / 2),
    outElastic: (p, amp = 1, period = 0.3) => {
      if (p === 0 || p === 1) return p;
      return amp * Math.pow(2, -10 * p) * Math.sin(((p - period / 4) * (2 * Math.PI)) / period) + 1;
    },
    /** Ressort amorti : p en secondes normalisées (0..1 ≈ durée), renvoie ~1 à la fin. */
    spring: (p, freq = 4.5, damp = 5) => (p <= 0 ? 0 : 1 - Math.exp(-damp * p) * Math.cos(freq * 2 * Math.PI * p)),
  });
  /** Équivalent CSS cubic-bezier(x1,y1,x2,y2). */
  NX.bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = u => ((ax * u + bx) * u + cx) * u, sy = u => ((ay * u + by) * u + cy) * u;
    const dx = u => (3 * ax * u + 2 * bx) * u + cx;
    return p => {
      if (p <= 0) return 0; if (p >= 1) return 1;
      let u = p;
      for (let i = 0; i < 8; i++) { const e = sx(u) - p; const d = dx(u); if (Math.abs(e) < 1e-6 || !d) break; u -= e / d; }
      return sy(clamp(u));
    };
  };
  E.snappy = NX.bezier(0.7, 0, 0.2, 1);
  E.whip = NX.bezier(0.85, 0, 0.15, 1);
  E.soft = NX.bezier(0.25, 0.1, 0.25, 1);

  /* ---------- Hasard déterministe et bruit ---------- */
  NX.rng = seed => { let a = seed >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  NX.hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
  const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const perm = new Uint8Array(512); { const r = NX.rng(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  /** Bruit simplex 3D, sortie ≈ [-1, 1]. */
  NX.noise = (x, y = 0, z = 0) => {
    const F3 = 1 / 3, G3 = 1 / 6;
    const s = (x + y + z) * F3; const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3; const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; } else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; } else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; } }
    else { if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; } else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; } else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; } }
    const c = [[x0, y0, z0, 0, 0, 0], [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1], [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2], [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1]];
    let n = 0; const ii = i & 255, jj = j & 255, kk = k & 255;
    for (const [a, b, d, oi, oj, ok] of c) {
      let tt = 0.6 - a * a - b * b - d * d; if (tt < 0) continue;
      const g = grad3[perm[ii + oi + perm[jj + oj + perm[kk + ok]]] % 12];
      tt *= tt; n += tt * tt * (g[0] * a + g[1] * b + g[2] * d);
    }
    return 32 * n;
  };
  NX.fbm = (x, y = 0, z = 0, oct = 4) => { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * NX.noise(x * f, y * f, z * f); f *= 2; a *= 0.5; } return s; };

  /* ---------- Couleurs de la charte ---------- */
  NX.C = { bg: '#020611', surface: '#091322', raised: '#0E1B2E', text: '#F3F7FF', text2: '#BFCCDF', muted: '#97ABC4', cyan: '#67E8F9', peri: '#818CF8', violet: '#A78BFA', pink: '#E879F9', win: '#6EE7B7', loss: '#FDA4AF' };
  const SPEC = [[103, 232, 249], [129, 140, 248], [167, 139, 250], [232, 121, 249]];
  /** Couleur du spectre de marque à x ∈ [0,1] (cyan → pervenche → violet → fuchsia). */
  NX.spectrum = (x, alpha = 1) => {
    x = clamp(x) * 3; const i = Math.min(2, Math.floor(x)); const f = x - i;
    const c = SPEC[i].map((v, k) => Math.round(v + (SPEC[i + 1][k] - v) * f));
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  };

  /* ---------- DOM ---------- */
  NX.asset = p => 'assets/' + p;
  NX.el = (html, parent) => { const t = document.createElement('template'); t.innerHTML = html.trim(); const e = t.content.firstElementChild; if (parent) parent.appendChild(e); return e; };
  NX.css = text => { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); return s; };
  /** Découpe le texte d'un élément en mots et/ou caractères animables (préserve les <span class> internes). */
  NX.split = (el, mode = 'chars') => {
    const chars = [], words = [];
    const walk = (node, target) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span'); w.className = 'nx-word'; words.push(w);
            if (mode === 'words') w.textContent = part;
            else for (const ch of part) { const c = document.createElement('span'); c.className = 'nx-char'; c.textContent = ch; chars.push(c); w.appendChild(c); }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child, target);
      }
    };
    walk(el);
    return { chars, words };
  };
  /** Style inline rapide. */
  NX.set = (el, props) => { for (const k in props) el.style[k] = props[k]; };

  /* ---------- Scènes ---------- */
  const scenes = (NX.scenes = []);
  /**
   * NX.scene({ id, start, end, pre = 0, post = 0, z = 0, build(root, S), render(S) })
   * La scène est affichée de start-pre à end+post. S = { t, lt, p, dur, root, id, start, end }.
   * lt = t - start ; p = progression 0..1 sur [start, end] (bornée).
   */
  NX.scene = def => { scenes.push(Object.assign({ pre: 0, post: 0, z: 0 }, def)); };

  /* ---------- Paramètres partagés par image (remis à zéro à chaque image) ---------- */
  const BG_DEFAULT = { intensity: 1, nebula: 0.55, warp: 0.6, hue: 0, rays: 0, rayX: 0, rayY: 0.1, rayStrength: 1, grid: 0, gridSpeed: 0.6, gridHorizon: -0.08, tunnel: 0, tunnelSpeed: 1, stars: 0.25, zoom: 1, cx: 0, cy: 0, flash: 0, speed: 1, pulse: 0, waveX: 0, waveY: 0, waveR: 0, waveS: 0, rayFocus: 0, front: 0, frontY: 0 };
  const POST_DEFAULT = { grain: 0.16, vignette: 0.85, chroma: 0, glitch: 0, flash: 0, flashColor: '#A5F3FC', exposure: 1, saturate: 1, blur: 0, letterbox: 0, fade: 0, shake: 0, shakeFreq: 18, leak: 0, leakX: 0.78, leakY: 0.22, leakHue: 0.5 };
  NX.bg = {}; NX.post = {};
  const mixer = obj => (params, w = 1) => { for (const k in params) { const v = params[k]; obj[k] = typeof v === 'number' && typeof obj[k] === 'number' ? obj[k] + (v - obj[k]) * w : (w >= 0.5 ? v : obj[k]); } };
  /** NX.bg.mix({rays: 1}, w) : rapproche les valeurs de la cible avec un poids w ∈ [0,1]. */
  NX.bgMix = mixer(NX.bg); NX.postMix = mixer(NX.post);
  NX.bgAdd = params => { for (const k in params) NX.bg[k] += params[k]; };
  NX.postAdd = params => { for (const k in params) NX.post[k] += params[k]; };

  /* ---------- Canvas d'effets ---------- */
  NX.fx = { ctx: null };
  /** Traînée lumineuse additive. */
  NX.fx.streak = (x, y, len, angle, color, alpha = 1, width = 2) => {
    const c = NX.fx.ctx; if (alpha <= 0) return;
    const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
    const g = c.createLinearGradient(x - dx, y - dy, x, y);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, color);
    c.globalAlpha = alpha; c.strokeStyle = g; c.lineWidth = width; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x, y); c.stroke(); c.globalAlpha = 1;
  };
  /** Point lumineux doux (halo). */
  NX.fx.glow = (x, y, r, color, alpha = 1) => {
    const c = NX.fx.ctx; if (alpha <= 0 || r <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = alpha; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  };

  /* ---------- Rendu d'une image ---------- */
  let grainFrames = [], grainCtx, fxCtx, els = {};
  NX.init = () => {
    els = { stage: $('stage'), shake: $('shake'), world: $('world'), vignette: $('vignette'), grain: $('grain'), flash: $('flash'), lbT: $('lb-top'), lbB: $('lb-bot'), fade: $('fade'), leak: $('leak'), turb: $('nx-turb'), disp: $('nx-disp'), fr: $('nx-r'), fb: $('nx-b') };
    fxCtx = NX.fx.ctx = $('fx').getContext('2d');
    NX.fxBack = { ctx: $('fxback').getContext('2d') };
    grainCtx = els.grain.getContext('2d');
    const r = NX.rng(99);
    for (let f = 0; f < 8; f++) {
      const img = grainCtx.createImageData(960, 540);
      for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 150; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      grainFrames.push(img);
    }
    scenes.sort((a, b) => a.z - b.z);
    for (const s of scenes) {
      s.root = NX.el(`<div class="nx-scene" data-scene="${s.id}"></div>`, els.world);
      s.root.style.zIndex = s.z;
      // Avec la caméra, les scènes partagent un même espace 3D : un léger écart en z garde l'ordre d'empilement.
      if (NX.cam && NX.cam.active) s.root.style.transform = `translateZ(${(s.z * 0.5).toFixed(2)}px)`;
      if (s.build) s.build(s.root, s);
    }
    NX.shader && NX.shader.init($('bg'));
  };
  function $(id) { return document.getElementById(id); }

  /** Après chargement des polices : dégradé continu sur les .nx-spec découpés, puis hook layout() des scènes. */
  NX.layout = () => {
    for (const s of scenes) s.root.style.display = 'block';
    for (const spec of document.querySelectorAll('.nx-spec')) {
      const parts = spec.querySelectorAll('.nx-char, .nx-word');
      if (!parts.length) continue;
      const box = spec.getBoundingClientRect();
      for (const c of parts) {
        if (c.classList.contains('nx-word') && c.querySelector('.nx-char')) { c.style.background = 'none'; continue; }
        const r = c.getBoundingClientRect();
        NX.set(c, { backgroundImage: 'var(--spectrum-text)', backgroundSize: `${box.width}px ${box.height}px`, backgroundPosition: `${box.left - r.left}px ${box.top - r.top}px`, webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
        Object.assign(c.dataset, { bw: box.width.toFixed(2), bh: box.height.toFixed(2), dx: (box.left - r.left).toFixed(2), dy: (box.top - r.top).toFixed(2) });
      }
      spec.style.background = 'none';
    }
    for (const s of scenes) if (s.layout) s.layout(s.root, s);
    for (const s of scenes) s.root.style.display = 'none';
  };

  NX.only = null; // id de scène à isoler (tests)
  NX.render = t => {
    Object.assign(NX.bg, BG_DEFAULT); Object.assign(NX.post, POST_DEFAULT);
    NX.t = t;
    fxCtx.setTransform(1, 0, 0, 1, 0, 0); fxCtx.globalCompositeOperation = 'source-over'; fxCtx.globalAlpha = 1;
    fxCtx.clearRect(0, 0, NX.W, NX.H);
    const bctx = NX.fxBack.ctx; bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.globalCompositeOperation = 'source-over'; bctx.globalAlpha = 1; bctx.clearRect(0, 0, NX.W, NX.H);
    if (NX.cam && NX.cam.active) { NX.camState = NX.cam.at(t); els.world.style.transform = NX.cam.css(NX.camState); }
    for (const s of scenes) {
      const on = (!NX.only || NX.only.includes(s.id)) && t >= s.start - s.pre && t < s.end + s.post;
      s.root.style.display = on ? 'block' : 'none';
      if (!on) continue;
      const dur = s.end - s.start;
      const S = { t, lt: t - s.start, p: clamp((t - s.start) / dur), dur, root: s.root, id: s.id, start: s.start, end: s.end, scene: s };
      fxCtx.save();
      try { s.render(S); } catch (e) { console.error(`[scene ${s.id}]`, e); }
      fxCtx.restore();
    }
    applyPost(t);
    NX.shader && NX.shader.draw(t, NX.bg);
  };

  function applyPost(t) {
    const P = NX.post;
    // Tremblement de caméra : bruit continu (pas de hasard par image)
    if (P.shake > 0) {
      const f = P.shakeFreq;
      const x = NX.noise(t * f, 1.3) * P.shake, y = NX.noise(t * f, 7.1) * P.shake, r = NX.noise(t * f, 4.2) * P.shake * 0.04;
      els.shake.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`;
    } else els.shake.style.transform = '';
    // Filtres : aberration chromatique, glitch, flou, exposition
    const filters = [];
    if (P.chroma > 0.05 || P.glitch > 0.01) {
      els.fr.setAttribute('dx', P.chroma); els.fb.setAttribute('dx', -P.chroma);
      els.fr.setAttribute('dy', P.chroma * 0.15); els.fb.setAttribute('dy', -P.chroma * 0.15);
      els.disp.setAttribute('scale', P.glitch * 160);
      els.turb.setAttribute('seed', Math.floor(t * 30) % 97 + 1);
      els.turb.setAttribute('baseFrequency', `0.00001 ${0.02 + 0.06 * NX.hash(Math.floor(t * 15))}`);
      filters.push('url(#nx-fx)');
    }
    if (P.blur > 0.05) filters.push(`blur(${P.blur}px)`);
    if (Math.abs(P.exposure - 1) > 0.005) filters.push(`brightness(${P.exposure})`);
    if (Math.abs(P.saturate - 1) > 0.005) filters.push(`saturate(${P.saturate})`);
    els.shake.style.filter = filters.join(' ');
    els.vignette.style.opacity = P.vignette;
    // En capture, le grain est ajouté à l'encodage (moins coûteux, et propre à chaque image du film).
    els.grain.style.opacity = NX.capture ? 0 : P.grain;
    if (!NX.capture) grainCtx.putImageData(grainFrames[Math.floor(t * NX.FPS) % grainFrames.length], 0, 0);
    els.flash.style.opacity = clamp(P.flash);
    els.flash.style.background = P.flashColor;
    const lb = clamp(P.letterbox) * 132;
    els.lbT.style.height = els.lbB.style.height = lb + 'px';
    els.fade.style.opacity = clamp(P.fade);
    els.leak.style.opacity = clamp(P.leak);
    if (P.leak > 0) {
      const x = P.leakX * 100, y = P.leakY * 100;
      els.leak.style.background = `radial-gradient(ellipse 55% 70% at ${x}% ${y}%, ${NX.spectrum(P.leakHue, 0.55)}, ${NX.spectrum(clamp(P.leakHue + 0.3), 0.18)} 45%, transparent 70%)`;
    }
  }
})();
