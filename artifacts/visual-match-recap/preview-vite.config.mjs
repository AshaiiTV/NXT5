import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import baseConfig from "../../vite.config.js";

const cache = new Map();
const hosts = new Set(["ddragon.leagueoflegends.com", "raw.communitydragon.org"]);
const limit = 5 * 1024 * 1024;

async function publicImage(target) {
  const champion = target.hostname === "ddragon.leagueoflegends.com" && target.pathname.match(/^\/cdn\/[^/]+\/img\/champion\/([A-Za-z0-9]+)\.png$/)?.[1];
  if (champion) {
    try {
      const local = fileURLToPath(new URL(`../../public/assets/home-motion/champions/${champion}-icon.webp`, import.meta.url));
      return { type: "image/webp", body: await readFile(local) };
    } catch { /* This preview only has a subset of portraits stored locally. */ }
  }
  const response = await fetch(target, { redirect: "error", signal: AbortSignal.timeout(12000) });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !/^image\/(png|jpeg|webp|gif)(;|$)/i.test(type) || Number(response.headers.get("content-length") || 0) > limit) throw new Error("Public image unavailable");
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > limit) throw new Error("Public image too large");
  return { type, body };
}

function previewAssets() {
  return {
    name: "visual-recap-preview-assets",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, "http://127.0.0.1");
        if (url.pathname !== "/.netlify/functions/asset-proxy") return next();
        try {
          const target = new URL(url.searchParams.get("url"));
          if (request.method !== "GET" || target.protocol !== "https:" || !hosts.has(target.hostname) || target.username || target.password || target.port || !/\.(png|jpg|jpeg|webp)$/i.test(target.pathname)) throw new Error("Unsupported preview asset");
          if (!cache.has(target.href)) cache.set(target.href, publicImage(target).catch((error) => { cache.delete(target.href); throw error; }));
          const image = await cache.get(target.href);
          response.writeHead(200, { "Content-Type": image.type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" });
          response.end(image.body);
        } catch {
          response.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
          response.end("Image unavailable in local preview");
        }
      });
    },
  };
}

// Local QA only. No account API, cookies, credentials or production proxy changes.
export default defineConfig(async (environment) => {
  const config = typeof baseConfig === "function" ? await baseConfig(environment) : baseConfig;
  return { ...config, plugins: [...(config.plugins || []), previewAssets()], server: { ...config.server, host: "127.0.0.1", port: 5177, strictPort: true } };
});
