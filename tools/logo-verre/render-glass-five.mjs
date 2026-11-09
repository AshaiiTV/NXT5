// Rend le 5 en verre de l'accueil avec la scène Three.js réelle (src/pages/home/glass-scene.js),
// sur fond transparent, à 4 096 px. Sert de source au favicon et aux icônes.
// Usage : node tools/logo-verre/render-glass-five.mjs [--pose=accueil|face] [--out=fichier.png]
// Sans option : pose de l’accueil, écrite dans public/assets/brand/nxt5-5-verre-4096.png (source du favicon).
// Navigateur : Chromium de Playwright (ou NXT5_CHROMIUM=/chemin/vers/chromium).
//
// La scène n'est pas modifiée. Seuls deux réglages du banc de rendu diffèrent :
// - le plafond de résolution (GLASS_QUALITY) est relevé pour atteindre 4 096 px ;
// - la pose peut être imposée (« face » : 5 de face ; « accueil » : pose de repos de l'accueil).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const pose = arg("pose", "accueil");
const out = path.resolve(root, arg("out", pose === "accueil" ? "public/assets/brand/nxt5-5-verre-4096.png" : `artifacts/glass-five-${pose}-4096.png`));
const CSS = 1024, DPR = 4;

const POSES = {
  accueil: null, // pose de repos de getGlassPose (mouvement réduit)
  face: { rotation: [0, 0, 0], position: [0, 0, 0] },
};

const fixture = `
import { createGlassScene } from '/src/pages/home/glass-scene.js';
globalThis.__NXT5_POSE__ = ${JSON.stringify(POSES[pose] ?? null)};
const canvas = document.createElement('canvas');
canvas.style.cssText = 'display:block;width:${CSS}px;height:${CSS}px';
document.body.append(canvas);
createGlassScene({ canvas, onReady: () => { window.__ready = true; }, onError: (e) => { window.__error = String(e && e.message || e); } });
`;

const server = await createServer({
  root,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, open: false, hmr: false },
  plugins: [{
    name: "glass-five-render",
    enforce: "pre",
    resolveId(id) { if (id === "/__glass-five.js") return "\0glass-five"; },
    load(id) { if (id === "\0glass-five") return fixture; },
    transform(code, id) {
      if (!id.endsWith("/src/components/brand/glass-motion.js")) return;
      return code
        .replace("maxPixelRatio: 3, maxPixels: 6_000_000", `maxPixelRatio: ${DPR}, maxPixels: ${(CSS * DPR) ** 2}`)
        .replace("export function getGlassPose(", "function baseGlassPose(")
        + "\nexport function getGlassPose(options) { const forced = globalThis.__NXT5_POSE__; return forced ? { rotation: forced.rotation, position: forced.position } : baseGlassPose(options); }\n";
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__glass-five.html")) return next();
        res.setHeader("Content-Type", "text/html");
        res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html><head><!--seo:start--><!--seo:end--></head><body style="margin:0;background:transparent"><script type="module" src="/__glass-five.js"></script></body></html>'));
      });
    },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    ...(process.env.NXT5_CHROMIUM ? { executablePath: process.env.NXT5_CHROMIUM } : {}),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: CSS, height: CSS }, deviceScaleFactor: DPR, reducedMotion: "reduce" });
  await page.goto(server.resolvedUrls.local[0] + "__glass-five.html");
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180_000 });
  const error = await page.evaluate(() => window.__error);
  if (error) throw new Error(`Rendu WebGL impossible : ${error}`);
  await page.waitForTimeout(500);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await page.locator("canvas").screenshot({ path: out, omitBackground: true });
  console.log(`${path.relative(root, out)} (${CSS * DPR} × ${CSS * DPR}, pose ${pose})`);
} finally {
  await browser?.close();
  await server.close();
}
