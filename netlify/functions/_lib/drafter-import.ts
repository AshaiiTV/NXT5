import { publicDrafterLink } from '../../../shared/drafter-link.js';
import { canonicalChampion, championNameKey } from '../../../shared/champions.js';
import { sql } from './db';
import championIds from '../../../shared/riot-champion-ids.json';
import { fetchRiotMatch, isRiotConfigured, getChampionDataMap } from './riot';

type Five<T> = [T, T, T, T, T];
type Side = 'blue' | 'red';
type Selection = 'bluePicks' | 'redPicks' | 'blueBans' | 'redBans';
type Origin = 'match' | 'staff';
type BanState = 'selected' | 'skipped' | 'unknown';

export type DrafterSnapshot = {
  source: 'drafter.lol';
  sourceId: string;
  sourceDraftId: string | null;
  gameNumber: number;
  sourceUrl: string;
  blueName: string;
  redName: string;
  bluePicks: Five<string> | [];
  redPicks: Five<string> | [];
  blueBans: Five<string | null> | [];
  redBans: Five<string | null> | [];
  status: 'completed';
  recordedMatchId?: string;
  baseRevision?: string | null;
  selectionSources?: Partial<Record<Selection, Origin>>;
  fearless: boolean | null;
  ironman: boolean | null;
  firstPick: Side | null;
  patch: string | null;
  importedAt: string;
  warnings: string[];
  banStates?: { blue: Five<'selected' | 'skipped' | 'unknown'>; red: Five<'selected' | 'skipped' | 'unknown'> };
  orderEvidence?: ReturnType<typeof import('../../../shared/draft-order.js').drafterOrderEvidence>;
};

const selections: Selection[] = ['bluePicks', 'redPicks', 'blueBans', 'redBans'];
const sides: Side[] = ['blue', 'red'];
// Riot Data Dragon 16.23.1. New champions are resolved through the live catalogue.
const championById = new Map<number, string>(championIds.map(([key, id]) => [Number(key), String(id)]));
function banId(ban: any): number | null {
  const raw = typeof ban === 'object' ? ban?.championId : ban;
  if (typeof raw !== 'number' && !(typeof raw === 'string' && /^-?\d+$/.test(raw))) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && (id > 0 || id === -1) ? id : null;
}
function matchBans(teams: any, sideId: number): (number | null)[] {
  if (!Array.isArray(teams)) return [];
  const rows = teams.filter(team => Number(team?.teamId) === sideId);
  if (rows.length !== 1 || !Array.isArray(rows[0].bans) || rows[0].bans.length > 5) return [];
  return rows[0].bans.map(banId);
}
function knownCount(ids: (number | null)[]) { return ids.filter(id => id !== null).length; }

function failure(message: string, code = 'INVALID_DRAFT_SELECTIONS', status = 400) {
  return Object.assign(new Error(message), { code, status, publicMessage: message });
}

export function parseDrafterUrl(input: string) {
  const link = publicDrafterLink(input);
  if (!link) throw failure('Utilise un lien public https://drafter.lol/draft/… avec un numéro de partie de 1 à 5.', 'DRAFTER_INVALID_URL');
  return link;
}

/** The link identifies the coach's chosen series/game. We never request a Drafter page. */
export async function importDrafterDraft(inputUrl: string, teamId: string, matchId: string | null): Promise<DrafterSnapshot> {
  const source = parseDrafterUrl(inputUrl);
  const [existing] = await sql`select snapshot from opponent_drafts where team_id = ${teamId}
    and source_id = ${source.sourceId} and game_number = ${source.gameNumber}`;
  const saved = existing?.snapshot;
  if (saved && !saved.selectionSources && saved.bluePicks?.length === 5 && saved.redPicks?.length === 5) return saved;
  if (!matchId) throw failure('Ouvre une partie pour ajouter son lien Drafter.');
  const [match] = await sql`select patch, game_id, raw->'info'->'teams' as teams from matches where team_id = ${teamId} and id = ${matchId}`;
  if (!match) throw failure('Partie introuvable dans cette équipe.', 'DRAFT_MATCH_NOT_FOUND', 404);
  const players = await sql`select p.champion, p.raw->>'teamId' as side_id from match_participants p
    join matches m on m.id = p.match_id where m.team_id = ${teamId} and m.id = ${matchId} order by p.champion`;
  const snapshot: DrafterSnapshot = {
    ...source, source: 'drafter.lol', sourceDraftId: null, recordedMatchId: matchId, baseRevision: saved?.importedAt ?? null, selectionSources: {},
    blueName: 'Équipe bleue', redName: 'Équipe rouge', status: 'completed', fearless: null, ironman: null,
    firstPick: null, patch: match.patch || null, importedAt: new Date().toISOString(), warnings: [],
    bluePicks: [], redPicks: [], blueBans: [], redBans: [],
  };
  const bansBySide = { blue: matchBans(match.teams, 100), red: matchBans(match.teams, 200) };
  const missingMatchBans = sides.some(side => knownCount(bansBySide[side]) < 5 && saved?.selectionSources?.[`${side}Bans`] !== 'staff');
  if (missingMatchBans && /^[A-Z0-9]+_\d+$/.test(match.game_id) && isRiotConfigured()) {
    const riot = await fetchRiotMatch(match.game_id, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (riot && riot.metadata?.matchId === match.game_id) {
      for (const side of sides) {
        const fromRiot = matchBans(riot.info?.teams, side === 'blue' ? 100 : 200);
        const local = bansBySide[side];
        if (knownCount(fromRiot) > knownCount(local) && local.every((id, i) => id === null || fromRiot[i] === id)) bansBySide[side] = fromRiot;
      }
    }
  }
  const needsCatalog = sides.some(side => bansBySide[side].some(id => id !== null && id > 0 && !championById.has(id)));
  const catalog = needsCatalog ? await getChampionDataMap({ signal: AbortSignal.timeout(6000) }).catch(() => null) : null;
  for (const side of sides) {
    const id = side === 'blue' ? 100 : 200;
    const picks = players.filter(p => Number(p.side_id) === id).map(p => canonicalChampion(p.champion));
    if (picks.length === 5 && picks.every(Boolean) && new Set(picks).size === 5) {
      snapshot[`${side}Picks`] = picks as Five<string>;
      snapshot.selectionSources![`${side}Picks`] = 'match';
    }
    const bans = bansBySide[side];
    if (!bans.length) continue;
    const values = bans.map(id => id === null ? null : championById.get(id) ?? catalog?.get(id)?.id ?? null);
    const states = bans.map((id, index) => values[index] ? 'selected' : id === -1 ? 'skipped' : 'unknown');
    while (values.length < 5) { values.push(null); states.push('unknown'); }
    if (states.every(state => state === 'unknown')) continue;
    snapshot[`${side}Bans`] = values as Five<string | null>;
    snapshot.banStates ??= { blue: unknownBans(), red: unknownBans() };
    snapshot.banStates[side] = states as Five<BanState>;
    snapshot.selectionSources![`${side}Bans`] = 'match';
  }
  // Staff observations belong to this draft. Match-derived values belong to the played match.
  for (const field of selections) {
    const storedSource = saved?.selectionSources?.[field];
    const side = field === 'blueBans' ? 'blue' : 'red';
    const currentStates = snapshot.banStates?.[side] || unknownBans();
    const savedStates = saved?.banStates?.[side];
    const preserveBans = storedSource === 'match' && saved.recordedMatchId === matchId && field.endsWith('Bans') &&
      Array.isArray(savedStates) && savedStates.some((state, i) => currentStates[i] === 'unknown' && state !== 'unknown') &&
      currentStates.every((state, i) => state === 'unknown' || (state === savedStates[i] && snapshot[field][i] === saved[field][i]));
    if (storedSource !== 'staff' && !preserveBans) continue;
    Object.assign(snapshot, { [field]: saved[field] });
    snapshot.selectionSources![field] = storedSource;
    if (field.endsWith('Bans')) {
      const side = field === 'blueBans' ? 'blue' : 'red';
      snapshot.banStates ??= { blue: unknownBans(), red: unknownBans() };
      snapshot.banStates[side] = saved.banStates[side];
    }
  }
  return snapshot;
}

const unknownBans = (): Five<BanState> => ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'];

/** Only explicitly edited lists are accepted; never trust a replacement browser snapshot. */
export async function applyStaffSelections(snapshot: DrafterSnapshot, edits: unknown) {
  if (edits === undefined) return snapshot;
  if (!snapshot.selectionSources || !edits || typeof edits !== 'object' || Array.isArray(edits)) throw failure('Sélections de draft invalides.');
  const fields = Object.entries(edits);
  if (!fields.length) return snapshot;
  for (const [key, value] of fields) {
    if (!selections.includes(key as Selection) || typeof value !== 'string' || value.length > 300) throw failure('Sélections de draft invalides.');
  }
  const catalog = await getChampionDataMap({ signal: AbortSignal.timeout(8000) }).catch(() => {
    throw failure('Le catalogue des champions est indisponible. Réessaie pour enregistrer tes modifications.', 'DRAFT_CATALOG_UNAVAILABLE', 503);
  });
  const names = new Map<string, string>();
  for (const { id, name } of catalog.values()) {
    names.set(championNameKey(canonicalChampion(id)), id);
    names.set(championNameKey(canonicalChampion(name)), id);
  }
  const result = structuredClone(snapshot);
  for (const [field, input] of fields) {
    const isBan = field.endsWith('Bans');
    const entries = (input as string).trim() ? (input as string).split(',').map(word => word.trim()) : [];
    if (entries.length > 5 || (!isBan && entries.length !== 5 && entries.length !== 0)) throw failure('Indique cinq picks par camp et au maximum cinq bans, séparés par des virgules.');
    const values = entries.map(word => {
      if (isBan && ['?', '-', '—'].includes(word)) return null;
      const champion = names.get(championNameKey(canonicalChampion(word)));
      if (!champion) throw failure('Un nom de champion est inconnu. Vérifie les noms séparés par des virgules.');
      return champion;
    });
    const known = values.filter(Boolean);
    if (new Set(known).size !== known.length) throw failure('Un champion apparaît plusieurs fois dans la même liste.');
    if (isBan) {
      const states = unknownBans();
      entries.forEach((word, i) => { states[i] = values[i] ? 'selected' : word === '?' ? 'unknown' : 'skipped'; });
      while (values.length < 5) values.push(null);
      result.banStates ??= { blue: unknownBans(), red: unknownBans() };
      result.banStates[field === 'blueBans' ? 'blue' : 'red'] = states;
    }
    Object.assign(result, { [field]: values });
    result.selectionSources![field as Selection] = 'staff';
  }
  return result;
}
