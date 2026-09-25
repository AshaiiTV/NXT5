import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { useDiscordPublication } from "../components/discord/useDiscordPublication.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const body = { teamId: "team", matchId: "game", routeId: "route", snapshotRevision: 3 };
const context = { channelId: "channel", configVersion: 7 };
const receipt = { id: "job", status: "succeeded", matchId: "game", routeId: "route", channelId: "channel", configVersion: 7, revision: 3, messageUrl: "https://discord.com/channels/123/456/789" };
let renderer, publication;
function Harness() { publication = useDiscordPublication(); return null; }
beforeEach(async () => { vi.useFakeTimers(); await act(async () => { renderer = TestRenderer.create(<Harness />); }); });
afterEach(() => { act(() => renderer.unmount()); vi.useRealTimers(); vi.resetAllMocks(); });
async function send() { await act(async () => { void publication.send(body, context); }); }
const sends = () => apiFetch.mock.calls.filter(([path]) => path === "team-discord-publish");

describe("current Discord publication result", () => {
  it("keeps one request in flight and only confirms a successful receipt", async () => {
    let finish;
    apiFetch.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await send(); await send();
    expect(sends()).toHaveLength(1);
    expect(publication.busy).toBe(true);
    expect(publication.submitting).toBe(true);
    expect(publication.receipt).toBeNull();
    expect(sends()[0][1].timeoutMs).toBe(60_000);
    await act(async () => finish({ jobs: [receipt] }));
    expect(publication.busy).toBe(false);
    expect(publication.submitting).toBe(false);
    expect(publication.receipt).toEqual(receipt);
    expect(publication.error).toBe("");
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("automatically follows only the requested job until Discord confirms it", async () => {
    let reads = 0;
    apiFetch.mockImplementation(async (path) => path === "team-discord-publish"
      ? { jobs: [{ ...receipt, status: "queued" }] }
      : { deliveries: [{ ...receipt, id: "unrelated-job" }, { ...receipt, status: ++reads > 1 ? "succeeded" : "sending" }] });
    await send();
    expect(publication.busy).toBe(true);
    expect(publication.receipt.status).toBe("sending");
    expect(publication.submitting).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(publication.busy).toBe(false);
    expect(publication.receipt.status).toBe("succeeded");
    expect(sends()).toHaveLength(1);
  });

  it("shows the current precise error and permits a direct explicit retry", async () => {
    apiFetch.mockResolvedValueOnce({ jobs: [{ ...receipt, status: "blocked", lastError: "Le jeton du bot est refusé par Discord.", errorCode: "DISCORD_UNAUTHORIZED", messageUrl: null }] })
      .mockResolvedValueOnce({ jobs: [receipt] });
    await send();
    expect(publication.error).toBe("Le jeton du bot est refusé par Discord.");
    expect(publication.busy).toBe(false);
    await send();
    expect(sends()).toHaveLength(2);
    expect(JSON.parse(sends()[1][1].body).requestId).not.toBe(JSON.parse(sends()[0][1].body).requestId);
    expect(publication.error).toBe("");
    expect(publication.receipt.status).toBe("succeeded");
  });

  it("recovers a lost response by verifying the same destination and config, without resending", async () => {
    let reads = 0;
    apiFetch.mockImplementation(async (path) => {
      if (path === "team-discord-publish") throw new Error("Network response lost");
      return { deliveries: ++reads === 1
        ? [{ ...receipt, channelId: "another" }, { ...receipt, routeId: "old" }, { ...receipt, configVersion: 6 }, { ...receipt, revision: 2 }]
        : [{ ...receipt, revision: 4 }] };
    });
    await send();
    expect(publication.busy).toBe(true);
    expect(publication.receipt).toBeNull();
    expect(publication.submitting).toBe(false);
    const requestId = JSON.parse(sends()[0][1].body).requestId;
    expect(apiFetch.mock.calls[1][0]).toContain(`requestId=${requestId}`);
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(publication.receipt.status).toBe("succeeded");
    expect(publication.receipt.revision).toBe(4);
    expect(sends()).toHaveLength(1);
  });

  it("offers verification in place for an uncertain send instead of posting a duplicate", async () => {
    apiFetch.mockResolvedValueOnce({ jobs: [{ ...receipt, status: "uncertain", messageUrl: null }] })
      .mockResolvedValueOnce({ deliveries: [receipt] });
    await send();
    expect(publication.needsVerification).toBe(true);
    await send();
    expect(sends()).toHaveLength(1);
    await act(async () => publication.verify());
    expect(publication.receipt.status).toBe("succeeded");
    expect(publication.needsVerification).toBe(false);
    expect(sends()).toHaveLength(1);
  });

  it("does not confuse a definitive request refusal with a pending send", async () => {
    apiFetch.mockRejectedValue(Object.assign(new Error("Les envois sont suspendus."), { status: 409 }));
    await send();
    expect(publication.error).toBe("Les envois sont suspendus.");
    expect(publication.busy).toBe(false);
    expect(publication.submitting).toBe(false);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("bounds polling, then lets the user verify the same request without sending again", async () => {
    apiFetch.mockImplementation(async (path) => path === "team-discord-publish" ? { jobs: [{ ...receipt, status: "queued" }] } : { deliveries: [] });
    await send();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(publication.busy).toBe(false);
    expect(publication.needsVerification).toBe(true);
    expect(publication.error).toContain("pas encore confirmé");
    expect(sends()).toHaveLength(1);
  });

  it("allows an explicit retry with fresh correlation when no receipt can be recovered", async () => {
    apiFetch.mockImplementation(async (path) => {
      if (path === "team-discord-publish") throw new Error("Request lost before delivery");
      return { deliveries: [] };
    });
    await send();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(publication.busy).toBe(false);
    expect(publication.needsVerification).toBe(false);
    expect(publication.error).toContain("Clique sur Publier");
    const firstBody = JSON.parse(sends()[0][1].body);
    apiFetch.mockResolvedValue({ jobs: [receipt] });
    await send();
    expect(sends()).toHaveLength(2);
    const retryBody = JSON.parse(sends()[1][1].body);
    expect(retryBody).toEqual({ ...firstBody, requestId: expect.any(String) });
    expect(retryBody.requestId).not.toBe(firstBody.requestId);
    expect(publication.receipt.status).toBe("succeeded");
  });

  it("aborts polling when the dialog closes or its game changes", async () => {
    apiFetch.mockImplementation(async (path) => path === "team-discord-publish" ? { jobs: [{ ...receipt, status: "queued" }] } : { deliveries: [] });
    await send();
    const signal = sends()[0][1].signal;
    act(() => renderer.unmount());
    expect(signal.aborted).toBe(true);
    const calls = apiFetch.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(apiFetch).toHaveBeenCalledTimes(calls);
  });
});
