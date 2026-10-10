import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("../i18n/translate.js");
  vi.unstubAllGlobals();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe("language preference", () => {
  it("waits for explicit restoration after the French initial render and survives unavailable storage", async () => {
    vi.resetModules();
    const storage = { getItem: vi.fn(() => "es"), setItem: vi.fn() };
    vi.stubGlobal("window", { localStorage: storage });
    const locale = await import("../i18n/locale.js");
    expect(locale.getLanguage()).toBe("fr");
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(await locale.restoreLanguage()).toBe("es");
    expect(locale.getLocale()).toBe("es-ES");
    expect(locale.getRiotLocale()).toBe("es_ES");
    storage.setItem.mockImplementation(() => { throw new Error("Storage blocked"); });
    expect(await locale.setLanguage("en")).toBe("en");
    expect(locale.getLocale()).toBe("en-GB");
    expect(locale.getRiotLocale()).toBe("en_US");
    expect(await locale.setLanguage("<script>unsupported</script>")).toBe("fr");
  });

  it("notifies once per change, persists a supported language and synchronises other tabs", async () => {
    vi.resetModules();
    const events = new Map();
    const setItem = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem }, addEventListener: (name, callback) => events.set(name, callback), removeEventListener });
    const locale = await import("../i18n/locale.js");
    const listener = vi.fn();
    const unsubscribe = locale.subscribeLanguage(listener);
    await locale.setLanguage("en");
    await locale.setLanguage("en");
    expect(listener).toHaveBeenCalledOnce();
    expect(setItem).toHaveBeenCalledWith("nxt5:language:v1", "en");
    events.get("storage")({ key: "nxt5:language:v1", newValue: "es" });
    await vi.waitFor(() => expect(locale.getLanguage()).toBe("es"));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith("storage", events.get("storage"));
  });

  it("uses the French server snapshot without reading browser preferences", async () => {
    vi.resetModules();
    const React = (await import("react")).default;
    const { renderToString } = await import("react-dom/server");
    const { useLanguage } = await import("../i18n/useLanguage.js");
    const { setLanguage } = await import("../i18n/locale.js");
    await setLanguage("en");
    function Language() { return <span>{useLanguage()}</span>; }
    expect(renderToString(<Language />)).toBe("<span>fr</span>");
  });

  it("loads catalogues only when selected and never commits an obsolete selection", async () => {
    vi.resetModules();
    const english = deferred();
    const spanish = deferred();
    const loadLanguageMessages = vi.fn((language) => language === "en" ? english.promise : spanish.promise);
    vi.doMock("../i18n/translate.js", () => ({ hasLanguageMessages: (language) => language === "fr", loadLanguageMessages }));
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    const locale = await import("../i18n/locale.js");
    const listener = vi.fn();
    const unsubscribe = locale.subscribeLanguage(listener);
    expect(loadLanguageMessages).not.toHaveBeenCalled();

    const first = locale.setLanguage("en");
    const latest = locale.setLanguage("es");
    expect(locale.getLanguage()).toBe("fr");
    expect(setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(loadLanguageMessages.mock.calls).toEqual([["en"], ["es"]]);

    spanish.resolve();
    expect(await latest).toBe("es");
    english.resolve();
    expect(await first).toBe("es");
    expect(locale.getLanguage()).toBe("es");
    expect(listener).toHaveBeenCalledOnce();
    expect(setItem.mock.calls).toEqual([[locale.LANGUAGE_STORAGE_KEY, "es"]]);
    unsubscribe();
  });

  it("cancels an outstanding catalogue selection when French is chosen", async () => {
    vi.resetModules();
    const english = deferred();
    vi.doMock("../i18n/translate.js", () => ({ hasLanguageMessages: (language) => language === "fr", loadLanguageMessages: () => english.promise }));
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    const locale = await import("../i18n/locale.js");
    const pending = locale.setLanguage("en");
    expect(await locale.setLanguage("fr")).toBe("fr");
    english.resolve();
    expect(await pending).toBe("fr");
    expect(locale.getLanguage()).toBe("fr");
    expect(setItem.mock.calls).toEqual([[locale.LANGUAGE_STORAGE_KEY, "fr"]]);
  });

  it("preserves the current language and preference when loading fails, then permits retry", async () => {
    vi.resetModules();
    const loadLanguageMessages = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(undefined);
    vi.doMock("../i18n/translate.js", () => ({ hasLanguageMessages: (language) => language === "fr", loadLanguageMessages }));
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });
    const locale = await import("../i18n/locale.js");
    const listener = vi.fn();
    const unsubscribe = locale.subscribeLanguage(listener);
    await expect(locale.setLanguage("en")).rejects.toThrow("Offline");
    expect(locale.getLanguage()).toBe("fr");
    expect(setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();

    expect(await locale.setLanguage("en")).toBe("en");
    expect(loadLanguageMessages).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledOnce();
    expect(setItem.mock.calls).toEqual([[locale.LANGUAGE_STORAGE_KEY, "en"]]);
    unsubscribe();
  });
});
