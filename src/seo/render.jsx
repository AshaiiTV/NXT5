import React from "react";
import { renderToString } from "react-dom/server";
import App from "../App.jsx";
import AppRouter from "../AppRouter.jsx";
import { DemoPage } from "../pages/public/DemoPage.jsx";
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
  if (!publicPaths.includes(path) && path !== "/404") throw new Error(`Public prerender missing for ${path}`);
  return renderToString(<React.StrictMode><App initialApp={AppRouter} initialRoute={{ path, search: "" }} initialDemoPage={path === "/demo" ? DemoPage : undefined} /></React.StrictMode>);
}
