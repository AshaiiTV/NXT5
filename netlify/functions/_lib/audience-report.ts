import { sql } from './db';
import { GOALS, RETENTION_DAYS } from './audience';
import { sanitizeCampaignValue } from '../../../src/app/audience-paths.js';

const DAY = 86400000;

export function audiencePeriod(days: number, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = today - (days - 1) * DAY;
  const previousStart = start - days * DAY;
  const date = (value: number) => new Date(value).toISOString().slice(0, 10);
  return {
    period: { from: date(start), to: date(today), days, timezone: 'UTC' },
    comparison: { from: date(previousStart), to: date(start - DAY) },
    currentStart: new Date(start).toISOString(), previousStart: new Date(previousStart).toISOString(), end: new Date(today + DAY).toISOString()
  };
}

export function audienceFilters(request: Request) {
  const url = new URL(request.url);
  const daysValue = url.searchParams.get('days') || '30';
  const device = url.searchParams.get('device') || 'all';
  const source = url.searchParams.get('source') || 'all';
  if (!['7','30','90'].includes(daysValue) || !['all','desktop','mobile','tablet'].includes(device)
    || source.length > 253 || (source !== 'all' && source !== sanitizeCampaignValue(source) && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(source))) {
    throw Object.assign(new Error('Filtres de fréquentation invalides.'), { status: 400 });
  }
  return { days: Number(daysValue), device, source };
}

/** SQL aggregates only: raw visitor/session identifiers never leave the DB. */
export async function loadAudienceReport(filters: { days: number; device: string; source: string }, now = new Date()) {
  const { days, device, source } = filters;
  const window = audiencePeriod(days, now);
  const rows = await sql`
    with limits as (
      select ${window.currentStart}::timestamptz as current_start, ${window.previousStart}::timestamptz as previous_start,
        ${window.end}::timestamptz as window_end, ${now.toISOString()}::timestamptz as generated_at
    ), windows as (
      select 'current'::text as period,current_start as period_start,window_end as period_end from limits
      union all select 'previous',previous_start,current_start from limits
    ), filtered as materialized (
      select s.*,w.period,w.period_start,w.period_end
      from audience_sessions s cross join windows w
      where s.last_seen_at >= w.period_start and s.started_at < w.period_end
        and (${device} = 'all' or s.device = ${device}) and (${source} = 'all' or s.source = ${source})
    ), page_metrics as (
      select p.session_id,s.period,count(*)::integer as views
      from audience_pages p join filtered s on s.id = p.session_id
      where p.viewed_at >= s.period_start and p.viewed_at < s.period_end group by p.session_id,s.period
    ), goal_metrics as (
      select e.session_id,s.period,bool_or(e.name in ('signup','access_request')) as converted,count(*) as events
      from audience_events e join filtered s on s.id = e.session_id
      where e.created_at >= s.period_start and e.created_at < s.period_end group by e.session_id,s.period
    ), duration_metrics as (
      select e.session_id,s.period,sum(e.duration_delta)::numeric as duration
      from audience_events e join filtered s on s.id = e.session_id
      where e.created_at >= s.period_start and e.created_at < s.period_end group by e.session_id,s.period
    ), metrics as materialized (
      select s.*, coalesce(p.views,0) as views, coalesce(d.duration,0) as duration, coalesce(g.converted,false) as converted,
        (coalesce(p.views,0) >= 2 or coalesce(d.duration,0) >= 10 or coalesce(g.converted,false)) as engaged,
        exists(select 1 from audience_pages older_page join audience_sessions older on older.id = older_page.session_id
          where older.visitor_id = s.visitor_id and older_page.viewed_at < s.period_start) as returning
      from filtered s left join page_metrics p on p.session_id = s.id and p.period = s.period
      left join goal_metrics g on g.session_id = s.id and g.period = s.period
      left join duration_metrics d on d.session_id = s.id and d.period = s.period
      where coalesce(p.views,0) > 0 or coalesce(g.events,0) > 0
    ), summaries as (
      select wanted.period, jsonb_build_object(
        'visitors',count(distinct m.visitor_id), 'sessions',count(m.id), 'pageviews',coalesce(sum(m.views),0),
        'engagedSessions',count(m.id) filter(where m.engaged),
        'engagementRate',coalesce(round(100.0 * count(m.id) filter(where m.engaged) / nullif(count(m.id),0),2),0),
        'avgDurationSeconds',coalesce(round(sum(m.duration) / nullif(count(m.id),0),2),0),
        'pagesPerSession',coalesce(round(sum(m.views)::numeric / nullif(count(m.id),0),2),0),
        'conversions',count(m.id) filter(where m.converted),
        'conversionRate',coalesce(round(100.0 * count(m.id) filter(where m.converted) / nullif(count(m.id),0),2),0),
        'bounceRate',coalesce(round(100.0 * count(m.id) filter(where not m.engaged) / nullif(count(m.id),0),2),0),
        'returningVisitors',count(distinct m.visitor_id) filter(where m.returning)
      ) as value
      from (values('current'),('previous')) wanted(period) left join metrics m on m.period = wanted.period group by wanted.period
    ), current_sessions as materialized (select * from metrics where period = 'current'),
    series_days as (
      select generate_series(l.current_start at time zone 'UTC', (l.window_end at time zone 'UTC') - interval '1 day', interval '1 day') as day from limits l
    ), daily_activity as (
      select (e.created_at at time zone 'UTC')::date as day,s.id,s.visitor_id,bool_or(e.name in ('signup','access_request')) as converted
      from audience_events e join current_sessions s on s.id = e.session_id cross join limits l
      where e.created_at >= l.current_start and e.created_at < l.window_end group by 1,s.id,s.visitor_id
    ), daily_sessions as (
      select day,count(distinct visitor_id) as visitors,count(*) as sessions,count(*) filter(where converted) as conversions
      from daily_activity group by day
    ), daily_pages as (
      select (p.viewed_at at time zone 'UTC')::date as day,count(*) as views from audience_pages p join current_sessions s on s.id = p.session_id
      cross join limits l where p.viewed_at >= l.current_start and p.viewed_at < l.window_end group by 1
    ), latest_pages as (
      select distinct on(p.session_id) p.session_id,p.page_id from audience_pages p join current_sessions s on s.id = p.session_id
      order by p.session_id,p.viewed_at desc,p.page_id desc
    ), page_durations as (
      select e.session_id,e.page_id,sum(e.duration_delta) as duration from audience_events e join current_sessions s on s.id = e.session_id
      cross join limits l where e.created_at >= l.current_start and e.created_at < l.window_end group by e.session_id,e.page_id
    ), page_rows as (
      select p.path,count(*) as views,count(distinct s.visitor_id) as visitors,round(avg(coalesce(pd.duration,0)),2) as duration,
        count(*) filter(where lp.page_id is not null) as exits
      from audience_pages p join current_sessions s on s.id = p.session_id
      left join latest_pages lp on lp.session_id = p.session_id and lp.page_id = p.page_id
      left join page_durations pd on pd.session_id = p.session_id and pd.page_id = p.page_id
      cross join limits l where p.viewed_at >= l.current_start and p.viewed_at < l.window_end
      group by p.path order by views desc,p.path limit 100
    ), source_rows as (
      select s.source,count(*) as sessions,count(distinct s.visitor_id) as visitors,count(*) filter(where s.converted) as conversions
      from current_sessions s group by s.source order by sessions desc,s.source limit 100
    ), campaign_rows as (
      select s.source,s.medium,s.campaign,count(*) as sessions,count(*) filter(where s.converted) as conversions
      from current_sessions s where s.campaign <> '' or s.medium <> '' group by s.source,s.medium,s.campaign order by sessions desc,s.source,s.medium,s.campaign limit 100
    ), device_rows as (select device,count(*) as sessions from current_sessions group by device order by sessions desc,device),
    browser_rows as (select browser,count(*) as sessions from current_sessions group by browser order by sessions desc,browser),
    country_rows as (select country,count(*) as sessions from current_sessions group by country order by sessions desc,country limit 100),
    heat_rows as (
      select extract(dow from p.viewed_at at time zone 'UTC')::integer as weekday,
        extract(hour from p.viewed_at at time zone 'UTC')::integer as hour,count(*) as pageviews
      from audience_pages p join current_sessions s on s.id = p.session_id cross join limits l
      where p.viewed_at >= l.current_start and p.viewed_at < l.window_end group by 1,2 order by 1,2
    ), goal_rows as (
      select e.name,count(*) as events,count(distinct e.session_id) as sessions from audience_events e
      join current_sessions s on s.id = e.session_id cross join limits l where e.kind = 'event'
        and e.created_at >= l.current_start and e.created_at < l.window_end group by e.name
    ), live_sessions as materialized (
      select s.* from audience_sessions s cross join limits l where s.last_seen_at >= l.generated_at - interval '5 minutes'
        and s.last_seen_at <= l.generated_at and (${device} = 'all' or s.device = ${device}) and (${source} = 'all' or s.source = ${source})
        and exists(select 1 from audience_pages p where p.session_id = s.id)
    ), live_pages as (
      select p.path,count(distinct s.visitor_id) as visitors from audience_pages p join live_sessions s on s.id = p.session_id cross join limits l
      where p.last_seen_at >= l.generated_at - interval '5 minutes' group by p.path order by visitors desc,p.path limit 20
    ), available_sources as (
      select distinct s.source from audience_sessions s cross join limits l where s.last_seen_at >= l.current_start and s.started_at < l.window_end
        and (${device} = 'all' or s.device = ${device})
        and exists(select 1 from audience_events e where e.session_id = s.id and e.created_at >= l.current_start and e.created_at < l.window_end)
        order by s.source limit 200
    )
    select jsonb_build_object(
      'totals',(select value from summaries where period = 'current'),
      'previous',(select value from summaries where period = 'previous'),
      'timeseries',(select coalesce(jsonb_agg(jsonb_build_object('date',to_char(d.day,'YYYY-MM-DD'), 'visitors',coalesce(s.visitors,0),
        'sessions',coalesce(s.sessions,0),'pageviews',coalesce(p.views,0),'conversions',coalesce(s.conversions,0)) order by d.day),'[]'::jsonb)
        from series_days d left join daily_sessions s on s.day = d.day::date left join daily_pages p on p.day = d.day::date),
      'realtime',jsonb_build_object('visitors',(select count(distinct visitor_id) from live_sessions),'sessions',(select count(*) from live_sessions),
        'windowMinutes',5,'pages',(select coalesce(jsonb_agg(jsonb_build_object('path',path,'visitors',visitors)),'[]'::jsonb) from live_pages)),
      'pages',(select coalesce(jsonb_agg(jsonb_build_object('path',path,'views',views,'visitors',visitors,'avgDurationSeconds',duration,'exits',exits)),'[]'::jsonb) from page_rows),
      'sources',(select coalesce(jsonb_agg(to_jsonb(source_rows)),'[]'::jsonb) from source_rows),
      'campaigns',(select coalesce(jsonb_agg(to_jsonb(campaign_rows)),'[]'::jsonb) from campaign_rows),
      'devices',(select coalesce(jsonb_agg(to_jsonb(device_rows)),'[]'::jsonb) from device_rows),
      'browsers',(select coalesce(jsonb_agg(to_jsonb(browser_rows)),'[]'::jsonb) from browser_rows),
      'countries',(select coalesce(jsonb_agg(to_jsonb(country_rows)),'[]'::jsonb) from country_rows),
      'heatmap',(select coalesce(jsonb_agg(to_jsonb(heat_rows)),'[]'::jsonb) from heat_rows),
      'goals',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'events',events,'sessions',sessions,
        'conversionRate',coalesce(round(100.0 * sessions / nullif((select count(*) from current_sessions),0),2),0))),'[]'::jsonb) from goal_rows),
      'filters',jsonb_build_object('sources',(select coalesce(jsonb_agg(source),'[]'::jsonb) from available_sources))
    ) as report
  `;
  const report: any = rows[0]?.report;
  if (!report) throw Object.assign(new Error('Audience report missing'), { status: 503 });
  return {
    ...report, period: window.period, comparison: window.comparison,
    goals: GOALS.map(name => report.goals.find((goal: any) => goal.name === name) || { name, events: 0, sessions: 0, conversionRate: 0 }),
    retentionDays: RETENTION_DAYS, generatedAt: now.toISOString()
  };
}
