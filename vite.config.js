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
    generateBundle() {
      const publicPaths = ["/", "/contact", "/reseaux", "/mentions-legales", "/confidentialite", "/cookies", "/conditions", "/reglement"];
      const privatePaths = ["/.netlify/", "/admin", "/tarifs", "/connexion", "/creer-un-compte", "/inscription", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/verify-email", "/verified", "/equipes", "/integration", "/statistiques", "/tendances", "/planning", "/draft", "/champion-pool", "/compositions-types", "/rapports", "/mon-profil", "/profil", "/parametres", "/gestion-equipe", "/guide"];
      const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map((path) => `  <url><loc>${xml(publicSiteUrl + path)}</loc></url>`).join("\n")}\n</urlset>\n` });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\n${privatePaths.map((path) => `Disallow: ${path}`).join("\n")}\n\nSitemap: ${publicSiteUrl}/sitemap.xml\n` });
    },
  }],
  test: { include: ["src/**/*.test.{js,jsx,ts,tsx}"] },
  build: {
    // Only fingerprinted build files receive an immutable browser cache.
    assetsDir: "build",
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
