import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logFailure } from '../../netlify/functions/_lib/safe-log';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('safe server failure logs', () => {
  it('keeps only metadata from a pg-like error, never its secrets or raw object', () => {
    const secret = 'private-password-token';
    const failure = Object.assign(new Error(`password=${secret}`), {
      code: '23505', status: 503,
      query: `INSERT INTO users VALUES ('${secret}')`,
      parameters: [secret], detail: `Key (${secret}) already exists`,
      request: { authorization: secret }, response: { body: secret }, body: secret,
      cause: new Error(secret), toJSON: vi.fn(() => ({ secret }))
    });
    logFailure('[match-import] test failed.', failure, { stage: 'persist', attempt: 2, retry: false, fallback: null });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('[match-import] test failed.', {
      name: 'Error', code: '23505', status: 503, stage: 'persist', attempt: 2, retry: false, fallback: null
    });
    const args = vi.mocked(console.error).mock.calls[0];
    expect(args).not.toContain(failure);
    expect(JSON.stringify(args)).not.toContain(secret);
    expect(failure.toJSON).not.toHaveBeenCalled();
  });

  it.each(['A', '23505', 'RIOT_RATE_LIMIT', 'A'.repeat(80)])('preserves valid code %s', code => {
    logFailure('failure', { code });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', { code });
  });

  it.each(['', 'lowercase', 'Bearer private-token', 'QUERY\nprivate-value', 'CODE\n', 'A'.repeat(81), 23505, null, { secret: 'private' }])('rejects invalid code %j', code => {
    logFailure('failure', { code });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', {});
  });

  it.each([400, 429, 500, 599])('preserves bounded HTTP and provider statuses: %s', status => {
    logFailure('failure', { status, riotStatus: status, discordStatus: status });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', { status, riotStatus: status, discordStatus: status });
  });

  it.each([200, 399, 600, 400.5, NaN, Infinity, -Infinity, '503', null, { secret: 'private' }])('rejects invalid HTTP and provider statuses: %j', status => {
    logFailure('failure', { status, riotStatus: status, discordStatus: status });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', {});
  });

  it.each([new TypeError('private'), { name: 'DiscordApiError' }])('preserves the bounded error name', failure => {
    logFailure('failure', failure);
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', { name: failure.name });
  });

  it.each(['password=private', 'Error\n', 'E'.repeat(81), { secret: 'private' }])('rejects unbounded or non-identifier names: %j', name => {
    logFailure('failure', { name });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', {});
  });

  it.each([null, undefined, 'private thrown string', 42, true])('does not stringify primitive thrown values: %j', failure => {
    logFailure('failure', failure);
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', {});
  });

  it('never reads sensitive getters and tolerates throwing metadata getters', () => {
    const sensitive = vi.fn(() => { throw new Error('private'); });
    const failure = Object.defineProperties({}, {
      name: { get: () => { throw new Error('private'); } },
      code: { value: 'DB_UNAVAILABLE' },
      message: { get: sensitive }, query: { get: sensitive }, stack: { get: sensitive },
      response: { get: sensitive }, toJSON: { get: sensitive }
    });
    logFailure('failure', failure);
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', { code: 'DB_UNAVAILABLE' });
    expect(sensitive).not.toHaveBeenCalled();
  });

  it('filters private fields, nested objects and invalid reserved metadata even in extra', () => {
    logFailure('failure', null, {
      message: 'private', stack: 'private', query: 'private', parameters: 'private',
      detail: 'private', response: 'private', body: 'private', Message: 'private',
      code: 'private code', status: 200, riotStatus: '429', discordStatus: Infinity,
      name: 'private name', nested: { secret: 'private' }, array: ['private'],
      stage: 'cleanup', retry: true
    } as any);
    expect(console.error).toHaveBeenCalledExactlyOnceWith('failure', { stage: 'cleanup', retry: true });
  });

  it('bounds extra metadata and context, rejecting non-finite numbers and control characters', () => {
    logFailure('x'.repeat(201), null, {
      long: 'x'.repeat(161), multiline: 'line\nline', control: 'line\x00line',
      number: NaN, infinite: Infinity, ['k'.repeat(41)]: true, valid: 'x'.repeat(160)
    });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('x'.repeat(200), { valid: 'x'.repeat(160) });
    logFailure('failure', null, Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`key${i}`, i])));
    expect(Object.keys(vi.mocked(console.error).mock.calls[1][1])).toHaveLength(20);
  });

  it('keeps safe defaults when error fields are invalid, and lets valid fields replace defaults', () => {
    logFailure('failure', { code: 'private value', status: 'private value' }, { code: 'UNEXPECTED_ERROR', status: 500 });
    expect(console.error).toHaveBeenLastCalledWith('failure', { code: 'UNEXPECTED_ERROR', status: 500 });
    logFailure('failure', { code: 'RATE_LIMITED', status: 429 }, { code: 'UNEXPECTED_ERROR', status: 500 });
    expect(console.error).toHaveBeenLastCalledWith('failure', { code: 'RATE_LIMITED', status: 429 });
  });

  it('applies the same privacy rules at warning level', () => {
    logFailure('assistant-chat: AI Gateway unavailable, serving local help.', new Error('private secret'), {}, 'warn');
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('assistant-chat: AI Gateway unavailable, serving local help.', { name: 'Error' });
    expect(console.error).not.toHaveBeenCalled();
  });
});
