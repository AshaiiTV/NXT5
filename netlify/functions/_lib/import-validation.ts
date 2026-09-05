import type { RiotMatch } from './types';

const MAX_PG_INTEGER = 2_147_483_647;
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARTICIPANT_NUMBERS = [
  'kills', 'deaths', 'assists', 'totalMinionsKilled', 'neutralMinionsKilled',
  'goldEarned', 'totalDamageDealtToChampions', 'visionScore',
  'damageDealtToTurrets', 'damageToTurrets', 'damage_to_turrets',
  'item0', 'item0Id', 'item1', 'item1Id', 'item2', 'item2Id', 'item3', 'item3Id',
  'item4', 'item4Id', 'item5', 'item5Id', 'item6', 'item6Id', 'trinket', 'trinketItemId',
  'summoner1Id', 'spell1Id', 'summoner2Id', 'spell2Id'
];

function invalid(message: string): never {
  throw Object.assign(new Error(message), { status: 400, code: 'NXT5_IMPORT_FILE_INVALID' });
}

function integer(value: unknown, field: string, minimum = 0): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    invalid(`Valeur numérique invalide : ${field}.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > MAX_PG_INTEGER) {
    invalid(`Valeur numérique invalide : ${field}.`);
  }
  return number;
}

export function assertImportMatch(match: RiotMatch): void {
  if (!match?.info || !Array.isArray(match.info.participants) || !Array.isArray(match.info.teams)) {
    invalid('Fichier invalide : il manque info.participants ou info.teams.');
  }
  // JSON.parse accepts numbers such as 1e400. Do not silently turn them into null
  // when preserving the original file and its timeline in JSONB.
  const pending: unknown[] = [match];
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === 'number' && !Number.isFinite(value)) invalid('Le fichier contient un nombre non fini.');
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) pending.push(child);
    }
  }
  integer(match.info.gameDuration, 'gameDuration', 1);
  if (match.info.participants.length !== 10 || match.info.teams.length !== 2) {
    invalid('Le fichier doit contenir deux équipes de cinq participants.');
  }
  const teamIds = new Set(match.info.teams.map(team => team?.teamId));
  if (!teamIds.has(100) || !teamIds.has(200)) invalid('Équipes Riot invalides.');
  for (const team of match.info.teams) {
    if (typeof team.win !== 'boolean') invalid('Résultat de match invalide.');
    for (const [objective, stats] of Object.entries(team.objectives || {})) {
      if (stats?.kills !== undefined) integer(stats.kills, `objectives.${objective}.kills`);
    }
  }
  const participantIds = new Set<number>();
  for (const participant of match.info.participants) {
    if (!participant || ![100, 200].includes(participant.teamId)) invalid('Équipe de participant invalide.');
    const id = integer(participant.participantId, 'participantId', 1);
    if (id > 10 || participantIds.has(id)) invalid('Identifiants de participants invalides ou dupliqués.');
    participantIds.add(id);
    if (typeof participant.championName !== 'string' || !participant.championName.trim()) invalid('Champion manquant.');
    for (const source of [participant, participant.stats].filter(Boolean)) {
      if (typeof source !== 'object' || Array.isArray(source)) invalid('Statistiques de participant invalides.');
      const stats = source as Record<string, unknown>;
      for (const key of PARTICIPANT_NUMBERS) {
        if (stats[key] !== undefined) integer(stats[key], `${id}.${key}`);
      }
    }
    integer(Number(participant.totalMinionsKilled || 0) + Number(participant.neutralMinionsKilled || 0), `${id}.cs`);
  }
  if ([100, 200].some(teamId => match.info.participants.filter(player => player.teamId === teamId).length !== 5)) {
    invalid('Chaque équipe doit contenir cinq participants.');
  }
}

export function assertImportPlayerAssignments(assignments: Record<string, string>, roster: Array<Record<string, any>>): void {
  const rosterIds = new Set(roster.map(player => String(player.id)));
  const selected = ROLES.map(role => assignments[role]);
  if (selected.some(id => !id || !rosterIds.has(id))) {
    invalid('Un profil sélectionné est introuvable dans le roster. Recharge l’équipe puis vérifie les cinq profils.');
  }
  if (new Set(selected).size !== ROLES.length) invalid('Chaque participant allié doit être associé à un profil différent.');
}

export function normalizeImportCategoryIds(value: string[] = []): string[] {
  if (!Array.isArray(value)) invalid('Liste de catégories invalide.');
  const ids = [...new Set(value.map(id => String(id).trim().toLowerCase()))];
  if (ids.some(id => !UUID.test(id))) invalid('Identifiant de catégorie invalide.');
  return ids;
}
