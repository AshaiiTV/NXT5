// One shared map for the administrator menu, route recognition and page titles.
export const ADMIN_GROUPS = [
  { label: "Pilotage", pages: [
    { id: "overview", path: "/admin", label: "Vue d’ensemble" },
    { id: "teams", path: "/admin/equipes", label: "Équipes" },
    { id: "usage", path: "/admin/usage", label: "Usage du produit" },
    { id: "audience", path: "/admin/frequentation", label: "Fréquentation du site" },
  ] },
  { label: "Bot", pages: [
    { id: "bot-publications", path: "/admin/bot-discord/publications", label: "Publications" },
    { id: "bot", path: "/admin/bot-discord", label: "Statistiques" },
  ] },
  { label: "Ventes et accès", pages: [
    { id: "purchases", path: "/admin/achats", label: "Achats" },
    { id: "requests", path: "/admin/demandes-acces", label: "Demandes d’accès" },
    { id: "subscriptions", path: "/admin/abonnements", label: "Profils et abonnements" },
    { id: "pricing", path: "/admin/tarifs", label: "Offres et tarifs" },
    { id: "launch", path: "/admin/preparer-vente", label: "Préparer la vente" },
  ] },
  { label: "Configuration", pages: [
    { id: "exports", path: "/admin/exports", label: "Exports" },
    { id: "reminders", path: "/admin/rappels", label: "Rappels e-mail" },
    { id: "integrations", path: "/admin/integrations", label: "Intégrations" },
  ] },
];

export const ADMIN_PAGES = ADMIN_GROUPS.flatMap(group => group.pages.map(page => ({ ...page, group: group.label })));

export function adminPageFromRoute({ path = "/admin", search = "" } = {}) {
  const normalized = path.replace(/\/+$/, "") || "/";
  // Keep bookmarked links from the former tabbed administration usable.
  const resolved = normalized === "/tarifs" ? "/admin/tarifs"
    : normalized === "/admin" && new URLSearchParams(search).get("tab") === "achats" ? "/admin/achats"
    : normalized;
  return ADMIN_PAGES.find(page => page.path === resolved);
}
