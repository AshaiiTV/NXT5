import { canonicalChampion } from '../../shared/champions.js';
import { canonicalRole, ROLES } from '../../shared/roles.js';
import { draftOrder, draftSlotState } from '../../shared/draft-order.js';
import { completeDraftSlots, normalizeDraftRows } from './draft-analysis.js';

const OTHER = { blue: 'red', red: 'blue' };
const SLOTS = [1, 2, 3, 4, 5];
const id = value => String(value ?? '').trim();
const key = value => canonicalChampion(value).toLowerCase();
const roleOf = row => canonicalRole(row?.role || row?.raw?.teamPosition || row?.raw?.individualPosition || row?.raw?.lane);
const percent = (count, total) => total ? count / total * 100 : null;
const orderRows = rows => rows.sort((a, b) => b.count - a.count || (b.observed || 0) - (a.observed || 0) || String(a.champion || a.role || '').localeCompare(String(b.champion || b.role || ''), 'en'));
const metric = sources => ({ count: sources.length, sources });
const frequency = (sources, total) => ({ ...metric(sources), total, rate: percent(sources.length, total) });

function uniqueMatches(matches, teamId) {
  const seen = new Set();
  return (Array.isArray(matches) ? matches : []).filter(match => {
    if (!match || (teamId && id(match.team_id) !== teamId)) return false;
    const matchKey = id(match.game_id) ? `${id(match.team_id)}:game:${id(match.game_id)}` : id(match.id) ? `${id(match.team_id)}:id:${id(match.id)}` : match;
    if (seen.has(matchKey)) return false;
    seen.add(matchKey); return true;
  });
}

// A match link alone does not prove that the attached draft was the one played.
// Require both complete champion sets before enriching its picks with played roles.
function matchCompatible(row, match) {
  if (!match) return false;
  return [['ALLY', row.allySide], ['ENEMY', OTHER[row.allySide]]].every(([camp, side]) => {
    const picks = row.snapshot[`${side}Picks`];
    const participants = (match.participants || []).filter(participant => participant.team_key === camp);
    if (!completeDraftSlots(row.snapshot, side, 'pick') || participants.length !== 5) return false;
    const champions = participants.map(participant => key(participant.champion));
    return champions.every(Boolean) && new Set(champions).size === 5 && picks.every(champion => champions.includes(key(champion)));
  });
}

function uniqueRoleRows(match, camp) {
  const participants = (match?.participants || []).filter(row => row.team_key === camp);
  return participants.filter(row => {
    const role = roleOf(row);
    return role && key(row.champion) && participants.filter(other => roleOf(other) === role).length === 1
      && participants.filter(other => key(other.champion) === key(row.champion)).length === 1;
  });
}

// Resolve each match/camp once. Every banned champion then reads its history
// directly instead of rewalking all imported participants for each of five roles.
function indexPlayedRoles(matches, playerMap) {
  const played = new Map();
  const roles = { ALLY: new Map(), ENEMY: new Map() };
  for (const match of matches) {
    const matchRows = {};
    for (const camp of ['ALLY', 'ENEMY']) {
      const rows = uniqueRoleRows(match, camp);
      matchRows[camp] = rows;
      for (const row of rows) {
        const champion = key(row.champion);
        const role = roleOf(row);
        if (!roles[camp].has(champion)) roles[camp].set(champion, new Map());
        const championRoles = roles[camp].get(champion);
        if (!championRoles.has(role)) championRoles.set(role, { role, games: 0, players: new Set(), matches: [] });
        const observation = championRoles.get(role);
        observation.games += 1;
        observation.matches.push(match);
        const name = camp === 'ALLY' ? playerMap.get(id(row.player_id))?.name : null;
        if (name) observation.players.add(name);
      }
    }
    played.set(match, matchRows);
  }
  for (const camp of ['ALLY', 'ENEMY']) for (const [champion, championRoles] of roles[camp]) {
    roles[camp].set(champion, ROLES.flatMap(role => {
      const entry = championRoles.get(role);
      return entry ? [{ ...entry, players: [...entry.players] }] : [];
    }));
  }
  return { played, roles };
}

function preparedPools(championPool, playerMap, teamId) {
  if (!teamId) return [];
  const seen = new Set();
  return (Array.isArray(championPool) ? championPool : []).flatMap(row => {
    const player = playerMap.get(id(row?.player_id));
    const role = canonicalRole(row?.role || player?.role);
    const champion = canonicalChampion(row?.champion);
    if (!id(row?.id) || id(row?.team_id) !== teamId || !player || !role
      || !['manual', 'riot_manual'].includes(row.source) || !key(champion)) return [];
    const playerKey = JSON.stringify([id(player.id), role, key(champion)]);
    if (seen.has(playerKey)) return [];
    seen.add(playerKey);
    return [{ id: player.id, name: player.name || '', role, champion, status: ['lock', 'pocket', 'work', 'danger'].includes(row.status) ? row.status : 'work' }];
  });
}

function poolPlayers(champion, pools) {
  return pools.filter(entry => key(entry.champion) === key(champion)).map(({ champion: ignoredChampion, ...player }) => player);
}

function buildPoolPressure(bans, total) {
  const players = new Map();
  for (const ban of bans) for (const player of ban.poolPlayers) {
    const playerKey = JSON.stringify([id(player.id), player.role]);
    if (!players.has(playerKey)) players.set(playerKey, { id: player.id, name: player.name, role: player.role, champions: [], sources: new Set() });
    const exposure = players.get(playerKey);
    exposure.champions.push({ champion: ban.champion, count: ban.observed, sources: ban.sources });
    for (const source of ban.sources) exposure.sources.add(source);
  }
  return [...players.values()].map(entry => ({ ...entry, sources: [...entry.sources], count: entry.sources.size, total }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr') || ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
}

function observedAlternatives(roles, sources, matched, targetCamp, played) {
  return roles.flatMap(({ role }) => {
    const observations = sources.flatMap(source => {
      const match = matched.get(source);
      return (played.get(match)?.[targetCamp] || []).filter(row => roleOf(row) === role).map(row => ({ row, source }));
    });
    const byChampion = new Map();
    for (const { row, source } of observations) {
      const championKey = key(row.champion);
      if (!byChampion.has(championKey)) byChampion.set(championKey, { champion: canonicalChampion(row.champion), sources: [] });
      byChampion.get(championKey).sources.push(source);
    }
    return [...byChampion.values()].map(entry => ({ champion: entry.champion, role, ...frequency(entry.sources, observations.length) }));
  }).sort((a, b) => b.count - a.count || ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.champion.localeCompare(b.champion));
}

function buildCamp(camp, drafts, orders, matched, pools, roleIndex) {
  const sideFor = row => camp === 'ally' ? row.allySide : OTHER[row.allySide];
  const targetCamp = camp === 'enemy' ? 'ALLY' : 'ENEMY';
  const full = drafts.filter(row => completeDraftSlots(row.snapshot, sideFor(row), 'ban'));
  const phased = phase => drafts.filter(row => orders.get(row).status === 'known'
    && completeDraftSlots(row.snapshot, sideFor(row), 'ban', phase === 1 ? [1, 2, 3] : [4, 5]));
  const phase1 = phased(1); const phase2 = phased(2);
  const fullSet = new Set(full);
  const phase1Set = new Set(phase1); const phase2Set = new Set(phase2);
  const eligibleSlots = SLOTS.map(slot => new Set(drafts.filter(row => orders.get(row).status === 'known'
    && completeDraftSlots(row.snapshot, sideFor(row), 'ban', [slot]))));
  const champions = new Map();
  for (const row of drafts) for (const slot of SLOTS) {
    if (draftSlotState(row.snapshot, sideFor(row), 'ban', slot) !== 'selected') continue;
    const champion = canonicalChampion(row.snapshot[`${sideFor(row)}Bans`][slot - 1]);
    const championKey = key(champion);
    if (!champions.has(championKey)) champions.set(championKey, { champion, sources: new Set(), phases: [new Set(), new Set()], slots: SLOTS.map(() => new Set()) });
    const entry = champions.get(championKey);
    entry.champion = champion;
    entry.sources.add(row);
    entry.phases[slot <= 3 ? 0 : 1].add(row);
    entry.slots[slot - 1].add(row);
  }
  const bans = [...champions.values()].map(entry => {
    const { champion } = entry;
    const sources = [...entry.sources];
    const counted = sources.filter(row => fullSet.has(row));
    const roles = roleIndex.roles[targetCamp].get(key(champion)) || [];
    return { champion, count: counted.length, total: full.length, rate: percent(counted.length, full.length),
      observed: sources.length, sources,
      phase1: frequency([...entry.phases[0]].filter(row => phase1Set.has(row)), phase1.length),
      phase2: frequency([...entry.phases[1]].filter(row => phase2Set.has(row)), phase2.length),
      unknownPhase: sources.filter(row => orders.get(row).status !== 'known').length,
      slots: SLOTS.map(slot => ({ slot, ...frequency([...entry.slots[slot - 1]].filter(row => eligibleSlots[slot - 1].has(row)), eligibleSlots[slot - 1].size) })), roles,
      poolPlayers: camp === 'enemy' ? poolPlayers(champion, pools) : [],
      alternatives: observedAlternatives(roles, sources, matched, targetCamp, roleIndex.played),
    };
  });
  return { bans: orderRows(bans), coverage: { bans: full.length, phase1: phase1.length, phase2: phase2.length } };
}

const ROTATIONS = [
  { id: 'opening-1', position: 'opening', slots: [1], phase: 1, label: 'Ouverture · premier pick' },
  { id: 'responding-1', position: 'responding', slots: [1, 2], phase: 1, label: 'Réponse · premier duo' },
  { id: 'opening-2', position: 'opening', slots: [2, 3], phase: 1, label: 'Ouverture · deuxième rotation' },
  { id: 'responding-2', position: 'responding', slots: [3], phase: 1, label: 'Réponse · troisième pick' },
  { id: 'responding-3', position: 'responding', slots: [4], phase: 2, label: 'Réponse · reprise après les bans' },
  { id: 'opening-3', position: 'opening', slots: [4, 5], phase: 2, label: 'Ouverture · dernier duo' },
  { id: 'responding-4', position: 'responding', slots: [5], phase: 2, label: 'Réponse · dernier pick' },
];

function buildRotations(drafts, orders, matched, playedRows) {
  return ROTATIONS.map(definition => {
    const eligible = drafts.filter(row => orders.get(row).status === 'known'
      && (row.snapshot.firstPick === row.allySide ? 'opening' : 'responding') === definition.position);
    const champions = new Map();
    const roles = new Map();
    const roleSources = new Set();
    const labels = new Set();
    for (const row of eligible) {
      const events = orders.get(row).events.filter(event => event.side === row.allySide && event.kind === 'pick' && definition.slots.includes(event.slot));
      labels.add(events.map(event => event.label).join('–'));
      const played = playedRows.get(matched.get(row))?.ALLY || [];
      const seenRoles = new Set();
      for (const event of events) {
        const championKey = key(event.champion);
        if (!champions.has(championKey)) champions.set(championKey, { champion: canonicalChampion(event.champion), sources: [] });
        champions.get(championKey).sources.push(row);
        const participant = played.find(participant => key(participant.champion) === championKey);
        if (participant) seenRoles.add(roleOf(participant));
      }
      // A rotation's role denominator only includes fully resolved blocks.
      if (seenRoles.size === events.length) {
        roleSources.add(row);
        for (const role of seenRoles) {
          if (!roles.has(role)) roles.set(role, []);
          roles.get(role).push(row);
        }
      }
    }
    return { ...definition, kind: 'pick', labels: [...labels], count: eligible.length, total: eligible.length,
      drafts: eligible, sources: eligible, roleCoverage: roleSources.size,
      champions: orderRows([...champions.values()].map(entry => ({ champion: entry.champion, ...frequency(entry.sources, eligible.length) }))),
      roles: orderRows([...roles].map(([role, sources]) => ({ role, ...frequency(sources, roleSources.size) }))),
    };
  });
}

/** Descriptive draft decisions with explicit source and denominator coverage.
 * A ban targets a champion; roles/pools and observed replacements never prove intent.
 * `sources` includes explicit observations in partial drafts; `count/total` only
 * includes complete five-ban sets, while each phase has its own denominator.
 */
export function buildDraftIntelligence(rows = [], matches = [], options = {}) {
  const { drafts, warnings } = normalizeDraftRows(rows);
  const teamId = id(options.teamId);
  const scopedMatches = uniqueMatches(matches, teamId);
  const matchById = new Map(scopedMatches.filter(match => id(match.id)).map(match => [id(match.id), match]));
  const playerMap = new Map((Array.isArray(options.players) ? options.players : []).filter(player => teamId && id(player?.team_id) === teamId && id(player?.id)).map(player => [id(player.id), player]));
  const pools = preparedPools(options.championPool, playerMap, teamId);
  const roleIndex = indexPlayedRoles(scopedMatches, playerMap);
  const orders = new Map(drafts.map(row => [row, draftOrder(row.snapshot)]));
  const matched = new Map();
  let found = 0; let mismatched = 0;
  for (const row of drafts) {
    const match = matchById.get(id(row.matchId));
    if (!match) continue;
    found += 1;
    if (matchCompatible(row, match)) matched.set(row, match);
    else mismatched += 1;
  }
  const patches = [...new Set(drafts.map(row => row.snapshot.patch).filter(Boolean))].sort();
  const modes = [...new Set(drafts.map(row => row.snapshot.ironman ? 'ironman' : row.snapshot.fearless ? 'fearless' : 'standard'))].sort();
  const camps = Object.fromEntries(['enemy', 'ally'].map(camp => [camp, buildCamp(camp, drafts, orders, matched, pools, roleIndex)]));
  return {
    drafts, patches, modes, warnings,
    coverage: { total: drafts.length, ordered: drafts.filter(row => orders.get(row).status === 'known').length,
      linked: drafts.filter(row => row.matchId).length, matched: found, roleLinked: matched.size, mismatched },
    camps, poolCoverage: new Set(pools.map(player => id(player.id))).size,
    poolPressure: buildPoolPressure(camps.enemy.bans, drafts.length),
    rotations: buildRotations(drafts, orders, matched, roleIndex.played),
  };
}
