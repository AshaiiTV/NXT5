/* Chargement des scènes, attente des polices/images, lecture ou mode capture. */
(async function () {
  const params = new URLSearchParams(location.search);
  const capture = params.has('capture');
  if (params.get('only')) NX.only = params.get('only').split(',');
  if (capture) document.body.classList.add('capture');
  NX.capture = capture;

  for (const name of window.NX_SCENES || []) {
    await new Promise(res => { const s = document.createElement('script'); s.src = `scenes/${name}.js`; s.onload = res; s.onerror = () => { console.warn('scène absente : ' + name); res(); }; document.body.appendChild(s); });
  }
  NX.init();
  await document.fonts.ready;
  // Les scènes sont masquées au chargement : sans ce préchargement explicite, Inter n'est pas encore
  // chargée quand NX.layout mesure les mots, et les dégradés sont calés sur la police de secours.
  await Promise.all([400, 600, 700, 800, 900].map(w => document.fonts.load(`${w} 100px Inter`)));
  // Toutes les images (DOM et registre NX.image) décodées avant toute mesure ou tout échantillonnage.
  await Promise.all([...document.images, ...(NX.imageRegistry ? NX.imageRegistry() : [])].map(img => img.decode().catch(() => console.warn('image non décodée', img.src))));
  NX.layout();
  // Préparation unique de chaque scène (échantillons, masques, tables) : jamais dans render().
  for (const s of NX.scenes) if (s.prepare) { try { await s.prepare(s.root, s); } catch (e) { console.error(`[prepare ${s.id}]`, e); } }
  NX.render(0);
  window.NXrender = t => NX.render(t);
  window.NXready = true;

  const fit = () => { const s = Math.min(innerWidth / NX.W, innerHeight / NX.H); document.getElementById('stage').style.transform = capture ? '' : `scale(${s})`; };
  fit(); addEventListener('resize', fit);
  if (capture) return;

  // Lecture interactive avec le son
  const scrub = document.getElementById('scrub'), time = document.getElementById('time'), btn = document.getElementById('play'), muteBtn = document.getElementById('mute');
  scrub.max = NX.DURATION;
  const list = document.getElementById('scenes');
  for (const s of NX.scenes) { const b = document.createElement('button'); b.type = 'button'; b.textContent = s.id; b.onclick = () => seek(s.start); list.appendChild(b); }
  let playing = false, cur = +params.get('t') || 0, startAt = 0, actx, abuf, src, muted = false, gain;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function ensureAudio() {
    if (actx) return;
    actx = new AudioContext(); gain = actx.createGain(); gain.connect(actx.destination);
    try { abuf = await NX.audio.render(actx.sampleRate); } catch (e) { console.warn('audio', e); }
  }
  function startSound() { stopSound(); if (!abuf || muted) return; src = actx.createBufferSource(); src.buffer = abuf; src.connect(gain); src.start(0, cur); }
  function stopSound() { if (src) { try { src.stop(); } catch (e) {} src = null; } }
  function seek(t) { cur = t; startAt = performance.now() - cur * 1000; if (playing) startSound(); }
  btn.onclick = async () => {
    if (!playing) { await ensureAudio(); await actx.resume(); playing = true; seek(cur >= NX.DURATION - 0.05 ? 0 : cur); }
    else { playing = false; stopSound(); }
    btn.textContent = playing ? 'Pause' : 'Lecture';
  };
  muteBtn.onclick = () => { muted = !muted; muteBtn.textContent = muted ? 'Son : non' : 'Son : oui'; if (playing) startSound(); };
  scrub.oninput = () => seek(+scrub.value);
  if (reduced) cur = NX.DURATION - 2;
  function frame(now) {
    if (playing) { cur = (now - startAt) / 1000; if (cur >= NX.DURATION) { cur = NX.DURATION; playing = false; stopSound(); btn.textContent = 'Lecture'; } }
    NX.render(cur); scrub.value = cur; time.textContent = cur.toFixed(2) + ' s';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
