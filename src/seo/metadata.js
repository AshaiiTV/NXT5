import { MARKETING_PAGES } from "../pages/public/marketing-content.js";

export const DEFAULT_SITE_URL = "https://nxt5.org";
export const HOME_TITLE = "NXT5 — Analyse League of Legends pour équipes et coachs";
export const HOME_DESCRIPTION = "Analyse tes matchs League of Legends, prépare tes reviews de scrims et organise le champion pool, la draft et le planning de ton équipe avec NXT5.";

export const SEO_PAGES = {
  "/": { title: HOME_TITLE, description: HOME_DESCRIPTION },
  ...Object.fromEntries(Object.entries(MARKETING_PAGES).map(([path, page]) => [path, { title: page.title, description: page.description }])),
  "/contact": { title: "Contact et support NXT5", description: "Contacte NXT5 sur son Discord officiel pour obtenir de l’aide, signaler un problème ou partager tes retours sur l’outil d’équipe League of Legends." },
  "/mentions-legales": { title: "Mentions légales — NXT5", description: "Consulte les informations sur l’éditeur et l’hébergement de NXT5, la propriété intellectuelle et les conditions d’utilisation des éléments Riot Games." },
  "/confidentialite": { title: "Politique de confidentialité — NXT5", description: "Découvre comment NXT5 traite les données de compte, d’équipe et de match, les durées de conservation et les moyens d’exercer tes droits." },
  "/cookies": { title: "Cookies et stockage local — NXT5", description: "Comprends le rôle des cookies de session et du stockage local utilisés par NXT5 pour la connexion, les préférences et le fonctionnement du service." },
  "/conditions": { title: "Conditions générales d’utilisation — NXT5", description: "Consulte les conditions d’utilisation de NXT5 : accès au service, comptes, contenus d’équipe, imports de matchs et responsabilités des utilisateurs." },
  "/reglement": { title: "Règlement de la communauté — NXT5", description: "Retrouve les règles de NXT5 pour protéger les joueurs, les données des équipes, les accès et les espaces de travail collaboratifs." },
};

export const UTILITY_TITLES = {
  "/connexion": "Connexion — NXT5",
  "/creer-un-compte": "Créer un compte — NXT5",
  "/inscription": "Créer un compte — NXT5",
  "/mot-de-passe-oublie": "Mot de passe oublié — NXT5",
  "/reinitialiser-mot-de-passe": "Réinitialiser le mot de passe — NXT5",
  "/verify-email": "Vérification e-mail — NXT5",
  "/verified": "E-mail vérifié — NXT5",
};

export function seoPath(path = "/") {
  return path.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
}

export function getMetadata(path, { origin = DEFAULT_SITE_URL, noindex = false, title } = {}) {
  const normalized = seoPath(path);
  const page = SEO_PAGES[normalized];
  return {
    title: title || page?.title || UTILITY_TITLES[normalized] || "Page introuvable — NXT5",
    description: page?.description || "Connecte-toi à NXT5 pour accéder à ton espace d’équipe League of Legends.",
    canonical: page ? `${origin}${normalized === "/" ? "/" : normalized}` : null,
    robots: noindex || !page ? "noindex, follow" : "index, follow, max-image-preview:large",
    image: `${origin}/og-image.png`,
    structuredData: page ? structuredData(normalized, page, origin) : null,
  };
}

function structuredData(path, page, origin) {
  const url = `${origin}${path}`;
  const website = { "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name: "NXT5", alternateName: "Next Five", inLanguage: "fr", description: HOME_DESCRIPTION };
  const webPage = { "@type": "WebPage", "@id": `${url}#webpage`, url, name: page.title, description: page.description, inLanguage: "fr", isPartOf: { "@id": website["@id"] } };
  return { "@context": "https://schema.org", "@graph": path === "/" ? [website, webPage] : [webPage, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Accueil", item: `${origin}/` }, { "@type": "ListItem", position: 2, name: MARKETING_PAGES[path]?.heading || page.title.replace(/ — NXT5$/, ""), item: url }] }] };
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function serializeStructuredData(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function renderMetadata(meta) {
  const tag = (key, value, attr = "name") => `<meta ${attr}="${key}" content="${escapeHtml(value)}">`;
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    tag("description", meta.description), tag("robots", meta.robots),
    meta.canonical ? `<link rel="canonical" href="${escapeHtml(meta.canonical)}">` : "",
    tag("og:site_name", "NXT5", "property"), tag("og:locale", "fr_FR", "property"),
    tag("og:title", meta.title, "property"), tag("og:description", meta.description, "property"), tag("og:type", "website", "property"),
    meta.canonical ? tag("og:url", meta.canonical, "property") : "",
    tag("og:image", meta.image, "property"), tag("og:image:type", "image/png", "property"),
    tag("og:image:width", "1115", "property"), tag("og:image:height", "350", "property"), tag("og:image:alt", "NXT5 — outil d’équipe League of Legends", "property"),
    tag("twitter:card", "summary_large_image"), tag("twitter:title", meta.title), tag("twitter:description", meta.description), tag("twitter:image", meta.image), tag("twitter:image:alt", "NXT5 — outil d’équipe League of Legends"),
    meta.structuredData ? `<script id="nxt5-structured-data" type="application/ld+json">${serializeStructuredData(meta.structuredData)}</script>` : "",
  ].filter(Boolean).join("\n    ");
}

export function updateDocumentMetadata(path, title) {
  const origin = typeof __PUBLIC_SITE_URL__ === "string" ? __PUBLIC_SITE_URL__ : DEFAULT_SITE_URL;
  const noindex = typeof __SEO_NOINDEX__ === "boolean" ? __SEO_NOINDEX__ : false;
  const meta = getMetadata(path, { origin, noindex, title });
  document.title = meta.title;
  const setMeta = (name, content, attr = "name") => {
    let node = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!content) { node?.remove(); return; }
    if (!node) { node = document.createElement("meta"); node.setAttribute(attr, name); document.head.appendChild(node); }
    node.content = content;
  };
  setMeta("description", meta.description);
  setMeta("robots", meta.robots);
  for (const [key, value] of [["og:title", meta.title], ["og:description", meta.description], ["og:url", meta.canonical], ["og:image", meta.image]]) setMeta(key, value, "property");
  for (const [key, value] of [["twitter:title", meta.title], ["twitter:description", meta.description], ["twitter:image", meta.image]]) setMeta(key, value);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (meta.canonical) {
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = meta.canonical;
  } else canonical?.remove();
  let data = document.getElementById("nxt5-structured-data");
  if (meta.structuredData) {
    if (!data) { data = document.createElement("script"); data.id = "nxt5-structured-data"; data.type = "application/ld+json"; document.head.appendChild(data); }
    data.textContent = serializeStructuredData(meta.structuredData);
  } else data?.remove();
}
