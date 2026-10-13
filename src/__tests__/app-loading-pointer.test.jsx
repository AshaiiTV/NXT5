import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppLoadingScreen from "../components/loading/AppLoadingScreen.jsx";
import GlassScene from "../components/brand/GlassScene.jsx";
import { createGlassScene } from "../pages/home/glass-scene.js";
import { PERFORMANCE_MODE_STORAGE_KEY } from "../app/performance.js";
import { setLanguage } from "../i18n/locale.js";

vi.mock("../pages/home/glass-scene.js", () => ({ createGlassScene: vi.fn() }));

let renderer;
let sculpture;
let canvas;
let controller;
let browser;
let documentTarget;

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener: vi.fn((type, callback) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    }),
    removeEventListener: vi.fn((type, callback) => {
      listeners.get(type)?.delete(callback);
      if (!listeners.get(type)?.size) listeners.delete(type);
    }),
    getBoundingClientRect: () => ({ left: 20, top: 30, right: 420, bottom: 430, width: 400, height: 400 }),
  };
}

beforeEach(() => {
  setLanguage("fr", { persist: false });
  sculpture = eventTarget();
  canvas = {};
  controller = { dispose: vi.fn(), setPointer: vi.fn(), setActive: vi.fn() };
  browser = {
    ...eventTarget(), innerWidth: 1440, innerHeight: 900,
    localStorage: { getItem: vi.fn(() => "full") },
    matchMedia: vi.fn(query => ({ ...eventTarget(), matches: !query.includes("prefers-reduced-motion") })),
  };
  documentTarget = {
    ...eventTarget(), hidden: false, visibilityState: "visible",
    documentElement: { classList: { contains: () => false } },
  };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", documentTarget);
  vi.stubGlobal("MutationObserver", class { observe = vi.fn(); disconnect = vi.fn(); });
  createGlassScene.mockReset();
  createGlassScene.mockResolvedValue(controller);
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

async function mount(props = {}) {
  await act(async () => {
    renderer = TestRenderer.create(<AppLoadingScreen {...props} />, {
      createNodeMock: node => node.type === "canvas" ? canvas
        : node.props.className?.split(" ").includes("nxt5-glass-scene") ? sculpture : {},
    });
  });
  await act(async () => { await vi.dynamicImportSettled(); });
}

const scene = () => renderer.root.findByType(GlassScene);
const isReady = () => scene().find(node => node.type === "div" && node.props.className?.split(" ").includes("nxt5-glass-scene")).props.className.includes("is-ready");

describe("loading integration with the shared glass scene", () => {
  it("preserves one shared scene, canvas and controller while the actual loading phase and count change", async () => {
    await mount();
    const instance = scene();
    const canvasInstance = instance.findByType("canvas").instance;
    const subscriptions = [browser, documentTarget, sculpture].map(target => ({ target, calls: target.addEventListener.mock.calls.length }));
    expect(instance.props).toEqual({ className: "nxt5-sync-glass-scene" });
    expect(createGlassScene).toHaveBeenCalledOnce();
    act(() => createGlassScene.mock.calls[0][0].onReady());
    expect(isReady()).toBe(true);

    for (const props of [{ phase: "session" }, { phase: "bootstrap", progress: { loaded: 3, total: 18 } }, { phase: "bootstrap", progress: { loaded: 18, total: 18 } }]) {
      act(() => renderer.update(<AppLoadingScreen {...props} />));
      expect(scene()).toBe(instance);
      expect(scene().findByType("canvas").instance).toBe(canvasInstance);
      expect(renderer.root.findByProps({ className: "nxt5-sync-screen" }).props["data-phase"]).toBe(props.phase);
      expect(renderer.root.findByProps({ role: "progressbar" }).props["aria-valuenow"]).toBe(props.progress?.loaded);
      expect(isReady()).toBe(true);
      expect(createGlassScene).toHaveBeenCalledOnce();
      expect(controller.dispose).not.toHaveBeenCalled();
      for (const { target, calls } of subscriptions) expect(target.addEventListener).toHaveBeenCalledTimes(calls);
    }
    expect(renderer.root.findByProps({ role: "status" }).props["aria-live"]).toBe("polite");
    expect(renderer.root.findAll(node => node.type === "span" && node.props.className === "nxt5-sync-role-name").map(node => node.children.join(""))).toEqual(["TOP", "JGL", "MID", "ADC", "SUP"]);
    act(() => renderer.unmount());
    renderer = undefined;
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("returns to the shared poster after a rendering failure without changing the real loading state", async () => {
    await mount({ phase: "bootstrap", progress: { loaded: 7, total: 18 } });
    act(() => createGlassScene.mock.calls[0][0].onReady());
    expect(isReady()).toBe(true);
    act(() => createGlassScene.mock.calls[0][0].onError(new Error("WebGL context lost")));
    expect(isReady()).toBe(false);
    expect(scene().findByType("img").props.src).toBe("/assets/home-motion/glass-poster.webp");
    expect(renderer.root.findByProps({ role: "progressbar" }).props["aria-valuetext"]).toBe("7 parties reçues sur 18");
    expect(renderer.root.findByProps({ role: "status" }).findByType("h1").children).toEqual(["Synchronisation en cours"]);
    act(() => renderer.update(<AppLoadingScreen phase="bootstrap" progress={{ loaded: 12, total: 18 }} />));
    expect(createGlassScene).toHaveBeenCalledOnce();
    expect(renderer.root.findByProps({ role: "progressbar" }).props["aria-valuenow"]).toBe(12);
  });

  it("honors saved performance mode before the application has added its HTML class", async () => {
    browser.localStorage.getItem.mockImplementation(key => key === PERFORMANCE_MODE_STORAGE_KEY ? "low" : null);
    await mount({ phase: "bootstrap", progress: { loaded: 2, total: 9 } });
    expect(createGlassScene).not.toHaveBeenCalled();
    expect(isReady()).toBe(false);
    expect(scene().findByType("img").props.src).toBe("/assets/home-motion/glass-poster.webp");
    expect(renderer.root.findByProps({ role: "progressbar" }).props["aria-valuenow"]).toBe(2);
  });

  it("keeps the shared poster and accessible phase in server rendering", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    const html = renderToStaticMarkup(<AppLoadingScreen phase="session" />);
    expect(html).toContain("nxt5-glass-scene nxt5-sync-glass-scene");
    expect(html).toContain("/assets/home-motion/glass-poster.webp");
    expect(html).toContain("Connexion à ton espace");
    expect(html).not.toMatch(/nxt5-sync-core-(pointer|arrival|float)|nxt5-sync-glass-light/);
    expect(createGlassScene).not.toHaveBeenCalled();
  });
});
