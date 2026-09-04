import { afterEach, describe, expect, it } from 'vitest';
import { hashPassword, sha256, verifyPassword } from '../../netlify/functions/_lib/auth';
import { assertMethod, assertTrustedMutation, readJson } from '../../netlify/functions/_lib/http';

const originalSiteUrl = process.env.PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.PUBLIC_SITE_URL;
  else process.env.PUBLIC_SITE_URL = originalSiteUrl;
});

describe('mutation origin protection', () => {
  it('rejects browser cross-site mutations', () => {
    const request = new Request('https://nxt5.org/.netlify/functions/teams-delete', {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' }
    });
    expect(() => assertMethod(request, 'POST')).toThrow(/intersite refusée/i);
  });

  it('accepts same-origin and configured production origins', () => {
    process.env.PUBLIC_SITE_URL = 'https://nxt5.org';
    const sameOrigin = new Request('https://nxt5.org/.netlify/functions/teams-update', {
      method: 'POST',
      headers: { Origin: 'https://nxt5.org' }
    });
    const netlifyFunctionOrigin = new Request('https://deploy-preview.netlify.app/.netlify/functions/teams-update', {
      method: 'POST',
      headers: { Origin: 'https://nxt5.org' }
    });
    expect(() => assertTrustedMutation(sameOrigin)).not.toThrow();
    expect(() => assertTrustedMutation(netlifyFunctionOrigin)).not.toThrow();
  });

  it('keeps non-browser clients compatible when Origin metadata is absent', () => {
    const request = new Request('https://nxt5.org/.netlify/functions/matches-import', { method: 'POST' });
    expect(() => assertTrustedMutation(request)).not.toThrow();
  });
});

describe('one-way security tokens', () => {
  it('hashes verification tokens deterministically without retaining the raw token', () => {
    const token = 'email-verification-secret-token';
    const digest = sha256(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(token);
    expect(sha256(token)).toBe(digest);
  });

  it('uses Argon2id for new passwords and verifies them', async () => {
    const password = 'correct horse battery staple';
    const digest = await hashPassword(password);
    expect(digest).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(password, digest)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', digest)).resolves.toBe(false);
  });
});

describe('bounded JSON requests', () => {
  it('rejects declared and actual bodies over the endpoint limit', async () => {
    const declared = new Request('https://nxt5.org/.netlify/functions/test', {
      method: 'POST',
      headers: { 'Content-Length': '100' },
      body: '{}'
    });
    await expect(readJson(declared, 10)).rejects.toMatchObject({ status: 413 });

    const actual = new Request('https://nxt5.org/.netlify/functions/test', {
      method: 'POST',
      body: JSON.stringify({ value: 'x'.repeat(100) })
    });
    await expect(readJson(actual, 10)).rejects.toMatchObject({ status: 413 });
  });
});
