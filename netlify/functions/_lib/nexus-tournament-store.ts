import crypto from "node:crypto";
import { sql } from "./db";
import { nexusError, nexusUuid, riotId, riotIdKey } from "./nexus-domain";
import { fixtureView, reviewNexusSubmission } from "./nexus-store";
import {
  generateRoundRobin,
  generatePlayoffBracket,
  progressPlayoffs,
  resolveSeries,
  calculateStandings,
  generateGroups,
  generateSwissRound,
  generateDoubleElimination,
  generateNexusSixPlayoffs,
} from "../../../shared/nexus-tournament.js";

const MANAGEMENT_ROLES = ["captain", "manager"];
const PLAYING_ROLES = ["TOP", "JGL", "MID", "ADC", "SUP", "SUB"];
export function seasonView(row: any) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    format: row.format,
    playoffEnabled: row.playoff_enabled,
    groupCount: row.group_count,
    advancePerGroup: row.advance_per_group,
    swissRounds: row.swiss_rounds,
    swissState: row.swiss_state,
    doubleVariant: row.double_variant,
    upperFinalBestOf: row.upper_final_best_of,
    resetFinal: row.reset_final,
    legs: row.legs,
    regularBestOf: row.regular_best_of,
    playoffSize: row.playoff_size,
    playoffFormat: row.playoff_format,
    finalBestOf: row.final_best_of,
    rulesConfirmed: row.rules_confirmed,
    playoffBestOf: row.playoff_best_of,
    scheduleGenerated: row.schedule_generated,
    playoffBracket: row.playoff_bracket,
    tieResolutionNote: row.tie_resolution_note,
    createdAt: row.created_at,
  };
}
export function registrationView(row: any) {
  return {
    id: row.id,
    seasonId: row.season_id,
    teamId: row.team_id,
    teamName: row.team_name,
    status: row.status,
    rosterPlayerIds: row.roster_player_ids,
    rosterRiotIds: row.roster_riot_ids,
    createdAt: row.created_at,
  };
}
export function playerView(row: any) {
  return {
    id: row.id,
    name: row.name,
    riotId: row.riot_id,
    role: row.role,
    rosterStatus: row.roster_status,
  };
}
function configuration(body: any) {
  const name = String(body.name || "").trim();
  if (!name || name.length > 120)
    nexusError("Nom de saison requis (120 caractères maximum).");
  const playoffFormat = body.playoffFormat || "single_elimination";
  const finalBestOf = body.finalBestOf ?? 5;
  const format = body.format || "round_robin",
    doubleVariant = body.doubleVariant || "standard";
  const groupCount = body.groupCount ?? 2,
    advancePerGroup = body.advancePerGroup ?? 2,
    swissRounds = body.swissRounds ?? 3,
    upperFinalBestOf = body.upperFinalBestOf ?? 3;
  if (
    ![1, 2].includes(body.legs) ||
    ![1, 3, 5].includes(body.regularBestOf) ||
    ![2, 4, 6, 8, 16].includes(body.playoffSize) ||
    ![1, 3, 5].includes(body.playoffBestOf) ||
    ![1, 3, 5].includes(finalBestOf) ||
    !["single_elimination", "double_elimination"].includes(playoffFormat)
  )
    nexusError("Configuration de saison invalide.");
  if (
    ![
      "round_robin",
      "groups",
      "single_elimination",
      "double_elimination",
      "swiss",
      "custom",
    ].includes(format) ||
    !["standard", "nexus_site", "nexus_pdf"].includes(doubleVariant) ||
    !Number.isInteger(groupCount) ||
    groupCount < 2 ||
    groupCount > 16 ||
    !Number.isInteger(advancePerGroup) ||
    advancePerGroup < 1 ||
    advancePerGroup > 8 ||
    !Number.isInteger(swissRounds) ||
    swissRounds < 1 ||
    swissRounds > 16 ||
    ![1, 3, 5].includes(upperFinalBestOf)
  )
    nexusError("Paramètres du format invalides.");
  const direct = ["single_elimination", "double_elimination"].includes(format);
  const hasBracket = direct || body.playoffEnabled !== false;
  const isDouble = (direct ? format : playoffFormat) === "double_elimination";
  if (
    hasBracket &&
    isDouble &&
    doubleVariant !== "standard" &&
    body.playoffSize !== 6
  )
    nexusError("Le format Nexus à six équipes nécessite exactement six seeds.");
  if (
    hasBracket &&
    isDouble &&
    doubleVariant === "standard" &&
    ![4, 8, 16].includes(body.playoffSize)
  )
    nexusError(
      "La double élimination standard utilise quatre, huit ou seize équipes.",
    );
  if (hasBracket && !isDouble && body.playoffSize === 6)
    nexusError("Six seeds nécessitent un format Nexus à double élimination.");
  return {
    name,
    format,
    playoffEnabled: body.playoffEnabled !== false,
    groupCount,
    advancePerGroup,
    swissRounds,
    doubleVariant,
    upperFinalBestOf,
    resetFinal: body.resetFinal !== false,
    legs: body.legs,
    regularBestOf: body.regularBestOf,
    playoffSize: body.playoffSize,
    playoffBestOf: body.playoffBestOf,
    playoffFormat,
    finalBestOf,
    rulesConfirmed: body.rulesConfirmed === true,
  };
}
export async function getSeason(value: unknown) {
  const rows =
    await sql`select * from nexus_seasons where id = ${nexusUuid(value)}`;
  if (!rows.length) nexusError("Saison introuvable.", 404);
  return rows[0];
}
export async function mutateSeason(
  season: any,
  statements: (tx: any) => any[],
) {
  try {
    return await sql.transaction((tx) => [
      tx`select id from nexus_seasons where id = ${season.id} for update`,
      tx`select 1 / case when count(*) = 1 then 1 else 0 end as nexus_revision_valid from nexus_seasons where id = ${season.id} and revision = ${season.revision}`,
      ...statements(tx),
      tx`update nexus_seasons set revision = revision + 1 where id = ${season.id}`,
    ]);
  } catch (err: any) {
    if (err.code === "22012")
      nexusError(
        "La saison a changé pendant cette opération. Recharge puis réessaie.",
        409,
        "NEXUS_STALE_SEASON",
      );
    if (err.code === "23505")
      nexusError(
        "Cette partie ou cette opération est déjà enregistrée.",
        409,
        "NEXUS_CONFLICT",
      );
    throw err;
  }
}
export async function createSeason(body: any) {
  const config = configuration(body);
  const rows =
    await sql`insert into nexus_seasons(name,legs,regular_best_of,playoff_size,playoff_best_of,playoff_format,final_best_of,rules_confirmed,format,playoff_enabled,group_count,advance_per_group,swiss_rounds,double_variant,upper_final_best_of,reset_final)
    values(${config.name},${config.legs},${config.regularBestOf},${config.playoffSize},${config.playoffBestOf},${config.playoffFormat},${config.finalBestOf},${config.rulesConfirmed},${config.format},${config.playoffEnabled},${config.groupCount},${config.advancePerGroup},${config.swissRounds},${config.doubleVariant},${config.upperFinalBestOf},${config.resetFinal}) returning *`;
  return seasonView(rows[0]);
}
export async function updateSeason(body: any) {
  const season = await getSeason(body.seasonId);
  const config = configuration({ ...seasonView(season), ...body });
  const status = body.status ?? season.status;
  if (!["draft", "open", "running", "completed"].includes(status))
    nexusError("État de saison invalide.");
  const order = ["draft", "open", "running", "completed"];
  if (
    order.indexOf(status) < order.indexOf(season.status) ||
    order.indexOf(status) > order.indexOf(season.status) + 1
  )
    nexusError(
      "La saison suit les étapes brouillon, inscriptions, compétition puis terminée.",
    );
  if (
    season.schedule_generated &&
    Object.keys(config)
      .filter((key) => key !== "name")
      .some((key) => config[key] !== seasonView(season)[key])
  )
    nexusError("Le format est verrouillé après génération du calendrier.", 409);
  if (status !== "draft" && !config.rulesConfirmed)
    nexusError(
      "Confirme les règles de cette saison avant d’ouvrir les inscriptions.",
    );
  if (status === "running" && !season.schedule_generated)
    nexusError("Génère le calendrier avant de lancer la saison.");
  if (status === "completed") {
    const state = await loadTournamentState();
    const fixtures = state.rawFixtures.filter(
      (row) => row.season_id === season.id,
    );
    const bracket = state.playoffs.find(
      (row) => row.seasonId === season.id,
    )?.bracket;
    if (
      !fixtures.length ||
      fixtures.some(
        (row) => seriesFor(row, state.games).status !== "complete",
      ) ||
      ((season.playoff_enabled ||
        ["single_elimination", "double_elimination"].includes(season.format)) &&
        !bracket?.winnerTeamId) ||
      (season.format === "swiss" &&
        (season.swiss_state?.rounds?.length || 0) < season.swiss_rounds)
    )
      nexusError(
        "Les séries et la finale doivent être validées avant de terminer la saison.",
      );
  }
  await mutateSeason(season, (tx) => [
    tx`update nexus_seasons set name=${config.name},status=${status},legs=${config.legs},regular_best_of=${config.regularBestOf},playoff_size=${config.playoffSize},playoff_best_of=${config.playoffBestOf},playoff_format=${config.playoffFormat},final_best_of=${config.finalBestOf},rules_confirmed=${config.rulesConfirmed},format=${config.format},playoff_enabled=${config.playoffEnabled},group_count=${config.groupCount},advance_per_group=${config.advancePerGroup},swiss_rounds=${config.swissRounds},double_variant=${config.doubleVariant},upper_final_best_of=${config.upperFinalBestOf},reset_final=${config.resetFinal} where id=${season.id}`,
  ]);
  return seasonView(await getSeason(season.id));
}
export async function managedTeams(userId: string) {
  return sql`select distinct t.id,t.name from teams t left join team_members m on m.team_id=t.id and m.user_id=${userId}
    where t.owner_id=${userId} or m.role=any(${MANAGEMENT_ROLES}) order by t.name`;
}
export async function registerTeam(userId: string, body: any) {
  const season = await getSeason(body.seasonId);
  const teamId = nexusUuid(body.teamId);
  if (!(await managedTeams(userId)).some((team) => team.id === teamId))
    nexusError(
      "Seul le propriétaire, un capitaine ou un manager de cette équipe peut l’inscrire.",
      403,
      "NEXUS_REGISTRATION_FORBIDDEN",
    );
  if (season.status !== "open" || season.schedule_generated)
    nexusError("Les inscriptions de cette saison sont fermées.", 409);
  // Check eligibility from native active player profiles, never from submitted names.
  const players = await activeRoster(teamId);
  if (players.length < 5 || players.length > 8)
    nexusError(
      "L’effectif inscrit doit contenir cinq joueurs et au plus trois remplaçants actifs avec un Riot ID complet.",
    );
  try {
    await sql.transaction((tx) => [
      tx`select id from nexus_seasons where id=${season.id} for update`,
      tx`select id from teams where id=${teamId} for update`,
      tx`select team_id from team_members where team_id=${teamId} and user_id=${userId} for update`,
      tx`select 1/case when count(*)=1 then 1 else 0 end as registration_authorized from teams t where t.id=${teamId}
          and (t.owner_id=${userId} or exists(select 1 from team_members m where m.team_id=t.id and m.user_id=${userId} and m.role=any(${MANAGEMENT_ROLES})))`,
      tx`select 1/case when count(*)=1 then 1 else 0 end as registration_open from nexus_seasons where id=${season.id} and status='open' and not schedule_generated`,
      tx`select id from players where id=any(${players.slice(0, 5).map((row) => row.id)}::uuid[]) order by id for update`,
      tx`select 1/case when count(*)=5 then 1 else 0 end as roster_still_valid from players where id=any(${players.slice(0, 5).map((row) => row.id)}::uuid[]) and team_id=${teamId} and roster_status in ('MAIN','SUB') and role=any(${PLAYING_ROLES})`,
      tx`insert into nexus_registrations(season_id,team_id,registered_by,roster_player_ids,roster_riot_ids) values(${season.id},${teamId},${userId},${JSON.stringify(players.map((row) => row.id))}::jsonb,${JSON.stringify(players.map((row) => riotId(row.riot_id)))}::jsonb) on conflict(season_id,team_id) do nothing`,
      tx`update nexus_seasons set revision=revision+1 where id=${season.id}`,
    ]);
  } catch (err: any) {
    if (err.code === "22012")
      nexusError(
        "Inscription refusée : droits d’équipe retirés ou inscriptions fermées.",
        403,
        "NEXUS_REGISTRATION_FORBIDDEN",
      );
    throw err;
  }
  const row = (
    await sql`select r.*,t.name as team_name from nexus_registrations r join teams t on t.id=r.team_id where r.season_id=${season.id} and r.team_id=${teamId}`
  )[0];
  return registrationView(row);
}
export async function reviewRegistration(body: any) {
  if (!["approved", "rejected"].includes(body.status))
    nexusError("Décision d’inscription invalide.");
  const registration = (
    await sql`select * from nexus_registrations where id=${nexusUuid(body.registrationId)}`
  )[0];
  if (!registration) nexusError("Inscription introuvable.", 404);
  const season = await getSeason(registration.season_id);
  if (
    (season.schedule_generated || !["draft", "open"].includes(season.status)) &&
    !(
      body.refreshRoster === true &&
      registration.status === "approved" &&
      body.status === "approved" &&
      season.status !== "completed"
    )
  )
    nexusError(
      "Les inscriptions sont figées après génération. Utilise la validation de modification d’effectif.",
      409,
    );
  const players =
    body.status === "approved" ? await activeRoster(registration.team_id) : [];
  if (body.status === "approved" && (players.length < 5 || players.length > 8))
    nexusError(
      "L’effectif doit comprendre cinq joueurs et au plus trois remplaçants.",
    );
  const riotIds = players.map((row) => riotId(row.riot_id));
  const keys = riotIds.map(riotIdKey);
  if (new Set(keys).size !== keys.length)
    nexusError("Deux profils utilisent le même Riot ID.");
  const conflicts =
    await sql`select riot_id_key from nexus_season_players where season_id=${season.id} and registration_id<>${registration.id} and riot_id_key=any(${keys})`;
  if (conflicts.length)
    nexusError(
      "Un joueur est déjà inscrit dans une autre équipe de cette saison.",
      409,
      "NEXUS_PLAYER_ALREADY_REGISTERED",
    );
  await mutateSeason(season, (tx) => [
    tx`select id from teams where id=${registration.team_id} for update`,
    tx`select id from players where id=any(${players.map((row) => row.id)}::uuid[]) order by id for update`,
    tx`select 1/case when count(*)=${players.length} then 1 else 0 end as approved_roster_current from players p join jsonb_to_recordset(${JSON.stringify(players.map((row) => ({ id: row.id, riot_id: row.riot_id })))}::jsonb) x(id uuid,riot_id text) on p.id=x.id and p.riot_id=x.riot_id where p.team_id=${registration.team_id} and p.roster_status in ('MAIN','SUB') and p.role=any(${PLAYING_ROLES})`,
    tx`select 1/case when count(*)=0 then 1 else 0 end as account_not_registered_elsewhere from nexus_season_players where season_id=${season.id} and registration_id<>${registration.id} and riot_id_key=any(${keys})`,
    tx`insert into nexus_season_players(season_id,registration_id,player_id,riot_id_key) select ${season.id},${registration.id},id,riot_id_key from jsonb_to_recordset(${JSON.stringify(players.map((row, index) => ({ id: row.id, riot_id_key: keys[index] })))}::jsonb) x(id uuid,riot_id_key text)
       on conflict(season_id,riot_id_key) do update set player_id=excluded.player_id where nexus_season_players.registration_id=excluded.registration_id`,
    tx`update nexus_registrations set status=${body.status},roster_player_ids=${JSON.stringify(players.map((row) => row.id))}::jsonb,roster_riot_ids=${JSON.stringify(riotIds)}::jsonb,reviewed_at=now() where id=${registration.id}`,
  ]);
  return { ok: true };
}
export async function activeRoster(teamId: string) {
  const rows =
    await sql`select id,name,riot_id,role,roster_status from players where team_id=${teamId} and roster_status in ('MAIN','SUB') and role=any(${PLAYING_ROLES}) order by role,name,id`;
  return rows.filter((row) => {
    try {
      riotId(row.riot_id);
      return true;
    } catch {
      return false;
    }
  });
}
export async function fixtureRosters(id: unknown) {
  const fixture = (
    await sql`select * from nexus_fixtures where id=${nexusUuid(id)}`
  )[0];
  if (!fixture) nexusError("Rencontre introuvable.", 404);
  const [a, b] = await Promise.all([
    fixture.team_a_id ? activeRoster(fixture.team_a_id) : [],
    fixture.team_b_id ? activeRoster(fixture.team_b_id) : [],
  ]);
  return {
    fixture: fixtureView(fixture),
    rosterA: a.map(playerView),
    rosterB: b.map(playerView),
  };
}
export function generatedRows(
  matches: any[],
  season: any,
  teams: any[],
  stage: string,
) {
  return matches
    .filter(
      (match) =>
        match.teamAId &&
        match.teamBId &&
        (!match.status ||
          ["ready", "in-progress", "complete"].includes(match.status)),
    )
    .map((match) => ({
      id: crypto.randomUUID(),
      season_id: season.id,
      fixture_key: match.key,
      stage,
      round: match.round,
      best_of: match.bestOf,
      bracket_group: match.stage || match.bracket || null,
      group_id: match.groupId || null,
      team_a_id: match.teamAId,
      team_b_id: match.teamBId,
      team_a: teams.find((team) => team.id === match.teamAId)?.name,
      team_b: teams.find((team) => team.id === match.teamBId)?.name,
      label: `${season.name} · ${stage === "regular" ? "Journée" : "Playoffs"} ${match.round}`,
    }));
}
export function insertFixtures(tx: any, rows: any[]) {
  return tx`insert into nexus_fixtures(id,season_id,fixture_key,stage,round,best_of,bracket_group,group_id,team_a_id,team_b_id,team_a,team_b,label,platform,roster)
    select id,season_id,fixture_key,stage,round,best_of,bracket_group,group_id,team_a_id,team_b_id,team_a,team_b,label,'EUW1','[]'::jsonb
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(id uuid,season_id uuid,fixture_key text,stage text,round integer,best_of integer,bracket_group text,group_id text,team_a_id uuid,team_b_id uuid,team_a text,team_b text,label text)
    on conflict(season_id,fixture_key) do nothing`;
}
function buildBracket(season: any, seeds: string[], body: any) {
  const format =
    season.format === "double_elimination"
      ? "double_elimination"
      : season.format === "single_elimination"
        ? "single_elimination"
        : season.playoff_format;
  if (format === "double_elimination") {
    if (season.double_variant === "standard")
      return generateDoubleElimination(seeds, {
        bestOf: season.playoff_best_of,
        finalBestOf: season.final_best_of,
        resetFinal: season.reset_final,
      });
    if (![3, 4].includes(body.firstSeedOpponent))
      nexusError(
        "Choisis explicitement le seed 3 ou 4 comme adversaire du premier seed.",
      );
    return generateNexusSixPlayoffs(seeds, {
      variant: season.double_variant === "nexus_pdf" ? "pdf" : "site",
      firstSeedOpponent: body.firstSeedOpponent,
      upperFinalBestOf: season.upper_final_best_of,
      finalBestOf: season.final_best_of,
    });
  }
  const bracket = generatePlayoffBracket(seeds, {
    bestOf: season.playoff_best_of,
  });
  const final = bracket.matches.at(-1);
  if (final) final.bestOf = season.final_best_of;
  return bracket;
}
function assertBracketReplay(season: any, body: any) {
  const seeds = Array.isArray(body.seeds) ? body.seeds.map(nexusUuid) : [];
  if (
    JSON.stringify(seeds) !== JSON.stringify(season.playoff_bracket?.seeds) ||
    (season.playoff_bracket?.format === "nexus-six" &&
      body.firstSeedOpponent !== season.playoff_bracket.firstSeedOpponent)
  )
    nexusError(
      "Un tableau différent existe déjà. Recharge la saison avant de poursuivre.",
      409,
      "NEXUS_BRACKET_CONFLICT",
    );
}
export async function generateSchedule(body: any) {
  const season = await getSeason(body.seasonId);
  if (
    season.schedule_generated &&
    ["single_elimination", "double_elimination"].includes(season.format)
  )
    assertBracketReplay(season, body);
  if (!season.schedule_generated) {
    if (season.status !== "open")
      nexusError("Ouvre les inscriptions avant de générer le calendrier.");
    const teams =
      await sql`select t.id,t.name from nexus_registrations r join teams t on t.id=r.team_id where r.season_id=${season.id} and r.status='approved' order by t.id`;
    const direct = ["single_elimination", "double_elimination"].includes(
      season.format,
    );
    const minimum = season.playoff_enabled || direct ? season.playoff_size : 2;
    if (teams.length < minimum || teams.length > 32)
      nexusError(`Il faut entre ${minimum} et 32 équipes approuvées.`);
    const ids = teams.map((row) => row.id);
    let matches: any[] = [],
      bracket: any = null,
      swissState: any = { rounds: [] };
    if (direct) {
      const seeds = Array.isArray(body.seeds) ? body.seeds.map(nexusUuid) : [];
      if (
        seeds.length !== teams.length ||
        seeds.length !== season.playoff_size ||
        new Set(seeds).size !== seeds.length ||
        seeds.some((id) => !ids.includes(id))
      )
        nexusError(
          "Classe explicitement toutes les équipes approuvées pour générer ce tableau.",
        );
      bracket = buildBracket(season, seeds, body);
      matches = bracket.matches;
    } else if (season.format === "groups") {
      if (
        season.group_count * 2 > teams.length ||
        (season.playoff_enabled &&
          (season.group_count * season.advance_per_group !==
            season.playoff_size ||
            season.advance_per_group >
              Math.floor(teams.length / season.group_count)))
      )
        nexusError(
          "Chaque poule doit compter au moins deux équipes et ses qualifiés doivent correspondre à la taille des playoffs.",
        );
      matches = generateGroups(ids, {
        groupCount: season.group_count,
        legs: season.legs,
        bestOf: season.regular_best_of,
      }).matches;
    } else if (season.format === "swiss") {
      if (season.swiss_rounds > teams.length - (teams.length % 2 ? 0 : 1))
        nexusError(
          "Le nombre de rondes dépasse les adversaires disponibles sans revanche.",
        );
      const generated = generateSwissRound(ids, [], {
        round: 1,
        bestOf: season.regular_best_of,
      });
      if (generated.blocked)
        nexusError("La première ronde suisse ne peut pas être constituée.");
      matches = generated.matches;
      swissState = { rounds: [{ round: 1, byes: generated.byes }] };
    } else if (season.format === "round_robin")
      matches = generateRoundRobin(ids, {
        doubleRoundRobin: season.legs === 2,
        bestOf: season.regular_best_of,
      }).matches;
    const rows = generatedRows(
      matches,
      season,
      teams,
      direct ? "playoff" : "regular",
    );
    try {
      await mutateSeason(season, (tx) => [
        insertFixtures(tx, rows),
        tx`update nexus_seasons set schedule_generated=true,playoff_bracket=${bracket ? JSON.stringify(bracket) : null}::jsonb,swiss_state=${JSON.stringify(swissState)}::jsonb where id=${season.id}`,
      ]);
    } catch (err: any) {
      const current = await getSeason(season.id);
      if (err.code !== "NEXUS_STALE_SEASON" || !current.schedule_generated)
        throw err;
      if (direct) assertBracketReplay(current, body);
    }
  }
  return {
    season: seasonView(await getSeason(season.id)),
    fixtures: (
      await sql`select * from nexus_fixtures where season_id=${season.id} order by round,fixture_key`
    ).map(fixtureView),
  };
}
export async function scheduleFixture(body: any) {
  const fixture = (
    await sql`select * from nexus_fixtures where id=${nexusUuid(body.fixtureId)}`
  )[0];
  if (!fixture || !fixture.season_id || fixture.stage === "legacy")
    nexusError("Rencontre de saison introuvable.", 404);
  if (
    (
      await sql`select id from nexus_import_pairings where fixture_id=${fixture.id} union all select id from nexus_submissions where fixture_id=${fixture.id} limit 1`
    ).length
  )
    nexusError(
      "Cet effectif est verrouillé : une liaison ou une collecte existe déjà.",
      409,
      "NEXUS_ROSTER_LOCKED",
    );
  const season = await getSeason(fixture.season_id);
  if (season.status === "completed")
    nexusError("Cette saison est terminée.", 409);
  const starts = Date.parse(body.startsAt),
    ends = Date.parse(body.endsAt);
  if (
    !Number.isFinite(starts) ||
    !Number.isFinite(ends) ||
    ends - starts < 60_000 ||
    ends - starts > 48 * 3600_000
  )
    nexusError("Fenêtre de partie invalide (1 minute à 48 heures).");
  const idsA = Array.isArray(body.playerIdsA)
    ? body.playerIdsA.map(nexusUuid)
    : [];
  const idsB = Array.isArray(body.playerIdsB)
    ? body.playerIdsB.map(nexusUuid)
    : [];
  if (
    idsA.length !== 5 ||
    idsB.length !== 5 ||
    new Set([...idsA, ...idsB]).size !== 10
  )
    nexusError("Choisis cinq profils distincts dans chaque effectif NXT5.");
  const [rosterA, rosterB] = await Promise.all([
    activeRoster(fixture.team_a_id),
    activeRoster(fixture.team_b_id),
  ]);
  const selectedA = idsA.map((id) => rosterA.find((row) => row.id === id));
  const selectedB = idsB.map((id) => rosterB.find((row) => row.id === id));
  if ([...selectedA, ...selectedB].some((row) => !row))
    nexusError(
      "Un joueur sélectionné ne fait plus partie de cet effectif actif.",
      409,
    );
  const selected = [...selectedA, ...selectedB] as any[];
  const roster = selected.map((row) => riotId(row.riot_id));
  if (new Set(roster.map(riotIdKey)).size !== 10)
    nexusError("Un même compte Riot ne peut pas jouer dans les deux équipes.");
  const approved =
    await sql`select * from nexus_registrations where season_id=${season.id} and team_id=any(${[fixture.team_a_id, fixture.team_b_id]}::uuid[]) and status='approved'`;
  if (
    approved.length !== 2 ||
    selected.some((player, index) => {
      const registration = approved.find(
        (row) =>
          row.team_id === (index < 5 ? fixture.team_a_id : fixture.team_b_id),
      );
      const position =
        registration?.roster_player_ids?.indexOf(player.id) ?? -1;
      return (
        !registration ||
        position < 0 ||
        riotIdKey(registration.roster_riot_ids[position]) !==
          riotIdKey(player.riot_id)
      );
    })
  )
    nexusError(
      "Le staff doit valider les changements de l’effectif inscrit avant de planifier ces joueurs.",
      409,
      "NEXUS_ROSTER_APPROVAL_REQUIRED",
    );
  await mutateSeason(season, (tx) => [
    tx`select id from teams where id=any(${[fixture.team_a_id, fixture.team_b_id].sort()}::uuid[]) order by id for update`,
    tx`select id from nexus_fixtures where id=${fixture.id} for update`,
    tx`select id from players where id=any(${[...idsA, ...idsB]}::uuid[]) order by id for update`,
    tx`select 1/case when count(*)=10 then 1 else 0 end as native_roster_valid from players p
       join jsonb_to_recordset(${JSON.stringify(selected.map((row, index) => ({ id: row.id, team_id: index < 5 ? fixture.team_a_id : fixture.team_b_id, riot_id: row.riot_id })))}::jsonb) x(id uuid,team_id uuid,riot_id text)
       on p.id=x.id and p.team_id=x.team_id and p.riot_id=x.riot_id where p.roster_status in ('MAIN','SUB') and p.role=any(${PLAYING_ROLES})`,
    tx`select 1/case when not exists(select 1 from nexus_import_pairings where fixture_id=${fixture.id}) and not exists(select 1 from nexus_submissions where fixture_id=${fixture.id}) then 1 else 0 end as snapshot_unlocked`,
    tx`update nexus_fixtures set starts_at=${new Date(starts).toISOString()},ends_at=${new Date(ends).toISOString()},roster=${JSON.stringify(roster)}::jsonb,player_ids=${JSON.stringify([...idsA, ...idsB])}::jsonb where id=${fixture.id}`,
  ]);
  return fixtureView(
    (await sql`select * from nexus_fixtures where id=${fixture.id}`)[0],
  );
}
export function fixtureGames(fixture: any, games: any[]) {
  return games
    .filter((game) => game.fixture_id === fixture.id)
    .map((game) => ({
      gameId: game.game_id,
      status: game.status,
      winner: game.summary.winner,
      gameCreation:
        Number(game.game_time || game.summary?.gameStartedAt) || undefined,
    }));
}
export function algorithmFixture(fixture: any, games: any[]) {
  return {
    key: fixture.fixture_key,
    round: fixture.round,
    teamAId: fixture.team_a_id,
    teamBId: fixture.team_b_id,
    bestOf: fixture.best_of,
    games: fixtureGames(fixture, games),
  };
}
export function seriesFor(fixture: any, games: any[]) {
  const input = algorithmFixture(fixture, games);
  return resolveSeries(input, input.games);
}
export async function loadTournamentState() {
  // Read revisions before their dependent data: any concurrent write then makes
  // the optimistic mutation guard fail instead of accepting an older score set.
  const seasons =
    await sql`select * from nexus_seasons order by created_at desc`;
  const [registrations, fixtures, games] = await Promise.all([
    sql`select r.*,t.name as team_name from nexus_registrations r join teams t on t.id=r.team_id order by r.created_at desc`,
    sql`select * from nexus_fixtures order by season_id,round,fixture_key`,
    sql`select id,fixture_id,game_id,status,summary,created_at,coalesce((summary->>'gameStartedAt')::numeric,(payload#>>'{match,info,gameCreation}')::numeric,(payload#>>'{match,info,gameEndTimestamp}')::numeric-(payload#>>'{match,info,gameDuration}')::numeric*1000) as game_time from nexus_submissions where status='accepted'`,
  ]);
  const standings = seasons.flatMap((season) => {
    const approved = registrations.filter(
      (row) => row.season_id === season.id && row.status === "approved",
    );
    const regular = fixtures.filter(
      (row) => row.season_id === season.id && row.stage === "regular",
    );
    const groupIds =
      season.format === "groups"
        ? [...new Set(regular.map((row) => row.group_id))]
        : [null];
    return groupIds.map((groupId) => {
      const groupFixtures = regular.filter(
        (row) => groupId === null || row.group_id === groupId,
      );
      const groupTeams =
        groupId === null
          ? approved.map((row) => row.team_id)
          : [
              ...new Set(
                groupFixtures.flatMap((row) => [row.team_a_id, row.team_b_id]),
              ),
            ];
      const result = calculateStandings(
        groupTeams,
        groupFixtures.map((row) => algorithmFixture(row, games)),
        {
          winPoints: 3,
          lossPoints: 0,
          qualificationCount: season.playoff_enabled
            ? season.format === "groups"
              ? season.advance_per_group
              : season.playoff_size
            : null,
          tieBreakers:
            season.double_variant !== "standard"
              ? ["headToHead", "gameDifference"]
              : [],
          byes:
            season.format === "swiss"
              ? (season.swiss_state?.rounds || []).flatMap((round: any) =>
                  round.byes.map((teamId: string) => ({
                    round: round.round,
                    teamId,
                  })),
                )
              : [],
        } as any,
      );
      return {
        seasonId: season.id,
        groupId,
        ...result,
        rows: result.rows.map((row) => ({
          ...row,
          teamName:
            approved.find((team) => team.team_id === row.teamId)?.team_name ||
            "",
        })),
      };
    });
  });
  const playoffs = seasons
    .filter((season) => season.playoff_bracket)
    .map((season) => ({
      seasonId: season.id,
      bracket: progressPlayoffs(
        season.playoff_bracket,
        Object.fromEntries(
          fixtures
            .filter(
              (row) => row.season_id === season.id && row.stage === "playoff",
            )
            .map((row) => [row.fixture_key, fixtureGames(row, games)]),
        ),
      ),
    }));
  return {
    seasons: seasons.map(seasonView),
    registrations: registrations.map(registrationView),
    fixtures: fixtures.map((row) => ({
      ...fixtureView(row),
      series: row.team_a_id && row.team_b_id ? seriesFor(row, games) : null,
    })),
    standings,
    playoffs,
    rawSeasons: seasons,
    rawRegistrations: registrations,
    rawFixtures: fixtures,
    games,
  };
}
export async function seedPlayoffs(body: any) {
  const state = await loadTournamentState();
  const season = state.rawSeasons.find(
    (row) => row.id === nexusUuid(body.seasonId),
  );
  if (!season || season.status !== "running")
    nexusError("Les playoffs nécessitent une saison en cours.");
  if (!season.playoff_enabled)
    nexusError("Cette saison ne prévoit pas de playoffs.");
  if (season.playoff_bracket) {
    assertBracketReplay(season, body);
    return {
      season: seasonView(season),
      fixtures: state.fixtures.filter(
        (row) => row.seasonId === season.id && row.stage === "playoff",
      ),
    };
  }
  const fixtures = state.rawFixtures.filter(
    (row) => row.season_id === season.id && row.stage === "regular",
  );
  if (
    !fixtures.length ||
    fixtures.some((row) => seriesFor(row, state.games).status !== "complete")
  )
    nexusError(
      "Toutes les séries régulières doivent être terminées avant les playoffs.",
    );
  if (
    season.format === "swiss" &&
    (season.swiss_state?.rounds?.length || 0) < season.swiss_rounds
  )
    nexusError("Toutes les rondes suisses doivent être terminées.");
  const seeds = Array.isArray(body.seeds) ? body.seeds.map(nexusUuid) : [];
  const approved = state.rawRegistrations.filter(
    (row) => row.season_id === season.id && row.status === "approved",
  );
  if (
    seeds.length !== season.playoff_size ||
    new Set(seeds).size !== seeds.length ||
    seeds.some((id) => !approved.some((team) => team.team_id === id))
  )
    nexusError("Les seeds doivent désigner des équipes approuvées distinctes.");
  const standings = state.standings.filter((row) => row.seasonId === season.id);
  const note = String(body.tieResolutionNote || "").trim();
  if (
    standings.some((row) =>
      row.ties.some((tie: any) =>
        tie.teamIds.some((id: string) => seeds.includes(id)),
      ),
    ) &&
    (note.length < 10 || note.length > 2000)
  )
    nexusError(
      "Documente la résolution des égalités avant de valider les seeds.",
    );
  // Explicit staff seeds may resolve equal ranks, but cannot omit a strictly better team.
  for (const standing of standings) {
    const ranked = standing.rows as any[];
    const selected = seeds.filter((id) =>
      ranked.some((row) => row.teamId === id),
    );
    if (
      season.format === "groups" &&
      selected.length !== season.advance_per_group
    )
      nexusError(
        "Le nombre de qualifiés doit être respecté dans chaque poule.",
      );
    for (let i = 0; i < selected.length; i++) {
      const candidate = ranked.find((row) => row.teamId === selected[i]);
      const strictlyAhead = ranked.filter((row) => row.rank < candidate.rank);
      if (
        strictlyAhead.some((row) => !selected.slice(0, i).includes(row.teamId))
      )
        nexusError("Les seeds doivent respecter le classement hors égalités.");
    }
  }
  const bracket = buildBracket(season, seeds, body);
  const teams = approved.map((row) => ({
    id: row.team_id,
    name: row.team_name,
  }));
  await mutateSeason(season, (tx) => [
    insertFixtures(
      tx,
      generatedRows(bracket.matches, season, teams, "playoff"),
    ),
    tx`update nexus_seasons set playoff_bracket=${JSON.stringify(bracket)}::jsonb,tie_resolution_note=${note || null} where id=${season.id}`,
  ]);
  return {
    season: seasonView(await getSeason(season.id)),
    fixtures: (
      await sql`select * from nexus_fixtures where season_id=${season.id} and stage='playoff' order by round,fixture_key`
    ).map(fixtureView),
  };
}
export async function reviewTournamentSubmission(body: any) {
  if (!["accepted", "rejected"].includes(body.status))
    nexusError("Décision invalide.");
  const submission = (
    await sql`select s.*,f.season_id,f.stage,f.fixture_key from nexus_submissions s join nexus_fixtures f on f.id=s.fixture_id where s.id=${nexusUuid(body.submissionId)}`
  )[0];
  if (!submission) nexusError("Contribution introuvable.", 404);
  if (!submission.season_id || submission.stage === "legacy")
    return reviewNexusSubmission(body);
  const state = await loadTournamentState();
  const season = state.rawSeasons.find(
    (row) => row.id === submission.season_id,
  )!;
  if (season.status !== "running")
    nexusError("La validation des parties exige une saison en cours.", 409);
  if (submission.status === body.status)
    return { id: submission.id, status: submission.status };
  const fixtures = state.rawFixtures.filter(
    (row) => row.season_id === season.id,
  );
  const fixture = fixtures.find((row) => row.id === submission.fixture_id)!;
  if (
    season.format === "swiss" &&
    fixture.round <
      Math.max(
        0,
        ...(season.swiss_state?.rounds || []).map((row: any) => row.round),
      )
  )
    nexusError(
      "La ronde suisse suivante est déjà appariée : les résultats de cette ronde sont verrouillés.",
      409,
      "NEXUS_SWISS_ROUND_LOCKED",
    );
  const changedGames = state.games.filter((row) => row.id !== submission.id);
  if (body.status === "accepted")
    changedGames.push({
      ...submission,
      status: body.status,
      game_time:
        submission.summary.gameStartedAt ??
        submission.payload?.match?.info?.gameCreation ??
        (submission.payload?.match?.info?.gameEndTimestamp != null &&
        submission.payload?.match?.info?.gameDuration != null
          ? submission.payload.match.info.gameEndTimestamp -
            submission.payload.match.info.gameDuration * 1000
          : undefined),
    });
  if (seriesFor(fixture, changedGames).status === "conflict")
    nexusError(
      "Cette partie rendrait la série incohérente ou dépasserait son BO.",
      409,
      "NEXUS_SERIES_CONFLICT",
    );
  let bracket = season.playoff_bracket;
  const removedFixtures: string[] = [];
  let newFixtures: any[] = [];
  if (bracket) {
    if (fixture.stage === "regular")
      nexusError(
        "Les seeds des playoffs sont déjà validés : les résultats réguliers sont verrouillés.",
        409,
        "NEXUS_BRACKET_LOCKED",
      );
    const gamesByKey = Object.fromEntries(
      fixtures
        .filter((row) => row.stage === "playoff")
        .map((row) => [row.fixture_key, fixtureGames(row, changedGames)]),
    );
    const progressed = progressPlayoffs(bracket, gamesByKey, {
      previous: bracket,
    });
    if (progressed.conflicts.length)
      nexusError(
        "Une rencontre dépendante possède déjà des parties : correction refusée.",
        409,
        "NEXUS_BRACKET_LOCKED",
      );
    for (const downstream of fixtures.filter(
      (row) => row.stage === "playoff" && row.id !== fixture.id,
    )) {
      const node = progressed.matches.find(
        (row: any) => row.key === downstream.fixture_key,
      );
      if (
        !node ||
        !["ready", "in-progress", "complete"].includes(node.status) ||
        node.teamAId !== downstream.team_a_id ||
        node.teamBId !== downstream.team_b_id
      )
        removedFixtures.push(downstream.id);
    }
    if (removedFixtures.length) {
      const evidence =
        await sql`select id from nexus_submissions where fixture_id=any(${removedFixtures}::uuid[]) union all select id from nexus_import_pairings where fixture_id=any(${removedFixtures}::uuid[]) limit 1`;
      if (evidence.length)
        nexusError(
          "Une rencontre dépendante est déjà liée ou possède des parties : correction refusée.",
          409,
          "NEXUS_BRACKET_LOCKED",
        );
    }
    bracket = progressed;
    const teams = state.rawRegistrations
      .filter((row) => row.season_id === season.id)
      .map((row) => ({ id: row.team_id, name: row.team_name }));
    newFixtures = generatedRows(progressed.matches, season, teams, "playoff");
  }
  await mutateSeason(season, (tx) => [
    tx`select id from nexus_fixtures where season_id=${season.id} order by id for update`,
    tx`select 1/case when not exists(select 1 from nexus_submissions where fixture_id=any(${removedFixtures}::uuid[])) and not exists(select 1 from nexus_import_pairings where fixture_id=any(${removedFixtures}::uuid[])) then 1 else 0 end as downstream_unused`,
    tx`update nexus_submissions set status=${body.status},reviewed_at=now() where id=${submission.id}`,
    tx`delete from nexus_fixtures where id=any(${removedFixtures}::uuid[])`,
    insertFixtures(tx, newFixtures),
    tx`update nexus_seasons set playoff_bracket=${bracket ? JSON.stringify(bracket) : null}::jsonb where id=${season.id}`,
  ]);
  return { id: submission.id, status: body.status };
}
