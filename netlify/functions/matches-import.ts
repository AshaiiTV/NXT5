import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { fetchRiotMatch } from './_lib/riot';
import { persistAnalyzedMatch } from './_lib/analytics';
import { assertRateLimit } from './_lib/rate-limit';
import { getTeamMemberEmails } from './_getTeamMembers.js';
import { sendNotification } from './_mailer.js';

function cleanText(value, max = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value || '').replace(/[&<>"']/g, (char) => entities[char] || char);
}

async function notifyMatchImport({ request, teamId, matchId, gameId }) {
  const emails = await getTeamMemberEmails(teamId, sql, 'notif_match');
  if (!emails.length) return;
  const siteUrl = String(process.env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  const safeMatchId = escapeHtml(gameId || matchId);
  const html = `
    <p>Un nouveau match a été importé dans votre équipe.</p>
    <p><strong>Match ID :</strong> ${safeMatchId}</p>
    <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
    <p><a href="${escapeHtml(`${siteUrl}/integration`)}" style="color:#67e8f9;font-weight:800;text-decoration:none">Voir le match sur NXT5</a></p>
    <hr style="border:0;border-top:1px solid rgba(148,163,184,.18);margin:22px 0">
    <p style="font-size:12px;color:#888">Pour ne plus recevoir ces emails, rendez-vous dans vos préférences NXT5.</p>
  `;
  await Promise.all(emails.map((email) => sendNotification({
    to: email,
    subject: `[NXT5] Nouveau match importé — ${gameId || matchId}`,
    html
  })));
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await assertRateLimit(request, 'match-import', { limit: 20, windowSeconds: 60 });
    const user = await requireAuth(request, context);
    const body = await readJson(request);

    let gameId = String(body.gameId || '').trim().toUpperCase();
    const teamId = String(body.teamId || '').trim();
    const label = cleanText(body.label, 120);
    const rawCategoryIds = body.categoryIds || [];
    const categoryIds = [...new Set((Array.isArray(rawCategoryIds) ? rawCategoryIds : [rawCategoryIds]).map((id) => String(id || '').trim()).filter(Boolean))];
    const laneAssignments = body.laneAssignments && typeof body.laneAssignments === 'object' ? body.laneAssignments : {};
    const playerAssignments = body.playerAssignments && typeof body.playerAssignments === 'object' ? body.playerAssignments : {};
    const allyTeamSide = cleanText(body.allyTeamSide, 20);

    if (!gameId) throw Object.assign(new Error('Game ID requis.'), { status: 400 });
    if (!teamId) throw Object.assign(new Error('Team ID requis.'), { status: 400 });
    if (gameId && !/^([A-Z0-9]+)_\d+$/.test(gameId)) throw Object.assign(new Error('Format Game ID invalide. Exemple : EUW1_7123456789'), { status: 400 });

    const teams = await sql`
      select distinct teams.*
      from teams
      left join team_members on team_members.team_id = teams.id
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const team = teams[0];
    if (!team) throw Object.assign(new Error('Team introuvable ou non autorisée.'), { status: 403 });

    const roster = await sql`select * from players where team_id = ${teamId}`;
    if (!roster.length) throw Object.assign(new Error('Ajoute au moins un joueur au roster avant d’importer une game.'), { status: 400 });

    const match = await fetchRiotMatch(gameId);
    if (body.previewOnly) {
      return json({
        gameId,
        match: {
          gameId,
          duration: match.info?.gameDuration || 0,
          version: match.info?.gameVersion || '',
          teams: [100, 200].map((teamId) => ({
            teamId,
            side: teamId === 100 ? 'BLUE' : 'RED',
            win: Boolean(match.info?.teams?.find((team) => team.teamId === teamId)?.win),
            participants: (match.info?.participants || []).filter((participant) => participant.teamId === teamId).map((participant) => ({
              participantId: participant.participantId,
              teamId: participant.teamId,
              champion: participant.championName,
              championId: participant.championId,
              summonerName: participant.summonerName,
              riotId: participant.riotIdTagline ? `${participant.riotIdGameName || participant.summonerName}#${participant.riotIdTagline}` : participant.summonerName,
              teamPosition: participant.teamPosition || participant.individualPosition || participant.lane || ''
            }))
          }))
        }
      });
    }
    let savedMatch = await persistAnalyzedMatch({ team, gameId, match, roster, userId: user.id, laneAssignments, playerAssignments, allyTeamSide });
    const validCategoryIds: string[] = [];
    if (categoryIds.length) {
      const categories = await sql`
        select id
        from match_categories
        where team_id = ${teamId}
          and id = any(${categoryIds})
      `;
      const validSet = new Set(categories.map((category) => String(category.id)));
      validCategoryIds.push(...categoryIds.filter((id) => validSet.has(String(id))));
      if (validCategoryIds.length !== categoryIds.length) throw Object.assign(new Error('Une catégorie sélectionnée est introuvable pour cette team.'), { status: 404 });
    }
    if (label || validCategoryIds.length) {
      const named = await sql`
        update matches
        set opponent = ${label || savedMatch.opponent || savedMatch.game_id},
            category_id = ${validCategoryIds[0] || null},
            category_ids = ${JSON.stringify(validCategoryIds)}::jsonb,
            raw = jsonb_set(coalesce(raw, '{}'::jsonb), '{nxt5Label}', to_jsonb(${label || savedMatch.opponent || savedMatch.game_id}::text), true)
        where id = ${savedMatch.id}
        returning *
      `;
      savedMatch = named[0] || savedMatch;
    }

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'match.import', 'match', ${savedMatch.id}, ${JSON.stringify({ gameId, teamId, label, categoryIds: validCategoryIds })}::jsonb)
    `;

    const notificationTask = notifyMatchImport({ request, teamId, matchId: savedMatch.id, gameId: savedMatch.game_id || gameId });
    if (typeof (context as any).waitUntil === 'function') (context as any).waitUntil(notificationTask);
    else await notificationTask;

    return json({ match: savedMatch });
  } catch (err) {
    return handleError(err);
  }
}
