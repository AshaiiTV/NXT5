import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import ExportsPage from "../pages/admin/ExportsPage.jsx";
import { createExportExample } from "../pages/admin/export-examples.js";

vi.mock("../pages/admin/export-examples.js", () => ({
  createExportExample: vi.fn(),
  EXPORT_TEMPLATES: [
    { id: "game", category: "site", title: "Statistiques d’une game", source: "Games", format: "PNG", description: "La game complète." },
    { id: "audience", category: "site", title: "Rapport de fréquentation", source: "Administration", format: "CSV", description: "Les mesures du site." },
    { id: "discord-game", category: "bot", title: "Publication d’une game", source: "Bot Discord", format: "PNG", description: "Le visuel publié par le bot." },
  ],
}));

let renderer;
let pngExample;
let csvExample;
let createObjectURL;
let revokeObjectURL;
const dialogNodes = [];

beforeEach(async () => {
  const bytes = await sharp({ create: { width: 4, height: 6, channels: 4, background: "#123456" } }).png().toBuffer();
  pngExample = { blob: new Blob([bytes], { type: "image/png" }), filename: "nxt5-game-exemple.png", width: 4, height: 6 };
  const csvText = '"date";"visites"\r\n"2026-09-23";"12"\r\n';
  csvExample = { blob: new Blob(["\uFEFF", csvText], { type: "text/csv;charset=utf-8" }), filename: "nxt5-frequentation-exemple.csv", csvText };
  createExportExample.mockImplementation(async (id) => id === "audience" ? csvExample : pngExample);
  createObjectURL = vi.spyOn(URL, "createObjectURL");
  revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
  vi.stubGlobal("document", { body: { style: { overflow: "auto" } }, createElement: vi.fn() });
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  dialogNodes.length = 0;
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function text(node) {
  return typeof node === "string" ? node : (node.children || []).map(text).join("");
}

function button(label, root = renderer.root) {
  const result = root.findAllByType("button").find(node => node.props["aria-label"] === label || text(node).trim() === label);
  expect(result, `Button ${label}`).toBeTruthy();
  return result;
}

function card(id) {
  return renderer.root.findByProps({ "aria-labelledby": `export-title-${id}` });
}

async function click(label, root = renderer.root, currentTarget = { isConnected: true, focus: vi.fn() }) {
  const target = button(label, root);
  expect(target.props.disabled).not.toBe(true);
  await act(async () => target.props.onClick({ currentTarget }));
  return currentTarget;
}

async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(<ExportsPage />, { createNodeMock: element => {
      if (element.type !== "dialog") return null;
      const node = { open: false, showModal: vi.fn(function () { this.open = true; }), close: vi.fn(function () { this.open = false; }) };
      dialogNodes.push(node);
      return node;
    } });
  });
}

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

describe("administration export previews", () => {
  it("keeps pending models unavailable and renders the generated image without starting a download", async () => {
    const pending = deferred();
    createExportExample.mockImplementation(id => id === "game" ? pending.promise : Promise.resolve(csvExample));
    await mount();
    expect(card("game").findAllByProps({ role: "status" })).toHaveLength(1);
    expect(button("Voir le modèle", card("game")).props.disabled).toBe(true);
    expect(card("game").findAllByType("img")).toHaveLength(0);
    await act(async () => pending.resolve(pngExample));
    expect(card("game").findAllByProps({ role: "status" })).toHaveLength(0);
    expect(button("Voir le modèle", card("game")).props.disabled).toBe(false);
    const image = card("game").findByType("img");
    expect([image.props.width, image.props.height]).toEqual([4, 6]);
    expect(image.props.alt).toContain("données fictives");
    expect(createObjectURL).toHaveBeenCalledWith(pngExample.blob);
    expect(document.createElement).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType("a")).toHaveLength(0);
  });

  it("retries only the failed model and keeps the other preview available", async () => {
    createExportExample.mockImplementationOnce(() => Promise.reject(new Error("Generation unavailable")));
    await mount();
    expect(card("game").findAllByProps({ role: "alert" })).toHaveLength(1);
    expect(button("Voir le modèle", card("game")).props.disabled).toBe(true);
    expect(button("Voir le modèle", card("audience")).props.disabled).toBe(false);
    await click("Réessayer", card("game"));
    expect(card("game").findAllByProps({ role: "alert" })).toHaveLength(0);
    expect(card("game").findAllByType("img")).toHaveLength(1);
    expect(createExportExample.mock.calls.map(([id]) => id)).toEqual(["game", "audience", "discord-game", "game"]);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("opens the native dialog, downloads the same valid PNG, zooms and restores focus on Escape", async () => {
    await mount();
    const opener = await click("Agrandir : Statistiques d’une game");
    const dialog = renderer.root.findByType("dialog");
    expect(dialogNodes[0].showModal).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("hidden");
    expect(renderer.root.findByProps({ id: dialog.props["aria-labelledby"] }).children.join("")).toBe("Statistiques d’une game");
    expect(button("Fermer l’aperçu", dialog).props.autoFocus).toBe(true);
    const download = dialog.findByType("a");
    expect(download.props.download).toBe(pngExample.filename);
    expect(download.props.href).toBe(card("game").findByType("img").props.src);
    const response = await fetch(download.props.href);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes).toEqual(Buffer.from(await pngExample.blob.arrayBuffer()));
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", width: 4, height: 6 });
    await click("Taille réelle", dialog);
    expect(button("Adapter à l’écran", dialog).props["aria-pressed"]).toBe(true);
    expect(dialog.findByType("img").props.style).toEqual({ width: 4 });
    const cancel = { preventDefault: vi.fn() };
    await act(async () => dialog.props.onCancel(cancel));
    expect(cancel.preventDefault).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
    expect(dialogNodes[0].close).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("auto");
    expect(opener.focus).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("filters formats without regenerating files and exposes the complete downloadable CSV", async () => {
    await mount();
    await click("Données CSV (1)");
    expect(card("game").props.hidden).toBe(true);
    expect(card("audience").props.hidden).toBe(false);
    expect(text(renderer.root.findByProps({ className: "exports-count" }))).toBe("1 modèle affiché");
    await click("Voir le modèle", card("audience"));
    const dialog = renderer.root.findByType("dialog");
    expect(dialog.findByType("pre").children.join("")).toBe(csvExample.csvText);
    expect(dialog.findAllByProps({ "aria-pressed": false })).toHaveLength(0);
    const link = dialog.findByType("a");
    expect(link.props.download).toBe(csvExample.filename);
    const response = await fetch(link.props.href);
    expect(response.headers.get("content-type")).toBe("text/csv;charset=utf-8");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(await csvExample.blob.arrayBuffer()));
    await click("Fermer l’aperçu", dialog);
    await click("Tous (3)");
    expect(card("game").props.hidden).toBe(false);
    expect(createExportExample).toHaveBeenCalledTimes(3);
    expect(createObjectURL).toHaveBeenCalledTimes(3);
  });

  it("switches to bot exports from CSV, scopes formats and preserves generated previews", async () => {
    await mount();
    await click("Données CSV (1)");
    const category = renderer.root.findByType("select");
    await act(async () => category.props.onChange({ target: { value: "bot" } }));
    expect(card("game").props.hidden).toBe(true);
    expect(card("audience").props.hidden).toBe(true);
    expect(card("discord-game").props.hidden).toBe(false);
    expect(button("Tous (1)").props["aria-pressed"]).toBe(true);
    expect(text(renderer.root.findByProps({ className: "exports-count" }))).toBe("1 modèle affiché");
    expect(renderer.root.findAllByType("button").some(node => text(node).includes("Données CSV"))).toBe(false);
    await click("Images PNG (1)");
    await click("Voir le modèle", card("discord-game"));
    expect(renderer.root.findByType("dialog").findByType("a").props.download).toBe(pngExample.filename);
    await click("Fermer l’aperçu");
    await act(async () => category.props.onChange({ target: { value: "site" } }));
    expect(card("game").props.hidden).toBe(false);
    expect(card("audience").props.hidden).toBe(false);
    expect(card("discord-game").props.hidden).toBe(true);
    expect(button("Tous (2)").props["aria-pressed"]).toBe(true);
    await act(async () => category.props.onChange({ target: { value: "all" } }));
    expect(card("discord-game").props.hidden).toBe(false);
    expect(createExportExample).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("releases ready URLs on departure and ignores unfinished generation after unmount", async () => {
    const pending = deferred();
    createExportExample.mockImplementation(id => id !== "audience" ? pending.promise : Promise.resolve(csvExample));
    await mount();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const csvUrl = createObjectURL.mock.results[0].value;
    await act(async () => renderer.unmount());
    renderer = undefined;
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(csvUrl);
    await act(async () => pending.resolve(pngExample));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
