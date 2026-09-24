import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { getMetadata, SITE_ORIGIN, SOCIAL_IMAGE } from "../src/seo/metadata.js";

// Run against the final Vite output on every build, not an HTML fixture. A broken
// renderer, missing asset or catch-all indexable shell must fail the deployment.
export async function verifySeoArtifacts(outputDir, { config, publicPaths, privatePaths, dynamicPaths }) {
  const titles = new Set();
  const descriptions = new Set();
  for (const path of publicPaths) {
    const file = path === "/" ? "index.html" : `${path.slice(1)}.html`;
    const html = await readFile(resolve(outputDir, file), "utf8");
    const metadata = getMetadata(path, config);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path}: one real visible heading`);
    assert.ok(html.includes('data-prerendered="true"'), `${path}: populated initial HTML`);
    assert.ok(html.includes(`<link data-nxt5-seo rel="canonical" href="${SITE_ORIGIN}${path}"`), `${path}: production canonical`);
    assert.ok(html.includes(`name="robots" content="${metadata.robots}"`), `${path}: indexing policy`);
    assert.ok(html.includes('name="google-site-verification" content="1IQU_9EGP_xoNKTPPPDrNRWHcsSzqQXZlWZOUgIY_TM"'), "Search Console verification preserved");
    assert.ok(html.includes(`property="og:image" content="${SITE_ORIGIN}${SOCIAL_IMAGE}"`), `${path}: social card`);
    assert.ok(!/%PUBLIC_SITE_URL%|nxt5-mark(?:-160)?\.(?:png|webp)/.test(html), `${path}: no unresolved origin or incomplete logo`);
    assert.ok(!titles.has(metadata.title), `${path}: unique title`);
    assert.ok(!descriptions.has(metadata.description), `${path}: unique description`);
    titles.add(metadata.title);
    descriptions.add(metadata.description);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    const data = scripts.filter(([, attributes]) => attributes.includes('type="application/ld+json"'));
    assert.equal(data.length, 1, `${path}: a single structured data graph`);
    assert.deepEqual(JSON.parse(data[0][2]), metadata.structuredData, `${path}: correct structured data`);
    for (const [, attributes, content] of scripts) {
      assert.ok(attributes.includes('src="') || attributes.includes('type="application/ld+json"'), `${path}: no executable inline script under strict CSP`);
      if (attributes.includes('src="')) assert.equal(content.trim(), "");
    }
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g)].map(match => match[1]);
    assert.ok(assets.some(asset => asset.endsWith(".css")), `${path}: CSS linked before JavaScript`);
    for (const asset of new Set(assets)) assert.ok((await stat(resolve(outputDir, `.${asset}`))).isFile(), `${path}: asset ${asset} exists`);
  }
  for (const file of ["app-shell.html", "404.html"]) {
    const html = await readFile(resolve(outputDir, file), "utf8");
    assert.ok(html.includes('name="robots" content="noindex, follow"'), `${file}: noindex in initial HTML`);
    assert.ok(!html.includes('rel="canonical"'), `${file}: no false public canonical`);
    assert.ok(!html.includes('type="application/ld+json"'), `${file}: no public structured data`);
  }
  const image = await readFile(resolve(outputDir, `.${SOCIAL_IMAGE}`));
  assert.equal(image.subarray(1, 4).toString(), "PNG", "PNG social image");
  assert.equal(image.readUInt32BE(16), 1200, "social image width");
  assert.equal(image.readUInt32BE(20), 630, "social image height");
  const sitemap = await readFile(resolve(outputDir, "sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, config.noindex ? [] : publicPaths.map(path => `${SITE_ORIGIN}${path}`), "sitemap includes only canonical public pages");
  const robots = await readFile(resolve(outputDir, "robots.txt"), "utf8");
  assert.equal(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), !config.noindex);
  assert.ok(!robots.includes("Disallow: /connexion"), "noindex pages remain crawlable");
  const redirects = await readFile(resolve(outputDir, "_redirects"), "utf8");
  assert.ok(redirects.endsWith("/* /404.html 404\n"), "unknown URLs are HTTP 404");
  assert.ok(!redirects.includes("/* /index.html 200"), "no indexable homepage fallback");
  for (const path of privatePaths.filter(path => path !== "/inscription")) assert.ok(redirects.includes(`${path} /app-shell.html 200\n`), `${path}: private deep link works`);
  for (const path of dynamicPaths) assert.ok(redirects.includes(`${path}/* /app-shell.html 200\n`), `${path}: private nested link works`);
  const headers = await readFile(resolve(outputDir, "_headers"), "utf8");
  if (config.noindex) assert.equal(headers, "/*\n  X-Robots-Tag: noindex, follow\n", "preview has a site-wide noindex response header");
  else assert.ok(headers.includes("/app-shell.html\n  X-Robots-Tag: noindex, follow"));
}
