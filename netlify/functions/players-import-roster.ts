import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { assertMethod, readJson, json, handleError } from './_lib/http';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { assertSchemaReady } from './_lib/migrations';

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateImportProfiles(value: unknown) {
  const invalid = () => Object.assign(new Error('Vérifie les noms, les Riot IDs et les postes des profils proposés.'), { status: 400 });
  if (!Array.isArray(value) || !value.length || value.length > 5) throw invalid();
  const profiles = value.map(profile => {
    const name = String(profile?.name || '').trim();
    const riot_id = String(profile?.riotId || '').trim();
    const role = String(profile?.role || '').trim().toUpperCase();
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name + riot_id) || riot_id.length > 128 || !/^[^#\r\n]{1,100}#[^#\s]{1,16}$/.test(riot_id) || !ROLES.includes(role)) throw invalid();
    return { name, riot_id, role };
  });
  if (new Set(profiles.map(p => p.riot_id.toLowerCase())).size !== profiles.length || new Set(profiles.map(p => p.role)).size !== profiles.length) throw invalid();
  return profiles;
}

/** A separate, explicit confirmation creates profiles; selecting a file never writes. */
export default async function handler(request: Request, context: Context) {
  try {
    assertMethod(request, 'POST');
    assertSessionSecret();
    const user = await requireAuth(request, context);
    await assertRateLimit(request, 'players-import-roster', { limit: 10, windowSeconds: 60 });
    await assertSubjectRateLimit('players-import-roster', user.id, { limit: 10, windowSeconds: 60 });
    const body = await readJson(request, 8192);
    const teamId = String(body.teamId || '').trim();
    if (!UUID.test(teamId)) throw Object.assign(new Error('Équipe invalide.'), { status: 400 });
    const profiles = validateImportProfiles(body.profiles);
    await assertSchemaReady();
    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      // Permission is checked inside the same transaction as all profile writes.
      tx`select 1 / case when exists (
        select 1 from teams t where t.id = ${teamId} and (t.owner_id = ${user.id} or exists (
          select 1 from team_members m where m.team_id = t.id and m.user_id = ${user.id}
          and m.role in ('captain','coach','assistant','analyst','manager','board')
        ))) then 1 else 0 end as authorized`,
      tx`insert into players (team_id, name, riot_id, role, roster_status)
        select ${teamId}, p.name, p.riot_id, p.role,
          case when exists(select 1 from players current where current.team_id = ${teamId} and current.role = p.role and current.roster_status = 'MAIN') then 'SUB' else 'MAIN' end
        from jsonb_to_recordset(${JSON.stringify(profiles)}::jsonb) as p(name text, riot_id text, role text)
        where not exists(select 1 from players existing where existing.team_id = ${teamId} and lower(trim(existing.riot_id)) = lower(p.riot_id))
        on conflict do nothing returning *`,
      tx`select * from players where team_id = ${teamId} and role in ('TOP','JGL','MID','ADC','SUP','SUB')`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'players.import_roster', 'team', ${teamId}, ${JSON.stringify({ count: profiles.length })}::jsonb)`
    ]);
    return json({ players: results[3], createdCount: results[2].length });
  } catch (error: any) {
    if (error?.code === '22012') return json({ error: 'Seul le responsable ou le staff peut créer les profils de cette équipe.' }, 403);
    return handleError(error);
  }
}
