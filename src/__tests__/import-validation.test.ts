import { describe, expect, it } from 'vitest';
import { assertImportMatch, assertImportPlayerAssignments, normalizeImportCategoryIds } from '../../netlify/functions/_lib/import-validation';
import type { RiotMatch } from '../../netlify/functions/_lib/types';

function match(): RiotMatch {
  return {
    info: {
      gameDuration: 1800,
      participants: Array.from({ length: 10 }, (_, index) => ({
        participantId: index + 1, teamId: index < 5 ? 100 : 200,
        championId: index + 1, championName: `Champion${index}`, kills: 2,
        deaths: 3, assists: 4, totalMinionsKilled: 100, neutralMinionsKilled: 10,
        goldEarned: 10000, totalDamageDealtToChampions: 12000, visionScore: 15
      })),
      teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }]
    }
  };
}

describe('import validation before persistence', () => {
  it('accepts a complete Riot or local importer match', () => {
    expect(() => assertImportMatch(match())).not.toThrow();
    const local = match();
    local.info.participants[0].stats = { item0Id: 1056, damageToTurrets: 40 };
    expect(() => assertImportMatch(local)).not.toThrow();
  });

  it.each(['not-a-number', NaN, Infinity, -Infinity, -1, 0.5, 2_147_483_648, null, true, ''])('rejects invalid persisted kills %s', value => {
    const input = match();
    (input.info.participants[0] as any).kills = value;
    expect(() => assertImportMatch(input)).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('rejects invalid alternate stats and overflow of combined CS', () => {
    const input = match();
    input.info.participants[0].stats = { damageToTurrets: 'invalid' };
    expect(() => assertImportMatch(input)).toThrow(/damageToTurrets/);
    delete input.info.participants[0].stats;
    input.info.participants[0].totalMinionsKilled = 2_147_483_647;
    expect(() => assertImportMatch(input)).toThrow(/cs/);
  });

  it('rejects invalid duration and non-finite numbers in preserved timeline data', () => {
    const input = match();
    input.info.gameDuration = 0;
    expect(() => assertImportMatch(input)).toThrow(/gameDuration/);
    input.info.gameDuration = 1800;
    input.timeline = JSON.parse('{"timestamp":1e400}');
    expect(() => assertImportMatch(input)).toThrow(/non fini/);
  });

  it('rejects missing champions, duplicate participants and incomplete teams', () => {
    const input = match();
    input.info.participants[0].championName = '';
    expect(() => assertImportMatch(input)).toThrow(/Champion/);
    input.info.participants[0].championName = 'Ahri';
    input.info.participants[0].participantId = 2;
    expect(() => assertImportMatch(input)).toThrow(/dupliqués/);
    input.info.participants[0].participantId = 1;
    input.info.participants[0].teamId = 200;
    expect(() => assertImportMatch(input)).toThrow(/cinq participants/);
  });

  it('requires five distinct profiles that still belong to the supplied roster', () => {
    const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const roster = roles.map((_, index) => ({ id: `player-${index}` }));
    const assignments = Object.fromEntries(roles.map((role, index) => [role, roster[index].id]));
    expect(() => assertImportPlayerAssignments(assignments, roster)).not.toThrow();
    assignments.TOP = 'deleted-player';
    expect(() => assertImportPlayerAssignments(assignments, roster)).toThrow(/introuvable/);
    assignments.TOP = assignments.JGL;
    expect(() => assertImportPlayerAssignments(assignments, roster)).toThrow(/différent/);
  });

  it('normalizes duplicate category UUIDs and rejects invalid identifiers before SQL casts', () => {
    const id = 'aeb4f6aa-0735-4138-b755-dc87b3ee2d02';
    expect(normalizeImportCategoryIds([id, id.toUpperCase()])).toEqual([id]);
    expect(() => normalizeImportCategoryIds(['not-a-uuid'])).toThrowError(expect.objectContaining({ status: 400 }));
  });
});
