/** Explicit, shared allowlist: no identifiers, arbitrary routes, query or tokens. */
const PATHS = new Set([
  '/', '/connexion', '/creer-un-compte', '/inscription', '/tarifs',
  '/mentions-legales', '/confidentialite', '/cookies', '/conditions', '/reglement', '/contact', '/reseaux',
  '/equipes', '/integration', '/statistiques', '/tendances', '/planning', '/draft', '/draft/pool',
  '/draft/compositions', '/champion-pool', '/compositions-types', '/rapports', '/guide',
  '/parametres', '/gestion-equipe', '/bot-discord', '/mon-profil', '/mon-profil/champions', '/mon-profil/pool',
  '/mon-profil/historique', '/mon-profil/coaching', '/profil', '/profil/champions', '/profil/pool',
  '/profil/historique', '/profil/coaching',
]);

export function canonicalAudiencePath(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) return null;
  const path = value.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return PATHS.has(path) ? path : null;
}

/** Campaign labels only: URLs, addresses, UUIDs and long numeric IDs are dropped. */
export function sanitizeCampaignValue(value) {
  if (typeof value !== 'string') return '';
  const clean = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9 _.-]{0,63}$/.test(clean) || /\d{7,}|[a-f0-9]{16,}|[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(clean)) return '';
  return clean;
}
