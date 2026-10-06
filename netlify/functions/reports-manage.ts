import type { Context } from "@netlify/functions";
import { randomUUID } from 'node:crypto';
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth, sha256 } from './_lib/auth';
import { getTeamMemberEmails } from './_lib/team-member-emails';
import { sendNotification } from './_lib/email';
import { ensureAuditLogsSchema, ensureReportsSchema } from './_lib/schema';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { cleanText, escapeHtml } from './_lib/text';

const MAX_REPORT_CONTENT_LENGTH = 256000;
const MAX_REPORT_MATCHES = 20;

function reviewAuditQueries(tx, userId: string, teamId: string, reportId: string, action: string, title: string, matchIds: string[]) {
  // Part of the same transaction as the review itself: an audit failure must
  // roll back the content and first-review milestone together.
  return [
    tx`update teams set first_review_at = now() where id = ${teamId} and first_review_at is null returning id`,
    tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${userId}, ${action}, 'reports', ${reportId}, ${JSON.stringify({ teamId, title, matchIds })}::jsonb)`
  ];
}

async function notifyReportCreate({ request, teamId, userId, reportTitle, fingerprint }) {
  try {
    const emails = await getTeamMemberEmails(teamId, sql, 'notif_report');
    if (!emails.length) return;
    // Shared, atomic claims also cover concurrent requests and other instances.
    // Saving a review must always succeed independently of notification delivery.
    await assertSubjectRateLimit('report-notification-duplicate', `${teamId}:${fingerprint}`, { limit: 1, windowSeconds: 300 });
    await assertSubjectRateLimit('report-notification-account', userId, { limit: 5, windowSeconds: 300 });
    await assertSubjectRateLimit('report-notification-team', teamId, { limit: 10, windowSeconds: 300 });
    const siteUrl = String(process.env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
    const safeTitle = escapeHtml(reportTitle);
    const html = `
      <p>Une nouvelle review a ete generee pour votre equipe.</p>
      <p><strong>Review :</strong> ${safeTitle}</p>
      <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
      <p><a href="${escapeHtml(`${siteUrl}/rapports`)}" style="color:#67e8f9;font-weight:800;text-decoration:none">Voir la review sur NXT5</a></p>
      <hr style="border:0;border-top:1px solid rgba(148,163,184,.18);margin:22px 0">
      <p style="font-size:12px;color:#888">Pour ne plus recevoir ces emails, rendez-vous dans vos préférences NXT5.</p>
    `;
    await Promise.all(emails.map((email) => sendNotification({
      to: email,
      subject: `[NXT5] Nouvelle review disponible — ${reportTitle}`,
      html
    })));
  } catch (failure: any) {
    if (failure?.status !== 429) console.error('[report-notification] Delivery skipped.', { code: 'NOTIFICATION_UNAVAILABLE' });
  }
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    await ensureReportsSchema();
    await ensureAuditLogsSchema();
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const reportId = cleanText(body.reportId, 80);
    const title = cleanText(body.title, 140);
    // Generated coaching and staff notes share this field. Never truncate it:
    // the notes are usually at the end and must survive an update unchanged.
    const content = String(body.content || '');
    const matchIds = Array.isArray(body.matchIds) ? body.matchIds.map((id) => cleanText(id, 80)).filter(Boolean) : [];

    if (!teamId) throw Object.assign(new Error('Team requise.'), { status: 400 });

    const membership = await sql`
      select teams.owner_id, team_members.role
      from teams
      left join team_members on team_members.team_id = teams.id and team_members.user_id = ${user.id}
      where teams.id = ${teamId}
        and (teams.owner_id = ${user.id} or team_members.user_id = ${user.id})
      limit 1
    `;
    const member = membership[0];
    if (!member) throw Object.assign(new Error('Accès team refusé.'), { status: 403 });
    const isCaptain = member.owner_id === user.id || ['captain', 'coach', 'assistant', 'analyst', 'manager', 'board'].includes(String(member.role || '').toLowerCase());
    const lockedReviewQueries = (tx, existingReportId: string | null = null) => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select user_id from team_members where team_id = ${teamId} and user_id = ${user.id} for share`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end from teams t where t.id = ${teamId}
        and (t.owner_id = ${user.id} or exists (select 1 from team_members where team_id = t.id and user_id = ${user.id}))`,
      ...(existingReportId ? [
        tx`select id from reports where id = ${existingReportId} and team_id = ${teamId} for update`,
        tx`select 1 / case when count(*) = 1 then 1 else 0 end from reports r join teams t on t.id = r.team_id
          where r.id = ${existingReportId} and r.team_id = ${teamId}
            and ((r.created_by = ${user.id} and (to_jsonb(r)->>'discord_status') is distinct from 'draft')
              or t.owner_id = ${user.id} or exists (select 1 from team_members tm where tm.team_id = t.id
                and tm.user_id = ${user.id} and tm.role in ('captain','coach','assistant','analyst','manager','board')))`
      ] : [])
    ];

    if (action === 'delete') {
      if (!reportId) throw Object.assign(new Error('Review requisee.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report || (report.discord_status === 'draft' && !isCaptain)) throw Object.assign(new Error('Review introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur de la review ou le capitaine peut le supprimer.'), { status: 403 });
      }
      await sql.transaction(tx => [
        ...lockedReviewQueries(tx, reportId),
        tx`delete from reports where id = ${reportId} and team_id = ${teamId}`,
        tx`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'reports.delete', 'reports', ${reportId}, ${JSON.stringify({ teamId, title: report.title })}::jsonb)
      `]);
      return json({ ok: true });
    }

    if (!title || !content.trim()) throw Object.assign(new Error('Titre et contenu requis.'), { status: 400 });
    if (content.length > MAX_REPORT_CONTENT_LENGTH) {
      throw Object.assign(new Error('La review dépasse la limite de 256 000 caractères. Réduis son contenu avant de l’enregistrer.'), {
        status: 413, code: 'REPORT_CONTENT_TOO_LONG'
      });
    }
    if (matchIds.length > MAX_REPORT_MATCHES) {
      throw Object.assign(new Error('Une review peut contenir au maximum 20 games liées.'), {
        status: 400, code: 'REPORT_TOO_MANY_MATCHES'
      });
    }

    const validMatches = matchIds.length ? await sql`
      select id
      from matches
      where team_id = ${teamId}
        and id = any(${matchIds})
    ` : [];
    const validMatchIds = validMatches.map((match) => match.id);
    const primaryMatchId = validMatchIds[0] || null;
    const lockedMatchesQuery = tx => tx`select 1 / case when count(*) = ${validMatchIds.length} then 1 else 0 end from (
      select id from matches where team_id = ${teamId} and id = any(${validMatchIds}::uuid[]) for key share) linked_matches`;

    if (action === 'update') {
      if (!reportId) throw Object.assign(new Error('Review requisee.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report || (report.discord_status === 'draft' && !isCaptain)) throw Object.assign(new Error('Review introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur de la review ou le capitaine peut le modifier.'), { status: 403 });
      }
      const results = await sql.transaction(tx => [
        ...lockedReviewQueries(tx, reportId), lockedMatchesQuery(tx),
        tx`
        update reports
        set match_id = ${primaryMatchId},
            match_ids = ${JSON.stringify(validMatchIds)}::jsonb,
            title = ${title},
            content = ${content},
            source = 'manual',
            updated_at = now()
        where id = ${reportId}
          and team_id = ${teamId}
        returning *
      `,
        ...reviewAuditQueries(tx, user.id, teamId, reportId, 'reports.update', title, validMatchIds)
      ]);
      return json({ report: results[results.length - 3][0], firstReview: results[results.length - 2].length === 1 });
    }

    const newReportId = randomUUID();
    const results = await sql.transaction(tx => [
      ...lockedReviewQueries(tx), lockedMatchesQuery(tx),
      tx`insert into reports (team_id, match_id, match_ids, created_by, title, content, id)
      values (${teamId}, ${primaryMatchId}, ${JSON.stringify(validMatchIds)}::jsonb, ${user.id}, ${title}, ${content}, ${newReportId})
      returning *
    `,
      ...reviewAuditQueries(tx, user.id, teamId, newReportId, 'reports.create', title, validMatchIds)
    ]);
    const rows = results[results.length - 3];
    const firstReview = results[results.length - 2].length === 1;

    const notificationTask = notifyReportCreate({ request, teamId, userId: user.id, reportTitle: rows[0].title,
      fingerprint: sha256(JSON.stringify([title, content, [...validMatchIds].sort()])) });
    if (typeof (context as any).waitUntil === 'function') (context as any).waitUntil(notificationTask);
    else await notificationTask;

    return json({ report: rows[0], firstReview });
  } catch (err) {
    if (err?.code === '22012' || err?.code === '23503') return json({ error: 'La review, les parties liées ou les accès ont changé. Recharge l’équipe puis réessaie.' }, 409);
    return handleError(err);
  }
}
