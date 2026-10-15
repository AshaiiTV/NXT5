const CALENDAR_URL = 'https://nxt5-publications.ashaii.chatgpt.site/api/calendar';
const NETWORKS = new Set(['instagram', 'youtube', 'tiktok', 'linkedin', 'discord', 'x']);
const SOURCES = new Set(['metricool', 'youtube', 'manual']);
const STATUSES = new Set(['scheduled', 'published', 'draft', 'ready', 'needs_check', 'error', 'removed']);

function unavailable(code = 'SOCIAL_CALENDAR_UNAVAILABLE') {
  return Object.assign(new Error('Private publications calendar is unavailable.'), {
    status: 503, code, publicMessage: 'Le calendrier est momentanément indisponible. Réessaie dans un instant.'
  });
}
function getEnv(name: string) {
  return (globalThis as any).Netlify?.env?.get?.(name) || process.env[name] || '';
}
function text(value: unknown, limit: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, limit) : fallback;
}
function date(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
}
function link(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function sanitizeCalendar(payload: unknown) {
  const value = payload as any;
  if (!value || !Array.isArray(value.posts) || !Array.isArray(value.sources) || value.posts.length > 1500 || value.sources.length > 10) throw unavailable();
  const posts = value.posts.map((post: any) => {
    if (!post || !NETWORKS.has(post.network) || !SOURCES.has(post.source) || !STATUSES.has(post.status) || typeof post.id !== 'string' || !post.id || typeof post.title !== 'string') throw unavailable();
    return {
      id: text(post.id, 180), source: post.source, network: post.network,
      title: text(post.title, 250), body: text(post.body, 30000), format: text(post.format, 80, 'Post'),
      status: post.status, scheduledAt: date(post.scheduledAt), url: link(post.url), plannerUrl: link(post.plannerUrl),
      verifiedAt: date(post.verifiedAt), origin: text(post.origin, 1200), editable: false,
    };
  });
  const sources = value.sources.map((source: any) => {
    if (!source || !SOURCES.has(source.id) || !['automatic', 'confirmed', 'manual'].includes(source.mode)) throw unavailable();
    return {
      id: source.id, label: text(source.label, 100), mode: source.mode,
      lastSuccessAt: date(source.lastSuccessAt), lastAttemptAt: date(source.lastAttemptAt),
      error: source.error ? text(source.error, 1000) : null, detail: text(source.detail, 1600),
    };
  });
  return { posts, sources, serverTime: new Date().toISOString() };
}

export async function loadSocialCalendar() {
  const token = String(getEnv('NXT5_CALENDAR_SITE_TOKEN')).trim();
  if (!token || /[\r\n]/.test(token)) throw unavailable('SOCIAL_CALENDAR_MISCONFIGURED');
  try {
    const response = await fetch(CALENDAR_URL, {
      headers: { 'OAI-Sites-Authorization': `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw unavailable();
    if (Number(response.headers.get('content-length') || 0) > 2_000_000) throw unavailable();
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > 2_000_000) throw unavailable();
    return sanitizeCalendar(JSON.parse(raw));
  } catch { throw unavailable(); }
}
