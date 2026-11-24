import React from "react";
import { renderToString } from "react-dom/server";
import App from "../App.jsx";
import AppRouter from "../AppRouter.jsx";
import { DemoPage } from "../pages/public/DemoPage.jsx";
import * as HomePage from "../pages/public/HomePage.jsx";
import * as FeaturesPage from "../pages/public/FeaturesPage.jsx";
import * as PublicGuides from "../pages/public/PublicGuides.jsx";
import * as SocialPage from "../pages/public/SocialPage.jsx";
import * as SupportPage from "../pages/public/SupportPage.jsx";
import * as LegalPage from "../pages/public/LegalPage.jsx";
import { PUBLIC_PAGES } from "../app/public-pages.jsx";
import { AUTH_PATHS, NAV, PUBLIC_ROUTES } from "../app/constants.jsx";
import { ADMIN_PAGES } from "../app/admin-navigation.js";
import { DRAFT_DETAIL_IDS } from "../app/trends-navigation.js";
import { PUBLIC_METADATA } from "./metadata.js";
import { DEMO_SECTIONS } from "../app/demo-routes.js";

// The server render cannot wait for React.lazy: hand every public page module
// to its lazy wrapper, as the browser does after preloading before hydration.
PUBLIC_PAGES.home.provide(HomePage);
PUBLIC_PAGES.features.provide(FeaturesPage);
PUBLIC_PAGES.guide.provide(PublicGuides);
PUBLIC_PAGES.social.provide(SocialPage);
PUBLIC_PAGES.support.provide(SupportPage);
PUBLIC_PAGES.legal.provide(LegalPage);

export const publicPaths = Object.keys(PUBLIC_METADATA);
export const privatePaths = [...new Set([
  ...AUTH_PATHS,
  ...PUBLIC_ROUTES.filter(path => !publicPaths.includes(path)),
  ...NAV.map(item => item.path),
  ...ADMIN_PAGES.map(item => item.path),
  ...DRAFT_DETAIL_IDS.map(id => `/tendances/draft/${id}`),
  "/integration", "/statistiques", "/profil", "/mon-profil", "/champion-pool", "/compositions-types", "/draft", "/nexus-rising", "/salle-de-draft",
])];
export const dynamicPaths = ["/profil", "/mon-profil", "/draft", "/demo/partie"];
// Public demo steps (/demo/<section>, /demo/partie/:id[/debrief]) load the SPA shell
// with a noindex header and stay out of the sitemap; only /demo itself is prerendered.
// /demo/partie/* is covered by dynamicPaths. Unknown game ids redirect to /demo in the app.
export const demoShellPaths = [...DEMO_SECTIONS.map((section) => `/demo/${section}`), "/demo/partie"];

export function render(path) {
  if (!publicPaths.includes(path) && path !== "/404") throw new Error(`Public prerender missing for ${path}`);
  return renderToString(<React.StrictMode><App initialApp={AppRouter} initialRoute={{ path, search: "" }} initialDemoPage={path === "/demo" ? DemoPage : undefined} /></React.StrictMode>);
}
