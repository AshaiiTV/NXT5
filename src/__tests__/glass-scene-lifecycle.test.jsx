import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlassScene from "../components/brand/GlassScene.jsx";
import { createGlassScene } from "../pages/home/glass-scene.js";

const engine = vi.hoisted(() => ({ createGlassScene: vi.fn() }));
vi.mock("../pages/home/glass-scene.js", () => engine);
let renderer, reduced, lowGpu, savedMode, preferences, intersections;

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener: vi.fn((type, callback) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    }),
    removeEventListener: vi.fn((type, callback) => {
      const callbacks = listeners.get(type);
      callbacks?.delete(callback);
      if (!callbacks?.size) listeners.delete(type);
    }),
    dispatch(type, event = {}) { listeners.get(type)?.forEach(callback => callback(event)); },
  };
}
const controller = () => ({ dispose: vi.fn(), setPointer: vi.fn(), setActive: vi.fn() });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  reduced = { ...eventTarget(), matches: false };
  lowGpu = false;
  savedMode = "full";
  preferences = [];
  intersections = [];
  vi.stubGlobal("window", { ...eventTarget(), innerWidth: 1200, innerHeight: 800,
    matchMedia: () => reduced, localStorage: { getItem: () => savedMode } });
  vi.stubGlobal("document", { ...eventTarget(), hidden: false,
    documentElement: { classList: { contains: () => lowGpu } } });
  vi.stubGlobal("MutationObserver", class {
    constructor(callback) { this.update = callback; preferences.push(this); }
    observe = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback) { this.update = visible => callback([{ isIntersecting: visible }]); intersections.push(this); }
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
const settle = async () => { await act(async () => { await vi.dynamicImportSettled(); }); };
async function mount(props = {}, { visible = true, count = 1 } = {}) {
  await act(async () => {
    renderer = TestRenderer.create(<>{Array.from({ length: count }, (_, i) => <GlassScene key={i} {...props} />)}</>, {
      createNodeMock: () => ({}),
    });
  });
  act(() => intersections.forEach(observer => observer.update(visible)));
  await settle();
}
const isReady = () => renderer.root.findAllByType("div")[0].props.className.includes("is-ready");

describe("shared glass scene lifecycle", () => {
  it.each(["reduced motion", "performance", "saved performance", "paused"])("keeps the poster without starting WebGL in %s mode", async mode => {
    if (mode === "reduced motion") reduced.matches = true;
    if (mode === "performance") lowGpu = true;
    if (mode === "saved performance") savedMode = "low";
    await mount({ motionEnabled: mode !== "paused" });
    expect(createGlassScene).not.toHaveBeenCalled();
    expect(isReady()).toBe(false);
    expect(renderer.root.findByType("img").props.src).toBe("/assets/home-motion/glass-poster.webp");
  });

  it("uses the same engine on mobile, with a static fallback until its first frame", async () => {
    window.innerWidth = 320;
    await mount();
    expect(createGlassScene).toHaveBeenCalledOnce();
    expect(isReady()).toBe(false);
    act(() => createGlassScene.mock.calls[0][0].onReady());
    expect(isReady()).toBe(true);
  });

  it("shares one viewport pointer subscription, ignores touch and resets on exit/blur/resize", async () => {
    const first = controller(), second = controller();
    createGlassScene.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await mount({}, { count: 2 });
    expect(renderer.root.findAllByType("div")).toHaveLength(2);
    expect(intersections).toHaveLength(2);
    await act(async () => {
      await vi.waitFor(() => expect(createGlassScene).toHaveBeenCalledTimes(2));
    });
    expect(first.setActive).toHaveBeenCalledWith(true);
    expect(second.setActive).toHaveBeenCalledWith(true);
    expect(window.listeners.get("pointermove").size).toBe(1);
    window.dispatch("pointermove", { clientX: 1200, clientY: 0, pointerType: "mouse" });
    for (const scene of [first, second]) expect(scene.setPointer).toHaveBeenLastCalledWith(1, -1);
    window.dispatch("pointermove", { clientX: 0, clientY: 800, pointerType: "touch" });
    expect(first.setPointer).toHaveBeenCalledTimes(1);
    window.dispatch("pointermove", { clientX: -100, clientY: 900, pointerType: "mouse" });
    expect(first.setPointer).toHaveBeenLastCalledWith(-1, 1);
    window.dispatch("pointerout", { relatedTarget: {} });
    expect(first.setPointer).toHaveBeenLastCalledWith(-1, 1);
    for (const event of ["pointerout", "pointercancel", "blur", "resize"]) {
      window.dispatch(event);
      expect(first.setPointer).toHaveBeenLastCalledWith(0, 0);
    }
    act(() => renderer.unmount()); renderer = undefined;
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
    expect(window.listeners.size).toBe(0);
    expect(document.listeners.size).toBe(0);
    expect(reduced.listeners.size).toBe(0);
    for (const observer of [...preferences, ...intersections]) expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("starts only in view, pauses outside it or a hidden tab, then resumes the same scene", async () => {
    const scene = controller(); createGlassScene.mockResolvedValue(scene);
    await mount({}, { visible: false });
    expect(createGlassScene).not.toHaveBeenCalled();
    act(() => intersections[0].update(true)); await settle();
    expect(scene.setActive).toHaveBeenLastCalledWith(true);
    act(() => intersections[0].update(false));
    expect(scene.setActive).toHaveBeenLastCalledWith(false);
    expect(scene.setPointer).toHaveBeenLastCalledWith(0, 0);
    window.dispatch("pointermove", { clientX: 0, clientY: 0 });
    expect(scene.setPointer).toHaveBeenLastCalledWith(0, 0);
    act(() => { document.hidden = true; intersections[0].update(true); });
    expect(scene.setActive).toHaveBeenLastCalledWith(false);
    act(() => { document.hidden = false; document.dispatch("visibilitychange"); });
    expect(scene.setActive).toHaveBeenLastCalledWith(true);
    expect(createGlassScene).toHaveBeenCalledOnce();
    expect(scene.dispose).not.toHaveBeenCalled();
  });

  it("finishes and disposes a cancelled setup before starting another on the same canvas", async () => {
    const pending = deferred(), stale = controller(), current = controller();
    createGlassScene.mockReturnValueOnce(pending.promise).mockResolvedValue(current);
    await mount();
    const staleCallbacks = createGlassScene.mock.calls[0][0];
    act(() => {
      reduced.matches = true; reduced.dispatch("change");
      reduced.matches = false; reduced.dispatch("change");
      staleCallbacks.onReady();
    });
    expect(staleCallbacks.signal.aborted).toBe(true);
    expect(isReady()).toBe(false);
    expect(createGlassScene).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(stale)); await settle();
    expect(stale.dispose).toHaveBeenCalledOnce();
    expect(createGlassScene).toHaveBeenCalledTimes(2);
    act(() => createGlassScene.mock.calls[1][0].onReady());
    expect(isReady()).toBe(true);
    act(() => { lowGpu = true; preferences[0].update(); });
    expect(isReady()).toBe(false);
    expect(current.dispose).toHaveBeenCalledOnce();
  });

  it("applies saved performance changes through storage before the HTML class changes", async () => {
    const scene = controller(); createGlassScene.mockResolvedValue(scene);
    await mount();
    act(() => { savedMode = "low"; window.dispatch("storage"); });
    expect(scene.dispose).toHaveBeenCalledOnce();
    expect(isReady()).toBe(false);
  });

  it("returns to the poster after a rendering failure without repeatedly retrying WebGL", async () => {
    const scene = controller(); createGlassScene.mockResolvedValue(scene);
    await mount();
    const callbacks = createGlassScene.mock.calls[0][0];
    act(() => callbacks.onReady());
    act(() => callbacks.onError(new Error("WebGL context lost")));
    expect(isReady()).toBe(false);
    expect(scene.dispose).toHaveBeenCalledOnce();
    act(() => preferences[0].update());
    expect(createGlassScene).toHaveBeenCalledOnce();
  });

  it("reveals the fallback for a context loss while offscreen, before returning to view", async () => {
    const scene = controller(); createGlassScene.mockResolvedValue(scene);
    await mount();
    const callbacks = createGlassScene.mock.calls[0][0];
    act(() => callbacks.onReady());
    act(() => intersections[0].update(false));
    act(() => callbacks.onError(new Error("WebGL context lost in background")));
    expect(isReady()).toBe(false);
    expect(scene.dispose).toHaveBeenCalledOnce();
    act(() => intersections[0].update(true));
    expect(createGlassScene).toHaveBeenCalledOnce();
  });

  it("aborts a late setup after unmount and never attaches it to an abandoned scene", async () => {
    const pending = deferred(), scene = controller();
    createGlassScene.mockReturnValue(pending.promise);
    await mount();
    const { signal } = createGlassScene.mock.calls[0][0];
    act(() => renderer.unmount()); renderer = undefined;
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(scene));
    expect(scene.dispose).toHaveBeenCalledOnce();
    expect(window.listeners.size).toBe(0);
    expect(createGlassScene).toHaveBeenCalledOnce();
  });
});
