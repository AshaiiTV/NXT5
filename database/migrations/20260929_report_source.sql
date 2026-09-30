alter table reports add column if not exists source text not null default 'manual'
  check (source in ('manual', 'auto'));

-- Conservative backfill: require the exact current generator title, header and
-- every participant line, with no extra prose. Changed teams/stats stay manual.
-- Historical participant order was unspecified: recover it from the report.
with candidates as (
  select r.id, r.team_id, r.match_id, r.created_at
  from reports r
  join matches m on m.id = r.match_id and m.team_id = r.team_id
  join teams t on t.id = r.team_id
  cross join lateral (
    select string_agg(line, E'\n' order by strpos(r.content, line)) as lines, count(*) as n
    from (
      select '- **' || coalesce(nullif(p.role, ''), 'ROLE') || ' ' ||
        coalesce(nullif(p.summoner_name, ''), nullif(p.riot_id, ''), 'Joueur') || '** sur **' ||
        coalesce(nullif(p.champion, ''), 'Champion') || '** : ' || p.kda || ', ' ||
        trim_scale(p.cs_per_min)::text || ' CS/min, ' || trim_scale(p.gold_per_min)::text || ' gold/min, ' ||
        p.damage::text || ' dégâts, ' || coalesce(p.damage_to_turrets, 0)::text || ' dégâts tours, ' ||
        p.vision::text || ' vision.' as line
      from match_participants p where p.match_id = m.id and p.team_key = 'ALLY'
    ) participant_lines
  ) expected
  where r.source = 'manual'
    and r.title = 'Review — ' || t.name || ' — ' || m.game_id
    and r.match_ids = jsonb_build_array(m.id)
    and expected.n = 5
    and r.content = '## Review — ' || t.name || E'\n\n**Résultat :** ' || m.result ||
      E'  \n**Durée :** ' || m.duration || E'  \n**Side :** ' || m.side ||
      E'  \n**Objectifs neutres :** ' || m.objective_score || E'  \n**Vision diff :** ' ||
      m.vision_score || E'\n\n### Données joueurs\n' || expected.lines
), ranked as (
  select *, row_number() over (partition by team_id, match_id order by created_at, id) as position
  from candidates
)
update reports r set source = 'auto' from ranked c
where r.id = c.id and c.position = 1
  and not exists (select 1 from reports a where a.team_id = c.team_id and a.match_id = c.match_id and a.source = 'auto');

create unique index if not exists idx_reports_auto_match on reports(team_id, match_id) where source = 'auto';
