import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIENCE_CONSENT_VERSION, createAudienceClient } from "../app/audience-client.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
const consent = (choice = "accepted", lifetime = 86_400_000) => ({
  choice, version: AUDIENCE_CONSENT_VERSION, expiresAt: new Date(Date.now() + lifetime).toISOString(),
});

function browser({ cookieBlocked = false } = {}) {
  const jar = new Map();
  const doc = new EventTarget();
  Object.assign(doc, { visibilityState: "visible", referrer: "", documentElement: { scrollHeight: 2000 } });
  Object.defineProperty(doc, "cookie", {
    get: () => [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
    set: value => {
      if (cookieBlocked) return;
      const [pair, ...attributes] = value.split(";");
      const [key, ...rest] = pair.split("=");
      if (attributes.some(attribute => attribute.trim() === "Max-Age=0")) jar.delete(key);
      else jar.set(key, rest.join("="));
    },
  });
  const channels = [];
  const win = new EventTarget();
  Object.assign(win, {
    location: { href: "https://nxt5.org/", protocol: "https:" }, innerHeight: 1000, scrollY: 0,
    setInterval: (...args) => globalThis.setInterval(...args),
    clearInterval: id => globalThis.clearInterval(id),
    BroadcastChannel: class {
      constructor() { channels.push(this); }
      postMessage = vi.fn();
      close = vi.fn();
    },
  });
  return { win, doc, channels };
}

const clients = [];
function setup(options = {}) {
  const surface = browser(options);
  let serverConsent = options.initialConsent || { choice: null, version: AUDIENCE_CONSENT_VERSION, expiresAt: null };
  const request = vi.fn(async (path, requestOptions = {}) => {
    if (options.handler) {
      const handled = options.handler(path, requestOptions);
      if (handled !== undefined) return handled;
    }
    if (path === "audience-consent") {
      if (requestOptions.method === "POST") serverConsent = consent(JSON.parse(requestOptions.body).analytics ? "accepted" : "rejected");
      return serverConsent;
    }
    return { ok: true };
  });
  let id = 0;
  const uuid = vi.fn(() => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`);
  const client = createAudienceClient({ ...surface, request, uuid, now: () => Date.now() });
  clients.push(client);
  const events = () => request.mock.calls.filter(([path]) => path === "audience-events").map(([, options]) => JSON.parse(options.body));
  const open = async (path = "/") => { client.setContext({ path, excluded: false }); await client.initialize(); await settle(); };
  return { ...surface, client, request, uuid, events, open };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z"));
});
afterEach(() => {
  clients.splice(0).forEach(client => client.stop());
  vi.useRealTimers();
});

describe("consent-gated audience collection", () => {
  it("creates no identifiers or audience requests until acceptance is confirmed", async () => {
    const h = setup();
    expect(h.request).not.toHaveBeenCalled();
    await h.open("/tarifs?email=private%40example.com");
    await h.client.trackEvent("signup");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.uuid).not.toHaveBeenCalled();
    expect(h.events()).toEqual([]);
    expect(await h.client.choose(true)).toBe(true);
    await settle();
    expect(h.events().map(event => event.type)).toEqual(["pageview", "event"]);
    expect(h.events()[1].name).toBe("pricing_view");
  });

  it("stops immediately and preserves local refusal when the refusal request fails", async () => {
    const failure = deferred();
    const h = setup({ initialConsent: consent(), handler: (path, options) => path === "audience-consent" && options.method === "POST" ? failure.promise : undefined });
    await h.open();
    const before = h.events().length;
    const pending = h.client.choose(false);
    expect(h.doc.cookie).toContain("nxt5_audience_optout=1");
    expect(h.client.getState().choice).toBe("rejected");
    await h.client.trackEvent("login");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.events()).toHaveLength(before);
    failure.reject(new Error("offline"));
    expect(await pending).toBe(false);
    await h.client.initialize(true); // Server still reports the old acceptance.
    expect(h.client.getState().choice).toBe("rejected");
    expect(h.events()).toHaveLength(before);
  });

  it("never accepts expired or obsolete consent and stops an accepted visit at expiry", async () => {
    const expired = setup({ initialConsent: consent("accepted", -1) });
    await expired.open();
    expect(expired.uuid).not.toHaveBeenCalled();
    const obsolete = setup({ initialConsent: { ...consent(), version: "old" } });
    await obsolete.open();
    expect(obsolete.uuid).not.toHaveBeenCalled();
    const shortLived = setup({ initialConsent: consent("accepted", 2000) });
    await shortLived.open();
    expect(shortLived.events()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await shortLived.client.trackEvent("login")).toBe(false);
    expect(shortLived.events()).toHaveLength(1);
    expect(shortLived.client.getState().choice).toBeNull();
  });

  it("does not track excluded administrators or unknown routes", async () => {
    const h = setup({ initialConsent: consent() });
    h.client.setContext({ path: "/", excluded: true });
    await h.client.initialize();
    expect(h.uuid).not.toHaveBeenCalled();
    h.client.setContext({ path: "/admin/audience?member=private", excluded: false });
    await settle();
    expect(h.uuid).not.toHaveBeenCalled();
    h.client.setContext({ path: "/equipes", excluded: false });
    await settle();
    expect(h.events()).toHaveLength(1);
    h.client.setContext({ path: "/equipes", excluded: true });
    await h.client.trackEvent("login");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.events()).toHaveLength(1);
  });

  it("ignores an initialization response that arrives after consent is revoked", async () => {
    const oldRead = deferred();
    let reads = 0;
    const h = setup({ handler: (path, options) => path === "audience-consent" && options.method !== "POST" && ++reads === 1 ? oldRead.promise : undefined });
    h.client.setContext({ path: "/", excluded: false });
    const pending = h.client.initialize();
    expect(await h.client.choose(false)).toBe(true);
    oldRead.resolve(consent());
    await pending;
    await settle();
    expect(h.client.getState().choice).toBe("rejected");
    expect(h.uuid).not.toHaveBeenCalled();
  });

  it("stays stopped when an accepted response cannot be confirmed from browser cookies", async () => {
    const h = setup({ cookieBlocked: true, handler: (path, options) => {
      if (path !== "audience-consent") return undefined;
      return options.method === "POST" ? consent() : { choice: null, version: AUDIENCE_CONSENT_VERSION, expiresAt: null };
    } });
    await h.open();
    expect(await h.client.choose(true)).toBe(false);
    expect(h.client.getState().choice).toBe("rejected");
    expect(h.uuid).not.toHaveBeenCalled();
    expect(h.events()).toEqual([]);
  });

  it("does not restart from an acceptance confirmation superseded by a cross-tab refusal", async () => {
    const confirmation = deferred();
    let reads = 0;
    const h = setup({ handler: (path, options) => path === "audience-consent" && options.method !== "POST" && ++reads === 2 ? confirmation.promise : undefined });
    const disconnect = h.client.connect();
    await h.open();
    const pending = h.client.choose(true);
    await settle();
    h.doc.cookie = "nxt5_audience_optout=1";
    h.channels[0].onmessage({ data: { changed: true } });
    confirmation.resolve(consent());
    await pending;
    await settle();
    expect(h.client.getState().choice).toBe("rejected");
    expect(h.events()).toEqual([]);
    disconnect();
  });
});

describe("audience event privacy and accounting", () => {
  it("sends only an allowlisted path and campaign labels, never query strings or referrer paths", async () => {
    const h = setup({ initialConsent: consent() });
    h.win.location.href = "https://nxt5.org/equipes?token=secret&utm_source=Newsletter&utm_medium=email&utm_campaign=user%40example.com#private";
    h.doc.referrer = "https://example.org/private/user?token=secret";
    await h.open("/equipes/?token=secret#private");
    expect(h.events()[0]).toMatchObject({ path: "/equipes", source: "newsletter", medium: "email", referrer: "example.org" });
    expect(h.events()[0]).not.toHaveProperty("campaign");
    expect(JSON.stringify(h.events())).not.toMatch(/secret|private|token|user@/);
  });

  it("does not accumulate hidden-tab time or duplicate unchanged engagement", async () => {
    const h = setup({ initialConsent: consent() });
    await h.open();
    await vi.advanceTimersByTimeAsync(5000);
    h.doc.visibilityState = "hidden";
    h.doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(h.events().filter(event => event.type === "engagement").at(-1).durationSeconds).toBe(5);
    const count = h.events().length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.events()).toHaveLength(count);
    h.doc.visibilityState = "visible";
    h.doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(5000);
    h.win.dispatchEvent(new Event("pagehide"));
    await settle();
    expect(h.events().filter(event => event.type === "engagement").at(-1).durationSeconds).toBe(10);
  });

  it("caps inactive foreground time until a new activity resumes the visit", async () => {
    const h = setup({ initialConsent: consent() });
    await h.open();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.events().filter(event => event.type === "engagement").at(-1).durationSeconds).toBe(60);
    h.win.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(h.events().filter(event => event.type === "engagement").at(-1).durationSeconds).toBe(75);
  });

  it("starts a fresh page before recording a goal after 31 minutes without activity", async () => {
    const h = setup({ initialConsent: consent() });
    await h.open("/equipes");
    const firstPageId = h.events()[0].pageId;
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    await h.client.trackEvent("signup");
    await settle();
    const views = h.events().filter(event => event.type === "pageview");
    expect(views).toHaveLength(2);
    expect(views[1].pageId).not.toBe(firstPageId);
    expect(views[1].path).toBe("/equipes");
    expect(h.events().slice(-2)).toEqual([
      views[1], expect.objectContaining({ type: "event", name: "signup", pageId: views[1].pageId, path: "/equipes" }),
    ]);
  });

  it("starts a fresh view on same-page return after the tab was hidden for 31 minutes", async () => {
    const h = setup({ initialConsent: consent() });
    await h.open("/planning");
    h.doc.visibilityState = "hidden";
    h.doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    h.doc.visibilityState = "visible";
    h.doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    const views = h.events().filter(event => event.type === "pageview");
    expect(views).toHaveLength(2);
    expect(views[1].pageId).not.toBe(views[0].pageId);
    expect(views[1].path).toBe("/planning");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(h.events().filter(event => event.type === "engagement").at(-1)).toMatchObject({ pageId: views[1].pageId, durationSeconds: 15 });
  });

  it("recovers a server-expired session with a new pageview and a single successful goal replay", async () => {
    let goalAttempts = 0;
    const acceptedGoals = [];
    const h = setup({ initialConsent: consent(), handler: (path, options) => {
      if (path !== "audience-events") return undefined;
      const payload = JSON.parse(options.body);
      if (payload.type !== "event") return undefined;
      if (++goalAttempts === 1) throw Object.assign(new Error("expired"), { status: 409, code: "AUDIENCE_SESSION_EXPIRED" });
      acceptedGoals.push(payload);
      return { ok: true };
    } });
    await h.open("/connexion");
    await h.client.trackEvent("login");
    await settle();
    const events = h.events();
    expect(events.map(event => event.type)).toEqual(["pageview", "event", "pageview", "event"]);
    expect(events[2].pageId).not.toBe(events[0].pageId);
    expect(events[3]).toMatchObject({ pageId: events[2].pageId, path: "/connexion", name: "login" });
    expect(events[3].eventId).not.toBe(events[1].eventId);
    expect(acceptedGoals).toEqual([events[3]]);
  });

  it("does not loop when the server also rejects the recovered goal with session expiration", async () => {
    const h = setup({ initialConsent: consent(), handler: (path, options) => {
      if (path === "audience-events" && JSON.parse(options.body).type === "event") {
        throw Object.assign(new Error("expired"), { status: 409, code: "AUDIENCE_SESSION_EXPIRED" });
      }
      return undefined;
    } });
    await h.open();
    await h.client.trackEvent("access_request");
    await settle();
    expect(h.events().map(event => event.type)).toEqual(["pageview", "event", "pageview", "event"]);
    expect(h.events().filter(event => event.type === "event")).toHaveLength(2);
  });

  it("continues sending active duration beyond 30 minutes on one page", async () => {
    const h = setup({ initialConsent: consent() });
    await h.open("/planning");
    for (let minute = 0; minute < 32; minute += 1) {
      h.win.dispatchEvent(new Event("pointerdown"));
      await vi.advanceTimersByTimeAsync(60_000);
    }
    const engagement = h.events().filter(event => event.type === "engagement");
    expect(engagement.at(-1).durationSeconds).toBe(1920);
    expect(engagement.at(-1).durationSeconds).toBeGreaterThan(engagement.at(-2).durationSeconds);
    expect(h.events().filter(event => event.type === "pageview")).toHaveLength(1);
  });

  it("serializes page transitions and deduplicates normalized paths and unchanged metrics", async () => {
    const firstPage = deferred();
    let writes = 0;
    const h = setup({ initialConsent: consent(), handler: path => path === "audience-events" && ++writes === 1 ? firstPage.promise : undefined });
    await h.open("/?secret=one");
    h.client.setContext({ path: "/?secret=two#anchor", excluded: false });
    h.client.setContext({ path: "/equipes?private=yes", excluded: false });
    await settle();
    expect(h.events()).toHaveLength(1);
    firstPage.resolve({ ok: true });
    await settle();
    expect(h.events().map(({ type, path }) => [type, path])).toEqual([["pageview", "/"], ["engagement", "/"], ["pageview", "/equipes"]]);
    h.win.dispatchEvent(new Event("pagehide"));
    await settle();
    const count = h.events().length;
    h.win.dispatchEvent(new Event("pagehide"));
    await settle();
    expect(h.events()).toHaveLength(count);
    expect(new Set(h.events().map(event => event.eventId)).size).toBe(count);
  });

  it("aborts an in-flight event and discards queued events on refusal", async () => {
    const inFlight = deferred();
    const h = setup({ initialConsent: consent(), handler: path => path === "audience-events" ? inFlight.promise : undefined });
    await h.open();
    const queued = h.client.trackEvent("login");
    const signal = h.request.mock.calls.find(([path]) => path === "audience-events")[1].signal;
    await h.client.choose(false);
    expect(signal.aborted).toBe(true);
    inFlight.resolve({ ok: true });
    expect(await queued).toBe(false);
    expect(h.events()).toHaveLength(1);
  });
});
