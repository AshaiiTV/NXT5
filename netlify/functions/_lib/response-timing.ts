/**
 * Minimum duration for public responses that must not reveal whether an
 * account exists (registration, password reset). The slow, account-dependent
 * work (e-mail delivery) runs after the response through waitUntil; this floor
 * hides the remaining database differences between both branches.
 */
export const ACCOUNT_PRIVACY_MIN_RESPONSE_MS = 500;

export async function padResponseTime(startedAt: number, minimumMs: number = ACCOUNT_PRIVACY_MIN_RESPONSE_MS): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
}

/** Runs best-effort work after the response when the platform allows it. */
export async function runInBackground(context: unknown, task: Promise<unknown>): Promise<void> {
  const waitUntil = (context as any)?.waitUntil;
  if (typeof waitUntil === 'function') waitUntil.call(context, task);
  else await task;
}
