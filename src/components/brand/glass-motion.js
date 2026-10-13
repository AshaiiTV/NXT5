/** Shared sculpture motion. Positions are world units; rotations are radians. */
export const GLASS_MOTION = Object.freeze({
  period: 8000,
  bob: 0.045,
  idleX: 0.014,
  idleY: 0.021,
  idleZ: 0.008,
  pointerX: 0.09,
  pointerY: 0.045,
  damping: 9,
  maxDelta: 0.08,
});

export const GLASS_QUALITY = Object.freeze({ maxPixelRatio: 3, maxPixels: 6_000_000, environmentSize: 512 });
export const GLASS_VIEW = Object.freeze({ aspect: 729 / 665, fov: 36, distance: 5.25 / (2 * Math.tan(Math.PI / 10)) + 0.35 });

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** elapsed is active animation time in milliseconds, never wall-clock time. */
export function getGlassPose({ elapsed = 0, progress = 0, pointerX = 0, pointerY = 0, reduced = false } = {}) {
  const p = reduced ? 0 : clamp(finite(progress), 0, 1);
  const x = reduced ? 0 : clamp(finite(pointerX), -1, 1);
  const y = reduced ? 0 : clamp(finite(pointerY), -1, 1);
  const wave = reduced ? 0 : Math.sin(finite(elapsed) / GLASS_MOTION.period * Math.PI * 2);
  return {
    rotation: [
      -0.055 + p * 0.12 + y * GLASS_MOTION.pointerY + wave * GLASS_MOTION.idleX,
      -0.31 + p * 0.49 + x * GLASS_MOTION.pointerX + wave * GLASS_MOTION.idleY,
      -0.018 + p * 0.025 + wave * GLASS_MOTION.idleZ,
    ],
    position: [p * 0.08, p * 0.19 + wave * GLASS_MOTION.bob, p * 0.28],
  };
}

/** Time-based damping keeps pointer response independent of the display rate. */
export function glassDamping(deltaSeconds) {
  return 1 - Math.exp(-clamp(finite(deltaSeconds), 0, GLASS_MOTION.maxDelta) * GLASS_MOTION.damping);
}

/** Match object-fit:contain without changing the sculpture's perspective. */
export function glassCameraFraming(aspect = GLASS_VIEW.aspect) {
  const ratio = aspect > 0 ? finite(aspect, GLASS_VIEW.aspect) : GLASS_VIEW.aspect;
  const letterbox = Math.max(1, GLASS_VIEW.aspect / ratio);
  return { aspect: ratio, distance: GLASS_VIEW.distance,
    fov: Math.atan(Math.tan(GLASS_VIEW.fov * Math.PI / 360) * letterbox) * 360 / Math.PI };
}

/** Preserve native resolution up to 3x, within the pixel and GPU dimensions. */
export function glassPixelRatio({ width, height, devicePixelRatio = 1, maxDimension = 4096, maxPixels = GLASS_QUALITY.maxPixels } = {}) {
  const w = Math.max(1, finite(width, 1));
  const h = Math.max(1, finite(height, 1));
  const native = devicePixelRatio > 0 ? finite(devicePixelRatio, 1) : 1;
  const dimension = maxDimension > 0 ? finite(maxDimension, 4096) : 4096;
  const budget = maxPixels > 0 ? finite(maxPixels, GLASS_QUALITY.maxPixels) : GLASS_QUALITY.maxPixels;
  return Math.min(native, GLASS_QUALITY.maxPixelRatio, Math.sqrt(budget / w / h), dimension / w, dimension / h);
}
