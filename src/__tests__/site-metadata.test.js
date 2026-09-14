import { afterEach, describe, expect, it, vi } from "vitest";
import configure from "../../vite.config.js";

afterEach(() => vi.unstubAllEnvs());

describe("public crawl metadata", () => {
  it("uses the configured origin and lists only public content", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://example.test");
    const config = configure({ mode: "test" });
    const plugin = config.plugins.find(item => item.name === "nxt5-public-site-metadata");
    const emitFile = vi.fn();
    plugin.generateBundle.call({ emitFile });
    const files = Object.fromEntries(emitFile.mock.calls.map(([file]) => [file.fileName, file.source]));
    expect(files["sitemap.xml"]).toContain("<loc>https://example.test/contact</loc>");
    expect(files["sitemap.xml"]).not.toMatch(/admin|connexion|profil|tarifs/);
    expect(files["robots.txt"]).toContain("Sitemap: https://example.test/sitemap.xml");
    expect(files["robots.txt"]).toContain("Disallow: /admin");
    expect(config.build.assetsDir).toBe("build");
  });
});
