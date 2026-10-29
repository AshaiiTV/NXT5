import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionCountdown from "../components/home/SessionCountdown.jsx";
import { setLanguage } from "../i18n/locale.js";

const NOW = Date.parse("2026-10-13T16:00:00Z");
let renderer;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); setLanguage("fr", { persist: false }); });
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.useRealTimers(); vi.unstubAllGlobals(); setLanguage("fr", { persist: false });
});
function mount(props) { act(() => { renderer = TestRenderer.create(<SessionCountdown {...props} />); }); }
const content = () => renderer.root.findByProps({ role: "timer" }).children.join("").replace(/\s+/g, " ");

describe("precise next-session countdown", () => {
  it("shows total hours, minutes and seconds without rounding to a two-day window", () => {
    mount({ startsAt: NOW + (26 * 3600 + 14 * 60 + 9) * 1000 });
    expect(content()).toBe("Dans 26 h 14 min 09 s");
    act(() => vi.advanceTimersByTime(1000));
    expect(content()).toBe("Dans 26 h 14 min 08 s");
    expect(renderer.root.findByProps({ role: "timer" }).props["aria-live"]).toBe("off");
  });
  it("carries seconds into minutes and hours and stops at the actual start", () => {
    const onStart = vi.fn();
    mount({ startsAt: NOW + 3600_000, onStart });
    expect(content()).toBe("Dans 1 h 00 min 00 s");
    act(() => vi.advanceTimersByTime(1000));
    expect(content()).toBe("Dans 0 h 59 min 59 s");
    act(() => vi.advanceTimersByTime(3599_000));
    expect(content()).toBe("En ce moment");
    expect(onStart).toHaveBeenCalledExactlyOnceWith(NOW + 3600_000);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
  it("keeps the final partial second positive and never renders negative time", () => {
    mount({ startsAt: NOW + 400 });
    expect(content()).toBe("Dans 0 h 00 min 01 s");
    act(() => vi.advanceTimersByTime(1000));
    expect(content()).toBe("En ce moment");
  });
  it("uses the timestamp rather than the event timezone label", () => {
    mount({ startsAt: Date.parse("2026-10-14T21:00:00+02:00") });
    expect(content()).toBe("Dans 27 h 00 min 00 s");
  });
  it("catches up on return to a tab and removes the visibility listener on unmount", () => {
    const listeners = new Map();
    const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } };
    vi.stubGlobal("document", document);
    mount({ startsAt: NOW + 120_000 });
    act(() => { vi.setSystemTime(NOW + 91_000); listeners.get("visibilitychange")(); });
    expect(content()).toBe("Dans 0 h 00 min 29 s");
    act(() => renderer.unmount()); renderer = undefined;
    expect(listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("updates immediately after switching to another session and cleans up its old timer", () => {
    mount({ startsAt: NOW + 10_000 });
    act(() => renderer.update(<SessionCountdown startsAt={NOW + 90_000} />));
    expect(content()).toBe("Dans 0 h 01 min 30 s");
    expect(vi.getTimerCount()).toBe(1);
    act(() => renderer.unmount()); renderer = undefined;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("respects an explicit snapshot clock without starting a live interval", () => {
    mount({ startsAt: NOW + 5000, now: NOW });
    act(() => vi.advanceTimersByTime(2000));
    expect(content()).toBe("Dans 0 h 00 min 05 s");
    expect(vi.getTimerCount()).toBe(0);
    act(() => renderer.update(<SessionCountdown startsAt={NOW + 5000} now={NOW + 5000} />));
    expect(content()).toBe("En ce moment");
  });
  it.each(["en", "es"])("localizes the prefix and duration units in %s", async language => {
    await act(async () => { await setLanguage(language, { persist: false }); });
    mount({ startsAt: NOW + 3661_000 });
    expect(content()).not.toContain("Dans");
    expect(content()).toContain("01");
    act(() => vi.advanceTimersByTime(3661_000));
    expect(content()).toBe(language === "en" ? "Right now" : "Ahora mismo");
  });
});
