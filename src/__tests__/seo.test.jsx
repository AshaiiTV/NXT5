import React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PublicPage } from "../seo/PublicPage.jsx";
import { getMetadata, renderMetadata, SEO_PAGES } from "../seo/metadata.js";
import { privatePaths, publicPaths } from "../seo/render.jsx";
import { isKnownPath, isAppPath } from "../app/routing.js";
import { MARKETING_PAGES } from "../pages/public/marketing-content.js";
import { redirectRules, resolveSeoConfig, robotsTxt, sitemapXml } from "../../tools/seo-build.mjs";

describe("public SEO rendering", () => {
  it.each(Object.keys(SEO_PAGES))("renders %s with readable content and exactly one heading without a browser or a session", (path) => {
    const html = renderToString(<PublicPage path={path} />);
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).toContain('href="/creer-un-compte"');
    expect(html).not.toContain("Chargement NXT5");
    expect(html).not.toContain('href="undefined"');
    expect(isKnownPath(path)).toBe(true);
    expect(isAppPath(path)).toBe(false);
  });

  it("links every marketing page from the homepage and the other guides", () => {
    for (const source of ["/", ...Object.keys(MARKETING_PAGES)]) {
      const html = renderToString(<PublicPage path={source} />);
      for (const target of Object.keys(MARKETING_PAGES).filter((path) => path !== source)) expect(html).toContain(`href="${target}"`);
    }
  });

  it("gives every public page unique metadata and a canonical without tracking parameters", () => {
    const metadata = publicPaths.map((path) => getMetadata(`${path}?utm_source=test#details`));
    expect(new Set(metadata.map((meta) => meta.title)).size).toBe(publicPaths.length);
    expect(new Set(metadata.map((meta) => meta.description)).size).toBe(publicPaths.length);
    metadata.forEach((meta, index) => {
      expect(meta.canonical).toBe(`https://nxt5.org${publicPaths[index]}`);
      expect(meta.robots).toMatch(/^index,/);
      const html = renderMetadata(meta);
      expect(html).toContain('rel="canonical"');
      expect(html).not.toContain("utm_source");
      const json = html.match(/type="application\/ld\+json">(.*?)<\/script>/)[1];
      expect(JSON.parse(json)["@context"]).toBe("https://schema.org");
    });
  });

  it("never indexes private, token or unknown URLs, or advertises them as canonical", () => {
    for (const path of [...privatePaths, "/profil/champions", "/mon-profil/coaching", "/draft/compositions", "/missing", "/reinitialiser-mot-de-passe?token=secret"]) {
      const meta = getMetadata(path);
      expect(meta.robots).toMatch(/^noindex,/);
      expect(meta.canonical).toBeNull();
      expect(meta.structuredData).toBeNull();
      expect(renderMetadata(meta)).not.toContain("secret");
    }
  });
});

describe("SEO deployment artifacts", () => {
  it("routes every app/auth path and nested workspace before the real 404", () => {
    const rules = redirectRules(publicPaths, privatePaths).split("\n");
    for (const path of privatePaths.filter((path) => path !== "/inscription")) expect(rules).toContain(`${path} /app-shell.html 200`);
    for (const prefix of ["/profil", "/mon-profil", "/draft"]) expect(rules).toContain(`${prefix}/* /app-shell.html 200`);
    expect(rules.at(-2)).toBe("/* /404.html 404");
    expect(rules).toContain("/inscription /creer-un-compte 301!");
    expect(rules).not.toContain("/* /index.html 200");
  });

  it("lists only public canonicals in sitemap and leaves noindex HTML crawlable", () => {
    const config = resolveSeoConfig({});
    const xml = sitemapXml(publicPaths, config);
    for (const path of publicPaths) expect(xml).toContain(`<loc>https://nxt5.org${path}</loc>`);
    for (const path of privatePaths) expect(xml).not.toContain(`<loc>https://nxt5.org${path}</loc>`);
    expect(robotsTxt(config)).toContain("Sitemap: https://nxt5.org/sitemap.xml");
    expect(robotsTxt(config)).not.toContain("Disallow: /connexion");
    expect(xml).not.toContain("lastmod");
  });

  it("does not use the Netlify preview URL as canonical and prevents preview indexing", () => {
    const preview = resolveSeoConfig({ CONTEXT: "deploy-preview", URL: "https://preview.netlify.app" });
    expect(preview.origin).toBe("https://nxt5.org");
    expect(getMetadata("/", preview).robots).toMatch(/^noindex/);
    expect(sitemapXml(publicPaths, preview)).not.toContain("<loc>");
    expect(robotsTxt(preview)).not.toContain("Sitemap:");
    expect(getMetadata("/", resolveSeoConfig({ CONTEXT: "production" })).robots).toMatch(/^index,/);
  });

  it("validates the public origin and escapes metadata safely", () => {
    for (const url of ["javascript:alert(1)", "https://user:pass@example.com", "https://example.com/private", "https://example.com/?key=secret"]) expect(() => resolveSeoConfig({ PUBLIC_SITE_URL: url })).toThrow();
    const meta = getMetadata("/", { title: '</title><script>alert("x")</script>' });
    expect(renderMetadata(meta)).not.toContain('<script>alert("x")');
    expect(renderMetadata(meta)).toContain("&lt;/title&gt;");
  });
});
