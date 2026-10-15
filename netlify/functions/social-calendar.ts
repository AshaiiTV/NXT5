import type { Context } from '@netlify/functions';
import { assertMethod, handleError, json } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { loadSocialCalendar } from './_lib/social-calendar';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    // The configured platform owner is the only NXT5 account allowed to read
    // these private editorial records. Never trust the browser's display flag.
    await requirePlatformAdmin(request, context);
    return json(await loadSocialCalendar());
  } catch (error) { return handleError(error); }
}
