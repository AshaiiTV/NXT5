import { sql } from './db';
import { championPoolRefreshQueries } from './analytics';
import { assertImportPlayerAssignments } from './import-validation';

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];

function unavailable(message = 'Les données d’origine de cette game sont incomplètes. Réimporte le fichier complet pour corriger son côté sans perdre de statistiques.'): never {
  throw Object.assign(new Error(message), { status: 409, code: 'NXT5_MATCH_SIDE_SOURCE_INCOMPLETE' });
}

function sideTeamId(side: unknown) {
  const value = String(side || '').trim().toUpperCase();
  return value === 'BLUE' || value === 'BLUE SIDE' ? 100 : value === 'RED' || value === 'RED SIDE' ? 200 : null;
}

function participantSnapshot(participants: Array<Record<string, any>>) {
  return participants.map(({ id, raw, team_key, player_id, role, vision }) => ({ id, raw, team_key, player_id, role, vision }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

/** Prepare only fields whose meaning changes with our team's perspective.
 * Individual statistics, Riot team IDs and timeline events remain absolute.
 */
export function prepareMatchSideChange({ match, participants, archive, allyTeamSide, playerAssignments, roster }) {
  const requestedSide = String(allyTeamSide || '').trim().toUpperCase();
  if (!['BLUE', 'RED'].includes(requestedSide)) {
    throw Object.assign(new Error('Choisis le côté Blue ou Red de notre équipe.'), { status: 400 });
  }
  const allyTeamId = sideTeamId(requestedSide)!;
  const previousTeamId = sideTeamId(match.side);
  if (!previousTeamId) unavailable();
  const side = allyTeamId === 100 ? 'Blue Side' : 'Red Side';
  if (allyTeamId === previousTeamId) return { unchanged: true, side };

  const sources = [match.raw, archive?.payload].filter(Boolean);
  const originalParticipants = sources.flatMap(source => Array.isArray(source?.info?.participants) ? source.info.participants : []);
  const seenParticipantIds = new Set<number>();
  if (participants.length !== 10) unavailable();
  const assignments = participants.map(participant => {
    const raw = participant.raw || {};
    const participantId = Number(raw.participantId ?? raw.participant?.participantId);
    if (!Number.isInteger(participantId) || participantId < 1 || participantId > 10 || seenParticipantIds.has(participantId)) unavailable();
    seenParticipantIds.add(participantId);
    const originals = originalParticipants.filter(original => Number(original.participantId) === participantId);
    const teamId = Number(raw.teamId ?? raw.participant?.teamId ?? originals[0]?.teamId);
    if (![100, 200].includes(teamId) || originals.some(original => Number(original.teamId) !== teamId || original.championName !== participant.champion)) unavailable();
    if (participant.team_key !== (teamId === previousTeamId ? 'ALLY' : 'ENEMY')) unavailable();
    return { id: participant.id, team_key: teamId === allyTeamId ? 'ALLY' : 'ENEMY', role: participant.role, player_id: null as string | null };
  });
  const allies = assignments.filter(participant => participant.team_key === 'ALLY');
  if (allies.length !== 5 || assignments.filter(participant => participant.team_key === 'ENEMY').length !== 5) unavailable();
  if (ROLES.some(role => allies.filter(participant => participant.role === role).length !== 1)) {
    unavailable('Corrige d’abord les rôles des cinq futurs alliés avec « Corriger les rôles et profils », puis change le côté de notre équipe.');
  }

  const profiles = Object.fromEntries(ROLES.map(role => [role, String(playerAssignments?.[role] || '').trim()]));
  assertImportPlayerAssignments(profiles, roster);
  for (const participant of allies) participant.player_id = profiles[participant.role];

  // Missing objective totals must not silently become zero for an older import.
  const targetTeam = sources.flatMap(source => Array.isArray(source?.info?.teams) ? source.info.teams : []).find(team =>
    Number(team.teamId) === allyTeamId && typeof team.win === 'boolean'
    && ['dragon', 'baron', 'tower'].every(objective => {
      const count = team.objectives?.[objective]?.kills;
      return Number.isSafeInteger(count) && count >= 0;
    }));
  if (!targetTeam) unavailable();
  const allyIds = new Set(allies.map(participant => participant.id));
  if (participants.some(participant => !Number.isSafeInteger(participant.vision) || participant.vision < 0)) unavailable();
  const visionDiff = participants.reduce((total, participant) => total + (allyIds.has(participant.id) ? 1 : -1) * participant.vision, 0);
  return {
    unchanged: false,
    side,
    result: targetTeam.win ? 'Victoire' : 'Défaite',
    objective_score: `Dragons ${targetTeam.objectives.dragon.kills} · Barons ${targetTeam.objectives.baron.kills} · Tours ${targetTeam.objectives.tower.kills}`,
    vision_score: visionDiff >= 0 ? `+${visionDiff}` : String(visionDiff),
    assignments,
    profiles
  };
}

export async function changeMatchSide({ teamId, match, userId, allyTeamSide, playerAssignments }) {
  const [participants, archives, roster] = await Promise.all([
    sql`select * from match_participants where match_id = ${match.id}`,
    sql`select id, payload from match_raw_archives where team_id = ${teamId} and match_id = ${match.id} and game_id = ${match.game_id} limit 1`,
    sql`select id from players where team_id = ${teamId}`
  ]);
  const change = prepareMatchSideChange({ match, participants, archive: archives[0], roster, allyTeamSide, playerAssignments });
  if (change.unchanged) return { ok: true, match, warnings: [] };
  const playerIds = Object.values(change.profiles!);
  const snapshot = JSON.stringify(participantSnapshot(participants));
  let results;
  try {
    results = await sql.transaction(tx => [
      tx`select id from teams where id = ${teamId} for update`,
      tx`select id from matches where id = ${match.id} and team_id = ${teamId} for update`,
      tx`select id from match_participants where match_id = ${match.id} for update`,
      // Neon batches cannot branch. These guards abort the entire transaction
      // if an import, role edit, permission change or roster deletion raced us.
      tx`select 1 / case when count(*) = 1 then 1 else 0 end as match_valid
         from matches m join teams t on t.id = m.team_id
         where m.id = ${match.id} and m.team_id = ${teamId} and m.side = ${match.side} and m.raw is not distinct from ${match.raw == null ? null : JSON.stringify(match.raw)}::jsonb
           and (t.owner_id = ${userId} or exists (
             select 1 from team_members tm where tm.team_id = t.id and tm.user_id = ${userId}
               and (m.created_by = ${userId} or lower(tm.role) in ('captain', 'coach', 'assistant', 'analyst', 'manager', 'board'))
           ))`,
      tx`select 1 / case when jsonb_agg(jsonb_build_object(
           'id', id, 'raw', raw, 'team_key', team_key, 'player_id', player_id, 'role', role, 'vision', vision
         ) order by id) = ${snapshot}::jsonb then 1 else 0 end as participants_valid
         from match_participants where match_id = ${match.id}`,
      tx`select 1 / case when count(*) = 5 then 1 else 0 end as profiles_valid
         from (select id from players where team_id = ${teamId} and id = any(${playerIds}::uuid[]) for key share) locked_players`,
      tx`update matches set side = ${change.side}, result = ${change.result}, objective_score = ${change.objective_score}, vision_score = ${change.vision_score}
         where id = ${match.id} and team_id = ${teamId}`,
      tx`update match_participants p set team_key = assignment.team_key, player_id = assignment.player_id
         from jsonb_to_recordset(${JSON.stringify(change.assignments)}::jsonb) as assignment(id uuid, team_key text, player_id uuid)
         where p.id = assignment.id and p.match_id = ${match.id}`,
      ...championPoolRefreshQueries(tx, teamId),
      tx`insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
         values (${userId}, 'matches.side', 'match', ${match.id}, ${JSON.stringify({ teamId, fromSide: match.side, toSide: change.side, playerAssignments: change.profiles })}::jsonb)`,
      tx`select * from matches where id = ${match.id} and team_id = ${teamId}`,
      tx`select exists(select 1 from reports where team_id = ${teamId}
         and (match_id = ${match.id} or match_ids @> ${JSON.stringify([match.id])}::jsonb)) as has_reviews`
    ]);
  } catch (error: any) {
    if (error?.code === '22012' || error?.code === '23503') {
      throw Object.assign(new Error('La game, les accès ou les profils ont changé. Recharge l’équipe puis réessaie.'), { status: 409, code: 'NXT5_MATCH_SIDE_REFERENCE_CHANGED' });
    }
    throw error;
  }
  const savedMatch = results[results.length - 2][0];
  const hasReviews = results[results.length - 1][0]?.has_reviews || savedMatch.review_status === 'done';
  return {
    ok: true,
    match: savedMatch,
    warnings: hasReviews ? [{ code: 'MATCH_REVIEWS_NEED_CHECK', message: 'Les reviews existantes sont conservées. Vérifie les analyses écrites avant la correction du côté.' }] : []
  };
}
