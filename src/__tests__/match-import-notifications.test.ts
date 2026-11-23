import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ emails: vi.fn(), send: vi.fn(), limit: vi.fn() }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: vi.fn() }));
vi.mock('../../netlify/functions/_lib/team-member-emails', () => ({ getTeamMemberEmails: mocks.emails }));
vi.mock('../../netlify/functions/_lib/email', () => ({ sendNotification: mocks.send }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertSubjectRateLimit: mocks.limit }));

import { notifyMatchImport } from '../../netlify/functions/_lib/match-notifications';

const TEAM = '10000000-0000-4000-8000-000000000001';
const notify = () => notifyMatchImport({ siteUrl: 'https://nxt5.example/', teamId: TEAM, matchId: 'match', gameId: 'EUW1_1', actorKey: 'user-1' });
const limited = () => Object.assign(new Error('Trop de tentatives.'), { status: 429, retryAfter: 60 });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.emails.mockResolvedValue(['one@example.test', 'two@example.test']);
  mocks.send.mockResolvedValue(undefined);
  mocks.limit.mockResolvedValue(undefined);
});

describe('match import notification budgets', () => {
  it('checks the importer and team budgets, then sends one e-mail per recipient', async () => {
    await notify();
    expect(mocks.limit.mock.calls).toEqual([
      ['match-notification-account', 'user-1', { limit: 10, windowSeconds: 600 }],
      ['match-notification-team', TEAM, { limit: 20, windowSeconds: 600 }],
    ]);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({ to: 'one@example.test', subject: '[NXT5] Nouveau match importé — EUW1_1' });
    expect(mocks.send.mock.calls[0][0].html).toContain('https://nxt5.example/games');
  });

  it.each(['match-notification-account', 'match-notification-team'])('skips the e-mail silently once %s is exhausted', async (endpoint) => {
    mocks.limit.mockImplementation(async (name: string) => { if (name === endpoint) throw limited(); });
    await expect(notify()).resolves.toBeUndefined();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not consume a budget when nobody wants the e-mail', async () => {
    mocks.emails.mockResolvedValue([]);
    await notify();
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('reports a limiter outage to the caller, which only logs it after the import', async () => {
    mocks.limit.mockRejectedValue(Object.assign(new Error('Protection anti-abus temporairement indisponible.'), { status: 503 }));
    await expect(notify()).rejects.toMatchObject({ status: 503 });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
