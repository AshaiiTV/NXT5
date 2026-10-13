import { chromium } from "playwright-core";
import fs from "node:fs";
const T = JSON.parse(fs.readFileSync("texts.json", "utf8"));
const BASE = "http://localhost:5173";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const css = `body{margin:0;background:transparent;font-family:Inter,system-ui,sans-serif}
.cap{display:inline-block;margin:40px;max-width:1240px;padding:24px 40px;border-radius:24px;background:linear-gradient(135deg,rgba(38,50,72,.95),rgba(34,30,66,.95));border:1.5px solid rgba(196,181,253,.5);box-shadow:0 18px 50px rgba(2,6,17,.55);color:#f1f5f9;font-weight:600;font-size:35px;line-height:1.38;text-align:center;letter-spacing:-.005em}
.cap b{background:linear-gradient(105deg,#a5f3fc,#c4b5fd 55%,#f0abfc);-webkit-background-clip:text;color:transparent;font-weight:700}
.step{display:inline-flex;align-items:center;gap:14px;margin:30px;padding:12px 26px 12px 14px;border-radius:999px;background:rgba(11,17,32,.9);border:1.5px solid rgba(103,232,249,.55);box-shadow:0 10px 30px rgba(2,6,17,.5);color:#e2e8f0;font-weight:700;font-size:27px}
.step i{font-style:normal;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:linear-gradient(to right,#22d3ee,#3b82f6,#d946ef);color:#020611;font-size:22px;font-weight:800}`;
async function el(html, out) {
  await p.route("**/__o", r => r.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><head><style>${css}</style></head><body><div id=w style="display:inline-block">${html}</div></body></html>` }));
  await p.goto(BASE + "/__o"); await p.unroute("**/__o");
  await p.evaluate(() => document.fonts.ready);
  await p.locator("#w").screenshot({ path: out, omitBackground: true });
}
for (const [k, v] of Object.entries(T.captions)) await el(`<div class=cap>${v}</div>`, `ov/${k}.png`);
let n = 1; for (const [k, v] of Object.entries(T.steps)) await el(`<div class=step><i>${n++}</i>${v}</div>`, `ov/${k}.png`);
async function card(out, title, sub, extra = "") {
  await p.route("**/__c", r => r.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body style="margin:0;width:1920px;height:1080px;display:grid;place-items:center;background:radial-gradient(ellipse at 85% 0%,rgba(139,92,246,.38),transparent 55%),radial-gradient(ellipse at 0% 100%,rgba(103,232,249,.16),transparent 50%),#0b1120;font-family:Inter,system-ui,sans-serif;color:#f1f5f9">
  <div style="text-align:center;padding:0 80px"><img src="${BASE}/assets/nxt5-wordmark.png?v=3" style="width:440px;filter:drop-shadow(0 0 26px rgba(34,211,238,.4))">
  <h1 style="font-size:78px;margin:34px 0 18px;letter-spacing:-.02em;background:linear-gradient(105deg,#a5f3fc,#c4b5fd 55%,#f0abfc);-webkit-background-clip:text;color:transparent">${title}</h1>
  <p style="font-size:34px;color:#cbd5e1;margin:0;font-weight:500">${sub}</p>${extra}</div></body></html>` }));
  await p.goto(BASE + "/__c"); await p.unroute("**/__c"); await p.waitForTimeout(400);
  await p.screenshot({ path: out });
}
await card("ov/intro.png", "Découvrir NXT5", "Bilan, analyses et débrief pour les équipes League of Legends");
await card("ov/outro.png", "À toi de jouer !", "Essaie la démo ou crée ton espace sur <b style='color:#67e8f9'>nxt5.org</b>", `<p style="margin-top:44px;font-size:24px;letter-spacing:.32em;color:#afbfd3;font-weight:700">JOUE · ANALYSE · RECOMMENCE</p>`);
await b.close();
