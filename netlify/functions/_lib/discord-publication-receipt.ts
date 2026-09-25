import { sql } from './db';

/** Only curated messages cross the API boundary, never provider error bodies. */
export function discordPublicationErrorMessage(status: string, code: string | null): string | null {
  if (['queued', 'preparing', 'sending', 'succeeded'].includes(status)) return null;
  if (status === 'uncertain') return 'Discord n’a pas confirmé l’envoi. Vérifie le salon avant de demander un nouvel envoi.';
  const messages: Record<string, string> = {
    DISCORD_UNAUTHORIZED: 'Discord refuse le jeton du bot. L’administrateur NXT5 doit rétablir sa configuration serveur.',
    DISCORD_FORBIDDEN: 'Le bot n’a pas les permissions nécessaires dans ce salon. Vérifie son accès et ses droits d’envoi.',
    DISCORD_NOT_FOUND: 'Le salon ou le message Discord est introuvable. Vérifie la destination sélectionnée.',
    DISCORD_NOT_CONFIGURED: 'Le bot Discord n’est pas configuré sur cet environnement NXT5.',
    DISCORD_INVALID_REQUEST: 'Discord a refusé le contenu de cette publication. L’administrateur NXT5 doit vérifier le format envoyé.',
    DISCORD_FILE_TOO_LARGE: 'Le visuel dépasse la taille acceptée par Discord.',
    DISCORD_RATE_LIMITED: 'Discord demande de patienter. L’envoi sera réessayé automatiquement.',
    DISCORD_UNAVAILABLE: 'Discord est temporairement indisponible.',
    DISCORD_INVALID_RESPONSE: 'La réponse de Discord n’a pas pu être vérifiée.',
    DISCORD_PAUSED: 'La publication attend la reprise de la connexion Discord.',
    DISCORD_DISABLED: 'Les envois Discord sont suspendus sur cet environnement.',
    CONFIG_CHANGED: 'La destination a changé. Vérifie le salon puis ouvre un nouvel aperçu.',
    SOURCE_OR_DESTINATION_CHANGED: 'La partie ou la destination a changé. Ouvre un nouvel aperçu.',
    MATCH_DELETED: 'La partie a été supprimée ; cette publication est arrêtée.',
  };
  if (code && messages[code]) return messages[code];
  if (status === 'retry_wait') return 'L’envoi n’a pas abouti. Une nouvelle tentative est prévue automatiquement.';
  if (status === 'blocked') return 'L’envoi est bloqué. Le code d’erreur permet à l’administrateur NXT5 d’en vérifier la cause.';
  if (status === 'superseded') return 'La partie a changé. Ouvre un nouvel aperçu pour publier sa version actuelle.';
  if (status === 'cancelled') return 'Cette publication a été arrêtée. Vérifie la destination puis ouvre un nouvel aperçu.';
  return null;
}

export function discordPublicationReceipt(row: Record<string, any>) {
  const errorCode = ['queued', 'preparing', 'sending', 'succeeded'].includes(row.status) ? null
    : /^[A-Z0-9_]{1,100}$/.test(String(row.last_error_code || '')) ? row.last_error_code : null;
  return {
    id: row.id, status: row.status, matchId: row.entity_id, channelId: row.channel_id,
    routeId: row.route_id, configVersion: Number(row.config_version), revision: Number(row.source_revision),
    messageUrl: row.status === 'succeeded' && row.message_id && row.publication_state !== 'withdrawn'
      ? `https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id}` : null,
    errorCode, lastError: discordPublicationErrorMessage(row.status, errorCode),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function readDiscordPublicationReceipts(teamId: string, jobIds: string[]) {
  const rows = await sql`select j.*,p.message_id,p.guild_id,p.channel_id,p.route_id,p.state as publication_state
    from publication_jobs j join discord_publications p on p.id=j.publication_id and p.team_id=j.team_id
    where j.team_id=${teamId} and j.id=any(${jobIds}::uuid[])`;
  return rows.map(discordPublicationReceipt);
}
