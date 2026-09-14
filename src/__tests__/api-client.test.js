import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUploadJson } from "../api/client.js";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("API response handling", () => {
  it.each(["<html>SPA fallback</html>", "", "null", '"not an object"'])("rejects an invalid successful response: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(apiFetch("bootstrap")).rejects.toMatchObject({ code: "INVALID_API_RESPONSE", status: 200 });
  });

  it("merges Headers instances without dropping the JSON content type", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await expect(apiFetch("test", { headers: new Headers({ "X-Test": "value" }) })).resolves.toEqual({ ok: true });
    const headers = fetch.mock.calls[0][1].headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-test")).toBe("value");
  });

  it("retains an explicitly supplied content type", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await apiFetch("test", { headers: { "Content-Type": "application/custom+json" } });
    expect(fetch.mock.calls[0][1].headers.get("content-type")).toBe("application/custom+json");
  });

  it("preserves server error metadata and handles an empty success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ error: "Wait", code: "RATE_LIMIT", retryAfter: 12 }, { status: 429 })).mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(apiFetch("test")).rejects.toMatchObject({ status: 429, code: "RATE_LIMIT", retryAfter: 12 });
    await expect(apiFetch("test")).resolves.toBeNull();
  });

  it("reports HTML gateway failures as HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Unavailable</html>", { status: 503 })));
    await expect(apiFetch("test")).rejects.toMatchObject({ status: 503 });
  });

  it("keeps the timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_, { signal }) => ({
      ok: true, status: 200,
      json: () => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
    })));
    const result = expect(apiFetch("test", { timeoutMs: 50 })).rejects.toMatchObject({ code: "API_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(50);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not report intentional cancellation as a timeout", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)))));
    const result = expect(apiFetch("test", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
  });
});

describe("bounded uploads", () => {
  function upload() {
    let xhr;
    vi.stubGlobal("XMLHttpRequest", class {
      upload = {};
      constructor() { xhr = this; }
      open() {}
      setRequestHeader() {}
      send() {}
    });
    const result = apiUploadJson("matches-import-file", {});
    return { xhr, result };
  }

  it("settles timed-out uploads instead of leaving progress pending", async () => {
    const { xhr, result } = upload();
    expect(xhr.timeout).toBe(120000);
    const rejected = expect(result).rejects.toMatchObject({ code: "API_TIMEOUT" });
    xhr.ontimeout();
    await rejected;
  });

  it("rejects invalid upload responses", async () => {
    const { xhr, result } = upload();
    xhr.status = 200;
    xhr.responseText = "<html>Not an API</html>";
    const rejected = expect(result).rejects.toMatchObject({ code: "INVALID_API_RESPONSE" });
    xhr.onload();
    await rejected;
  });

  it("settles cancelled uploads", async () => {
    const { xhr, result } = upload();
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    xhr.onabort();
    await rejected;
  });
});
