import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let React;
let TestRenderer;
let act;
let profile;
let renderer;

const catalog = {
  3031: { name: "Lame d'infini" },
  3032: { name: "Flèches des Yun Tal" },
  3363: { name: "Altération divinatoire" },
};
const response = (data = catalog) => ({ ok: true, json: async () => ({ data }) });

beforeEach(async () => {
  // Each test starts with an empty remote catalogue and no pending request.
  vi.resetModules();
  React = (await import("react")).default;
  ({ default: TestRenderer, act } = await import("react-test-renderer"));
  profile = await import("../pages/workspace/PlayerUltimateProfile.jsx");
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

describe("profile item names", () => {
  it("loads the French catalogue directly from Data Dragon", async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);

    await profile.loadItemNames();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(`https://ddragon.leagueoflegends.com/cdn/${profile.DDRAGON_VERSION}/data/fr_FR/item.json`);
    expect(profile.itemDisplayName(3031)).toBe("Lame d'infini");
    expect(profile.itemDisplayName("3032")).toBe("Flèches des Yun Tal");
  });

  it("updates both player inventories when the shared catalogue arrives", async () => {
    let resolve;
    const fetch = vi.fn(() => new Promise((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const { ParticipantCompareCard } = profile;

    await act(async () => {
      renderer = TestRenderer.create(<>
        <ParticipantCompareCard title="Joueur du profil" row={{ role: "ADC", raw: { item0: 3032, item6: 3363 } }} />
        <ParticipantCompareCard title="Adversaire de même rôle" row={{ role: "ADC", raw: { item0: 3031, item6: 3363 } }} />
      </>);
    });
    expect(fetch).toHaveBeenCalledOnce();

    await act(async () => resolve(response()));

    const inventories = renderer.root.findAllByProps({ className: "profile-champion-inventory" });
    const names = inventories.map((inventory) => inventory.findAllByType(profile.ItemNameText).map((item) => item.children.join("")));
    expect(names).toEqual([
      ["Flèches des Yun Tal", "Altération divinatoire"],
      ["Lame d'infini", "Altération divinatoire"],
    ]);
    expect(JSON.stringify(renderer.toJSON())).not.toMatch(/Item (3031|3032|3363)/);
  });

  it("shares simultaneous loads and keeps a successful catalogue cached", async () => {
    let resolve;
    const fetch = vi.fn(() => new Promise((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);

    const first = profile.loadItemNames();
    const second = profile.loadItemNames();
    expect(fetch).toHaveBeenCalledOnce();
    resolve(response());
    await Promise.all([first, second]);
    await profile.loadItemNames();

    expect(fetch).toHaveBeenCalledOnce();
    expect(profile.itemDisplayName(3032)).toBe("Flèches des Yun Tal");
  });

  it("tries an older catalogue when the first version is unavailable", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetch);

    await profile.loadItemNames();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toMatch(/^https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[^/]+\/data\/fr_FR\/item\.json$/);
    expect(fetch.mock.calls[1][0]).not.toBe(fetch.mock.calls[0][0]);
    expect(profile.itemDisplayName(3031)).toBe("Lame d'infini");
  });

  it("continues to the next version after an empty catalogue", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetch);

    await profile.loadItemNames();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(profile.itemDisplayName(3032)).toBe("Flèches des Yun Tal");
  });

  it("can retry after every version fails while preserving local names", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    vi.stubGlobal("fetch", fetch);

    await profile.loadItemNames();
    const failedRequests = fetch.mock.calls.length;
    expect(failedRequests).toBeGreaterThan(0);
    expect(profile.itemDisplayName(1018)).toBe("Cape d'agilité");

    fetch.mockResolvedValue(response());
    await profile.loadItemNames();

    expect(fetch).toHaveBeenCalledTimes(failedRequests + 1);
    expect(profile.itemDisplayName(3031)).toBe("Lame d'infini");
  });
});
