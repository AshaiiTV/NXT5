// Compatibility entry point. Pages are split so that each public route and the
// private shell only download what they render:
// - PublicChrome.jsx: header, footer and links shared by every page;
// - AuthPages.jsx: sign-in, registration, password recovery and 404;
// - LegalPage.jsx and HomePage.jsx: lazily loaded by the router.
// Do not re-export the lazy pages here: importing this module must stay cheap.
// Removing this module also changes how the build splits chunks (AuthPages is
// merged into AppRouter): compare dist/ before and after such a change.
export { INFORMATION_GROUPS, LegalLinks, LinkButton, PublicInformationNav, PublicTextLink, SiteHeader } from "./PublicChrome.jsx";
export { AuthPage, ForgotPasswordPage, NotFoundPage, ResetPasswordPage } from "./AuthPages.jsx";
export { LEGAL_VERSION } from "../../../shared/legal.js";
