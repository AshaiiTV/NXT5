import { randomBytes } from 'node:crypto';
import { sql } from './db';
import { discordError, assertDiscordArtifactEnvironment } from './discord-access';
import { botTokenHash, validBotToken, botMessage, botLink, botText, botIdentity, botTeams, resolveBotContext, saveBotPending } from './discord-bot-common';

export async function beginDiscordAccountLink(interaction: any) {
  assertDiscordArtifactEnvironment();
  const discordUser = interaction.member.user;
  const [linked] = await sql('select id from discord_user_links where discord_user_id=$1', [discordUser.id]);
  if (linked) return accountStatus(discordUser.id, interaction.guild_id, interaction.member.roles);
  const token = randomBytes(24).toString('hex');
  const label = String(discordUser.global_name || discordUser.username || discordUser.id).slice(0, 100);
  await sql(`insert into discord_account_link_requests(token_hash,discord_user_id,guild_id,discord_label,expires_at)
    values($1,$2,$3,$4,now()+interval '10 minutes')`, [botTokenHash(token), discordUser.id, interaction.guild_id, label]);
  return { ...botMessage('Lier ton compte NXT5', '1. Ouvre NXT5, connecte-toi à ton compte habituel (Google ou Discord si proposés), puis confirme ton compte.\n2. Reviens ici et vérifie la liaison.\n3. Confirme le compte affiché dans Discord.\n\nLa connexion au site avec Discord ne lie pas automatiquement le bot. Ce lien personnel expire dans 10 minutes. Il ne rejoint aucune équipe.'), components: [{ type: 1, components: [
    { type: 2, style: 5, label: 'Ouvrir NXT5', url: botLink('/bot-discord?lier=' + token) },
    { type: 2, style: 1, label: 'Vérifier la liaison', custom_id: 'nxt:link:review:' + token },
  ] }] };
}
export async function accountStatus(discordUserId: string, guildId?: string, memberRoles?: unknown) {
  const link = await botIdentity(discordUserId);
  const teams = guildId ? (await botTeams(discordUserId, guildId, memberRoles)).teams : [];
  const selected = teams.length === 1 ? teams[0] : teams.find(team => team.selected);
  return botMessage('Ton compte Discord', 'Compte NXT5 : **' + botText(link.account_name, 100) + '**.\nÉquipe active : ' + (selected ? botText(selected.name, 100) : 'à choisir') + '.\nUtilise `/nxt equipe choisir` pour sélectionner une équipe de ce serveur.\n`/nxt compte delier` révoque la liaison personnelle du bot. Les connexions Google/Discord au site se gèrent séparément dans Paramètres → Connexions associées.');
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
  return botMessage('Compte lié', 'Tu peux maintenant choisir ton équipe avec `/nxt equipe choisir nom:<équipe>`. Tes droits restent ceux de ton compte NXT5.');
}
export async function unlinkDiscordAccount(discordUserId: string) {
  assertDiscordArtifactEnvironment();
  await sql.transaction([
    sql('delete from discord_user_links where discord_user_id=$1', [discordUserId]),
    sql('update discord_account_link_requests set used_at=now() where discord_user_id=$1 and used_at is null', [discordUserId]),
  ]);
  return botMessage('Compte délié', 'La liaison personnelle du bot, les choix d’équipe et tes boutons en attente ont été révoqués. Ton compte NXT5 et ses connexions Google/Discord au site sont conservés ; celles-ci se gèrent dans Paramètres → Connexions associées.');
}
export async function executeDiscordAccount(interaction: any, command: string, options: Record<string, any>) {
  const discordUserId = interaction.member.user.id;
  const guildId = interaction.guild_id;
  if (command === 'compte lier') return beginDiscordAccountLink(interaction);
  if (command === 'compte profil') return accountStatus(discordUserId, guildId, interaction.member.roles);
  if (command === 'compte delier') {
    const identity = await botIdentity(discordUserId);
    const token = await saveBotPending({ teamId: '', teamName: '', guildId, discordUserId, userId: identity.user_id,
      role: '', canStaff: false, canManage: false, playerIds: [], timezone: 'Europe/Paris', identityId: identity.id }, command, {}, 'confirm');
    return { ...botMessage('Délier ton compte', 'Confirme la révocation de la liaison personnelle du bot avec **' + botText(identity.account_name, 100) + '**. Ton compte NXT5 et ses connexions Google/Discord au site seront conservés.'), components: [{ type: 1, components: [
      { type: 2, style: 4, label: 'Délier mon compte', custom_id: 'nxt:confirm:' + token },
      { type: 2, style: 2, label: 'Annuler', custom_id: 'nxt:cancel:' + token },
    ] }] };
  }
  if (command === 'equipe liste') {
    const { teams } = await botTeams(discordUserId, guildId, interaction.member.roles);
    return botMessage('Tes équipes sur ce serveur', teams.length ? teams.slice(0, 20).map(team => '**' + botText(team.name, 100) + '**' + (team.selected ? ' · sélectionnée' : '') + '\n`' + team.id + '`').join('\n\n') + (teams.length > 20 ? '\n\n20 premières équipes affichées. Utilise les suggestions de /nxt equipe choisir pour rechercher les autres.' : '') : 'Aucune de tes équipes NXT5 n’est reliée à ce serveur. Le capitaine peut la connecter dans NXT5.');
  }
  if (command === 'equipe choisir') {
    assertDiscordArtifactEnvironment();
    if (typeof options.nom !== 'string' || !options.nom.trim()) return executeDiscordAccount(interaction, 'equipe liste', {});
    const ctx = await resolveBotContext(discordUserId, guildId, options.nom, interaction.member.roles);
    await sql(`insert into discord_user_team_choices(link_id,guild_id,team_id) values($1,$2,$3)
      on conflict(link_id,guild_id) do update set team_id=excluded.team_id,updated_at=now()`, [ctx.identityId, guildId, ctx.teamId]);
    return botMessage('Équipe sélectionnée', '**' + botText(ctx.teamName, 100) + '** devient ton équipe par défaut sur ce serveur.');
  }
  return null;
}
