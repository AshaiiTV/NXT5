import React, { useEffect, useRef, useState } from "react";
import "./glass-scene.css";

/** The shared glass sculpture, enhanced only when the device permits motion. */
export default function GlassScene({ className = "", pointerTargetRef, pointerStrength = 0.55, posterClassName = "", canvasClassName = "" }) {
  const sceneRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = sceneRef.current;
    const canvas = canvasRef.current;
    const pointerTarget = pointerTargetRef?.current || element;
    if (!element || !canvas || typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let failed = false;
    let controller = null;
    let attempt = null;
    setReady(false);

    const canEnhance = () =>
      !disposed &&
      !failed &&
      desktop.matches &&
      !reduced.matches &&
      !document.documentElement.classList.contains("nxt5-low-gpu");

    const update = () => {
      if (disposed) return;
      if (!canEnhance()) {
        if (attempt) attempt.cancelled = true;
        controller?.dispose();
        controller = null;
        setReady(false);
        return;
      }
      if (controller || attempt) return;

      // The shared engine loads its texture asynchronously. Keep one request
      // at a time so a viewport/preference change cannot reuse a live canvas.
      const request = { cancelled: false };
      attempt = request;
      const isCurrent = () => !request.cancelled && canEnhance();
      const fallback = () => {
        if (!isCurrent()) return;
        failed = true;
        setReady(false);
        controller?.dispose();
        controller = null;
      };

      import("../../pages/home/glass-scene.js")
        .then(async ({ createGlassScene }) => {
          if (!isCurrent()) return;
          const scene = await createGlassScene({
            canvas,
            onReady: () => {
              if (isCurrent()) setReady(true);
            },
            onError: fallback,
          });
          if (!isCurrent()) {
            scene.dispose();
            return;
          }
          controller = scene;
        })
        .catch(fallback)
        .finally(() => {
          attempt = null;
          // A new eligible state may have arrived while setup was pending.
          if (!disposed) update();
        });
    };

    const move = (event) => {
      if (!controller || event.pointerType === "touch") return;
      const bounds = pointerTarget.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      controller.setPointer(
        ((event.clientX - bounds.left) / bounds.width * 2 - 1) * pointerStrength,
        ((event.clientY - bounds.top) / bounds.height * 2 - 1) * pointerStrength,
      );
    };
    const leave = () => controller?.setPointer(0, 0);
    const preferences = new MutationObserver(update);
    preferences.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    desktop.addEventListener("change", update);
    reduced.addEventListener("change", update);
    pointerTarget.addEventListener("pointermove", move, { passive: true });
    pointerTarget.addEventListener("pointerleave", leave);
    pointerTarget.addEventListener("pointercancel", leave);
    update();

    return () => {
      disposed = true;
      if (attempt) attempt.cancelled = true;
      preferences.disconnect();
      desktop.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
      pointerTarget.removeEventListener("pointermove", move);
      pointerTarget.removeEventListener("pointerleave", leave);
      pointerTarget.removeEventListener("pointercancel", leave);
      controller?.dispose();
    };
  }, [pointerTargetRef, pointerStrength]);

  return (
    <div
      ref={sceneRef}
      className={`nxt5-glass-scene ${className}${ready ? " is-ready" : ""}`}
      aria-hidden="true"
    >
      <img
        className={`nxt5-glass-poster ${posterClassName}`}
        src="/assets/home-motion/glass-poster.webp"
        width="729"
        height="665"
        alt=""
        decoding="async"
        fetchPriority="high"
        draggable="false"
      />
      <canvas
        ref={canvasRef}
        className={`nxt5-glass-canvas ${canvasClassName}`}
        width="729"
        height="665"
      />
    </div>
  );
}
