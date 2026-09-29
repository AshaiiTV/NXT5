import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { loadMigrations } from '../../tools/migration-runner.mjs';
import { canonicalChampionName, championGroupKey } from '../../shared/champions.js';

describe('canonical champion names', () => {
  it('maps every imported spelling to the Riot match-v5 name', () => {
    expect(['Wukong', 'MonkeyKing', 'monkeyking'].map(canonicalChampionName)).toEqual(['MonkeyKing', 'MonkeyKing', 'MonkeyKing']);
    expect(canonicalChampionName('Dr. Mundo')).toBe('DrMundo');
    expect(canonicalChampionName("Kai'Sa")).toBe('Kaisa');
    expect(canonicalChampionName('Nunu & Willump')).toBe('Nunu');
    expect(canonicalChampionName('Fiddlesticks')).toBe('FiddleSticks');
    expect(canonicalChampionName(' Ahri ')).toBe('Ahri');
    expect(canonicalChampionName(null)).toBe('');
    expect(championGroupKey('Renata Glasc')).toBe(championGroupKey('Renata'));
    expect(championGroupKey("Bel'Veth")).toBe('belveth');
  });
});

describe('canonical champion names migration', () => {
  it('renames stored names, merges derived pools, respects manual rows and is repeatable', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create table match_participants (id text primary key, champion text not null);
        create table player_matchup_notebooks (
          id text primary key, team_id text not null, player_id text not null,
          champion text not null check (champion ~ '^[a-z0-9]{1,80}$'),
          opponent_champion text not null check (opponent_champion ~ '^[a-z0-9]{1,80}$'),
          role text not null,
          unique (team_id, player_id, champion, opponent_champion, role)
        );
        create table champion_pool (
          id text primary key, team_id text not null, player_id text, player_name text not null default 'Joueur',
          champion text not null, games integer not null default 0, wins integer not null default 0,
          losses integer not null default 0, winrate numeric not null default 0, kda numeric not null default 0,
          cs_per_min numeric not null default 0, verdict text not null default 'Données insuffisantes',
          source text not null default 'riot', notes text, updated_at timestamptz not null default now(),
          unique (team_id, player_id, champion)
        );
        insert into match_participants values ('lcu', 'Dr. Mundo'), ('riot', 'DrMundo'), ('other', 'Ahri'), ('wukong', 'Wukong');
        insert into player_matchup_notebooks values
          ('rename', 't', 'p', 'wukong', 'ahri', 'TOP'),
          ('opponent', 't', 'p', 'ahri', 'renataglasc', 'SUP'),
          ('kept', 't', 'p', 'nunuwillump', 'ahri', 'JGL'),
          ('existing', 't', 'p', 'nunu', 'ahri', 'JGL');
        insert into champion_pool (id, team_id, player_id, champion, games, wins, losses, winrate, kda, cs_per_min, verdict, source, notes) values
          ('mundo-display', 't', 'p1', 'Dr. Mundo', 2, 2, 0, 100, 4, 6, 'Données insuffisantes', 'riot', null),
          ('mundo-riot', 't', 'p1', 'DrMundo', 3, 1, 2, 33, 2, 8, 'Situationnel', 'riot', null),
          ('kaisa-display', 't', 'p1', 'Kai''Sa', 4, 3, 1, 75, 5, 7, 'Situationnel', 'riot', null),
          ('kaisa-manual', 't', 'p1', 'Kaisa', 0, 0, 0, 0, 0, 0, 'Données insuffisantes', 'manual', 'pocket pick'),
          ('fiddle-manual', 't', 'p1', 'Fiddlesticks', 0, 0, 0, 0, 0, 0, 'Données insuffisantes', 'manual', 'à travailler'),
          ('fiddle-riot', 't', 'p1', 'FiddleSticks', 2, 1, 1, 50, 3, 5, 'Données insuffisantes', 'riot', null),
          ('wukong-alone', 't', null, 'Wukong', 1, 1, 0, 100, 9, 4, 'Données insuffisantes', 'riot', null),
          ('ahri', 't', 'p1', 'Ahri', 1, 0, 1, 0, 1, 5, 'Données insuffisantes', 'riot', null);
      `);
      const migration = readFileSync(new URL('../../database/migrations/20260929_canonical_champion_names.sql', import.meta.url), 'utf8');
      expect((await loadMigrations()).find(item => item.key === 'canonical-champion-names-20260929-v1')?.sql).toBe(migration);
      await db.exec(migration);

      expect((await db.query('select id, champion from match_participants order by id')).rows).toEqual([
        { id: 'lcu', champion: 'DrMundo' }, { id: 'other', champion: 'Ahri' }, { id: 'riot', champion: 'DrMundo' }, { id: 'wukong', champion: 'MonkeyKing' },
      ]);
      expect((await db.query('select id, champion, opponent_champion from player_matchup_notebooks order by id')).rows).toEqual([
        { id: 'existing', champion: 'nunu', opponent_champion: 'ahri' },
        { id: 'kept', champion: 'nunuwillump', opponent_champion: 'ahri' },
        { id: 'opponent', champion: 'ahri', opponent_champion: 'renata' },
        { id: 'rename', champion: 'monkeyking', opponent_champion: 'ahri' },
      ]);

      const pool = (await db.query<Record<string, unknown>>(`select id, player_id, champion, games, wins, losses, winrate::float, kda::float, cs_per_min::float, verdict, source, notes
        from champion_pool order by id`)).rows;
      expect(pool).toEqual([
        { id: 'ahri', player_id: 'p1', champion: 'Ahri', games: 1, wins: 0, losses: 1, winrate: 0, kda: 1, cs_per_min: 5, verdict: 'Données insuffisantes', source: 'riot', notes: null },
        // Both Riot and manual names hide the derived row; the manual row takes the Riot name.
        { id: 'fiddle-manual', player_id: 'p1', champion: 'FiddleSticks', games: 0, wins: 0, losses: 0, winrate: 0, kda: 0, cs_per_min: 0, verdict: 'Données insuffisantes', source: 'manual', notes: 'à travailler' },
        { id: 'kaisa-manual', player_id: 'p1', champion: 'Kaisa', games: 0, wins: 0, losses: 0, winrate: 0, kda: 0, cs_per_min: 0, verdict: 'Données insuffisantes', source: 'manual', notes: 'pocket pick' },
        // 2 + 3 games: 3 wins, KDA (4×2 + 2×3) / 5, CS/min (6×2 + 8×3) / 5.
        { id: 'mundo-riot', player_id: 'p1', champion: 'DrMundo', games: 5, wins: 3, losses: 2, winrate: 60, kda: 2.8, cs_per_min: 7.2, verdict: 'Volume élevé, WR positif', source: 'riot', notes: null },
        { id: 'wukong-alone', player_id: null, champion: 'MonkeyKing', games: 1, wins: 1, losses: 0, winrate: 100, kda: 9, cs_per_min: 4, verdict: 'Données insuffisantes', source: 'riot', notes: null },
      ]);

      await db.exec(migration);
      expect((await db.query('select id, champion, games from champion_pool order by id')).rows)
        .toEqual(pool.map(({ id, champion, games }) => ({ id, champion, games })));
      expect((await db.query('select champion from match_participants order by id')).rows.map(row => row.champion))
        .toEqual(['DrMundo', 'Ahri', 'DrMundo', 'MonkeyKing']);
    } finally { await db.close(); }
  }, 20_000);
});
