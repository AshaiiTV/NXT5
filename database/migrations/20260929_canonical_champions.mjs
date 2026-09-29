// Immutable data migration: keep the v1 canonicalisation rules frozen here.
export const CHAMPION_ASSET_ALIASES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  fiddlesticks: "Fiddlesticks",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leblanc: "Leblanc",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  monkeyking: "MonkeyKing",
  nunuwillump: "Nunu",
  reksai: "RekSai",
  renataglasc: "Renata",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  viego: "Viego",
  wukong: "MonkeyKing",
  xinzhao: "XinZhao",
};

export function canonicalChampion(value) {
  const raw = String(value || "").trim();
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return CHAMPION_ASSET_ALIASES[key] || raw.replace(/[^A-Za-z0-9]/g, "");
}

export const sql = `create table if not exists player_matchup_canonical_backups (
  original_id uuid primary key,
  notebook_id uuid not null references player_matchup_notebooks(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  original jsonb not null,
  created_at timestamptz not null default now()
);`;

// Frozen editor limits: never import the evolving runtime validator into a migration.
const MAX_EXPERIMENTS = 20;
const MAX_NOTEBOOK_MATCHES = 200;
const MAX_EXPERIMENT_MATCHES = 50;
const MAX_PLAN_TEXT = 4000;

const rank = row => (['manual', 'riot_manual'].includes(row.source) ? 10 : 0)
  + ({ danger: 4, lock: 3, pocket: 2, work: 1 }[row.status] || 0);
const key = values => JSON.stringify(values);
function groups(rows, getKey) {
  const grouped = new Map();
  for (const row of rows) {
    const id = getKey(row);
    grouped.set(id, [...(grouped.get(id) || []), row]);
  }
  return grouped.values();
}

export async function run(client) {
  await client.query('lock table teams, matches, match_participants, champion_pool, composition_types, player_matchup_notebooks in share row exclusive mode');
  // This migration deliberately never changes matches.raw, participant.raw or archives.
  const participants = (await client.query('select id, champion from match_participants')).rows;
  for (const row of participants) {
    const champion = canonicalChampion(row.champion);
    if (champion !== row.champion) await client.query('update match_participants set champion=$2 where id=$1', [row.id, champion]);
  }
  const pool = (await client.query('select * from champion_pool order by id')).rows;
  const replacements = new Map();
  for (const entries of groups(pool, row => key([row.team_id, row.player_id, canonicalChampion(row.champion)]))) {
    entries.sort((a, b) => rank(b) - rank(a) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() || a.id.localeCompare(b.id));
    const keep = entries[0];
    for (const row of entries.slice(1)) {
      replacements.set(row.id, keep.id);
      await client.query('delete from champion_pool where id=$1', [row.id]);
    }
    if (entries.length > 1) {
      const notes = [...new Set(entries.map(row => row.notes).filter(Boolean))].join('\n\n');
      if (notes) await client.query('update champion_pool set notes=$2 where id=$1', [keep.id, notes]);
    }
    if (entries.length > 1 && !['manual', 'riot_manual'].includes(keep.source)) {
      const games = entries.reduce((sum, row) => sum + Number(row.games), 0);
      const wins = entries.reduce((sum, row) => sum + Number(row.wins), 0);
      const mean = field => games ? entries.reduce((sum, row) => sum + Number(row[field]) * Number(row.games), 0) / games : 0;
      await client.query('update champion_pool set games=$2,wins=$3,losses=$4,winrate=$5,kda=$6,cs_per_min=$7 where id=$1',
        [keep.id, games, wins, games - wins, games ? 100 * wins / games : 0, mean('kda'), mean('cs_per_min')]);
    }
    if (keep.champion !== canonicalChampion(keep.champion)) await client.query('update champion_pool set champion=$2 where id=$1', [keep.id, canonicalChampion(keep.champion)]);
  }
  // Compositions store pool references in JSON slots, not foreign keys.
  if (replacements.size) for (const row of (await client.query('select id, slots from composition_types')).rows) {
    let changed = false;
    for (const slot of Object.values(row.slots || {})) {
      if (slot && typeof slot === 'object' && replacements.has(slot.poolId)) {
        slot.poolId = replacements.get(slot.poolId); changed = true;
      }
    }
    if (changed) await client.query('update composition_types set slots=$2::jsonb where id=$1', [row.id, JSON.stringify(row.slots)]);
  }
  const notebooks = (await client.query('select * from player_matchup_notebooks order by updated_at desc, id')).rows;
  for (const entries of groups(notebooks, row => key([row.team_id, row.player_id, canonicalChampion(row.champion).toLowerCase(), canonicalChampion(row.opponent_champion).toLowerCase(), row.role]))) {
    const keep = entries[0];
    const champion = canonicalChampion(keep.champion).toLowerCase();
    const opponent = canonicalChampion(keep.opponent_champion).toLowerCase();
    if (entries.length === 1 && champion === keep.champion && opponent === keep.opponent_champion) continue;
    // Preserve every original before merging, including content beyond editor limits.
    // The backup follows the surviving notebook's deletion lifecycle.
    for (const row of entries) await client.query(`insert into player_matchup_canonical_backups(original_id,notebook_id,team_id,original)
      values($1,$2,$3,$4::jsonb) on conflict(original_id) do nothing`, [row.id, keep.id, keep.team_id, JSON.stringify(row)]);
    const plan = Object.fromEntries(['lanePlan', 'vigilance', 'toKeep'].map(field => [field,
      [...new Set(entries.map(row => row.plan[field]).filter(Boolean))].join('\n\n').slice(0, MAX_PLAN_TEXT)]));
    const experiments = [];
    let matchIds = new Set();
    for (const exp of new Map(entries.flatMap(row => row.experiments).reverse().map(exp => [exp.id, exp])).values()) {
      const combined = new Set([...matchIds, ...exp.matchIds.map(id => id.toLowerCase())]);
      if (experiments.length >= MAX_EXPERIMENTS || exp.matchIds.length > MAX_EXPERIMENT_MATCHES || combined.size > MAX_NOTEBOOK_MATCHES) continue;
      experiments.push(exp);
      matchIds = combined;
    }
    for (const row of entries.slice(1)) await client.query('delete from player_matchup_notebooks where id=$1', [row.id]);
    await client.query(`update player_matchup_notebooks set champion=$2,opponent_champion=$3,plan=$4::jsonb,experiments=$5::jsonb,revision=$6 where id=$1`,
      [keep.id, champion, opponent, JSON.stringify(plan), JSON.stringify(experiments), Math.max(...entries.map(row => row.revision)) + 1]);
  }
}
