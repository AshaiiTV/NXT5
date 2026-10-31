import { assertMethod, handleError, json } from './_lib/http';
import { assertRateLimit, assertSubjectRateLimit } from './_lib/rate-limit';
import { assertNexusSchema, bindingView, readImportAuthorization, readNexusBearer } from './_lib/nexus-store';

export default async function handler(request: Request) {
  try {
    assertMethod(request, 'GET');
    const token = readNexusBearer(request);
    await assertRateLimit(request, 'nexus-session', { limit: 120, windowSeconds: 60 });
    await assertNexusSchema();
    const { pairing, fixture } = await readImportAuthorization(token);
    await assertSubjectRateLimit('nexus-session', pairing.id, { limit: 60, windowSeconds: 60 });
    return json({ valid: true, binding: bindingView(pairing, fixture), schemaVersion: 1 });
  } catch (err) { return handleError(err); }
}
