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

describe("Discord export catalogue integration", () => {
  it("generates the actual compact PNG with visibly fictitious data as a separate model", async () => {
    expect(EXPORT_TEMPLATES.find(template => template.id === "discord-game")).toMatchObject({ title: "Synthèse Discord", format: "PNG" });
    expect(EXPORT_TEMPLATES.find(template => template.id === "game")).toMatchObject({ title: "Statistiques d’une game", format: "PNG" });
    const example = await createExportExample("discord-game");
    const bytes = Buffer.from(await example.blob.arrayBuffer());
    expect(example.filename).toBe("nxt5-exemple-fictif-discord-game.png");
    expect(example.width).toBe(960);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", width: example.width, height: example.height });
    expect(drawnText.join(" ")).toContain("données fictives");
    for (const role of ["TOP", "JGL", "MID", "ADC", "SUP"]) expect(drawnText).toContain(`Demo ${role}`);
    expect(drawnText.join(" ")).not.toContain("Rival TOP");
  });

  it("preserves the full browser export when the Discord layout is not requested", async () => {
    const snapshot = buildGamePublicationSnapshot(publicationFixture());
    const full = await renderGamePublicationPng(snapshot);
    expect(full.width).toBe(1440);
    for (const participant of snapshot.participants.filter(row => row.teamKey === "ENEMY")) expect(drawnText.join(" ")).toContain(participant.name);
  });
});
