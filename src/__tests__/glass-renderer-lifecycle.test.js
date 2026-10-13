import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Texture } from "three";
import { createGlassScene } from "../pages/home/glass-scene.js";

const gpu = vi.hoisted(() => ({ renderers: [], environments: [], textureMode: "ready", texture: null, textureResolve: null, dimension: 8192, constructorError: false, renderError: false }));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor(options) {
        if (gpu.constructorError) throw new Error("GPU unavailable");
        this.options = options;
        this.capabilities = { maxTextureSize: gpu.dimension };
        this.setPixelRatio = vi.fn();
        this.setClearColor = vi.fn();
        this.setSize = vi.fn();
        this.resetState = vi.fn();
        this.dispose = vi.fn();
        this.history = [];
        this.render = vi.fn((scene, camera) => {
          if (gpu.renderError) throw new Error("GPU render failed");
          this.scene = scene;
          this.camera = camera;
          const sculpture = scene.children.find((child) => child.isGroup);
          this.history.push({ rotation: [sculpture.rotation.x, sculpture.rotation.y, sculpture.rotation.z], position: sculpture.position.toArray() });
        });
        this.getContext = () => ({ MAX_RENDERBUFFER_SIZE: 1, MAX_TEXTURE_SIZE: 2, MAX_VIEWPORT_DIMS: 3, getParameter: (key) => key === 3 ? [gpu.dimension, gpu.dimension] : gpu.dimension });
        gpu.renderers.push(this);
      }
    },
    PMREMGenerator: class {
      constructor() { this.dispose = vi.fn(); }
      fromScene = vi.fn((_scene, _sigma, _near, _far, options) => {
        const target = { texture: new actual.Texture(), dispose: vi.fn(), options };
        gpu.environments.push(target);
        return target;
      });
    },
    TextureLoader: class {
      loadAsync() {
        if (gpu.textureMode === "error") return Promise.reject(new Error("Optional texture unavailable"));
        if (gpu.textureMode === "pending") return new Promise((resolve) => { gpu.textureResolve = resolve; });
        return Promise.resolve(gpu.texture);
      }
    },
  };
});

function target() {
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
    dispatch(type, event = {}) { [...(listeners.get(type) || [])].forEach((callback) => callback(event)); },
  };
}

let canvas;
let documentTarget;
let windowTarget;
let reduced;
let intersections;
let resizes;
let frames;
let frameId;
let size;
let scenes;

const flushFrame = (time = 16) => {
  const batch = [...frames.values()]; frames.clear();
  batch.forEach((callback) => callback(time));
};
const warmup = () => { for (const time of [16, 32, 48, 64]) flushFrame(time); };
const start = async (props = {}) => {
  const scene = await createGlassScene({ canvas, ...props }); scenes.push(scene); return scene;
};

beforeEach(() => {
  gpu.renderers = []; gpu.environments = []; gpu.textureMode = "ready"; gpu.texture = new Texture(); gpu.textureResolve = null;
  gpu.texture.dispose = vi.fn(); gpu.dimension = 8192; gpu.constructorError = false; gpu.renderError = false;
  frames = new Map(); frameId = 0; size = { width: 400, height: 400 }; scenes = []; intersections = []; resizes = [];
  reduced = { ...target(), matches: false };
  canvas = { ...target(), getBoundingClientRect: () => size };
  const context = { fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn() };
  documentTarget = { ...target(), hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  windowTarget = { ...target(), devicePixelRatio: 3, matchMedia: () => reduced, IntersectionObserver: true, ResizeObserver: true };
  vi.stubGlobal("document", documentTarget); vi.stubGlobal("window", windowTarget);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => { const id = ++frameId; frames.set(id, callback); return id; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id) => frames.delete(id)));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback) { this.update = callback; this.observe = vi.fn(); this.disconnect = vi.fn(); intersections.push(this); }
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback) { this.update = callback; this.observe = vi.fn(); this.disconnect = vi.fn(); resizes.push(this); }
  });
});

afterEach(() => { scenes.forEach((scene) => scene.dispose()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("physical glass renderer lifecycle", () => {
  it("warms up before showing the canvas, then animates the physical pose with a single active RAF", async () => {
    const onReady = vi.fn(); await start({ onReady });
    const renderer = gpu.renderers[0];
    expect(renderer.options).toMatchObject({ alpha: true, antialias: true, powerPreference: "high-performance" });
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(3);
    expect(gpu.environments[0].options).toEqual({ size: 512 });
    expect(frames.size).toBe(1);
    for (const time of [16, 32, 48]) { flushFrame(time); expect(onReady).not.toHaveBeenCalled(); expect(frames.size).toBe(1); }
    flushFrame(64); expect(onReady).toHaveBeenCalledOnce();
    const first = renderer.history[0];
    flushFrame(80); flushFrame(96);
    expect(renderer.history.at(-1).position[1]).not.toBe(first.position[1]);
    expect(renderer.history.at(-1).rotation).not.toEqual(first.rotation);
    expect(frames.size).toBe(1);
  });

  it("does not jump through elapsed wall-clock time after an explicit pause", async () => {
    const scene = await start(); warmup();
    const renderer = gpu.renderers[0]; const before = renderer.history.at(-1);
    scene.setActive(false); expect(frames.size).toBe(0);
    scene.setActive(true); flushFrame(60000);
    const after = renderer.history.at(-1);
    expect(Math.abs(after.position[1] - before.position[1])).toBeLessThan(0.001);
    expect(Math.abs(after.rotation[1] - before.rotation[1])).toBeLessThan(0.001);
    expect(frames.size).toBe(1);
  });

  it("stops hidden/out-of-view rendering and resumes only when both conditions allow it", async () => {
    const scene = await start(); warmup();
    documentTarget.hidden = true; documentTarget.dispatch("visibilitychange"); expect(frames.size).toBe(0);
    intersections[0].update([{ isIntersecting: false }]);
    documentTarget.hidden = false; documentTarget.dispatch("visibilitychange"); expect(frames.size).toBe(0);
    intersections[0].update([{ isIntersecting: true }]); expect(frames.size).toBe(1);
    scene.setActive(false); intersections[0].update([{ isIntersecting: true }]); expect(frames.size).toBe(0);
  });

  it("responds smoothly to pointer changes and bounds impossible pointer coordinates", async () => {
    const scene = await start(); warmup(); const renderer = gpu.renderers[0];
    scene.setPointer(50, -50); expect(frames.size).toBe(1);
    flushFrame(80);
    expect(renderer.history.at(-1).rotation[1]).toBeGreaterThan(-0.31);
    expect(renderer.history.at(-1).rotation[1]).toBeLessThan(-0.31 + 0.09 + 0.021);
    for (let time = 96; time < 1000; time += 16) flushFrame(time);
    const pose = renderer.history.at(-1);
    expect(pose.rotation[0]).toBeGreaterThanOrEqual(-0.055 - 0.045 - 0.014);
    expect(pose.rotation[1]).toBeLessThanOrEqual(-0.31 + 0.09 + 0.021);
    scene.setPointer(NaN, Infinity); flushFrame(1016);
    expect(renderer.history.at(-1).rotation.every(Number.isFinite)).toBe(true);
  });

  it("renders the canonical resting pose once when reduced motion becomes active, then sleeps", async () => {
    const scene = await start(); warmup(); scene.setPointer(1, 1); flushFrame(80);
    reduced.matches = true; reduced.dispatch("change");
    expect(frames.size).toBe(1); flushFrame(96);
    expect(gpu.renderers[0].history.at(-1)).toEqual({ rotation: [-0.055, -0.31, -0.018], position: [0, 0, 0] });
    expect(frames.size).toBe(0);
    reduced.matches = false; reduced.dispatch("change"); expect(frames.size).toBe(1);
  });

  it("honors the physical pixel budget on resize and the GPU maximum dimension", async () => {
    gpu.dimension = 2048; await start();
    size = { width: 1600, height: 1000 }; resizes[0].update();
    const ratio = gpu.renderers[0].setPixelRatio.mock.lastCall[0];
    expect(size.width * ratio).toBeLessThanOrEqual(2048);
    expect(size.width * size.height * ratio ** 2).toBeLessThanOrEqual(6_000_000);
    expect(gpu.renderers[0].setSize).toHaveBeenLastCalledWith(1600, 1000, false);
    expect(frames.size).toBe(1);
  });

  it("recalculates framing and native density through consecutive viewport changes", async () => {
    await start(); warmup();
    const renderer = gpu.renderers[0]; const distance = renderer.camera.position.z;
    size = { width: 300, height: 600 }; windowTarget.devicePixelRatio = 2; resizes[0].update(); flushFrame(80);
    const narrowFov = renderer.camera.fov;
    expect(narrowFov).toBeGreaterThan(36); expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(2);
    size = { width: 800, height: 400 }; windowTarget.devicePixelRatio = 3; resizes[0].update(); flushFrame(96);
    expect(renderer.camera.fov).toBe(36); expect(renderer.camera.position.z).toBe(distance);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(3);
    size = { width: 300, height: 600 }; resizes[0].update(); flushFrame(112);
    expect(renderer.camera.fov).toBe(narrowFov); expect(renderer.camera.position.z).toBe(distance);
    expect(frames.size).toBe(1);
  });

  it("keeps the physical glass usable if its optional atmosphere cannot load", async () => {
    gpu.textureMode = "error"; const onError = vi.fn(); const onReady = vi.fn();
    await start({ onError, onReady }); warmup();
    expect(onError).not.toHaveBeenCalled(); expect(onReady).toHaveBeenCalledOnce();
  });

  it("settles an aborted setup while the texture is pending and disposes the late texture exactly once", async () => {
    gpu.textureMode = "pending"; const signal = new AbortController(); const onError = vi.fn(); const onReady = vi.fn();
    const pending = createGlassScene({ canvas, signal: signal.signal, onError, onReady });
    await vi.dynamicImportSettled();
    expect(gpu.textureResolve).toBeTypeOf("function");
    signal.abort(); const controller = await pending; scenes.push(controller);
    expect(gpu.renderers[0].dispose).toHaveBeenCalledOnce(); expect(gpu.environments[0].dispose).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0); expect(onError).not.toHaveBeenCalled(); expect(onReady).not.toHaveBeenCalled();
    gpu.textureResolve(gpu.texture); await Promise.resolve(); await Promise.resolve();
    expect(gpu.texture.dispose).toHaveBeenCalledOnce();
    expect(gpu.renderers[0].render).not.toHaveBeenCalled();
  });

  it("does not create a renderer when cancelled during the module import or already aborted", async () => {
    const signal = new AbortController(); const onError = vi.fn();
    const pending = createGlassScene({ canvas, signal: signal.signal, onError }); signal.abort();
    scenes.push(await pending);
    expect(gpu.renderers).toHaveLength(0);
    scenes.push(await createGlassScene({ canvas, signal: signal.signal, onError }));
    expect(gpu.renderers).toHaveLength(0); expect(onError).not.toHaveBeenCalled();
  });

  it("cleans listeners, RAF and every owned scene resource on abort and repeated disposal", async () => {
    const signal = new AbortController(); const scene = await start({ signal: signal.signal }); warmup();
    const renderer = gpu.renderers[0]; const resources = new Set();
    renderer.scene.traverse((item) => {
      if (item.geometry) resources.add(item.geometry);
      for (const material of Array.isArray(item.material) ? item.material : item.material ? [item.material] : []) {
        resources.add(material);
        for (const key of ["normalMap", "bumpMap"]) if (material[key]) resources.add(material[key]);
      }
    });
    const disposal = [...resources].map((resource) => vi.spyOn(resource, "dispose"));
    signal.abort(); scene.dispose();
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(gpu.environments[0].dispose).toHaveBeenCalledOnce();
    expect(renderer.resetState).toHaveBeenCalledOnce();
    expect(renderer.resetState.mock.invocationCallOrder[0]).toBeLessThan(renderer.dispose.mock.invocationCallOrder[0]);
    expect(gpu.texture.dispose).toHaveBeenCalledOnce(); disposal.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    expect(frames.size).toBe(0); expect(canvas.listeners.size).toBe(0); expect(windowTarget.listeners.size).toBe(0); expect(documentTarget.listeners.size).toBe(0); expect(reduced.listeners.size).toBe(0);
    expect(intersections[0].disconnect).toHaveBeenCalledOnce(); expect(resizes[0].disconnect).toHaveBeenCalledOnce();
    scene.setActive(true); scene.setPointer(1, 1); scene.resize(); expect(frames.size).toBe(0);
  });

  it("reports lost contexts once, stops rendering and can warm up after restoration", async () => {
    const onError = vi.fn(); const onReady = vi.fn(); await start({ onError, onReady }); warmup();
    const preventDefault = vi.fn(); canvas.dispatch("webglcontextlost", { preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce(); expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "WebGL context lost" })); expect(frames.size).toBe(0);
    canvas.dispatch("webglcontextrestored"); warmup();
    expect(onReady).toHaveBeenCalledTimes(2); expect(onError).toHaveBeenCalledOnce();
  });

  it("falls back cleanly after renderer construction or render failures", async () => {
    const onError = vi.fn(); gpu.constructorError = true; await start({ onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "GPU unavailable" })); expect(frames.size).toBe(0);
    gpu.constructorError = false; gpu.renderError = true; const scene = await start({ onError }); flushFrame();
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ message: "GPU render failed" })); expect(frames.size).toBe(0);
    scene.dispose(); expect(gpu.renderers[0].dispose).toHaveBeenCalledOnce();
  });

  it("keeps SSR and missing-canvas paths independent from browser/WebGL APIs", async () => {
    vi.stubGlobal("window", undefined);
    scenes.push(await createGlassScene({ canvas })); scenes.push(await createGlassScene());
    expect(gpu.renderers).toHaveLength(0); expect(frames.size).toBe(0);
  });
});
