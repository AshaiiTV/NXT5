import type { Context } from "@netlify/functions";
import { json, assertMethod, handleError } from './_lib/http';
import { assertSessionSecret, revokeSession } from './_lib/auth';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertSessionSecret();
    assertMethod(request, 'POST');
    await revokeSession(context, request);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
