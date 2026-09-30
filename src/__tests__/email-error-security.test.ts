import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendNotification, sendPasswordResetEmail } from '../../netlify/functions/_lib/email';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('email provider error privacy', () => {
  it('does not retain provider response data in errors or logs', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-provider-key');
    vi.stubEnv('RESET_EMAIL_FROM', 'NXT5 <no-reply@example.test>');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('private-recipient@example.test recovery-token-secret', { status: 422 })));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let failure: any;
    try {
      await sendPasswordResetEmail({ to: 'recipient@example.test', name: 'Test', resetUrl: 'https://example.test/reset?token=test-token' });
    } catch (error) { failure = error; }
    expect(failure).toMatchObject({ status: 502, code: 'EMAIL_DELIVERY_FAILED', message: 'Envoi e-mail impossible.' });
    expect(log).toHaveBeenCalledExactlyOnceWith('Resend email delivery failed', { status: 422 });
    expect(JSON.stringify(failure)).not.toContain('recovery-token-secret');
    expect(failure.stack).not.toContain('private-recipient');
  });
});


describe('notification provider error privacy', () => {
  it.each(['response', 'network'])('logs only metadata for %s failures', async mode => {
    vi.stubEnv('RESEND_API_KEY', 'test-provider-key');
    vi.stubEnv('RESET_EMAIL_FROM', 'NXT5 <no-reply@example.test>');
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (mode === 'network') throw new Error('private-recipient@example.test secret-token');
      return new Response('private-recipient@example.test secret-token', { status: 422 });
    }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await sendNotification({ to: 'recipient@example.test', subject: 'Review', html: '<p>Review</p>' });
    expect(log).toHaveBeenCalledExactlyOnceWith('[mailer] Notification email failed.', mode === 'response' ? { status: 422 } : { code: 'EMAIL_DELIVERY_FAILED' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-recipient');
  });
});

it('R4-V1 bounds Resend requests and keeps timeout failures ambiguous', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test');
  vi.stubEnv('RESET_EMAIL_FROM', 'test@example.test');
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  const failure = new DOMException('Timed out', 'TimeoutError');
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason));
  })));
  const send = sendPasswordResetEmail({ to: 'test@example.test', name: 'Test', resetUrl: 'https://nxt5.test/reset' });
  controller.abort(failure);
  await expect(send).rejects.toBe(failure);
  expect(timeout).toHaveBeenCalledWith(8_000);
});
