import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../App.jsx";
import { installChunkRecovery } from "../app/chunk-recovery.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("startup error recovery", () => {
  it("offers reload/home actions without displaying exception details", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const location = { reload: vi.fn(), assign: vi.fn() };
    vi.stubGlobal("window", { location });
    function BrokenPage() { throw new Error("private diagnostic details"); }
    let renderer;
    act(() => { renderer = TestRenderer.create(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>); });
    const content = JSON.stringify(renderer.toJSON());
    expect(content).toContain("Chargement interrompu");
    expect(content).not.toContain("private diagnostic details");
    const buttons = renderer.root.findAllByType("button");
    act(() => buttons[0].props.onClick());
    act(() => buttons[1].props.onClick());
    expect(location.reload).toHaveBeenCalledOnce();
    expect(location.assign).toHaveBeenCalledWith("/");
    act(() => renderer.unmount());
  });

  function browser() {
    const target = new EventTarget();
    const storage = new Map();
    target.navigator = { onLine: true };
    target.sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
    target.location = { reload: vi.fn() };
    return target;
  }
  const failure = () => new Event("vite:preloadError", { cancelable: true });

  it("reloads once, retaining the guard across a new document", () => {
    const target = browser();
    const stop = installChunkRecovery(target);
    const first = failure();
    target.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    stop();
    installChunkRecovery(target);
    const repeated = failure();
    target.dispatchEvent(repeated);
    expect(target.location.reload).toHaveBeenCalledOnce();
    expect(repeated.defaultPrevented).toBe(false);
  });

  it.each(["offline", "blocked storage"])("keeps recovery manual when %s", mode => {
    const target = browser();
    if (mode === "offline") target.navigator.onLine = false;
    else target.sessionStorage.setItem = () => { throw new Error("Blocked"); };
    installChunkRecovery(target);
    const event = failure();
    target.dispatchEvent(event);
    expect(target.location.reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
