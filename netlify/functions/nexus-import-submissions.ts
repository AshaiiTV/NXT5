import type { Context } from '@netlify/functions';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';
import { NEXUS_MAX_BODY } from './_lib/nexus-domain';
import { assertNexusSchema, readImportAuthorization, readNexusBearer, saveNexusSubmission } from './_lib/nexus-store';

export default async function handler(request: Request, context: Context) {
  try {
    assertMethod(request, 'POST');
    assertMatchSourceMutationEnvironment(context);
    const token = readNexusBearer(request);
    await assertRateLimit(request, 'nexus-submit', { limit: 30, windowSeconds: 60 });
    await assertNexusSchema();
    const { pairing } = await readImportAuthorization(token);
    await assertSubjectRateLimit('nexus-submit', pairing.id, { limit: 12, windowSeconds: 60 });
    const body = await readJson(request, NEXUS_MAX_BODY);
    const result = await saveNexusSubmission(token, body, request.headers.get('idempotency-key') || '');
    return json(result, result.duplicate ? 200 : 201);
  } catch (err) { return handleError(err); }
}
