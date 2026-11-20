alter table draft_rooms
  add column if not exists series_root uuid references draft_rooms(id) on delete cascade,
  add column if not exists game_number smallint not null default 1 check (game_number between 1 and 5),
  add column if not exists series_length smallint not null default 1 check (series_length between 1 and 5),
  add column if not exists draft_mode text not null default 'standard' check (draft_mode in ('standard','fearless')),
  add column if not exists turn_seconds smallint not null default 0 check (turn_seconds in (0,30,60)),
  add column if not exists turn_started_at timestamptz,
  add column if not exists first_pick text not null default 'blue' check (first_pick in ('blue','red'));
create unique index if not exists draft_rooms_series_game on draft_rooms(series_root, game_number);
