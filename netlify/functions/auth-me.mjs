import { json, handleError } from './_lib/http.mjs';
import { requireAuth, safeUser } from './_lib/auth.mjs';

export default async function handler(request, context) {
  try {
    const user = await requireAuth(request, context);
    return json({ user: safeUser(user) });
  } catch (err) {
    return handleError(err);
  }
}
