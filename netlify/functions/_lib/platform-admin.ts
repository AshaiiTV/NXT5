import type { Context } from '@netlify/functions';
import { isPlatformAdmin, normalizeEmail, requireAuth } from './auth';
import type { DbUser } from './types';

function getEnv(name: string): string {
  return (globalThis as any).Netlify?.env?.get?.(name) || process.env[name] || '';
}

/**
 * Platform administration is deliberately configuration-only. There is no
 * database role or client-supplied claim that can grant this permission.
 *
 * When both values are configured, both must match the authenticated account.
 * This makes a stale or inconsistent deployment configuration fail closed.
 */
export function assertPlatformAdmin(user: Partial<DbUser> | null | undefined): void {
  const configuredUserId = getEnv('PLATFORM_ADMIN_USER_ID').trim().toLowerCase();
  const configuredEmail = normalizeEmail(getEnv('PLATFORM_ADMIN_EMAIL'));

  if (!configuredUserId && !configuredEmail) {
    throw Object.assign(new Error('Platform administrator is not configured.'), {
      status: 500,
      code: 'PLATFORM_ADMIN_MISCONFIGURED',
      publicMessage: 'Misconfigured server'
    });
  }

  if (!isPlatformAdmin(user)) {
    throw Object.assign(new Error('Accès administrateur refusé.'), {
      status: 403,
      code: 'PLATFORM_ADMIN_FORBIDDEN',
      publicMessage: 'Accès refusé'
    });
  }
}

export { isPlatformAdmin } from './auth';

export async function requirePlatformAdmin(request: Request, context: Context): Promise<DbUser> {
  const user = await requireAuth(request, context);
  assertPlatformAdmin(user);
  return user;
}
