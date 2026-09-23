import { sql } from './db';
import { discordError, uuid } from './discord-access';
import { assertSubjectRateLimit } from './rate-limit';
import { discordCommandCatalog } from '../../../shared/discord-command.js';
import { buildDiscordHelp, resolveDiscordHelpInteraction } from '../../../shared/discord-help.js';
import { assertBotStaff, assertDiscordBotSchemaReady, botMessage, botTeams, loadBotPending, resolveBotContext, saveBotPending, type BotContext } from './discord-bot-common';
import { executeDiscordAccount, finishDiscordAccountLink, reviewDiscordAccountLink, unlinkDiscordAccount } from './discord-bot-account';

export function parseDiscordCommand(interaction: any) {
  const root = interaction.data?.options?.[0];
  const leaf = root?.type === 2 ? root.options?.[0] : root;
  const command = root?.type === 2 ? `${root.name} ${leaf?.name}` : root?.name;
  const entry = discordCommandCatalog.find(item => item.path === command);
  if (!entry) throw discordError('Commande inconnue. Ouvre /nxt help.');
  const options: Record<string, any> = Object.create(null);
  for (const option of leaf?.options || []) {
    const spec: any = entry.options.find(item => item.name === option.name);
    if (!spec || Object.prototype.hasOwnProperty.call(options, option.name)) throw discordError('Option de commande invalide.');
    const value = option.value;
    if (spec.type === 3 && (typeof value !== 'string' || value.length > (spec.max_length || 6000) || value.length < (spec.min_length || 0))) throw discordError('Texte de commande invalide.');
    if (spec.type === 4 && (!Number.isInteger(value) || value < spec.min_value || value > spec.max_value)) throw discordError('Valeur numérique invalide.');
    if (spec.type === 5 && typeof value !== 'boolean') throw discordError('Choisis vrai ou faux.');
    if (spec.type === 7 && (typeof value !== 'string' || !/^[0-9]{17,20}$/.test(value))) throw discordError('Salon Discord invalide.');
    if (spec.choices && !spec.choices.some(item => item.value === value)) throw discordError('Choix de commande invalide.');
    options[option.name] = value;
  }
  if (entry.options.some((spec: any) => spec.required && options[spec.name] === undefined)) throw discordError('Une option obligatoire manque. Relance la commande depuis le menu Discord.');
  return { command, options };
}
export function immediateDiscordHelp(interaction: any) {
  if (interaction.type === 2) {
    const { command, options } = parseDiscordCommand(interaction);
    if (command === 'help' || command === 'aide') return buildDiscordHelp({ page: options.rubrique, command: options.commande });
  }
  if (interaction.type === 3) {
    const route = resolveDiscordHelpInteraction(interaction.data?.custom_id, interaction.data?.values);
    if (route) return buildDiscordHelp(route);
  }
  return null;
}
export async function discordMemberTeamChoices(interaction: any) {
  const root = interaction.data?.options?.[0];
  const leaf = root?.type === 2 ? root.options?.[0] : root;
  const focused = leaf?.options?.find(option => option.focused);
  if (!focused || !['equipe','nom'].includes(focused.name) || typeof focused.value !== 'string' || focused.value.length > 100) return [];
  const command = root?.type === 2 ? `${root.name} ${leaf?.name}` : root?.name;
  const spec: any = discordCommandCatalog.find(entry => entry.path === command)?.options.find(option => option.name === focused.name);
  if (!spec?.autocomplete) return [];
  await assertDiscordBotSchemaReady();
  await assertSubjectRateLimit('discord-member-autocomplete', interaction.guild_id + ':' + interaction.member.user.id, { limit: 60, windowSeconds: 60 });
  const query = focused.value.trim().toLowerCase();
  const { teams } = await botTeams(interaction.member.user.id, interaction.guild_id, interaction.member.roles);
  return teams.filter(team => !query || `${team.name} ${team.tag || ''} ${team.id}`.toLowerCase().includes(query)).slice(0, 25)
    .map(team => ({ name: String(team.name).slice(0, 80) + ' · ' + team.id.slice(-8), value: team.id }));
}
function assertCommandRole(ctx: BotContext, command: string) {
  const access = discordCommandCatalog.find(entry => entry.path === command)?.access;
  if (!access) throw discordError('Commande inconnue.');
  if (access === 'Staff' || access === 'Responsable') assertBotStaff(ctx, access === 'Responsable');
}
async function runTeamCommand(ctx: BotContext, command: string, options: Record<string, any>, confirmed = false) {
  assertCommandRole(ctx, command);
  const [{ executeDiscordRead }, { executeDiscordAction }] = await Promise.all([import('./discord-bot-read'), import('./discord-bot-actions')]);
  const result = await executeDiscordRead(ctx, command, options) || await executeDiscordAction(ctx, command, options, confirmed);
  if (!result) throw discordError('Commande inconnue. Ouvre /nxt help.');
  if (!result.modal) return result;
  const form = result.modal;
  const token = await saveBotPending(ctx, command, form.options || options, 'modal', form);
  return { ...botMessage(form.title, 'Ouvre le formulaire, complète les champs puis vérifie le résultat avant confirmation.'), components: [{ type: 1, components: [
    { type: 2, style: 1, label: 'Ouvrir le formulaire', custom_id: 'nxt:modal:open:' + token },
    { type: 2, style: 2, label: 'Annuler', custom_id: 'nxt:cancel:' + token },
  ] }] };
}
export async function openDiscordBotModal(interaction: any) {
  await assertDiscordBotSchemaReady();
  const token = String(interaction.data.custom_id).replace(/^nxt:modal:open:/, '');
  const pending = await loadBotPending(token, interaction.member.user.id, interaction.guild_id);
  if (pending.kind !== 'modal') throw discordError('Formulaire invalide.');
  const ctx = await resolveBotContext(interaction.member.user.id, interaction.guild_id, pending.team_id, interaction.member.roles);
  assertCommandRole(ctx, pending.command);
  const fields = pending.form?.fields;
  if (!Array.isArray(fields) || !fields.length || fields.length > 5) throw discordError('Formulaire indisponible.');
  return { type: 9, data: { custom_id: 'nxt:modal:submit:' + token, title: String(pending.form.title).slice(0, 45), components: fields.map(field => ({
    type: 1, components: [{ type: 4, custom_id: field.id, label: String(field.label).slice(0, 45), style: field.style === 2 ? 2 : 1,
      required: field.required !== false, max_length: Math.min(field.max_length || 1000, 4000), ...(field.value != null ? { value: String(field.value).slice(0, 4000) } : {}) }],
  })) } };
}
async function runBotComponent(interaction: any) {
  const customId = String(interaction.data?.custom_id || '');
  const discordUserId = interaction.member.user.id;
  const guildId = interaction.guild_id;
  const parts = customId.split(':');
  if (customId.startsWith('nxt:link:review:')) return reviewDiscordAccountLink(parts[3], discordUserId, guildId);
  if (['nxt:link:confirm:', 'nxt:link:cancel:'].some(prefix => customId.startsWith(prefix))) return finishDiscordAccountLink(parts[3], discordUserId, guildId, parts[2] === 'cancel');
  if (customId.startsWith('nxt:confirm:') || customId.startsWith('nxt:cancel:') || customId.startsWith('nxt:modal:submit:')) {
    const token = parts[parts.length - 1];
    // Validate and re-resolve membership before consuming a button. The stored
    // team is authoritative even if the user's active selection has changed.
    const pending = await loadBotPending(token, discordUserId, guildId);
    if (customId.startsWith('nxt:cancel:')) {
      await loadBotPending(token, discordUserId, guildId, true);
      return botMessage('Action annulée', 'Aucune modification n’a été effectuée.');
    }
    if (pending.command === 'compte delier' && pending.kind === 'confirm' && customId.startsWith('nxt:confirm:')) {
      await loadBotPending(token, discordUserId, guildId, true);
      return unlinkDiscordAccount(discordUserId);
    }
    const ctx = await resolveBotContext(discordUserId, guildId, pending.team_id, interaction.member.roles);
    assertCommandRole(ctx, pending.command);
    const options = { ...pending.options };
    const submitted = customId.startsWith('nxt:modal:submit:');
    if ((submitted && (interaction.type !== 5 || pending.kind !== 'modal')) || (!submitted && pending.kind !== 'confirm')) throw discordError('Ce formulaire ne correspond pas à l’action.');
    if (submitted) {
      const components = interaction.data.components || [];
      const values = components.flatMap(row => row.components || (row.component ? [row.component] : []));
      const fields = pending.form?.fields || [];
      for (const field of fields) {
        const entry = values.find(value => value.custom_id === field.id);
        if (!entry || typeof entry.value !== 'string' || entry.value.length > (field.max_length || 1000) || (field.required !== false && !entry.value.trim())) throw discordError('Complète les champs du formulaire avant de continuer.');
        options[field.id] = entry.value;
      }
    }
    await loadBotPending(token, discordUserId, guildId, true);
    return runTeamCommand(ctx, pending.command, options, !submitted);
  }
  if (customId.startsWith('nxt:read:bilan:') || customId.startsWith('nxt:read:groupe:')) {
    const ctx = await resolveBotContext(discordUserId, guildId, uuid(parts[3], 'Équipe'), interaction.member.roles);
    const value = interaction.data?.values?.[0];
    if (typeof value !== 'string') throw discordError('Choisis une période ou un groupe.');
    if (parts[2] === 'bilan' && !['semaine','mois','session'].includes(value)) throw discordError('Période invalide.');
    return runTeamCommand(ctx, 'bilan', parts[2] === 'bilan' ? { periode: value } : { periode: 'session', groupe: uuid(value, 'Groupe') });
  }
  if (customId.startsWith('nxt:read:game:') || customId.startsWith('nxt:read:review:')) {
    const ctx = await resolveBotContext(discordUserId, guildId, uuid(parts[3], 'Équipe'), interaction.member.roles);
    const id = uuid(interaction.data?.values?.[0], parts[2] === 'game' ? 'Game' : 'Review');
    return runTeamCommand(ctx, parts[2] === 'game' ? 'game voir' : 'review voir', parts[2] === 'game' ? { game: id } : { review: id });
  }
  if (customId.startsWith('nxt:presence:') || customId.startsWith('nxt:review:read:')) {
    const presence = parts[1] === 'presence';
    const id = uuid(presence ? parts[2] : parts[3], presence ? 'Événement' : 'Review');
    const [row] = await sql(presence ? 'select team_id from discord_team_events where id=$1' : 'select team_id from reports where id=$1', [id]);
    if (!row) throw discordError('Ce contenu n’est plus disponible.', 404);
    const version = Number(parts[4]);
    if (!presence && (!Number.isSafeInteger(version) || version < 1)) throw discordError('La version de cette review est invalide. Ouvre la review actuelle.');
    const ctx = await resolveBotContext(discordUserId, guildId, row.team_id, interaction.member.roles);
    return runTeamCommand(ctx, presence ? 'presence repondre' : 'review lire', presence
      ? { evenement: id, statut: parts[3] } : { review: id, version });
  }
  throw discordError('Ce bouton n’est plus disponible. Relance /nxt help.');
}
export async function executeDiscordBot(interaction: any) {
  await assertDiscordBotSchemaReady();
  await assertSubjectRateLimit('discord-bot-command', interaction.guild_id + ':' + interaction.member.user.id, { limit: 30, windowSeconds: 60 });
  const parsed = interaction.type === 2 ? parseDiscordCommand(interaction) : null;
  const customId = String(interaction.data?.custom_id || '');
  // Analytics records an action label, never the capability token or a private
  // game/event/report identifier carried by a component's custom_id.
  const componentLabels: [string, string][] = [
    ['nxt:confirm:', 'confirmation'], ['nxt:cancel:', 'annulation'], ['nxt:modal:', 'formulaire'],
    ['nxt:link:', 'compte liaison'], ['nxt:presence:', 'presence repondre'], ['nxt:review:read:', 'review lire'],
    ['nxt:read:bilan:', 'bilan'], ['nxt:read:groupe:', 'bilan'], ['nxt:read:game:', 'game voir'], ['nxt:read:review:', 'review voir'],
  ];
  const command = parsed?.command || componentLabels.find(([prefix]) => customId.startsWith(prefix))?.[1] || 'bouton inconnu';
  const claimed = await sql(`insert into discord_interaction_receipts(interaction_id,guild_id,discord_user_id,command_name)
    values($1,$2,$3,$4) on conflict(interaction_id) do nothing returning interaction_id`, [interaction.id, interaction.guild_id, interaction.member.user.id, command.slice(0, 40)]);
  if (!claimed.length) return botMessage('Commande déjà reçue', 'Cette interaction a déjà été traitée ou est en cours. Consulte le résultat précédent avant de recommencer.');
  try {
    let result;
    if (parsed) {
      result = await executeDiscordAccount(interaction, parsed.command, parsed.options);
      if (!result) {
        const ctx = await resolveBotContext(interaction.member.user.id, interaction.guild_id, parsed.options.equipe, interaction.member.roles);
        result = await runTeamCommand(ctx, parsed.command, parsed.options);
      }
    } else result = await runBotComponent(interaction);
    await sql("update discord_interaction_receipts set status='completed',completed_at=now() where interaction_id=$1", [interaction.id]);
    return result;
  } catch (error: any) {
    await sql("update discord_interaction_receipts set status='failed',error_code=$2,completed_at=now() where interaction_id=$1", [interaction.id, String(error?.code || 'COMMAND_FAILED').slice(0, 100)]);
    throw error;
  }
}
export function discordBotFailure(error: any) {
  const status = Number(error?.status) || 500;
  const message = status === 429 ? 'Trop de commandes rapprochées. Patiente un instant puis réessaie.'
    : status < 500 || String(error?.code || '').startsWith('DISCORD_') ? error.message : 'Le résultat n’a pas pu être confirmé. Vérifie les données dans NXT5 avant de relancer la commande.';
  return botMessage('Commande indisponible', message);
}
