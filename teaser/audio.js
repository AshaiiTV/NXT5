/* Bande-son du teaser v6, synthétisée et déterministe : NX.audio.render(sampleRate) → Promise<AudioBuffer>.
 * 100 BPM en ré mineur, calée sur la frise NX.T. Les cinq notes de la marque (ré, fa, la, do, mi)
 * accompagnent l'arrivée des cinq rôles, puis reviennent en majeur sur la carte finale. */
(function () {
  NX.audio = {
    async render(sampleRate = 48000) {
      const len = Math.ceil((NX.DURATION + 1.5) * sampleRate);
      const ctx = new OfflineAudioContext(2, len, sampleRate);
      const S = NX.synth(ctx, { seed: 11, master: 0.85, echoTime: 0.45, verbTime: 3.4 });
      const T = NX.T, B = NX.BEAT, BAR = NX.BAR, E = B / 2, X = B / 4;

      /* Acte 1 : l'accroche, une nappe qui s'ouvre lentement. */
      S.pad(0, 4.6, ['D3', 'A3', 'C4', 'E4', 'F4'], { gain: 0.09, attack: 1.4, release: 1.2, cutoff: 600, cutoffEnd: 2600 });
      S.sub(0.6, 4.0, { note: 'D1', gain: 0.22 });
      for (let k = 0; k < 8; k++) S.tick(k * B, { gain: 0.05 + 0.01 * k, freq: 2600 + (k % 2) * 600, pan: k % 2 ? 0.4 : -0.4 });
      S.reverse(T.hookEnd - 1.2, 1.2, { gain: 0.38, bright: 0.6 });

      /* Logo : impact et cloche. */
      S.impact(T.hookEnd, { gain: 0.85, bright: 0.6 });
      S.bell(T.hookEnd, 'D5', { gain: 0.16, decay: 3 });
      S.bell(T.hookEnd + 0.02, 'A5', { gain: 0.08, decay: 2.6, pan: 0.3 });
      S.pad(T.hookEnd, BAR, ['Bb2', 'D3', 'F3', 'A3'], { gain: 0.1, attack: 0.4, release: 1.4, cutoff: 1400, cutoffEnd: 2200 });
      for (let k = 0; k < 4; k++) S.hat(T.hookEnd + B + k * B, { gain: 0.06 });

      /* Les cinq rôles : une note de la marque par rôle posé. */
      ['D5', 'F5', 'A5', 'C6', 'E6'].forEach((n, i) => {
        const tt = T.roles + i * B;
        S.bell(tt, n, { gain: 0.15, decay: 1.8, pan: (i - 2) * 0.3, echo: 0.28 });
        S.whoosh(tt - 0.55, 0.6, { gain: 0.12, dir: i % 2 ? 1 : -1, from: 900, to: 6000 });
      });
      S.pad(T.roles, 2 * BAR, ['D3', 'F3', 'A3', 'C4'], { gain: 0.09, attack: 0.8, release: 0.6, cutoff: 1500, cutoffEnd: 3000 });
      // « Toute ton équipe. » : un pouls léger entre.
      const bar5 = 4 * BAR;
      [0, 2 * B].forEach(o => S.kick(bar5 + o, { gain: 0.55, decay: 0.35 }));
      for (let k = 0; k < 8; k++) S.hat(bar5 + k * E, { gain: k % 2 ? 0.07 : 0.04, pan: 0.25 });
      for (let k = 0; k < 8; k++) S.bass(bar5 + k * E, E * 0.8, 'D2', { gain: 0.12, cutoff: 400, env: 700 });

      /* Fusion : aspiration vers l'emblème. */
      S.pad(T.fuse, 1.2, ['C3', 'E3', 'G3', 'D4'], { gain: 0.13, attack: 0.3, release: 0.3, cutoff: 1200, cutoffEnd: 4000 });
      S.riser(T.fuse, T.emblem - T.fuse, { gain: 0.24, from: 400, to: 8000 });
      S.reverse(T.emblem - 0.8, 0.8, { gain: 0.32 });
      S.impact(T.emblem, { gain: 0.8, bright: 0.7 });
      S.bell(T.emblem, 'D5', { gain: 0.14, decay: 2.6 }); S.bell(T.emblem, 'F5', { gain: 0.09, decay: 2.4, pan: -0.3 }); S.bell(T.emblem, 'A5', { gain: 0.08, decay: 2.4, pan: 0.3 });
      S.pad(T.emblem, T.tools - T.emblem - 0.1, ['D3', 'F3', 'A3', 'E4'], { gain: 0.13, attack: 0.2, release: 0.1, cutoff: 1800, cutoffEnd: 5000 });
      S.kick(T.emblem + 2 * B, { gain: 0.5 });
      for (let k = 0; k < 8; k++) S.hat(T.emblem + 2 * B + k * X * (k < 4 ? 2 : 1), { gain: 0.05 + 0.01 * k });
      S.riser(T.emblem + 1.2, T.tools - T.emblem - 1.3, { gain: 0.26, from: 300, to: 9000 });
      [0, 0.3, 0.45, 0.6, 0.75, 0.825, 0.9, 0.975, 1.05].forEach((o, i) => S.snare(T.tools - 1.2 + o, { gain: 0.12 + 0.025 * i, decay: 0.12 }));

      /* Les trois outils : le groove complet, 4,5 mesures. */
      const chords = [['D', ['D3', 'F3', 'A3', 'C4']], ['Bb', ['Bb2', 'D3', 'F3', 'A3']], ['F', ['F2', 'A2', 'C3', 'E3']], ['C', ['C3', 'E3', 'G3', 'D4']], ['D', ['D3', 'F3', 'A3', 'C4']]];
      const roots = { D: 'D2', Bb: 'Bb1', F: 'F2', C: 'C2' };
      const arps = { D: ['D5', 'F5', 'A5', 'C6', 'E6', 'C6', 'A5', 'F5'], Bb: ['Bb4', 'D5', 'F5', 'A5', 'C6', 'A5', 'F5', 'D5'], F: ['F4', 'A4', 'C5', 'E5', 'G5', 'E5', 'C5', 'A4'], C: ['C5', 'E5', 'G5', 'D6', 'E6', 'D6', 'G5', 'E5'] };
      chords.forEach(([name, notes], j) => {
        const t0 = T.tools + j * BAR, barLen = j === 4 ? BAR / 2 : BAR;
        S.pad(t0, barLen, notes, { gain: 0.12, attack: 0.05, release: 0.3, cutoff: 2600 });
        for (let k = 0; k < barLen / E - 0.01; k++) {
          const tt = t0 + k * E;
          S.bass(tt, E * 0.75, roots[name], { gain: 0.24, cutoff: 500, env: 1400 });
          S.pluck(tt, arps[name][k % 8], { gain: 0.07, decay: 0.25, pan: k % 2 ? 0.35 : -0.35, echo: 0.2 });
        }
        for (let k = 0; k < barLen / X - 0.01; k++) S.hat(t0 + k * X, { gain: k % 4 === 2 ? 0.09 : 0.045, open: k % 8 === 6, pan: 0.2 });
        [0, 1.2, 1.5].filter(o => o < barLen).forEach(o => S.kick(t0 + o, { gain: 0.85 }));
        [0.6, 1.8].filter(o => o < barLen).forEach(o => { S.snare(t0 + o, { gain: 0.3 }); S.clap(t0 + o, { gain: 0.26 }); });
      });
      S.impact(T.tools, { gain: 0.9, bright: 0.8 });
      // Changements d'outil : souffle et cloche.
      [1, 2].forEach(k => {
        const tt = T.tools + k * T.tool;
        S.whoosh(tt - 0.35, 0.6, { gain: 0.26, dir: -1, from: 600, to: 7000 });
        S.bell(tt, k === 1 ? 'A5' : 'C6', { gain: 0.1, decay: 1.6 });
      });
      S.riser(T.end - 1.2, 1.15, { gain: 0.28, from: 400, to: 10000 });
      S.reverse(T.end - 0.9, 0.85, { gain: 0.34 });

      /* Carte finale : la tonalité passe en majeur, les cinq notes reviennent et résonnent. */
      S.impact(T.end, { gain: 1, bright: 0.85 });
      S.sub(T.end, 3.6, { note: 'D1', gain: 0.4 });
      S.pad(T.end, 3.4, ['D3', 'F#3', 'A3', 'E4', 'F#4'], { gain: 0.15, attack: 0.05, release: 1.6, cutoff: 3200, cutoffEnd: 900 });
      ['D5', 'F#5', 'A5', 'C#6', 'E6'].forEach((n, i) => S.bell(T.end + 0.6 + i * E, n, { gain: 0.11, decay: 2.4, pan: (i - 2) * 0.25, echo: 0.3 }));
      S.bell(T.end + 3 * B * 2, 'D6', { gain: 0.08, decay: 3 });
      return ctx.startRendering();
    },
  };
})();
