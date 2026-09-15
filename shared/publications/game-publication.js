/** Browser/server publication model. Never loads secrets, React, remote assets or staff notes. */
import { pngNumeric } from '../../src/utils/png-report.js';
export const PUBLICATION_ANALYSIS_VERSION = 'nxt5-game-2';
export const PUBLICATION_TEMPLATE_VERSION = 'nxt5-game-2';
const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const ALIASES = { gold: 'goldEarned', damage: 'totalDamageDealtToChampions', vision: 'visionScore' };
const OBJECTIVES = { dragons: ['dragon'], barons: ['baron', 'baronNashor'], towers: ['tower', 'towers'], heralds: ['riftHerald', 'riftHeralds', 'herald'], grubs: ['horde', 'voidgrub', 'voidGrubs', 'grub', 'grubs'] };
// Identical numeric rules for game, group, Trends and profile exports.
export const publicationNumber = pngNumeric;
export function publicationFormat(value, signed = false) {
  const number = publicationNumber(value);
  return number === null ? 'Indisponible' : `${signed && number >= 0 ? '+' : ''}${number.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`;
}
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const subtract = (a, b) => finite(a) && finite(b) ? a - b : null;
const object = (value) => { if (typeof value === 'string') { try { return JSON.parse(value) || {}; } catch { return {}; } } return value && typeof value === 'object' ? value : {}; };
const cleanText = (value, limit = 240) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
const list = (value) => Array.isArray(value) ? value : [];
const normalizeRole = (value) => ({ JUNGLE: 'JGL', MIDDLE: 'MID', BOTTOM: 'ADC', SUPPORT: 'SUP', UTILITY: 'SUP' }[String(value || '').toUpperCase()] || String(value || '').toUpperCase());
const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const sourcesFor = (row) => [row, row.raw?.participant, row.raw?.stats, row.raw].filter(Boolean);
const stat = (row, key) => {
  for (const source of sourcesFor(row)) {
    const value = publicationNumber(source[key] ?? source[ALIASES[key] || key]);
    if (value !== null) return value;
  }
  return null;
};
function csFor(row) {
  for (const source of sourcesFor(row)) {
    const direct = publicationNumber(source.cs ?? source.creep_score ?? source.total_cs);
    if (direct !== null) return direct;
    const lane = publicationNumber(source.totalMinionsKilled);
    const jungle = publicationNumber(source.neutralMinionsKilled);
    if (lane !== null && jungle !== null) return lane + jungle;
  }
  return null;
}
function assetId(row, keys, lists = [], index = 0) {
  const sources = [...sourcesFor(row), row.raw?.participant?.stats, row.raw?.stats?.participant].filter(Boolean);
  for (const source of sources) {
    for (const value of [...keys.map((key) => source[key]), ...lists.map((key) => source[key]?.[index])]) {
      const id = publicationNumber(value);
      if (Number.isSafeInteger(id) && id >= 0 && id <= 999999) return id;
    }
  }
  return null;
}
function participationFor(row) {
  const direct = row.kill_participation ?? row.kp;
  const parsed = publicationNumber(direct);
  return parsed === null ? null : String(direct).includes('%') || parsed > 1 ? parsed : parsed * 100;
}
const count = (rows, key) => rows.length === 5 && rows.every((row) => finite(row[key])) ? rows.reduce((sum, row) => sum + row[key], 0) : null;
function isoDate(value) {
  if (value === null || value === undefined || value === '') return null;
  let normalized = value;
  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
    normalized = Number(value);
    if (normalized <= 0) return null;
    if (normalized < 1e12) normalized *= 1000;
  }
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function sideFor(rows, fallback) {
  const ids = [...new Set(rows.map((row) => row.teamId).filter((id) => id === 100 || id === 200))];
  if (ids.length === 1) return ids[0] === 100 ? 'blue' : 'red';
  if (ids.length > 1) return null;
  const side = String(fallback || '').toLowerCase();
  return side.includes('blue') || side.includes('bleu') ? 'blue' : side.includes('red') || side.includes('rouge') ? 'red' : null;
}
function timelineData(raw, participants) {
  const frames = list(raw.timeline?.info?.frames || raw.metadata?.timeline?.info?.frames || raw.timeline?.frames || raw.timeline?.timeline?.info?.frames || raw.timeline?.timeline?.frames);
  const compact = list(raw.nxt5?.timelineEvents);
  const events = (frames.length ? frames.flatMap((frame) => list(frame.events).map((event) => ({ ...event, timestamp: event.timestamp ?? frame.timestamp }))) : compact).filter((event) => finite(publicationNumber(event.timestamp)) && Number(event.timestamp) >= 0).sort((a, b) => a.timestamp - b.timestamp);
  const byId = new Map(participants.filter((row) => row.participantId).map((row) => [row.participantId, row]));
  const kills = events.filter((event) => event.type === 'CHAMPION_KILL').map((event) => ({
    timestamp: Number(event.timestamp), time: clock(event.timestamp), killerId: Number(event.killerId), victimId: Number(event.victimId),
    killerTeam: byId.get(Number(event.killerId))?.teamKey || null, victimTeam: byId.get(Number(event.victimId))?.teamKey || null,
    assistingParticipantIds: list(event.assistingParticipantIds).map(Number),
  }));
  const groups = [];
  for (const kill of kills) {
    const previous = groups.at(-1);
    if (previous && kill.timestamp - previous.at(-1).timestamp <= 24000) previous.push(kill);
    else groups.push([kill]);
  }
  const fights = groups.filter((group) => group.length >= 2 && group.every((kill) => kill.victimTeam && (kill.killerTeam || kill.killerId === 0))).map((group) => {
    const ally = group.filter((kill) => kill.killerTeam === 'ALLY').length;
    const enemy = group.filter((kill) => kill.killerTeam === 'ENEMY').length;
    return { time: group[0].time, ally, enemy, winner: ally === enemy ? null : ally > enemy ? 'ALLY' : 'ENEMY' };
  });
  // A compact empty array is also saved by imports that never had a timeline.
  const hasEvents = Boolean(frames.length || compact.length);
  const mapped = kills.every((kill) => kill.victimTeam && (kill.killerTeam || kill.killerId === 0));
  const hasMilestones = Boolean(raw.nxt5?.timelineSummary?.available);
  const status = frames.length ? 'detailed' : compact.length ? 'events' : hasMilestones ? 'milestones' : 'missing';
  const labels = { detailed: 'Timeline détaillée disponible', events: 'Timeline résumée disponible', milestones: 'Repères de timeline disponibles', missing: 'Timeline absente' };
  return { frames, events, kills, fights, hasEvents, mapped, coverage: { status, label: labels[status], detail: frames.length ? `${frames.length} frame${frames.length > 1 ? 's' : ''} enregistrée${frames.length > 1 ? 's' : ''}` : compact.length ? `${compact.length} événements indexés` : hasMilestones ? 'CS et vision selon les repères enregistrés ; combats indisponibles' : 'Statistiques finales uniquement', combatEventsAvailable: hasEvents && mapped } };
}
function cs10For(row, raw, frames, durationSeconds) {
  if (!row.participantId || (finite(durationSeconds) && durationSeconds < 600)) return null;
  if (frames.length) {
    const frame = frames.find((item) => Number(item.timestamp) >= 600000 && Number(item.timestamp) <= 660000);
    const source = frame?.participantFrames?.[String(row.participantId)];
    const lane = publicationNumber(source?.minionsKilled);
    const jungle = publicationNumber(source?.jungleMinionsKilled);
    return finite(lane) && finite(jungle) ? lane + jungle : null;
  }
  return publicationNumber(raw.nxt5?.timelineSummary?.csMilestones?.[String(row.participantId)]?.cs10);
}
function metric(ally, enemy, unit, source) { return { ally, enemy, diff: subtract(ally, enemy), unit, available: finite(ally) && finite(enemy), source }; }
function objective(raw, side, aliases) {
  if (!side) return null;
  const team = list(raw.info?.teams).find((entry) => Number(entry.teamId) === (side === 'blue' ? 100 : 200));
  const values = aliases.map((key) => publicationNumber(team?.objectives?.[key]?.kills)).filter(finite);
  return values.length ? Math.max(...values) : null;
}
function buildCoach({ context, facts, coverage, participants }, timeline) {
  const fmt = publicationFormat;
  const tone = (value) => !finite(value) ? 'cyan' : value < 0 ? 'red' : 'green';
  const roleDiffs = ROLES.flatMap((role) => {
    const a = participants.filter((row) => row.teamKey === 'ALLY' && row.role === role);
    const b = participants.filter((row) => row.teamKey === 'ENEMY' && row.role === role);
    if (a.length !== 1 || b.length !== 1) return [];
    return [{ role, ally: a[0], enemy: b[0], goldDiff: subtract(a[0].gold, b[0].gold), damageDiff: subtract(a[0].damage, b[0].damage), cs10Diff: subtract(a[0].cs10, b[0].cs10), deathsDiff: subtract(a[0].deaths, b[0].deaths) }];
  });
  const comparable = roleDiffs.filter((row) => finite(row.goldDiff));
  const reviewRole = comparable.slice().sort((a, b) => a.goldDiff - b.goldDiff)[0];
  const carryRole = comparable.slice().sort((a, b) => b.goldDiff - a.goldDiff)[0];
  const signal = [
    ['gold', 'Économie', 2500, 'or final'], ['damage', 'Dégâts', 7000, 'dégâts aux champions'], ['vision', 'Vision', 18, 'score de vision'],
  ].find(([key, , threshold]) => finite(facts[key].diff) && Math.abs(facts[key].diff) >= threshold)
    || [['gold', 'Économie', 0, 'or final'], ['damage', 'Dégâts', 0, 'dégâts aux champions'], ['vision', 'Vision', 0, 'score de vision']].find(([key]) => finite(facts[key].diff))
    || ['gold', 'Économie', 0, 'or final'];
  const [signalKey, label, , unit] = signal;
  const mainSignal = { label, value: fmt(facts[signalKey].diff, true), toneName: tone(facts[signalKey].diff) };
  const title = finite(facts[signalKey].diff) ? `${context.result} · écart de ${unit}` : `${context.result} · statistiques incomplètes`;
  const summary = finite(facts[signalKey].diff)
    ? `Écart final : ${mainSignal.value} en ${unit} entre notre équipe et l'adversaire. Ce bilan ne suffit pas à expliquer le résultat ; vérifier la création et la conversion des ressources dans la VOD.`
    : 'Les données disponibles ne permettent pas de comparer les totaux des deux équipes. Compléter les données avant de tirer une conclusion collective.';
  const action = context.result === 'Victoire' ? 'Identifier dans la VOD un setup reproductible pour la prochaine game.' : 'Choisir un seul correctif, après vérification des séquences dans la VOD.';
  const isVisionIssue = finite(facts.vision.diff) && facts.vision.diff < -18;
  const standard = isVisionIssue ? 'Préparer la zone, partager l’information jungle et annoncer le chemin de sortie avant de jouer un objectif.' : 'Annoncer la prochaine ressource jouée, les priorités de lane et la condition de renoncement avant le setup.';
  const playerReads = participants.filter((row) => row.teamKey === 'ALLY').map((row) => {
    const diff = roleDiffs.find((entry) => entry.role === row.role);
    const deaths = timeline.kills.filter((event) => event.victimId === row.participantId && event.victimTeam === 'ALLY');
    const catches = deaths.filter((death) => !timeline.kills.some((kill) => kill.killerTeam === 'ALLY' && kill.timestamp >= death.timestamp && kill.timestamp - death.timestamp <= 15000));
    const combatAvailable = coverage.timeline.combatEventsAvailable && row.participantId !== null;
    return {
      name: row.name, role: row.role || 'Rôle inconnu',
      catchText: !combatAvailable ? 'Timings des morts indisponibles : vérifier les catches dans la VOD.' : catches.length ? `${catches.length} mort(s) sans kill allié dans les 15 secondes suivantes : ${catches.slice(0, 3).map((event) => event.time).join(' · ')}. Piste à vérifier avec les positions et les ressources.` : 'Aucune mort non échangée repérée dans les événements disponibles ; vérifier le contexte dans la VOD.',
      goodText: !combatAvailable ? 'Événements de combat indisponibles : vérifier les séquences positives dans la VOD.' : 'Comparer les séquences de combat disponibles avec les priorités, les ressources et les timings de déplacement.',
      laneText: diff ? `Lane : CS10 ${fmt(diff.cs10Diff, true)} · or final ${fmt(diff.goldDiff, true)}. L’écart final ne décrit pas à lui seul la phase de lane.` : 'Lane : données comparatives insuffisantes.',
      weakside: 'Si les ressources de l’équipe sont engagées sur l’autre côté : protéger la wave, garder une sortie et annoncer le risque.',
      strongside: 'Si l’équipe joue son côté : préparer le crash, coordonner le reset et demander la couverture avant le setup.',
    };
  });
  const fightsAvailable = coverage.timeline.combatEventsAvailable;
  const allyFights = fightsAvailable ? timeline.fights.filter((fight) => fight.winner === 'ALLY').length : null;
  const enemyFights = fightsAvailable ? timeline.fights.filter((fight) => fight.winner === 'ENEMY').length : null;
  const keep = carryRole && carryRole.goldDiff > 0 ? `${carryRole.role} termine avec ${fmt(carryRole.goldDiff, true)} or face à son adversaire ; chercher les décisions reproductibles dans la VOD.` : 'Conserver les décisions utiles identifiées et confirmées pendant la review.';
  const correct = reviewRole && reviewRole.goldDiff < 0 ? `${reviewRole.role} termine avec ${fmt(reviewRole.goldDiff, true)} or ; c’est une piste de review, pas une cause établie.` : 'Vérifier collectivement les premières pertes de ressources avant de choisir un correctif.';
  return {
    title, summary, mainSignal, keep, correct, action, standard, playerReads,
    roleText: reviewRole ? `${reviewRole.role} vs ${reviewRole.enemy.champion || 'Champion inconnu'} · CS10 ${fmt(reviewRole.cs10Diff, true)} · or final ${fmt(reviewRole.goldDiff, true)}` : 'Pas assez de données comparables par rôle.',
    verdict: `${summary} ${action}`,
    vodCheckpoints: [coverage.timeline.combatEventsAvailable ? 'Revoir une séquence de combat indexée : information, ressources et décision collective.' : 'Retrouver les premières séquences de combat dans la VOD ; leurs événements ne sont pas disponibles ici.', 'Revoir les 60 secondes avant le premier objectif contesté : waves, resets, vision et position du jungler.', 'Comparer une décision utile et une perte de ressource, avec les informations connues au moment du call.'],
    executionPlan: ['Avant la game : annoncer le plan et le risque principal en une phrase.', 'En game : annoncer le setup avant de déplacer les ressources de l’équipe.', 'Après la game : vérifier le standard sur trois séquences sans juger uniquement le résultat final.'],
    validation: 'Définir pendant la review un comportement observable, puis vérifier son exécution sur les trois prochaines games.',
    coachQuestions: ['Quelles informations étaient connues au moment de décider ?', 'Quel call aurait permis aux cinq joueurs de coordonner leur décision ?', 'Quel comportement précis tester dès la prochaine game ?'],
    metrics: [
      ['KDA', [facts.kills.ally, facts.deaths.ally, facts.assists.ally].map((v) => finite(v) ? fmt(v) : '—').join('/'), `${fmt(facts.kills.enemy)} kills adverses`, 'cyan'],
      ['Or', fmt(facts.gold.diff, true), 'écart final', tone(facts.gold.diff)],
      ['Dégâts', fmt(facts.damage.diff, true), 'dégâts aux champions', tone(facts.damage.diff)],
      ['Vision', fmt(facts.vision.diff, true), 'écart de score', tone(facts.vision.diff)],
      ['Dragons', `${fmt(facts.dragons.ally)} – ${fmt(facts.dragons.enemy)}`, 'notre équipe / adversaire', tone(facts.dragons.diff)],
      ['Fights', fightsAvailable ? `${allyFights} – ${enemyFights}` : 'Indisponible', fightsAvailable ? 'fenêtres de kills de 24 s' : 'combats non couverts', tone(subtract(allyFights, enemyFights))],
    ],
  };
}
/**
 * @param {{team?: Record<string, any>, match?: Record<string, any>, categories?: Array<Record<string, any>>, sourceRevision?: string|number|null, generatedAt?: string|Date|null}} options
 */
export function buildGamePublicationSnapshot({ team = {}, match = {}, categories = [], sourceRevision = null, generatedAt = null } = {}) {
  if (team.id && match.team_id && String(team.id) !== String(match.team_id)) throw new Error('La game n’appartient pas à l’équipe de la publication.');
  if (list(match.participants).some((row) => row.match_id && match.id && String(row.match_id) !== String(match.id))) throw new Error('Un participant n’appartient pas à la game de la publication.');
  const raw = object(match.raw);
  const seen = new Set();
  let duplicates = false;
  const participants = list(match.participants).map((original, index) => {
    const row = { ...original, raw: object(original.raw) };
    const participantId = stat(row, 'participantId');
    if (participantId && seen.has(participantId)) duplicates = true;
    if (participantId) seen.add(participantId);
    return {
      participantId, teamId: stat(row, 'teamId'), teamKey: row.team_key === 'ALLY' || row.team_key === 'ENEMY' ? row.team_key : null,
      role: normalizeRole(row.role), name: cleanText(row.player_name || row.summoner_name || row.riot_id || 'Joueur inconnu', 160), champion: cleanText(row.champion || row.raw.participant?.championName || row.raw.stats?.championName || row.raw.championName, 80),
      kills: stat(row, 'kills'), deaths: stat(row, 'deaths'), assists: stat(row, 'assists'), gold: stat(row, 'gold'), damage: stat(row, 'damage'), vision: stat(row, 'vision'), cs: csFor(row), participation: participationFor(row),
      items: Array.from({ length: 6 }, (_, slot) => assetId(row, [`item${slot}`, `item${slot}Id`], ['items', 'itemIds'], slot)),
      trinket: assetId(row, ['item6', 'item6Id', 'trinket', 'trinketItemId'], ['items', 'itemIds'], 6),
      spells: [assetId(row, ['summoner1Id', 'spell1Id'], ['summonerSpells', 'spells'], 0), assetId(row, ['summoner2Id', 'spell2Id'], ['summonerSpells', 'spells'], 1)], index,
    };
  }).sort((a, b) => (a.teamKey || '').localeCompare(b.teamKey || '') || ((ROLES.indexOf(a.role) + 5) % 5) - ((ROLES.indexOf(b.role) + 5) % 5) || a.index - b.index);
  const ally = participants.filter((row) => row.teamKey === 'ALLY');
  const enemy = participants.filter((row) => row.teamKey === 'ENEMY');
  const allySide = sideFor(ally, match.side);
  const enemySide = sideFor(enemy, allySide === 'blue' ? 'red' : allySide === 'red' ? 'blue' : null);
  const sidesConsistent = Boolean(allySide && enemySide && allySide !== enemySide);
  const timeline = timelineData(raw, participants);
  if (duplicates) timeline.coverage.combatEventsAvailable = false;
  const durationMatch = /^(\d+):(\d{2})$/.exec(String(match.duration || ''));
  const rawDuration = publicationNumber(raw.info?.gameDuration ?? match.game_duration);
  const durationSeconds = durationMatch && Number(durationMatch[2]) < 60 ? Number(durationMatch[1]) * 60 + Number(durationMatch[2]) : rawDuration !== null && rawDuration > 0 ? rawDuration : null;
  for (const row of participants) {
    if (row.participation !== null || duplicates) continue;
    const teamKills = count(row.teamKey === 'ALLY' ? ally : row.teamKey === 'ENEMY' ? enemy : [], 'kills');
    if (row.kills !== null && row.assists !== null && teamKills !== null && teamKills > 0) row.participation = (row.kills + row.assists) / teamKills * 100;
  }
  for (const row of participants) { row.cs10 = cs10For(row, raw, timeline.frames, durationSeconds); delete row.index; }
  const result = ['Victoire', 'Défaite'].includes(match.result) ? match.result : 'Résultat inconnu';
  const categoryIds = [...new Set([...list(match.category_ids), match.category_id].filter(Boolean).map(String))];
  const context = {
    teamName: cleanText(team.name || team.team_name || 'Notre équipe', 160),
    opponentName: cleanText(match.opponent || 'Adversaires', 200),
    gameId: cleanText(match.game_id || match.id, 100), result, duration: finite(durationSeconds) && durationSeconds >= 0 ? clock(durationSeconds * 1000) : null,
    allySide, enemySide, patch: cleanText(match.patch || raw.info?.gameVersion, 80) || null,
    categories: list(categories).filter((item) => categoryIds.includes(String(item.id))).map((item) => ({ id: String(item.id), name: cleanText(item.name, 100) })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  const facts = {};
  for (const [key, unit] of Object.entries({ kills: 'kills', deaths: 'morts', assists: 'assists', gold: 'or', damage: 'dégâts aux champions', vision: 'score de vision' })) {
    facts[key] = metric(duplicates ? null : count(ally, key), duplicates ? null : count(enemy, key), unit, 'participants-final');
  }
  for (const [key, aliases] of Object.entries(OBJECTIVES)) facts[key] = metric(sidesConsistent ? objective(raw, allySide, aliases) : null, sidesConsistent ? objective(raw, enemySide, aliases) : null, key === 'dragons' ? 'dragons' : key, 'riot-team-objectives');
  const warnings = [];
  if (ally.length !== 5 || enemy.length !== 5) warnings.push('Totaux indisponibles pour une équipe dont les cinq participants ne sont pas présents.');
  if (duplicates) warnings.push('Identifiants de participants dupliqués : totaux et chronologie indisponibles.');
  if (!sidesConsistent) warnings.push('Côtés des équipes incomplets ou incohérents : objectifs indisponibles.');
  if (!timeline.coverage.combatEventsAvailable) warnings.push('Événements de combat indisponibles ou non attribuables aux participants.');
  const coverage = { participants: { ally: ally.length, enemy: enemy.length, expectedPerTeam: 5 }, timeline: timeline.coverage, warnings };
  const teamId = cleanText(team.id || match.team_id, 100);
  const entityId = cleanText(match.id, 100);
  const snapshot = {
    schemaVersion: 1, analysisVersion: PUBLICATION_ANALYSIS_VERSION, templateVersion: PUBLICATION_TEMPLATE_VERSION,
    teamId, entityType: 'match', entityId, sourceRevision: sourceRevision === null ? null : String(sourceRevision), publicationKind: 'game',
    playedAt: [raw.info?.gameStartTimestamp, raw.info?.gameCreation, match.played_at, match.game_date, match.game_creation, match.date].map(isoDate).find(Boolean) || null,
    generatedAt: isoDate(generatedAt), context, coverage, facts, participants,
    links: { gamePath: `/statistiques?team=${encodeURIComponent(teamId)}&match=${encodeURIComponent(entityId)}` },
  };
  const coach = buildCoach(snapshot, timeline);
  return { ...snapshot, coach, reviewHints: [{ observation: coach.summary, action: coach.action, evidence: ['facts.gold', 'facts.damage', 'facts.vision'], availability: facts.gold.available || facts.damage.available || facts.vision.available ? 'measured-final' : 'insufficient' }] };
}
