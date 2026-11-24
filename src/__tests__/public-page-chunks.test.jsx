import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GUIDE_PATHS, LEGAL_PATHS } from "../app/public-paths.js";
import { PUBLIC_PAGES, publicPageForPath } from "../app/public-pages.jsx";
import { lazyPage } from "../app/lazy-page.jsx";
import { LEGAL_PAGES } from "../pages/public/LegalPage.jsx";
import { PUBLIC_GUIDES } from "../pages/public/PublicGuides.jsx";
import { PUBLIC_METADATA } from "../seo/metadata.js";

describe("lazily loaded public pages", () => {
  it("keeps the router path lists in sync with the page contents", () => {
    expect(LEGAL_PATHS).toEqual(Object.keys(LEGAL_PAGES));
    expect(GUIDE_PATHS).toEqual(Object.keys(PUBLIC_GUIDES));
  });

  it("preloads a page chunk for every prerendered page outside the router and the demo", () => {
    const routerPages = ["/demo"];
    for (const path of Object.keys(PUBLIC_METADATA)) {
      if (routerPages.includes(path)) expect(publicPageForPath(path)).toBeNull();
      else expect(Object.values(PUBLIC_PAGES)).toContain(publicPageForPath(path));
    }
    expect(publicPageForPath("/connexion")).toBeNull();
    expect(publicPageForPath("/404")).toBeNull();
  });

  it("renders synchronously once preloaded, and only downloads once", async () => {
    let downloads = 0;
    const Page = lazyPage(async () => { downloads += 1; return { Named: ({ label }) => <h1>{label}</h1> }; }, module => module.Named);
    await Promise.all([Page.preload(), Page.preload()]);
    expect(downloads).toBe(1);
    expect(renderToString(<Page label="Prêt" />)).toBe("<h1>Prêt</h1>");
  });

  it("retries a failed download on the next preload", async () => {
    let attempts = 0;
    const Page = lazyPage(async () => { attempts += 1; if (attempts === 1) throw new Error("offline"); return { default: () => <p>ok</p> }; });
    await expect(Page.preload()).rejects.toThrow("offline");
    await Page.preload();
    expect(attempts).toBe(2);
    expect(renderToString(<Page />)).toBe("<p>ok</p>");
  });
});
