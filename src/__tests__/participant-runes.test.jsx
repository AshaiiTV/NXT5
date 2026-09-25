import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let React;
let TestRenderer;
let act;
let runes;
let renderer;

const catalog = [
  { id: 8200, name: "Sorcellerie", icon: "perk-images/Styles/7202_Sorcery.png", slots: [
    { runes: [{ id: 8214, name: "Invocation d’Aery", icon: "perk-images/Styles/Sorcery/SummonAery/SummonAery.png" }] },
    { runes: [{ id: 8226, name: "Ruban de mana", icon: "perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png" }] },
  ] },
  { id: 8300, name: "Inspiration", slots: [{ runes: [{ id: 8304, name: "Chaussures magiques" }] }] },
];
const response = (payload = catalog) => ({ ok: true, json: async () => payload });
const row = (stats = {}, version = "16.18.704.1234") => ({
  raw: { participantId: 3, stats: { perkPrimaryStyle: "8200", perkSubStyle: 8300, perk0: "8214", perk1: 8226, perk4: 8304, statPerk0: 5008, ...stats } },
  match: { raw: { info: { gameVersion: version } } },
});
function content(node = renderer.toJSON()) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(content).filter(Boolean).join(" ");
  return content(node.children);
}

beforeEach(async () => {
  vi.resetModules();
  React = (await import("react")).default;
  ({ default: TestRenderer, act } = await import("react-test-renderer"));
  runes = await import("../components/profile/ParticipantRunes.jsx");
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("participant rune display", () => {
  it("shows missing runes and skills without requesting a catalogue or fabricating choices", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await act(async () => {
      renderer = TestRenderer.create(<runes.ParticipantRunes row={{ raw: { stats: { perkPrimaryStyle: 0, perkSubStyle: false, perk0: "", statPerk0: null } } }} />);
    });

    expect(content()).toContain("Runes non renseignées.");
    expect(content()).toContain("Ordre des compétences non renseigné.");
    expect(renderer.root.findAllByType("li")).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders the recorded flat LCU choices and chronological skill order with French names", async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    const participant = row();
    participant.match.raw.timeline = { info: { frames: [{ timestamp: 180000, events: [
      { type: "SKILL_LEVEL_UP", participantId: 3, skillSlot: 2, timestamp: 61000 },
      { type: "SKILL_LEVEL_UP", participantId: 8, skillSlot: 4, timestamp: 55000 },
      { type: "SKILL_LEVEL_UP", participantId: 3, skillSlot: 1, timestamp: 0 },
      { type: "SKILL_LEVEL_UP", participantId: 3, skillSlot: 4, timestamp: 120000, levelUpType: "EVOLVE" },
    ] }] } };

    await act(async () => { renderer = TestRenderer.create(<runes.ParticipantRunes row={participant} />); });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe("https://ddragon.leagueoflegends.com/cdn/16.18.1/data/fr_FR/runesReforged.json");
    expect(content()).toContain("Sorcellerie Arbre secondaire Inspiration");
    expect(content()).toContain("Invocation d’Aery Ruban de mana Chaussures magiques");
    expect(content()).toContain("Force adaptative");
    const choices = renderer.root.findByProps({ "aria-label": "Runes sélectionnées" });
    expect(choices.findAllByType("li")).toHaveLength(3);
    const skills = renderer.root.findByProps({ "aria-label": "Compétences améliorées dans l’ordre" });
    expect(skills.findAllByType("strong").map((entry) => entry.children.join(""))).toEqual(["A", "Z"]);
    expect(skills.findAllByType("span").map((entry) => entry.children.join(""))).toEqual(["0:00", "1:01"]);
    expect(content()).not.toContain("Rune 0");
  });

  it("keeps unknown rune and shard IDs visible and a partial secondary page truthful", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    await act(async () => {
      renderer = TestRenderer.create(<runes.ParticipantRunes row={{ raw: { perks: {
        styles: [{ description: "subStyle", style: 8300, selections: [{ perk: 9999 }] }],
        statPerks: { offense: 5999, flex: 0, defense: null },
      } } }} />);
    });

    expect(content()).toContain("Arbre principal Non renseigné Arbre secondaire Inspiration");
    expect(content()).toContain("Rune 9999");
    expect(content()).toContain("Fragment 5999");
    expect(renderer.root.findByProps({ "aria-label": "Fragments de statistiques" }).findAllByType("li")).toHaveLength(1);
    expect(content()).not.toMatch(/(?:Rune|Fragment) 0\b/);
  });

  it("shares a pending catalogue between participants and reuses it after loading", async () => {
    let resolve;
    const fetch = vi.fn(() => new Promise((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    await act(async () => {
      renderer = TestRenderer.create(<><runes.ParticipantRunes row={row()} /><runes.ParticipantRunes row={row({ perk0: 8226 })} /></>);
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(2);
    await act(async () => resolve(response()));

    expect(renderer.root.findAllByProps({ role: "status" })).toHaveLength(0);
    expect(content()).toContain("Invocation d’Aery");
    await runes.loadRuneCatalog("16.18.1");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("discards a late catalogue when the displayed game's version changes", async () => {
    let resolveFirst;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise((done) => { resolveFirst = done; }))
      .mockResolvedValueOnce(response([{ id: 8200, name: "Sorcellerie (nouveau catalogue)" }]));
    vi.stubGlobal("fetch", fetch);
    await act(async () => { renderer = TestRenderer.create(<runes.ParticipantRunes row={row({}, "16.17.1")} />); });
    await act(async () => { renderer.update(<runes.ParticipantRunes row={row({}, "16.18.1")} />); });
    expect(content()).toContain("Sorcellerie (nouveau catalogue)");
    await act(async () => resolveFirst(response()));
    expect(content()).toContain("Sorcellerie (nouveau catalogue)");
  });

  it("leaves imported IDs usable after network failure and retries from the visible action", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    vi.stubGlobal("fetch", fetch);
    await act(async () => { renderer = TestRenderer.create(<runes.ParticipantRunes row={row()} />); });
    const failures = fetch.mock.calls.length;
    expect(failures).toBe(runes.runeCatalogVersions("16.18.1").length);
    expect(content()).toContain("Noms des runes indisponibles pour le moment.");
    expect(content()).toContain("Rune 8214");
    expect(content()).toContain("Force adaptative");

    await runes.loadRuneCatalog("16.18.1");
    expect(fetch).toHaveBeenCalledTimes(failures);
    fetch.mockResolvedValue(response());
    const retry = renderer.root.findAllByType("button").find((button) => content(button).includes("Réessayer"));
    await act(async () => retry.props.onClick());
    expect(fetch).toHaveBeenCalledTimes(failures + 1);
    expect(content()).toContain("Invocation d’Aery");
    expect(content()).not.toContain("Noms des runes indisponibles");
  });
});

describe("rune catalogue loading", () => {
  it("uses the game's version from stored JSON, normalizes builds and rejects invalid path values", () => {
    expect(runes.participantRuneVersion({ match: { raw: JSON.stringify({ info: { gameVersion: "16.18.704.1234" } }), patch: "16.17" } })).toBe("16.18.1");
    expect(runes.participantRuneVersion({ match: { raw: "invalid", patch: "16.17" } })).toBe("16.17.1");
    expect(runes.participantRuneVersion({ match: { raw: "null", patch: "16.17" } })).toBe("16.17.1");
    expect(runes.runeCatalogVersions("../../unknown")).not.toContain("../../unknown");
    expect(runes.runeCatalogVersions("16.18.1")[0]).toBe("16.18.1");
  });

  it("falls back after an unavailable or unusable catalogue while preserving unknown IDs", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(response([{ id: 0, name: "Invalid", slots: [] }]))
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetch);

    const loaded = await runes.loadRuneCatalog("16.18.1");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(new Set(fetch.mock.calls.map(([url]) => url)).size).toBe(3);
    expect(loaded.version).toBe(runes.runeCatalogVersions("16.18.1")[2]);
    expect(runes.runeDisplayName(8214, loaded)).toBe("Invocation d’Aery");
    expect(runes.runeDisplayName(9999, loaded)).toBe("Rune 9999");
  });

  it("times out a stalled JSON body and lets all shared callers continue to a fallback", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) })
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetch);
    const first = runes.loadRuneCatalog("16.18.1");
    const second = runes.loadRuneCatalog("16.18.1");
    await vi.advanceTimersByTimeAsync(4001);

    const [a, b] = await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(a).toBe(b);
    expect(a.entries.get(8214).name).toBe("Invocation d’Aery");
  });
});
