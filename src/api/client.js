export const API_BASE = "/.netlify/functions";
const DEFAULT_API_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 120000;

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
  if (payload?.code === "SESSION_SECRET_MISCONFIGURED") return "La connexion est temporairement indisponible. Réessaie dans quelques instants.";
  return payload?.error || apiFallbackMessage(status);
}

function apiFallbackMessage(status) {
  return status === 502 || status === 503
    ? "Service temporairement indisponible. Reessaie quand le site est pret."
    : `Erreur ${status}.`;
}

function invalidApiResponse(status) {
  return attachApiErrorMetadata(new Error("NXT5 a reçu une réponse inattendue. Recharge la page puis réessaie."), { code: "INVALID_API_RESPONSE" }, status);
}

function validPayload(payload) {
  return payload !== null && typeof payload === "object";
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, signal, headers: customHeaders, ...fetchOptions } = options;
  const headers = new Headers(customHeaders);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
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
    const response = await fetch(url, {
      credentials: "include",
      ...fetchOptions,
      headers,
      signal: controller?.signal || signal,
    });
    if (response.status === 204) return null;
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller?.signal.aborted || signal?.aborted || error?.name === "AbortError") throw error;
      if (response.ok) throw invalidApiResponse(response.status);
    }
    if (!response.ok) {
      throw attachApiErrorMetadata(new Error(apiPayloadMessage(payload, response.status)), payload, response.status);
    }
    if (!validPayload(payload)) throw invalidApiResponse(response.status);
    return payload;
  } catch (err) {
    if (signal?.aborted) throw signal.reason || new DOMException("Request cancelled", "AbortError");
    if (err?.status !== undefined) throw err;
    const timedOut = controller?.signal?.aborted || err?.name === "TimeoutError";
    throw Object.assign(new Error(timedOut ? "NXT5 met trop longtemps à répondre. Réessaie dans quelques instants." : "Impossible de joindre NXT5 pour le moment. Réessaie dans quelques instants."), { code: timedOut ? "API_TIMEOUT" : "NETWORK_ERROR" });
  } finally {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    if (controller && signal) signal.removeEventListener("abort", abortFromCaller);
  }

}

export function apiUploadJson(path, data, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${path}`);
    xhr.withCredentials = true;
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress?.({ phase: "upload", percent, loaded: event.loaded, total: event.total });
    };
    xhr.upload.onload = () => onProgress?.({ phase: "server", percent: 100 });
    xhr.onerror = () => reject(new Error("Impossible de joindre NXT5 pour le moment. Reessaie dans quelques instants."));
    xhr.ontimeout = () => reject(Object.assign(new Error("L’import met trop longtemps à répondre. Vérifie la liste des games avant de réessayer."), { code: "API_TIMEOUT" }));
    xhr.onabort = () => reject(new DOMException("Import annulé.", "AbortError"));
    xhr.onload = () => {
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
      if (xhr.status !== 204 && !validPayload(payload)) {
        reject(invalidApiResponse(xhr.status));
        return;
      }
      resolve(payload);
    };

    onProgress?.({ phase: "upload", percent: 0, loaded: 0, total: 0 });
    xhr.send(JSON.stringify(data));
  });
}
