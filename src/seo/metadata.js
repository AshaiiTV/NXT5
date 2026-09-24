export const SITE_ORIGIN = "https://nxt5.org";
export const SOCIAL_IMAGE = "/og-nxt5.png";

// Public editorial metadata is shared by the generated HTML and SPA navigation.
// No account, invitation token or search parameter belongs in a canonical URL.
export const PUBLIC_METADATA = {
  "/": {
    title: "NXT5 — Analyse et préparation d’équipe League of Legends",
    description: "NXT5 réunit les outils de travail de ton équipe League of Legends : analyse de parties, débriefs, préparation de draft et planning d’entraînement.",
    label: "Accueil",
  },
  "/fonctionnalites": {
    title: "Outils d’analyse et de coaching League of Legends — NXT5",
    description: "Découvre les outils NXT5 pour les joueurs, coachs et staffs League of Legends : statistiques, chronologie, débriefs, champion pools, draft et planning.",
    label: "Fonctionnalités",
  },
  "/contact": {
    title: "Contacter l’équipe NXT5 — Aide et retours",
    description: "Contacte l’équipe NXT5 pour une question sur la plateforme, une aide technique, un retour produit ou une demande liée à ton compte et tes données.",
    label: "Contact",
  },
  "/reseaux": {
    title: "Communauté et Discord officiel — NXT5",
    description: "Rejoins le Discord officiel de NXT5 pour échanger avec la communauté League of Legends, partager tes retours et trouver de l’aide auprès de l’équipe.",
    label: "Réseaux et communauté",
  },
  "/soutenir": {
    title: "Soutenir le développement de NXT5",
    description: "Découvre comment soutenir NXT5, un projet indépendant dédié à l’analyse de parties et à la préparation des équipes League of Legends.",
    label: "Soutenir NXT5",
  },
  "/mentions-legales": {
    title: "Mentions légales — NXT5",
    description: "Consulte les mentions légales de NXT5 : édition du site, hébergement, propriété intellectuelle et informations de contact.",
    label: "Mentions légales",
  },
  "/confidentialite": {
    title: "Politique de confidentialité — NXT5",
    description: "Comprends quelles données NXT5 utilise, pourquoi elles sont traitées et comment exercer tes droits sur tes informations personnelles.",
    label: "Confidentialité",
  },
  "/cookies": {
    title: "Cookies et préférences de confidentialité — NXT5",
    description: "Retrouve les informations sur les cookies nécessaires et la mesure d’audience facultative de NXT5, ainsi que la gestion de tes préférences.",
    label: "Cookies",
  },
  "/conditions": {
    title: "Conditions générales d’utilisation — NXT5",
    description: "Consulte les conditions d’utilisation de NXT5, les règles d’accès au service et les engagements applicables aux comptes et aux équipes.",
    label: "Conditions d’utilisation",
  },
  "/reglement": {
    title: "Règlement de la communauté — NXT5",
    description: "Prends connaissance des règles de la communauté NXT5 : respect des autres joueurs, usage des espaces d’équipe et signalement des abus.",
    label: "Règlement",
  },
};

const PRIVATE_TITLES = {
  "/connexion": "Connexion — NXT5",
  "/creer-un-compte": "Créer un compte — NXT5",
  "/inscription": "Créer un compte — NXT5",
  "/mot-de-passe-oublie": "Mot de passe oublié — NXT5",
  "/reinitialiser-mot-de-passe": "Réinitialiser le mot de passe — NXT5",
  "/verify-email": "Vérification e-mail — NXT5",
  "/verified": "E-mail vérifié — NXT5",
  "/404": "Page introuvable — NXT5",
};

export function normalizeSeoPath(path = "/") {
  return (path.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/");
}

export function getMetadata(path = "/", { noindex = false, title } = {}) {
  path = normalizeSeoPath(path);
  const entry = PUBLIC_METADATA[path];
  const metadata = {
    path,
    title: entry?.title || PRIVATE_TITLES[path] || title || "Espace équipe — NXT5",
    description: entry?.description || (path === "/404" ? "Cette page NXT5 est introuvable. Reviens à l’accueil pour découvrir les outils d’analyse et de préparation League of Legends." : "Connecte-toi à NXT5 pour retrouver ton équipe, tes parties et tes outils de préparation League of Legends."),
    robots: noindex || !entry ? "noindex, follow" : "index, follow, max-image-preview:large",
    canonical: entry ? `${SITE_ORIGIN}${path}` : null,
    image: `${SITE_ORIGIN}${SOCIAL_IMAGE}`,
    structuredData: null,
  };
  if (entry) {
    metadata.structuredData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization", "@id": `${SITE_ORIGIN}/#organization`, name: "NXT5", url: `${SITE_ORIGIN}/`,
          description: "Projet indépendant d’analyse et de préparation pour les équipes League of Legends.",
          logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/assets/nxt5-logo.png` },
        },
        {
          "@type": "WebSite", "@id": `${SITE_ORIGIN}/#website`, name: "NXT5", url: `${SITE_ORIGIN}/`, inLanguage: "fr-FR",
          publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        },
        {
          "@type": path === "/contact" ? "ContactPage" : "WebPage", "@id": `${metadata.canonical}#webpage`,
          url: metadata.canonical, name: metadata.title, description: metadata.description, inLanguage: "fr-FR",
          isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
          ...(path !== "/" ? { breadcrumb: { "@id": `${metadata.canonical}#breadcrumb` } } : {}),
        },
        ...(path === "/" ? [] : [{
          "@type": "BreadcrumbList", "@id": `${metadata.canonical}#breadcrumb`,
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_ORIGIN}/` },
            { "@type": "ListItem", position: 2, name: entry.label, item: metadata.canonical },
          ],
        }]),
      ],
    };
  }
  return metadata;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function serializeStructuredData(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function metadataTags(metadata) {
  return [
    ["name", "description", metadata.description],
    ["name", "robots", metadata.robots],
    ["property", "og:site_name", "NXT5"],
    ["property", "og:locale", "fr_FR"],
    ["property", "og:type", "website"],
    ["property", "og:title", metadata.title],
    ["property", "og:description", metadata.description],
    ...(metadata.canonical ? [["property", "og:url", metadata.canonical]] : []),
    ["property", "og:image", metadata.image],
    ["property", "og:image:type", "image/png"],
    ["property", "og:image:width", "1200"],
    ["property", "og:image:height", "630"],
    ["property", "og:image:alt", "NXT5 — Analyse de parties et préparation d’équipe League of Legends"],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", metadata.title],
    ["name", "twitter:description", metadata.description],
    ["name", "twitter:image", metadata.image],
    ["name", "twitter:image:alt", "NXT5 — Analyse de parties et préparation d’équipe League of Legends"],
  ];
}

export function renderMetadata(metadata) {
  return [
    `<title>${escapeHtml(metadata.title)}</title>`,
    ...metadataTags(metadata).map(([attribute, key, content]) => `<meta data-nxt5-seo ${attribute}="${key}" content="${escapeHtml(content)}" />`),
    ...(metadata.canonical ? [`<link data-nxt5-seo rel="canonical" href="${escapeHtml(metadata.canonical)}" />`] : []),
    // application/ld+json is inert data, not executable JavaScript; CSP remains strict.
    ...(metadata.structuredData ? [`<script data-nxt5-seo type="application/ld+json">${serializeStructuredData(metadata.structuredData)}</script>`] : []),
  ].join("\n    ");
}

export function applyDocumentMetadata(path, options = {}) {
  const noindex = Boolean(import.meta.env?.NXT5_NOINDEX) || window.location.origin !== SITE_ORIGIN;
  const metadata = getMetadata(path, { ...options, noindex });
  document.title = metadata.title;
  document.head.querySelectorAll("[data-nxt5-seo]").forEach(element => element.remove());
  for (const [attribute, key, content] of metadataTags(metadata)) {
    const element = document.createElement("meta");
    element.setAttribute("data-nxt5-seo", "");
    element.setAttribute(attribute, key);
    element.setAttribute("content", content);
    document.head.append(element);
  }
  if (metadata.canonical) {
    const canonical = document.createElement("link");
    canonical.setAttribute("data-nxt5-seo", "");
    canonical.rel = "canonical";
    canonical.href = metadata.canonical;
    document.head.append(canonical);
  }
  if (metadata.structuredData) {
    const data = document.createElement("script");
    data.setAttribute("data-nxt5-seo", "");
    data.type = "application/ld+json";
    data.textContent = serializeStructuredData(metadata.structuredData);
    document.head.append(data);
  }
}
