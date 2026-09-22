import { sql } from './db';

export async function loadBotWorkflows(teamId: string, userId: string) {
  try {
    const [events, goals] = await Promise.all([
      sql(`select e.*,coalesce(s.timezone,'Europe/Paris') as timezone,r.status as my_response,r.delay_minutes as my_delay_minutes
        from discord_team_events e left join discord_bot_settings s on s.team_id=e.team_id
        left join discord_event_responses r on r.event_id=e.id and r.user_id=$2
        where e.team_id=$1 and exists(select 1 from teams t left join team_members m on m.team_id=t.id and m.user_id=$2 where t.id=e.team_id and (t.owner_id=$2 or m.user_id=$2)) and e.starts_at >= now()-interval '7 days' order by e.starts_at limit 200`, [teamId,userId]),
      sql(`select g.*,p.name as player_name,u.name as created_by_name from discord_team_goals g
        join teams t on t.id=g.team_id left join team_members m on m.team_id=g.team_id and m.user_id=$2
        left join players p on p.id=g.player_id and p.team_id=g.team_id left join users u on u.id=g.created_by
        where g.team_id=$1 and (t.owner_id=$2 or m.user_id=$2) and (g.player_id is null or p.user_id=$2 or t.owner_id=$2 or m.role in ('captain','coach','assistant','analyst','manager','board'))
        order by (g.status='active') desc,g.created_at desc limit 200`, [teamId,userId]),
    ]);
    return { botEvents: events, botGoals: goals };
  } catch (err) {
    if (err?.code === '42P01') return { botEvents: [], botGoals: [] };
    throw err;
  }
}
