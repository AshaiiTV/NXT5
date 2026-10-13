import { GLASS_QUALITY, GLASS_VIEW, getGlassPose, glassCameraFraming, glassDamping, glassPixelRatio } from "../../components/brand/glass-motion.js";

/**
 * The sculptural 5 is deliberately authored as geometry, not a font glyph.
 * Everything needed by the scene is local; the studio is baked once into an
 * environment texture. Idle motion runs only while this sculpture is visible.
 */
export async function createGlassScene({ canvas, onReady, onError, signal } = {}) {
  const idleController = {
    setProgress() {},
    setPointer() {},
    setActive() {},
    resize() {},
    dispose() {},
  };
  if (!canvas || typeof window === "undefined" || signal?.aborted) return idleController;

  let renderer;
  let environmentTarget;
  let scene;
  let disposed = false;
  let frame = 0;
  let contextLost = false;
  let requestedActive = true;
  let inView = true;
  let observer;
  let resizeObserver;
  let releaseListeners = () => {};
  let releasePending;
  const cancelled = new Promise((resolve) => { releasePending = resolve; });
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    releasePending(null);
    signal?.removeEventListener?.("abort", abort);
    cancelAnimationFrame(frame);
    observer?.disconnect();
    resizeObserver?.disconnect();
    releaseListeners();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    environmentTarget?.dispose();
    scene?.clear();
    // A later renderer can reuse this canvas' context. Restore unpack defaults
    // before Three initializes its empty 3D textures on the next setup.
    renderer?.resetState?.();
    renderer?.dispose();
  };
  const abort = () => cleanup();
  signal?.addEventListener?.("abort", abort, { once: true });

  try {
    const THREE = await Promise.race([import("three"), cancelled]);
    if (disposed || !THREE) return idleController;
    const ownGeometry = (geometry) => {
      geometries.add(geometry);
      return geometry;
    };
    const ownMaterial = (material) => {
      materials.add(material);
      return material;
    };
    const clamp = THREE.MathUtils.clamp;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isReduced = reducedMotion.matches;
    let progress = 0;
    let targetProgress = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let lastTime = 0;
    let elapsed = 0;
    let ready = false;
    let warmupFrames = 3;

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    renderer.setClearColor(0x111827, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    // Transmission uses render targets too, so honor the strictest GPU limit.
    let maxDimension = renderer.capabilities?.maxTextureSize || 4096;
    try {
      const gl = renderer.getContext();
      const limits = [maxDimension, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS)]
        .filter((value) => Number.isFinite(value) && value > 0);
      maxDimension = Math.min(...limits);
    } catch { /* The renderer capability remains a conservative fallback. */ }

    scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(GLASS_VIEW.fov, GLASS_VIEW.aspect, 0.1, 70);
    camera.position.set(0, 0.08, GLASS_VIEW.distance);
    camera.lookAt(0, 0.08, 0);

    // Large luminous cards produce broad, photographic reflections. These
    // exist only in the environment bake, never as rectangles in the image.
    const studio = new THREE.Scene();
    studio.background = new THREE.Color("#040916");
    const lightCard = (color, strength, position, scale, rotation) => {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(strength),
        side: THREE.DoubleSide,
      });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      card.position.set(...position);
      card.scale.set(...scale);
      card.rotation.set(...rotation);
      studio.add(card);
    };
    lightCard("#BEF4FF", 12, [-4.5, 0.3, 4], [2.05, 8, 1], [0, 0.7, 0]);
    lightCard("#E9C5FF", 8, [4.7, 1.1, 2.5], [1.25, 8, 1], [0, -0.9, 0]);
    lightCard("#ECE6FF", 5, [0, 6, 1], [7, 1.7, 1], [Math.PI / 2, 0, 0]);
    lightCard("#F1F5F9", 6, [-1.2, 2.8, 6], [1.05, 5, 1], [0, 0, -0.45]);
    lightCard("#315DBD", 1.5, [0, -1, -5], [8, 7, 1], [0, 0, 0]);
    const pmrem = new THREE.PMREMGenerator(renderer);
    try {
      const size = Math.min(GLASS_QUALITY.environmentSize, 2 ** Math.floor(Math.log2(maxDimension / 3)));
      environmentTarget = pmrem.fromScene(studio, 0.035, 0.1, 100, { size });
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.85;
    } finally {
      studio.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      studio.clear();
      pmrem.dispose();
    }

    const sculpture = new THREE.Group();
    scene.add(sculpture);

    // Angular cuts and the slant are part of the contour, so the silhouette
    // remains recognisable when the camera turns and on narrow screens.
    const contour = [
      [-1.55, 2.2],
      [1.5, 2.2],
      [1.5, 1.34],
      [-0.64, 1.34],
      [-0.64, 0.48],
      [1.04, 0.48],
      [1.48, 0.04],
      [1.48, -1.75],
      [1.03, -2.2],
      [-1.55, -2.2],
      [-1.55, -1.31],
      [0.56, -1.31],
      [0.56, -0.43],
      [-1.55, -0.43],
    ].map(([x, y]) => new THREE.Vector2(x + y * 0.24, y));
    const shape = new THREE.Shape(contour);
    const depth = 0.65;
    const geometry = ownGeometry(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        steps: 1,
        bevelEnabled: true,
        bevelThickness: 0.105,
        bevelSize: 0.085,
        bevelSegments: 6,
        curveSegments: 1,
      }),
    );
    geometry.translate(0, 0, -depth / 2);
    geometry.computeBoundingBox();

    // A minute etched grain breaks the perfectly smooth computer-rendered
    // highlight without introducing visible noise or external textures.
    const textureSize = 128;
    const grain = new Uint8Array(textureSize * textureSize);
    let seed = 125;
    for (let i = 0; i < grain.length; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      grain[i] = 116 + (seed >>> 27);
    }
    const grainTexture = new THREE.DataTexture(
      grain,
      textureSize,
      textureSize,
      THREE.RedFormat,
    );
    grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
    grainTexture.repeat.set(1.9, 1.9);
    grainTexture.magFilter = THREE.LinearFilter;
    grainTexture.minFilter = THREE.LinearFilter;
    grainTexture.needsUpdate = true;
    textures.add(grainTexture);

    // A locally generated normal texture puts small, irregular crystalline
    // planes into the reflection. This is surface geometry shading, not a
    // painted wireframe, and its highlights move correctly with the camera.
    const normalCanvas = document.createElement("canvas");
    normalCanvas.width = normalCanvas.height = 512;
    const normalContext = normalCanvas.getContext("2d");
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const columns = 11;
    const rows = 15;
    const grid = Array.from({ length: rows + 1 }, (_, y) =>
      Array.from({ length: columns + 1 }, (_, x) => [
        ((x + (x > 0 && x < columns ? (random() - 0.5) * 0.8 : 0)) / columns) *
          512,
        ((y + (y > 0 && y < rows ? (random() - 0.5) * 0.8 : 0)) / rows) * 512,
      ]),
    );
    if (normalContext) {
      normalContext.fillStyle = "rgb(128,128,255)";
      normalContext.fillRect(0, 0, 512, 512);
      const facet = (vertices) => {
        const nx = Math.round(128 + (random() - 0.5) * 57);
        const ny = Math.round(128 + (random() - 0.5) * 57);
        normalContext.fillStyle = `rgb(${nx},${ny},253)`;
        normalContext.beginPath();
        normalContext.moveTo(...vertices[0]);
        normalContext.lineTo(...vertices[1]);
        normalContext.lineTo(...vertices[2]);
        normalContext.closePath();
        normalContext.fill();
      };
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          facet([grid[y][x], grid[y + 1][x], grid[y][x + 1]]);
          facet([grid[y + 1][x], grid[y + 1][x + 1], grid[y][x + 1]]);
        }
      }
    }
    const facetNormals = new THREE.CanvasTexture(normalCanvas);
    facetNormals.wrapS = facetNormals.wrapT = THREE.ClampToEdgeWrapping;
    facetNormals.repeat.set(0.22, 0.215);
    facetNormals.offset.set(0.49, 0.49);
    textures.add(facetNormals);

    // Transmission cannot sample a CSS background. A recessed core, confined
    // to the silhouette, supplies the same local atmosphere for real optical
    // refraction. No plane or rectangular background is rendered outside it.
    let atmosphere;
    try {
      const loading = new THREE.TextureLoader().loadAsync("/assets/home-motion/atmosphere.webp").then((texture) => {
        if (disposed) { texture.dispose(); return null; }
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.add(texture);
        return texture;
      });
      atmosphere = await Promise.race([loading, cancelled]);
    } catch {
      // Missing optional artwork still leaves the physical sculpture intact.
    }
    if (disposed) return idleController;
    if (atmosphere) {
      const coreGeometry = ownGeometry(new THREE.ShapeGeometry(shape));
      coreGeometry.translate(0, 0, -0.24);
      const coreMaterial = ownMaterial(
        new THREE.ShaderMaterial({
          uniforms: { atmosphere: { value: atmosphere } },
          vertexShader: `
          varying vec2 vGlassPosition;
          void main() {
            vGlassPosition = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
          fragmentShader: `
          uniform sampler2D atmosphere;
          varying vec2 vGlassPosition;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            vec2 p = vGlassPosition;
            vec2 cell = floor(p * 4.7);
            float fracture = hash(cell);
            vec2 drift = vec2(sin(p.y * 2.7 + p.x), cos(p.x * 2.4 - p.y)) * 0.032;
            vec2 uv = vec2(0.48 + p.x * 0.17, 0.31 + p.y * 0.075) + drift;
            vec3 cloud = texture2D(atmosphere, uv).rgb;
            vec3 depthTint = mix(vec3(0.022, 0.031, 0.095), vec3(0.06, 0.025, 0.125), smoothstep(-2.0, 2.0, p.x));
            // Broad pale caustics belong to the interior optical layer. The
            // physical shell refracts them as the pose changes. Keep the
            // atmosphere subdued so its clouds cannot camouflage the 5.
            float paleRibbon = exp(-pow((p.x + p.y * 0.16 + 0.95) / 0.62, 2.0));
            float lavenderRibbon = exp(-pow((p.x - p.y * 0.26 - 0.25) / 0.31, 2.0));
            vec3 glass = cloud * vec3(0.35, 0.39, 0.65) * (0.24 + fracture * 0.12) + depthTint;
            glass += vec3(0.27, 0.44, 0.58) * paleRibbon;
            glass += vec3(0.23, 0.19, 0.38) * lavenderRibbon;
            gl_FragColor = vec4(glass, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
          side: THREE.DoubleSide,
        }),
      );
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      core.scale.set(0.965, 0.977, 1);
      sculpture.add(core);
    }

    const frontMaterial = ownMaterial(
      new THREE.MeshPhysicalMaterial({
        color: "#B1A0EB",
        metalness: 0.025,
        roughness: 0.075,
        transmission: 0.94,
        thickness: 0.72,
        ior: 1.47,
        dispersion: 0.28,
        attenuationColor: new THREE.Color("#8877DD"),
        attenuationDistance: 3.2,
        clearcoat: 1,
        clearcoatRoughness: 0.065,
        envMapIntensity: 1.35,
        normalMap: facetNormals,
        normalScale: new THREE.Vector2(0.25, 0.25),
        bumpMap: grainTexture,
        bumpScale: 0.013,
      }),
    );
    const sideMaterial = ownMaterial(
      new THREE.MeshPhysicalMaterial({
        color: "#B9ACF2",
        metalness: 0.12,
        roughness: 0.055,
        transmission: 0.78,
        thickness: 1.2,
        ior: 1.47,
        dispersion: 0.22,
        attenuationColor: new THREE.Color("#9270DD"),
        attenuationDistance: 1.6,
        clearcoat: 1,
        clearcoatRoughness: 0.035,
        envMapIntensity: 2.05,
      }),
    );
    sculpture.add(new THREE.Mesh(geometry, [frontMaterial, sideMaterial]));

    // Sparse crystalline planes are contained within the extrusion. The
    // facets catch light through the glass, without a wireframe on its face.
    const facets = [
      [
        [-0.98, 1.63],
        [0.81, 1.7],
        [0.31, 2.06],
      ],
      [
        [-1.12, 0.02],
        [-0.75, 0.39],
        [-0.93, 1.01],
      ],
      [
        [-1.03, -1.65],
        [0.26, -1.8],
        [0.44, -2.08],
      ],
      [
        [0.83, -0.65],
        [1.1, -0.04],
        [1.21, -1.47],
      ],
      [
        [-0.4, -0.18],
        [0.83, -0.12],
        [0.43, 0.33],
      ],
    ];
    const facetMaterial = ownMaterial(
      new THREE.MeshPhysicalMaterial({
        color: "#9F8FEF",
        metalness: 0.48,
        roughness: 0.19,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    for (const points of facets) {
      const positions = points.flatMap(([x, y], index) => [
        x + y * 0.24,
        y,
        -0.09 + index * 0.018,
      ]);
      const facetGeometry = ownGeometry(new THREE.BufferGeometry());
      facetGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      facetGeometry.computeVertexNormals();
      sculpture.add(new THREE.Mesh(facetGeometry, facetMaterial));
    }

    // The rim is a physical, thin polished edge. Colour changes along its
    // contour: cyan on the left, pale violet through the centre, pink right.
    const edgeGeometry = ownGeometry(new THREE.EdgesGeometry(geometry, 36));
    const edgePositions = edgeGeometry.getAttribute("position");
    const edgeColors = [];
    const cyan = new THREE.Color("#B9F4FF");
    const lavender = new THREE.Color("#EEE8FF");
    const pink = new THREE.Color("#F6D8FF");
    for (let index = 0; index < edgePositions.count; index += 1) {
      const x = edgePositions.getX(index);
      const t = clamp((x + 2.1) / 4.2, 0, 1);
      const color =
        t < 0.5
          ? cyan.clone().lerp(lavender, t * 2)
          : lavender.clone().lerp(pink, (t - 0.5) * 2);
      edgeColors.push(color.r, color.g, color.b);
    }
    edgeGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(edgeColors, 3),
    );
    const edgeMaterial = ownMaterial(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sculpture.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    // Only three selected edges carry a brighter highlight; the whole object
    // must read as glass rather than as an illuminated outline.
    const addHighlight = (start, end, color) => {
      const startPoint = contour[start];
      const endPoint = contour[end];
      const line = new THREE.LineCurve3(
        new THREE.Vector3(startPoint.x, startPoint.y, depth / 2 + 0.14),
        new THREE.Vector3(endPoint.x, endPoint.y, depth / 2 + 0.14),
      );
      const highlightGeometry = ownGeometry(
        new THREE.TubeGeometry(line, 1, 0.01, 5, false),
      );
      const highlightMaterial = ownMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          toneMapped: false,
        }),
      );
      sculpture.add(new THREE.Mesh(highlightGeometry, highlightMaterial));
      const glowGeometry = ownGeometry(
        new THREE.TubeGeometry(line, 1, 0.035, 5, false),
      );
      const glowMaterial = ownMaterial(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      sculpture.add(new THREE.Mesh(glowGeometry, glowMaterial));
    };
    addHighlight(0, 1, "#B8F6FF");
    addHighlight(0, 13, "#67E8F9");
    addHighlight(6, 7, "#E879F9");

    const key = new THREE.DirectionalLight("#D6F7FF", 0.85);
    key.position.set(-4, 4.5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#E879F9", 1.1);
    rim.position.set(4, 0.5, 2);
    scene.add(rim);
    const fill = new THREE.DirectionalLight("#818CF8", 0.4);
    fill.position.set(0, -3, 5);
    scene.add(fill);

    const canRender = () =>
      !disposed &&
      !contextLost &&
      requestedActive &&
      inView &&
      !document.hidden;
    const applyPose = () => {
      const pose = getGlassPose({ elapsed, progress, pointerX, pointerY, reduced: isReduced });
      sculpture.rotation.set(...pose.rotation);
      sculpture.position.set(...pose.position);
    };
    const schedule = () => {
      if (canRender() && !frame) frame = requestAnimationFrame(render);
    };
    const render = (time) => {
      frame = 0;
      if (!canRender()) return;
      const delta = Math.min((time - (lastTime || time - 16)) / 1000, 0.08);
      lastTime = time;
      const damping = glassDamping(delta);
      if (!isReduced) elapsed += delta * 1000;
      const desiredProgress = isReduced ? 0 : targetProgress;
      const desiredX = isReduced ? 0 : targetX;
      const desiredY = isReduced ? 0 : targetY;
      progress += (desiredProgress - progress) * damping;
      pointerX += (desiredX - pointerX) * damping;
      pointerY += (desiredY - pointerY) * damping;
      applyPose();
      try {
        renderer.render(scene, camera);
        if (warmupFrames > 0) {
          warmupFrames -= 1;
          schedule();
          return;
        }
        if (!ready) {
          ready = true;
          onReady?.();
        }
      } catch (error) {
        contextLost = true;
        onError?.(error);
        return;
      }
      if (
        !isReduced || Math.abs(desiredProgress - progress) +
          Math.abs(desiredX - pointerX) +
          Math.abs(desiredY - pointerY) >
        0.0003
      ) {
        schedule();
      }
    };
    const resize = () => {
      if (disposed) return;
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const framing = glassCameraFraming(width / height);
      camera.aspect = framing.aspect;
      camera.fov = framing.fov;
      camera.position.z = framing.distance;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(glassPixelRatio({ width, height, devicePixelRatio: window.devicePixelRatio || 1, maxDimension }));
      renderer.setSize(width, height, false);
      schedule();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    };
    const visibilityChanged = () => {
      if (document.hidden) stop();
      else schedule();
    };
    const motionChanged = () => {
      isReduced = reducedMotion.matches;
      if (isReduced) {
        progress = pointerX = pointerY = elapsed = 0;
        stop();
      }
      schedule();
    };
    const lost = (event) => {
      event.preventDefault();
      contextLost = true;
      stop();
      onError?.(new Error("WebGL context lost"));
    };
    const restored = () => {
      contextLost = false;
      ready = false;
      warmupFrames = 3;
      resize();
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    reducedMotion.addEventListener("change", motionChanged);
    canvas.addEventListener("webglcontextlost", lost, false);
    canvas.addEventListener("webglcontextrestored", restored, false);
    window.addEventListener("resize", resize, { passive: true });
    releaseListeners = () => {
      document.removeEventListener("visibilitychange", visibilityChanged);
      reducedMotion.removeEventListener("change", motionChanged);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      window.removeEventListener("resize", resize);
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
          if (inView) schedule();
          else stop();
        },
        { rootMargin: "100px" },
      );
      observer.observe(canvas);
    }
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }
    applyPose();
    resize();

    return {
      setProgress(value) {
        if (!Number.isFinite(value)) return;
        targetProgress = clamp(value, 0, 1);
        schedule();
      },
      setPointer(x, y) {
        targetX = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
        targetY = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
        schedule();
      },
      setActive(value) {
        requestedActive = Boolean(value);
        if (requestedActive) schedule();
        else stop();
      },
      resize,
      dispose: cleanup,
    };
  } catch (error) {
    cleanup();
    if (!signal?.aborted) onError?.(error);
    return idleController;
  }
}
