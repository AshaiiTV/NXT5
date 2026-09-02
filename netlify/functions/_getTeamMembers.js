import { ensureAuthUserSchema } from './_lib/auth';

const PREFERENCE_COLUMNS = new Set(['notif_match', 'notif_report']);

export async function ensureUserNotificationColumns(_db) {
  await ensureAuthUserSchema();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export async function getTeamMemberEmails(teamId, db, preference = 'notif_match') {
  const column = PREFERENCE_COLUMNS.has(preference) ? preference : 'notif_match';
  if (!teamId) return [];

  try {
    await ensureUserNotificationColumns(db);
    const rows = column === 'notif_report'
      ? await db`
          select distinct lower(users.email) as email
          from team_members
          join users on users.id = team_members.user_id
          where team_members.team_id = ${teamId}
            and coalesce(users.notif_report, true) = true
            and coalesce(users.email_verified, false) = true
            and users.email is not null
            and users.email <> ''
        `
      : await db`
          select distinct lower(users.email) as email
          from team_members
          join users on users.id = team_members.user_id
          where team_members.team_id = ${teamId}
            and coalesce(users.notif_match, true) = true
            and coalesce(users.email_verified, false) = true
            and users.email is not null
            and users.email <> ''
        `;

    return rows.map((row) => String(row.email || '').trim()).filter(isValidEmail);
  } catch (err) {
    console.error('[notifications] Unable to load team member emails.', err);
    return [];
  }
}
