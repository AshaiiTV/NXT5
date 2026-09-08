-- Extend commercial interest only; no billing, subscriptions or access rights.
alter table access_requests
  drop constraint if exists access_requests_plan_code_check;

alter table access_requests
  add constraint access_requests_plan_code_check
  check (plan_code in ('free', 'team_monthly', 'team_season', 'structure'));
