import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { assertMethod,handleError,json } from './_lib/http';
import { getChampionDataMap } from './_lib/riot';
import { globalChampionStats } from './_lib/global-stats';

export default async function handler(request:Request,context:Context):Promise<Response> {
  try {
    assertMethod(request,'GET');
    await requirePlatformAdmin(request,context);
    const url=new URL(request.url);
    const days=Number(url.searchParams.get('days') ?? 30);
    const patch=url.searchParams.get('patch') || '';
    const role=url.searchParams.get('role') || 'ALL';
    if (![0,7,30,90,365].includes(days) || (patch && !/^\d{1,2}\.\d{1,2}$/.test(patch)) || !['ALL','TOP','JGL','MID','ADC','SUP'].includes(role))
      return json({error:'Filtres invalides.'},400);
    const to=new Date(),from=days ? new Date(to.getTime()-days*86400000):new Date('2000-01-01T00:00:00Z');
    const start=from.toISOString(),end=to.toISOString(),patchPattern=patch+'.%';
    const [[played,drafts,counts,patches,gameBans],catalog]=await Promise.all([
      sql.transaction(tx=>[
        tx`with chosen as (
          select distinct on (case when upper(m.game_id) ~ '^[A-Z]+[0-9]*_[0-9]+$' then upper(m.game_id) else upper(m.region)||':'||upper(m.game_id) end) m.id,m.result,m.created_at,
            (select count(*) from match_participants p where p.match_id=m.id) as participants
          from matches m where m.created_at>=${start} and m.created_at<${end}
            and (${patch}='' or m.patch=${patch} or m.patch like ${patchPattern})
          order by case when upper(m.game_id) ~ '^[A-Z]+[0-9]*_[0-9]+$' then upper(m.game_id) else upper(m.region)||':'||upper(m.game_id) end,participants desc,m.created_at desc,m.id
        ), observations as (
          select p.champion,case when p.raw->>'win' in ('true','false') then (p.raw->>'win')::boolean
            when m.result='Victoire' then p.team_key='ALLY'
            when m.result='Défaite' then p.team_key='ENEMY' else null end as win,
            case upper(p.role) when 'JUNGLE' then 'JGL' when 'MIDDLE' then 'MID' when 'BOTTOM' then 'ADC'
              when 'UTILITY' then 'SUP' when 'SUPPORT' then 'SUP' else upper(p.role) end as role
          from chosen m join match_participants p on p.match_id=m.id
        ) select champion,count(*)::int as picks,count(*) filter(where win is true)::int as wins,
            count(win)::int as known_results from observations
          where ${role}='ALL' or role=${role} group by champion`,
        tx`select snapshot from (
          select distinct on (source_id,game_number) source_id,game_number,snapshot,imported_at
          from opponent_drafts where imported_at>=${start} and imported_at<${end}
            and (${patch}='' or snapshot->>'patch'=${patch} or snapshot->>'patch' like ${patchPattern})
          order by source_id,game_number,imported_at desc,id desc
        ) unique_drafts order by source_id,game_number`,
        tx`select count(*)::int as imports,count(distinct (case when upper(game_id) ~ '^[A-Z]+[0-9]*_[0-9]+$' then upper(game_id) else upper(region)||':'||upper(game_id) end))::int as games
          from matches where created_at>=${start} and created_at<${end}
            and (${patch}='' or patch=${patch} or patch like ${patchPattern})`,
        tx`select patch from (
          select distinct patch from (
            select split_part(patch,'.',1)||'.'||split_part(patch,'.',2) as patch from matches
            union all select split_part(snapshot->>'patch','.',1)||'.'||split_part(snapshot->>'patch','.',2) from opponent_drafts
          ) sources where patch ~ '^[0-9]{1,2}[.][0-9]{1,2}$'
        ) patches order by split_part(patch,'.',1)::int desc,split_part(patch,'.',2)::int desc limit 100`,
        tx`with chosen as (
          select distinct on (case when upper(m.game_id) ~ '^[A-Z]+[0-9]*_[0-9]+$' then upper(m.game_id) else upper(m.region)||':'||upper(m.game_id) end) m.id,m.raw,m.created_at,
            (select count(*) from match_participants p where p.match_id=m.id) as participants
          from matches m where m.created_at>=${start} and m.created_at<${end}
            and (${patch}='' or m.patch=${patch} or m.patch like ${patchPattern})
          order by case when upper(m.game_id) ~ '^[A-Z]+[0-9]*_[0-9]+$' then upper(m.game_id) else upper(m.region)||':'||upper(m.game_id) end,participants desc,m.created_at desc,m.id
        ) select (select jsonb_agg(jsonb_build_object('teamId',t->'teamId','bans',t->'bans'))
          from jsonb_array_elements(case when jsonb_typeof(raw->'info'->'teams')='array' then raw->'info'->'teams' else '[]'::jsonb end) t) as teams
          from chosen`
      ],{isolationLevel:'RepeatableRead',readOnly:true}),
      getChampionDataMap({ signal:AbortSignal.timeout(10000) })
    ]);
    const stats=globalChampionStats(played,drafts,catalog,gameBans);
    return json({...stats,period:{from:start,to:end,days,patch,role},
      coverage:{...stats.coverage,games:Number(counts[0]?.games || 0),imports:Number(counts[0]?.imports || 0)},
      patches:patches.map(row=>row.patch)});
  } catch(error) {return handleError(error);}
}
