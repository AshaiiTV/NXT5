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
    sql`select to_jsonb(matches) - 'raw' as summary,
          jsonb_strip_nulls(jsonb_build_object(
            'nxt5Label', matches.raw -> 'nxt5Label',
            'nxt5', jsonb_build_object(
              'objectiveEvents', (
                select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'type', 'ELITE_MONSTER_KILL', 'timestamp', event -> 'timestamp',
                  'killerTeamId', event -> 'killerTeamId', 'killerId', event -> 'killerId',
                  'monsterType', event -> 'monsterType', 'monsterSubType', event -> 'monsterSubType'
                ))), '[]'::jsonb)
                from jsonb_array_elements(case
                  when jsonb_typeof(matches.raw #> '{nxt5,timelineEvents}') = 'array'
                    then jsonb_path_query_array(matches.raw #> '{nxt5,timelineEvents}', '$[*] ? (@.type == "ELITE_MONSTER_KILL")')
                  else jsonb_path_query_array(coalesce(matches.raw #> '{timeline,info,frames}',
                    matches.raw #> '{metadata,timeline,info,frames}', matches.raw #> '{timeline,frames}', '[]'::jsonb),
                    '$[*].events[*] ? (@.type == "ELITE_MONSTER_KILL")')
                end) event
              ),
              'timelineSummary', jsonb_strip_nulls(jsonb_build_object(
              'available', coalesce(matches.raw #> '{nxt5,timelineSummary,available}',
                to_jsonb(jsonb_path_exists(matches.raw, '$.timeline.info.frames[0]')
                  or jsonb_path_exists(matches.raw, '$.metadata.timeline.info.frames[0]')
                  or jsonb_path_exists(matches.raw, '$.timeline.frames[0]'))),
              'frameCount', matches.raw #> '{nxt5,timelineSummary,frameCount}',
              'csMilestones', matches.raw #> '{nxt5,timelineSummary,csMilestones}',
              'wardCount', matches.raw #> '{nxt5,timelineSummary,wardCount}'
            ))),
            'info', jsonb_build_object(
              'gameCreation', matches.raw #> '{info,gameCreation}',
              'gameDuration', matches.duration_seconds,
              'teams', matches.raw #> '{info,teams}'
            )
          )) as raw,
          users.name as created_by_name, users.account_name as created_by_account
        from matches
        left join users on users.id = matches.created_by
        where matches.team_id = ${teamId}
        order by matches.created_at desc, matches.id desc
        limit ${limit} offset ${offset}`
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
        to_jsonb(match_participants) - 'raw' as summary,
        jsonb_strip_nulls(jsonb_build_object(
          'participantId', coalesce(match_participants.raw -> 'participantId', match_participants.raw #> '{participant,participantId}'),
          'teamId', coalesce(match_participants.raw -> 'teamId', match_participants.raw #> '{participant,teamId}'),
          'championId', coalesce(match_participants.raw -> 'championId', match_participants.raw #> '{participant,championId}'),
          'teamPosition', coalesce(match_participants.raw -> 'teamPosition', match_participants.raw #> '{participant,teamPosition}'),
          'individualPosition', coalesce(match_participants.raw -> 'individualPosition', match_participants.raw #> '{participant,individualPosition}'),
          'lane', coalesce(match_participants.raw -> 'lane', match_participants.raw #> '{participant,lane}'),
          'summoner1Id', coalesce(match_participants.raw -> 'summoner1Id', match_participants.raw #> '{participant,summoner1Id}'),
          'summoner2Id', coalesce(match_participants.raw -> 'summoner2Id', match_participants.raw #> '{participant,summoner2Id}'),
          'item0', coalesce(match_participants.raw -> 'item0', match_participants.raw #> '{participant,item0}'),
          'item1', coalesce(match_participants.raw -> 'item1', match_participants.raw #> '{participant,item1}'),
          'item2', coalesce(match_participants.raw -> 'item2', match_participants.raw #> '{participant,item2}'),
          'item3', coalesce(match_participants.raw -> 'item3', match_participants.raw #> '{participant,item3}'),
          'item4', coalesce(match_participants.raw -> 'item4', match_participants.raw #> '{participant,item4}'),
          'item5', coalesce(match_participants.raw -> 'item5', match_participants.raw #> '{participant,item5}'),
          'item6', coalesce(match_participants.raw -> 'item6', match_participants.raw #> '{participant,item6}'),
          'physicalDamageDealtToChampions', coalesce(match_participants.raw -> 'physicalDamageDealtToChampions', match_participants.raw #> '{participant,physicalDamageDealtToChampions}'),
          'magicDamageDealtToChampions', coalesce(match_participants.raw -> 'magicDamageDealtToChampions', match_participants.raw #> '{participant,magicDamageDealtToChampions}'),
          'trueDamageDealtToChampions', coalesce(match_participants.raw -> 'trueDamageDealtToChampions', match_participants.raw #> '{participant,trueDamageDealtToChampions}'),
          'totalMinionsKilled', coalesce(match_participants.raw -> 'totalMinionsKilled', match_participants.raw #> '{participant,totalMinionsKilled}'),
          'neutralMinionsKilled', coalesce(match_participants.raw -> 'neutralMinionsKilled', match_participants.raw #> '{participant,neutralMinionsKilled}'),
          'timePlayed', coalesce(match_participants.raw -> 'timePlayed', match_participants.raw #> '{participant,timePlayed}'),
          'challenges', jsonb_strip_nulls(jsonb_build_object(
            'laneMinionsFirst10Minutes', coalesce(match_participants.raw #> '{challenges,laneMinionsFirst10Minutes}', match_participants.raw #> '{participant,challenges,laneMinionsFirst10Minutes}')
          )),
          'timeline', jsonb_strip_nulls(jsonb_build_object(
            'creepsPerMinDeltas', coalesce(match_participants.raw #> '{timeline,creepsPerMinDeltas}', match_participants.raw #> '{participant,timeline,creepsPerMinDeltas}')
          ))
        )) as raw
      from match_participants
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
