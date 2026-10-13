import { chromium } from "playwright-core";
import fs from "node:fs";
const bg = "data:image/jpeg;base64," + fs.readFileSync("bg.jpg").toString("base64");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.route("**/__t", r => r.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body style="margin:0;width:1280px;height:720px;overflow:hidden;font-family:Inter,system-ui,sans-serif;background:#0b1120">
<img src="${bg}" style="position:absolute;right:-180px;top:60px;width:980px;border-radius:24px;border:2px solid rgba(196,181,253,.5);transform:perspective(1200px) rotateY(-14deg);box-shadow:0 30px 80px rgba(0,0,0,.6);opacity:.9">
<div style="position:absolute;inset:0;background:linear-gradient(90deg,#0b1120 38%,rgba(11,17,32,.2) 75%,transparent)"></div>
<div style="position:absolute;left:64px;top:70px;width:640px">
<img src="http://localhost:5173/assets/nxt5-wordmark.png?v=3" style="width:300px;filter:drop-shadow(0 0 20px rgba(34,211,238,.45))">
<div style="margin-top:28px;display:inline-block;padding:10px 22px;border-radius:999px;background:linear-gradient(to right,#22d3ee,#3b82f6,#d946ef);color:#020611;font-weight:800;font-size:30px">TUTO EXPRESS</div>
<h1 style="margin:26px 0 0;font-size:84px;line-height:1.02;font-weight:800;color:#f1f5f9;letter-spacing:-.02em">Analyse tes parties <span style="background:linear-gradient(105deg,#a5f3fc,#c4b5fd 55%,#f0abfc);-webkit-background-clip:text;color:transparent">LoL</span> en équipe</h1>
<p style="margin-top:22px;font-size:30px;color:#cbd5e1;font-weight:600">Bilan · Analyses · Débrief</p></div></body></html>` }));
await p.goto("http://localhost:5173/__t"); await p.waitForTimeout(1500);
await p.screenshot({ path: "miniature.jpg", type: "jpeg", quality: 92 });
await b.close();
