-- NXT5 Importer 0.3.3 and earlier stored Data Dragon display names ("Wukong",
-- "Dr. Mundo") for games read from the LoL client, while Riot imports carry
-- match-v5 names ("MonkeyKing", "DrMundo"). Align the stored names so match
-- statistics, champion pools and matchup notebooks group both sources.
-- Raw match JSON is left untouched. Repeatable: a second run changes nothing.

drop table if exists pg_temp.champion_name_fixes;
create temporary table champion_name_fixes (
  display_name text primary key,
  riot_name text not null
);
insert into champion_name_fixes (display_name, riot_name) values
  ('Aurelion Sol', 'AurelionSol'),
  ('Bel''Veth', 'Belveth'),
  ('Cho''Gath', 'Chogath'),
  ('Dr. Mundo', 'DrMundo'),
  ('Fiddlesticks', 'FiddleSticks'),
  ('Jarvan IV', 'JarvanIV'),
  ('K''Sante', 'KSante'),
  ('Kai''Sa', 'Kaisa'),
  ('Kha''Zix', 'Khazix'),
  ('Kog''Maw', 'KogMaw'),
  ('LeBlanc', 'Leblanc'),
  ('Lee Sin', 'LeeSin'),
  ('Master Yi', 'MasterYi'),
  ('Miss Fortune', 'MissFortune'),
  ('Nunu & Willump', 'Nunu'),
  ('Rek''Sai', 'RekSai'),
  ('Renata Glasc', 'Renata'),
  ('Tahm Kench', 'TahmKench'),
  ('Twisted Fate', 'TwistedFate'),
  ('Vel''Koz', 'Velkoz'),
  ('Wukong', 'MonkeyKing'),
  ('Xin Zhao', 'XinZhao');

update match_participants p
set champion = f.riot_name
from champion_name_fixes f
where p.champion = f.display_name;

-- Notebook keys are lowercase without punctuation; only three spellings differ.
drop table if exists pg_temp.champion_key_fixes;
create temporary table champion_key_fixes as
select lower(regexp_replace(display_name, '[^A-Za-z0-9]', '', 'g')) as old_key, lower(riot_name) as new_key
from champion_name_fixes
where lower(regexp_replace(display_name, '[^A-Za-z0-9]', '', 'g')) <> lower(riot_name);

-- A notebook already saved under the Riot key wins; the other one is kept as is.
update player_matchup_notebooks n
set champion = k.new_key
from champion_key_fixes k
where n.champion = k.old_key
  and not exists (
    select 1 from player_matchup_notebooks o
    where o.team_id = n.team_id and o.player_id = n.player_id and o.champion = k.new_key
      and o.opponent_champion = n.opponent_champion and o.role = n.role
  );

update player_matchup_notebooks n
set opponent_champion = k.new_key
from champion_key_fixes k
where n.opponent_champion = k.old_key
  and not exists (
    select 1 from player_matchup_notebooks o
    where o.team_id = n.team_id and o.player_id = n.player_id and o.champion = n.champion
      and o.opponent_champion = k.new_key and o.role = n.role
  );

-- Champion pool rows from Riot data are derived from match_participants and
-- rebuilt at each import. Reproduce the rebuild result now, without waiting:
-- a derived row never coexists with a manual row for the same champion.
drop table if exists pg_temp.champion_pool_pairs;
create temporary table champion_pool_pairs as
select
  d.id as display_id,
  c.id as riot_id,
  coalesce(d.source, 'riot') in ('manual', 'riot_manual') as display_manual,
  coalesce(c.source, 'riot') in ('manual', 'riot_manual') as riot_manual
from champion_pool d
join champion_name_fixes f on f.display_name = d.champion
join champion_pool c
  on c.team_id = d.team_id
  and c.player_id is not distinct from d.player_id
  and c.champion = f.riot_name;

-- Both rows derived: merge the games into the Riot-named row.
update champion_pool c
set
  games = c.games + d.games,
  wins = c.wins + d.wins,
  losses = c.losses + d.losses,
  kda = round((c.kda * c.games + d.kda * d.games) / greatest(1, c.games + d.games), 2),
  cs_per_min = round((c.cs_per_min * c.games + d.cs_per_min * d.games) / greatest(1, c.games + d.games), 1),
  updated_at = now()
from champion_pool_pairs p
join champion_pool d on d.id = p.display_id
where c.id = p.riot_id and not p.display_manual and not p.riot_manual;

update champion_pool c
set
  winrate = round((c.wins::numeric / greatest(1, c.games)) * 100),
  verdict = case
    when c.games >= 5 and round((c.wins::numeric / greatest(1, c.games)) * 100) >= 60 then 'Volume élevé, WR positif'
    when c.games >= 5 and round((c.wins::numeric / greatest(1, c.games)) * 100) <= 40 then 'Volume élevé, WR faible'
    when c.games >= 3 then 'Situationnel'
    else 'Données insuffisantes'
  end
from champion_pool_pairs p
where c.id = p.riot_id and not p.display_manual and not p.riot_manual;

-- Derived row under a display name: merged above, or hidden by a manual row.
delete from champion_pool d
using champion_pool_pairs p
where d.id = p.display_id and not p.display_manual;

-- Manual row under a display name: it takes the Riot name and hides the derived row.
delete from champion_pool c
using champion_pool_pairs p
where c.id = p.riot_id and p.display_manual and not p.riot_manual;

-- Remaining display names have no Riot-named counterpart (two manual rows are left as is).
update champion_pool d
set champion = f.riot_name
from champion_name_fixes f
where d.champion = f.display_name
  and not exists (
    select 1 from champion_pool c
    where c.team_id = d.team_id
      and c.player_id is not distinct from d.player_id
      and c.champion = f.riot_name
  );

drop table pg_temp.champion_pool_pairs;
drop table pg_temp.champion_key_fixes;
drop table pg_temp.champion_name_fixes;
