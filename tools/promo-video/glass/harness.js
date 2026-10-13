import { createGlassScene } from '../../../src/pages/home/glass-scene.js';
export { getGlassPose } from '../../../src/components/brand/glass-motion.js';
const canvas = document.getElementById('c');
globalThis.__ready = new Promise((resolve, reject) => {
  createGlassScene({ canvas, onReady: resolve, onError: reject });
});
