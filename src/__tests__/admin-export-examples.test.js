import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createExportExample, EXPORT_TEMPLATES } from "../pages/admin/export-examples.js";
import { renderGamePublicationPng } from "../../shared/publications/game-publication-browser.js";
import { buildGamePublicationSnapshot } from "../../shared/publications/game-publication.js";
import { publicationFixture } from "../../shared/publications/fixtures.js";

vi.mock("../utils/png-report.js", async (importOriginal) => ({
  ...await importOriginal(),
  pngLoadImage: vi.fn(async () => null),
}));

import { championDisplayName } from "../../shared/champions.js";

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
    expect(EXPORT_TEMPLATES.find(template => template.id === "game")).toMatchObject({ title: "Statistiques d’une partie", category: "site", format: "PNG" });
    const example = await createExportExample("game");
    const bytes = Buffer.from(await example.blob.arrayBuffer());
    expect(example.filename).toBe("nxt5-exemple-fictif-game.png");
    expect(example.width).toBe(1440);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const image = await loadImage(bytes);
    expect([image.width, image.height]).toEqual([example.width, example.height]);
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

describe("continuous PNG reports", () => {
  const champions = ["Aatrox", "Ahri", "Akali", "Alistar", "Amumu", "Anivia", "Annie", "Aphelios", "Ashe", "AurelionSol", "Azir", "Bard", "Blitzcrank", "Brand", "Braum", "Caitlyn", "Camille", "Cassiopeia", "Chogath", "Corki", "Darius", "Diana", "DrMundo", "Draven", "Ekko", "Elise", "Evelynn", "Ezreal"];
  const player = { name: "Joueur export continu", role: "MID" };

  it("keeps a large champion pool together without performance stats or page markers", async () => {
    const { renderChampionTierListPng } = await import("../pages/workspace/workspace-shared.jsx");
    const rows = champions.map(champion => ({ champion, status: "lock", games: 10, knownResults: 10, winrate: 80, stats_available: true }));
    const canvas = await renderChampionTierListPng({ player, rows });
    expect(canvas.height).toBeGreaterThan(1800);
    for (const champion of champions) expect(drawnText).toContain(championDisplayName(champion));
    expect(drawnText.filter(text => text === player.name)).toHaveLength(1);
    expect(drawnText.filter(text => text.startsWith("Exporté le "))).toHaveLength(1);
    expect(drawnText.join(" ")).not.toMatch(/victoires|games|winrate|%|sur cette page|Pool déclaré · \d+\/\d+/i);
  });

  it("keeps every played champion in the same profile below a single summary", async () => {
    const { renderPlayerProfilePng } = await import("../pages/workspace/PlayerUltimateProfile.jsx");
    const rows = champions.map(champion => ({ champion, match: { result: "Victoire" } }));
    const canvas = await renderPlayerProfilePng({ player, rows });
    expect(canvas.height).toBeGreaterThan(3000);
    for (const champion of champions) expect(drawnText).toContain(championDisplayName(champion));
    for (const label of [player.name, "Moyennes par game", "Champions joués"]) expect(drawnText.filter(text => text === label)).toHaveLength(1);
    expect(drawnText.filter(text => text.startsWith("Exporté le "))).toHaveLength(1);
    expect(drawnText.join(" ")).not.toMatch(/Profil joueur · \d+\/\d+/);
  });

  it("grows a group report to keep all games and champions under one header", async () => {
    const { renderStatsPng } = await import("../pages/workspace/GameWorkspace.jsx");
    const matches = champions.map((champion, index) => ({
      game_id: `CONTINUOUS_${index + 1}`, opponent: `Adversaire ${index + 1}`,
      participants: [{ team_key: "ALLY", champion }],
    }));
    const canvases = await renderStatsPng({ title: "Groupe export continu", matches, group: true });
    expect(canvases).toHaveLength(1);
    expect(canvases[0].height).toBeGreaterThan(4000);
    for (const match of matches) expect(drawnText).toContain(match.game_id);
    for (const champion of champions) expect(drawnText).toContain(championDisplayName(champion));
    for (const label of ["Groupe export continu", "Moyennes par game", "Games · 28", "Champions joués · nombre de picks"]) expect(drawnText.filter(text => text === label)).toHaveLength(1);
    expect(drawnText.filter(text => text.startsWith("Exporté le "))).toHaveLength(1);
    expect(drawnText.join(" ")).not.toMatch(/Groupe de games · \d+\/\d+/);
  });

  it("expands the group image for a game name taller than the old page limit", async () => {
    const { renderStatsPng } = await import("../pages/workspace/GameWorkspace.jsx");
    const canvases = await renderStatsPng({ matches: [{
      game_id: "VERY_LONG_GAME", opponent: "Adversaires de démonstration ".repeat(180), participants: [],
    }], group: true });
    expect(canvases).toHaveLength(1);
    expect(canvases[0].height).toBeGreaterThan(3000);
    expect(drawnText).toContain("VERY_LONG_GAME");
    expect(drawnText.filter(text => text.startsWith("Exporté le "))).toHaveLength(1);
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
