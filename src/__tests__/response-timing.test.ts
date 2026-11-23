import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_PRIVACY_MIN_RESPONSE_MS, padResponseTime, runInBackground } from '../../netlify/functions/_lib/response-timing';

describe('account-privacy response timing', () => {
  it('uses a floor between 400 and 600 ms', () => {
    expect(ACCOUNT_PRIVACY_MIN_RESPONSE_MS).toBeGreaterThanOrEqual(400);
    expect(ACCOUNT_PRIVACY_MIN_RESPONSE_MS).toBeLessThanOrEqual(600);
  });

  it('waits only for the remainder of the minimum duration', async () => {
    const startedAt = Date.now();
    await padResponseTime(startedAt, 60);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(55);
    const late = Date.now() - 1_000;
    const before = Date.now();
    await padResponseTime(late, 60);
    expect(Date.now() - before).toBeLessThan(30);
  });

  it('hands background work to waitUntil, or awaits it without one', async () => {
    const waitUntil = vi.fn();
    const task = Promise.resolve();
    await runInBackground({ waitUntil }, task);
    expect(waitUntil).toHaveBeenCalledWith(task);
    let done = false;
    await runInBackground({}, new Promise<void>(resolve => setTimeout(() => { done = true; resolve(); }, 5)));
    expect(done).toBe(true);
  });
});
