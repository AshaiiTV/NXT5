import { sql } from './db';
import { nexusError, nexusUuid } from './nexus-domain';
import { fixtureView } from './nexus-store';
import { generateSwissRound, validateCustomFixtures } from '../../../shared/nexus-tournament.js';
import { algorithmFixture, generatedRows, getSeason, insertFixtures, loadTournamentState, mutateSeason, seasonView } from './nexus-tournament-store';

async function approvedTeams(seasonId: string) {
  return sql`select t.id,t.name from nexus_registrations r join teams t on t.id=r.team_id
    where r.season_id=${seasonId} and r.status='approved' order by t.id`;
}
async function roundResponse(seasonId: string, round: number) {
  const [season, fixtures] = await Promise.all([
    getSeason(seasonId),
    sql`select * from nexus_fixtures where season_id=${seasonId} and stage='regular' and round=${round} order by fixture_key`
  ]);
  return { season: seasonView(season), fixtures: fixtures.map(fixtureView) };
}

/** The requested round is part of the command, so retrying a lost response never
 * advances another round. A season revision protects the standings snapshot. */
export async function advanceSwissRound(body: any) {
  const season = await getSeason(body.seasonId);
  if (season.format !== 'swiss') nexusError('Cette saison n’utilise pas de rondes suisses.');
  const round = body.round;
  if (!Number.isInteger(round) || round < 2 || round > season.swiss_rounds) nexusError('Numéro de ronde suisse invalide.');
  const rounds = season.swiss_state?.rounds || [];
  if (rounds.some((entry: any) => entry.round === round)) return roundResponse(season.id, round);
  if (season.status !== 'running' || !season.schedule_generated || season.playoff_bracket) nexusError('Les rondes suisses nécessitent une phase régulière en cours.', 409);
  if (round !== rounds.length + 1 || rounds.some((entry: any, index: number) => entry.round !== index + 1)) nexusError('La ronde demandée ne suit pas la dernière ronde enregistrée.', 409);
  const [state, teams] = await Promise.all([loadTournamentState(), approvedTeams(season.id)]);
  const previous = state.rawFixtures.filter(row => row.season_id === season.id && row.stage === 'regular');
  const result = generateSwissRound(teams.map(team => team.id), previous.map(row => ({ ...algorithmFixture(row, state.games), round: row.round })), {
    round, bestOf: season.regular_best_of,
    previousByes: rounds.flatMap((entry: any) => entry.byes.map((teamId: string) => ({ round: entry.round, teamId })))
  });
  if (result.blocked) nexusError('La prochaine ronde ne peut pas être générée : termine les séries en cours et vérifie les appariements sans revanche.', 409, 'NEXUS_SWISS_BLOCKED');
  const nextState = { rounds: [...rounds, { round, byes: result.byes }] };
  try {
    await mutateSeason(season, tx => [
      insertFixtures(tx, generatedRows(result.matches, season, teams, 'regular')),
      tx`update nexus_seasons set swiss_state=${JSON.stringify(nextState)}::jsonb where id=${season.id}`
    ]);
  } catch (err: any) {
    // A concurrent identical request is a successful replay, not a second round.
    if (err.code !== 'NEXUS_STALE_SEASON' || !(await getSeason(season.id)).swiss_state?.rounds?.some((entry: any) => entry.round === round)) throw err;
  }
  return roundResponse(season.id, round);
}

/** Manual scheduling still uses approved native teams and the normal roster /
 * importer / staff-review flow. There is no direct score or stats overwrite. */
export async function createManualFixture(body: any) {
  const season = await getSeason(body.seasonId);
  if (season.format !== 'custom') nexusError('La création libre est réservée aux saisons au calendrier libre.');
  const requestId = nexusUuid(body.requestId);
  const teamAId = nexusUuid(body.teamAId), teamBId = nexusUuid(body.teamBId);
  const round = body.round, bestOf = body.bestOf;
  const label = String(body.label || '').trim();
  if (teamAId === teamBId || !Number.isInteger(round) || round < 1 || round > 100 || ![1,3,5].includes(bestOf) || !label || label.length > 120) nexusError('Choisis deux équipes distinctes, une journée, un BO et un libellé valides.');
  const key = `custom-${requestId}`;
  async function existing() {
    const rows = await sql`select * from nexus_fixtures where season_id=${season.id} and fixture_key=${key}`;
    if (!rows.length) return null;
    const row = rows[0];
    if (row.team_a_id !== teamAId || row.team_b_id !== teamBId || row.round !== round || row.best_of !== bestOf || row.label !== label) nexusError('Cette demande a déjà créé une autre rencontre. Recharge avant de réessayer.', 409, 'NEXUS_CONFLICT');
    return fixtureView(row);
  }
  const replay = await existing();
  if (replay) return { fixture: replay };
  if (!['open','running'].includes(season.status) || !season.schedule_generated || season.playoff_bracket) nexusError('Initialise le calendrier libre d’une saison ouverte avant d’ajouter des rencontres.', 409);
  const teams = await approvedTeams(season.id);
  if (![teamAId, teamBId].every(id => teams.some(team => team.id === id))) nexusError('Les deux équipes NXT5 doivent être approuvées dans cette saison.', 403);
  const current = await sql`select fixture_key,team_a_id,team_b_id,round,best_of from nexus_fixtures where season_id=${season.id} and stage='regular'`;
  if (current.length >= 500) nexusError('Cette saison a atteint sa limite de 500 rencontres.', 409);
  try {
    validateCustomFixtures(teams.map(team => team.id), [
      ...current.map(row => ({ key: row.fixture_key, teamAId: row.team_a_id, teamBId: row.team_b_id, round: row.round, bestOf: row.best_of })),
      { key, teamAId, teamBId, round, bestOf }
    ]);
  } catch { nexusError('Une équipe possède déjà une rencontre pour cette journée. Choisis une autre journée.', 409, 'NEXUS_ROUND_CONFLICT'); }
  const rows = generatedRows([{ key, round, bestOf, teamAId, teamBId }], season, teams, 'regular');
  rows[0].label = label;
  try {
    await mutateSeason(season, tx => [insertFixtures(tx, rows)]);
  } catch (err: any) {
    if (err.code !== 'NEXUS_STALE_SEASON' || !(await existing())) throw err;
  }
  return { fixture: await existing() };
}
