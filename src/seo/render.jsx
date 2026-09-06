import React from "react";
import { renderToString } from "react-dom/server";
import { PublicPage } from "./PublicPage.jsx";
import { AUTH_PATHS, NAV, PUBLIC_ROUTES } from "../app/constants.jsx";
import { SEO_PAGES } from "./metadata.js";

export const publicPaths = Object.keys(SEO_PAGES);
export const privatePaths = [...new Set([...AUTH_PATHS, ...PUBLIC_ROUTES, ...NAV.map((item) => item.path), "/profil", "/draft", "/champion-pool", "/compositions-types"])].filter((path) => !SEO_PAGES[path]);
export function render(path) {
  return renderToString(<PublicPage path={path} />);
}
