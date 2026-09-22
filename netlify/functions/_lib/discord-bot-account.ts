import { randomBytes } from 'node:crypto';
import { sql } from './db';
import { discordError, assertDiscordArtifactEnvironment } from './discord-access';
import { botTokenHash, validBotToken, botMessage, botLink, botText, botIdentity, botTeams, resolveBotContext, saveBotPending } from './discord-bot-common';

export async function beginDiscordAccountLink(interaction: any) {
  assertDiscordArtifactEnvironment();
  const discordUser = interaction.member.user;
  const [linked] = await sql('select id from discord_user_links where discord_user_id=$1', [discordUser.id]);
  if (linked) return accountStatus(discordUser.id, interaction.guild_id);
  const token = randomBytes(24).toString('hex');
  const label = String(discordUser.global_name || discordUser.username || discordUser.id).slice(0, 100);
  await sql(`insert into discord_account_link_requests(token_hash,discord_user_id,guild_id,discord_label,expires_at)
    values($1,$2,$3,$4,now()+interval '10 minutes')`, [botTokenHash(token), discordUser.id, interaction.guild_id, label]);
  return { ...botMessage('Lier ton compte NXT5', '1. Ouvre NXT5 et confirme ton compte.\n2. Reviens ici et vérifie la liaison.\n3. Confirme le compte affiché dans Discord.\n\nCe lien personnel expire dans 10 minutes. Il ne rejoint aucune équipe.'), components: [{ type: 1, components: [
    { type: 2, style: 5, label: 'Ouvrir NXT5', url: botLink('/bot-discord?lier=' + token) },
    { type: 2, style: 1, label: 'Vérifier la liaison', custom_id: 'nxt:link:review:' + token },
  ] }] };
}
export async function accountStatus(discordUserId: string, guildId?: string) {
  const link = await botIdentity(discordUserId);
  const teams = guildId ? (await botTeams(discordUserId, guildId)).teams : [];
  const selected = teams.length === 1 ? teams[0] : teams.find(team => team.selected);
  return botMessage('Ton compte Discord', 'Compte NXT5 : **' + botText(link.account_name, 100) + '**.\nÉquipe active : ' + (selected ? botText(selected.name, 100) : 'à choisir') + '.\nUtilise `/nxt equipe choisir` pour sélectionner une équipe de ce serveur.\n`/nxt compte delier` révoque cette liaison personnelle.');
}
export async function reviewDiscordAccountLink(token: string, discordUserId: string, guildId: string) {
  const request = await getDiscordAccountLinkRequest(token, discordUserId, guildId);
  if (!request.user_id) return botMessage('Confirmation NXT5 attendue', 'Ouvre le lien personnel précédent, connecte-toi à NXT5 et confirme ton compte. Reviens ensuite sur « Vérifier la liaison ».');
  const [user] = await sql('select account_name from users where id=$1', [request.user_id]);
  return { ...botMessage('Vérifie les deux comptes', 'Discord : **' + botText(request.discord_label, 100) + '**\nCompte NXT5 : **' + botText(user.account_name, 100) + '**\n\nConfirme uniquement si ces deux comptes sont les tiens.'), components: [{ type: 1, components: [
    { type: 2, style: 3, label: 'Confirmer la liaison', custom_id: 'nxt:link:confirm:' + token },
    { type: 2, style: 2, label: 'Annuler', custom_id: 'nxt:link:cancel:' + token },
  ] }] };
}
async function getDiscordAccountLinkRequest(token: string, discordUserId: string, guildId: string) {
  if (!validBotToken(token)) throw discordError('Lien personnel invalide. Relance /nxt compte lier.');
  const [request] = await sql(`select * from discord_account_link_requests where token_hash=$1 and discord_user_id=$2 and guild_id=$3 and used_at is null and expires_at>now()`, [botTokenHash(token), discordUserId, guildId]);
  if (!request) throw discordError('Ce lien personnel a expiré ou a déjà été utilisé. Relance /nxt compte lier.', 409, 'DISCORD_ACCOUNT_LINK_EXPIRED');
  return request;
}
export async function finishDiscordAccountLink(token: string, discordUserId: string, guildId: string, cancel = false) {
  assertDiscordArtifactEnvironment();
  const request = await getDiscordAccountLinkRequest(token, discordUserId, guildId);
  if (cancel) {
    await sql('update discord_account_link_requests set used_at=now() where token_hash=$1', [botTokenHash(token)]);
    return botMessage('Liaison annulée', 'Aucun compte n’a été associé.');
  }
  if (!request.user_id) throw discordError('Confirme d’abord ton compte sur NXT5.');
  try {
    await sql.transaction([
      sql('select token_hash from discord_account_link_requests where token_hash=$1 for update', [botTokenHash(token)]),
      sql(`select 1/case when exists(select 1 from discord_account_link_requests where token_hash=$1 and discord_user_id=$2 and guild_id=$3 and user_id=$4 and used_at is null and expires_at>now()) then 1 else 0 end`, [botTokenHash(token), discordUserId, guildId, request.user_id]),
      sql('insert into discord_user_links(discord_user_id,user_id,discord_label) values($1,$2,$3)', [discordUserId, request.user_id, request.discord_label]),
      sql('update discord_account_link_requests set used_at=now() where discord_user_id=$1 or user_id=$2', [discordUserId, request.user_id]),
    ]);
  } catch (error: any) {
    if (['23505', '22012'].includes(error?.code)) throw discordError('Un des comptes est déjà lié, ou la demande a changé. Consulte /nxt compte profil avant de réessayer.', 409, 'DISCORD_ACCOUNT_LINK_CONFLICT');
    throw error;
  }
  return botMessage('Compte lié', 'Tu peux maintenant choisir ton équipe avec `/nxt equipe choisir nom`. Tes droits restent ceux de ton compte NXT5.');
}
export async function unlinkDiscordAccount(discordUserId: string) {
  assertDiscordArtifactEnvironment();
  await sql.transaction([
    sql('delete from discord_user_links where discord_user_id=$1', [discordUserId]),
    sql('update discord_account_link_requests set used_at=now() where discord_user_id=$1 and used_at is null', [discordUserId]),
  ]);
  return botMessage('Compte délié', 'Les accès Discord à ton compte, les choix d’équipe et tes boutons en attente ont été révoqués.');
}
export async function executeDiscordAccount(interaction: any, command: string, options: Record<string, any>) {
  const discordUserId = interaction.member.user.id;
  const guildId = interaction.guild_id;
  if (command === 'compte lier') return beginDiscordAccountLink(interaction);
  if (command === 'compte profil') return accountStatus(discordUserId, guildId);
  if (command === 'compte delier') {
    const identity = await botIdentity(discordUserId);
    const token = await saveBotPending({ teamId: '', teamName: '', guildId, discordUserId, userId: identity.user_id,
      role: '', canStaff: false, canManage: false, playerIds: [], timezone: 'Europe/Paris', identityId: identity.id }, command, {}, 'confirm');
    return { ...botMessage('Délier ton compte', 'Confirme la révocation de la liaison avec **' + botText(identity.account_name, 100) + '**.'), components: [{ type: 1, components: [
      { type: 2, style: 4, label: 'Délier mon compte', custom_id: 'nxt:confirm:' + token },
      { type: 2, style: 2, label: 'Annuler', custom_id: 'nxt:cancel:' + token },
    ] }] };
  }
  if (command === 'equipe liste') {
    const { teams } = await botTeams(discordUserId, guildId);
    return botMessage('Tes équipes sur ce serveur', teams.length ? teams.slice(0, 20).map(team => '**' + botText(team.name, 100) + '**' + (team.selected ? ' · sélectionnée' : '') + '\n`' + team.id + '`').join('\n\n') + (teams.length > 20 ? '\n\n20 premières équipes affichées. Utilise les suggestions de /nxt equipe choisir pour rechercher les autres.' : '') : 'Aucune de tes équipes NXT5 n’est reliée à ce serveur. Le capitaine peut la connecter dans NXT5.');
  }
  if (command === 'equipe choisir') {
    assertDiscordArtifactEnvironment();
    if (typeof options.nom !== 'string' || !options.nom.trim()) return executeDiscordAccount(interaction, 'equipe liste', {});
    const ctx = await resolveBotContext(discordUserId, guildId, options.nom);
    await sql(`insert into discord_user_team_choices(link_id,guild_id,team_id) values($1,$2,$3)
      on conflict(link_id,guild_id) do update set team_id=excluded.team_id,updated_at=now()`, [ctx.identityId, guildId, ctx.teamId]);
    return botMessage('Équipe sélectionnée', '**' + botText(ctx.teamName, 100) + '** devient ton équipe par défaut sur ce serveur.');
  }
  return null;
}
