import { canonicalChampion } from '../../shared/champions.js';
import { draftOrder, draftSlotState } from '../../shared/draft-order.js';

const SIDES = { blue: 'red', red: 'blue' };
const slots = [1, 2, 3, 4, 5];

function metric() { return { total: 0, counts: new Map() }; }
function add(metric, champions) {
  metric.total += 1;
  for (const champion of new Set(champions.filter(Boolean).map(canonicalChampion))) {
    metric.counts.set(champion, (metric.counts.get(champion) || 0) + 1);
  }
}
function entries(metric) {
  return [...metric.counts].map(([champion, count]) => ({ champion, count, total: metric.total }))
    .sort((a, b) => b.count - a.count || a.champion.localeCompare(b.champion, 'en'));
}
function camp() {
  return { picks: metric(), bans: metric(), firstPicks: metric(), banPhases: { 1: metric(), 2: metric() }, pickSlots: Object.fromEntries(slots.map(n => [n, metric()])) };
}
function present(camp) {
  return { picks: entries(camp.picks), bans: entries(camp.bans), firstPicks: entries(camp.firstPicks),
    banPhases: Object.fromEntries([1, 2].map(n => [n, entries(camp.banPhases[n])])),
    pickSlots: Object.fromEntries(slots.map(n => [n, entries(camp.pickSlots[n])])),
    coverage: { picks: camp.picks.total, bans: camp.bans.total, firstPicks: camp.firstPicks.total,
      banPhases: Object.fromEntries([1, 2].map(n => [n, camp.banPhases[n].total])),
      pickSlots: Object.fromEntries(slots.map(n => [n, camp.pickSlots[n].total])) } };
}
export function completeDraftSlots(snapshot, side, kind, wantedSlots = slots) {
  const values = snapshot[`${side}${kind === 'ban' ? 'Bans' : 'Picks'}`];
  if (!Array.isArray(values) || values.length !== 5 || wantedSlots.some(n => draftSlotState(snapshot, side, kind, n) === 'unknown')) return false;
  const champions = wantedSlots.map(n => values[n - 1]).filter(Boolean).map(canonicalChampion);
  return new Set(champions.map(champion => champion.toLowerCase())).size === champions.length;
}
function sourceKey(row) {
  const snapshot = row.snapshot;
  if (typeof snapshot.sourceDraftId === 'string' && snapshot.sourceDraftId) return `${snapshot.source}:${snapshot.sourceDraftId}`;
  if (snapshot.sourceId && Number.isInteger(snapshot.gameNumber)) return `${snapshot.source}:${snapshot.sourceId}:${snapshot.gameNumber}`;
  return row.id ? `row:${row.id}` : null;
}
function imported(row) {
  const time = Date.parse(row.importedAt || row.snapshot.importedAt || '');
  return Number.isFinite(time) ? time : 0;
}

/** Descriptive source counts only. The caller supplies the desired opponent/team
 * scope. Match links are coverage, never evidence of a result or a causal effect. */
export function normalizeDraftRows(rows = []) {
  const unique = new Map();
  let invalid = false;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !['blue', 'red'].includes(row.allySide) || row.snapshot?.source !== 'drafter.lol' || row.snapshot.status !== 'completed') { invalid = true; continue; }
    const key = sourceKey(row);
    if (!key) { invalid = true; continue; }
    const previous = unique.get(key);
    if (!previous || imported(row) > imported(previous)) unique.set(key, row);
  }
  return { drafts: [...unique.values()], warnings: invalid ? ['Certaines drafts sans camp ou source valide sont exclues de cette analyse.'] : [] };
}

export function buildDraftAnalysis(rows = []) {
  const { drafts, warnings } = normalizeDraftRows(rows);
  const ally = camp(); const enemy = camp();
  let ordered = 0; let linked = 0;
  for (const row of drafts) {
    const snapshot = row.snapshot;
    const order = draftOrder(snapshot);
    if (order.status === 'known') ordered += 1;
    if (row.matchId) linked += 1;
    for (const [target, side] of [[ally, row.allySide], [enemy, SIDES[row.allySide]]]) {
      if (completeDraftSlots(snapshot, side, 'pick')) add(target.picks, snapshot[`${side}Picks`]);
      if (completeDraftSlots(snapshot, side, 'ban')) add(target.bans, snapshot[`${side}Bans`]);
      if (order.status !== 'known') continue;
      for (const phase of [1, 2]) {
        const phaseSlots = phase === 1 ? [1, 2, 3] : [4, 5];
        if (completeDraftSlots(snapshot, side, 'ban', phaseSlots)) add(target.banPhases[phase], phaseSlots.map(n => snapshot[`${side}Bans`][n - 1]));
      }
      if (!completeDraftSlots(snapshot, side, 'pick')) continue;
      for (const n of slots) add(target.pickSlots[n], [snapshot[`${side}Picks`][n - 1]]);
      if (snapshot.firstPick === side) add(target.firstPicks, [snapshot[`${side}Picks`][0]]);
    }
  }
  return { total: drafts.length, ordered, linked, ally: present(ally), enemy: present(enemy), warnings };
}
