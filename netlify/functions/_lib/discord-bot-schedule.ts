import { createHash } from 'node:crypto';
import { sql } from './db';
import { discordError, assertDiscordArtifactEnvironment } from './discord-access';
import { discordRequest, findDiscordMessage, getDiscordGuild } from './discord-client';
import { isDiscordEnabled, isDiscordId, getDiscordConfig } from './discord-config';
import { botLink, botText } from './discord-bot-common';
import { DISCORD_MATCH_TIME_SQL } from './discord-bot-read';

// Keep temporary form content only for the short recovery window. Ambiguous
// deliveries remain available for reconciliation and are never pruned here.
export async function pruneDiscordBotArtifacts() {
  assertDiscordArtifactEnvironment();
  const results = await sql.transaction([
    sql(`with stale as (select token_hash from discord_bot_pending where expires_at<now()-interval '1 hour' order by expires_at limit 1000),
      removed as (delete from discord_bot_pending p using stale s where p.token_hash=s.token_hash returning 1) select count(*)::integer as count from removed`),
    sql(`with stale as (select token_hash from discord_account_link_requests where expires_at<now()-interval '1 hour' order by expires_at limit 1000),
      removed as (delete from discord_account_link_requests p using stale s where p.token_hash=s.token_hash returning 1) select count(*)::integer as count from removed`),
    // Keep sent review messages as long as their report exists: their « Lu »
    // button is bound to this durable message record. Report/team deletion
    // cascades these rows; unconfirmed or unsent jobs still expire normally.
    sql(`with stale as (select id from discord_bot_outbox where state in ('sent','cancelled','failed') and updated_at<now()-interval '30 days'
      and not (kind='review' and state='sent' and message_id is not null and report_id is not null)
      order by updated_at limit 1000),
      removed as (delete from discord_bot_outbox o using stale s where o.id=s.id returning 1) select count(*)::integer as count from removed`),
  ]);
  return { pending: results[0][0].count, linkRequests: results[1][0].count, outbox: results[2][0].count };
}

export function validateTimezone(value: unknown): string {
  const zone = String(value || '').trim();
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: zone }).format(); } catch { throw discordError('Fuseau IANA invalide, par exemple Europe/Paris.'); }
  if (!zone) throw discordError('Fuseau requis.');
  return zone;
}
export function localParts(date: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function localDateTime(date: unknown, time: unknown, timezone: string): Date {
  const day = String(date || ''), hour = String(time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hour)) throw discordError('Utilise une date AAAA-MM-JJ et une heure HH:MM.');
  const naive = new Date(day + 'T' + hour + ':00.000Z');
  if (!Number.isFinite(naive.getTime()) || naive.toISOString().slice(0,10) !== day) throw discordError('Date invalide.');
  validateTimezone(timezone);
  // Collect actual offsets around the date, including both sides of a DST change.
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const sample = new Date(naive.getTime() + delta * 3600000), p = localParts(sample, timezone);
    offsets.add(new Date(p.date + 'T' + p.time + ':00Z').getTime() - sample.getTime());
  }
  const matches = [...offsets].map(offset => new Date(naive.getTime() - offset)).filter(candidate => {
    const p = localParts(candidate, timezone); return p.date === day && p.time === hour;
  });
  if (matches.length !== 1) throw discordError(matches.length ? 'Cette heure est ambiguë au changement d’heure. Choisis un horaire non ambigu.' : 'Cette heure n’existe pas dans le fuseau choisi au changement d’heure.');
  return matches[0];
}
export function nextWeeklyRun(timezone: string, weekday: number, hour: string, now = new Date()): Date {
  const today = localParts(now, timezone).date;
  for (let step = 0; step <= 14; step++) {
    const day = new Date(today + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + step);
    if (day.getUTCDay() !== weekday) continue;
    try { const run = localDateTime(day.toISOString().slice(0,10), hour, timezone); if (run > now) return run; } catch { /* Skip a non-existent/ambiguous DST slot. */ }
  }
  throw discordError('Aucun horaire hebdomadaire valide trouvé.');
}
export async function botSettings(teamId: string) {
  return (await sql('select * from discord_bot_settings where team_id=$1', [teamId]))[0] || {
    timezone: 'Europe/Paris', channels: {}, reminders_enabled: false, reminder_minutes: 30, weekly_enabled: false, weekly_day: 1, weekly_hour: '18:00',
  };
}
export async function botDestination(teamId: string, guildId: string, kind: string, channelId?: string) {
  const settings = await botSettings(teamId), chosen = channelId || settings.channels?.[kind];
  if (!isDiscordId(chosen)) throw discordError(`Configure d’abord le salon ${kind} avec /nxt reglages canal.`);
  const connection = (await sql("select * from discord_connections where team_id=$1 and guild_id=$2 and status='active'", [teamId,guildId]))[0];
  if (!connection) throw discordError('La diffusion de cette équipe doit être active pour envoyer ce message.');
  if (settings.channels?.[kind] !== chosen) throw discordError('Ce salon ne correspond pas à la destination autorisée de ce type. Configure-le avant de partager.');
  const live = await getDiscordGuild(guildId);
  if (!live.channels.some(c => c.id === chosen && c.canSend)) throw discordError('Le bot ne peut pas envoyer dans ce salon.');
  return { channelId: chosen, configVersion: connection.config_version };
}
export async function queueBotMessage(input: {
  teamId: string; guildId: string; channelId: string; channelKind: string; kind: string; key: string; payload: any; configVersion: number;
  eventId?: string; eventRevision?: number; reportId?: string; reportVersion?: number;
  scheduleSnapshot?: Record<string, unknown>; expiresAt?: string;
}) {
  assertDiscordArtifactEnvironment();
  const rows = await sql(`insert into discord_bot_outbox(team_id,guild_id,channel_id,channel_kind,kind,dedupe_key,payload,config_version,event_id,event_revision,report_id,report_version,schedule_snapshot,expires_at)
    values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13::jsonb,$14)
    on conflict(dedupe_key) do update set guild_id=excluded.guild_id,channel_id=excluded.channel_id,channel_kind=excluded.channel_kind,
      payload=excluded.payload,config_version=excluded.config_version,event_id=excluded.event_id,event_revision=excluded.event_revision,
      report_id=excluded.report_id,report_version=excluded.report_version,schedule_snapshot=excluded.schedule_snapshot,expires_at=excluded.expires_at,
      state='queued',attempts=0,error_code=null,available_at=now(),updated_at=now()
    where discord_bot_outbox.state='cancelled' and discord_bot_outbox.message_id is null
      and discord_bot_outbox.team_id=excluded.team_id and discord_bot_outbox.kind=excluded.kind returning id`,
  [input.teamId,input.guildId,input.channelId,input.channelKind,input.kind,input.key,JSON.stringify(input.payload),input.configVersion,input.eventId||null,input.eventRevision||null,input.reportId||null,input.reportVersion||null,JSON.stringify(input.scheduleSnapshot||{}),input.expiresAt||null]);
  return rows[0]?.id || null;
}
export function eventBotMessage(event: any, teamName: string) {
  const timestamp = Math.floor(new Date(event.starts_at).getTime()/1000);
  return { embeds: [{ title: botText(`${teamName} · ${event.title}`,256), description: `<t:${timestamp}:F> · ${event.duration_minutes} min\nConfirme ta présence pour cette session.`, url:botLink('/planning?team='+event.team_id), color: 0x67e8f9 }],
    components: [{ type:1, components: ['present','absent','retard'].map((status,i) => ({ type:2, style:i===0?3:2, label:['Présent','Absent','En retard'][i], custom_id:`nxt:presence:${event.id}:${status}` })) }] };
}
export async function enqueueScheduledBotMessages(now = new Date()) {
  assertDiscordArtifactEnvironment();
  if (!isDiscordEnabled()) return 0;
  const due = await sql(`select e.*,c.guild_id,c.config_version,t.name as team_name,s.channels,s.reminder_minutes from discord_team_events e
    join discord_bot_settings s on s.team_id=e.team_id join discord_connections c on c.team_id=e.team_id join teams t on t.id=e.team_id
    where e.status='scheduled' and c.status='active' and s.reminders_enabled and s.channels->>'planning' is not null
      and e.starts_at > $1::timestamptz - interval '5 minutes' and e.starts_at - (s.reminder_minutes * interval '1 minute') <= $1::timestamptz
      and not exists(select 1 from discord_bot_outbox o where o.dedupe_key='reminder:'||e.id::text||':'||e.revision::text and o.state<>'cancelled')
    order by e.starts_at limit 100`, [now.toISOString()]);
  let count = 0;
  for (const event of due) {
    if (!isDiscordId(event.channels.planning)) continue;
    if (await queueBotMessage({ teamId:event.team_id,guildId:event.guild_id,channelId:event.channels.planning,channelKind:'planning',kind:'reminder',
      key:`reminder:${event.id}:${event.revision}`,payload:eventBotMessage(event,event.team_name),configVersion:event.config_version,eventId:event.id,eventRevision:event.revision,
      scheduleSnapshot:{reminder_minutes:Number(event.reminder_minutes)},expiresAt:new Date(new Date(event.starts_at).getTime()+5*60000).toISOString() })) count++;
  }
  const weekly = await sql(`select s.*,c.guild_id,c.config_version,t.name as team_name from discord_bot_settings s join discord_connections c on c.team_id=s.team_id
    join teams t on t.id=s.team_id where s.weekly_enabled and c.status='active' and s.channels->>'bilans' is not null
      and extract(dow from $1::timestamptz at time zone s.timezone)=s.weekly_day
      and ($1::timestamptz at time zone s.timezone)::time>=s.weekly_hour::time
      and ($1::timestamptz at time zone s.timezone)<=((($1::timestamptz at time zone s.timezone)::date+s.weekly_hour::time)+interval '1 hour')
      and not exists(select 1 from discord_bot_outbox o where o.dedupe_key='weekly:'||s.team_id::text||':'||to_char($1::timestamptz at time zone s.timezone,'YYYY-MM-DD') and o.state<>'cancelled')
    order by s.team_id limit 200`,[now.toISOString()]);
  for (const setting of weekly) {
    if (!isDiscordId(setting.channels.bilans)) continue;
    const p = localParts(now,setting.timezone);
    if (new Date(p.date+'T12:00:00Z').getUTCDay() !== Number(setting.weekly_day) || p.time < setting.weekly_hour) continue;
    let until:Date;
    try { until=localDateTime(p.date,setting.weekly_hour,setting.timezone); } catch { continue; }
    if (now.getTime()-until.getTime()>3600000) continue; // bounded catch-up, never resurrect old weekly messages.
    const since=new Date(until.getTime()-7*86400000);
    const [result] = await sql(`select count(*)::integer as games,count(*) filter(where result='Victoire')::integer as wins,
      count(*) filter(where result='Défaite')::integer as losses,avg(duration_seconds) as duration
      from matches m where m.team_id=$1 and ${DISCORD_MATCH_TIME_SQL} >= $2::timestamptz and ${DISCORD_MATCH_TIME_SQL} < $3::timestamptz`,[setting.team_id,since.toISOString(),until.toISOString()]);
    const description = Number(result.games) ? `${result.games} games · ${result.wins} victoires · ${result.losses} défaites\nRésultats non renseignés : ${Number(result.games)-Number(result.wins)-Number(result.losses)}.\nDurée moyenne : ${result.duration==null?'indisponible':Math.round(Number(result.duration)/60)+' min'}.` : 'Aucune game importée sur cette période. Aucun indicateur de performance calculé.';
    const payload={embeds:[{title:botText(`${setting.team_name} · Bilan hebdomadaire`,256),description:description+`\nPériode : <t:${Math.floor(since.getTime()/1000)}:f> → <t:${Math.floor(until.getTime()/1000)}:f> · ${setting.timezone}. Toutes catégories. Date jouée, puis date d’import si indisponible.`,url:botLink('/games?team='+setting.team_id),color:0x67e8f9}]};
    if(await queueBotMessage({teamId:setting.team_id,guildId:setting.guild_id,channelId:setting.channels.bilans,channelKind:'bilans',kind:'weekly',key:`weekly:${setting.team_id}:${p.date}`,payload,configVersion:setting.config_version,
      scheduleSnapshot:{timezone:setting.timezone,weekly_day:Number(setting.weekly_day),weekly_hour:setting.weekly_hour},expiresAt:new Date(until.getTime()+3600000).toISOString()}))count++;
  }
  return count;
}
async function stillDeliverable(row:any) {
  const rows=await sql(`select o.id from discord_bot_outbox o join discord_connections c on c.team_id=o.team_id join discord_bot_settings s on s.team_id=o.team_id
    left join discord_team_events e on e.id=o.event_id and e.team_id=o.team_id left join reports r on r.id=o.report_id and r.team_id=o.team_id
    where o.id=$1 and c.status='active' and c.guild_id=o.guild_id and c.config_version=o.config_version and s.channels->>o.channel_kind=o.channel_id
      and (o.expires_at is null or o.expires_at>now())
      and (o.event_id is null or (e.revision=o.event_revision and (o.kind='event_update' or (e.status='scheduled' and e.starts_at+(e.duration_minutes*interval '1 minute')>now()))))
      and (o.kind<>'reminder' or (s.reminders_enabled and o.schedule_snapshot=jsonb_build_object('reminder_minutes',s.reminder_minutes)
        and e.starts_at-(s.reminder_minutes*interval '1 minute')<=now()))
      and (o.kind<>'weekly' or (s.weekly_enabled and o.schedule_snapshot=jsonb_build_object('timezone',s.timezone,'weekly_day',s.weekly_day,'weekly_hour',s.weekly_hour)))
      and (o.report_id is null or (r.discord_status='published' and not r.discord_summary_stale and r.discord_version=o.report_version))`,[row.id]);
  return rows.length>0;
}
export async function deliverBotOutbox(limit=2) {
  assertDiscordArtifactEnvironment();
  if(!isDiscordEnabled()) return {sent:0};
  // A process dying after POST is ambiguous. Never send that job again without read reconciliation.
  await sql("update discord_bot_outbox set state='uncertain',error_code='DELIVERY_UNCONFIRMED',updated_at=now() where state='sending' and updated_at<now()-interval '90 seconds'");
  const uncertain=await sql("select * from discord_bot_outbox where state='uncertain' and available_at<=now() order by updated_at limit 2");
  for(const row of uncertain){
    try{const found=await findDiscordMessage(row.channel_id,{reference:'bot:'+row.id,after:row.created_at});
      if(isDiscordId(found?.id))await sql("update discord_bot_outbox set state='sent',message_id=$2,error_code=null,updated_at=now() where id=$1 and state='uncertain'",[row.id,found.id]);
    }catch{/* Retain uncertain state: absence of a response is never proof of failure. */}
    // A missing receipt must not monopolize every reconciliation batch.
    await sql("update discord_bot_outbox set available_at=now()+interval '5 minutes',updated_at=now() where id=$1 and state='uncertain'",[row.id]);
  }
  let sent=0;
  for(let i=0;i<Math.min(10,Math.max(0,limit));i++){
    const rows=await sql(`update discord_bot_outbox set state='sending',attempts=attempts+1,updated_at=now() where id=(select id from discord_bot_outbox
      where state='queued' and available_at<=now() order by available_at for update skip locked limit 1) returning *`);
    const row=rows[0];if(!row)break;
    let attempted=false;
    try{
      if(!await stillDeliverable(row)){await sql("update discord_bot_outbox set state='cancelled',updated_at=now() where id=$1",[row.id]);continue;}
      const live=await getDiscordGuild(row.guild_id);
      if(!live.channels.some(c=>c.id===row.channel_id&&c.canSend))throw discordError('Salon indisponible.',409,'DISCORD_CHANNEL_FORBIDDEN');
      if(!isDiscordEnabled()||!await stillDeliverable(row)){await sql("update discord_bot_outbox set state='cancelled',updated_at=now() where id=$1",[row.id]);continue;}
      const reference='bot:'+row.id;
      const payload={...row.payload,embeds:(row.payload.embeds||[]).map((embed:any)=>({...embed,footer:{text:'NXT5 · '+reference}})),
        allowed_mentions:{parse:[],roles:[],users:row.kind==='presence'?(row.payload.allowed_mentions?.users||[]):[],replied_user:false},
        nonce:createHash('sha256').update(reference).digest('hex').slice(0,24),enforce_nonce:true};
      delete payload.flags;
      attempted=true;
      const message=await discordRequest(`/channels/${row.channel_id}/messages`,{method:'POST',body:payload});
      if(!isDiscordId(message?.id)||message.channel_id!==row.channel_id)throw Object.assign(new Error('Delivery unconfirmed'),{ambiguous:true});
      await sql("update discord_bot_outbox set state='sent',message_id=$2,error_code=null,updated_at=now() where id=$1 and state='sending'",[row.id,message.id]);sent++;
    }catch(error){
      const retry=error?.status===429&&!error?.ambiguous&&Number(row.attempts)<5;
      const state=error?.ambiguous||(attempted&&!error?.status)?'uncertain':retry?'queued':'failed';
      await sql("update discord_bot_outbox set state=$2,error_code=$3,available_at=now()+($4*interval '1 second'),updated_at=now() where id=$1 and state='sending'",
        [row.id,state,String(error?.code||'DISCORD_DELIVERY_FAILED'),Math.max(5,Number(error?.retryAfter)||60)]);
    }
  }
  return {sent};
}
