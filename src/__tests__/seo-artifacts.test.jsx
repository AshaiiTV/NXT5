import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publicPaths, privatePaths, dynamicPaths, render } from "../seo/render.jsx";
import { escapeHtml, getMetadata } from "../seo/metadata.js";
import { redirectRules, resolveSeoConfig, robotsHeaders, robotsTxt, sitemapXml, withMetadata } from "../../tools/seo-build.mjs";
import { verifySeoArtifacts } from "../../tools/verify-seo.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryRoot = resolve(tmpdir());
const config = resolveSeoConfig({ CONTEXT: "production" });
const options = { config, publicPaths, privatePaths, dynamicPaths };
const originals = new Map();
const changed = new Set();
let directory;

async function save(file, value) {
  await mkdir(dirname(join(directory, file)), { recursive: true });
  await writeFile(join(directory, file), value);
  originals.set(file, value);
}
async function mutate(file, transform) {
  changed.add(file);
  await writeFile(join(directory, file), transform(originals.get(file)));
}
const descriptionTag = /<meta\b[^>]*name="description"[^>]*>/;
const verify = () => verifySeoArtifacts(directory, options);

beforeAll(async () => {
  directory = await mkdtemp(join(temporaryRoot, "nxt5-seo-artifacts-"));
  const template = (await readFile(join(root, "index.html"), "utf8"))
    .replace("</head>", '<link rel="stylesheet" href="/assets/seo-test.css" /></head>');
  const assets = new Set();
  for (const path of [...publicPaths, "/404"]) {
    const html = withMetadata(template, path, config)
      .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${render(path)}</div>`);
    await save(path === "/" ? "index.html" : `${path.slice(1)}.html`, html);
    for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g)) assets.add(asset);
  }
  for (const asset of assets) {
    const target = join(directory, asset.slice(1));
    await mkdir(dirname(target), { recursive: true });
    if (asset === "/assets/seo-test.css") await writeFile(target, "/* fixture stylesheet */");
    else await copyFile(join(root, "public", asset), target);
  }
  await copyFile(join(root, "public/og-nxt5.png"), join(directory, "og-nxt5.png"));
  await save("app-shell.html", withMetadata(template, "/connexion", config));
  await save("sitemap.xml", sitemapXml(config));
  await save("robots.txt", robotsTxt(config));
  await save("_redirects", redirectRules(privatePaths, dynamicPaths));
  await save("_headers", robotsHeaders(config, privatePaths, dynamicPaths));
});
afterEach(async () => {
  for (const file of changed) await writeFile(join(directory, file), originals.get(file));
  changed.clear();
});
afterAll(async () => {
  if (!directory) return;
  // Delete only the test's own generated directory beneath the OS temp root.
  expect(dirname(resolve(directory))).toBe(temporaryRoot);
  expect(basename(directory).startsWith("nxt5-seo-artifacts-")).toBe(true);
  await rm(directory, { recursive: true, force: true });
});

describe("SEO checks against generated HTML artifacts", () => {
  it("accepts artifacts rendered by the real public components and metadata renderer", async () => {
    await expect(verify()).resolves.toBeUndefined();
  });

  it.each([
    ["missing title", html => html.replace(/<title>[\s\S]*?<\/title>/, ""), /exactly one title/],
    ["incorrect title", html => html.replace(/<title>[\s\S]*?<\/title>/, "<title>Wrong title</title>"), /title matches expected/],
    ["duplicate title", html => html.replace("</head>", "<title>Another title</title></head>"), /exactly one title/],
    ["missing description", html => html.replace(descriptionTag, ""), /exactly one meta description/],
    ["empty description", html => html.replace(descriptionTag, '<meta name="description" content="" />'), /description matches expected/],
    ["incorrect description", html => html.replace(descriptionTag, '<meta name="description" content="Wrong description" />'), /description matches expected/],
    ["duplicate description", html => html.replace("</head>", '<META CONTENT="Duplicate" NAME="description"></head>'), /exactly one meta description/],
    ["description with duplicate content", html => html.replace(descriptionTag, tag => tag.replace("<meta", '<meta content="Wrong description"')), /duplicate content attribute/],
    ["commented-out description", html => html.replace(descriptionTag, tag => `<!--${tag}-->`), /exactly one meta description/],
  ])("rejects %s despite intact canonical, robots and JSON-LD", async (_label, transform, message) => {
    await mutate("index.html", transform);
    await expect(verify()).rejects.toThrow(message);
  });

  it("rejects the audit reproduction that replaces every title and removes every description", async () => {
    for (const file of [...originals.keys()].filter(file => file.endsWith(".html"))) {
      await mutate(file, html => html.replace(/<title>[\s\S]*?<\/title>/, "<title>SAME WRONG TITLE</title>").replace(descriptionTag, ""));
    }
    await expect(verify()).rejects.toThrow("title matches expected metadata");
  });

  it("rejects a public page borrowing another page's title and description", async () => {
    const home = getMetadata("/");
    await mutate("fonctionnalites.html", html => html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(home.title)}</title>`)
      .replace(descriptionTag, `<meta name="description" content="${escapeHtml(home.description)}" />`));
    await expect(verify()).rejects.toThrow("/fonctionnalites: title matches expected metadata");
  });

  it.each(["app-shell.html", "404.html"])("checks titles and descriptions in %s too", async file => {
    await mutate(file, html => html.replace(descriptionTag, ""));
    await expect(verify()).rejects.toThrow(`${file}: exactly one meta description`);
  });

  it("reads meta attributes independently of order, case and quote style", async () => {
    const description = escapeHtml(getMetadata("/").description);
    await mutate("index.html", html => html.replace(descriptionTag, `<META CONTENT='${description}' NAME='description'>`));
    await expect(verify()).resolves.toBeUndefined();
  });

  it.each([
    ["unforced", rules => rules.replaceAll("/:splat 301!", "/:splat 301")],
    ["preview wildcard", rules => rules.replaceAll("nxt5.netlify.app/*", "*.netlify.app/*")],
    ["after the fallback", rules => {
      const lines = rules.trim().split("\n");
      return [...lines.filter(line => !/^https?:/.test(line)), ...lines.filter(line => /^https?:/.test(line))].join("\n") + "\n";
    }],
  ])("rejects %s production-domain redirects", async (_label, transform) => {
    await mutate("_redirects", transform);
    await expect(verify()).rejects.toThrow("production alias redirects");
  });
});
