/** Factual group publication data. Never includes raw payloads, reviews or private notes. */
import { buildGamePublicationSnapshot } from './game-publication.js';

export const GROUP_PUBLICATION_ANALYSIS_VERSION = 'nxt5-group-1';
export const GROUP_PUBLICATION_TEMPLATE_VERSION = 'nxt5-discord-group-1';
const cleanText = (value, limit) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
function matchIds(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { throw new Error('La liste des games du groupe est invalide.'); }
  }
  if (!Array.isArray(value)) throw new Error('La liste des games du groupe est invalide.');
  const ids = value.map((id) => String(id || '').trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('La liste des games du groupe contient des identifiants invalides ou dupliqués.');
  return ids;
}

/**
 * Every requested game must be present: a partial fetch must never look like a complete group.
 * @param {{team?: Record<string, any>, archive?: Record<string, any>, matches?: Array<Record<string, any>>, categories?: Array<Record<string, any>>, sourceRevision?: string|number|null, generatedAt?: string|Date|null}} options
 */
export function buildGroupPublicationSnapshot({ team = {}, archive = {}, matches = [], categories = [], sourceRevision = '' } = {}) {
  if (team.id && archive.team_id && String(team.id) !== String(archive.team_id)) throw new Error('Le groupe n’appartient pas à l’équipe de la publication.');
  const ids = matchIds(archive.match_ids);
  const byId = new Map(matches.map((match) => [String(match.id), match]));
  if (byId.size !== matches.length) throw new Error('Les données du groupe contiennent des games dupliquées.');
  if (matches.length !== ids.length || ids.some((id) => !byId.has(id))) throw new Error('Certaines games du groupe sont absentes ou ne correspondent plus à sa sélection. Actualise le groupe avant de publier.');
  const games = ids.map((id) => {
    const snapshot = buildGamePublicationSnapshot({ team: { ...team, id: team.id || archive.team_id }, match: byId.get(id), categories });
    return { entityId: snapshot.entityId, playedAt: snapshot.playedAt, context: snapshot.context, facts: snapshot.facts };
  });
  const wins = games.filter((game) => game.context.result === 'Victoire').length;
  const losses = games.filter((game) => game.context.result === 'Défaite').length;
  const dates = games.map((game) => game.playedAt).filter(Boolean).sort();
  return {
    schemaVersion: 1, kind: 'group', publicationKind: 'group', entityType: 'archive',
    analysisVersion: GROUP_PUBLICATION_ANALYSIS_VERSION, templateVersion: GROUP_PUBLICATION_TEMPLATE_VERSION,
    entityId: cleanText(archive.id, 100), teamId: cleanText(team.id || archive.team_id, 100), sourceRevision: String(sourceRevision ?? ''),
    context: { teamName: cleanText(team.name || team.team_name || 'Notre équipe', 160), groupName: cleanText(archive.name || 'Groupe de games', 140), description: cleanText(archive.description, 1000) },
    facts: { games: games.length, wins, losses, unknown: games.length - wins - losses, knownResults: wins + losses, winRate: wins + losses ? wins / (wins + losses) * 100 : null, datedGames: dates.length, periodStart: dates[0] || null, periodEnd: dates.at(-1) || null },
    games,
  };
}
