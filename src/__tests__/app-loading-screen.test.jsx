import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AppLoadingScreen from "../components/loading/AppLoadingScreen.jsx";
import { setLanguage } from "../i18n/locale.js";

let renderer;
const text = (node) => node == null ? "" : typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.children);

beforeEach(() => setLanguage("fr", { persist: false }));
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

function render(props = {}) {
  act(() => { renderer = TestRenderer.create(<AppLoadingScreen {...props} />); });
  return renderer.root;
}

describe("the actual application loading screen", () => {
  it.each([
    ["app", "Ouverture de NXT5", "Ouverture"],
    ["session", "Connexion à ton espace", "Connexion"],
    ["bootstrap", "Synchronisation en cours", "Synchronisation"],
    ["unexpected-phase", "Ouverture de NXT5", "Ouverture"],
  ])("announces the real %s phase with one current step", (phase, status, step) => {
    const root = render({ phase });
    const announcement = root.findByProps({ role: "status" });
    expect(announcement.props["aria-live"]).toBe("polite");
    expect(announcement.props["aria-atomic"]).toBe("true");
    expect(text(announcement)).toContain(status);
    const current = root.findAllByProps({ "aria-current": "step" });
    expect(current).toHaveLength(1);
    expect(text(current[0])).toContain(step);
    expect(root.findByProps({ role: "progressbar" }).props["aria-valuenow"]).toBeUndefined();
  });

  it.each([
    [{ loaded: 7, total: 18 }, 7],
    [{ loaded: -4, total: 18 }, 0],
    [{ loaded: 25, total: 18 }, 18],
  ])("announces a bounded count for %j", (progress, expected) => {
    const root = render({ phase: "bootstrap", progress });
    const bar = root.findByProps({ role: "progressbar" });
    expect(bar.props["aria-label"]).toBe("Chargement des parties");
    expect(bar.props["aria-valuemin"]).toBe(0);
    expect(bar.props["aria-valuemax"]).toBe(18);
    expect(bar.props["aria-valuenow"]).toBe(expected);
    expect(bar.props["aria-valuetext"]).toBe(`${expected} parties reçues sur 18`);
  });

  it.each([
    null,
    { loaded: 0, total: 0 },
    { loaded: 2, total: -1 },
    { loaded: NaN, total: 18 },
    { loaded: Infinity, total: 18 },
    { loaded: 7, total: Infinity },
  ])("keeps unknown or invalid progress indeterminate (%j)", (progress) => {
    const root = render({ phase: "bootstrap", progress });
    const bar = root.findByProps({ role: "progressbar" });
    expect(bar.props["aria-valuemin"]).toBeUndefined();
    expect(bar.props["aria-valuemax"]).toBeUndefined();
    expect(bar.props["aria-valuenow"]).toBeUndefined();
    expect(bar.props["aria-valuetext"]).toBe("Étape 3 sur 3 : Synchronisation");
    expect(text(root.findByProps({ role: "status" }))).not.toMatch(/NaN|Infinity/);
  });

  it("does not mistake a phase transition for game progress", () => {
    const root = render({ phase: "bootstrap", progress: { loaded: 7, total: 18 } });
    act(() => renderer.update(<AppLoadingScreen phase="session" progress={{ loaded: 7, total: 18 }} />));
    const bar = root.findByProps({ role: "progressbar" });
    expect(bar.props["aria-valuenow"]).toBeUndefined();
    expect(bar.props["aria-valuemax"]).toBeUndefined();
    expect(bar.props["aria-valuetext"]).toBe("Étape 2 sur 3 : Connexion");
    expect(text(root.findByProps({ role: "status" }))).toContain("Connexion à ton espace");
  });
});
