import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolveSeoConfig, withMetadata } from "./tools/seo-build.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "PUBLIC_");
  const seo = resolveSeoConfig({ ...env, ...process.env });
  return {
  define: { "import.meta.env.NXT5_NOINDEX": JSON.stringify(seo.noindex) },
  plugins: [react(), {
    name: "nxt5-public-site-metadata",
    transformIndexHtml(html) { return withMetadata(html, "/", seo); },
  }],
  // Each PostgreSQL suite starts its own WASM engine. Bound concurrency so the
  // full verification stays reliable alongside native image rendering on CI.
  test: { include: ["src/**/*.test.{js,jsx,ts,tsx}"], maxWorkers: 4 },
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
