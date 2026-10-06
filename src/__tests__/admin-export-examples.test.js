import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { createExportExample, EXPORT_TEMPLATES } from "../pages/admin/export-examples.js";
import { renderGamePublicationPng } from "../../shared/publications/game-publication-browser.js";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";
import { publicationFixture } from "../../shared/publications/fixtures.js";

vi.mock("../utils/png-report.js", async (importOriginal) => ({
  ...await importOriginal(),
  pngLoadImage: vi.fn(async () => null),
}));

let drawnText;

beforeEach(() => {
  drawnText = [];
  vi.stubGlobal("FontFace", class { async load() { return this; } });
  vi.stubGlobal("document", {
    fonts: { add: vi.fn() },
    createElement(tag) {
      if (tag !== "canvas") throw new Error(`Unexpected browser element: ${tag}`);
      const canvas = createCanvas(1, 1);
      const ctx = canvas.getContext("2d");
      const fillText = ctx.fillText.bind(ctx);
      vi.spyOn(ctx, "fillText").mockImplementation((...args) => {
        drawnText.push(String(args[0]));
        return fillText(...args);
      });
      canvas.toBlob = callback => callback(new Blob([canvas.toBuffer("image/png")], { type: "image/png" }));
      return canvas;
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("site export catalogue integration", () => {
  it("offers a single complete game model for downloads and Discord", async () => {
    expect(new Set(EXPORT_TEMPLATES.map(template => template.id)).size).toBe(EXPORT_TEMPLATES.length);
    expect(EXPORT_TEMPLATES.map(template => template.id)).toEqual(["game", "group", "trends", "profile", "pool", "audience"]);
    for (const id of ["discord-game", "discord-test"]) {
      await expect(createExportExample(id)).rejects.toThrow("Ce modèle d’export n’existe pas.");
    }
    expect(EXPORT_TEMPLATES.find(template => template.id === "game")).toMatchObject({ title: "Statistiques d’une game", category: "site", format: "PNG" });
    const example = await createExportExample("game");
    const bytes = Buffer.from(await example.blob.arrayBuffer());
    expect(example.filename).toBe("nxt5-exemple-fictif-game.png");
    expect(example.width).toBe(1440);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", width: example.width, height: example.height });
    expect(drawnText.join(" ")).toContain("données fictives");
    for (const role of ["TOP", "JGL", "MID", "ADC", "SUP"]) expect(drawnText).toContain(`Demo ${role}`);
    for (const role of ["TOP", "JGL", "MID", "ADC", "SUP"]) expect(drawnText).toContain(`Rival ${role}`);
  });

  it("always uses the full browser export", async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const full = await renderGamePublicationPng(snapshot);
    expect(full.width).toBe(1440);
    for (const participant of snapshot.participants.filter(row => row.teamKey === "ENEMY")) expect(drawnText.join(" ")).toContain(participant.name);
  });
});

it('E6: uses current navigation names and public routes in the synthetic audience export', async () => {
  expect(EXPORT_TEMPLATES.find(item => item.id === 'game').source).toBe('Parties · Statistiques');
  expect(EXPORT_TEMPLATES.find(item => item.id === 'trends').source).toContain('Analyses ·');
  for (const id of ['profile', 'pool']) expect(EXPORT_TEMPLATES.find(item => item.id === id).source).toContain('Mon profil ·');
  const example = await createExportExample('audience');
  const csv = await example.blob.text();
  expect(csv).toContain('/demo');
  expect(csv).toContain('/soutenir');
  expect(csv).not.toMatch(/\/decouverte|\/tarifs|Tarifs consultés|Demande d’accès envoyée/);
});
