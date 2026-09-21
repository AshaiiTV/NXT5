import { emailAction } from './_lib/email-template.js';
import { randomUUID } from 'node:crypto';
import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { getTeamMemberEmails } from './_getTeamMembers.js';
import { sendNotification } from './_mailer.js';
import { ensureAuditLogsSchema, ensureReportsSchema } from './_lib/schema';

function cleanText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value || '').replace(/[&<>"']/g, (char) => entities[char] || char);
}

async function notifyReportCreate({ request, teamId, reportTitle }) {
  const emails = await getTeamMemberEmails(teamId, sql, 'notif_report');
  if (!emails.length) return;
  const siteUrl = String(process.env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  const safeTitle = escapeHtml(reportTitle);
  const html = `
    <p style="margin:0 0 16px">Une nouvelle review a ete generee pour votre equipe.</p>
    <p style="margin:0 0 16px"><strong>Review :</strong> ${safeTitle}</p>
    <p style="margin:0 0 16px"><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
    ${emailAction({ href: `${siteUrl}/rapports`, label: "Voir la review sur NXT5" })}
    <hr style="border:0;border-top:1px solid rgba(148,163,184,.18);margin:22px 0">
    <p style="margin:0;color:#B8C6DC;font-size:12px;line-height:20px">Gère ces e-mails dans <a href="${escapeHtml(`${siteUrl}/parametres`)}" style="color:#67E8F9;text-decoration:underline">tes préférences de notification</a>.</p>
  `;
  await Promise.all(emails.map((email) => sendNotification({
    to: email,
    subject: `[NXT5] Nouvelle review disponible — ${reportTitle}`,
    html,
    siteUrl
  })));
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
    const content = cleanText(body.content, 12000);
    const matchIds = Array.isArray(body.matchIds) ? [...new Set(body.matchIds.map((id) => cleanText(id, 80).toLowerCase()).filter(Boolean))].slice(0, 20) : [];

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

    if (action === 'delete') {
      if (!reportId) throw Object.assign(new Error('Review requisee.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report) throw Object.assign(new Error('Review introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur de la review ou le capitaine peut le supprimer.'), { status: 403 });
      }
      await sql`delete from reports where id = ${reportId} and team_id = ${teamId}`;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'reports.delete', 'reports', ${reportId}, ${JSON.stringify({ teamId, title: report.title })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!title || !content) throw Object.assign(new Error('Titre et contenu requis.'), { status: 400 });

    if (action === 'update') {
      if (!reportId) throw Object.assign(new Error('Review requisee.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report) throw Object.assign(new Error('Review introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur de la review ou le capitaine peut le modifier.'), { status: 403 });
      }
    }

    const savedReportId = action === 'update' ? reportId : randomUUID();
    let report;
    try {
      const results = await sql.transaction(tx => [
        // Serialize JSON references with match deletion, then validate again.
        tx`select id from teams where id = ${teamId} for update`,
        tx`select 1 / case when count(*) = ${matchIds.length} then 1 else 0 end as matches_valid
           from (select id from matches where team_id = ${teamId}
                 and id = any(${matchIds}::uuid[]) for key share) locked_matches`,
        action === 'update'
          ? tx`update reports set match_id = ${matchIds[0] || null}, match_ids = ${JSON.stringify(matchIds)}::jsonb,
                 title = ${title}, content = ${content}, updated_at = now()
               where id = ${savedReportId} and team_id = ${teamId} returning *`
          : tx`insert into reports (id, team_id, match_id, match_ids, created_by, title, content)
               values (${savedReportId}, ${teamId}, ${matchIds[0] || null}, ${JSON.stringify(matchIds)}::jsonb,
                 ${user.id}, ${title}, ${content}) returning *`,
        tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
           values (${user.id}, ${action === 'update' ? 'reports.update' : 'reports.create'}, 'reports',
             ${savedReportId}, ${JSON.stringify({ teamId, title, matchIds })}::jsonb)`
      ]);
      report = results[2][0];
    } catch (error: any) {
      if (error?.code === '22012' || error?.code === '23503') {
        throw Object.assign(new Error('Les games liées ont changé. Recharge les données avant de sauvegarder la review.'), {
          status: 409, code: 'MATCH_REFERENCES_CHANGED'
        });
      }
      throw error;
    }
    if (!report) throw Object.assign(new Error('Review introuvable.'), { status: 404 });
    if (action === 'update') return json({ report });

    const notificationTask = notifyReportCreate({ request, teamId, reportTitle: report.title });
    if (typeof (context as any).waitUntil === 'function') (context as any).waitUntil(notificationTask);
    else await notificationTask;

    return json({ report });
  } catch (err) {
    return handleError(err);
  }
}
