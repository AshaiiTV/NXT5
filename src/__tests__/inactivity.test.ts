import { describe, expect, it } from 'vitest';
import { INACTIVITY_DAYS, isInactiveSince } from '../../netlify/functions/_lib/engagement';
import { safeUser } from '../../netlify/functions/_lib/auth';

describe('inactivity reminders', () => {
  const now = new Date('2026-09-05T12:00:00.000Z');

  it('starts at exactly 90 elapsed days', () => {
    expect(INACTIVITY_DAYS).toBe(90);
    expect(isInactiveSince('2026-06-07T12:00:00.000Z', now)).toBe(true);
    expect(isInactiveSince('2026-06-07T12:00:00.001Z', now)).toBe(false);
  });

  it('rejects invalid and future activity dates', () => {
    expect(isInactiveSince(null, now)).toBe(false);
    expect(isInactiveSince('not-a-date', now)).toBe(false);
    expect(isInactiveSince('2026-09-06T12:00:00.000Z', now)).toBe(false);
  });

  it('exposes only the notice and preference, never internal tracking dates', () => {
    const user = safeUser({
      id: 'user-1',
      account_name: 'player',
      email: 'player@example.com',
      email_verified: true,
      inactivity_notice_pending: true,
      notif_inactivity: false,
      last_active_at: '2026-01-01T00:00:00.000Z',
      inactivity_email_sent_at: '2026-04-01T00:00:00.000Z'
    });

    expect(user?.inactivity_notice).toEqual({ type: 'welcome_back', inactiveDays: 90 });
    expect(user?.notif_inactivity).toBe(false);
    expect(user).not.toHaveProperty('last_active_at');
    expect(user).not.toHaveProperty('inactivity_email_sent_at');
  });
});
