import { describe, expect, it, vi } from "vitest";
import { createGlassProgress } from "../components/brand/glass-progress.js";

describe("glass scroll progress", () => {
  it("starts at rest, clamps values and treats invalid input as rest", () => {
    const progress = createGlassProgress();
    expect(progress.get()).toBe(0);
    progress.set(0.35);
    expect(progress.get()).toBe(0.35);
    progress.set(4);
    expect(progress.get()).toBe(1);
    progress.set(-2);
    expect(progress.get()).toBe(0);
    progress.set(0.6);
    progress.set(Number.NaN);
    expect(progress.get()).toBe(0);
  });

  it("notifies only real changes and stops after unsubscribe", () => {
    const progress = createGlassProgress();
    const listener = vi.fn();
    const unsubscribe = progress.subscribe(listener);
    progress.set(0.5);
    progress.set(0.5);
    progress.set(2);
    progress.set(1);
    expect(listener.mock.calls).toEqual([[0.5], [1]]);
    unsubscribe();
    progress.set(0.2);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
