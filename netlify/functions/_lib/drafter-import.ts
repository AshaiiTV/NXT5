import { canonicalChampion, championNameKey } from '../../../shared/champions.js';
import { sql } from './db';
import { getChampionDataMap } from './riot';

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
function failure(message: string, code = 'INVALID_DRAFT_SELECTIONS', status = 400) {
  return Object.assign(new Error(message), { code, status, publicMessage: message });
}

export function parseDrafterUrl(input: string): { sourceId: string; gameNumber: number; sourceUrl: string } {
  const invalid = () => failure('Utilise un lien public https://drafter.lol/draft/… avec un numéro de partie de 1 à 5.', 'DRAFTER_INVALID_URL');
  if (typeof input !== 'string' || input.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(input)) throw invalid();
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || url.hostname !== 'drafter.lol' || url.port || url.username || url.password) throw invalid();
  const path = /^\/draft\/([A-Za-z0-9_-]{6,64})$/.exec(url.pathname);
  const games = url.searchParams.getAll('game');
  if (!path || games.length > 1 || (games.length === 1 && !/^[1-5]$/.test(games[0]))) throw invalid();
  const gameNumber = games.length ? Number(games[0]) : 1;
  return { sourceId: path[1], gameNumber, sourceUrl: `https://drafter.lol/draft/${path[1]}?game=${gameNumber}` };
}

/** The link identifies the coach's chosen series/game. We never request a Drafter page. */
export async function importDrafterDraft(inputUrl: string, teamId: string, matchId: string | null): Promise<DrafterSnapshot> {
  const source = parseDrafterUrl(inputUrl);
  const [existing] = await sql`select snapshot from opponent_drafts where team_id = ${teamId}
    and source_id = ${source.sourceId} and game_number = ${source.gameNumber}`;
  const saved = existing?.snapshot;
  if (saved && !saved.selectionSources && saved.bluePicks?.length === 5 && saved.redPicks?.length === 5) return saved;
  if (!matchId) throw failure('Ouvre une partie pour ajouter son lien Drafter.');
  const [match] = await sql`select patch, raw->'info'->'teams' as teams from matches where team_id = ${teamId} and id = ${matchId}`;
  if (!match) throw failure('Partie introuvable dans cette équipe.', 'DRAFT_MATCH_NOT_FOUND', 404);
  const players = await sql`select p.champion, p.raw->>'teamId' as side_id from match_participants p
    join matches m on m.id = p.match_id where m.team_id = ${teamId} and m.id = ${matchId} order by p.champion`;
  const snapshot: DrafterSnapshot = {
    ...source, source: 'drafter.lol', sourceDraftId: null, recordedMatchId: matchId, baseRevision: saved?.importedAt ?? null, selectionSources: {},
    blueName: 'Équipe bleue', redName: 'Équipe rouge', status: 'completed', fearless: null, ironman: null,
    firstPick: null, patch: match.patch || null, importedAt: new Date().toISOString(), warnings: [],
    bluePicks: [], redPicks: [], blueBans: [], redBans: [],
  };
  const teams = Array.isArray(match.teams) ? match.teams : [];
  const hasBanIds = teams.some(team => Array.isArray(team?.bans) && team.bans.some(ban => Number.isInteger(ban?.championId) && ban.championId > 0));
  const catalog = hasBanIds ? await getChampionDataMap({ signal: AbortSignal.timeout(6000) }).catch(() => null) : null;
  for (const side of sides) {
    const id = side === 'blue' ? 100 : 200;
    const picks = players.filter(p => Number(p.side_id) === id).map(p => canonicalChampion(p.champion));
    if (picks.length === 5 && picks.every(Boolean) && new Set(picks).size === 5) {
      snapshot[`${side}Picks`] = picks as Five<string>;
      snapshot.selectionSources![`${side}Picks`] = 'match';
    }
    const rows = teams.filter(team => team?.teamId === id);
    const bans = rows.length === 1 ? rows[0].bans : null;
    if (!Array.isArray(bans) || bans.length < 1 || bans.length > 5) continue;
    const values = bans.map(ban => catalog?.get(ban?.championId)?.id ?? null);
    const states = bans.map((ban, index) => values[index] ? 'selected' : ban?.championId === -1 ? 'skipped' : 'unknown');
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
    const preserveBans = storedSource === 'match' && saved.recordedMatchId === matchId && field.endsWith('Bans') && hasBanIds && !catalog;
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
