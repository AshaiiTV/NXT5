import type { Context } from '@netlify/functions';
import { assertSessionSecret, requireAuth } from './_lib/auth';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { assertSubjectRateLimit } from './_lib/rate-limit';
import { importDrafterDraft } from './_lib/drafter-import';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';
import {
  assertOpponentsSchemaReady, createDraftPreviewToken, createOpponent, listOpponents,
  getMatchDraft, getMatchOpponent, getGroupOpponent, groupOpponentError, opponentInput, opponentUuid, readDraftPreviewToken, requireOpponentTeam, saveMatchDraft,
  saveOpponentDraft, setMatchOpponent, setGroupOpponent, unlinkMatchDraft
} from './_lib/opponents';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'POST');
    assertSessionSecret();
    const body = await readJson(request, 24 * 1024);
    const action = body.action;
    // Updating a match can enqueue its deferred publication jobs. Apply the
    // same deployment isolation guard as every other match source mutation.
    if (action === 'set-match-opponent' || action === 'set-group-opponent') assertMatchSourceMutationEnvironment(context);
    const user = await requireAuth(request, context);
    if (!['list', 'create-opponent', 'preview', 'save-draft', 'get-match-draft', 'save-match-draft', 'unlink-match-draft', 'get-match-opponent', 'set-match-opponent', 'get-group-opponent', 'set-group-opponent'].includes(action)) {
      throw Object.assign(new Error('Action inconnue.'), { status: 400, code: 'INVALID_OPPONENT_INPUT' });
    }
    const teamId = opponentUuid(body.teamId);
    const canEdit = await requireOpponentTeam(teamId, user.id, !['list', 'get-match-draft', 'get-match-opponent', 'get-group-opponent'].includes(action));
    await assertOpponentsSchemaReady();
    if (action === 'list') return json({ ...await listOpponents(teamId), canEdit });
    if (action === 'get-match-draft') return json({ ...await getMatchDraft(teamId, opponentUuid(body.matchId)), canEdit });
    if (action === 'get-match-opponent') return json({ ...await getMatchOpponent(teamId, opponentUuid(body.matchId)), canEdit });
    if (action === 'get-group-opponent') return json({ ...await getGroupOpponent(teamId, opponentUuid(body.archiveId)), canEdit });

    if (action === 'set-group-opponent') {
      const archiveId = opponentUuid(body.archiveId);
      const opponentId = body.opponentId === null ? null : opponentUuid(body.opponentId);
      await assertSubjectRateLimit('opponents-write-user', user.id, { limit: 30, windowSeconds: 60 });
      return json(await setGroupOpponent(teamId, user.id, archiveId, opponentId));
    }

    if (action === 'set-match-opponent') {
      const matchId = opponentUuid(body.matchId);
      const opponentId = body.opponentId === null ? null : opponentUuid(body.opponentId);
      await assertSubjectRateLimit('opponents-write-user', user.id, { limit: 30, windowSeconds: 60 });
      return json({ opponentId: await setMatchOpponent(teamId, user.id, matchId, opponentId) });
    }

    if (action === 'unlink-match-draft') {
      const matchId = opponentUuid(body.matchId);
      await assertSubjectRateLimit('opponents-write-user', user.id, { limit: 30, windowSeconds: 60 });
      await unlinkMatchDraft(teamId, user.id, matchId);
      return json({ ok: true, draft: null });
    }

    if (action === 'preview') {
      if (typeof body.url !== 'string' || body.url.length > 500) {
        throw Object.assign(new Error('Lien Drafter invalide.'), { status: 400, code: 'INVALID_DRAFTER_URL' });
      }
      await assertSubjectRateLimit('drafter-preview-user', user.id, { limit: 6, windowSeconds: 60 });
      await assertSubjectRateLimit('drafter-preview-team', teamId, { limit: 12, windowSeconds: 60 });
      const snapshot = await importDrafterDraft(body.url);
      // Recheck after external IO before disclosing the result to a removed member.
      await requireOpponentTeam(teamId, user.id, true);
      return json({ snapshot, previewToken: createDraftPreviewToken(snapshot, teamId, user.id) });
    }
    if (action === 'create-opponent') {
      const input = opponentInput(body.name, body.notes);
      await assertSubjectRateLimit('opponents-write-user', user.id, { limit: 30, windowSeconds: 60 });
      return json({ opponent: await createOpponent(teamId, user.id, input) });
    }
    const matchId = action === 'save-match-draft' ? opponentUuid(body.matchId) : null;
    // An obsolete opponentId in a draft request has no affiliation authority.
    const opponentId = action === 'save-match-draft' ? null : opponentUuid(body.opponentId);
    if (body.allySide !== 'blue' && body.allySide !== 'red') {
      throw Object.assign(new Error('Sélectionne le côté de ton équipe.'), { status: 400, code: 'INVALID_OPPONENT_INPUT' });
    }
    const snapshot = readDraftPreviewToken(body.previewToken, teamId, user.id);
    await assertSubjectRateLimit('opponents-write-user', user.id, { limit: 30, windowSeconds: 60 });
    if (matchId) return json({ draft: await saveMatchDraft(teamId, user.id, matchId, body.allySide, snapshot) });
    return json({ draft: await saveOpponentDraft(teamId, user.id, opponentId!, body.allySide, snapshot) });
  } catch (error) {
    return handleError(groupOpponentError(error));
  }
}
