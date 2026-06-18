import type { Context } from "@netlify/functions";
import { sql } from './_lib/db';
import { json, readJson, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { getTeamMemberEmails } from './_getTeamMembers.js';
import { sendNotification } from './_mailer.js';

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
    <p>Un nouveau rapport a été généré pour votre équipe.</p>
    <p><strong>Rapport :</strong> ${safeTitle}</p>
    <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
    <p><a href="${escapeHtml(`${siteUrl}/rapports`)}" style="color:#67e8f9;font-weight:800;text-decoration:none">Voir le rapport sur NXT5</a></p>
    <hr style="border:0;border-top:1px solid rgba(148,163,184,.18);margin:22px 0">
    <p style="font-size:12px;color:#888">Pour ne plus recevoir ces emails, rendez-vous dans vos préférences NXT5.</p>
  `;
  await Promise.all(emails.map((email) => sendNotification({
    to: email,
    subject: `[NXT5] Nouveau rapport disponible — ${reportTitle}`,
    html
  })));
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    const user = await requireAuth(request, context);
    const body = await readJson(request);
    const action = cleanText(body.action || 'create', 20);
    const teamId = cleanText(body.teamId, 80);
    const reportId = cleanText(body.reportId, 80);
    const title = cleanText(body.title, 140);
    const content = cleanText(body.content, 12000);
    const matchIds = Array.isArray(body.matchIds) ? body.matchIds.map((id) => cleanText(id, 80)).filter(Boolean).slice(0, 20) : [];

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
      if (!reportId) throw Object.assign(new Error('Rapport requis.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report) throw Object.assign(new Error('Rapport introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur du rapport ou le capitaine peut le supprimer.'), { status: 403 });
      }
      await sql`delete from reports where id = ${reportId} and team_id = ${teamId}`;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'reports.delete', 'reports', ${reportId}, ${JSON.stringify({ teamId, title: report.title })}::jsonb)
      `;
      return json({ ok: true });
    }

    if (!title || !content) throw Object.assign(new Error('Titre et contenu requis.'), { status: 400 });

    const validMatches = matchIds.length ? await sql`
      select id
      from matches
      where team_id = ${teamId}
        and id = any(${matchIds})
    ` : [];
    const validMatchIds = validMatches.map((match) => match.id);
    const primaryMatchId = validMatchIds[0] || null;

    if (action === 'update') {
      if (!reportId) throw Object.assign(new Error('Rapport requis.'), { status: 400 });
      const existing = await sql`select * from reports where id = ${reportId} and team_id = ${teamId} limit 1`;
      const report = existing[0];
      if (!report) throw Object.assign(new Error('Rapport introuvable.'), { status: 404 });
      if (String(report.created_by || '') !== String(user.id) && !isCaptain) {
        throw Object.assign(new Error('Seul l’auteur du rapport ou le capitaine peut le modifier.'), { status: 403 });
      }
      const rows = await sql`
        update reports
        set match_id = ${primaryMatchId},
            match_ids = ${JSON.stringify(validMatchIds)}::jsonb,
            title = ${title},
            content = ${content},
            updated_at = now()
        where id = ${reportId}
          and team_id = ${teamId}
        returning *
      `;
      await sql`
        insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
        values (${user.id}, 'reports.update', 'reports', ${reportId}, ${JSON.stringify({ teamId, title, matchIds: validMatchIds })}::jsonb)
      `;
      return json({ report: rows[0] });
    }

    const rows = await sql`
      insert into reports (team_id, match_id, match_ids, created_by, title, content)
      values (${teamId}, ${primaryMatchId}, ${JSON.stringify(validMatchIds)}::jsonb, ${user.id}, ${title}, ${content})
      returning *
    `;

    await sql`
      insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
      values (${user.id}, 'reports.create', 'reports', ${rows[0].id}, ${JSON.stringify({ teamId, title, matchIds: validMatchIds })}::jsonb)
    `;

    const notificationTask = notifyReportCreate({ request, teamId, reportTitle: rows[0].title });
    if (typeof (context as any).waitUntil === 'function') (context as any).waitUntil(notificationTask);
    else await notificationTask;

    return json({ report: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}
