// Public Drafter client inspected 2026-10-12: module 2822 exports the two slot
// sequences; completed drafts populate those slots separately from roleAssignments.
// A source change requires another inspection before new imports claim an order.
export const DRAFTER_ORDER_CLIENT_ASSETS = [
  '/_next/static/chunks/138-8cf6457be938f23c.js',
  '/_next/static/chunks/8175-a98f808947de09c0.js',
];

const BLUE_FIRST = [
  ['ban', 'blue', 1], ['ban', 'red', 1], ['ban', 'blue', 2], ['ban', 'red', 2], ['ban', 'blue', 3], ['ban', 'red', 3],
  ['pick', 'blue', 1], ['pick', 'red', 1], ['pick', 'red', 2], ['pick', 'blue', 2], ['pick', 'blue', 3], ['pick', 'red', 3],
  ['ban', 'red', 4], ['ban', 'blue', 4], ['ban', 'red', 5], ['ban', 'blue', 5],
  ['pick', 'red', 4], ['pick', 'blue', 4], ['pick', 'blue', 5], ['pick', 'red', 5],
];
const OTHER = { blue: 'red', red: 'blue' };
const isSide = value => value === 'blue' || value === 'red';
const UNAVAILABLE = 'L’ordre n’est pas vérifié pour cet import. Réimporte la draft pour vérifier ses emplacements de sélection.';
const RECONSTRUCTED = 'Ordre reconstitué depuis les emplacements finaux et le premier camp de sélection de Drafter. Les remplacements de champions et leurs horaires ne sont pas fournis ; les rôles finaux ne déterminent pas cet ordre.';

/** Produces a provenance marker only from the importer’s inspected public format. */
export function drafterOrderEvidence(raw, verifiedClient = false) {
  const unknown = (reason) => ({ version: 1, basis: 'unavailable', format: null, firstPick: null, reason });
  if (!verifiedClient) return unknown('client-unverified');
  // The inspected page supports a standard 20-slot sequence and its mirror.
  // An explicit, unfamiliar format or custom sequence must not inherit it.
  if (['draftType', 'draftFormat', 'customOrder', 'draftOrder', 'sequence', 'customDraft'].some((field) => raw?.[field] != null && raw[field] !== false)) {
    return unknown('unsupported-format');
  }
  if (typeof raw?.firstSelection !== 'boolean' || !isSide(raw.firstPick) || raw.secondPick !== OTHER[raw.firstPick]
    || (!raw.firstSelection && raw.firstPick !== 'blue')) return unknown('selection-unverified');
  return { version: 1, basis: 'reconstructed-public-slots', format: 'standard-20', firstPick: raw.firstPick, reason: 'public-slot-fields-v1' };
}

/** Null legacy bans remain unknown; new imports retain explicitly skipped bans. */
export function draftSlotState(snapshot, side, kind, slot) {
  const value = snapshot?.[`${side}${kind === 'ban' ? 'Bans' : 'Picks'}`]?.[slot - 1];
  if (typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'none') return 'selected';
  return kind === 'ban' && value === null && snapshot?.banStates?.[side]?.[slot - 1] === 'skipped' ? 'skipped' : 'unknown';
}

/** A reconstructed slot sequence, never a recorded history of clicks or swaps. */
export function draftOrder(snapshot) {
  const unknown = (message = UNAVAILABLE) => ({ status: 'unknown', basis: 'unavailable', message, events: [] });
  const evidence = snapshot?.orderEvidence;
  if (evidence?.reason === 'client-unverified' || evidence?.reason === 'unsupported-format') {
    return unknown('Ce format public de Drafter n’a pas encore été vérifié. Les picks et bans restent consultables, sans chronologie.');
  }
  if (snapshot?.source !== 'drafter.lol' || snapshot.status !== 'completed' || evidence?.version !== 1
    || evidence.basis !== 'reconstructed-public-slots' || evidence.format !== 'standard-20'
    || evidence.reason !== 'public-slot-fields-v1' || !isSide(evidence.firstPick) || snapshot.firstPick !== evidence.firstPick) return unknown();
  for (const side of ['blue', 'red']) {
    if (!Array.isArray(snapshot[`${side}Picks`]) || snapshot[`${side}Picks`].length !== 5
      || !Array.isArray(snapshot[`${side}Bans`]) || snapshot[`${side}Bans`].length !== 5
      || [1, 2, 3, 4, 5].some(slot => draftSlotState(snapshot, side, 'pick', slot) !== 'selected')) return unknown();
  }
  if (new Set([...snapshot.bluePicks, ...snapshot.redPicks].map(champion => champion.toLowerCase())).size !== 10) return unknown();
  const events = BLUE_FIRST.map(([kind, originalSide, slot], index) => {
    const side = evidence.firstPick === 'blue' ? originalSide : OTHER[originalSide];
    const champion = snapshot[`${side}${kind === 'pick' ? 'Picks' : 'Bans'}`][slot - 1] || null;
    const prefix = side === 'blue' ? 'B' : 'R';
    return { order: index + 1, phase: slot <= 3 ? 1 : 2, side, kind, champion, slot,
      label: kind === 'pick' ? `${prefix}${slot}` : `${prefix}B${slot}`,
      valueStatus: draftSlotState(snapshot, side, kind, slot) };
  });
  return { status: 'known', basis: 'reconstructed-public-slots', message: RECONSTRUCTED, events };
}
