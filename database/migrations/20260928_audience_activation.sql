-- Extend the existing consent-gated aggregate events; no identifiers are added.
alter table audience_events drop constraint if exists audience_events_name_check;
alter table audience_events add constraint audience_events_name_check
  check (name in ('','signup','login','access_request','pricing_view','first_import','first_review'));
