import { createHmac, timingSafeEqual, createPublicKey, verify } from 'node:crypto';
import { getDiscordDeployContext, isDiscordIsolatedContext } from './discord-runtime';

export function discordEnv(name: string): string {
  return String((globalThis as any).Netlify?.env?.get?.(name) ?? process.env[name] ?? '').trim();
}

export function isDiscordId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]{17,20}$/.test(value);
}

export function getDiscordConfig() {
  const applicationId = discordEnv('DISCORD_APPLICATION_ID');
  // Never expose production Discord credentials to preview request paths,
  // including configuration changes, deletion and interaction callbacks.
  const isolatedPreview = isDiscordIsolatedContext();
  const botToken = isolatedPreview ? '' : discordEnv('DISCORD_BOT_TOKEN');
  const publicKey = isolatedPreview ? '' : discordEnv('DISCORD_PUBLIC_KEY');
  const workerSecret = isolatedPreview ? '' : discordEnv('DISCORD_WORKER_SECRET');
  const siteValue = discordEnv('PUBLIC_SITE_URL');
  let siteUrl = '';
  try {
    const parsed = new URL(siteValue);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) siteUrl = parsed.origin;
    if (discordEnv('DISCORD_ENVIRONMENT') === 'test' && ['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.protocol === 'http:') siteUrl = parsed.origin;
  } catch {}
  const environment = discordEnv('DISCORD_ENVIRONMENT') === 'test' ? 'test' : 'production';
  const configured = isDiscordId(applicationId) && Boolean(botToken) && /^[a-f0-9]{64}$/i.test(publicKey) && workerSecret.length >= 32 && Boolean(siteUrl);
  return { applicationId, botToken, publicKey, workerSecret, siteUrl, environment, configured };
}

export function isDiscordEnabled(): boolean {
  const config = getDiscordConfig();
  if (!config.configured || discordEnv('DISCORD_PUBLISHING_ENABLED') !== 'true') return false;
  if (getDiscordDeployContext() === 'production') return true;
  return config.environment === 'test' && discordEnv('DISCORD_LOCAL_PILOT') === 'true'
    && getDiscordDeployContext() === 'dev';
}

export function publicDiscordStatus() {
  const config = getDiscordConfig();
  const issues: string[] = [];
  if (!isDiscordId(config.applicationId)) issues.push('Identifiant de l’application Discord à configurer.');
  if (!config.botToken) issues.push('Jeton du bot à configurer côté serveur.');
  if (!/^[a-f0-9]{64}$/i.test(config.publicKey)) issues.push('Clé publique Discord à configurer.');
  if (config.workerSecret.length < 32) issues.push('Secret de traitement à configurer côté serveur.');
  if (!config.siteUrl) issues.push('Adresse publique NXT5 à configurer.');
  const install = new URL('https://discord.com/oauth2/authorize');
  install.searchParams.set('client_id', config.applicationId);
  install.searchParams.set('scope', 'bot applications.commands');
  // View channel, send messages, embeds, attachments, history. No administrator.
  install.searchParams.set('permissions', String(1024 + 2048 + 16384 + 32768 + 65536));
  install.searchParams.set('integration_type', '0');
  return { configured: config.configured, enabled: isDiscordEnabled(), environment: config.environment, deployContext: getDiscordDeployContext(),
    installUrl: isDiscordId(config.applicationId) ? install.toString() : null, issues };
}

export function signDiscordInternalRequest(body: string): Record<string, string> {
  const { workerSecret } = getDiscordConfig();
  if (workerSecret.length < 32) throw new Error('DISCORD_WORKER_SECRET_MISSING');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', workerSecret).update(timestamp + '.' + body).digest('hex');
  return { 'Content-Type': 'application/json', 'x-nxt5-discord-timestamp': timestamp, 'x-nxt5-discord-signature': signature };
}

export function verifyDiscordInternalRequest(request: Request, body: string): boolean {
  const { workerSecret } = getDiscordConfig();
  const timestamp = request.headers.get('x-nxt5-discord-timestamp') || '';
  const signature = request.headers.get('x-nxt5-discord-signature') || '';
  if (workerSecret.length < 32 || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 120) return false;
  const expected = createHmac('sha256', workerSecret).update(timestamp + '.' + body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export function verifyDiscordInteraction(request: Request, body: string): boolean {
  const { publicKey } = getDiscordConfig();
  const timestamp = request.headers.get('x-signature-timestamp') || '';
  const signature = request.headers.get('x-signature-ed25519') || '';
  if (!/^[a-f0-9]{64}$/i.test(publicKey) || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'hex')]), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, 'hex'));
  } catch { return false; }
}
