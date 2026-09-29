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

function apiPayloadMessage(payload, status) {
  if (payload?.code === "SESSION_SECRET_MISCONFIGURED") return "Session serveur mal configurée : SESSION_SECRET manque ou est trop court dans Netlify.";
  return payload?.error || apiFallbackMessage(status);
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
    try {
      const url = String(path || "").startsWith("/") ? path : `${API_BASE}/${path}`;
      response = await fetch(url, {
        credentials: "include",
        ...fetchOptions,
        headers: { "Content-Type": "application/json", ...(fetchOptions.headers || {}) },
        signal: controller?.signal || signal,
      });
    } catch (err) {
      const aborted = err?.name === "AbortError" || err?.name === "TimeoutError" || controller?.signal.aborted || signal?.aborted;
      throw new Error(aborted ? "NXT5 met trop longtemps à répondre ou la requête a été annulée. Réessaie dans quelques instants." : "Impossible de joindre NXT5 pour le moment. Reessaie dans quelques instants.");
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      if (err?.name === "AbortError" || err?.name === "TimeoutError" || controller?.signal.aborted || signal?.aborted) {
        throw new Error("NXT5 met trop longtemps à répondre ou la requête a été annulée. Réessaie dans quelques instants.");
      }
    }
    if (controller?.signal.aborted || signal?.aborted) throw new Error("NXT5 met trop longtemps à répondre ou la requête a été annulée. Réessaie dans quelques instants.");
    if (!response.ok) throw attachApiErrorMetadata(new Error(apiPayloadMessage(payload, response.status)), payload, response.status);
    return payload;
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    if (controller && signal) signal.removeEventListener("abort", abortFromCaller);
  }
}

export function apiUploadJson(path, data, onProgress, { signal, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${path}`);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const fail = (error) => { cleanup(); reject(error); };
    xhr.ontimeout = () => fail(new Error("L’envoi a dépassé le délai maximal. Réessaie dans quelques instants."));
    xhr.onabort = () => fail(new Error("L’envoi du fichier a été annulé."));
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress?.({ phase: "upload", percent, loaded: event.loaded, total: event.total });
    };
    xhr.upload.onload = () => onProgress?.({ phase: "server", percent: 100 });
    xhr.onerror = () => fail(new Error("Impossible de joindre NXT5 pour le moment. Reessaie dans quelques instants."));
    xhr.onload = () => {
      cleanup();
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(attachApiErrorMetadata(new Error(apiPayloadMessage(payload, xhr.status)), payload, xhr.status));
        return;
      }
      resolve(payload);
    };

    onProgress?.({ phase: "upload", percent: 0, loaded: 0, total: 0 });
    if (signal?.aborted) { fail(new Error("L’envoi du fichier a été annulé.")); return; }
    signal?.addEventListener("abort", abort, { once: true });
    try { xhr.send(JSON.stringify(data)); } catch (error) { fail(error); }
  });
}
