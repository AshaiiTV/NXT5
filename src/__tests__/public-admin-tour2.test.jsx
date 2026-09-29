import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { RoleIcon } from "../components/brand/BrandAssets.jsx";
import GuidePage from "../pages/GuidePage.jsx";
import AdminDashboard, { ImportChart } from "../pages/admin/AdminDashboard.jsx";
import { PurchaseHistory, PurchaseOverview } from "../pages/admin/Purchases.jsx";
import { LEGAL_PAGES } from "../pages/public/PublicPages.jsx";
import { apiFetch } from "../api/client.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));
const renderers = [];
async function render(element) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
}
afterEach(() => { renderers.splice(0).forEach(r => act(() => r.unmount())); vi.restoreAllMocks(); vi.resetAllMocks(); });
const guide = section => renderToStaticMarkup(<GuidePage route={{ search: `?section=${section}` }} />);

it("E1: keeps role SVGs local, falls back to text, and resets for a different role", async () => {
  const renderer = await render(<RoleIcon role="TOP" />);
  expect(renderer.root.findByType("img").props.src).toBe("/assets/roles/position-top.svg");
  act(() => renderer.root.findByType("img").props.onError());
  expect(renderer.root.findAllByType("img")).toHaveLength(0);
  expect(renderer.root.findByType("span").children).toEqual(["TOP"]);
  act(() => renderer.update(<RoleIcon role="MID" />));
  expect(renderer.root.findByType("img").props.src).toBe("/assets/roles/position-middle.svg");
});

it("E2: describes the actual composition form and filters", () => {
  const html = guide("compositions");
  expect(html).not.toMatch(/Nos drafts|Leurs drafts/);
  expect(html).toContain("un champion par rôle");
  expect(html).toContain("Nommer et enregistrer la composition");
  expect(html).toContain("Toutes, Côté bleu et Côté rouge");
});

it("E3: allows loading before profile creation and uses current navigation labels", () => {
  expect(guide("getting-started")).toContain("créer les profils manquants depuis le fichier avant de confirmer l’import");
  expect(guide("imports-and-games")).toContain("créer les profils manquants depuis le fichier, puis confirmer l’import");
  expect(guide("champion-pool")).toContain("Draft, puis Champions des joueurs");
  expect(guide("planning")).toContain("Entraînement, Match ou Débrief");
});

it("E5/E1: public policies describe current collection, closed requests and remaining direct image sources", () => {
  for (const path of ["/cookies", "/confidentialite"]) {
    const sections = LEGAL_PAGES[path].sections;
    const measurement = sections.find(([title]) => /mesurons|Mesure de fréquentation/.test(title))[1];
    expect(measurement).toContain("Soutenir");
    expect(measurement).toContain("/tarifs");
    expect(measurement).toContain("ces événements ne sont plus émis par le site");
    expect(measurement).not.toMatch(/connexion, (?:consultation des tarifs|demande d’accès)/);
  }
  const privacy = JSON.stringify(LEGAL_PAGES["/confidentialite"]);
  expect(privacy).toContain("formulaire public de demande d’accès est fermé");
  expect(privacy).toContain("CommunityDragon ou Data Dragon");
  expect(privacy).toContain("catalogue des runes Data Dragon passe par le serveur NXT5");
});

it("E7: daily chart dates stay on their UTC day west of UTC", () => {
  const RealDateTimeFormat = Intl.DateTimeFormat;
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locale, options) { return new RealDateTimeFormat(locale, { timeZone: "America/Los_Angeles", ...options }); });
  expect(new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date("2026-09-29"))).toContain("28 sept.");
  const html = renderToStaticMarkup(<ImportChart rows={[{ date: "2026-09-29", matches: 3 }]} />);
  expect(html).not.toContain("28 sept.");
  expect(html.match(/29 sept\. 2026/g)).toHaveLength(4); // Readout, button, both axis ends.
});

it("E8: guide mobile label is 14 px and keeps token colors and 16 px fields", () => {
  const css = readFileSync(new URL("../pages/guide.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.nxt5-guide-mobile-label \{ display: grid;[^}]*font-size: \.875rem/);
  expect(css).toMatch(/\.nxt5-guide-mobile-label select \{[^}]*background: var\(--nxt5-bg\)[^}]*font-size: 1rem/);
});

it.each([undefined, null, {}, "months"])("E10: incomplete monthly arrays show a recoverable error (%j)", async monthly => {
  apiFetch.mockResolvedValueOnce({ totals: {}, monthly });
  const renderer = await render(<PurchaseOverview />);
  expect(renderer.root.findByProps({ role: "alert" }).findByType("p").children.join("")).toContain("d’achats reçues sont incomplètes");
  expect(renderer.root.findAllByProps({ className: "purchase-trend" })).toHaveLength(0);
  apiFetch.mockResolvedValueOnce({ totals: { orders: 0, paid: 0, pending: 0, paidCents: 0, paid30d: 0, paidPrevious30d: 0 }, monthly: [] });
  await act(async () => renderer.root.findAllByType("button").find(b => b.children.join("") === "Réessayer").props.onClick());
  expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  expect(renderer.root.findByProps({ className: "purchase-trend" }).findAllByType("li")).toHaveLength(0);
});

it("E10: history also rejects a non-array instead of crashing", async () => {
  apiFetch.mockResolvedValueOnce({ pagination: {}, purchases: {} });
  const renderer = await render(<PurchaseHistory />);
  expect(renderer.root.findAllByProps({ role: "alert" })).toHaveLength(1);
});


it("C3 displays the weekly activity limitation returned by the API", async () => {
  const weeklyActivityNote = "La série hebdomadaire des comptes actifs repose sur le dernier passage des sessions conservées. Leur réutilisation ou leur suppression modifie les semaines passées : ce n’est pas un historique complet des présences.";
  apiFetch.mockResolvedValue({ weeklyActivityNote });
  const renderer = await render(<AdminDashboard />);
  expect(renderer.root.findAllByType("p").some(p => p.children.join("") === weeklyActivityNote)).toBe(true);
});

it('T3-04 distinguishes OAuth and social email confirmation lifetimes in both policies', () => {
  for (const route of ['/cookies','/confidentialite']) {
    const text = JSON.stringify(LEGAL_PAGES[route]);
    expect(text).toContain('5 min pour les étapes de connexion, 15 min pour la confirmation par e-mail d’une inscription');
    expect(text).not.toMatch(/cinq minutes (au maximum|maximum)|expirent après cinq minutes/);
  }
});
