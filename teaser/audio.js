/* Bande-son du teaser v6, synthétisée et déterministe : NX.audio.render(sampleRate) → Promise<AudioBuffer>.
 * 100 BPM en ré mineur, calée sur la frise NX.T. Les cinq notes de la marque (ré, fa, la, do, mi)
 * accompagnent l'arrivée des cinq rôles, puis reviennent en majeur sur la carte finale.
 * Le volume final est réglé à l'encodage par un gain fixe (tools/encode.sh), qui garde les écarts entre les parties. */
(function () {
  NX.audio = {
    async render(sampleRate = 48000) {
      const len = Math.ceil((NX.DURATION + 1.5) * sampleRate);
      const ctx = new OfflineAudioContext(2, len, sampleRate);
      const S = NX.synth(ctx, { seed: 11, master: 0.85, echoTime: 0.45, verbTime: 3.4 });
      const T = NX.T, B = NX.BEAT, BAR = NX.BAR, E = B / 2, X = B / 4;

      /* Accroche : une nappe qui s'ouvre lentement, un sub qui entre sans à-coup. */
      S.pad(0, 4.6, ['D3', 'A3', 'C4', 'E4', 'F4'], { gain: 0.22, attack: 1.0, release: 1.2, cutoff: 1100, cutoffEnd: 3200 });
      S.sub(0.2, 4.4, { note: 'D1', gain: 0.14, attack: 0.8 });
      for (let k = 0; k < 8; k++) S.tick(k * B, { gain: 0.05 + 0.01 * k, freq: 2600 + (k % 2) * 600, pan: k % 2 ? 0.4 : -0.4 });
      S.reverse(T.hookEnd - 1.2, 1.2, { gain: 0.38, bright: 0.6 });

      /* Logo : impact et cloche. */
      S.impact(T.hookEnd, { gain: 0.85, bright: 0.6 });
      S.bell(T.hookEnd, 'D5', { gain: 0.16, decay: 3 });
      S.bell(T.hookEnd + 0.02, 'A5', { gain: 0.08, decay: 2.6, pan: 0.3 });
      S.pad(T.hookEnd, BAR, ['Bb2', 'D3', 'F3', 'A3'], { gain: 0.1, attack: 0.4, release: 1.4, cutoff: 1400, cutoffEnd: 2200 });
      for (let k = 0; k < 4; k++) S.hat(T.hookEnd + B + k * B, { gain: 0.06 });

      /* Les cinq rôles : une note de la marque par rôle posé ; chaque souffle part du centre vers son icône. */
      ['D5', 'F5', 'A5', 'C6', 'E6'].forEach((n, i) => {
        const tt = T.roles + i * B;
        S.bell(tt, n, { gain: 0.12 + 0.02 * i, decay: 1.4, pan: (i - 2) * 0.3, echo: 0.1 });
        S.whoosh(tt - 0.55, 0.6, { gain: 0.12, from: 900, to: 6000, panFrom: 0, panTo: (i - 2) * 0.35 });
      });
      S.pad(T.roles, T.fuse - T.roles, ['D3', 'F3', 'A3', 'C4'], { gain: 0.09, attack: 0.8, release: 0.6, cutoff: 1500, cutoffEnd: 3000 });
      // « Toute ton équipe. » : un pouls léger, qui laisse sonner le cinquième rôle puis porte la fusion.
      const pulse = T.team;
      S.kick(pulse + 2 * B, { gain: 0.55, decay: 0.35 });
      S.kick(pulse + 6 * B, { gain: 0.5, decay: 0.35 });
      for (let k = 0; k < (T.fuse - pulse) / E - 0.01; k++) S.hat(pulse + k * E, { gain: k % 2 ? 0.07 : 0.04, pan: 0.25 });
      for (let k = 0; pulse + B + k * E < T.fuse + 0.6; k++) S.bass(pulse + B + k * E, E * 0.8, 'D2', { gain: 0.12, cutoff: 400, env: 700 });

      /* Fusion : aspiration vers l'emblème, sans trou de son. */
      S.pad(T.fuse, T.emblem - T.fuse, ['C3', 'E3', 'G3', 'D4'], { gain: 0.2, attack: 0.1, release: 0.3, cutoff: 1200, cutoffEnd: 4000 });
      S.riser(T.fuse - 0.3, T.emblem - T.fuse + 0.3, { gain: 0.24, from: 400, to: 8000 });
      S.reverse(T.emblem - 0.8, 0.8, { gain: 0.32 });
      S.impact(T.emblem, { gain: 0.8, bright: 0.7 });
      S.bell(T.emblem, 'D5', { gain: 0.14, decay: 2.6 }); S.bell(T.emblem, 'F5', { gain: 0.09, decay: 2.4, pan: -0.3 }); S.bell(T.emblem, 'A5', { gain: 0.08, decay: 2.4, pan: 0.3 });
      S.pad(T.emblem, T.tools - T.emblem - 0.1, ['D3', 'F3', 'A3', 'E4'], { gain: 0.13, attack: 0.2, release: 0.1, cutoff: 1800, cutoffEnd: 5000 });
      // « Une même direction. » : pouls qui accélère vers le drop.
      S.kick(T.emblem + 2 * B, { gain: 0.5 });
      S.kick(T.emblem + 4 * B, { gain: 0.5 });
      [0, 0.6, 1.2, 1.5, 1.8, 2.1, 2.25, 2.4, 2.55].forEach((o, k) => S.hat(T.emblem + B + o, { gain: 0.05 + 0.008 * k }));
      S.riser(T.emblem + 1.2, T.tools - T.emblem - 1.2, { gain: 0.26, from: 300, to: 9000 });
      [0, 0.3, 0.45, 0.6, 0.75, 0.825, 0.9, 0.975, 1.05].forEach((o, i) => S.snare(T.tools - 1.2 + o, { gain: 0.08 + 0.012 * i, decay: 0.12 }));

      /* Les trois outils : le groove complet, 4,5 mesures, audible aussi sur un haut-parleur de téléphone. */
      const chords = [['D', ['D3', 'F3', 'A3', 'C4']], ['Bb', ['Bb2', 'D3', 'F3', 'A3']], ['F', ['F2', 'A2', 'C3', 'E3']], ['C', ['C3', 'E3', 'G3', 'D4']], ['D', ['D3', 'F3', 'A3', 'C4']]];
      const roots = { D: 'D2', Bb: 'Bb1', F: 'F2', C: 'C2' };
      const arps = { D: ['D5', 'F5', 'A5', 'C6', 'E6', 'C6', 'A5', 'F5'], Bb: ['Bb4', 'D5', 'F5', 'A5', 'C6', 'A5', 'F5', 'D5'], F: ['F4', 'A4', 'C5', 'E5', 'G5', 'E5', 'C5', 'A4'], C: ['C5', 'E5', 'G5', 'D6', 'E6', 'D6', 'G5', 'E5'] };
      chords.forEach(([name, notes], j) => {
        const t0 = T.tools + j * BAR, barLen = j === 4 ? BAR / 2 : BAR;
        S.pad(t0, barLen, notes, { gain: 0.16, attack: 0.05, release: 0.3, cutoff: 3500 });
        for (let k = 0; k < barLen / E - 0.01; k++) {
          const tt = t0 + k * E;
          S.bass(tt, E * 0.75, roots[name], { gain: 0.24, cutoff: 1000, env: 1400 });
          S.pluck(tt, arps[name][k % 8], { gain: 0.16, decay: 0.25, pan: k % 2 ? 0.35 : -0.35, echo: 0.2 });
        }
        for (let k = 0; k < barLen / X - 0.01; k++) S.hat(t0 + k * X, { gain: k % 4 === 2 ? 0.12 : 0.06, open: k % 8 === 6, pan: 0.2 });
        [0, 1.2, 1.5].filter(o => o < barLen).forEach(o => S.kick(t0 + o, { gain: 0.65 }));
        [0.6, 1.8].filter(o => o < barLen).forEach(o => { S.snare(t0 + o, { gain: 0.42 }); S.clap(t0 + o, { gain: 0.36 }); });
      });
      S.impact(T.tools, { gain: 0.9, bright: 0.8 });
      S.bell(T.tools, 'D5', { gain: 0.15, decay: 2 }); S.bell(T.tools, 'A5', { gain: 0.09, decay: 2 }); S.bell(T.tools, 'D6', { gain: 0.07, decay: 2 });
      // Changements d'outil : souffle et cloche.
      [1, 2].forEach(k => {
        const tt = T.tools + k * T.tool;
        S.whoosh(tt - 0.35, 0.6, { gain: 0.26, dir: -1, from: 600, to: 7000 });
        S.bell(tt, k === 1 ? 'A5' : 'C6', { gain: 0.1, decay: 1.6 });
      });
      S.riser(T.end - 1.2, 1.2, { gain: 0.28, from: 400, to: 10000 });
      S.reverse(T.end - 0.9, 0.9, { gain: 0.34 });

      /* Carte finale : la tonalité passe en majeur, les cinq notes reviennent et résonnent. */
      S.impact(T.end, { gain: 1, bright: 0.85 });
      S.sub(T.end, 3.6, { note: 'D1', gain: 0.4 });
      S.pad(T.end, 3.4, ['D3', 'F#3', 'A3', 'E4', 'F#4'], { gain: 0.15, attack: 0.05, release: 1.6, cutoff: 3200, cutoffEnd: 900 });
      ['D5', 'F#5', 'A5', 'C#6', 'E6'].forEach((n, i) => S.bell(T.end + 0.6 + i * E, n, { gain: 0.11, decay: 2.4, pan: (i - 2) * 0.25, echo: 0.3 }));
      S.bell(T.end + 3.0, 'D6', { gain: 0.08, decay: 2 });
      return ctx.startRendering();
    },
  };
})();
