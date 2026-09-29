type LogValue = string | number | boolean | null;

const ERROR_FIELDS = ['name', 'code', 'status', 'riotStatus', 'discordStatus'] as const;
const PRIVATE_FIELDS = new Set([
  'message', 'stack', 'query', 'parameters', 'params', 'detail', 'details',
  'response', 'body', 'request', 'cause', 'error', 'err', 'publicmessage',
  '__proto__', 'constructor', 'prototype'
]);

function readField(source: unknown, key: string): unknown {
  if (!source || typeof source !== 'object') return undefined;
  // A foreign error may expose getters (or be a proxy). Logging must not throw
  // while reading its metadata, nor inspect/stringify any other property.
  try { return (source as Record<string, unknown>)[key]; } catch { return undefined; }
}

function safeErrorField(key: string, value: unknown): value is string | number {
  if (typeof value === 'string' && /[\r\n]/.test(value)) return false;
  if (key === 'name') return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value);
  if (key === 'code') return typeof value === 'string' && /^[A-Z0-9_]{1,80}$/.test(value);
  return typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599;
}

/** Context and extra must be developer-controlled, non-sensitive metadata.
 * Never pass user input, credentials, or a spread of an error as extra.
 * Extra metadata supplies defaults; valid error fields take precedence.
 */
export function logFailure(
  context: string,
  err: unknown,
  extra: Record<string, LogValue> = {},
  level: 'error' | 'warn' = 'error'
): void {
  const metadata: Record<string, LogValue> = {};
  // Runtime validation also protects JS callers and accidental type casts.
  for (const key of Object.keys(extra).slice(0, 20)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key) || PRIVATE_FIELDS.has(key.toLowerCase())) continue;
    const value = readField(extra, key);
    if ((ERROR_FIELDS as readonly string[]).includes(key)) {
      if (safeErrorField(key, value)) metadata[key] = value;
    } else if (value === null || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))
      || (typeof value === 'string' && value.length <= 160 && !/[\r\n\x00-\x1f\x7f]/.test(value))) {
      metadata[key] = value;
    }
  }
  for (const key of ERROR_FIELDS) {
    const value = readField(err, key);
    if (safeErrorField(key, value)) metadata[key] = value;
  }
  // Only this newly constructed flat object reaches the console, never err.
  console[level](context.slice(0, 200), metadata);
}
