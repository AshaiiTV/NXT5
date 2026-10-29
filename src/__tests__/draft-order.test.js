import { describe, expect, it } from 'vitest';
import { drafterOrderEvidence, draftOrder, draftSlotState } from '../../shared/draft-order.js';

const raw = { firstSelection: false, firstPick: 'blue', secondPick: 'red' };
function snapshot(overrides = {}) {
  return { source: 'drafter.lol', status: 'completed', firstPick: 'blue',
    bluePicks: ['Aatrox', 'Zeri', 'Braum', 'DrMundo', 'Locke'], redPicks: ['Yunara', 'Lulu', 'Anivia', 'Kennen', 'Maokai'],
    blueBans: ['Jhin', 'Khazix', 'JarvanIV', 'Gnar', 'Sylas'], redBans: ['MonkeyKing', 'Poppy', 'Thresh', 'Syndra', 'Diana'],
    orderEvidence: drafterOrderEvidence(raw, true), ...overrides };
}

describe('evidenced Drafter slot order', () => {
  it('reconstructs the 20 public blue-first slots and the two ban phases', () => {
    const order = draftOrder(snapshot());
    expect(order.status).toBe('known');
    expect(order.basis).toBe('reconstructed-public-slots');
    expect(order.events.map(event => event.label)).toEqual([
      'BB1', 'RB1', 'BB2', 'RB2', 'BB3', 'RB3', 'B1', 'R1', 'R2', 'B2', 'B3', 'R3',
      'RB4', 'BB4', 'RB5', 'BB5', 'R4', 'B4', 'B5', 'R5',
    ]);
    expect(order.events.map(event => event.order)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(order.events.filter(event => event.phase === 1)).toHaveLength(12);
    expect(order.events.filter(event => event.phase === 2)).toHaveLength(8);
    expect(order.message).toMatch(/reconstitué/);
    expect(order.message).toMatch(/remplacements/);
  });

  it('mirrors both ban phases and pick blocks when red explicitly selects first', () => {
    const order = draftOrder(snapshot({ firstPick: 'red', orderEvidence: drafterOrderEvidence({ firstSelection: true, firstPick: 'red', secondPick: 'blue' }, true) }));
    expect(order.events.map(event => event.label)).toEqual([
      'RB1', 'BB1', 'RB2', 'BB2', 'RB3', 'BB3', 'R1', 'B1', 'B2', 'R2', 'R3', 'B3',
      'BB4', 'RB4', 'BB5', 'RB5', 'B4', 'R4', 'R5', 'B5',
    ]);
  });

  it('can select blue first with the optional first-selection setting enabled', () => {
    expect(draftOrder(snapshot({ orderEvidence: drafterOrderEvidence({ ...raw, firstSelection: true }, true) })).status).toBe('known');
  });

  it.each([
    { orderEvidence: undefined }, { orderEvidence: { version: 1 } },
    { orderEvidence: drafterOrderEvidence(raw, false) },
    { orderEvidence: drafterOrderEvidence({ ...raw, draftFormat: 'custom' }, true) },
    { orderEvidence: drafterOrderEvidence({ ...raw, secondPick: 'blue' }, true) },
    { orderEvidence: drafterOrderEvidence({ ...raw, firstPick: 'red', secondPick: 'blue' }, true) },
    { firstPick: null }, { firstPick: 'red' }, { status: 'in-progress' },
    { bluePicks: ['Aatrox', 'Zeri'] }, { bluePicks: ['Aatrox', 'Zeri', 'Braum', 'DrMundo', 'Aatrox'] },
  ])('does not infer chronology from legacy, ambiguous or incomplete snapshots', overrides => {
    expect(draftOrder(snapshot(overrides))).toMatchObject({ status: 'unknown', events: [] });
  });

  it('preserves an unavailable ban slot without filling it from another source', () => {
    const data = snapshot({ blueBans: [null, 'Khazix', 'JarvanIV', 'Gnar', 'Sylas'] });
    expect(draftOrder(data).events[0]).toMatchObject({ label: 'BB1', champion: null, valueStatus: 'unknown' });
    data.banStates = { blue: ['skipped', 'selected', 'selected', 'selected', 'selected'] };
    expect(draftOrder(data).events[0]).toMatchObject({ champion: null, valueStatus: 'skipped' });
    expect(draftSlotState(data, 'blue', 'pick', 1)).toBe('selected');
  });
});
