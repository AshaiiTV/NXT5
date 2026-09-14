import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('../../netlify/functions/_lib/platform-admin', () => ({ requirePlatformAdmin: requireAdmin }));

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const tokenReply = () => reply({ access_token: 'private-access-token', expires_in: 86399 });
const shopReply = () => reply({ data: { shop: { name: 'NXT5', myshopifyDomain: 'nxt5-test.myshopify.com', currencyCode: 'EUR' } } });

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('Netlify', undefined);
  vi.stubEnv('SHOPIFY_SHOP_DOMAIN', 'nxt5-test.myshopify.com');
  vi.stubEnv('SHOPIFY_CLIENT_ID', 'private-client-id');
  vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'private-client-secret');
  vi.stubEnv('SHOPIFY_API_VERSION', '2026-07');
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Shopify connection boundary', () => {
  it('reports missing configuration without exposing credentials or contacting Shopify', async () => {
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { getShopifyStatus, probeShopifyConnection } = await import('../../netlify/functions/_lib/shopify');
    expect(getShopifyStatus()).toMatchObject({ configured: false, issues: ['SHOPIFY_CLIENT_SECRET manque.'] });
    expect(JSON.stringify(getShopifyStatus())).not.toContain('private-client-id');
    await expect(probeShopifyConnection()).rejects.toMatchObject({ code: 'SHOPIFY_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['https://nxt5.myshopify.com', 'nxt5.myshopify.com.evil.test', 'localhost', 'nxt5.myshopify.com/path', 'user@nxt5.myshopify.com'])('rejects unsafe shop domain %s before sending credentials', async (domain) => {
    vi.stubEnv('SHOPIFY_SHOP_DOMAIN', domain);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { probeShopifyConnection } = await import('../../netlify/functions/_lib/shopify');
    await expect(probeShopifyConnection()).rejects.toMatchObject({ code: 'SHOPIFY_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a server token, reuses it, and returns only shop metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(shopReply()).mockResolvedValueOnce(shopReply());
    vi.stubGlobal('fetch', fetchMock);
    const { probeShopifyConnection } = await import('../../netlify/functions/_lib/shopify');
    const result = await probeShopifyConnection();
    expect(result).toMatchObject({ connected: true, shop: { name: 'NXT5', currency: 'EUR' } });
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(fetchMock.mock.calls[0][0]).toBe('https://nxt5-test.myshopify.com/admin/oauth/access_token');
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
    expect(fetchMock.mock.calls[1][1].headers['X-Shopify-Access-Token']).toBe('private-access-token');
    await probeShopifyConnection();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('renews a revoked token once after a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(reply({}, 401)).mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(shopReply());
    vi.stubGlobal('fetch', fetchMock);
    const { probeShopifyConnection } = await import('../../netlify/functions/_lib/shopify');
    await expect(probeShopifyConnection()).resolves.toMatchObject({ connected: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not mistake GraphQL errors for a successful connection or leak their message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(reply({ errors: [{ message: 'private-upstream-value' }] })));
    const { probeShopifyConnection } = await import('../../netlify/functions/_lib/shopify');
    await expect(probeShopifyConnection()).rejects.toMatchObject({ code: 'SHOPIFY_GRAPHQL_FAILED', message: expect.not.stringContaining('private-upstream-value') });
  });

  it('denies non-admin users before reading config or contacting Shopify', async () => {
    requireAdmin.mockRejectedValue(Object.assign(new Error('Accès refusé'), { status: 403 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { default: handler } = await import('../../netlify/functions/admin-shopify');
    const response = await handler(new Request('https://nxt5.org/.netlify/functions/admin-shopify'), {} as any);
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies a cross-origin connection attempt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: handler } = await import('../../netlify/functions/admin-shopify');
    const response = await handler(new Request('https://nxt5.org/.netlify/functions/admin-shopify', {
      method: 'POST', headers: { Origin: 'https://foreign.test' },
    }), {} as any);
    expect(response.status).toBe(403);
    expect(requireAdmin).not.toHaveBeenCalled();
  });
});
