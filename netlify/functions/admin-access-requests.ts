import type { Config, Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertTrustedMutation, handleError, json, readJson } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { ensureAccessRequestsSchema } from './_lib/schema';
import { invalidAccessRequest, serializeAccessRequest, validateAccessRequestId, validateAccessRequestNote, validateAccessRequestStatus } from './_lib/access-requests';

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    invalidAccessRequest('Pagination invalide.');
  }
  return Number(value);
}

async function listRequests(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = positiveInteger(url.searchParams.get('page'), 1, 1_000_000);
  const pageSize = positiveInteger(url.searchParams.get('pageSize'), 20, 100);
  const status = url.searchParams.get('status') || null;
  if (status !== null) validateAccessRequestStatus(status);
  const offset = (page - 1) * pageSize;
  const [rows, counts, statsRows] = await Promise.all([
    sql`select * from access_requests where (${status}::text is null or status = ${status}) order by created_at desc, id desc limit ${pageSize} offset ${offset}`,
    sql`select count(*)::integer as total from access_requests where (${status}::text is null or status = ${status})`,
    sql`select count(*)::integer as total,
      count(*) filter (where status = 'contacted')::integer as contacted,
      count(*) filter (where status = 'confirmed')::integer as confirmed,
      count(*) filter (where status = 'declined')::integer as declined,
      count(distinct team_key) filter (where status in ('contacted', 'confirmed', 'declined'))::integer as presented_teams,
      count(distinct team_key) filter (where status = 'confirmed' and plan_code <> 'free')::integer as confirmed_teams from access_requests`
  ]);
  const total = Number(counts[0]?.total || 0);
  const stats = statsRows[0] || {};
  return json({
    requests: rows.map(serializeAccessRequest),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    stats: {
      total: Number(stats.total || 0), contacted: Number(stats.contacted || 0), confirmed: Number(stats.confirmed || 0), declined: Number(stats.declined || 0),
      presentedTeams: Number(stats.presented_teams || 0), confirmedTeams: Number(stats.confirmed_teams || 0)
    }
  });
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
      return json({ error: 'Méthode refusée.' }, 405, { Allow: 'GET, POST, DELETE' });
    }
    assertTrustedMutation(request);
    const admin = await requirePlatformAdmin(request, context);
    await ensureAccessRequestsSchema();
    if (request.method === 'GET') return await listRequests(request);
    const body = await readJson(request, 24 * 1024);
    const allowed = request.method === 'DELETE' ? ['id'] : ['id', 'status', 'adminNote'];
    if (Object.keys(body).some(key => !allowed.includes(key))) invalidAccessRequest('Champ de suivi inconnu.');
    const id = validateAccessRequestId(body.id);
    if (request.method === 'DELETE') {
      await sql`delete from access_requests where id = ${id}`;
      return json({ ok: true });
    }
    const status = validateAccessRequestStatus(body.status);
    const adminNote = body.adminNote === undefined ? null : validateAccessRequestNote(body.adminNote);
    const rows = await sql`
      update access_requests set status = ${status}, admin_note = coalesce(${adminNote}, admin_note), updated_by = ${admin.id}, updated_at = now()
      where id = ${id} returning *
    `;
    if (!rows.length) return json({ error: 'Demande introuvable.' }, 404);
    return json({ ok: true, request: serializeAccessRequest(rows[0]) });
  } catch (err) {
    return handleError(err);
  }
}

export const config: Config = { method: ['GET', 'POST', 'DELETE'] };
