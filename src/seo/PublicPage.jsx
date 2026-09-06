import React from "react";
import { HomeScreen, LEGAL_PAGES, LegalPage, MarketingPage, NotFoundPage } from "../pages/public/PublicPages.jsx";
import { MARKETING_PAGES } from "../pages/public/marketing-content.js";

// Shared by the build and the browser: visitors and crawlers receive the same content.
export function PublicPage({ path }) {
  if (path === "/") return <HomeScreen />;
  if (MARKETING_PAGES[path]) return <MarketingPage path={path} />;
  if (LEGAL_PAGES[path]) return <LegalPage route={{ path }} />;
  return <NotFoundPage />;
}
