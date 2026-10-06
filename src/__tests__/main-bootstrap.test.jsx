import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActualApp from "../App.jsx";

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

const InitialRouter = () => <main data-router />;
const InitialDemo = () => <main data-demo />;
let root, appDownload, demoDownload, preloadApp, demoRequested, createRoot, hydrateRoot, clientRender;

beforeEach(() => {
  vi.resetModules();
  appDownload = deferred();
  demoDownload = deferred();
  preloadApp = vi.fn(() => appDownload.promise);
  demoRequested = vi.fn();
  clientRender = vi.fn();
  createRoot = vi.fn(() => ({ render: clientRender }));
  hydrateRoot = vi.fn();
  root = { dataset: { prerendered: "true", prerenderPath: "/" }, innerHTML: '<main id="snapshot">Initial public HTML</main>' };
  vi.stubGlobal("window", { location: new URL("https://nxt5.org/") });
  vi.stubGlobal("document", { getElementById: vi.fn(id => id === "root" ? root : null) });
  vi.doMock("react-dom/client", () => ({ createRoot, hydrateRoot }));
  vi.doMock("../App.jsx", () => ({ default: ActualApp, preloadApp }));
  vi.doMock("../app/chunk-recovery.js", () => ({ installChunkRecovery: () => () => {} }));
  vi.doMock("../pages/public/DemoPage.jsx", async () => {
    demoRequested();
    await demoDownload.promise;
    return { DemoPage: InitialDemo };
  });
});
afterEach(async () => {
  appDownload.resolve({ default: InitialRouter });
  demoDownload.resolve();
  await vi.dynamicImportSettled();
  vi.doUnmock("react-dom/client");
  vi.doUnmock("../App.jsx");
  vi.doUnmock("../app/chunk-recovery.js");
  vi.doUnmock("../pages/public/DemoPage.jsx");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function locate(url, prerenderPath) {
  window.location = new URL(url, "https://nxt5.org");
  root.dataset = prerenderPath ? { prerendered: "true", prerenderPath } : {};
  if (!prerenderPath) root.innerHTML = "";
}
const boot = () => import("../main.jsx");
const mountedApp = tree => {
  expect(tree.type).toBe(React.StrictMode);
  expect(tree.props.children.type).toBe(ActualApp);
  return tree.props.children;
};

describe("browser entry bootstrap", () => {
  it("keeps the public snapshot while downloading the router, then hydrates its recorded route", async () => {
    locate("/?invite=invitation", "/");
    await boot();
    expect(preloadApp).toHaveBeenCalledOnce();
    expect(createRoot).not.toHaveBeenCalled();
    expect(hydrateRoot).not.toHaveBeenCalled();
    expect(root.innerHTML).toBe('<main id="snapshot">Initial public HTML</main>');
    appDownload.resolve({ default: InitialRouter });
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce());
    expect(hydrateRoot.mock.calls[0][0]).toBe(root);
    expect(mountedApp(hydrateRoot.mock.calls[0][1]).props).toMatchObject({
      initialApp: InitialRouter, initialRoute: { path: "/", search: "" },
    });
    expect(demoRequested).not.toHaveBeenCalled();
    expect(createRoot).not.toHaveBeenCalled();
  });

  it.each(["router", "demo"])("waits for the %s when the other demo dependency is ready", async pending => {
    locate("/demo?utm_source=test", "/demo");
    await boot();
    await vi.waitFor(() => expect(demoRequested).toHaveBeenCalledOnce());
    if (pending === "router") demoDownload.resolve();
    else appDownload.resolve({ default: InitialRouter });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(hydrateRoot).not.toHaveBeenCalled();
    expect(createRoot).not.toHaveBeenCalled();
    expect(root.innerHTML).toContain('id="snapshot"');
    appDownload.resolve({ default: InitialRouter });
    demoDownload.resolve();
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce());
    expect(mountedApp(hydrateRoot.mock.calls[0][1]).props).toMatchObject({
      initialApp: InitialRouter, initialDemoPage: InitialDemo, initialRoute: { path: "/demo", search: "" },
    });
  });

  it.each(["router", "demo"])("renders the recovery screen without hydration when the %s download fails", async failed => {
    locate("/demo", "/demo");
    const failure = new Error(`${failed} chunk failed`);
    await boot();
    await vi.waitFor(() => expect(demoRequested).toHaveBeenCalledOnce());
    if (failed === "router") { appDownload.reject(failure); demoDownload.resolve(); }
    else { appDownload.resolve({ default: InitialRouter }); demoDownload.reject(failure); }
    await vi.waitFor(() => expect(clientRender).toHaveBeenCalledOnce());
    expect(createRoot).toHaveBeenCalledExactlyOnceWith(root);
    expect(hydrateRoot).not.toHaveBeenCalled();
    const tree = clientRender.mock.calls[0][0];
    let capturedError;
    try { mountedApp(tree).props.initialApp(); } catch (error) { capturedError = error; }
    expect(capturedError).toBeInstanceOf(Error);
    // Vitest wraps a rejected mock-module factory and retains its cause.
    expect(capturedError.cause ?? capturedError).toBe(failure);
    // Exercise the existing real AppErrorBoundary, not only the root API call.
    vi.spyOn(console, "error").mockImplementation(() => {});
    let recovery;
    act(() => { recovery = TestRenderer.create(tree); });
    expect(recovery.root.findByType("h1").children).toEqual(["NXT5 n’a pas pu afficher cette page."]);
    expect(recovery.root.findAllByType("button").some(button => button.children.includes("Recharger la page"))).toBe(true);
    act(() => recovery.unmount());
  });

  it("keeps private roots on immediate client rendering while the application loads lazily", async () => {
    locate("/equipes?invite=invitation");
    await boot();
    expect(createRoot).toHaveBeenCalledExactlyOnceWith(root);
    expect(clientRender).toHaveBeenCalledOnce();
    expect(hydrateRoot).not.toHaveBeenCalled();
    expect(preloadApp).not.toHaveBeenCalled();
    expect(demoRequested).not.toHaveBeenCalled();
    expect(mountedApp(clientRender.mock.calls[0][0]).props.initialRoute).toBeUndefined();
  });

  it.each(["/connexion", "/demo"])("uses client rendering for the unprerendered %s shell", async path => {
    locate(path);
    await boot();
    expect(createRoot).not.toHaveBeenCalled();
    appDownload.resolve({ default: InitialRouter });
    await vi.waitFor(() => expect(clientRender).toHaveBeenCalledOnce());
    expect(hydrateRoot).not.toHaveBeenCalled();
    expect(demoRequested).not.toHaveBeenCalled();
    expect(mountedApp(clientRender.mock.calls[0][0]).props).toMatchObject({ initialApp: InitialRouter });
    expect(mountedApp(clientRender.mock.calls[0][0]).props.initialRoute).toBeUndefined();
  });

  it("hydrates the recorded 404 snapshot rather than substituting the unknown request path", async () => {
    locate("/page-absente?source=bookmark", "/404");
    appDownload.resolve({ default: InitialRouter });
    await boot();
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce());
    expect(mountedApp(hydrateRoot.mock.calls[0][1]).props.initialRoute).toEqual({ path: "/404", search: "" });
    expect(createRoot).not.toHaveBeenCalled();
    expect(demoRequested).not.toHaveBeenCalled();
  });
});
