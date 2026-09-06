import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolveSeoConfig, withMetadata } from "./tools/seo-build.mjs";
import { installPreviewRouting } from "./tools/preview-routing.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "PUBLIC_");
  const seoConfig = resolveSeoConfig({ ...env, ...process.env });
  return {
  define: { __PUBLIC_SITE_URL__: JSON.stringify(seoConfig.origin), __SEO_NOINDEX__: JSON.stringify(seoConfig.noindex) },
  plugins: [react(), {
    name: "nxt5-public-site-metadata",
    transformIndexHtml(html, context) { return withMetadata(html, context.originalUrl || "/", seoConfig); },
    configurePreviewServer(server) { installPreviewRouting(server, seoConfig.noindex); },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },
  };
});
