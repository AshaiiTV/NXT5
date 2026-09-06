import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "PUBLIC_");
  const siteUrl = new URL(process.env.PUBLIC_SITE_URL || env.PUBLIC_SITE_URL || process.env.URL || "https://nxt5.org");
  if (!["https:", "http:"].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password) throw new Error("PUBLIC_SITE_URL must be an HTTP(S) site URL.");
  const publicSiteUrl = siteUrl.origin;
  return {
  plugins: [react(), {
    name: "nxt5-public-site-metadata",
    transformIndexHtml(html) { return html.replaceAll("%PUBLIC_SITE_URL%", publicSiteUrl); },
  }],
  test: { include: ["src/**/*.test.{js,jsx,ts,tsx}"] },
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
