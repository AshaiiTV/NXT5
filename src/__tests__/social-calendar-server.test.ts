import { beforeEach, describe, expect, it, vi } from 'vitest';
const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: requireAdmin }));
import handler from '../../netlify/functions/social-calendar';
import { sanitizeCalendar } from '../../netlify/functions/_lib/social-calendar';

const post = { id: 'metricool-one', source: 'metricool', network: 'instagram', title: 'Un call.', body: 'Texte éditorial.', format: 'Reel', status: 'scheduled', scheduledAt: '2026-10-16T10:00:00+02:00', verifiedAt: '2026-10-15', url: 'https://www.instagram.com/p/example/', plannerUrl: null, origin: 'Metricool', editable: true };
const payload = { posts: [post], sources: [{ id: 'metricool', label: 'Instagram', mode: 'automatic', lastSuccessAt: '2026-10-15T14:00:00Z', lastAttemptAt: null, error: null, detail: 'Mise à jour cloud.' }] };
const req = (method = 'GET', url = 'https://nxt5.org/.netlify/functions/social-calendar') => new Request(url, { method });
beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); requireAdmin.mockReset().mockResolvedValue({ id: 'owner' }); vi.stubEnv('NXT5_CALENDAR_SITE_TOKEN', 'test-private-service-token'); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('owner-only social calendar bridge', () => {
  it.each([401, 403])('rejects unauthorized accounts before reading private data (%i)', async status => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Accès refusé'), { status }));
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream);
    const response = await handler(req(), {} as any);
    expect(response.status).toBe(status); expect(upstream).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('uses a fixed upstream and never forwards browser cookie, token or target', async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ ...payload, token: 'must-not-leak', privateAccount: { email: 'private@example.com' } })); vi.stubGlobal('fetch', upstream);
    const response = await handler(new Request(req().url + '?url=https://evil.example', { headers: { cookie: 'rb_session=browser-cookie', authorization: 'Bearer attacker' } }), {} as any);
    expect(response.status).toBe(200);
    const [url, options] = upstream.mock.calls[0];
    expect(url).toBe('https://nxt5-publications.ashaii.chatgpt.site/api/calendar');
    expect(options.headers).toEqual({ 'OAI-Sites-Authorization': 'Bearer test-private-service-token', Accept: 'application/json' });
    expect(options.redirect).toBe('error');
    const result = await response.json();
    expect(result.posts[0]).toMatchObject({ status: 'scheduled', verifiedAt: '2026-10-15', editable: false });
    expect(result).not.toHaveProperty('token'); expect(result).not.toHaveProperty('privateAccount');
  });
  it('fails closed on missing credentials, upstream auth errors and malformed data', async () => {
    vi.stubEnv('NXT5_CALENDAR_SITE_TOKEN', ''); const upstream = vi.fn(); vi.stubGlobal('fetch', upstream);
    expect((await handler(req(), {} as any)).status).toBe(503); expect(upstream).not.toHaveBeenCalled();
    vi.stubEnv('NXT5_CALENDAR_SITE_TOKEN', 'test-private-service-token');
    upstream.mockResolvedValue(new Response('sensitive upstream error with secret', { status: 403 }));
    const rejected = await handler(req(), {} as any); expect(rejected.status).toBe(503); expect(await rejected.text()).not.toContain('secret');
    upstream.mockResolvedValue(Response.json({ posts: [{ ...post, status: 'made-up' }], sources: [] }));
    expect((await handler(req(), {} as any)).status).toBe(503);
  });
  it('rejects external mutations and strips dangerous links without claiming publication', async () => {
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream);
    expect((await handler(req('POST'), {} as any)).status).toBe(405); expect(requireAdmin).not.toHaveBeenCalled();
    const clean = sanitizeCalendar({ ...payload, posts: [{ ...post, url: 'javascript:alert(1)', plannerUrl: 'https://user:password@example.com' }] });
    expect(clean.posts[0]).toMatchObject({ url: null, plannerUrl: null, status: 'scheduled' });
  });
});
