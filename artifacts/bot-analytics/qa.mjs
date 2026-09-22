// Local-only browser verification. Data below is synthetic and never sent to NXT5.
// Run with Vite on 127.0.0.1:4179. Override PLAYWRIGHT_MODULE for another runtime.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "http://127.0.0.1:4179";
const output = path.dirname(fileURLToPath(import.meta.url));
const summary = { publications: 1248, successfulDeliveries: 1582, commands: 86, guilds: 12, failedDeliveries: 17, uncertainDeliveries: 2, connectionTests: 9, successRate: 98.9, connections: 18, activeConnections: 15, pausedConnections: 3, channels: 24, queuedJobs: 4, blockedJobs: 1 };
function fixture(days) {
  const from = new Date(Date.UTC(2026, 8, 22) - (days - 1) * 86400000).toISOString();
  const guilds = Array.from({ length: 12 }, (_, i) => ({ guildId: `${111111111111111111n + BigInt(i)}`, guildName: null, publications: 152 - i * 7, successfulDeliveries: 171 - i * 8, failedDeliveries: i % 3, commands: i ? 4 : 22, lastActivityAt: "2026-09-22T12:20:00Z", teams: [{ teamId: `qa-team-${i}`, teamName: i ? `Équipe ${i + 1}` : "Académie NXT5 — équipe principale", status: i % 4 ? "active" : "paused" }], destinations: [{ channelId: `${211111111111111111n + BigInt(i)}`, channelName: i ? "résultats-games" : "résultats-des-scrims-et-reviews-équipe-principale", teamNames: ["Académie NXT5 — équipe principale"], enabled: true, automatic: true, currentlyConfigured: true, publications: 152, successfulDeliveries: 171, failedDeliveries: 0 }, { channelId: `${311111111111111111n + BigInt(i)}`, channelName: "ancien-salon-games", teamNames: ["Équipe précédente"], enabled: false, automatic: false, currentlyConfigured: false, publications: 3, successfulDeliveries: 5, failedDeliveries: 2 }] }));
  return { schemaReady: true, generatedAt: "2026-09-22T12:30:00Z", period: { days, from, to: "2026-09-22T12:30:00Z", timeZone: "UTC" }, summary, coverage: { commandsFrom: days === 7 ? from : "2026-09-15T12:30:00Z", commandsRetentionDays: 7, commandsPartial: days > 7, deliveriesRetentionDays: 90, notes: ["Les commandes reçues sont conservées 7 jours : les périodes antérieures sont indisponibles et ne correspondent pas à zéro utilisation.", "Les journées sont en UTC et la journée actuelle est partielle."] }, daily: Array.from({ length: days }, (_, i) => ({ date: new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10), publications: i % 7 ? 12 + (i * 17) % 48 : 0, successfulDeliveries: i % 7 ? 13 + (i * 13) % 52 : 0, failedDeliveries: i % 6 ? 0 : 2, commands: i < days - 7 ? null : i === days - 1 ? 0 : 8 + i % 7 })), commands: [{ name: "statut", count: 45, completed: 44, failed: 1, processing: 0 }, { name: "connecter", count: 28, completed: 28, failed: 0, processing: 0 }, { name: "pause", count: 13, completed: 12, failed: 0, processing: 1 }], guilds, recentActivity: [{ id: "qa-delivery-1", kind: "delivery", at: "2026-09-22T12:20:00Z", status: "succeeded", guildId: guilds[0].guildId, teamName: guilds[0].teams[0].teamName, channelName: guilds[0].destinations[0].channelName }, { id: "qa-command-1", kind: "command", commandName: "statut", at: "2026-09-22T12:10:00Z", status: "completed", guildId: guilds[0].guildId }, { id: "qa-test-1", kind: "connection_test", at: "2026-09-22T11:52:00Z", status: "failed", guildId: guilds[1].guildId, teamName: "Équipe 2", channelName: "résultats-games", errorCode: "DISCORD_MISSING_PERMISSION" }] };
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: "reduce" });
const errors = [], unexpectedRequests = [], requests = [], results = [];
let responseMode = "ready";
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) { unexpectedRequests.push(url.href); return route.abort(); }
  if (!url.pathname.startsWith("/.netlify/functions/")) return route.continue();
  requests.push(url.pathname + url.search);
  const name = url.pathname.split("/").at(-1);
  if (name === "auth-me") return route.fulfill({ json: { user: { id: "qa-admin", name: "Compte de vérification locale", email: "qa@example.test", email_verified: true, is_platform_admin: true } } });
  if (name === "admin-discord-analytics") {
    if (responseMode === "loading") return;
    if (responseMode === "error") return route.fulfill({ status: 503, json: { error: "Le serveur est temporairement indisponible." } });
    if (responseMode === "forbidden") return route.fulfill({ status: 403, json: { error: "Accès refusé." } });
    if (responseMode === "schema") return route.fulfill({ json: { schemaReady: false } });
    const report = fixture(Number(url.searchParams.get("days")) || 30);
    if (responseMode === "empty") { report.summary = Object.fromEntries(Object.keys(summary).map(key => [key, key === "successRate" ? null : 0])); report.commands = []; report.guilds = []; report.recentActivity = []; report.daily = report.daily.map(day => ({ ...day, publications: 0, successfulDeliveries: 0, failedDeliveries: 0, commands: day.commands === null ? null : 0 })); }
    return route.fulfill({ json: report });
  }
  unexpectedRequests.push(url.href);
  return route.fulfill({ status: 500, json: { error: "Unexpected local QA endpoint" } });
});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
await page.goto(`${origin}/admin/bot-discord`);
await page.locator(".bot-metric").first().waitFor();
assert.equal(await page.title(), "Statistiques du bot · Administration — NXT5");
assert.equal(await page.locator('nav[aria-label="Rubriques de l’administration"] a[aria-current="page"]').getAttribute("href"), "/admin/bot-discord");

async function inspectLayout(width, phase) {
  const measurements = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const visible = node => { const rect = node.getBoundingClientRect(); return rect.width && rect.height && getComputedStyle(node).visibility !== "hidden"; };
    const controls = [...document.querySelectorAll(".bot-analytics button, .bot-analytics select, .bot-analytics input, .bot-analytics summary")].filter(visible).map(node => { const rect = node.getBoundingClientRect(), css = getComputedStyle(node); return { label: node.getAttribute("aria-label") || node.textContent.trim() || node.type, width: Math.round(rect.width), height: Math.round(rect.height), fontSize: css.fontSize, left: rect.left, right: rect.right }; });
    return { viewportWidth: width, documentWidth: document.documentElement.scrollWidth, controls, overflowing: [...document.querySelectorAll(".bot-analytics *")].filter(node => visible(node) && !node.closest(".bot-table-scroll")).filter(node => { const r = node.getBoundingClientRect(); return r.left < -1 || r.right > width + 1; }).map(node => ({ tag: node.tagName, className: String(node.className), text: node.textContent.slice(0, 100) })) };
  });
  results.push({ width, phase, ...measurements });
  assert.equal(measurements.documentWidth, width, `${width}px global overflow (${phase})`);
  assert.deepEqual(measurements.overflowing, [], `${width}px overflow outside local table (${phase})`);
  assert(measurements.controls.every(control => control.height >= 44), `${width}px control under 44px`);
}

for (const width of [360, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: width < 800 ? 900 : 1080 });
  await page.evaluate(() => { document.querySelectorAll(".bot-analytics details").forEach(node => { node.open = false; }); window.scrollTo(0, 0); });
  await inspectLayout(width, "collapsed");
  await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true });
  await page.screenshot({ path: path.join(output, `overview-${width}.png`) });
  await page.locator(".bot-guild > summary").first().focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".bot-guild").first().getAttribute("open"), "");
  const focus = await page.locator(".bot-guild > summary").first().evaluate(node => ({ color: getComputedStyle(node).outlineColor, width: getComputedStyle(node).outlineWidth }));
  assert.equal(focus.width, "2px");
  await page.getByText("Voir les données quotidiennes", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await inspectLayout(width, "expanded");
  await page.locator(".bot-guild").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, `server-${width}.png`) });
}

// Verify native keyboard controls and route state, with data requests confined to localhost.
await page.setViewportSize({ width: 390, height: 900 });
const period = page.getByLabel("Période des publications");
await period.selectOption("7");
await page.waitForURL("**/admin/bot-discord?days=7");
await page.locator(".bot-metric").first().waitFor();
assert.equal(await period.inputValue(), "7");
const slider = page.getByRole("slider", { name: "Jour du graphique" });
await slider.focus();
const before = await slider.getAttribute("aria-valuetext");
await page.keyboard.press("ArrowLeft");
assert.notEqual(await slider.getAttribute("aria-valuetext"), before);
const search = page.getByRole("searchbox");
await search.fill("ACADEMIE reviews");
assert.equal(await page.locator(".bot-guild").count(), 1);
await search.fill("aucun-serveur");
await page.getByText("Aucun serveur ne correspond à cette recherche.").waitFor();
await page.getByRole("button", { name: "Effacer la recherche" }).focus();
await page.keyboard.press("Enter");
assert.equal(await search.inputValue(), "");
assert.equal(await page.locator(".bot-guild").count(), 10);
await page.getByRole("button", { name: "Suivant", exact: true }).focus();
await page.keyboard.press("Enter");
assert.equal(await page.locator(".bot-guild").count(), 2);

responseMode = "forbidden";
await page.getByRole("button", { name: "Actualiser", exact: true }).click();
await page.getByRole("alert").waitFor();
assert.equal(await page.locator(".bot-metric").count(), 0);
await page.screenshot({ path: path.join(output, "state-forbidden-390.png"), fullPage: true });
for (const state of ["schema", "empty", "error", "loading"]) {
  responseMode = state;
  await page.goto(`${origin}/admin/bot-discord`);
  await page.getByRole("heading", { name: "Statistiques du bot", exact: true }).waitFor();
  if (state === "schema") await page.getByText("Le suivi Discord n’est pas encore disponible").waitFor();
  if (state === "empty") await page.getByText("Aucun serveur relié ni usage enregistré sur cette période.").waitFor();
  if (state === "error") await page.getByRole("alert").waitFor();
  if (state === "loading") await page.getByLabel("Chargement des statistiques du bot").waitFor();
  await inspectLayout(390, state);
  await page.screenshot({ path: path.join(output, `state-${state}-390.png`), fullPage: true });
}
assert.deepEqual(errors, [], "Browser runtime errors");
assert.deepEqual(unexpectedRequests, [], "Unexpected or external requests");
await fs.writeFile(path.join(output, "qa-results.json"), JSON.stringify({ syntheticLocalFixture: true, browser: await browser.version(), errors, unexpectedRequests, requests, results, checks: ["Real administrator shell and navigation", "Responsive 360/390/768/1024/1440", "No global horizontal overflow, including open daily table", "Visible 2px keyboard focus", "Native details Enter", "Daily slider arrow keys", "Period URL navigation", "Server search accent-insensitive", "Pagination Enter", "403 clears administrator data", "Schema, empty, error and loading states"] }, null, 2));
await browser.close();
console.log(`QA passed; screenshots and measurements: ${output}`);
