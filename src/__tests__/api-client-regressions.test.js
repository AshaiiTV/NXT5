import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUploadJson } from "../api/client.js";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("B11 request lifetime", () => {
  it.each(["timeout", "caller"])("keeps %s cancellation alive while reading JSON", async (cause) => {
    vi.useFakeTimers();
    const caller = new AbortController();
    let requestSignal;
    vi.stubGlobal("fetch", vi.fn(async (_url, { signal }) => {
      requestSignal = signal;
      return { ok: true, json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) };
    }));
    const pending = apiFetch("slow", { timeoutMs: 30, signal: caller.signal });
    const check = expect(pending).rejects.toThrow(/trop longtemps|annulée/);
    await Promise.resolve();
    await Promise.resolve();
    if (cause === "caller") caller.abort();
    else await vi.advanceTimersByTimeAsync(31);
    await check;
    expect(requestSignal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("B12 upload termination", () => {
  function xhrMock() {
    const xhr = { open: vi.fn(), setRequestHeader: vi.fn(), send: vi.fn(), upload: {}, abort: vi.fn(() => xhr.onabort()) };
    vi.stubGlobal("XMLHttpRequest", class { constructor() { return xhr; } });
    return xhr;
  }
  it("rejects a stalled upload after the configured timeout", async () => {
    const xhr = xhrMock();
    const pending = apiUploadJson("import", {}, vi.fn());
    expect(xhr.timeout).toBe(120000);
    xhr.ontimeout();
    await expect(pending).rejects.toThrow("délai maximal");
  });
  it("aborts an upload from a signal and cleans up its listener", async () => {
    const xhr = xhrMock();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const pending = apiUploadJson("import", {}, vi.fn(), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow("annulé");
    expect(xhr.abort).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
  it("does not send an already cancelled upload", async () => {
    const xhr = xhrMock();
    const controller = new AbortController(); controller.abort();
    await expect(apiUploadJson("import", {}, null, { signal: controller.signal })).rejects.toThrow("annulé");
    expect(xhr.send).not.toHaveBeenCalled();
  });
});

// Régression du commit 76dbb10 (branche feat/pricing-validation), pour la part
// que l’audit croisé n’avait pas reprise : réponse 2xx inexploitable et message
// de configuration serveur.
describe("unexpected API responses", () => {
  const html = () => new Response("<!doctype html><title>NXT5</title>", { status: 200, headers: { "Content-Type": "text/html" } });

  it.each([
    ["an HTML page", html],
    ["a JSON null", () => new Response("null", { status: 200 })],
    ["an empty body", () => new Response("", { status: 200 })],
  ])("rejects %s instead of returning null to the caller", async (_label, respond) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond()));
    await expect(apiFetch("bootstrap")).rejects.toMatchObject({ message: expect.stringContaining("réponse inattendue"), code: "INVALID_API_RESPONSE", status: 200 });
  });

  it("still accepts objects, arrays and 204 responses", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response("[]"))
      .mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(apiFetch("a")).resolves.toEqual({ ok: true });
    await expect(apiFetch("b")).resolves.toEqual([]);
    await expect(apiFetch("c")).resolves.toBeNull();
  });

  it("does not reveal the server session configuration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "SESSION_SECRET must be set", code: "SESSION_SECRET_MISCONFIGURED" }), { status: 500 })));
    const error = await apiFetch("auth-me").catch((err) => err);
    expect(error.message).toBe("La connexion est temporairement indisponible. Réessaie dans quelques instants.");
    expect(error.message).not.toMatch(/SESSION_SECRET|Netlify/);
    expect(error).toMatchObject({ status: 500, code: "SESSION_SECRET_MISCONFIGURED" });
  });

  it("rejects an upload answered by a non-JSON page", async () => {
    const xhr = { open: vi.fn(), setRequestHeader: vi.fn(), send: vi.fn(), upload: {} };
    vi.stubGlobal("XMLHttpRequest", class { constructor() { return xhr; } });
    const pending = apiUploadJson("import", {}, vi.fn());
    Object.assign(xhr, { status: 200, responseText: "<!doctype html>" });
    xhr.onload();
    await expect(pending).rejects.toMatchObject({ code: "INVALID_API_RESPONSE" });
  });
});
