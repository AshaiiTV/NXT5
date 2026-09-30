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
