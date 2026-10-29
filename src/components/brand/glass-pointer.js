// One viewport listener feeds every visible sculpture with the same input.
// Decorative wrappers use pointer-events:none, so listen globally.
const subscribers = new Set();
let detach;

export function subscribeGlassPointer(callback) {
  subscribers.add(callback);
  if (!detach) {
    const emit = (x, y) => subscribers.forEach(listener => listener(x, y));
    const reset = () => emit(0, 0);
    const move = event => {
      if (event.pointerType === "touch") return;
      const clamp = value => Math.max(-1, Math.min(1, value));
      emit(clamp(event.clientX / Math.max(1, window.innerWidth) * 2 - 1),
        clamp(event.clientY / Math.max(1, window.innerHeight) * 2 - 1));
    };
    const exit = event => { if (!event.relatedTarget) reset(); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", exit);
    for (const event of ["pointercancel", "blur", "resize"]) window.addEventListener(event, reset);
    detach = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", exit);
      for (const event of ["pointercancel", "blur", "resize"]) window.removeEventListener(event, reset);
      detach = undefined;
    };
  }
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size) detach?.();
  };
}
