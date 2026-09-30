import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import NXT5 from "../App.jsx";
import { AppErrorBoundary } from "../components/ui/AppErrorBoundary.jsx";
import { installChunkRecovery } from "../app/chunk-recovery.js";

vi.mock("../components/loading/AppLoadingScreen.jsx", () => ({ default: ({ phase }) => <section data-loader={phase} /> }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// Régression du commit 76dbb10 (branche feat/pricing-validation) : une erreur de
// rendu ou un module introuvable après déploiement ne laisse plus d’écran vide.
describe("application error recovery", () => {
  function BrokenPage() { throw new Error("private diagnostic details"); }

  it("offers reload and home actions without exception details, focusing the heading", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const location = { pathname: "/", reload: vi.fn(), assign: vi.fn() };
    vi.stubGlobal("window", { location });
    let focused = null;
    let renderer;
    act(() => {
      renderer = TestRenderer.create(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>, {
        createNodeMock: (element) => ({ focus: () => { focused = element.props["data-app-error"] ? "heading" : "other"; } }),
      });
    });
    const content = JSON.stringify(renderer.toJSON());
    expect(content).toContain("NXT5 n’a pas pu afficher cette page.");
    expect(content).not.toContain("private diagnostic details");
    expect(renderer.root.findByProps({ role: "alert" })).toBeDefined();
    expect(focused).toBe("heading");
    const [reload, home] = renderer.root.findAllByType("button");
    act(() => reload.props.onClick());
    act(() => home.props.onClick());
    expect(location.reload).toHaveBeenCalledOnce();
    expect(location.assign).toHaveBeenCalledWith("/");
    act(() => renderer.unmount());
  });

  it("wraps the whole application and releases the loading screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("window", { location: { pathname: "/equipes", reload: vi.fn(), assign: vi.fn() } });
    let renderer;
    act(() => { renderer = TestRenderer.create(<NXT5 initialApp={BrokenPage} />); });
    expect(renderer.root.findAllByProps({ "data-loader": "app" })).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Affichage interrompu");
    act(() => renderer.unmount());
  });

  function browser() {
    const target = new EventTarget();
    const storage = new Map();
    target.navigator = { onLine: true };
    target.sessionStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
    target.location = { reload: vi.fn() };
    return target;
  }
  const failure = () => new Event("vite:preloadError", { cancelable: true });

  it("reloads once after a failed dynamic import, keeping the guard across the new document", () => {
    const target = browser();
    const stop = installChunkRecovery(target);
    const first = failure();
    target.dispatchEvent(first);
    expect(target.location.reload).toHaveBeenCalledOnce();
    expect(first.defaultPrevented).toBe(true);
    stop();
    installChunkRecovery(target);
    const repeated = failure();
    target.dispatchEvent(repeated);
    expect(target.location.reload).toHaveBeenCalledOnce();
    expect(repeated.defaultPrevented).toBe(false);
  });

  it("reloads again once the cooldown has elapsed", () => {
    const target = browser();
    installChunkRecovery(target);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    target.dispatchEvent(failure());
    now.mockReturnValue(1_000_000 + 60_000);
    target.dispatchEvent(failure());
    expect(target.location.reload).toHaveBeenCalledTimes(2);
  });

  it.each(["offline", "blocked storage"])("leaves recovery to the error screen when %s", (mode) => {
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
