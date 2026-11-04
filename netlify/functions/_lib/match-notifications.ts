import { sql } from './db';
import { getTeamMemberEmails } from './team-member-emails';
import { sendNotification } from './email';
import { escapeHtml } from './text';

/** Preference-aware e-mail after a newly inserted match, shared by every import path. */
export async function notifyMatchImport({ siteUrl, teamId, matchId, gameId }: { siteUrl: string; teamId: string; matchId: string; gameId: string }) {
  const emails = await getTeamMemberEmails(teamId, sql, 'notif_match');
  if (!emails.length) return;
  const base = String(siteUrl || '').replace(/\/+$/, '');
  const safeMatchId = escapeHtml(gameId || matchId);
  const html = `
    <p>Un nouveau match a été importé dans votre équipe.</p>
    <p><strong>Match ID :</strong> ${safeMatchId}</p>
    <p><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
    <p><a href="${escapeHtml(`${base}/games`)}" style="color:#67e8f9;font-weight:800;text-decoration:none">Voir le match sur NXT5</a></p>
    <hr style="border:0;border-top:1px solid rgba(148,163,184,.18);margin:22px 0">
    <p style="font-size:12px;color:#888">Pour ne plus recevoir ces emails, rendez-vous dans vos préférences NXT5.</p>
  `;
  await Promise.all(emails.map((email) => sendNotification({ to: email, subject: `[NXT5] Nouveau match importé — ${gameId || matchId}`, html })));
}
