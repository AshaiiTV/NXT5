import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { ensureAuditLogsSchema, ensureCompositionTypesSchema } from './_lib/schema';
import { cleanText } from './_lib/text';

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
    const lockedTeamQueries = tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t where t.id = ${teamId}
        and (t.owner_id = ${user.id} or exists (select 1 from team_members where team_id = t.id and user_id = ${user.id}))`
    ];

    if (action === 'delete') {
      if (!compositionId) throw Object.assign(new Error('Composition requise.'), { status: 400 });
      const results = await sql.transaction(tx => [
        ...lockedTeamQueries(tx),
        tx`with changed as (
        delete from composition_types
        where id = ${compositionId}
          and team_id = ${teamId}
          and (created_by = ${user.id} or exists (select 1 from teams t where t.id = ${teamId}
            and (t.owner_id = ${user.id} or exists (select 1 from team_members tm where tm.team_id = t.id
              and tm.user_id = ${user.id} and tm.role in ('owner','captain','coach','assistant','analyst','manager','board')))))
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'composition_types.delete', 'composition_types', id,
          jsonb_build_object('teamId', ${teamId}::text, 'title', title) from changed
      ) select * from changed`
      ]);
      const deleted = results[results.length - 1];
      if (!deleted[0]) throw Object.assign(new Error('Composition introuvable ou non autorisée.'), { status: 404 });
      return json({ ok: true });
    }

    if (!title) throw Object.assign(new Error('Titre requis.'), { status: 400 });
    const slots = normalizeSlots(body.slots);
    // Sanitize references after acquiring the team lock. A profile or pick
    // deleted during request validation must not be written back into JSON.
    if (action === 'update') {
      if (!compositionId) throw Object.assign(new Error('Composition requise.'), { status: 400 });
      const results = await sql.transaction(tx => [
        ...lockedTeamQueries(tx),
        tx`with valid_slots as (
          select coalesce(jsonb_object_agg(slot.key, jsonb_build_object('playerId', coalesce(p.id::text, ''), 'poolId', coalesce(cp.id::text, ''))), '{}'::jsonb) as slots
          from jsonb_each(${JSON.stringify(slots)}::jsonb) slot
          left join players p on p.id = nullif(slot.value->>'playerId', '')::uuid and p.team_id = ${teamId}
          left join champion_pool cp on cp.id = nullif(slot.value->>'poolId', '')::uuid and cp.team_id = ${teamId}
        ), changed as (
        update composition_types
        set title = ${title},
            notes = ${notes},
            tags = ${JSON.stringify(tags)}::jsonb,
            slots = (select slots from valid_slots),
            updated_at = now()
        where id = ${compositionId}
          and team_id = ${teamId}
          and (created_by = ${user.id} or exists (select 1 from teams t where t.id = ${teamId}
            and (t.owner_id = ${user.id} or exists (select 1 from team_members tm where tm.team_id = t.id
              and tm.user_id = ${user.id} and tm.role in ('owner','captain','coach','assistant','analyst','manager','board')))))
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'composition_types.update', 'composition_types', id, ${JSON.stringify({ teamId, title })}::jsonb from changed
      ) select * from changed`
      ]);
      const rows = results[results.length - 1];
      if (!rows[0]) throw Object.assign(new Error('Composition introuvable ou non autorisée.'), { status: 404 });
      return json({ composition: rows[0] });
    }

    const results = await sql.transaction(tx => [
      ...lockedTeamQueries(tx),
      tx`with valid_slots as (
        select coalesce(jsonb_object_agg(slot.key, jsonb_build_object('playerId', coalesce(p.id::text, ''), 'poolId', coalesce(cp.id::text, ''))), '{}'::jsonb) as slots
        from jsonb_each(${JSON.stringify(slots)}::jsonb) slot
        left join players p on p.id = nullif(slot.value->>'playerId', '')::uuid and p.team_id = ${teamId}
        left join champion_pool cp on cp.id = nullif(slot.value->>'poolId', '')::uuid and cp.team_id = ${teamId}
      ), changed as (
      insert into composition_types (team_id, created_by, title, notes, tags, slots)
      select ${teamId}, ${user.id}, ${title}, ${notes}, ${JSON.stringify(tags)}::jsonb, slots from valid_slots
      returning *
    ), logged as (
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      select ${user.id}, 'composition_types.create', 'composition_types', id, ${JSON.stringify({ teamId, title })}::jsonb from changed
    ) select * from changed`
    ]);
    const rows = results[results.length - 1];

    return json({ composition: rows[0] });
  } catch (err) {
    if (err?.code === '22012' || err?.code === '23503') return json({ error: 'L’équipe ou les accès ont changé. Recharge l’équipe puis réessaie.' }, 409);
    return handleError(err);
  }
}
