export const API_BASE = "/.netlify/functions";
const DEFAULT_API_TIMEOUT_MS = 20000;

function attachApiErrorMetadata(error, payload, status) {
  error.status = status;
  error.code = payload?.code || null;
  error.retryAfter = payload?.retryAfter || null;
  error.riotStatus = payload?.riotStatus || null;
  error.missing = payload?.missing || null;
  error.details = payload?.details || null;
  return error;
}

function apiFallbackMessage(status) {
  return status === 502 || status === 503
    ? "Service temporairement indisponible. Reessaie quand le site est pret."
    : `Erreur ${status}.`;
}

export async function apiFetch(path, options = {}) {
  let response;
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, signal, ...fetchOptions } = options;
  const controller = timeoutMs ? new AbortController() : null;
  let timeoutId = null;
  const abortFromCaller = () => controller?.abort(signal?.reason);
  if (controller && signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", abortFromCaller, { once: true });
  }
  if (controller && timeoutMs) {
    timeoutId = globalThis.setTimeout(() => controller.abort(new DOMException("API timeout", "TimeoutError")), timeoutMs);
  }
  try {
    const url = String(path || "").startsWith("/") ? path : `${API_BASE}/${path}`;
    response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      },
      ...fetchOptions,
      signal: controller?.signal || signal,
    });
  } catch (err) {
    const timedOut = err?.name === "AbortError" || err?.name === "TimeoutError" || controller?.signal?.aborted;
    throw new Error(timedOut ? "NXT5 met trop longtemps à répondre. Réessaie dans quelques instants." : "Impossible de joindre NXT5 pour le moment. Reessaie dans quelques instants.");
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    if (controller && signal) signal.removeEventListener("abort", abortFromCaller);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw attachApiErrorMetadata(new Error(payload?.error || apiFallbackMessage(response.status)), payload, response.status);
  }

  return payload;
}

export function apiUploadJson(path, data, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress?.({ phase: "upload", percent, loaded: event.loaded, total: event.total });
    };
    xhr.upload.onload = () => onProgress?.({ phase: "server", percent: 100 });
    xhr.onerror = () => reject(new Error("Impossible de joindre NXT5 pour le moment. Reessaie dans quelques instants."));
    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(attachApiErrorMetadata(new Error(payload?.error || apiFallbackMessage(xhr.status)), payload, xhr.status));
        return;
      }
      resolve(payload);
    };

    onProgress?.({ phase: "upload", percent: 0, loaded: 0, total: 0 });
    xhr.send(JSON.stringify(data));
  });
}
