import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeScreen, LEGAL_PAGES, LegalPage, NotFoundPage } from "../pages/public/PublicPages.jsx";
import { FeaturesPage } from "../pages/public/FeaturesPage.jsx";
import SocialPage from "../pages/public/SocialPage.jsx";
import { SupportPage } from "../pages/public/SupportPage.jsx";
import { AUTH_PATHS, NAV, PUBLIC_ROUTES } from "../app/constants.jsx";
import { ADMIN_PAGES } from "../app/admin-navigation.js";
import { DRAFT_DETAIL_IDS } from "../app/trends-navigation.js";
import { PUBLIC_METADATA } from "./metadata.js";

export const publicPaths = Object.keys(PUBLIC_METADATA);
export const privatePaths = [...new Set([
  ...AUTH_PATHS,
  ...PUBLIC_ROUTES.filter(path => !publicPaths.includes(path)),
  ...NAV.map(item => item.path),
  ...ADMIN_PAGES.map(item => item.path),
  ...DRAFT_DETAIL_IDS.map(id => `/tendances/draft/${id}`),
  "/tarifs", "/integration", "/statistiques", "/profil", "/mon-profil", "/champion-pool", "/compositions-types", "/draft",
])];
export const dynamicPaths = ["/profil", "/mon-profil", "/draft"];

export function render(path) {
  let page;
  if (path === "/") page = <HomeScreen />;
  else if (path === "/fonctionnalites") page = <FeaturesPage />;
  else if (path === "/reseaux") page = <SocialPage />;
  else if (path === "/soutenir") page = <SupportPage />;
  else if (LEGAL_PAGES[path]) page = <LegalPage route={{ path, search: "" }} />;
  else if (path === "/404") page = <NotFoundPage />;
  else throw new Error(`Public prerender missing for ${path}`);
  return renderToStaticMarkup(page);
}
