import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlassScene from "../components/brand/GlassScene.jsx";
import { createGlassScene } from "../pages/home/glass-scene.js";

vi.mock("../pages/home/glass-scene.js", () => ({ createGlassScene: vi.fn() }));

let renderer;
let desktop;
let reduced;
let lowGpu;
let preferences;

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener: vi.fn((type, callback) => listeners.set(type, callback)),
    removeEventListener: vi.fn((type, callback) => {
      if (listeners.get(type) === callback) listeners.delete(type);
    }),
    dispatch(type, event) { listeners.get(type)?.(event); },
    getBoundingClientRect: () => ({ left: 20, top: 30, width: 400, height: 200 }),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const controller = () => ({ dispose: vi.fn(), setPointer: vi.fn() });

beforeEach(() => {
  desktop = { ...eventTarget(), matches: true };
  reduced = { ...eventTarget(), matches: false };
  lowGpu = false;
  vi.stubGlobal("window", { matchMedia: query => query.includes("min-width") ? desktop : reduced });
  vi.stubGlobal("document", { documentElement: { classList: { contains: () => lowGpu } } });
  vi.stubGlobal("MutationObserver", class {
    constructor(callback) { this.update = callback; preferences = this; }
    observe = vi.fn();
    disconnect = vi.fn();
  });
  createGlassScene.mockReset();
  createGlassScene.mockResolvedValue(controller());
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

async function mount(props = {}) {
  const element = eventTarget();
  const canvas = {};
  await act(async () => {
    renderer = TestRenderer.create(<GlassScene {...props} />, {
      createNodeMock: node => node.type === "canvas" ? canvas : element,
    });
  });
  await act(async () => { await vi.dynamicImportSettled(); });
  return element;
}

const isReady = () => renderer.root.findByType("div").props.className.includes("is-ready");

describe("shared glass scene lifecycle", () => {
  it.each(["mobile", "reduced motion", "performance"])("keeps the poster without starting WebGL in %s mode", async mode => {
    if (mode === "mobile") desktop.matches = false;
    if (mode === "reduced motion") reduced.matches = true;
    if (mode === "performance") lowGpu = true;
    await mount();
    expect(createGlassScene).not.toHaveBeenCalled();
    expect(isReady()).toBe(false);
    expect(renderer.root.findByType("img").props.src).toBe("/assets/home-motion/glass-poster.webp");
  });

  it("reacts across the supplied pointer area only after setup and cleans up all subscriptions", async () => {
    const scene = controller();
    createGlassScene.mockResolvedValue(scene);
    const hero = eventTarget();
    const element = await mount({ pointerTargetRef: { current: hero }, pointerStrength: 1 });
    expect(isReady()).toBe(false);
    act(() => createGlassScene.mock.calls[0][0].onReady());
    expect(isReady()).toBe(true);
    hero.dispatch("pointermove", { clientX: 420, clientY: 30, pointerType: "mouse" });
    expect(scene.setPointer).toHaveBeenLastCalledWith(1, -1);
    hero.dispatch("pointermove", { clientX: 20, clientY: 230, pointerType: "touch" });
    expect(scene.setPointer).toHaveBeenCalledTimes(1);
    hero.dispatch("pointerleave");
    expect(scene.setPointer).toHaveBeenLastCalledWith(0, 0);
    hero.dispatch("pointercancel");
    expect(scene.setPointer).toHaveBeenLastCalledWith(0, 0);
    expect(element.listeners.size).toBe(0);
    act(() => renderer.unmount());
    renderer = undefined;
    expect(scene.dispose).toHaveBeenCalledOnce();
    expect(hero.listeners.size).toBe(0);
    expect(desktop.listeners.size).toBe(0);
    expect(reduced.listeners.size).toBe(0);
    expect(preferences.disconnect).toHaveBeenCalledOnce();
  });

  it("finishes and disposes a cancelled setup before starting another on the same canvas", async () => {
    const pending = deferred();
    const stale = controller();
    const current = controller();
    createGlassScene.mockReturnValueOnce(pending.promise).mockResolvedValue(current);
    await mount();
    const staleCallbacks = createGlassScene.mock.calls[0][0];
    act(() => {
      reduced.matches = true;
      reduced.dispatch("change");
      reduced.matches = false;
      reduced.dispatch("change");
      staleCallbacks.onReady();
    });
    expect(isReady()).toBe(false);
    expect(createGlassScene).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve(stale); });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(stale.dispose).toHaveBeenCalledOnce();
    expect(createGlassScene).toHaveBeenCalledTimes(2);
    act(() => createGlassScene.mock.calls[1][0].onReady());
    expect(isReady()).toBe(true);
    act(() => {
      lowGpu = true;
      preferences.update();
    });
    expect(isReady()).toBe(false);
    expect(current.dispose).toHaveBeenCalledOnce();
  });

  it("returns to the poster after a rendering failure without repeatedly retrying WebGL", async () => {
    const scene = controller();
    createGlassScene.mockResolvedValue(scene);
    await mount();
    const callbacks = createGlassScene.mock.calls[0][0];
    act(() => callbacks.onReady());
    expect(isReady()).toBe(true);
    act(() => callbacks.onError(new Error("WebGL context lost")));
    expect(isReady()).toBe(false);
    expect(scene.dispose).toHaveBeenCalledOnce();
    act(() => preferences.update());
    expect(createGlassScene).toHaveBeenCalledOnce();
  });

  it("disposes a late setup after unmount without attaching it to an abandoned scene", async () => {
    const pending = deferred();
    const scene = controller();
    createGlassScene.mockReturnValue(pending.promise);
    const element = await mount();
    act(() => renderer.unmount());
    renderer = undefined;
    await act(async () => pending.resolve(scene));
    expect(scene.dispose).toHaveBeenCalledOnce();
    expect(element.listeners.size).toBe(0);
    expect(createGlassScene).toHaveBeenCalledOnce();
  });
});
