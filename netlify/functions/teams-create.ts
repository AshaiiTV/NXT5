import type { Context } from "@netlify/functions";
import { randomUUID } from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { safeTeam } from './_lib/teams';
import { cleanText } from './_lib/text';
import { assertSubjectRateLimit } from './_lib/rate-limit';

// Regions offered by the team form and the admin team tools.
const TEAM_REGIONS = new Set(['EUW', 'EUNE', 'NA', 'KR', 'BR', 'LAN', 'LAS', 'JP', 'OCE', 'TR', 'RU', 'SEA', 'TW', 'VN']);

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await assertSubjectRateLimit('teams-create', user.id, { limit: 10, windowSeconds: 3600 });
    const body = await readJson(request, 4096);

    const name = cleanText(body.name, 80);
    const tag = cleanText(body.tag, 12).toUpperCase();
    // The form option labels are translated (e.g. "J.P."): keep letters only.
    const region = cleanText(body.region, 20).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'EUW';

    if (!name || !tag) throw Object.assign(new Error('Nom et tag requis.'), { status: 400 });
    if (!TEAM_REGIONS.has(region)) throw Object.assign(new Error('Région invalide.'), { status: 400 });

    // The team, its captain membership and the audit entry commit together:
    // a team without its creator as captain would be left half-created.
    const teamId = randomUUID();
    const results = await sql.transaction(tx => [
      tx`insert into teams (id, owner_id, name, tag, region)
        values (${teamId}, ${user.id}, ${name}, ${tag}, ${region})
        returning *`,
      tx`insert into team_members (team_id, user_id, role)
        values (${teamId}, ${user.id}, 'captain')
        on conflict (team_id, user_id) do nothing`,
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'team.create', 'team', ${teamId}, ${JSON.stringify({ name, tag, region })}::jsonb)`
    ]);

    return json({ team: safeTeam(results[0][0]) });
  } catch (err) {
    if (err?.code === '23505') {
      return handleError(Object.assign(new Error('Cette team existe déjà sur ton compte.'), { status: 409, code: 'TEAM_NAME_TAKEN' }));
    }
    return handleError(err);
  }
}
