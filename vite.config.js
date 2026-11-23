import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolveSeoConfig, withMetadata } from "./tools/seo-build.mjs";
import { flatCataloguePlugin } from "./tools/i18n-catalogue-plugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["PUBLIC_", "VITE_SOCIAL_"]);
  const seo = resolveSeoConfig({ ...env, ...process.env });
  return {
  define: { "import.meta.env.NXT5_NOINDEX": JSON.stringify(seo.noindex) },
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react(), flatCataloguePlugin(), {
    name: "nxt5-public-site-metadata",
    transformIndexHtml(html) { return withMetadata(html, "/", seo); },
  }],
  // Each PostgreSQL suite starts its own WASM engine. Bound concurrency so the
  // full verification stays reliable alongside native image rendering on CI.
  test: { include: ["src/**/*.test.{js,jsx,ts,tsx}"], maxWorkers: 2 },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [
          // Keep the React runtime in one shared chunk.
          { name: "vendor-react", test: /[/\\]node_modules[/\\](react|react-dom|scheduler)([/\\]|$)/, priority: 50 },
          // The decorative homepage scene must not inflate the shared app vendor.
          { name: "vendor-three", test: /[/\\]node_modules[/\\]three[/\\]/, priority: 40 },
          { name: "vendor-motion", test: /[/\\]node_modules[/\\]gsap[/\\]/, priority: 40 },
          // Lucide icons: an icon used by a single chunk ships inside that page.
          // Icons shared by several chunks are grouped so that the automatic
          // chunking does not emit dozens of 200-byte icon files.
          { name: "icons-shared", test: /[/\\]node_modules[/\\]lucide-react[/\\]/, minShareCount: 2, priority: 30 },
          { name: "vendor", test: /[/\\]node_modules[/\\](?!lucide-react[/\\])/, priority: 0 },
        ] },
      },
    },
  },
  };
});
