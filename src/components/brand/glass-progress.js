/**
 * Scroll progress (0 to 1) for one sculpture. A page writes it from its own
 * scroll timeline and GlassScene forwards it to the engine, without a React
 * render on every frame. The engine damps the pose and ignores progress in
 * reduced motion, so the value can be written as often as the scroll updates.
 */
export function createGlassProgress() {
  let value = 0;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      const clamped = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 0;
      if (clamped === value) return;
      value = clamped;
      listeners.forEach(listener => listener(value));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
