import { canonicalChampion } from '../../../shared/champions.js';
import { DRAFTER_ORDER_CLIENT_ASSETS, drafterOrderEvidence } from '../../../shared/draft-order.js';

type Five<T> = [T, T, T, T, T];
type Side = 'blue' | 'red';
type RecordData = Record<string, unknown>;

export type DrafterSnapshot = {
  source: 'drafter.lol';
  sourceId: string;
  sourceDraftId: string;
  gameNumber: number;
  sourceUrl: string;
  blueName: string;
  redName: string;
  bluePicks: Five<string>;
  redPicks: Five<string>;
  blueBans: Five<string | null>;
  redBans: Five<string | null>;
  status: 'completed';
  fearless: boolean;
  ironman: boolean;
  firstPick: Side | null;
  patch: string | null;
  importedAt: string;
  warnings: string[];
  banStates?: { blue: Five<'selected' | 'skipped' | 'unknown'>; red: Five<'selected' | 'skipped' | 'unknown'> };
  orderEvidence?: ReturnType<typeof drafterOrderEvidence>;
};

export type DrafterErrorCode = 'DRAFTER_INVALID_URL' | 'DRAFTER_NOT_FOUND' | 'DRAFTER_INCOMPLETE'
  | 'DRAFTER_LAYOUT_CHANGED' | 'DRAFTER_UPSTREAM' | 'DRAFTER_TIMEOUT' | 'DRAFTER_TOO_LARGE';

export class DrafterImportError extends Error {
  readonly publicMessage: string;
  constructor(readonly code: DrafterErrorCode, message: string, readonly status: number) {
    super(message);
    this.name = 'DrafterImportError';
    this.publicMessage = message;
  }
}

const ID = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const layoutError = () => new DrafterImportError('DRAFTER_LAYOUT_CHANGED', 'Le format public de cette draft n’est pas reconnu. Aucun choix n’a été importé.', 422);
const incompleteError = () => new DrafterImportError('DRAFTER_INCOMPLETE', 'Cette draft n’est pas terminée ou ses dix choix ne sont pas disponibles.', 422);
const notFoundError = () => new DrafterImportError('DRAFTER_NOT_FOUND', 'Cette draft ou cette partie de la série est introuvable.', 404);
const asRecord = (value: unknown): RecordData | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : null;

export function parseDrafterUrl(input: string): { sourceId: string; gameNumber: number; sourceUrl: string } {
  const invalid = () => new DrafterImportError('DRAFTER_INVALID_URL', 'Utilise un lien public https://drafter.lol/draft/… avec un numéro de partie de 1 à 5.', 400);
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

// Read the JSON arguments of Next's public hydration scripts as data. Never run
// the scripts, import upstream JavaScript, or guess a private HTTP/socket endpoint.
function publicDraftProps(html: string): RecordData {
  const chunks: string[] = [];
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const call = /^\s*self\.__next_f\.push\(([\s\S]*)\)\s*;?\s*$/.exec(script[1]);
    if (!call) continue;
    let value: unknown;
    try { value = JSON.parse(call[1]); } catch { throw layoutError(); }
    if (Array.isArray(value) && value[0] === 1 && typeof value[1] === 'string') chunks.push(value[1]);
  }
  const candidates: RecordData[] = [];
  // A Flight record can span multiple script chunks, so concatenate first.
  for (const line of chunks.join('').split('\n')) {
    const record = /^[a-f0-9]+:(\[.*)$/i.exec(line);
    if (!record) continue;
    let value: unknown;
    try { value = JSON.parse(record[1]); } catch { continue; }
    if (!Array.isArray(value) || value[0] !== '$') continue;
    const props = asRecord(value[3]);
    if (props && Array.isArray(props.drafts)) candidates.push(props);
  }
  if (candidates.length !== 1) throw layoutError();
  return candidates[0];
}

function selectedDraft(props: RecordData, sourceId: string, gameNumber: number): { draft: RecordData; series: RecordData | null } {
  const drafts = props.drafts as unknown[];
  if (!drafts.length) throw notFoundError();
  if (drafts.length > 5) throw layoutError();
  const rows = drafts.map(asRecord);
  if (rows.some(row => !row || typeof row.draftId !== 'string' || !ID.test(row.draftId))) throw layoutError();
  const all = rows as RecordData[];
  if (new Set(all.map(row => row.draftId)).size !== all.length) throw layoutError();
  const series = asRecord(props.series) || asRecord(props.fearless);
  if (series) {
    if (series.seriesId !== sourceId) throw layoutError();
    const ids = series.draftIDs;
    if (!Array.isArray(ids) || ids.length !== all.length || new Set(ids).size !== ids.length
      || ids.some(id => typeof id !== 'string' || !ID.test(id))
      || all.some(row => row.seriesId !== sourceId || !ids.includes(row.draftId))) throw layoutError();
    const id = ids[gameNumber - 1];
    if (!id) throw notFoundError();
    const draft = all.find(row => row.draftId === id)!;
    // Explicit numbering, when supplied, must agree with the public series map.
    if (all.some(row => row.gameNumber !== undefined && row.gameNumber !== ids.indexOf(row.draftId) + 1)) throw layoutError();
    return { draft, series };
  }
  if (gameNumber !== 1) throw notFoundError();
  if (all.length !== 1 || all[0].draftId !== sourceId || all[0].seriesId
    || (all[0].gameNumber !== undefined && all[0].gameNumber !== 1)) throw layoutError();
  return { draft: all[0], series: null };
}

function sourceChampion(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw layoutError();
  if (!value.trim() || value.trim().toLowerCase() === 'none') return null;
  // The shared helper normalizes aliases; it is not a champion catalogue. Keep
  // bounded source names without inferring that an unfamiliar champion is known.
  if (value.length > 48 || !/^[A-Za-z][A-Za-z0-9 .’'&-]*$/.test(value.trim())) throw layoutError();
  const champion = canonicalChampion(value);
  if (!/^[A-Za-z][A-Za-z0-9]{0,47}$/.test(champion)) throw layoutError();
  return champion;
}

function teamName(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) throw layoutError();
  return value.trim() || fallback;
}

export function parseDrafterHtml(html: string, inputUrl: string): DrafterSnapshot {
  const parsed = parseDrafterUrl(inputUrl);
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > MAX_BYTES) {
    throw new DrafterImportError('DRAFTER_TOO_LARGE', 'La page Drafter dépasse la taille autorisée.', 502);
  }
  const { draft, series } = selectedDraft(publicDraftProps(html), parsed.sourceId, parsed.gameNumber);
  if (draft.done !== true) throw incompleteError();
  const warnings: string[] = [];
  const picks = (side: Side): Five<string> => {
    const values = [1, 2, 3, 4, 5].map(n => sourceChampion(draft[`${side}Pick${n}`]));
    if (values.some(value => !value) || new Set(values).size !== 5) throw incompleteError();
    return values as Five<string>;
  };
  const bans = (side: Side): Five<string | null> => {
    const values = [1, 2, 3, 4, 5].map(n => sourceChampion(draft[`${side}Ban${n}`]));
    const absent = [1, 2, 3, 4, 5].filter(n => {
      const value = draft[`${side}Ban${n}`];
      return value === undefined || value === null || (typeof value === 'string' && !value.trim());
    });
    const skipped = [1, 2, 3, 4, 5].filter(n => typeof draft[`${side}Ban${n}`] === 'string' && (draft[`${side}Ban${n}`] as string).trim().toLowerCase() === 'none');
    if (absent.length) warnings.push(`Bans ${side === 'blue' ? 'bleus' : 'rouges'} indisponibles : ${absent.join(', ')}. Les fréquences de bans doivent tenir compte de cette couverture.`);
    if (skipped.length) warnings.push(`Bans ${side === 'blue' ? 'bleus' : 'rouges'} indiqués « None » par Drafter : ${skipped.join(', ')}.`);
    return values as Five<string | null>;
  };
  const bluePicks = picks('blue');
  const redPicks = picks('red');
  if (new Set([...bluePicks, ...redPicks]).size !== 10) throw incompleteError();
  const blueBans = bans('blue');
  const redBans = bans('red');
  const banStates = (side: Side): Five<'selected' | 'skipped' | 'unknown'> => [1, 2, 3, 4, 5].map(n => {
    const value = draft[`${side}Ban${n}`];
    if (typeof value === 'string' && value.trim().toLowerCase() === 'none') return 'skipped';
    return typeof value === 'string' && value.trim() ? 'selected' : 'unknown';
  }) as Five<'selected' | 'skipped' | 'unknown'>;
  const scriptSources = Array.from(html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi), match => match[1]);
  const orderEvidence = drafterOrderEvidence(draft, DRAFTER_ORDER_CLIENT_ASSETS.every(asset => scriptSources.includes(asset)));
  if (!asRecord(draft.roleAssignments)) warnings.push('Les rôles finaux ne sont pas fournis. Les choix conservent leurs emplacements Drafter.');
  if (draft.patch !== undefined && (typeof draft.patch !== 'string' || !/^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(draft.patch))) throw layoutError();
  return {
    source: 'drafter.lol', ...parsed, sourceDraftId: draft.draftId as string,
    blueName: teamName(draft.drafterBlue, 'Équipe bleue'), redName: teamName(draft.drafterRed, 'Équipe rouge'),
    bluePicks, redPicks, blueBans, redBans, status: 'completed',
    fearless: draft.fearless === true || series?.fearless === true,
    ironman: draft.ironman === true || series?.ironman === true,
    firstPick: draft.firstPick === 'blue' || draft.firstPick === 'red' ? draft.firstPick : null,
    patch: typeof draft.patch === 'string' ? draft.patch : null,
    importedAt: new Date().toISOString(), warnings, orderEvidence,
    banStates: { blue: banStates('blue'), red: banStates('red') },
  };
}

async function readHtml(response: Response, signal: AbortSignal): Promise<string> {
  const tooLarge = () => new DrafterImportError('DRAFTER_TOO_LARGE', 'La page Drafter dépasse la taille autorisée.', 502);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  if (!response.body) throw layoutError();
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { cancel(); throw tooLarge(); }
      chunks.push(value);
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)); }
    catch { throw layoutError(); }
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

export async function importDrafterDraft(inputUrl: string): Promise<DrafterSnapshot> {
  const { sourceUrl } = parseDrafterUrl(inputUrl);
  const controller = new AbortController();
  const timeout = new DrafterImportError('DRAFTER_TIMEOUT', 'Drafter met trop de temps à répondre. Réessaie plus tard.', 504);
  const timer = setTimeout(() => controller.abort(timeout), TIMEOUT_MS);
  timer.unref?.();
  try {
    const response = await fetch(sourceUrl, {
      method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'text/html' },
    });
    controller.signal.throwIfAborted();
    if (response.status === 404 || response.status === 410) { void response.body?.cancel().catch(() => {}); throw notFoundError(); }
    if (!response.ok || response.redirected || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '')) {
      void response.body?.cancel().catch(() => {});
      throw new DrafterImportError('DRAFTER_UPSTREAM', 'La page publique Drafter n’est pas accessible pour le moment.', 502);
    }
    return parseDrafterHtml(await readHtml(response, controller.signal), sourceUrl);
  } catch (error) {
    if (controller.signal.aborted) throw timeout;
    if (error instanceof DrafterImportError) throw error;
    throw new DrafterImportError('DRAFTER_UPSTREAM', 'La page publique Drafter n’est pas accessible pour le moment.', 502);
  } finally { clearTimeout(timer); }
}
