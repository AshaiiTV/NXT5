import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import SocialCalendar from "../pages/workspace/SocialCalendar.jsx";
import { SelectInput, TextInput } from "../components/ui/Core.jsx";
import { calendarCsv, calendarDayKey, calendarRange, formatCalendarTimestamp, moveCalendarAnchor, publicationNeedsCheck, safeCalendarUrl, sourceFreshness } from "../utils/social-calendar.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
vi.mock("../components/ui/ModalDialog.jsx", () => ({ ModalDialog: ({ children, ...props }) => <section data-dialog="true" aria-labelledby={props["aria-labelledby"]}>{children}</section> }));

const snapshot = {
  posts: [
    { id: "ig", source: "metricool", network: "instagram", title: "Un call. Une décision.", body: "Une décision pour toute l’équipe", format: "Reel", status: "published", scheduledAt: "2026-10-15T08:00:00Z", verifiedAt: "2026-10-15T08:01:00Z", url: "https://instagram.com/p/test" },
    { id: "yt", source: "youtube", network: "youtube", title: "Victoire. Tu sais vraiment pourquoi ?", body: "Une review", format: "Vidéo", status: "scheduled", scheduledAt: "2026-10-15T16:00:00Z", verifiedAt: "2026-10-14", plannerUrl: "https://studio.youtube.com/" },
    { id: "tt", source: "manual", network: "tiktok", title: "Vidéo prête", format: "Vidéo", status: "ready", scheduledAt: null, verifiedAt: null },
  ],
  sources: [
    { id: "metricool", label: "Instagram · Metricool", lastSuccessAt: "2026-10-15T16:30:00Z", mode: "automatic", detail: "Automatique chaque heure", error: null },
    { id: "youtube", label: "YouTube", lastSuccessAt: "2026-10-14", mode: "confirmed", detail: "Confirmation du 14 octobre", error: null },
  ],
  serverTime: "2026-10-15T17:00:00Z",
};
let renderer;
let visibilityListeners;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T17:00:00Z"));
  visibilityListeners = new Set();
  vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: (name, listener) => { if (name === "visibilitychange") visibilityListeners.add(listener); }, removeEventListener: (name, listener) => { if (name === "visibilitychange") visibilityListeners.delete(listener); } });
  apiFetch.mockResolvedValue(snapshot);
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function renderCalendar() {
  await act(async () => { renderer = TestRenderer.create(<SocialCalendar />); });
  return renderer;
}
const cards = () => renderer.root.findAll(node => node.type === "button" && node.props.className === "nxt5-social-post");

describe("publication calendar dates and sources", () => {
  it("uses Paris dates across midnight and daylight saving changes", () => {
    expect(calendarDayKey("2026-10-15T22:30:00Z")).toBe("2026-10-16");
    expect(calendarDayKey("2026-10-25T22:30:00Z")).toBe("2026-10-25");
    expect(calendarDayKey("2026-10-25T23:30:00Z")).toBe("2026-10-26");
    expect(calendarDayKey("2026-02-30")).toBeNull();
    expect(calendarDayKey("not a date")).toBeNull();
    expect(formatCalendarTimestamp("2026-10-15T16:00:00Z", "fr-FR", { timeOnly: true })).toBe("18:00");
  });
  it("never invents a time for a date-only manual confirmation", () => {
    expect(formatCalendarTimestamp("2026-10-14", "fr-FR")).toBe("14 oct. 2026");
    expect(formatCalendarTimestamp("2026-10-14", "fr-FR", { timeOnly: true })).toBe("14 oct. 2026");
    expect(sourceFreshness({ mode: "automatic", lastSuccessAt: "2026-10-15" })).toBe("stale");
    expect(sourceFreshness(snapshot.sources[1])).toBe("confirmed");
  });
  it("marks failed and old automatic synchronization separately from confirmation", () => {
    expect(sourceFreshness(snapshot.sources[0])).toBe("automatic");
    expect(sourceFreshness({ ...snapshot.sources[0], lastSuccessAt: "2026-10-15T15:00:00Z" })).toBe("stale");
    expect(sourceFreshness({ ...snapshot.sources[0], error: "Échec" })).toBe("error");
    expect(publicationNeedsCheck(snapshot.posts[1])).toBe(true);
    expect(publicationNeedsCheck(snapshot.posts[0])).toBe(false);
    expect(snapshot.posts[1].status).toBe("scheduled");
  });
  it("creates complete Monday-to-Sunday periods and crosses year boundaries", () => {
    expect(calendarRange("2026-10-15", "week")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    const month = calendarRange("2026-10-15", "month");
    expect(month[0]).toBe("2026-09-28");
    expect(month.at(-1)).toBe("2026-11-01");
    expect(month).toHaveLength(35);
    expect(moveCalendarAnchor("2026-12-31", "month", 1)).toBe("2027-01-01");
    expect(moveCalendarAnchor("2026-10-25", "week", 1)).toBe("2026-11-01");
  });
  it("exports values as CSV text and rejects unsafe publication links", () => {
    const csv = calendarCsv([{ ...snapshot.posts[0], title: '=HYPERLINK("https://bad.test")' }]);
    expect(csv).toContain('"\'=HYPERLINK(""https://bad.test"")"');
    expect(safeCalendarUrl("javascript:alert(1)")).toBeNull();
    expect(safeCalendarUrl("https://secret@example.test/")).toBeNull();
    expect(safeCalendarUrl("https://studio.youtube.com/")).toBe("https://studio.youtube.com/");
  });
});

describe("native publication calendar", () => {
  it("shows dated and undated records, filters by network and content, and retains source dates", async () => {
    await renderCalendar();
    expect(cards()).toHaveLength(3);
    expect(JSON.stringify(renderer.toJSON())).toContain("14 oct. 2026");
    act(() => renderer.root.findAllByType(SelectInput).find(node => node.props.label === "Réseau").props.onChange("youtube"));
    expect(cards()).toHaveLength(1);
    expect(cards()[0].props["data-network"]).toBe("youtube");
    act(() => renderer.root.findByType(TextInput).props.onChange("absent"));
    expect(cards()).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Aucune publication datée pour cette période");
  });
  it("opens the current record and warns about passed schedules without claiming publication", async () => {
    await renderCalendar();
    act(() => cards().find(node => node.props["data-network"] === "youtube").props.onClick({ currentTarget: {} }));
    const detail = renderer.root.findByProps({ "data-dialog": "true" });
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain("L’horaire est passé");
    expect(text).toContain("14 oct. 2026");
    expect(detail.findAllByType("dd")[0].children).toEqual(["Programmé"]);
    expect(detail.findAllByType("a")[0].props.rel).toBe("noopener noreferrer");
  });
  it("refreshes only while visible, cleans up requests and removes cached private records after revoked access", async () => {
    await renderCalendar();
    const signal = apiFetch.mock.calls[0][1].signal;
    document.visibilityState = "hidden";
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    document.visibilityState = "visible";
    apiFetch.mockRejectedValue(Object.assign(new Error("Accès refusé"), { status: 403 }));
    await act(async () => { visibilityListeners.forEach(listener => listener()); });
    expect(signal.aborted).toBe(true);
    expect(cards()).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Accès refusé");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Un call. Une décision.");
    act(() => renderer.unmount());
    expect(visibilityListeners.size).toBe(0);
  });
  it("keeps the last snapshot on a temporary server failure and allows retry", async () => {
    await renderCalendar();
    apiFetch.mockRejectedValue(new Error("Indisponible"));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(cards()).toHaveLength(3);
    expect(JSON.stringify(renderer.toJSON())).toContain("Les dernières données reçues restent affichées.");
    apiFetch.mockResolvedValue({ ...snapshot, posts: [] });
    await act(async () => { renderer.root.findAllByType("button").find(node => node.children.includes("Actualiser")).props.onClick(); });
    expect(cards()).toHaveLength(0);
  });
  it("ignores late results from an interrupted request", async () => {
    let finish;
    apiFetch.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await renderCalendar();
    await act(async () => { visibilityListeners.forEach(listener => listener()); });
    expect(cards()).toHaveLength(3);
    await act(async () => { finish({ ...snapshot, posts: [] }); });
    expect(cards()).toHaveLength(3);
  });
});
