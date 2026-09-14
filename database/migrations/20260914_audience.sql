-- First-party opt-in audience measurement. No IP, account ID, email or raw UA.
create table if not exists audience_consents (
  receipt_hash text primary key check (length(receipt_hash) = 64),
  analytics boolean not null,
  version text not null,
  visitor_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (not analytics or visitor_id is not null),
  check (expires_at <= created_at + interval '4320 hours')
);
create index if not exists audience_consents_expiry_idx on audience_consents(expires_at);

create table if not exists audience_sessions (
  id uuid primary key,
  token_hash text not null unique check (length(token_hash) = 64),
  consent_hash text not null references audience_consents(receipt_hash) on delete cascade,
  visitor_id uuid not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source text not null default 'direct' check (length(source) <= 253),
  medium text not null default '' check (length(medium) <= 64),
  campaign text not null default '' check (length(campaign) <= 64),
  device text not null check (device in ('desktop','mobile','tablet')),
  browser text not null check (browser in ('Chrome','Safari','Firefox','Edge','Opera','Samsung Internet','Autre')),
  country text not null default '' check (country = '' or country ~ '^[A-Z]{2}$')
);
create index if not exists audience_sessions_started_idx on audience_sessions(started_at);
create index if not exists audience_sessions_seen_idx on audience_sessions(last_seen_at);
create index if not exists audience_sessions_visitor_idx on audience_sessions(visitor_id, started_at);
create index if not exists audience_sessions_consent_idx on audience_sessions(consent_hash);
create index if not exists audience_sessions_dimensions_idx on audience_sessions(device, source, started_at);

create table if not exists audience_pages (
  session_id uuid not null references audience_sessions(id) on delete cascade,
  page_id uuid not null,
  path text not null check (length(path) <= 80 and path like '/%'),
  viewed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  scroll_depth integer not null default 0 check (scroll_depth between 0 and 100),
  primary key(session_id, page_id)
);
create index if not exists audience_pages_viewed_idx on audience_pages(viewed_at);
create index if not exists audience_pages_path_idx on audience_pages(path, viewed_at);

create table if not exists audience_events (
  event_id uuid primary key,
  session_id uuid not null,
  page_id uuid not null,
  kind text not null check (kind in ('pageview','engagement','event')),
  name text not null default '' check (name in ('','signup','login','access_request','pricing_view')),
  duration_delta integer not null default 0 check (duration_delta between 0 and 86400),
  created_at timestamptz not null default now(),
  foreign key(session_id,page_id) references audience_pages(session_id,page_id) on delete cascade,
  check ((kind in ('pageview','engagement') and name = '') or (kind = 'event' and name <> ''))
);
create unique index if not exists audience_events_goal_dedupe_idx on audience_events(session_id,page_id,kind,name) where kind <> 'engagement';
create index if not exists audience_events_created_idx on audience_events(created_at);

-- Serializes collection and withdrawal on the consent row. A receipt that has
-- been revoked cannot authorize a queued request after withdrawal commits.
create or replace function audience_record_event(
  p_receipt text, p_visitor uuid, p_token text, p_new_token text, p_session uuid,
  p_event uuid, p_page uuid, p_kind text, p_path text, p_name text,
  p_duration integer, p_scroll integer, p_source text, p_medium text, p_campaign text,
  p_device text, p_browser text, p_country text
) returns table(accepted boolean, new_session boolean, session_expired boolean)
language plpgsql as $$
declare
  consent audience_consents%rowtype;
  selected_session uuid;
  created_session boolean := false;
begin
  select * into consent from audience_consents where receipt_hash = p_receipt for update;
  if not found or not consent.analytics or consent.revoked_at is not null
    or consent.expires_at <= now() or consent.version <> '2026-09-14'
    or consent.visitor_id is distinct from p_visitor then
    return query select false, false, false;
    return;
  end if;
  if exists(select 1 from audience_events where event_id = p_event) then
    return query select true, false, false;
    return;
  end if;
  select id into selected_session from audience_sessions
    where token_hash = p_token and consent_hash = p_receipt and visitor_id = p_visitor
      and last_seen_at > now() - interval '30 minutes';
  if selected_session is null then
    -- Engagement/goals cannot manufacture a page or revive an expired session.
    if p_kind <> 'pageview' then return query select true, false, true; return; end if;
    selected_session := p_session;
    insert into audience_sessions(id,token_hash,consent_hash,visitor_id,source,medium,campaign,device,browser,country)
      values(selected_session,p_new_token,p_receipt,p_visitor,p_source,p_medium,p_campaign,p_device,p_browser,p_country);
    created_session := true;
  end if;
  if p_kind <> 'pageview' and not exists(select 1 from audience_pages where session_id = selected_session and page_id = p_page and path = p_path) then
    return query select true, false, true;
    return;
  end if;
  if p_kind = 'pageview' then
    if not exists(select 1 from audience_pages where session_id = selected_session) then
      update audience_sessions set started_at = now(),source = p_source,medium = p_medium,campaign = p_campaign,
        device = p_device,browser = p_browser,country = p_country where id = selected_session;
    end if;
    insert into audience_pages(session_id,page_id,path) values(selected_session,p_page,p_path)
      on conflict(session_id,page_id) do nothing;
    insert into audience_events(event_id,session_id,page_id,kind,name)
      select p_event,selected_session,p_page,'pageview',''
      where exists(select 1 from audience_pages where session_id = selected_session and page_id = p_page and path = p_path)
      on conflict do nothing;
  elsif p_kind = 'engagement' then
    insert into audience_events(event_id,session_id,page_id,kind,name,duration_delta)
      select p_event,selected_session,p_page,'engagement','',
        greatest(0,least(p_duration,greatest(0,extract(epoch from now() - viewed_at)::integer + 5)) - duration_seconds)
      from audience_pages where session_id = selected_session and page_id = p_page on conflict do nothing;
    update audience_pages set
      duration_seconds = greatest(duration_seconds, least(p_duration, greatest(0, extract(epoch from now() - viewed_at)::integer + 5))),
      scroll_depth = greatest(scroll_depth,p_scroll), last_seen_at = now()
      where session_id = selected_session and page_id = p_page and path = p_path;
  elsif p_kind = 'event' then
    insert into audience_events(event_id,session_id,page_id,kind,name)
      select p_event,selected_session,p_page,'event',p_name
      where exists(select 1 from audience_pages where session_id = selected_session and page_id = p_page and path = p_path)
      on conflict do nothing;
  end if;
  if exists(select 1 from audience_pages where session_id = selected_session and page_id = p_page and path = p_path) then
    update audience_sessions set last_seen_at = now() where id = selected_session;
  end if;
  return query select true, created_session, false;
end;
$$;
