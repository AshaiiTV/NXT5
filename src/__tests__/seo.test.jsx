import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDocumentMetadata, getMetadata, PUBLIC_METADATA, renderMetadata, serializeStructuredData, SITE_ORIGIN } from "../seo/metadata.js";
import { createSeoDocument } from "./helpers/seo-document.js";
import { dynamicPaths, privatePaths, publicPaths, render } from "../seo/render.jsx";
import { isAppPath, isKnownPath } from "../app/routing.js";
import { redirectRules, resolveSeoConfig, robotsHeaders, robotsTxt, sitemapXml, withMetadata } from "../../tools/seo-build.mjs";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public SEO and real component rendering", () => {
  it("renders the real homepage and features in the public shell, with crawlable links", () => {
    expect(render("/")).toContain('<h1 id="home-title">Comprends tes parties.');
    expect(render("/fonctionnalites")).toContain("<h1>Analyse, coaching et organisation pour ton équipe League of Legends.</h1>");
    expect(render("/")).toContain('href="/fonctionnalites"');
    expect(render("/fonctionnalites")).toContain('href="/creer-un-compte"');
    expect(isKnownPath("/fonctionnalites")).toBe(true);
    expect(isAppPath("/fonctionnalites")).toBe(false);
  });

  it.each(publicPaths)("provides a distinct, populated public page at %s", path => {
    const markup = render(path);
    expect(markup.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    const metadata = getMetadata(path);
    expect(metadata.canonical).toBe(`${SITE_ORIGIN}${path}`);
    expect(metadata.robots).toContain("index, follow");
    expect(metadata.description.length).toBeGreaterThan(80);
    expect(metadata.structuredData["@graph"].some(item => ["WebPage", "ContactPage"].includes(item["@type"]) && item.url === metadata.canonical)).toBe(true);
  });

  it("identifies the official community accounts in organization metadata", () => {
    const metadata = getMetadata("/reseaux");
    expect(metadata.description).toContain("Discord");
    expect(metadata.description).toContain("YouTube");
    const organization = metadata.structuredData["@graph"].find(item => item["@type"] === "Organization");
    expect(organization.sameAs).toEqual([
      "https://discord.gg/esPcQAeNWu",
      "https://www.youtube.com/channel/UC_C-OnOepIO05qfqlcUrMRA",
    ]);
    for (const href of organization.sameAs) expect(render("/reseaux")).toContain(`href="${href}"`);
    expect(renderMetadata(metadata)).toContain(JSON.stringify(organization.sameAs));
  });

  it("keeps configured community profiles identical in rendered pages, browser metadata and build metadata", () => {
    const env = {
      VITE_SOCIAL_YOUTUBE_URL: "https://www.youtube.com/@NXT5-ORG",
      VITE_SOCIAL_INSTAGRAM_URL: "https://www.instagram.com/nxt5org/",
      VITE_SOCIAL_TWITCH_URL: "https://untrusted.example/nxt5org",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const browser = getMetadata("/reseaux").structuredData["@graph"][0].sameAs;
    const config = resolveSeoConfig({ CONTEXT: "production", ...env, SESSION_SECRET: "not-a-public-setting" });
    const built = getMetadata("/reseaux", config).structuredData["@graph"][0].sameAs;
    expect(built).toEqual(browser);
    expect(browser).toEqual(["https://discord.gg/esPcQAeNWu", env.VITE_SOCIAL_INSTAGRAM_URL, env.VITE_SOCIAL_YOUTUBE_URL]);
    for (const href of browser) expect(render("/reseaux")).toContain(`href="${href}"`);
    expect(JSON.stringify(config)).not.toContain("not-a-public-setting");
  });

  it("keeps the French manifest aligned with the homepage and existing install icons", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"));
    expect(manifest.description).toBe(PUBLIC_METADATA["/"].description);
    expect(manifest.lang).toBe("fr");
    for (const size of [192, 512]) {
      const src = `/android-chrome-${size}x${size}.png`;
      expect(manifest.icons).toContainEqual({ src, sizes: `${size}x${size}`, type: "image/png" });
      const bytes = readFileSync(new URL(`../../public${src}`, import.meta.url));
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
    }
  });

  it("strips query, fragment and trailing slash from canonical URLs", () => {
    expect(getMetadata("/fonctionnalites/?utm_source=discord#draft").canonical).toBe(`${SITE_ORIGIN}/fonctionnalites`);
    expect(getMetadata("/?invite=private-token").canonical).toBe(`${SITE_ORIGIN}/`);
  });

  it("replaces metadata on public, private and public navigation without leaking or duplicating it", () => {
    const document = createSeoDocument();
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", { location: new URL(SITE_ORIGIN) });
    const unrelatedMeta = document.createElement("meta");
    unrelatedMeta.setAttribute("name", "theme-color");
    document.head.append(unrelatedMeta);

    const managed = () => document.head.querySelectorAll("[data-nxt5-seo]");
    const canonical = () => managed().filter(element => element.rel === "canonical");
    const structuredData = () => managed().filter(element => element.type === "application/ld+json");
    const meta = name => managed().filter(element => element.getAttribute("name") === name || element.getAttribute("property") === name);

    applyDocumentMetadata("/");
    expect(canonical()).toHaveLength(1);
    expect(canonical()[0].href).toBe(`${SITE_ORIGIN}/`);
    expect(structuredData()).toHaveLength(1);

    applyDocumentMetadata("/profil/champions?invite=private-token");
    expect(document.title).toBe("Espace équipe — NXT5");
    expect(meta("robots")[0].getAttribute("content")).toBe("noindex, follow");
    expect(canonical()).toHaveLength(0);
    expect(structuredData()).toHaveLength(0);
    expect(meta("og:url")).toHaveLength(0);

    applyDocumentMetadata("/fonctionnalites/?utm_source=discord#draft");
    applyDocumentMetadata("/fonctionnalites");
    const expected = getMetadata("/fonctionnalites", { noindex: Boolean(import.meta.env.NXT5_NOINDEX) });
    expect(document.title).toBe(expected.title);
    expect(meta("description")).toHaveLength(1);
    expect(meta("description")[0].getAttribute("content")).toBe(expected.description);
    expect(meta("robots")[0].getAttribute("content")).toBe(expected.robots);
    expect(meta("og:url")).toHaveLength(1);
    expect(meta("og:url")[0].getAttribute("content")).toBe(expected.canonical);
    expect(canonical()).toHaveLength(1);
    expect(canonical()[0].href).toBe(expected.canonical);
    expect(structuredData()).toHaveLength(1);
    expect(JSON.parse(structuredData()[0].textContent)).toEqual(expected.structuredData);
    const keys = managed().map(element => `${element.tagName}:${element.getAttribute("name") || element.getAttribute("property") || element.rel || element.type}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(document.head.children).toContain(unrelatedMeta);
  });

  it.each([...privatePaths, "/profil/champions", "/does-not-exist", "/404"])("keeps private and unknown URLs out of indexing: %s", path => {
    const metadata = getMetadata(path);
    expect(metadata.robots).toBe("noindex, follow");
    expect(metadata.canonical).toBeNull();
    expect(metadata.structuredData).toBeNull();
    expect(renderMetadata(metadata)).not.toContain('property="og:url"');
    expect(sitemapXml({ noindex: false })).not.toContain(`<loc>${SITE_ORIGIN}${path}</loc>`);
  });

  it("keeps previews noindex without changing canonical production URLs", () => {
    for (const CONTEXT of ["deploy-preview", "branch-deploy", "dev"]) {
      const config = resolveSeoConfig({ CONTEXT, URL: "https://preview.netlify.app", DEPLOY_PRIME_URL: "https://preview.netlify.app" });
      const metadata = getMetadata("/fonctionnalites", config);
      expect(metadata.robots).toBe("noindex, follow");
      expect(metadata.canonical).toBe(`${SITE_ORIGIN}/fonctionnalites`);
      expect(sitemapXml(config)).not.toContain("<loc>");
      expect(robotsTxt(config)).not.toContain("Sitemap:");
      expect(robotsHeaders(config, privatePaths, dynamicPaths)).toBe("/*\n  X-Robots-Tag: noindex, follow\n");
    }
    expect(resolveSeoConfig({ CONTEXT: "production" }).noindex).toBe(false);
    expect(() => resolveSeoConfig({ PUBLIC_SITE_URL: "https://preview.netlify.app" })).toThrow("canonical production origin");
  });

  it("has a sitemap consistent with real pages and safe private deep links", () => {
    expect(publicPaths).toEqual(Object.keys(PUBLIC_METADATA));
    const rules = redirectRules(privatePaths, dynamicPaths);
    expect(rules).toContain("/integration /app-shell.html 200");
    expect(rules).toContain("/tendances/draft/compositions /app-shell.html 200");
    expect(rules).toContain("/admin/tarifs /app-shell.html 200");
    expect(rules).toContain("/profil/* /app-shell.html 200");
    expect(rules).toContain("/* /404.html 404\n");
    expect(rules).not.toContain("/* /index.html 200");
    expect(rules).not.toContain("/.netlify/functions/");
    expect(rules).toContain("/guides/importer-premier-scrim.html /guides/importer-premier-scrim 301!");
    expect(rules).not.toContain("/guides/* /app-shell.html");
    expect(isKnownPath("/guides/nonexistent")).toBe(false);
    expect(getMetadata("/guides/nonexistent").robots).toBe("noindex, follow");
    expect(robotsTxt({ noindex: false })).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  it("redirects only the exact production Netlify host before any page rule", () => {
    const rules = redirectRules(privatePaths, dynamicPaths).split("\n").filter(line => line && !line.startsWith("#"));
    const domainRules = rules.filter(line => /^https?:\/\//.test(line));
    expect(domainRules).toEqual([
      "https://nxt5.netlify.app/* https://nxt5.org/:splat 301!",
      "http://nxt5.netlify.app/* https://nxt5.org/:splat 301!",
    ]);
    expect(rules.slice(0, 2)).toEqual(domainRules);
    // A bare splat target leaves all query parameters to Netlify's documented
    // pass-through; no wildcard hostname can capture branch/deploy previews.
    for (const rule of domainRules) {
      const [source, target, status, ...conditions] = rule.split(/\s+/);
      expect(new URL(source).hostname).toBe("nxt5.netlify.app");
      expect(new URL(target).search).toBe("");
      expect(new URL(target).pathname).toBe("/:splat");
      expect(status).toBe("301!");
      expect(conditions).toEqual([]);
    }
    expect(robotsHeaders({ noindex: true }, privatePaths, dynamicPaths)).toBe("/*\n  X-Robots-Tag: noindex, follow\n");
  });

  it("escapes metadata and inert structured data without weakening CSP", () => {
    const metadata = getMetadata("/fonctionnalites");
    const html = renderMetadata({ ...metadata, title: 'Title <&"' });
    expect(html).toContain("Title &lt;&amp;&quot;");
    expect(serializeStructuredData({ text: "</script><script>bad()</script>" })).not.toContain("<");
    expect(() => withMetadata("no marker", "/", {})).toThrow("Missing SEO metadata marker");
    expect(withMetadata("<!--seo:start-->old<!--seo:end-->", "/fonctionnalites", {})).toContain(metadata.description);
  });
});
