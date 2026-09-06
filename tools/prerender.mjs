import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createServer, loadEnv } from "vite";
import { redirectRules, resolveSeoConfig, robotsTxt, sitemapXml, withMetadata } from "./seo-build.mjs";

const config = resolveSeoConfig({ ...loadEnv("production", process.cwd(), "PUBLIC_"), ...process.env });
const outputDir = resolve("dist");
const template = await readFile(resolve(outputDir, "index.html"), "utf8");
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { publicPaths, privatePaths, render } = await server.ssrLoadModule("/src/seo/render.jsx");
  for (const path of [...publicPaths, "/404"]) {
    const html = withMetadata(template, path, config).replace('<div id="root"></div>', () => `<div id="root" data-prerendered="true">${render(path)}</div>`);
    // Flat HTML files match Netlify Pretty URLs without a trailing slash.
    const output = path === "/" ? "index.html" : `${path.slice(1)}.html`;
    const target = resolve(outputDir, output);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html);
  }
  await writeFile(resolve(outputDir, "app-shell.html"), withMetadata(template, "/connexion", config));
  await writeFile(resolve(outputDir, "sitemap.xml"), sitemapXml(publicPaths, config));
  await writeFile(resolve(outputDir, "robots.txt"), robotsTxt(config));
  await writeFile(resolve(outputDir, "_redirects"), redirectRules(publicPaths, privatePaths));
  await writeFile(resolve(outputDir, "_headers"), config.noindex ? "/*\n  X-Robots-Tag: noindex, nofollow\n" : "/app-shell.html\n  X-Robots-Tag: noindex, follow\n/404.html\n  X-Robots-Tag: noindex, follow\n");
  console.log(`SEO: rendered ${publicPaths.length} public pages, 404, private shell, sitemap and routing (${config.noindex ? "noindex preview" : config.origin}).`);
} finally {
  await server.close();
}
