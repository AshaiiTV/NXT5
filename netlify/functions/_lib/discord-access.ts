import type { Context } from '@netlify/functions';
import { sql } from './db';
import { requireAuth } from './auth';
import { assertTrustedMutation, json } from './http';
import { assertDiscordSchemaReady } from './discord-queue';
import { discordEnv } from './discord-config';

export function discordError(message: string, status = 400, code = 'DISCORD_REQUEST_INVALID') {
  return Object.assign(new Error(message), { status, code });
}
export function uuid(value: unknown, label = 'Identifiant'): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
    throw discordError(label + ' invalide.');
  }
  return value;
}
function assertDiscordMutationEnvironment(request: Request) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && ['deploy-preview', 'branch-deploy'].includes(discordEnv('CONTEXT'))) {
    throw discordError('Les modifications Discord sont désactivées sur les aperçus de déploiement.', 409, 'DISCORD_DEPLOY_PREVIEW_DISABLED');
  }
}
export async function requireDiscordTeam(request: Request, context: Context, teamId: unknown, access: 'read' | 'staff' | 'manage' = 'read') {
  assertTrustedMutation(request);
  assertDiscordMutationEnvironment(request);
  const user = await requireAuth(request, context);
  const id = uuid(teamId, 'Équipe');
  const rows = await sql("select t.*, tm.role from teams t left join team_members tm on tm.team_id=t.id and tm.user_id=$1 where t.id=$2 and (t.owner_id=$1 or tm.user_id=$1)", [user.id, id]);
  const team = rows[0];
  if (!team) throw discordError('Accès à cette équipe refusé.', 403, 'DISCORD_TEAM_FORBIDDEN');
  const owner = team.owner_id === user.id;
  const canManage = owner || ['owner', 'captain'].includes(String(team.role));
  const canPublish = canManage || ['coach', 'assistant', 'analyst', 'manager', 'board'].includes(String(team.role));
  if ((access === 'manage' && !canManage) || (access === 'staff' && !canPublish)) {
    throw discordError('Ton rôle ne permet pas cette action.', 403, 'DISCORD_ROLE_FORBIDDEN');
  }
  await assertDiscordSchemaReady();
  return { user, team, teamId: id, canManage, canPublish };
}
export function discordResponseError(error: any): Response {
  const upstream = error?.name === 'DiscordApiError';
  const sourceStatus = Number(error?.status) || 500;
  const status = upstream && sourceStatus === 401 ? 503 : sourceStatus;
  const message = status >= 500 && !upstream && !String(error?.code || '').startsWith('DISCORD_')
    ? 'La publication Discord est temporairement indisponible.' : error.message || 'Opération Discord impossible.';
  console.error('[discord]', { code: error?.code || 'DISCORD_FAILED', status });
  return json({ error: message, code: error?.code || 'DISCORD_FAILED', ...(error?.retryAfter ? { retryAfter: error.retryAfter } : {}) },
    status, error?.retryAfter ? { 'Retry-After': String(Math.ceil(error.retryAfter)) } : {});
}
export function assertDiscordMethod(request: Request, allowed: string[]) {
  if (!allowed.includes(request.method)) throw discordError('Méthode refusée.', 405, 'METHOD_NOT_ALLOWED');
  assertTrustedMutation(request);
  assertDiscordMutationEnvironment(request);
}
export function auditDiscord(userId: string, teamId: string, action: string, metadata: object = {}) {
  return sql("insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values($1,$2,'team',$3,$4::jsonb)", [userId, action, teamId, JSON.stringify(metadata)]);
}
