import { sql } from './db';

export type MatchPageOptions = { limit: number; offset: number };

export function matchPageOptions(url: URL): MatchPageOptions {
  const limit = Number(url.searchParams.get('limit') || 50);
  const offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) {
    throw Object.assign(new Error('Pagination invalide : limite entre 1 et 100 et position positive attendues.'), { status: 400 });
  }
  return { limit, offset };
}

// Only compact fields used by lists and basic statistics belong in Bootstrap.
// Full timeline events, frames and ward positions are fetched via match-details.
// Objective timings remain compact so team-wide tempo statistics stay usable.
export async function loadMatchPage(teamId: string, { limit, offset }: MatchPageOptions) {
  const [counts, matchSummaries] = await Promise.all([
    sql`select count(*)::int as total,
               count(*) filter (where result = 'Victoire')::int as wins,
               count(*) filter (where result = 'Défaite')::int as losses
        from matches where team_id = ${teamId}`,
    // A materialized page keeps PostgreSQL from evaluating the expensive JSON
    // projection (including timeline extraction) for rows discarded by OFFSET.
    // Keep the whole row so existing/future summary columns remain unchanged.
    sql`with match_page as materialized (
          select * from matches
          where team_id = ${teamId}
          order by created_at desc, id desc
          limit ${limit} offset ${offset}
        )
        -- A whole-row value cannot keep TOAST pointers: building it detoasts
        -- raw once. The lateral row (OFFSET 0 keeps it from being inlined)
        -- builds that value once per match, and every raw path below reads
        -- (d.m).raw from it instead of detoasting matches.raw again (1–3 MB).
        -- raw is cleared in the typed row BEFORE converting it to JSON, so the
        -- timeline is never copied; populate_record keeps all other columns,
        -- including future ones.
        select to_jsonb(jsonb_populate_record(d.m, '{"raw":null}'::jsonb)) - 'raw' as summary,
          jsonb_strip_nulls(jsonb_build_object(
            'nxt5Label', (d.m).raw -> 'nxt5Label',
            'nxt5', jsonb_build_object(
              'objectiveEvents', (
                select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'type', 'ELITE_MONSTER_KILL', 'timestamp', event -> 'timestamp',
                  'killerTeamId', event -> 'killerTeamId', 'killerId', event -> 'killerId',
                  'monsterType', event -> 'monsterType', 'monsterSubType', event -> 'monsterSubType'
                ))), '[]'::jsonb)
                from jsonb_array_elements(case
                  when jsonb_typeof((d.m).raw #> '{nxt5,timelineEvents}') = 'array'
                    then jsonb_path_query_array((d.m).raw #> '{nxt5,timelineEvents}', '$[*] ? (@.type == "ELITE_MONSTER_KILL")')
                  else jsonb_path_query_array(coalesce((d.m).raw #> '{timeline,info,frames}',
                    (d.m).raw #> '{metadata,timeline,info,frames}', (d.m).raw #> '{timeline,frames}', '[]'::jsonb),
                    '$[*].events[*] ? (@.type == "ELITE_MONSTER_KILL")')
                end) event
              ),
              'timelineSummary', jsonb_strip_nulls(jsonb_build_object(
              'available', coalesce((d.m).raw #> '{nxt5,timelineSummary,available}',
                to_jsonb(jsonb_path_exists((d.m).raw, '$.timeline.info.frames[0]')
                  or jsonb_path_exists((d.m).raw, '$.metadata.timeline.info.frames[0]')
                  or jsonb_path_exists((d.m).raw, '$.timeline.frames[0]'))),
              'frameCount', (d.m).raw #> '{nxt5,timelineSummary,frameCount}',
              'csMilestones', (d.m).raw #> '{nxt5,timelineSummary,csMilestones}',
              'wardCount', (d.m).raw #> '{nxt5,timelineSummary,wardCount}'
            ))),
            'info', jsonb_build_object(
              'gameCreation', (d.m).raw #> '{info,gameCreation}',
              'gameDuration', (d.m).duration_seconds,
              'teams', (d.m).raw #> '{info,teams}'
            )
          )) as raw,
          users.name as created_by_name, users.account_name as created_by_account
        from match_page matches
        cross join lateral (select matches as m offset 0) d
        left join users on users.id = matches.created_by
        order by matches.created_at desc, matches.id desc`
  ]);
  const matches = matchSummaries.map((row) => ({
    ...(row.summary || {}), raw: row.raw || {},
    created_by_name: row.created_by_name, created_by_account: row.created_by_account
  }));
  for (const match of matches) {
    const duration = Number(match.duration_seconds || 0);
    for (const milestone of Object.values(match.raw?.nxt5?.timelineSummary?.csMilestones || {}) as any[]) {
      if (!milestone || typeof milestone !== 'object') continue;
      if (duration < 600) milestone.cs10 = null;
      if (duration < 1200) milestone.cs20 = null;
    }
  }
  const matchIds = matches.map(match => match.id);
  const participantSummaries = matchIds.length ? await sql`
      select
        to_jsonb(jsonb_populate_record(d.p, '{"raw":null}'::jsonb)) - 'raw' as summary,
        jsonb_strip_nulls(jsonb_build_object(
          'participantId', coalesce((d.p).raw -> 'participantId', (d.p).raw #> '{participant,participantId}'),
          'teamId', coalesce((d.p).raw -> 'teamId', (d.p).raw #> '{participant,teamId}'),
          'championId', coalesce((d.p).raw -> 'championId', (d.p).raw #> '{participant,championId}'),
          'teamPosition', coalesce((d.p).raw -> 'teamPosition', (d.p).raw #> '{participant,teamPosition}'),
          'individualPosition', coalesce((d.p).raw -> 'individualPosition', (d.p).raw #> '{participant,individualPosition}'),
          'lane', coalesce((d.p).raw -> 'lane', (d.p).raw #> '{participant,lane}'),
          'summoner1Id', coalesce((d.p).raw -> 'summoner1Id', (d.p).raw #> '{participant,summoner1Id}'),
          'summoner2Id', coalesce((d.p).raw -> 'summoner2Id', (d.p).raw #> '{participant,summoner2Id}'),
          'item0', coalesce((d.p).raw -> 'item0', (d.p).raw #> '{participant,item0}'),
          'item1', coalesce((d.p).raw -> 'item1', (d.p).raw #> '{participant,item1}'),
          'item2', coalesce((d.p).raw -> 'item2', (d.p).raw #> '{participant,item2}'),
          'item3', coalesce((d.p).raw -> 'item3', (d.p).raw #> '{participant,item3}'),
          'item4', coalesce((d.p).raw -> 'item4', (d.p).raw #> '{participant,item4}'),
          'item5', coalesce((d.p).raw -> 'item5', (d.p).raw #> '{participant,item5}'),
          'item6', coalesce((d.p).raw -> 'item6', (d.p).raw #> '{participant,item6}'),
          'physicalDamageDealtToChampions', coalesce((d.p).raw -> 'physicalDamageDealtToChampions', (d.p).raw #> '{participant,physicalDamageDealtToChampions}'),
          'magicDamageDealtToChampions', coalesce((d.p).raw -> 'magicDamageDealtToChampions', (d.p).raw #> '{participant,magicDamageDealtToChampions}'),
          'trueDamageDealtToChampions', coalesce((d.p).raw -> 'trueDamageDealtToChampions', (d.p).raw #> '{participant,trueDamageDealtToChampions}'),
          'totalMinionsKilled', coalesce((d.p).raw -> 'totalMinionsKilled', (d.p).raw #> '{participant,totalMinionsKilled}'),
          'neutralMinionsKilled', coalesce((d.p).raw -> 'neutralMinionsKilled', (d.p).raw #> '{participant,neutralMinionsKilled}'),
          'timePlayed', coalesce((d.p).raw -> 'timePlayed', (d.p).raw #> '{participant,timePlayed}'),
          'challenges', jsonb_strip_nulls(jsonb_build_object(
            'laneMinionsFirst10Minutes', coalesce((d.p).raw #> '{challenges,laneMinionsFirst10Minutes}', (d.p).raw #> '{participant,challenges,laneMinionsFirst10Minutes}')
          )),
          'timeline', jsonb_strip_nulls(jsonb_build_object(
            'creepsPerMinDeltas', coalesce((d.p).raw #> '{timeline,creepsPerMinDeltas}', (d.p).raw #> '{participant,timeline,creepsPerMinDeltas}')
          ))
        )) as raw
      from match_participants
      -- Same single detoast as above for the participant's raw JSON.
      cross join lateral (select match_participants as p offset 0) d
      where match_id = any(${matchIds})
      order by team_key asc, role asc
    ` : [];
  const byMatch = new Map<string, any[]>();
  for (const row of participantSummaries) {
    const participant = { ...(row.summary || {}), raw: row.raw || {} };
    const list = byMatch.get(participant.match_id) || [];
    list.push(participant);
    byMatch.set(participant.match_id, list);
  }
  const total = Number(counts[0]?.total || 0);
  const nextOffset = offset + matches.length;
  return {
    matches: matches.map(match => ({ ...match, participants: byMatch.get(match.id) || [] })),
    totals: { games: total, wins: Number(counts[0]?.wins || 0), losses: Number(counts[0]?.losses || 0) },
    pagination: { limit, offset, total, hasMore: nextOffset < total, nextOffset: nextOffset < total ? nextOffset : null }
  };
}
