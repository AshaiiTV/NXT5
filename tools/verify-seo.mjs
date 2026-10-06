import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { escapeHtml, getMetadata, SITE_ORIGIN, SOCIAL_IMAGE } from "../src/seo/metadata.js";

function verifyHtmlMetadata(html, metadata, path) {
  // Inspect emitted tags, not the source registry or strings inside JSON-LD.
  // The renderer owns entity escaping, so its serialized values are the contract.
  const markup = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  const heads = [...markup.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/gi)];
  assert.equal(heads.length, 1, `${path}: one HTML head`);
  const head = heads[0][1];
  const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)];
  assert.equal(titles.length, 1, `${path}: exactly one title in HTML`);
  const title = titles[0][1];
  assert.equal(title, escapeHtml(metadata.title), `${path}: title matches expected metadata`);
  const descriptions = [];
  for (const [tag] of head.matchAll(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    const attributes = new Map();
    for (const match of tag.slice(5, -1).matchAll(/(?:^|\s)([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const name = match[1].toLowerCase();
      assert.ok(!attributes.has(name), `${path}: no duplicate ${name} attribute in meta tag`);
      attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
    }
    if (attributes.get("name")?.toLowerCase() === "description") descriptions.push(attributes.get("content"));
  }
  assert.equal(descriptions.length, 1, `${path}: exactly one meta description in HTML`);
  const description = descriptions[0];
  assert.equal(description, escapeHtml(metadata.description), `${path}: description matches expected metadata`);
  return { title, description };
}

// Run against the final Vite output on every build, not an HTML fixture. A broken
// renderer, missing asset or catch-all indexable shell must fail the deployment.
export async function verifySeoArtifacts(outputDir, { config, publicPaths, privatePaths, dynamicPaths }) {
  const titles = new Set();
  const descriptions = new Set();
  for (const path of publicPaths) {
    const file = path === "/" ? "index.html" : `${path.slice(1)}.html`;
    const html = await readFile(resolve(outputDir, file), "utf8");
    const metadata = getMetadata(path, config);
    const { title, description } = verifyHtmlMetadata(html, metadata, path);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path}: one real visible heading`);
    assert.ok(html.includes('data-prerendered="true"'), `${path}: populated initial HTML`);
    assert.ok(html.includes(`data-prerender-path="${path}"`), `${path}: matching initial hydration route`);
    assert.ok(html.includes(`<link data-nxt5-seo rel="canonical" href="${SITE_ORIGIN}${path}"`), `${path}: production canonical`);
    assert.ok(html.includes(`name="robots" content="${metadata.robots}"`), `${path}: indexing policy`);
    assert.ok(html.includes('name="google-site-verification" content="1IQU_9EGP_xoNKTPPPDrNRWHcsSzqQXZlWZOUgIY_TM"'), "Search Console verification preserved");
    assert.ok(html.includes(`property="og:image" content="${SITE_ORIGIN}${SOCIAL_IMAGE}"`), `${path}: social card`);
    assert.ok(!/%PUBLIC_SITE_URL%|nxt5-mark(?:-160)?\.(?:png|webp)/.test(html), `${path}: no unresolved origin or incomplete logo`);
    assert.ok(!titles.has(title), `${path}: unique title in generated HTML`);
    assert.ok(!descriptions.has(description), `${path}: unique description in generated HTML`);
    titles.add(title);
    descriptions.add(description);
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
    if (file === "404.html") assert.ok(html.includes('data-prerender-path="/404"'), "404: matching initial hydration route");
    else assert.ok(!html.includes('data-prerender-path='), "private shell has no public hydration route");
    verifyHtmlMetadata(html, getMetadata(file === "404.html" ? "/404" : "/connexion", config), file);
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
  const rules = redirects.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  assert.deepEqual(rules.slice(0, 2), [
    `https://nxt5.netlify.app/* ${SITE_ORIGIN}/:splat 301!`,
    `http://nxt5.netlify.app/* ${SITE_ORIGIN}/:splat 301!`,
  ], "production alias redirects preserve paths and precede file and SPA rules");
  assert.ok(redirects.endsWith("/* /404.html 404\n"), "unknown URLs are HTTP 404");
  assert.ok(!redirects.includes("/* /index.html 200"), "no indexable homepage fallback");
  for (const path of privatePaths.filter(path => path !== "/inscription")) assert.ok(redirects.includes(`${path} /app-shell.html 200\n`), `${path}: private deep link works`);
  for (const path of dynamicPaths) assert.ok(redirects.includes(`${path}/* /app-shell.html 200\n`), `${path}: private nested link works`);
  const headers = await readFile(resolve(outputDir, "_headers"), "utf8");
  if (config.noindex) assert.equal(headers, "/*\n  X-Robots-Tag: noindex, follow\n", "preview has a site-wide noindex response header");
  else assert.ok(headers.includes("/app-shell.html\n  X-Robots-Tag: noindex, follow"));
}
