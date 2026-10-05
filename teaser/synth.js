/* Bibliothèque de synthèse déterministe pour OfflineAudioContext.
 * const S = NX.synth(ctx) → instruments S.kick(t,…), S.pad(t,dur,notes,…)… tous routés vers S.bus (et S.verb en envoi).
 * Notes : S.hz('D4') ou S.hz(62). Rien d'aléatoire : le bruit vient de NX.rng. */
(function () {
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = n => { if (typeof n === 'number') return n; const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
  const hz = n => 440 * Math.pow(2, (midi(n) - 69) / 12);

  NX.synth = (ctx, opts = {}) => {
    const sr = ctx.sampleRate, R = NX.rng(opts.seed || 5);
    // Bus maître : compression de colle → limiteur
    const master = ctx.createGain(); master.gain.value = opts.master ?? 0.9;
    const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -10; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.2; glue.knee.value = 8;
    const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -2; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.08; limit.knee.value = 0;
    const bus = ctx.createGain();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.7;
    bus.connect(hp).connect(glue).connect(master).connect(limit).connect(ctx.destination);
    // Réverbération à convolution (réponse synthétique stéréo)
    const irLen = Math.floor(sr * (opts.verbTime || 3.2));
    const ir = ctx.createBuffer(2, irLen, sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irLen; i++) { const x = i / irLen; d[i] = (R() * 2 - 1) * Math.pow(1 - x, 2.2) * (i < sr * 0.012 ? i / (sr * 0.012) : 1); } }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const verb = ctx.createGain(); verb.gain.value = 0.55;
    const verbHp = ctx.createBiquadFilter(); verbHp.type = 'highpass'; verbHp.frequency.value = 220;
    verb.connect(verbHp).connect(conv).connect(bus);
    // Écho ping-pong
    const echoIn = ctx.createGain(); const dl = ctx.createDelay(2), dr = ctx.createDelay(2); dl.delayTime.value = opts.echoTime || 0.45; dr.delayTime.value = opts.echoTime || 0.45;
    const fb = ctx.createGain(); fb.gain.value = 0.38; const pl = ctx.createStereoPanner(); pl.pan.value = -0.7; const pr = ctx.createStereoPanner(); pr.pan.value = 0.7;
    const eLp = ctx.createBiquadFilter(); eLp.type = 'lowpass'; eLp.frequency.value = 4200;
    echoIn.connect(dl); dl.connect(pl).connect(bus); dl.connect(dr); dr.connect(pr).connect(bus); dr.connect(eLp).connect(fb).connect(dl);

    // Bruit blanc partagé (5 s)
    const nb = ctx.createBuffer(2, sr * 5, sr);
    for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }

    const S = { ctx, bus, verb, echo: echoIn, hz, midi, sr };
    /** Sortie d'une voix : gain + panoramique + envois réverbe/écho. */
    S.out = (t, { gain = 1, pan = 0, send = 0.15, echo = 0 } = {}) => {
      const g = ctx.createGain(); g.gain.value = gain;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      g.connect(p).connect(bus);
      if (send) { const s = ctx.createGain(); s.gain.value = send; p.connect(s).connect(verb); }
      if (echo) { const e = ctx.createGain(); e.gain.value = echo; p.connect(e).connect(echoIn); }
      return g;
    };
    S.noise = (t, dur, offset = 0) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t, (offset * 0.731) % 4); s.stop(t + dur + 0.05); return s; };
    const adsr = (param, t, { a = 0.005, d = 0.1, s = 0, r = 0.1, peak = 1, dur = 0 }) => {
      param.setValueAtTime(0.0001, t); param.linearRampToValueAtTime(peak, t + a);
      param.setTargetAtTime(Math.max(0.0001, s * peak), t + a, d / 3);
      const end = t + Math.max(a + d, dur); param.setTargetAtTime(0.0001, end, r / 4);
      return end + r;
    };

    /* ---------- Percussions ---------- */
    S.kick = (t, { gain = 0.9, f0 = 160, f1 = 42, decay = 0.42, click = 0.35, pan = 0 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.04 });
      const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.002, d: decay, s: 0, r: 0.05 });
      osc.connect(g).connect(o); osc.start(t); osc.stop(t + decay + 0.2);
      if (click) { const n = S.noise(t, 0.02, t); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const cg = ctx.createGain(); adsr(cg.gain, t, { a: 0.0005, d: 0.012, peak: click }); n.connect(f).connect(cg).connect(o); }
    };
    S.snare = (t, { gain = 0.45, tone = 190, decay = 0.2, pan = 0, send = 0.3 } = {}) => {
      const o = S.out(t, { gain, pan, send });
      const n = S.noise(t, decay + 0.1, t * 3); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.001, d: decay, peak: 1 }); n.connect(f).connect(g).connect(o);
      const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(tone * 1.4, t); osc.frequency.exponentialRampToValueAtTime(tone, t + 0.05);
      const g2 = ctx.createGain(); adsr(g2.gain, t, { a: 0.001, d: 0.08, peak: 0.6 }); osc.connect(g2).connect(o); osc.start(t); osc.stop(t + 0.3);
    };
    S.clap = (t, { gain = 0.4, pan = 0 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.35 });
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2; f.connect(o);
      [0, 0.011, 0.022, 0.034].forEach((dt, i) => { const n = S.noise(t + dt, 0.2, t + i); const g = ctx.createGain(); adsr(g.gain, t + dt, { a: 0.0005, d: i === 3 ? 0.16 : 0.012, peak: 1 }); n.connect(g).connect(f); });
    };
    S.hat = (t, { gain = 0.16, open = false, pan = 0.2 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.05 });
      const n = S.noise(t, open ? 0.35 : 0.06, t * 7); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.001, d: open ? 0.28 : 0.035, peak: 1 }); n.connect(f).connect(g).connect(o);
    };
    S.tick = (t, { gain = 0.25, freq = 3200, pan = 0 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.12, echo: 0.1 });
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.0005, d: 0.025, peak: 1 }); osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.08);
    };

    /* ---------- Basses et impacts ---------- */
    S.sub = (t, dur, { note = 'D1', gain = 0.7, drop = 0, pan = 0, attack = 0.01, release = 0.3 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0 });
      const osc = ctx.createOscillator(); const f = hz(note); osc.frequency.setValueAtTime(f * (drop ? 2 : 1), t);
      if (drop) osc.frequency.exponentialRampToValueAtTime(f, t + drop);
      const g = ctx.createGain(); adsr(g.gain, t, { a: attack, d: dur, s: 0.6, r: release, dur });
      const sh = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 1.8); } sh.curve = c;
      osc.connect(sh).connect(g).connect(o); osc.start(t); osc.stop(t + dur + 0.5);
    };
    /** Chute de sub (« boom » cinématique). */
    S.subDrop = (t, { gain = 0.9, from = 110, to = 32, dur = 1.6 } = {}) => {
      const o = S.out(t, { gain, send: 0.05 });
      const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.7);
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.004, d: dur, s: 0, r: 0.2 });
      osc.connect(g).connect(o); osc.start(t); osc.stop(t + dur + 0.3);
    };
    /** Impact cinématique : kick lourd + souffle filtré + sub + queue de réverbe. */
    S.impact = (t, { gain = 1, bright = 0.5, pan = 0 } = {}) => {
      S.kick(t, { gain: 0.95 * gain, f0: 200, f1: 38, decay: 0.7, click: 0.5 });
      S.subDrop(t, { gain: 0.6 * gain, from: 90, to: 30, dur: 1.8 });
      const o = S.out(t, { gain: 0.5 * gain, pan, send: 0.9 });
      const n = S.noise(t, 1.5, t * 11); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1200 + 6000 * bright, t); f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.002, d: 1.2, peak: 1 }); n.connect(f).connect(g).connect(o);
    };

    /* ---------- Transitions ---------- */
    /** Montée : bruit filtré qui s'ouvre + scie qui monte ; finit exactement à t + dur. */
    S.riser = (t, dur, { gain = 0.35, from = 300, to = 9000, pitch = true, pan = 0 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.35 });
      const n = S.noise(t, dur, t * 5); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
      f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(1, t + dur * 0.97); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
      n.connect(f).connect(g).connect(o);
      if (pitch) {
        const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(110, t); s.frequency.exponentialRampToValueAtTime(880, t + dur);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(6000, t + dur);
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.01, t); g2.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.97); g2.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
        s.connect(lp).connect(g2).connect(o); s.start(t); s.stop(t + dur + 0.05);
      }
    };
    /** Souffle de mouvement (whip pan) centré sur t + dur/2, avec balayage stéréo. */
    S.whoosh = (t, dur = 0.5, { gain = 0.4, dir = 1, from = 500, to = 5000, panFrom = -0.8 * dir, panTo = 0.8 * dir } = {}) => {
      const o = S.out(t, { gain, send: 0.25 });
      const n = S.noise(t, dur, t * 13); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur * 0.5); f.frequency.exponentialRampToValueAtTime(from, t + dur);
      const p = ctx.createStereoPanner(); p.pan.setValueAtTime(panFrom, t); p.pan.linearRampToValueAtTime(panTo, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f).connect(p).connect(g).connect(o);
    };
    /** Souffle inversé qui culmine à t + dur (aspiration avant un impact). */
    S.reverse = (t, dur = 1, { gain = 0.45, bright = 0.6 } = {}) => {
      const len = Math.floor(sr * dur); const b = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) { const x = i / len; d[i] = (R() * 2 - 1) * Math.pow(x, 3); } }
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(2000 + 12000 * bright, t + dur);
      const o = S.out(t, { gain, send: 0.4 }); s.connect(f).connect(o); s.start(t);
    };
    /** Bégaiement numérique (glitch) : salves carrées hachées. */
    S.glitch = (t, dur = 0.25, { gain = 0.22, rate = 32, seed = 1 } = {}) => {
      const r = NX.rng(seed); const o = S.out(t, { gain, send: 0.1 });
      const steps = Math.max(1, Math.floor(dur * rate));
      for (let i = 0; i < steps; i++) {
        if (r() < 0.3) continue;
        const tt = t + i / rate; const osc = ctx.createOscillator(); osc.type = r() < 0.5 ? 'square' : 'sawtooth';
        osc.frequency.value = 80 + r() * 1800; const g = ctx.createGain(); adsr(g.gain, tt, { a: 0.001, d: 0.8 / rate, peak: 0.6 + r() * 0.4 });
        const p = ctx.createStereoPanner(); p.pan.value = r() * 1.6 - 0.8;
        osc.connect(g).connect(p).connect(o); osc.start(tt); osc.stop(tt + 1 / rate);
      }
    };

    /* ---------- Harmonie ---------- */
    /** Nappe de scies désaccordées avec filtre qui s'ouvre ; notes = ['D3','F3','A3',…]. */
    S.pad = (t, dur, notes, { gain = 0.16, attack = 1.2, release = 1.5, cutoff = 1800, cutoffEnd = null, detune = 12, pan = 0 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.5 });
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.setValueAtTime(cutoff, t);
      if (cutoffEnd) lp.frequency.exponentialRampToValueAtTime(cutoffEnd, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + attack); g.gain.setValueAtTime(1, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + release);
      lp.connect(g).connect(o);
      notes.forEach((n, i) => [-detune, 0, detune].forEach((dt, k) => {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = hz(n); osc.detune.value = dt + (i % 2 ? 3 : -3);
        const p = ctx.createStereoPanner(); p.pan.value = (k - 1) * 0.6; const vg = ctx.createGain(); vg.gain.value = 0.9 / (notes.length * 3);
        osc.connect(vg).connect(p).connect(lp); osc.start(t); osc.stop(t + dur + release + 0.1);
      }));
    };
    /** Pluck (corde synthétique courte). */
    S.pluck = (t, note, { gain = 0.22, decay = 0.35, pan = 0, echo = 0.25, bright = 3500 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.3, echo });
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = hz(note);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(bright, t); lp.frequency.exponentialRampToValueAtTime(300, t + decay);
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.002, d: decay, peak: 1 }); osc.connect(lp).connect(g).connect(o); osc.start(t); osc.stop(t + decay + 0.3);
    };
    /** Cloche FM (leitmotiv, logo sting). */
    S.bell = (t, note, { gain = 0.2, decay = 2.2, pan = 0, echo = 0.2, ratio = 3.5, index = 2.2 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.55, echo });
      const f = hz(note); const car = ctx.createOscillator(); car.frequency.value = f;
      const mod = ctx.createOscillator(); mod.frequency.value = f * ratio; const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + decay);
      mod.connect(mg).connect(car.frequency);
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.002, d: decay, peak: 1 }); car.connect(g).connect(o);
      car.start(t); mod.start(t); car.stop(t + decay + 0.5); mod.stop(t + decay + 0.5);
    };
    /** Basse synthé (scie filtrée), utile pour une ligne au tempo. */
    S.bass = (t, dur, note, { gain = 0.32, cutoff = 900, env = 1600, pan = 0 } = {}) => {
      const o = S.out(t, { gain, pan, send: 0.02 });
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = hz(note);
      const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = hz(note) / 2;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(cutoff + env, t); lp.frequency.exponentialRampToValueAtTime(cutoff, t + 0.15);
      const g = ctx.createGain(); adsr(g.gain, t, { a: 0.003, d: dur, s: 0.7, r: 0.06, dur }); const sg = ctx.createGain(); sg.gain.value = 0.15;
      osc.connect(lp); sq.connect(sg).connect(lp); lp.connect(g).connect(o);
      osc.start(t); sq.start(t); osc.stop(t + dur + 0.2); sq.stop(t + dur + 0.2);
    };
    /** Automatisation d'un paramètre de sidechain : renvoie un gain qui « pompe » sur les temps donnés. */
    S.pump = (times, depth = 0.6, rel = 0.28) => {
      const g = ctx.createGain(); g.gain.value = 1;
      for (const t of times) { g.gain.setValueAtTime(1 - depth, t); g.gain.setTargetAtTime(1, t + 0.01, rel / 3); }
      g.connect(bus); return g;
    };
    return S;
  };
})();
