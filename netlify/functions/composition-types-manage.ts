import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureAuditLogsSchema, ensureCompositionTypesSchema } from './_lib/schema';

function cleanText(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

const SLOT_ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalidSlots(): never {
  throw Object.assign(new Error('Les emplacements de la composition sont invalides.'), { status: 400 });
}
function normalizeSlots(value: unknown): Record<string, { playerId: string; poolId: string }> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidSlots();
  return Object.fromEntries(Object.entries(value).map(([role, slot]) => {
    if (!SLOT_ROLES.includes(role)) invalidSlots();
    if (slot === null) return [role, { playerId: '', poolId: '' }];
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)
      || Object.keys(slot).some(key => !['playerId', 'poolId'].includes(key))) invalidSlots();
    const ids = ['playerId', 'poolId'].map(key => {
      const id = slot[key];
      if (id === undefined || id === '') return '';
      if (typeof id !== 'string' || !UUID.test(id)) invalidSlots();
      return id.toLowerCase();
    });
    return [role, { playerId: ids[0], poolId: ids[1] }];
  }));
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await ensureCompositionTypesSchema();
    await ensureAuditLogsSchema();
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const compositionId = cleanText(body.compositionId, 80);
    const title = cleanText(body.title, 120);
    const notes = cleanText(body.notes, 500) || null;
    const tags = Array.isArray(body.tags) ? body.tags.map((tag) => cleanText(tag, 24)).filter(Boolean).slice(0, 6) : [];

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    const allowed = await sql`
      select teams.id, teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    if (!allowed[0]) throw Object.assign(new Error('Tu dois être membre de la team pour gérer les compositions types.'), { status: 403 });
    const role = String(allowed[0].role || '').toLowerCase();
    const canManageAll = allowed[0].owner_id === user.id || ['owner', 'captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(role);

    if (action === 'delete') {
      if (!compositionId) throw Object.assign(new Error('Composition requise.'), { status: 400 });
      const deleted = await sql`
        delete from composition_types
        where id = ${compositionId}
          and team_id = ${teamId}
          and (${canManageAll} or created_by = ${user.id})
        returning *
      `;
      if (!deleted[0]) throw Object.assign(new Error('Composition introuvable ou non autorisée.'), { status: 404 });
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'composition_types.delete', 'composition_types', ${compositionId}, ${JSON.stringify({ teamId, title: deleted[0].title })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!title) throw Object.assign(new Error('Titre requis.'), { status: 400 });
    const slots = normalizeSlots(body.slots);
    const playerIds = [...new Set(Object.values(slots).map(slot => slot.playerId).filter(Boolean))];
    const poolIds = [...new Set(Object.values(slots).map(slot => slot.poolId).filter(Boolean))];
    // References outside this team are never stored. A pick or profile deleted since the
    // composition was saved simply empties its slot instead of blocking every later edit.
    const teamPlayerIds = new Set(playerIds.length
      ? (await sql`select id from players where team_id = ${teamId} and id = any(${playerIds}::uuid[])`).map(row => String(row.id).toLowerCase())
      : []);
    const teamPoolIds = new Set(poolIds.length
      ? (await sql`select id from champion_pool where team_id = ${teamId} and id = any(${poolIds}::uuid[])`).map(row => String(row.id).toLowerCase())
      : []);
    for (const slot of Object.values(slots)) {
      if (slot.playerId && !teamPlayerIds.has(slot.playerId)) slot.playerId = '';
      if (slot.poolId && !teamPoolIds.has(slot.poolId)) slot.poolId = '';
    }


    if (action === 'update') {
      if (!compositionId) throw Object.assign(new Error('Composition requise.'), { status: 400 });
      const rows = await sql`
        update composition_types
        set title = ${title},
            notes = ${notes},
            tags = ${JSON.stringify(tags)}::jsonb,
            slots = ${JSON.stringify(slots)}::jsonb,
            updated_at = now()
        where id = ${compositionId}
          and team_id = ${teamId}
          and (${canManageAll} or created_by = ${user.id})
        returning *
      `;
      if (!rows[0]) throw Object.assign(new Error('Composition introuvable ou non autorisée.'), { status: 404 });
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'composition_types.update', 'composition_types', ${compositionId}, ${JSON.stringify({ teamId, title })}::jsonb)
      `;
      return json({ composition: rows[0] });
    }

    const rows = await sql`
      insert into composition_types (team_id, created_by, title, notes, tags, slots)
      values (${teamId}, ${user.id}, ${title}, ${notes}, ${JSON.stringify(tags)}::jsonb, ${JSON.stringify(slots)}::jsonb)
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'composition_types.create', 'composition_types', ${rows[0].id}, ${JSON.stringify({ teamId, title })}::jsonb)
    `;

    return json({ composition: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
