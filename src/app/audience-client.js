import { apiFetch } from "../api/client.js";
import { canonicalAudiencePath, sanitizeCampaignValue } from "./audience-paths.js";

export const AUDIENCE_CONSENT_VERSION = "2026-09-14";
export const AUDIENCE_SETTINGS_EVENT = "nxt5:cookie-settings";
const OPT_OUT = "nxt5_audience_optout";
const GOALS = new Set(["signup", "login", "access_request", "pricing_view"]);

// No network, browser identifiers or storage are accessed at module evaluation.
export function createAudienceClient({ request = apiFetch, win = globalThis.window, doc = globalThis.document, now = Date.now, uuid = () => globalThis.crypto.randomUUID() } = {}) {
  let state = { choice: null, version: AUDIENCE_CONSENT_VERSION, expiresAt: null, loaded: false, saving: false, error: "" };
  let excluded = true, view = null, route = null, timer = null, loading = null, generation = 0, active = false;
  let queue = Promise.resolve(), lastActivity = now(), channel = null;
  const listeners = new Set(), requests = new Set();
  const update = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener(state)); };
  const optedOut = () => String(doc?.cookie || "").split(";").some(value => value.trim() === `${OPT_OUT}=1`);
  function localOptOut(value) {
    if (!doc) return;
    doc.cookie = `${OPT_OUT}=${value ? "1" : ""}; Path=/; Max-Age=${value ? 15552000 : 0}; SameSite=Lax${win?.location?.protocol === "https:" ? "; Secure" : ""}`;
  }
  const allowed = () => !excluded && !optedOut() && state.choice === "accepted" && state.version === AUDIENCE_CONSENT_VERSION && Date.parse(state.expiresAt) > now();
  const visible = () => doc?.visibilityState !== "hidden";
  function metadata() {
    const data = {};
    try {
      const current = new URL(win.location.href);
      for (const [key, param] of [["source", "utm_source"], ["medium", "utm_medium"], ["campaign", "utm_campaign"]]) {
        const value = sanitizeCampaignValue(current.searchParams.get(param) || "");
        if (value) data[key] = value;
      }
      const referrer = doc?.referrer ? new URL(doc.referrer) : null;
      if (referrer && ["https:", "http:"].includes(referrer.protocol) && referrer.hostname !== current.hostname) data.referrer = referrer.hostname;
    } catch { /* Missing or malformed acquisition metadata is ignored. */ }
    return data;
  }
  function send(payload, keepalive = false, recovered = false) {
    if (!allowed()) return Promise.resolve(false);
    const epoch = generation;
    queue = queue.catch(() => {}).then(async () => {
      if (epoch !== generation || !allowed()) return false;
      const controller = new AbortController();
      requests.add(controller);
      try {
        await request("audience-events", { method: "POST", body: JSON.stringify(payload), signal: controller.signal, keepalive, timeoutMs: 8000 });
        if (view?.id === payload.pageId) view.lastTransmissionAt = now();
        return true;
      } catch (error) {
        if (!recovered && error?.code === "AUDIENCE_SESSION_EXPIRED" && epoch === generation && allowed()) {
          if (view?.id === payload.pageId) { view = null; beginPage(); }
          if (payload.type === "event" && view) send({ ...payload, eventId: uuid(), pageId: view.id, path: view.path }, false, true);
        }
        if (error?.status === 403 && epoch === generation) {
          stop();
          update({ choice: null, loaded: false });
        }
        return false; // Audience collection must never interrupt the user's action.
      } finally { requests.delete(controller); }
    });
    return queue;
  }
  function accountTime() {
    if (!view) return;
    const time = now();
    if (view.visible) view.durationMs += Math.max(0, Math.min(time, lastActivity + 60000) - view.lastTick);
    view.lastTick = time;
    view.visible = visible();
  }
  function scrollDepth() {
    const element = doc?.documentElement;
    const height = Math.max(0, (element?.scrollHeight || 0) - (win?.innerHeight || 0));
    return height > 0 ? Math.min(100, Math.max(0, Math.round(100 * (win?.scrollY || 0) / height))) : 100;
  }
  function flush(keepalive = false) {
    if (!view || !allowed()) return;
    accountTime();
    const durationSeconds = Math.min(86400, Math.floor(view.durationMs / 1000));
    if (durationSeconds === view.sentDuration && view.scroll === view.sentScroll) return;
    view.sentDuration = durationSeconds;
    view.sentScroll = view.scroll;
    send({ type: "engagement", eventId: uuid(), pageId: view.id, path: view.path, durationSeconds, scrollDepth: view.scroll }, keepalive);
  }
  function beginPage() {
    if (!allowed() || !route || view?.path === route) return;
    const time = now();
    lastActivity = time;
    view = { id: uuid(), path: route, durationMs: 0, lastTick: time, lastTransmissionAt: time, visible: visible(), scroll: scrollDepth(), sentDuration: -1, sentScroll: -1 };
    send({ type: "pageview", eventId: uuid(), pageId: view.id, path: view.path, ...metadata() });
    if (route === "/tarifs") trackEvent("pricing_view");
  }
  function resumePage() {
    if (view && now() - view.lastTransmissionAt >= 1800000) { view = null; beginPage(); }
  }
  function activity() { resumePage(); accountTime(); lastActivity = now(); if (view) view.scroll = Math.max(view.scroll, scrollDepth()); }
  function visibility() { if (visible()) resumePage(); flush(true); if (visible()) { lastActivity = now(); initialize(true); } }
  function pagehide() { flush(true); }
  function stop() {
    generation += 1;
    requests.forEach(controller => controller.abort());
    requests.clear();
    if (timer !== null) win?.clearInterval?.(timer);
    timer = null;
    if (active) {
      doc?.removeEventListener?.("visibilitychange", visibility);
      win?.removeEventListener?.("pagehide", pagehide);
      ["pointerdown", "keydown", "scroll"].forEach(event => win?.removeEventListener?.(event, activity));
    }
    active = false;
    view = null;
  }
  function start() {
    if (!allowed()) return;
    if (!active) {
      active = true;
      doc?.addEventListener?.("visibilitychange", visibility);
      win?.addEventListener?.("pagehide", pagehide);
      ["pointerdown", "keydown", "scroll"].forEach(event => win?.addEventListener?.(event, activity, { passive: true }));
      timer = win?.setInterval?.(() => {
        if (!allowed()) { stop(); update({ choice: optedOut() ? "rejected" : null }); return; }
        flush();
      }, 15000) ?? null;
    }
    beginPage();
  }
  async function initialize(force = false) {
    if (loading) return loading;
    if (state.loaded && !force) { start(); return state; }
    const epoch = generation;
    loading = (async () => {
      try {
        const result = await request("audience-consent", { timeoutMs: 8000 });
        if (epoch !== generation || state.saving) return state;
        const valid = result?.version === AUDIENCE_CONSENT_VERSION && Date.parse(result.expiresAt) > now();
        const choice = optedOut() ? "rejected" : valid && ["accepted", "rejected"].includes(result.choice) ? result.choice : null;
        update({ choice, version: result?.version || AUDIENCE_CONSENT_VERSION, expiresAt: result?.expiresAt || null, loaded: true, error: "" });
        if (choice === "accepted") start(); else stop();
      } catch {
        if (epoch === generation) { stop(); update({ loaded: true, choice: optedOut() ? "rejected" : null, error: "Les préférences sont momentanément indisponibles. Le suivi reste désactivé." }); }
      }
      return state;
    })().finally(() => { loading = null; });
    return loading;
  }
  async function choose(analytics) {
    if (state.saving) return false;
    stop();
    const epoch = generation;
    const superseded = () => {
      if (epoch === generation) return false;
      update({ saving: false, choice: optedOut() ? "rejected" : null, loaded: false });
      initialize(true);
      return true;
    };
    // A refusal remains effective locally even if the server is offline.
    if (!analytics) localOptOut(true);
    update({ saving: true, choice: analytics ? null : "rejected", error: "" });
    try {
      const result = await request("audience-consent", { method: "POST", body: JSON.stringify({ analytics }), timeoutMs: 10000 });
      if (superseded()) return false;
      if (analytics) localOptOut(false);
      const confirmed = analytics ? await request("audience-consent", { timeoutMs: 8000 }) : result;
      if (superseded()) return false;
      if (analytics && (confirmed?.choice !== "accepted" || confirmed.version !== AUDIENCE_CONSENT_VERSION || !(Date.parse(confirmed.expiresAt) > now()))) {
        throw new Error("Les cookies n’ont pas pu être enregistrés. Le suivi reste désactivé.");
      }
      update({ ...confirmed, choice: analytics ? "accepted" : "rejected", loaded: true, saving: false, error: "" });
      channel?.postMessage({ changed: true });
      if (analytics) start();
      return true;
    } catch (error) {
      if (superseded()) return false;
      localOptOut(true);
      update({ saving: false, loaded: true, choice: "rejected", error: analytics ? "Impossible d’enregistrer ton accord. Le suivi reste désactivé. Réessaie dans quelques instants." : "Le suivi est arrêté sur ce navigateur. La synchronisation de ton refus a échoué ; tu peux réessayer." });
      channel?.postMessage({ changed: true });
      return false;
    }
  }
  function setContext({ path, excluded: nextExcluded }) {
    const nextRoute = canonicalAudiencePath(path || "");
    if (nextExcluded) { excluded = true; route = nextRoute; stop(); return; }
    excluded = false;
    if (nextRoute !== route) { flush(true); view = null; route = nextRoute; }
    start();
  }
  function trackEvent(name) {
    if (allowed()) resumePage();
    if (!GOALS.has(name) || !view || !allowed()) return Promise.resolve(false);
    return send({ type: "event", eventId: uuid(), pageId: view.id, path: view.path, name });
  }
  function connect() {
    if (typeof win?.BroadcastChannel === "function" && !channel) {
      channel = new win.BroadcastChannel("nxt5-cookie-choice");
      channel.onmessage = () => { stop(); update({ choice: optedOut() ? "rejected" : null, loaded: false }); initialize(true); };
    }
    const focus = () => { if (!excluded) initialize(true); };
    win?.addEventListener?.("focus", focus);
    return () => { win?.removeEventListener?.("focus", focus); channel?.close(); channel = null; stop(); };
  }
  return { getState: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, initialize, choose, setContext, trackEvent, connect, stop };
}

let singleton;
export function getAudienceClient() { return singleton ||= createAudienceClient(); }
export function trackAudienceEvent(name) { return singleton?.trackEvent(name) || Promise.resolve(false); }
export function openCookieSettings() { globalThis.window?.dispatchEvent(new Event(AUDIENCE_SETTINGS_EVENT)); }
