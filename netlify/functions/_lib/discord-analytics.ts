import { sql } from './db';

const DAY = 86_400_000;
export type DiscordAnalyticsDays = 7 | 30 | 90;

export function discordAnalyticsDays(value: string | null): DiscordAnalyticsDays {
  if (value === null) return 30;
  if (value === '7' || value === '30' || value === '90') return Number(value) as DiscordAnalyticsDays;
  throw Object.assign(new Error('Choisis une période de 7, 30 ou 90 jours.'), { status: 400, code: 'DISCORD_ANALYTICS_PERIOD_INVALID' });
}

// Check relation existence without converting a network/permission failure into
// an empty dashboard or a misleading migration warning. This endpoint does no DDL.
export async function discordAnalyticsSchemaReady(): Promise<boolean> {
  const [row] = await sql(`select bool_and(to_regclass(name) is not null) as ready
    from unnest(array['discord_connections','discord_routes','discord_publications',
      'publication_jobs','discord_deliveries','discord_interaction_receipts','discord_connection_tests']) as relations(name)`);
  return row?.ready === true;
}

// One statement gives all cards/charts the same database snapshot. Aggregate
// before joining: several NXT5 teams can share both a guild and a channel.
const REPORT_SQL = `with
  bounds as (select $1::timestamptz as starts_at, $2::timestamptz as ends_at, $3::timestamptz as commands_at),
  connections as (
    select c.team_id,c.guild_id,c.status,t.name as team_name from discord_connections c
    join teams t on t.id=c.team_id where c.guild_id is not null and c.status<>'disconnected'
  ), routes as (
    select r.guild_id,r.channel_id,r.channel_name,r.enabled,r.automatic,c.team_id,c.team_name
    from discord_routes r join connections c on c.team_id=r.team_id and c.guild_id=r.guild_id
  ), deliveries as (
    select d.id,d.publication_id,d.status,d.created_at,d.error_code,d.message_id,
      p.guild_id,p.channel_id,p.team_id,t.name as team_name,
      d.status in ('succeeded','withdrawn') as successful,
      d.status in ('blocked','retry_wait') as failed
    from discord_deliveries d join discord_publications p on p.id=d.publication_id
    join publication_jobs j on j.id=d.job_id and j.publication_id=p.id and j.team_id=p.team_id
    join teams t on t.id=p.team_id cross join bounds b
    where d.created_at>=b.starts_at and d.created_at<=b.ends_at
  ), published as (
    select publication_id,guild_id,min(created_at) as first_success_at from deliveries
    where successful and message_id is not null group by publication_id,guild_id
  ), commands as (
    select interaction_id,guild_id,command_name,status,error_code,created_at
    from discord_interaction_receipts cross join bounds b
    where created_at>=b.commands_at and created_at<=b.ends_at
  ), connection_tests as (
    select ct.request_id,ct.guild_id,ct.channel_id,ct.status,ct.error_code,ct.created_at,ct.team_id,t.name as team_name
    from discord_connection_tests ct join teams t on t.id=ct.team_id cross join bounds b
    where ct.created_at>=b.starts_at and ct.created_at<=b.ends_at
  ), delivery_counts as (
    select count(*)::int as attempts,count(*) filter(where successful)::int as succeeded,
      count(*) filter(where failed)::int as failed,count(*) filter(where status='sending')::int as pending,
      count(*) filter(where status='uncertain')::int as uncertain from deliveries
  ), days as (
    select day::date from bounds b,
      generate_series(b.starts_at at time zone 'UTC',b.ends_at at time zone 'UTC',interval '1 day') as day
  ), daily_deliveries as (
    select (created_at at time zone 'UTC')::date as day,
      count(*) filter(where successful)::int as succeeded,count(*) filter(where failed)::int as failed
    from deliveries group by 1
  ), daily_publications as (
    select (first_success_at at time zone 'UTC')::date as day,count(*)::int as publications from published group by 1
  ), daily_commands as (
    select (created_at at time zone 'UTC')::date as day,count(*)::int as commands from commands group by 1
  ), guild_ids as (
    select guild_id from connections union select guild_id from deliveries
    union select guild_id from commands union select guild_id from connection_tests
  ), guild_connections as (
    select guild_id,count(*)::int as connections,count(*) filter(where status='active')::int as active,
      jsonb_agg(jsonb_build_object('teamId',team_id,'teamName',team_name,'status',status) order by lower(team_name),team_id) as teams
    from connections group by guild_id
  ), guild_channels as (
    select guild_id,count(distinct channel_id)::int as channels from routes group by guild_id
  ), guild_deliveries as (
    select guild_id,count(*) filter(where successful)::int as succeeded,count(*) filter(where failed)::int as failed,
      max(created_at) as last_at from deliveries group by guild_id
  ), guild_publications as (
    select guild_id,count(*)::int as publications from published group by guild_id
  ), guild_commands as (
    select guild_id,count(*)::int as commands,max(created_at) as last_at from commands group by guild_id
  ), guild_tests as (
    select guild_id,max(created_at) as last_at from connection_tests group by guild_id
  ), destination_sources as (
    select guild_id,channel_id,channel_name,enabled,automatic,true as currently_configured,team_name from routes
    union all select d.guild_id,d.channel_id,r.channel_name,false,false,false,d.team_name from deliveries d
      left join discord_routes r on r.team_id=d.team_id and r.guild_id=d.guild_id and r.channel_id=d.channel_id
    union all select ct.guild_id,ct.channel_id,r.channel_name,false,false,false,ct.team_name from connection_tests ct
      left join discord_routes r on r.team_id=ct.team_id and r.guild_id=ct.guild_id and r.channel_id=ct.channel_id
  ), destination_routes as (
    select guild_id,channel_id,max(nullif(channel_name,'')) as channel_name,bool_or(enabled) as enabled,
      bool_or(automatic and enabled) as automatic,bool_or(currently_configured) as currently_configured,
      jsonb_agg(distinct team_name order by team_name) as team_names
    from destination_sources group by guild_id,channel_id
  ), destination_counts as (
    select guild_id,channel_id,count(distinct publication_id) filter(where successful and message_id is not null)::int as publications,
      count(*) filter(where successful)::int as succeeded,count(*) filter(where failed)::int as failed
    from deliveries group by guild_id,channel_id
  ), destinations as (
    select r.*,coalesce(c.publications,0) as publications,coalesce(c.succeeded,0) as succeeded,coalesce(c.failed,0) as failed
    from destination_routes r left join destination_counts c using(guild_id,channel_id)
  ), guild_destinations as (
    select guild_id,jsonb_agg(jsonb_build_object('channelId',channel_id,'channelName',channel_name,
      'enabled',enabled,'automatic',automatic,'currentlyConfigured',currently_configured,'teamNames',team_names,
      'publications',publications,'successfulDeliveries',succeeded,'failedDeliveries',failed)
      order by channel_name nulls last,channel_id) as destinations
    from destinations group by guild_id
  ), guild_report as (
    select g.guild_id,coalesce(c.connections,0) as connections,coalesce(c.active,0) as active,
      coalesce(ch.channels,0) as channels,coalesce(p.publications,0) as publications,
      coalesce(d.succeeded,0) as succeeded,coalesce(d.failed,0) as failed,coalesce(cmd.commands,0) as commands,
      greatest(d.last_at,cmd.last_at,ct.last_at) as last_at,
      coalesce(c.teams,'[]'::jsonb) as teams,coalesce(dest.destinations,'[]'::jsonb) as destinations
    from guild_ids g left join guild_connections c using(guild_id) left join guild_channels ch using(guild_id)
    left join guild_deliveries d using(guild_id) left join guild_publications p using(guild_id)
    left join guild_commands cmd using(guild_id) left join guild_tests ct using(guild_id)
    left join guild_destinations dest using(guild_id)
  ), activity as (
    select 'delivery:'||d.id::text as id,'delivery' as kind,d.created_at as at,d.status,d.guild_id,d.team_name,
      d.channel_id,dest.channel_name,null::text as command_name,d.error_code
    from deliveries d left join destinations dest using(guild_id,channel_id)
    union all
    select 'command:'||interaction_id,'command',created_at,status,guild_id,null,null,null,command_name,error_code from commands
    union all
    select 'connection_test:'||ct.team_id::text||':'||ct.request_id::text,'connection_test',ct.created_at,
      ct.status,ct.guild_id,ct.team_name,ct.channel_id,dest.channel_name,null,ct.error_code
    from connection_tests ct left join destinations dest using(guild_id,channel_id)
  )
select jsonb_build_object(
  'summary',jsonb_build_object(
    'connections',(select count(*)::int from connections),
    'activeConnections',(select count(*)::int from connections where status='active'),
    'pausedConnections',(select count(*)::int from connections where status='paused'),
    'pendingConnections',(select count(*)::int from discord_connections where status='pending'),
    'disconnectedConnections',(select count(*)::int from discord_connections where status='disconnected'),
    'guilds',(select count(distinct guild_id)::int from connections),
    'activeGuilds',(select count(distinct guild_id)::int from connections where status='active'),
    'channels',(select count(distinct (guild_id,channel_id))::int from routes),
    'enabledChannels',(select count(distinct (guild_id,channel_id))::int from routes where enabled),
    'publications',(select count(*)::int from published),
    'deliveryAttempts',dc.attempts,'successfulDeliveries',dc.succeeded,'failedDeliveries',dc.failed,
    'pendingDeliveries',dc.pending,'uncertainDeliveries',dc.uncertain,
    'queuedJobs',(select count(*)::int from publication_jobs where status in ('queued','preparing','retry_wait','sending')),
    'blockedJobs',(select count(*)::int from publication_jobs where status='blocked'),
    'commands',(select count(*)::int from commands),
    'failedCommands',(select count(*)::int from commands where status='failed'),
    'connectionTests',(select count(*)::int from connection_tests),
    'successRate',case when dc.succeeded+dc.failed>0 then round(100.0*dc.succeeded/(dc.succeeded+dc.failed),1) else null end
  ),
  'daily',(select coalesce(jsonb_agg(jsonb_build_object(
    'date',to_char(days.day,'YYYY-MM-DD'),'publications',coalesce(p.publications,0),
    'successfulDeliveries',coalesce(d.succeeded,0),'failedDeliveries',coalesce(d.failed,0),
    'commands',case when (days.day+1)::timestamp at time zone 'UTC'<=b.commands_at then null else coalesce(c.commands,0) end
  ) order by days.day),'[]'::jsonb) from days cross join bounds b
    left join daily_deliveries d using(day) left join daily_publications p using(day) left join daily_commands c using(day)),
  'commands',(select coalesce(jsonb_agg(jsonb_build_object('name',command_name,'count',total,
    'completed',completed,'failed',failed,'processing',processing) order by total desc,command_name),'[]'::jsonb)
    from (select command_name,count(*)::int as total,count(*) filter(where status='completed')::int as completed,
      count(*) filter(where status='failed')::int as failed,count(*) filter(where status='processing')::int as processing
      from commands group by command_name) counts),
  'guilds',(select coalesce(jsonb_agg(jsonb_build_object('guildId',guild_id,'guildName',null,
    'connections',connections,'activeConnections',active,'channels',channels,'publications',publications,
    'successfulDeliveries',succeeded,'failedDeliveries',failed,'commands',commands,'lastActivityAt',last_at,
    'teams',teams,'destinations',destinations) order by succeeded+commands desc,last_at desc nulls last,guild_id),'[]'::jsonb)
    from guild_report),
  'recentActivity',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'at',at,'status',status,
    'guildId',guild_id,'teamName',team_name,'channelId',channel_id,'channelName',channel_name,
    'commandName',command_name,'errorCode',error_code) order by at desc,id),'[]'::jsonb)
    from (select * from activity order by at desc,id limit 30) recent)
) as report from delivery_counts dc`;

export async function readDiscordAnalytics(days: DiscordAnalyticsDays, now = new Date()) {
  const to = now.toISOString();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY).toISOString();
  const commandsFrom = new Date(Math.max(Date.parse(from), now.getTime() - 7 * DAY)).toISOString();
  const [row] = await sql(REPORT_SQL, [from, to, commandsFrom]);
  if (!row?.report) throw new Error('Discord analytics report unavailable');
  return {
    schemaReady: true,
    generatedAt: to,
    period: { days, from, to, timeZone: 'UTC' },
    coverage: {
      commandsFrom, commandsRetentionDays: 7, commandsPartial: commandsFrom > from, deliveriesRetentionDays: 90,
      notes: [
        'Les connexions, serveurs, salons et files d’envoi décrivent la configuration actuelle. Seuls les serveurs connus de NXT5 sont recensés.',
        'Une publication correspond à une game et un salon avec un envoi confirmé sur la période, mises à jour incluses. Les reprises et mises à jour sont comptées séparément dans les tentatives.',
        'Les tests de connexion sont isolés des publications réelles. Le taux de succès exclut les tentatives en cours et incertaines.',
        'Les commandes reçues sont conservées 7 jours : les périodes antérieures sont indisponibles et ne correspondent pas à zéro utilisation. Le premier jour de cette fenêtre glissante peut être partiel. Une commande traitée peut inclure un refus fonctionnel.',
        'Les tentatives sont conservées 90 jours. La suppression d’une équipe supprime aussi ses publications et leur historique ; ce rapport décrit les données encore disponibles.',
        'Les journées sont en UTC et la journée actuelle est partielle. Les noms des serveurs ne sont pas enregistrés ; leurs identifiants sont affichés.',
      ],
    },
    ...row.report,
  };
}
