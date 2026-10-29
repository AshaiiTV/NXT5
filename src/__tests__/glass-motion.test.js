import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { GLASS_MOTION, GLASS_QUALITY, GLASS_VIEW, getGlassPose, glassCameraFraming, glassDamping, glassPixelRatio } from "../components/brand/glass-motion.js";

describe("canonical glass motion", () => {
  it("preserves the authored resting pose and keeps all eight-second cycles identical", () => {
    const resting = getGlassPose();
    expect(resting).toEqual({ rotation: [-0.055, -0.31, -0.018], position: [0, 0, 0] });
    for (const elapsed of [8000, 16000, 800000]) {
      const pose = getGlassPose({ elapsed });
      pose.rotation.forEach((value, index) => expect(value).toBeCloseTo(resting.rotation[index], 10));
      pose.position.forEach((value, index) => expect(value).toBeCloseTo(resting.position[index], 10));
    }
  });

  it("uses a bounded vertical float and real angular pose changes", () => {
    const upper = getGlassPose({ elapsed: 2000 });
    const lower = getGlassPose({ elapsed: 6000 });
    expect(upper.position[1]).toBe(GLASS_MOTION.bob);
    expect(lower.position[1]).toBe(-GLASS_MOTION.bob);
    expect(upper.rotation[0]).toBeCloseTo(-0.055 + GLASS_MOTION.idleX);
    expect(upper.rotation[1]).toBeCloseTo(-0.31 + GLASS_MOTION.idleY);
    expect(upper.rotation[2]).toBeCloseTo(-0.018 + GLASS_MOTION.idleZ);
  });

  it("normalizes input to the same bounded pointer amplitude in every placement", () => {
    expect(getGlassPose({ pointerX: 40, pointerY: -40 })).toEqual(getGlassPose({ pointerX: 1, pointerY: -1 }));
    const right = getGlassPose({ pointerX: 1 });
    const left = getGlassPose({ pointerX: -1 });
    expect(right.rotation[1] - left.rotation[1]).toBeCloseTo(GLASS_MOTION.pointerX * 2);
    expect(getGlassPose({ pointerY: 1 }).rotation[0]).toBeCloseTo(-0.055 + GLASS_MOTION.pointerY);
  });

  it("keeps the exact resting identity when reduced, even with pending pointer/scroll inputs", () => {
    expect(getGlassPose({ reduced: true, elapsed: 2000, pointerX: 1, pointerY: -1, progress: 1 })).toEqual(getGlassPose());
    expect(getGlassPose({ elapsed: NaN, pointerX: Infinity, pointerY: null, progress: undefined })).toEqual(getGlassPose());
  });

  it("retains the previous scroll API as a bounded compatibility input", () => {
    expect(getGlassPose({ progress: -1 })).toEqual(getGlassPose());
    expect(getGlassPose({ progress: 9 })).toEqual(getGlassPose({ progress: 1 }));
    expect(getGlassPose({ progress: 1 }).position).toEqual([0.08, 0.19, 0.28]);
  });

  it("damps equally over the same active time at different display rates", () => {
    const advance = (steps, delta) => {
      let value = 0;
      for (let index = 0; index < steps; index += 1) value += (1 - value) * glassDamping(delta);
      return value;
    };
    expect(advance(60, 1 / 60)).toBeCloseTo(advance(30, 1 / 30), 12);
    expect(advance(120, 1 / 120)).toBeCloseTo(advance(30, 1 / 30), 12);
    expect(glassDamping(0)).toBe(0);
    expect(glassDamping(-1)).toBe(0);
    expect(glassDamping(NaN)).toBe(0);
    expect(glassDamping(30)).toBe(glassDamping(GLASS_MOTION.maxDelta));
  });
});

describe("poster and canvas framing", () => {
  const camera = (aspect) => {
    const framing = glassCameraFraming(aspect);
    const view = new PerspectiveCamera(framing.fov, framing.aspect, 0.1, 70);
    view.position.set(0, 0.08, framing.distance); view.lookAt(0, 0.08, 0); view.updateMatrixWorld();
    return view;
  };

  it("preserves the canonical 729/665 poster capture exactly", () => {
    expect(glassCameraFraming()).toEqual({ aspect: 729 / 665, distance: GLASS_VIEW.distance, fov: 36 });
    expect(glassCameraFraming(729 / 665).distance).toBe(5.25 / (2 * Math.tan(Math.PI / 10)) + 0.35);
  });

  it.each([0.5, 0.9, 1, 729 / 665, 2, 4])("matches object-fit:contain at aspect %s at both the front and back of the volume", (aspect) => {
    for (const point of [new Vector3(-1.55, 2.2, 0.4), new Vector3(1.48, -1.75, -0.4)]) {
      const canonical = point.clone().project(camera(GLASS_VIEW.aspect));
      const actual = point.clone().project(camera(aspect));
      expect(actual.x).toBeCloseTo(canonical.x * Math.min(1, GLASS_VIEW.aspect / aspect), 12);
      expect(actual.y).toBeCloseTo(canonical.y * Math.min(1, aspect / GLASS_VIEW.aspect), 12);
    }
  });

  it("keeps canonical framing when aspect measurements are unavailable", () => {
    expect(glassCameraFraming(2).fov).toBe(36);
    for (const invalid of [0, -1, NaN, Infinity]) expect(glassCameraFraming(invalid)).toEqual(glassCameraFraming());
  });
});

describe("glass rendering resolution", () => {
  it.each([1, 1.5, 2, 3])("preserves native %sx density when within budget", (devicePixelRatio) => {
    expect(glassPixelRatio({ width: 400, height: 400, devicePixelRatio })).toBe(devicePixelRatio);
  });

  it("caps excessive device density without reducing the declared native range", () => {
    expect(glassPixelRatio({ width: 400, height: 400, devicePixelRatio: 5 })).toBe(GLASS_QUALITY.maxPixelRatio);
    expect(glassPixelRatio({ width: 400, height: 400, devicePixelRatio: 0.75 })).toBe(0.75);
  });

  it("bounds the total physical framebuffer area to six million pixels", () => {
    const ratio = glassPixelRatio({ width: 1600, height: 1000, devicePixelRatio: 3 });
    expect(ratio).toBeCloseTo(Math.sqrt(6_000_000 / 1_600_000));
    expect(1600 * 1000 * ratio ** 2).toBeLessThanOrEqual(GLASS_QUALITY.maxPixels + 0.0001);
  });

  it("respects GPU maximum dimensions even when the area budget allows higher density", () => {
    const ratio = glassPixelRatio({ width: 800, height: 600, devicePixelRatio: 3, maxDimension: 1024 });
    expect(ratio).toBe(1.28);
    expect(800 * ratio).toBe(1024);
    expect(600 * ratio).toBeLessThan(1024);
  });

  it("can downsample a huge canvas to honor the budget rather than allocating without bound", () => {
    const ratio = glassPixelRatio({ width: 10000, height: 10000, devicePixelRatio: 3 });
    expect(ratio).toBeLessThan(1);
    expect(10000 * 10000 * ratio ** 2).toBeLessThanOrEqual(6_000_000 + 0.0001);
  });

  it("keeps invalid or empty measurements finite and positive", () => {
    for (const input of [{}, { width: 0, height: 0 }, { width: NaN, height: Infinity, devicePixelRatio: Infinity }, { width: -1, height: 100, devicePixelRatio: 0, maxDimension: NaN, maxPixels: 0 }]) {
      expect(Number.isFinite(glassPixelRatio(input))).toBe(true);
      expect(glassPixelRatio(input)).toBeGreaterThan(0);
    }
  });
});
