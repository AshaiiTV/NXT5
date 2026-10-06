import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { safeTeam } from './_lib/teams';
import { cleanText } from './_lib/text';

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    const teamId = cleanText(body.teamId, 80);
    const name = cleanText(body.name, 80);
    const tag = cleanText(body.tag, 12).toUpperCase();
    const avatarDataUrl = cleanText(body.avatarDataUrl, 1_500_000) || null;
    const avatarZoom = Math.min(2.5, Math.max(1, cleanNumber(body.avatarZoom, 1)));
    const avatarX = Math.min(100, Math.max(0, cleanNumber(body.avatarX, 50)));
    const avatarY = Math.min(100, Math.max(0, cleanNumber(body.avatarY, 50)));

    if (!teamId || !name || !tag) throw Object.assign(new Error('Nom, tag et team requis.'), { status: 400 });
    if (avatarDataUrl && !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatarDataUrl)) {
      throw Object.assign(new Error('Avatar invalide.'), { status: 400 });
    }

    const results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
      tx`with changed_team as (
        update teams
        set name = ${name},
          tag = ${tag},
          avatar_data_url = ${avatarDataUrl},
          avatar_zoom = ${avatarZoom},
          avatar_x = ${avatarX},
          avatar_y = ${avatarY},
          updated_at = now()
        where id = ${teamId}
          and (owner_id = ${user.id} or exists (select 1 from team_members
            where team_id = teams.id and user_id = ${user.id} and role in ('captain', 'manager')))
        returning *
      ), logged as (
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        select ${user.id}, 'team.update', 'team', id, ${JSON.stringify({ name, tag, avatar: Boolean(avatarDataUrl) })}::jsonb
        from changed_team
      )
      select * from changed_team`
    ]);
    const rows = results[2];
    if (!rows[0]) throw Object.assign(new Error('Tu ne peux pas modifier cette team.'), { status: 403 });

    return json({ team: safeTeam(rows[0]) });
  } catch (err) {
    return handleError(err);
  }
}
