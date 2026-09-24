import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { requireAuth } from './_lib/auth';
import { json, readJson } from './_lib/http';
import { assertDiscordMethod, discordError, discordResponseError } from './_lib/discord-access';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { assertDiscordBotSchemaReady, validBotToken, botTokenHash } from './_lib/discord-bot-common';
import { unlinkDiscordAccount } from './_lib/discord-bot-account';

async function handler(request: Request, context: Context) {
  try {
    assertDiscordMethod(request, ['GET', 'POST', 'DELETE']);
    const user = await requireAuth(request, context);
    await assertDiscordBotSchemaReady();
    await assertSubjectRateLimit('discord-account', user.id, { limit: 30, windowSeconds: 60 });
    const [link] = await sql('select discord_user_id,discord_label,created_at from discord_user_links where user_id=$1', [user.id]);
    if (request.method === 'DELETE') {
      if (link) await unlinkDiscordAccount(link.discord_user_id);
      return json({ ok: true });
    }
    const body = request.method === 'POST' ? await readJson(request, 2000) : null;
    const token = body?.token ?? new URL(request.url).searchParams.get('token');
    if (link && request.method === 'GET') return json({ link });
    if (!token && request.method === 'GET') return json({ link: link || null });
    if (!validBotToken(token)) throw discordError('Ce lien personnel est invalide. Lance /nxt lier dans Discord.');
    const [pending] = await sql(`select discord_user_id,discord_label,user_id,expires_at from discord_account_link_requests
      where token_hash=$1 and used_at is null and expires_at>now()`, [botTokenHash(token)]);
    if (!pending || (pending.user_id && pending.user_id !== user.id)) throw discordError('Ce lien a expiré ou est déjà utilisé. Lance /nxt lier dans Discord.', 409, 'DISCORD_ACCOUNT_LINK_EXPIRED');
    if (link && link.discord_user_id !== pending.discord_user_id) throw discordError('Ton compte NXT5 est déjà lié. Délie-le avant de choisir un autre compte Discord.', 409, 'DISCORD_ACCOUNT_LINK_CONFLICT');
    if (request.method === 'POST') {
      const changed = await sql(`update discord_account_link_requests set user_id=$2 where token_hash=$1 and used_at is null
        and expires_at>now() and (user_id is null or user_id=$2) returning token_hash`, [botTokenHash(token), user.id]);
      if (!changed.length) throw discordError('La demande a changé. Lance /nxt lier dans Discord.', 409, 'DISCORD_ACCOUNT_LINK_EXPIRED');
    }
    return json({ link: link || null, request: { discordUserId: pending.discord_user_id, discordLabel: pending.discord_label,
      expiresAt: pending.expires_at, prepared: request.method === 'POST' || pending.user_id === user.id }, accountName: user.account_name });
  } catch (error) { return discordResponseError(error); }
}
export default withDiscordRuntime(handler);
