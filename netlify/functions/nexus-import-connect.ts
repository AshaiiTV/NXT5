import type { Context } from '@netlify/functions';
import { assertMethod, handleError, json, readJson } from './_lib/http';
import { assertRateLimit } from './_lib/rate-limit';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';
import { assertNexusSchema, connectNexus } from './_lib/nexus-store';

export default async function handler(request: Request, context: Context) {
  try {
    assertMethod(request, 'POST');
    assertMatchSourceMutationEnvironment(context);
    await assertRateLimit(request, 'nexus-connect', { limit: 10, windowSeconds: 60 });
    await assertNexusSchema();
    const body = await readJson(request, 4096);
    return json(await connectNexus(body.code));
  } catch (err) { return handleError(err); }
}
