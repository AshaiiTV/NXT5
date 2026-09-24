import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, loadEnv } from "vite";
import { redirectRules, resolveSeoConfig, robotsHeaders, robotsTxt, sitemapXml, withMetadata } from "./seo-build.mjs";
import { verifySeoArtifacts } from "./verify-seo.mjs";

const config = resolveSeoConfig({ ...loadEnv("production", process.cwd(), "PUBLIC_"), ...process.env });
const outputDir = resolve(process.argv[2] || "dist");
const template = await readFile(resolve(outputDir, "index.html"), "utf8");
const server = await createServer({ mode: "production", server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { publicPaths, privatePaths, dynamicPaths, render } = await server.ssrLoadModule("/src/seo/render.jsx");
  for (const path of [...publicPaths, "/404"]) {
    const body = render(path);
    if (!body.includes("<h1")) throw new Error(`No visible h1 in prerendered page ${path}`);
    const html = withMetadata(template, path, config).replace('<div id="root"></div>', () => `<div id="root" data-prerendered="true">${body}</div>`);
    // Flat HTML files use Netlify Pretty URLs, matching the SPA's slashless routes.
    const file = path === "/" ? "index.html" : `${path.slice(1)}.html`;
    await writeFile(resolve(outputDir, file), html);
  }
  await writeFile(resolve(outputDir, "app-shell.html"), withMetadata(template, "/connexion", config));
  await writeFile(resolve(outputDir, "sitemap.xml"), sitemapXml(config));
  await writeFile(resolve(outputDir, "robots.txt"), robotsTxt(config));
  await writeFile(resolve(outputDir, "_redirects"), redirectRules(privatePaths, dynamicPaths));
  await writeFile(resolve(outputDir, "_headers"), robotsHeaders(config, privatePaths, dynamicPaths));
  await verifySeoArtifacts(outputDir, { config, publicPaths, privatePaths, dynamicPaths });
  console.log(`SEO: ${publicPaths.length} pages rendered and verified, true 404, noindex private routes, sitemap and robots (${config.noindex ? "noindex preview" : "production"}).`);
} finally {
  await server.close();
}
