-- Team and account deletion must never fail on Nexus rows. The handlers refuse a
-- team still engaged in an open or running season; afterwards the registration
-- disappears with the team and past fixtures keep the team names without the link.
alter table nexus_registrations drop constraint if exists nexus_registrations_team_id_fkey;
alter table nexus_registrations add constraint nexus_registrations_team_id_fkey
  foreign key (team_id) references teams(id) on delete cascade;
alter table nexus_fixtures drop constraint if exists nexus_fixture_native_teams;
alter table nexus_fixtures add constraint nexus_fixture_native_teams check (
  stage = 'legacy' or (season_id is not null and fixture_key is not null and (team_a_id is null or team_b_id is null or team_a_id <> team_b_id))
);
