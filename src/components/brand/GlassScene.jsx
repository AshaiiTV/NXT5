import React, { useEffect, useRef, useState } from "react";
import { subscribeGlassPointer } from "./glass-pointer.js";
import { afterLoadAndIdle, engineConstrained, subscribeEngineConstraints } from "./glass-engine-gate.js";
import "./glass-scene.css";

let engineModule;
const loadEngine = () => engineModule ??= import("../../pages/home/glass-scene.js").catch(error => {
  engineModule = undefined;
  throw error;
});

// Start a scene shortly before it scrolls into view so its first frame is ready on arrival.
const NEAR_VIEWPORT = "200px 0px";

/**
 * One sculpture and motion system for every NXT5 scene, at every viewport size.
 * The poster is painted first (LCP); three.js only loads after `load` and idle time,
 * near the viewport, and never with reduced motion, data saving, a slow network or little memory.
 */
export default function GlassScene({ className = "", posterClassName = "", canvasClassName = "", motionEnabled = true, priority = false }) {
  const sceneRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = sceneRef.current;
    const canvas = canvasRef.current;
    if (!element || !canvas || typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let failed = false;
    let visible = typeof IntersectionObserver === "undefined";
    let controller = null;
    let attempt = null;
    let currentRequest = null;
    let pointer = [0, 0];
    setReady(false);

    const savedLow = () => {
      try { return window.localStorage?.getItem("nxt5-performance-mode") === "low"; }
      catch { return false; }
    };
    let performanceLow = savedLow();
    const permitted = () => !disposed && !failed && motionEnabled && !reduced.matches &&
      !performanceLow && !document.documentElement.classList.contains("nxt5-low-gpu");
    const active = () => permitted() && visible && !document.hidden;
    const cancelAttempt = () => attempt?.abort.abort();

    const update = () => {
      if (disposed) return;
      performanceLow = savedLow();
      if (!permitted()) {
        currentRequest?.abort.abort();
        controller?.dispose();
        controller = null;
        setReady(false);
        return;
      }
      if (!active()) {
        cancelAttempt();
        pointer = [0, 0];
        controller?.setPointer(0, 0);
        controller?.setActive(false);
        return;
      }
      if (controller) {
        controller.setActive(true);
        return;
      }
      if (attempt) return;
      // Constrained devices keep the poster alone; a running scene is not torn down.
      if (engineConstrained()) return;

      // Complete cancellation before letting another setup own this canvas.
      const request = { abort: new AbortController() };
      attempt = request;
      currentRequest = request;
      const isCurrent = () => !request.abort.signal.aborted && active();
      const fallback = () => {
        // A context loss also needs a visible fallback when reported offscreen.
        if (disposed || currentRequest !== request || request.abort.signal.aborted) return;
        failed = true;
        request.abort.abort();
        setReady(false);
        controller?.dispose();
        controller = null;
      };

      afterLoadAndIdle(request.abort.signal)
        .then(() => (isCurrent() ? loadEngine() : null))
        .then(async engine => {
          if (!engine || !isCurrent()) return;
          const { createGlassScene } = engine;
          const scene = await createGlassScene({
            canvas,
            signal: request.abort.signal,
            onReady: () => { if (isCurrent()) setReady(true); },
            onError: fallback,
          });
          if (!isCurrent()) {
            scene.dispose();
            return;
          }
          controller = scene;
          if (pointer[0] || pointer[1]) controller.setPointer(...pointer);
          controller.setActive(true);
        })
        .catch(fallback)
        .finally(() => {
          attempt = null;
          if (!disposed) update();
        });
    };

    const unsubscribePointer = subscribeGlassPointer((x, y) => {
      if (active()) {
        pointer = [x, y];
        controller?.setPointer(x, y);
      }
    });
    const preferences = new MutationObserver(update);
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const unsubscribeConstraints = subscribeEngineConstraints(update);
    const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, { rootMargin: NEAR_VIEWPORT });
    intersection?.observe(element);
    reduced.addEventListener("change", update);
    window.addEventListener("storage", update);
    document.addEventListener("visibilitychange", update);
    update();

    return () => {
      disposed = true;
      currentRequest?.abort.abort();
      unsubscribePointer();
      unsubscribeConstraints();
      preferences.disconnect();
      intersection?.disconnect();
      reduced.removeEventListener("change", update);
      window.removeEventListener("storage", update);
      document.removeEventListener("visibilitychange", update);
      controller?.dispose();
    };
  }, [motionEnabled]);

  return (
    <div ref={sceneRef} className={`nxt5-glass-scene ${className}${ready ? " is-ready" : ""}`} aria-hidden="true">
      <img className={`nxt5-glass-poster ${posterClassName}`} src="/assets/brand/prisme/classic-poster.webp"
        srcSet="/assets/brand/prisme/classic-poster.webp 729w, /assets/brand/prisme/classic-poster@2x.webp 1458w, /assets/brand/prisme/classic-poster@3x.webp 2187w"
        sizes="(max-width: 760px) 90vw, (max-width: 1600px) 50vw, 900px"
        width="729" height="665" alt="" decoding="async" draggable="false"
        fetchPriority={priority ? "high" : undefined} loading={priority ? "eager" : undefined} />
      <canvas ref={canvasRef} className={`nxt5-glass-canvas ${canvasClassName}`} width="729" height="665" />
    </div>
  );
}
