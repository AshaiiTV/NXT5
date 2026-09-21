import crypto from 'node:crypto';

const LEGACY_CODE = /^(?:NXT5|RIFT)-[A-Z0-9]{4,12}$/;
const CURRENT_CODE = /^NXT5-[A-F0-9]{32}$/;
const MAX_INVITE_LENGTH = 2048;

export function makeInviteCode(): string {
  return `NXT5-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

function normalizeCode(value: string): string {
  const code = value.trim().toUpperCase();
  return CURRENT_CODE.test(code) || LEGACY_CODE.test(code) ? code : '';
}

/** Accept complete codes or invitation URLs, never a valid-looking substring. */
export function extractInviteCode(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_INVITE_LENGTH) return '';
  const raw = value.trim();
  const code = normalizeCode(raw);
  if (code) return code;

  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    const candidates = [...url.searchParams.getAll('invite'), ...url.searchParams.getAll('code')];
    if (candidates.length !== 1) return '';
    return normalizeCode(candidates[0]);
  } catch {
    return '';
  }
}
