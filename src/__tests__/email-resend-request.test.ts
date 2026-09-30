import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendNotification, sendPasswordResetEmail } from '../../netlify/functions/_lib/email';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function stubResend() {
  vi.stubEnv('RESEND_API_KEY', 'test-provider-key');
  vi.stubEnv('RESET_EMAIL_FROM', 'NXT5 <no-reply@example.test>');
  const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('shared Resend request', () => {
  it('sends account e-mails with the configured sender and an 8 s timeout', async () => {
    const fetch = stubResend();
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await sendPasswordResetEmail({ to: 'player@example.test', name: 'Test', resetUrl: 'https://nxt5.test/reset?token=t' });
    expect(timeout).toHaveBeenCalledWith(8_000);
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer test-provider-key', 'Content-Type': 'application/json' } });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(options.body));
    expect(Object.keys(body)).toEqual(['from', 'to', 'subject', 'text', 'html']);
    expect(body).toMatchObject({ from: 'NXT5 <no-reply@example.test>', to: 'player@example.test' });
  });

  it('sends team notifications through the same request, without a timeout', async () => {
    const fetch = stubResend();
    await sendNotification({ to: ['a@example.test'], subject: 'Review <prête>', html: '<p>Bonjour</p><p>Suite</p>' });
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options).not.toHaveProperty('signal');
    expect(options.headers).toEqual({ Authorization: 'Bearer test-provider-key', 'Content-Type': 'application/json' });
    const body = JSON.parse(String(options.body));
    expect(Object.keys(body)).toEqual(['from', 'to', 'subject', 'text', 'html']);
    expect(body).toMatchObject({ from: 'NXT5 <no-reply@example.test>', to: ['a@example.test'], subject: 'Review <prête>', text: 'Bonjour\nSuite' });
    expect(body.html).toContain('Review &lt;prête&gt;');
    expect(body.html).toContain('<p>Bonjour</p><p>Suite</p>');
  });

  it('skips team notifications when Resend is not configured or the message is incomplete', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESET_EMAIL_FROM', 'NXT5 <no-reply@example.test>');
    await sendNotification({ to: 'a@example.test', subject: 'Review', html: '<p>x</p>' });
    expect(log).toHaveBeenCalledExactlyOnceWith('[mailer] Notification email not configured.');
    vi.stubEnv('RESEND_API_KEY', 'test-provider-key');
    await sendNotification({ to: 'a@example.test', subject: 'Review', html: '' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
