-- A scrim offer is either a fixed number of games or a best-of series.
alter table scrim_offers add column if not exists series text not null default 'fixed' check (series in ('fixed','bo3','bo5'));
