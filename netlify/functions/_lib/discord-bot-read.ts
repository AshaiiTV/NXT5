import type { BotContext } from './discord-bot-common';
import { sql } from './db';
import { discordError, uuid } from './discord-access';
import { cleanDiscordText, discordRequest } from './discord-client';
import { getDiscordConfig, isDiscordId } from './discord-config';
import { buildGamePublicationSnapshot, publicationNumber } from '../../../shared/publications/game-publication.js';
import { trendMatchTimestamp } from '../../../src/utils/trends.js';

type Row = Record<string, any>;
type Field = { name: string; value: string; inline?: boolean };
type Period = { from: Date; to: Date; label: string; days: number };
const DAY = 86_400_000;
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const READS = new Set(['derniere', 'game voir', 'game chercher', 'game comparer', 'bilan', 'stats equipe', 'stats tendance',
  'stats champions', 'joueur profil', 'joueur stats', 'joueur comparer', 'objectifs liste', 'pool voir', 'pool suggerer',
  'draft compositions', 'draft preparer', 'planning', 'review liste', 'review voir', 'review lectures']);
const text = (value: unknown, limit = 200) => cleanDiscordText(value, limit);
const number = (value: unknown, digits = 1) => {
  const n = publicationNumber(value);
  return n === null ? 'Indisponible' : n.toLocaleString('fr-FR', { maximumFractionDigits: digits });
};
const jsonObject = (value: any): Row => {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const jsonArray = (value: any): any[] => {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value : [];
};
const timestamp = (value: any, style = 'f') => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `<t:${Math.floor(date.getTime() / 1000)}:${style}>` : 'Date indisponible';
};
function assertStaff(ctx: BotContext) {
  if (!ctx.canStaff) throw discordError('Cette commande est réservée au staff de cette équipe.', 403, 'DISCORD_ROLE_FORBIDDEN');
}
function link(ctx: BotContext, path: string, params: Row = {}) {
  const origin = getDiscordConfig().siteUrl;
  if (!origin) throw discordError('Adresse NXT5 non configurée.', 503, 'DISCORD_NOT_CONFIGURED');
  const url = new URL(path, origin);
  url.searchParams.set('team', ctx.teamId);
  for (const [key, value] of Object.entries(params)) if (value != null && value !== '') url.searchParams.set(key, String(value));
  return url.toString();
}
function message(ctx: BotContext, title: string, description: string, fields: Field[] = [], path = '/equipes', params: Row = {}) {
  const trimmed = description.slice(0, 3000);
  const kept: Field[] = [];
  let shortened = trimmed.length !== description.length || fields.length > 25;
  let remaining = 5700 - title.slice(0, 200).length - trimmed.length;
  for (const field of fields.slice(0, 25)) {
    const name = field.name.slice(0, 200) || 'Détail';
    const available = Math.min(1024, remaining - name.length);
    if (available < 40) { shortened = true; break; }
    if (field.value.length > available) shortened = true;
    const value = field.value.length > available ? `${field.value.slice(0, available - 24)}… Suite sur NXT5.` : field.value;
    kept.push({ name, value: value || 'Indisponible', inline: Boolean(field.inline) });
    remaining -= name.length + value.length;
  }
  return { flags: 64, allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
    embeds: [{ title: title.slice(0, 200), description: trimmed, color: 0x67e8f9,
      fields: kept, footer: { text: `${text(ctx.teamName, 100)} · NXT5 · Consultation privée${shortened ? ' · Aperçu abrégé, suite sur NXT5' : ''}` } }],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Voir sur NXT5', url: link(ctx, path, params) }] }] };
}
function period(value: unknown, defaultDays = 7): Period {
  const key = String(value || (defaultDays === 30 ? 'mois' : 'semaine'));
  const days = ({ aujourdhui: 1, jour: 1, semaine: 7, mois: 30, '7': 7, '30': 30 } as Row)[key];
  if (!days) throw discordError('Période invalide : choisis semaine ou mois. Pour une session, sélectionne son groupe de games.');
  const to = new Date();
  return { to, from: new Date(to.getTime() - days * DAY), days, label: `${days} derniers jours` };
}
function periodLabel(p: Period) { return `${p.label} · ${timestamp(p.from, 'd')} → ${timestamp(p.to, 'd')}`; }

// The same preference as trendMatchTimestamp: date played first, import date as a fallback.
// Only finite, bounded numeric timestamps are cast. User-controlled JSON never becomes SQL.
function dateExpression(key: string) {
  const value = `m.raw->'info'->>'${key}'`;
  return `case when ${value} ~ '^[0-9]{9,13}$' then to_timestamp((${value})::double precision / case when (${value})::numeric < 100000000000 then 1 else 1000 end) end`;
}
export const DISCORD_MATCH_TIME_SQL = `coalesce(${dateExpression('gameStartTimestamp')},${dateExpression('gameCreation')},m.created_at)`;
const MATCH_TIME = DISCORD_MATCH_TIME_SQL;
const MATCH_DATE_SOURCE = `case when coalesce(${dateExpression('gameStartTimestamp')},${dateExpression('gameCreation')}) is null then 'import' else 'game' end`;
const MATCH_COLUMNS = `m.id,m.team_id,m.game_id,m.opponent,m.result,m.side,m.duration,m.duration_seconds,m.patch,m.created_at,
  m.category_id,m.category_ids,${MATCH_TIME} as played_at,${MATCH_DATE_SOURCE} as date_source,
  jsonb_build_object('info',coalesce(m.raw->'info','{}'::jsonb)-'participants'-'timeline'-'frames','nxt5Label',m.raw->'nxt5Label') as raw,
  coalesce((select jsonb_agg(to_jsonb(p)-'raw' order by p.team_key,p.role,p.id) from match_participants p where p.match_id=m.id),'[]'::jsonb) as participants`;

async function resolveNamed(ctx: BotContext, table: 'players' | 'match_categories' | 'match_archives', value: unknown, label: string) {
  const name = String(value ?? '').trim();
  if (!name || name.length > 160) throw discordError(`${label} requis ou invalide.`);
  if (name.includes('-') && /^[a-f0-9-]+$/i.test(name)) uuid(name, label);
  const rows = await sql(`select * from ${table} where team_id=$1 and (id::text=$2 or lower(name)=lower($2)) order by id limit 2`, [ctx.teamId, name]);
  if (!rows.length) throw discordError(`${label} introuvable dans cette équipe.`, 404);
  if (rows.length > 1) throw discordError(`Plusieurs ${label.toLowerCase()}s portent ce nom : utilise leur identifiant NXT5.`);
  return rows[0];
}
async function player(ctx: BotContext, option: unknown, ownOnly = false) {
  const target = option || (ctx.playerIds.length === 1 ? ctx.playerIds[0] : '');
  if (!target) throw discordError('Précise le joueur avec son nom exact ou son identifiant NXT5.');
  const row = await resolveNamed(ctx, 'players', target, 'Joueur');
  if (ownOnly && !ctx.canStaff && !ctx.playerIds.includes(row.id)) {
    throw discordError('Tu peux consulter uniquement tes objectifs individuels.', 403, 'DISCORD_PLAYER_FORBIDDEN');
  }
  return row;
}
async function loadMatches(ctx: BotContext, options: Row, selected: Period | null, range?: { from: Date; to: Date }) {
  const values: any[] = [ctx.teamId];
  const clauses = ['m.team_id=$1'];
  const add = (value: any) => { values.push(value); return '$' + values.length; };
  let scope = '';
  if (options.categorie) {
    const category = await resolveNamed(ctx, 'match_categories', options.categorie, 'Catégorie');
    const param = add(category.id);
    clauses.push(`(m.category_id=${param}::uuid or m.category_ids @> jsonb_build_array(${param}::text))`);
    scope += ` · Catégorie : ${text(category.name, 70)}`;
  }
  if (options.groupe) {
    const group = await resolveNamed(ctx, 'match_archives', options.groupe, 'Groupe');
    const ids = jsonArray(group.match_ids).filter(id => typeof id === 'string' && UUID.test(id));
    clauses.push(`m.id=any(${add(ids)}::uuid[])`);
    scope += ` · Groupe : ${text(group.name, 100)}`;
  }
  if (options.playerId) clauses.push(`exists(select 1 from match_participants p where p.match_id=m.id and p.player_id=${add(options.playerId)}::uuid and p.team_key='ALLY')`);
  const interval = range || selected;
  if (interval) clauses.push(`${MATCH_TIME} >= ${add(interval.from.toISOString())}::timestamptz and ${MATCH_TIME} <= ${add(interval.to.toISOString())}::timestamptz`);
  const rows = await sql(`select ${MATCH_COLUMNS} from matches m where ${clauses.join(' and ')} order by ${MATCH_TIME} desc,m.id desc limit 1001`, values);
  if (rows.length > 1000) throw discordError('Plus de 1 000 games correspondent à ce filtre. Réduis la période ou choisis un groupe pour calculer un bilan complet.');
  return { rows, scope };
}
function snapshot(ctx: BotContext, match: Row) {
  // The shared model accepts formatted duration or gameDuration. Older imports sometimes only stored seconds.
  const duration = Number(match.duration_seconds);
  const normalized = !match.duration && Number.isFinite(duration) && duration > 0
    ? { ...match, duration: `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` } : match;
  return buildGamePublicationSnapshot({ team: { id: ctx.teamId, name: ctx.teamName }, match: normalized } as any) as Row;
}
function aggregate(ctx: BotContext, matches: Row[]) {
  const wins = matches.filter(m => m.result === 'Victoire').length;
  const losses = matches.filter(m => m.result === 'Défaite').length;
  const snapshots = matches.map(m => snapshot(ctx, m));
  const metrics = ['kills', 'deaths', 'gold', 'vision'].map(key => {
    const values = snapshots.map(s => s.facts[key]?.ally).filter(v => typeof v === 'number' && Number.isFinite(v));
    return { key, value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, count: values.length };
  });
  return { wins, losses, unknown: matches.length - wins - losses, count: matches.length, winrate: wins + losses ? wins / (wins + losses) * 100 : null, metrics };
}
function aggregateFields(summary: ReturnType<typeof aggregate>): Field[] {
  return [{ name: 'Résultats', value: `${summary.count} games · ${summary.wins} victoires · ${summary.losses} défaites${summary.unknown ? ` · ${summary.unknown} résultats inconnus` : ''}\nTaux de victoire : ${number(summary.winrate)}${summary.winrate === null ? '' : ' %'} (résultats connus)` },
    ...summary.metrics.map(m => ({ name: ({ kills: 'Kills / game', deaths: 'Morts / game', gold: 'Or / game', vision: 'Vision / game' } as Row)[m.key],
      value: `${number(m.value)} · ${m.count}/${summary.count} games renseignées`, inline: true }))];
}
function matchLine(ctx: BotContext, match: Row) {
  return `${match.date_source === 'import' ? 'Importée ' : ''}${timestamp(match.played_at || trendMatchTimestamp(match), 'd')} · **${text(match.result || 'Résultat inconnu', 30)}** · ${text(match.raw?.nxt5Label || match.opponent || match.game_id, 80)}\nID : \`${match.id}\` · [Voir la game](${link(ctx, '/statistiques', { match: match.id })})`;
}
function dateCoverage(matches: Row[]) {
  const fallback = matches.filter(m => m.date_source === 'import').length;
  return fallback ? `\nDate de partie indisponible pour ${fallback} game(s) : leur date d’import est utilisée pour le filtre.` : '';
}
async function singleMatch(ctx: BotContext, value: unknown) {
  const id = uuid(value, 'Game');
  const rows = await sql(`select m.*,${MATCH_TIME} as played_at,${MATCH_DATE_SOURCE} as date_source,
    coalesce((select jsonb_agg(to_jsonb(p) order by p.team_key,p.role,p.id) from match_participants p where p.match_id=m.id),'[]'::jsonb) as participants
    from matches m where m.team_id=$1 and m.id=$2 limit 1`, [ctx.teamId, id]);
  if (!rows[0]) throw discordError('Game introuvable dans cette équipe.', 404);
  return rows[0];
}
async function gameCard(ctx: BotContext, match: Row) {
  const s = snapshot(ctx, match);
  const fields: Field[] = [
    { name: 'Game', value: `ID : \`${match.id}\`\n${match.date_source === 'import' ? 'Date d’import (date de partie inconnue) : ' : ''}${timestamp(match.played_at)} · ${text(s.context.result)} · ${text(s.context.duration || 'Durée indisponible')}\nPatch : ${text(s.context.patch || 'Indisponible')}` },
    ...['kills', 'gold', 'dragons', 'vision'].map(key => ({ name: ({ kills: 'Kills', gold: 'Or', dragons: 'Dragons', vision: 'Vision' } as Row)[key] + ' · équipe / adversaire',
      value: `${number(s.facts[key]?.ally)} / ${number(s.facts[key]?.enemy)}`, inline: true })),
    { name: 'Compositions · équipe / adversaire', value: ['ALLY', 'ENEMY'].map(team => s.participants.filter(p => p.teamKey === team).map(p => `${text(p.role, 8)} ${text(p.champion, 35)}`).join(' · ') || 'Indisponible').join('\n') },
  ];
  const payload = message(ctx, 'Game · ' + text(match.opponent || match.game_id, 120), text(ctx.teamName, 100), fields, '/statistiques', { match: match.id });
  // Reuse the existing attachment, without rendering or publishing another message.
  const published = await sql(`select guild_id,channel_id,message_id from discord_publications where team_id=$1 and entity_id=$2
    and guild_id=$3 and state='published' and message_id is not null and published_revision=$4 and source_deleted_at is null
    order by updated_at desc limit 1`, [ctx.teamId, match.id, ctx.guildId, match.publication_revision || 0]);
  const publication = published[0];
  if (publication && [publication.channel_id, publication.message_id, publication.guild_id].every(isDiscordId)) {
    try {
      const source = await discordRequest(`/channels/${publication.channel_id}/messages/${publication.message_id}`);
      const attachment = (source.attachments || []).find((a: Row) => {
        try { const u = new URL(a.url); return u.protocol === 'https:' && ['cdn.discordapp.com', 'media.discordapp.net'].includes(u.hostname) && u.pathname.startsWith('/attachments/') && /\.png$/i.test(u.pathname); } catch { return false; }
      });
      if (attachment) (payload.embeds[0] as Row).image = { url: attachment.url };
    } catch (error) {
      // A removed attachment or Discord outage must not hide the accessible game itself.
      if (!error?.name?.includes('Discord') && error?.code !== 'DISCORD_NOT_CONFIGURED') throw error;
    }
  }
  return payload;
}

async function games(ctx: BotContext, command: string, options: Row) {
  if (command === 'derniere') {
    const latest = await sql(`select m.id from matches m where m.team_id=$1 order by ${MATCH_TIME} desc,m.id desc limit 1`, [ctx.teamId]);
    return latest[0] ? gameCard(ctx, await singleMatch(ctx, latest[0].id)) : message(ctx, 'Dernière game', 'Aucune game importée pour cette équipe. Sur le site, Games → Importer une game permet de télécharger NXT5 Importer pour Windows ou Mac, puis de charger le JSON. Le capitaine ou le staff autorisé peut réaliser cet import après avoir préparé cinq profils joueurs distincts.', [], '/games');
  }
  if (command === 'game voir') return gameCard(ctx, await singleMatch(ctx, options.game));
  if (command === 'game comparer') {
    const [a, b] = await Promise.all([singleMatch(ctx, options.game_a), singleMatch(ctx, options.game_b)]);
    const [sa, sb] = [snapshot(ctx, a), snapshot(ctx, b)];
    return message(ctx, 'Comparer deux games', `**A** ${matchLine(ctx, a)}\n\n**B** ${matchLine(ctx, b)}\n\nIndicateurs finaux de notre équipe. Des durées et adversaires différents limitent la comparaison.`,
      [{ name: 'Durée et patch', value: `A : ${text(sa.context.duration || 'Indisponible', 25)} · patch ${text(sa.context.patch || 'Indisponible', 25)}\nB : ${text(sb.context.duration || 'Indisponible', 25)} · patch ${text(sb.context.patch || 'Indisponible', 25)}` }, ...['kills', 'deaths', 'gold', 'vision'].map(key => {
        const va = sa.facts[key]?.ally, vb = sb.facts[key]?.ally;
        return { name: ({ kills: 'Kills', deaths: 'Morts', gold: 'Or', vision: 'Vision' } as Row)[key], value: `A : ${number(va)} · B : ${number(vb)} · Écart B − A : ${number(va == null || vb == null ? null : vb - va)}` };
      })], '/statistiques', { match: b.id });
  }
  if (command === 'bilan' && !options.periode && !options.groupe) {
    const result = message(ctx, 'Choisis la période du bilan', 'Une session correspond à un groupe de games enregistré dans NXT5. Tu peux aussi demander les 7 ou 30 derniers jours.', [], '/games');
    result.components.unshift({ type: 1, components: [{ type: 3, custom_id: `nxt:read:bilan:${ctx.teamId}`, placeholder: 'Choisir une période', options: [
      { label: 'Une session', value: 'session' }, { label: '7 derniers jours', value: 'semaine' }, { label: '30 derniers jours', value: 'mois' },
    ] }] } as any);
    return result;
  }
  if (command === 'bilan' && options.periode === 'session' && !options.groupe) {
    const groups = await sql('select id,name from match_archives where team_id=$1 order by created_at desc limit 25', [ctx.teamId]);
    const result = message(ctx, 'Choisis un groupe de games', groups.length ? 'Sélectionne la session dans les groupes récents, ou utilise son nom exact dans l’option groupe.' : 'Aucun groupe enregistré. Choisis semaine ou mois dans /nxt bilan.',
      groups.slice(0, 8).map(g => ({ name: text(g.name, 100), value: `ID : \`${g.id}\`` })), '/games');
    if (groups.length) result.components.unshift({ type: 1, components: [{ type: 3, custom_id: `nxt:read:groupe:${ctx.teamId}`, placeholder: 'Choisir un groupe',
      options: groups.map(g => ({ label: String(g.name).slice(0, 100), value: g.id })) }] } as any);
    return result;
  }
  const selected = options.groupe && (!options.periode || options.periode === 'session') ? null : period(options.periode);
  const { rows, scope } = await loadMatches(ctx, options, selected);
  const range = selected ? periodLabel(selected) : rows.length ? `${timestamp(rows[rows.length - 1].played_at, 'd')} → ${timestamp(rows[0].played_at, 'd')}` : 'Groupe sélectionné';
  if (command === 'game chercher') {
    const result = message(ctx, 'Games de l’équipe', `${range}${scope}\n${rows.length} game(s) trouvée(s)${rows.length > 10 ? ' · 10 plus récentes ci-dessous ; toutes sur NXT5.' : '.'}${dateCoverage(rows)}`,
      rows.slice(0, 10).map((m, i) => ({ name: `Game ${i + 1}`, value: matchLine(ctx, m) })), '/games');
    if (rows.length) result.components.unshift({ type: 1, components: [{ type: 3, custom_id: `nxt:read:game:${ctx.teamId}`,
      placeholder: 'Ouvrir une game', options: rows.slice(0, 10).map(m => ({ label: String(m.opponent || m.game_id).slice(0, 85), description: String(m.result || 'Résultat inconnu'), value: m.id })) }] } as any);
    return result;
  }
  const summary = aggregate(ctx, rows);
  return message(ctx, command === 'bilan' ? 'Bilan de session' : 'Statistiques d’équipe', `${range}${scope}\nUniquement les games importées. Les moyennes portent sur les games renseignées, dont les cinq participants alliés sont présents.${dateCoverage(rows)}`,
    [...aggregateFields(summary), ...(rows.length ? [{ name: 'Games récentes', value: rows.slice(0, 3).map(m => matchLine(ctx, m)).join('\n\n') }] : [])], '/statistiques');
}

function playerSummary(ctx: BotContext, matches: Row[], playerId: string) {
  const values = matches.flatMap(match => {
    const original = jsonArray(match.participants).find(p => p.player_id === playerId && p.team_key === 'ALLY');
    if (!original) return [];
    // Keep player identity alongside the shared numeric normalisation.
    const normalized = snapshot(ctx, { ...match, participants: [original] }).participants[0];
    return [{ ...normalized, match }];
  });
  const avg = (key: string) => {
    const known = values.map(row => row[key]).filter(v => typeof v === 'number' && Number.isFinite(v));
    return { value: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null, count: known.length };
  };
  return { count: values.length, wins: values.filter(p => p.match.result === 'Victoire').length,
    losses: values.filter(p => p.match.result === 'Défaite').length, avg,
    champions: [...new Set(values.map(p => p.champion))].filter(Boolean) };
}
function playerFields(summary: ReturnType<typeof playerSummary>): Field[] {
  return [{ name: 'Échantillon', value: `${summary.count} games · ${summary.wins} victoires · ${summary.losses} défaites\nChampions : ${summary.champions.slice(0, 12).map(c => text(c, 35)).join(', ') || 'Aucun'}` },
    ...['kills', 'deaths', 'assists', 'cs', 'vision'].map(key => {
      const stat = summary.avg(key);
      return { name: ({ kills: 'Kills', deaths: 'Morts', assists: 'Assists', cs: 'CS', vision: 'Vision' } as Row)[key] + ' / game', value: `${number(stat.value)} · ${stat.count}/${summary.count} games`, inline: true };
    })];
}
async function players(ctx: BotContext, command: string, options: Row) {
  const p = await player(ctx, options.joueur);
  const selected = period(options.periode, 30);
  const range = command === 'joueur comparer' ? { from: new Date(selected.from.getTime() - selected.days * DAY), to: selected.to } : undefined;
  const { rows } = await loadMatches(ctx, { playerId: p.id }, selected, range);
  const current = rows.filter(m => new Date(m.played_at).getTime() >= selected.from.getTime());
  const summary = playerSummary(ctx, current, p.id);
  if (command === 'joueur comparer') {
    const previous = playerSummary(ctx, rows.filter(m => new Date(m.played_at).getTime() < selected.from.getTime()), p.id);
    return message(ctx, 'Progression · ' + text(p.name, 100), `${periodLabel(selected)} comparés aux ${selected.days} jours précédents.\nActuel : ${summary.count} games · Précédent : ${previous.count} games. Comparaison descriptive ; aucune note automatique.${dateCoverage(rows)}`,
      ['kills', 'deaths', 'assists', 'cs', 'vision'].map(key => {
        const a = summary.avg(key), b = previous.avg(key);
        return { name: key.toUpperCase() + ' / game', value: `Actuel : ${number(a.value)} (${a.count}) · Précédent : ${number(b.value)} (${b.count})\nÉcart : ${number(a.value == null || b.value == null ? null : a.value - b.value)}` };
      }), '/mon-profil', { player: p.id });
  }
  let fields = playerFields(summary);
  if (command === 'joueur profil') {
    const [pool, activeGoals] = await Promise.all([
      sql('select champion,status from champion_pool where team_id=$1 and player_id=$2 order by champion limit 10', [ctx.teamId, p.id]),
      ctx.canStaff || ctx.playerIds.includes(p.id) ? goalRows(ctx, p) : Promise.resolve([]),
    ]);
    fields = [
      { name: 'Profil', value: `ID : \`${p.id}\`\nRôle : ${text(p.role, 25)} · Roster : ${text(p.roster_status, 25)}\nCompte Riot : ${text(p.riot_id || 'Non renseigné', 100)}` },
      { name: 'Pool renseigné', value: pool.map(c => `${text(c.champion, 45)} (${text(c.status, 25)})`).join(' · ') || 'Aucun champion renseigné' },
      ...fields,
      ...(activeGoals.length ? [{ name: 'Objectifs accessibles', value: activeGoals.slice(0, 3).map(g => `• ${text(g.title, 160)}`).join('\n') }] : []),
      ...(current.length ? [{ name: 'Dernières games', value: current.slice(0, 3).map(m => matchLine(ctx, m)).join('\n\n') }] : []),
    ];
  }
  return message(ctx, (command === 'joueur profil' ? 'Profil · ' : 'Statistiques · ') + text(p.name, 100), periodLabel(selected) + dateCoverage(current), fields, '/mon-profil', { player: p.id });
}
async function trends(ctx: BotContext, options: Row) {
  const selected = period(options.periode);
  const { rows } = await loadMatches(ctx, options, null, { from: new Date(selected.from.getTime() - selected.days * DAY), to: selected.to });
  const current = aggregate(ctx, rows.filter(m => new Date(m.played_at).getTime() >= selected.from.getTime()));
  const previous = aggregate(ctx, rows.filter(m => new Date(m.played_at).getTime() < selected.from.getTime()));
  return message(ctx, 'Tendance de l’équipe', `${periodLabel(selected)} comparés aux ${selected.days} jours précédents.\nActuel : ${current.count} games · Précédent : ${previous.count} games. Les changements de roster, de durée et d’adversaire influencent les résultats.${dateCoverage(rows)}`,
    [{ name: 'Taux de victoire', value: `Actuel : ${number(current.winrate)} % · Précédent : ${number(previous.winrate)} %\nÉcart : ${number(current.winrate == null || previous.winrate == null ? null : current.winrate - previous.winrate)} points` },
      ...current.metrics.map((metric, i) => ({ name: ({ kills: 'Kills', deaths: 'Morts', gold: 'Or', vision: 'Vision' } as Row)[metric.key] + ' / game',
        value: `Actuel : ${number(metric.value)} (${metric.count}) · Précédent : ${number(previous.metrics[i].value)} (${previous.metrics[i].count})\nÉcart : ${number(metric.value == null || previous.metrics[i].value == null ? null : metric.value - previous.metrics[i].value)}` }))], '/tendances');
}
async function champions(ctx: BotContext, options: Row) {
  const selected = period(options.periode, 30);
  const p = options.joueur ? await player(ctx, options.joueur) : null;
  const { rows } = await loadMatches(ctx, { playerId: p?.id }, selected);
  const stats = new Map<string, { games: Set<string>; wins: number; losses: number }>();
  for (const match of rows) {
    const seen = new Set<string>();
    for (const participant of jsonArray(match.participants)) {
      if (participant.team_key !== 'ALLY' || (p && participant.player_id !== p.id) || !participant.champion || seen.has(participant.champion)) continue;
      seen.add(participant.champion);
      const item = stats.get(participant.champion) || { games: new Set<string>(), wins: 0, losses: 0 };
      item.games.add(match.id); item.wins += Number(match.result === 'Victoire'); item.losses += Number(match.result === 'Défaite');
      stats.set(participant.champion, item);
    }
  }
  const ordered = [...stats.entries()].sort((a, b) => b[1].games.size - a[1].games.size || a[0].localeCompare(b[0]));
  return message(ctx, 'Champions joués' + (p ? ' · ' + text(p.name, 70) : ''), `${periodLabel(selected)} · ${rows.length} games importées.\nPetits échantillons : ces résultats ne suffisent pas à classer la maîtrise des champions.${dateCoverage(rows)}`,
    ordered.slice(0, 15).map(([name, s]) => ({ name: text(name, 100), value: `${s.games.size} games · ${s.wins} V / ${s.losses} D · ${number(s.wins + s.losses ? s.wins / (s.wins + s.losses) * 100 : null)} %`, inline: true })), '/draft/pool');
}

async function goalRows(ctx: BotContext, target?: Row | null, completed = false) {
  const ids = target ? [target.id] : ctx.playerIds;
  return sql(`select g.id,g.player_id,g.title,g.status,g.due_at,g.created_at,g.source,p.name as player_name,g.metric,g.operator,g.target_value,
    coalesce((select jsonb_agg(to_jsonb(n)) from (
      select note,created_at from discord_goal_updates where team_id=g.team_id and goal_id=g.id and g.source='team'
      union all select note,created_at from discord_player_goal_updates where team_id=g.team_id and goal_id=g.id and g.source='player'
      order by created_at desc limit 2
    ) n),'[]'::jsonb) as updates from (
    select id,team_id,player_id,title,status,null::timestamptz as due_at,created_at,updated_at,'player' as source,metric,operator,target_value from player_goals
    union all select id,team_id,player_id,title,status,due_at,created_at,updated_at,'team' as source,null,null,null from discord_team_goals
    ) g left join players p on p.id=g.player_id and p.team_id=g.team_id
    where g.team_id=$1 and (case when $5::boolean then g.status in ('completed','archived') else g.status='active' end)
    and ($2::boolean or g.player_id is null or g.player_id=any($3::uuid[]))
    and ($4::uuid is null or g.player_id=$4::uuid) order by case when $5::boolean then g.updated_at end desc,g.due_at nulls last,g.created_at desc limit 51`,
  [ctx.teamId, ctx.canStaff, ids, target?.id || null, completed]);
}
async function goals(ctx: BotContext, options: Row) {
  const target = options.joueur ? await player(ctx, options.joueur, true) : null;
  const [rows, completed] = await Promise.all([goalRows(ctx, target), goalRows(ctx, target, true)]);
  return message(ctx, 'Objectifs actifs' + (target ? ' · ' + text(target.name, 80) : ''), rows.length
    ? `${Math.min(rows.length, 50)} objectif(s)${rows.length > 50 ? ' ou plus' : ''}. Objectifs individuels selon tes droits ; objectifs collectifs partagés. Aperçu des échéances et points de suivi ; historique complet sur NXT5.` : 'Aucun objectif actif accessible.',
    [...rows.slice(0, 8).map(g => ({ name: text(g.title, 150), value: `${g.player_id ? text(g.player_name || 'Joueur', 70) : 'Collectif'} · ID : \`${g.id}\`${g.due_at ? `\nÉchéance : ${timestamp(g.due_at, 'd')}` : ''}${g.metric ? `\nCible : ${text(g.metric, 20)} ${g.operator === 'lte' ? '≤' : '≥'} ${number(g.target_value)}` : ''}${jsonArray(g.updates).map(n => `\n${timestamp(n.created_at, 'd')} · ${text(n.note, 220)}`).join('')}` })),
      ...(completed.length ? [{ name: 'Objectifs récemment clôturés', value: completed.slice(0, 4).map(g => `• ${text(g.title, 110)} · \`${g.id}\`${jsonArray(g.updates)[0]?.note ? '\n' + text(jsonArray(g.updates)[0].note, 100) : ''}`).join('\n') }] : [])],
    '/mon-profil/coaching', target ? { player: target.id } : {});
}
async function poolRows(ctx: BotContext, options: Row) {
  const target = options.joueur ? await player(ctx, options.joueur) : null;
  const rawRole = String(options.role || '').toUpperCase();
  const role = ({ JUNGLE: 'JGL', SUPPORT: 'SUP' } as Row)[rawRole] || rawRole;
  if (role && !ROLES.includes(role)) throw discordError('Rôle invalide : TOP, JGL, MID, ADC ou SUP.');
  const rows = await sql(`select c.*,p.role as player_role,p.name as roster_name from champion_pool c
    left join players p on p.id=c.player_id and p.team_id=c.team_id
    where c.team_id=$1 and ($2::uuid is null or c.player_id=$2::uuid) and ($3='' or upper(coalesce(c.role,p.role,''))=$3)
    order by c.player_name,c.champion,c.id limit 251`, [ctx.teamId, target?.id || null, role]);
  return { rows, target };
}
async function pools(ctx: BotContext, command: string, options: Row) {
  if (command === 'pool suggerer') assertStaff(ctx);
  const { rows, target } = await poolRows(ctx, options);
  if (command === 'pool suggerer') {
    const objective = String(options.objectif || 'travail').trim().toLowerCase();
    const requestedGoal = UUID.test(objective) ? (await sql(`select title from player_goals where team_id=$1 and id=$2
      union all select title from discord_team_goals where team_id=$1 and id=$2 limit 1`, [ctx.teamId, objective]))[0] : null;
    if (UUID.test(objective) && !requestedGoal) throw discordError('Objectif introuvable dans cette équipe.', 404);
    const purpose = String(requestedGoal?.title || objective);
    const comfort = /confort|fiable|confiance|match/.test(purpose.toLowerCase());
    const ordered = [...rows].sort((a, b) => {
      const score = (p: Row) => (comfort ? ['comfort', 'main', 'ready', 'confort'].includes(p.status) : ['work', 'working', 'developing'].includes(p.status)) ? 1 : 0;
      return score(b) - score(a) || (comfort ? Number(b.games) - Number(a.games) : Number(a.games) - Number(b.games)) || String(a.champion).localeCompare(String(b.champion));
    });
    return message(ctx, 'Pistes de travail du pool', `Objectif : ${text(purpose, 250)}.\nRègle déterministe : ${comfort ? 'champions déclarés de confiance, puis pratique enregistrée décroissante' : 'champions déclarés en travail, puis pratique enregistrée croissante'}. Aucune recommandation de méta ou analyse adverse. À valider par le staff.`,
      ordered.slice(0, 5).map(p => ({ name: text(p.champion, 70), value: `${text(p.roster_name || p.player_name, 70)} · statut : ${text(p.status, 30)} · ${number(p.games, 0)} games\nRaison : ${comfort ? 'candidat selon le statut de confiance et la pratique renseignée' : 'candidat pour consolider un champion en travail ou peu pratiqué'}.` })), '/draft/pool');
  }
  return message(ctx, 'Champion pool' + (target ? ' · ' + text(target.name, 80) : ''), rows.length
    ? `${rows.length > 250 ? 'Plus de 250' : rows.length} entrée(s) · ${Math.min(12, rows.length)} affichées. Utilise joueur ou role pour préciser.` : 'Aucun champion renseigné pour ce filtre.',
    rows.slice(0, 12).map(p => ({ name: `${text(p.roster_name || p.player_name, 60)} · ${text(p.champion, 60)}`, value: `Rôle : ${text(p.role || p.player_role || 'Non renseigné', 20)} · Statut : ${text(p.status || 'Non renseigné', 30)}\n${number(p.games, 0)} games renseignées · ${number(p.winrate)} % de victoires` })), '/draft/pool');
}

async function compositions(ctx: BotContext, options: Row) {
  const rawRole = String(options.role || '').toUpperCase();
  const role = ({ JUNGLE: 'JGL', SUPPORT: 'SUP' } as Row)[rawRole] || rawRole;
  if (role && !ROLES.includes(role)) throw discordError('Rôle invalide : TOP, JGL, MID, ADC ou SUP.');
  const champion = String(options.champion || '').trim().toLowerCase();
  const rows = await sql(`select c.*,coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'champion',p.champion))
    from champion_pool p where p.team_id=c.team_id),'[]'::jsonb) as pool from composition_types c where c.team_id=$1 order by c.updated_at desc limit 100`, [ctx.teamId]);
  const selected: Row[] = rows.map(c => {
    const pool = new Map(jsonArray(c.pool).map(p => [String(p.id), String(p.champion)]));
    const entries = Object.entries(jsonObject(c.slots)).filter(([key]) => !role || key.toUpperCase() === role).map(([key, slot]) => ({ role: key, champion: pool.get(String(jsonObject(slot).poolId)) || String(jsonObject(slot).champion || '') }));
    return { ...c, entries };
  }).filter(c => (!role || c.entries.some(e => e.champion)) && (!champion || c.entries.some(e => e.champion.toLowerCase() === champion)));
  return message(ctx, 'Compositions enregistrées', selected.length ? `${selected.length} composition(s) dans les 100 plus récemment modifiées. Aperçu ci-dessous ; toutes sur NXT5.` : 'Aucune composition compatible enregistrée.',
    selected.slice(0, 10).map(c => ({ name: text(c.title, 140), value: `ID : \`${c.id}\`\n${c.entries.map(e => `${text(e.role, 10)} : ${text(e.champion || 'Non renseigné', 45)}`).join(' · ') || 'Slots non renseignés'}${ctx.canStaff && c.notes ? '\n' + text(c.notes, 350) : ''}` })), '/draft/compositions');
}

async function preparation(ctx: BotContext, options: Row) {
  assertStaff(ctx);
  const id = uuid(options.evenement, 'Événement');
  const events = await sql('select * from discord_team_events where team_id=$1 and id=$2 limit 1', [ctx.teamId, id]);
  const event = events[0];
  if (!event) throw discordError('Événement introuvable dans cette équipe.', 404);
  const [roster, notes, activeGoals, pool] = await Promise.all([
    sql("select id,name,role from players where team_id=$1 and roster_status='MAIN' order by role,name", [ctx.teamId]),
    sql('select note from discord_draft_notes where team_id=$1 and event_id=$2 order by created_at desc limit 5', [ctx.teamId, id]),
    goalRows(ctx), poolRows(ctx, {}),
  ]);
  return message(ctx, 'Préparation · ' + text(event.title, 120), `${timestamp(event.starts_at)} · ${text(event.event_type, 30)} · ${event.duration_minutes} min · ${event.status === 'cancelled' ? 'Annulé' : 'Prévu'}\nID : \`${event.id}\`\nLe roster et les objectifs ci-dessous sont ceux de l’équipe ; leur participation à cette session reste à confirmer.`, [
    { name: 'Roster principal actuel', value: roster.map(p => `${text(p.role, 10)} · ${text(p.name, 70)}`).join('\n') || 'Non renseigné' },
    { name: 'Pools du roster', value: roster.map(p => `${text(p.name, 60)} : ${pool.rows.filter(c => c.player_id === p.id).slice(0, 5).map(c => text(c.champion, 30)).join(', ') || 'Non renseigné'}`).join('\n') || 'Non renseignés' },
    { name: 'Objectifs actifs de l’équipe', value: activeGoals.slice(0, 5).map(g => `• ${text(g.title, 130)} (${g.player_id ? text(g.player_name, 45) : 'Collectif'})`).join('\n') || 'Aucun objectif actif' },
    { name: 'Consignes de session', value: [text(event.details, 350), ...notes.map(n => text(n.note, 180))].filter(Boolean).join('\n') || 'Aucune consigne associée' },
    { name: 'Compositions', value: `[Consulter les compositions NXT5](${link(ctx, '/draft/compositions')})\nAucune composition n’est retenue automatiquement pour la session.` },
  ], '/planning');
}

async function planning(ctx: BotContext, options: Row) {
  const key = String(options.periode || 'semaine');
  if (!['aujourdhui', 'semaine', 'mois'].includes(key)) throw discordError('Période invalide : aujourdhui, semaine ou mois.');
  const days = key === 'aujourdhui' ? 1 : key === 'mois' ? 30 : 7;
  const timezone = ctx.timezone || 'Europe/Paris';
  try { new Intl.DateTimeFormat('fr', { timeZone: timezone }); } catch { throw discordError('Fuseau de l’équipe invalide.'); }
  const rows = await sql(`with bounds as (
      select $4::timestamptz as lo,case when $3::int=1 then (($4::timestamptz at time zone $2)::date+1)::timestamp at time zone $2 else $4::timestamptz+$3::int*interval '1 day' end as hi
    ), legacy as (
      select distinct a.team_id,e.value->>'label' as title,coalesce(e.value->>'type','custom') as event_type,
      (a.week_start + (case split_part(e.key,'|',1) when 'MON' then 0 when 'TUE' then 1 when 'WED' then 2 when 'THU' then 3 when 'FRI' then 4 when 'SAT' then 5 when 'SUN' then 6 end)
        + split_part(e.key,'|',2)::time) at time zone $2 as starts_at
      from player_availability a cross join lateral jsonb_each(case
        when jsonb_typeof(a.slots->'_events')='object' then a.slots->'_events'
        when jsonb_typeof(a.slots->'events')='object' then a.slots->'events' else '{}'::jsonb end) e
      where a.team_id=$1 and a.week_start between (($4::timestamptz at time zone $2)::date-7) and (($4::timestamptz at time zone $2)::date+$3::int)
        and e.key ~ '^(MON|TUE|WED|THU|FRI|SAT|SUN)\\|([01][0-9]|2[0-3]):[0-5][0-9]$' and coalesce(e.value->>'label','')<>''
    ), combined as (
      select e.id::text,e.title,e.event_type,e.starts_at,e.duration_minutes,'Discord' as source,
        (select count(*) from discord_event_responses r where r.event_id=e.id and r.status='present') as present_count
      from discord_team_events e,bounds b where e.team_id=$1 and e.status='scheduled' and e.starts_at>=b.lo and e.starts_at<b.hi
      union all select null,l.title,l.event_type,l.starts_at,null,'Planning NXT5',null
      from legacy l,bounds b where l.starts_at>=b.lo and l.starts_at<b.hi
      and not exists(select 1 from discord_team_events e where e.team_id=l.team_id and e.status='scheduled' and e.starts_at=l.starts_at and lower(e.title)=lower(l.title))
    ) select * from combined order by starts_at,title limit 31`, [ctx.teamId, timezone, days, new Date().toISOString()]);
  return message(ctx, 'Planning de l’équipe', rows.length
    ? `${key === 'aujourdhui' ? 'Jusqu’à la fin de la journée' : `${days} prochains jours`} · Fuseau de référence : ${text(timezone, 60)}.\nHoraires affichés dans ton fuseau Discord. Les disponibilités générales ne sont pas des présences confirmées.${rows.length > 12 ? '\n12 prochains événements affichés ; suite sur NXT5.' : ''}`
    : 'Aucun événement à venir pour cette période. Les événements existants du planning et les sessions créées avec le bot sont recherchés.',
    rows.slice(0, 12).map(e => ({ name: text(e.title, 150), value: `${timestamp(e.starts_at)} · ${text(e.event_type, 25)}${e.duration_minutes ? ` · ${e.duration_minutes} min` : ''}\n${e.id ? `ID : \`${e.id}\` · ${e.present_count} présent(s) confirmé(s)` : 'Source : Planning NXT5 · gestion sur le site (sans confirmation Discord)'}` })), '/planning');
}

function safeReviewContent(report: Row, canStaff: boolean) {
  if (canStaff) return String(report.content || '');
  if (report.discord_summary_stale) return '';
  if (String(report.discord_summary || '').trim()) return String(report.discord_summary);
  const content = String(report.content || '');
  const marker = content.search(/\[NXT5_REPORT_V[23]\]|(?:^|\n)\s*Notes staff\s*(?:\n|$)/i);
  // Legacy free text has no visibility metadata. Show only clearly separated generated content.
  return marker >= 0 ? content.slice(0, marker).trim() : '';
}
async function reportById(ctx: BotContext, value: unknown) {
  const id = uuid(value, 'Review');
  const rows = await sql("select * from reports where team_id=$1 and id=$2 and ($3::boolean or discord_status='published') limit 1", [ctx.teamId, id, ctx.canStaff]);
  if (!rows[0]) throw discordError('Review introuvable ou non accessible.', 404);
  return rows[0];
}
async function reviews(ctx: BotContext, command: string, options: Row) {
  if (command === 'review lectures') assertStaff(ctx);
  if (command === 'review liste') {
    const selected = period(options.periode, 30);
    const target = options.joueur ? await player(ctx, options.joueur) : null;
    const rows = await sql(`select r.id,r.title,r.created_at,r.discord_status,r.discord_version from reports r where r.team_id=$1
      and ($2::boolean or r.discord_status='published') and r.created_at >= $3::timestamptz and r.created_at <= $4::timestamptz
      and ($5::uuid is null or exists(select 1 from match_participants p join matches m on m.id=p.match_id and m.team_id=r.team_id
        where p.player_id=$5::uuid and p.team_key='ALLY' and (r.match_id=p.match_id or r.match_ids @> jsonb_build_array(p.match_id::text))))
      order by r.created_at desc,r.id desc limit 31`, [ctx.teamId, ctx.canStaff, selected.from.toISOString(), selected.to.toISOString(), target?.id || null]);
    const result = message(ctx, 'Reviews accessibles', `${periodLabel(selected)}${target ? ' · ' + text(target.name, 70) : ''}\n${rows.length ? `${Math.min(rows.length, 30)} review(s)${rows.length > 30 ? ' ou plus' : ''}. ${Math.min(rows.length, 10)} affichées ; toutes sur NXT5.` : 'Aucune review accessible.'}`,
      rows.slice(0, 10).map(r => ({ name: text(r.title, 150), value: `${timestamp(r.created_at, 'd')} · ${r.discord_status === 'draft' ? 'Brouillon staff' : 'Publiée'} · version ${r.discord_version}\nID : \`${r.id}\` · [Ouvrir](${link(ctx, '/rapports', { report: r.id })})` })), '/rapports');
    if (rows.length) result.components.unshift({ type: 1, components: [{ type: 3, custom_id: `nxt:read:review:${ctx.teamId}`,
      placeholder: 'Ouvrir une review', options: rows.slice(0, 10).map(r => ({ label: String(r.title).slice(0, 100), value: r.id })) }] } as any);
    return result;
  }
  const report = await reportById(ctx, options.review);
  if (command === 'review lectures') {
    const rows = await sql(`select u.name,rec.user_id,reads.read_at from discord_review_recipients rec
      join users u on u.id=rec.user_id left join discord_review_reads reads on reads.team_id=rec.team_id and reads.report_id=rec.report_id and reads.user_id=rec.user_id and reads.report_version=rec.report_version
      where rec.team_id=$1 and rec.report_id=$2 and rec.report_version=$3 order by reads.read_at nulls last,u.name,rec.user_id`, [ctx.teamId, report.id, report.discord_version]);
    return message(ctx, 'Lecture · ' + text(report.title, 120), `Version ${report.discord_version} · ${rows.filter(r => r.read_at).length}/${rows.length} destinataires ont confirmé la lecture.\n${rows.length ? 'Une confirmation ne vaut pas validation du contenu.' : 'Cette version n’a pas de liste de destinataires partagée. Partage-la pour établir le suivi.'}`,
      rows.length ? [{ name: 'Destinataires de cette version', value: rows.slice(0, 25).map(r => `${r.read_at ? 'Lu' : 'Sans confirmation'} · ${text(r.name, 65)}${r.read_at ? ' · ' + timestamp(r.read_at, 'd') : ''}`).join('\n') }] : [], '/rapports', { report: report.id });
  }
  const content = safeReviewContent(report, ctx.canStaff);
  const staleNotice = report.discord_summary_stale ? 'Cette review a été modifiée. Son résumé doit être revalidé par le staff avant diffusion.\n\n' : '';
  return message(ctx, 'Review · ' + text(report.title, 130), `ID : \`${report.id}\` · Version ${report.discord_version} · ${report.discord_status === 'draft' ? 'Brouillon staff' : 'Publiée'}\n${timestamp(report.updated_at || report.created_at)}\n\n${staleNotice}${content ? text(content, 2300) + (content.length > 2300 ? '\n… Contenu complet sur NXT5.' : '') : report.discord_summary_stale ? '' : 'Aucun résumé partageable validé. Le staff peut en préparer un avant diffusion.'}`,
    [], '/rapports', { report: report.id });
}

/** Read handlers never publish or change data. The router revalidates the account/team on every interaction. */
export async function executeDiscordRead(ctx: BotContext, command: string, options: Row = {}): Promise<any | null> {
  if (!READS.has(command)) return null;
  uuid(ctx.teamId, 'Équipe');
  if (command === 'derniere' || command.startsWith('game ') || command === 'bilan' || command === 'stats equipe') return games(ctx, command, options);
  if (command.startsWith('joueur ')) return players(ctx, command, options);
  if (command === 'stats tendance') return trends(ctx, options);
  if (command === 'stats champions') return champions(ctx, options);
  if (command === 'objectifs liste') return goals(ctx, options);
  if (command.startsWith('pool ')) return pools(ctx, command, options);
  if (command === 'draft compositions') return compositions(ctx, options);
  if (command === 'draft preparer') return preparation(ctx, options);
  if (command === 'planning') return planning(ctx, options);
  return reviews(ctx, command, options);
}
