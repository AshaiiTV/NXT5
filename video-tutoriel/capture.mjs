import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = "http://localhost:5173";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, locale: "fr-FR", timezoneId: "Europe/Paris", reducedMotion: "reduce" });
await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = ".nxt5-cookie-banner,.nxt5-cookie-settings,div.fixed.bottom-5.right-4,[class*=cookie]{display:none!important} *{caret-color:transparent!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
await ctx.addInitScript(() => { const hide = () => { for (const el of document.querySelectorAll("p,span,li,small")) { if (/actuellement gratuit|aucun abonnement/i.test(el.textContent) && ![...el.children].some(c => /actuellement gratuit|aucun abonnement/i.test(c.textContent))) el.style.setProperty("display", "none", "important"); } }; document.addEventListener("DOMContentLoaded", () => { hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true, characterData: true }); }); });
const p = await ctx.newPage();
const meta = {};
async function rect(name, loc) { const r = await loc.first().evaluate(e => { const b = e.getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.width, b.height]; }); return r.map(v => v * 1.25); }
async function shot(name, targets = {}, full = true) {
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(600);
  await p.screenshot({ path: `cap/${name}.png`, fullPage: full });
  const m = { h: await p.evaluate(() => document.documentElement.scrollHeight * 1.25) };
  for (const [k, loc] of Object.entries(targets)) m[k] = await rect(k, loc).catch(() => null);
  meta[name] = m; console.log(name, JSON.stringify(m));
}
const H = t => p.getByRole("heading", { name: t });
await p.goto(BASE + "/"); await p.waitForTimeout(3500);
await shot("home", { suite: p.getByText("La suite se joue ensemble"), score: p.getByText("Le score ne raconte pas tout"), cta: p.getByRole("link", { name: /Créer mon espace/ }).or(p.getByRole("button", { name: /Créer mon espace/ })), demo: p.getByText("Essayer la démo") });
await p.goto(BASE + "/demo"); await p.waitForTimeout(2500);
const tabs = { t1: p.getByRole("button", { name: "1. Parties" }), t2: p.getByRole("button", { name: "2. Analyses" }), t3: p.getByRole("button", { name: "3. Débrief" }) };
await shot("demo", { ...tabs, search: p.getByPlaceholder(/Rechercher|Adversaire/), row1: p.locator(".ig-game"), list: p.getByText("Les trois scrims") });
const search = p.getByPlaceholder(/Rechercher|Adversaire/).first();
const Q = "Jinx défaite"; for (let i = 0; i < Q.length; i++) { const s = Q.slice(0, i + 1); if (s.endsWith(" ")) continue; { await search.fill(s); await p.waitForTimeout(500); await p.screenshot({ path: `cap/demo_type${i + 1}.png`, fullPage: true }); } }
meta.demo_jinx = { row1: await rect("r", p.locator(".ig-game")) };
await search.fill(""); await p.waitForTimeout(500);
await p.locator(".ig-game").first().click(); await p.waitForTimeout(1500);
await shot("detail", { ...tabs, gold: p.getByText("Écart d’or final"), stats: p.getByText("Statistiques et joueurs") });
await tabs.t2.click(); await p.waitForTimeout(1500);
await shot("analyses", { ...tabs, chart: p.getByText("Une mesure, partie après partie") });
await tabs.t3.click(); await p.waitForTimeout(1500);
await shot("debrief", { ...tabs, review: p.getByText("Préparer la prochaine séance"), action: p.getByText("L’action pour la prochaine séance") });
await p.goto(BASE + "/fonctionnalites"); await p.waitForTimeout(2500);
await shot("features", { create: p.getByRole("button", { name: "Créer mon espace équipe" }).or(p.getByRole("link", { name: "Créer mon espace équipe" })) });
fs.writeFileSync("cap/meta.json", JSON.stringify(meta, null, 1));
await b.close();
