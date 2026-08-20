export const PERFORMANCE_MODE_STORAGE_KEY = "nxt5-performance-mode";

function storedPerformanceMode() {
  try {
    const value = window.localStorage?.getItem(PERFORMANCE_MODE_STORAGE_KEY);
    return value === "low" || value === "full" ? value : "";
  } catch {
    return "";
  }
}

export function setStoredPerformanceMode(mode) {
  try {
    window.localStorage?.setItem(PERFORMANCE_MODE_STORAGE_KEY, mode);
  } catch {}
}

function detectSoftwareRenderer() {
  if (typeof document === "undefined") return false;
  const override = storedPerformanceMode();
  if (override === "full") return false;
  if (override === "low") return true;

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) || canvas.getContext("experimental-webgl", { failIfMajorPerformanceCaveat: true });
  if (!gl) return true;

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "").toLowerCase() : "";
  return /swiftshader|software|llvmpipe|mesa|basic render|warp/.test(renderer);
}

export function configurePerformanceMode() {
  try {
    document.documentElement.classList.toggle("nxt5-low-gpu", detectSoftwareRenderer());
  } catch {
    document.documentElement.classList.add("nxt5-low-gpu");
  }
}

export function currentPerformanceMode() {
  const saved = storedPerformanceMode();
  if (saved) return saved;
  return detectSoftwareRenderer() ? "low" : "full";
}
