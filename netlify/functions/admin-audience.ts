import type { Context } from '@netlify/functions';
import { assertMethod, json } from './_lib/http';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { assertAudienceReady, audienceFailure } from './_lib/audience';
import { audienceFilters, loadAudienceReport } from './_lib/audience-report';

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, 'GET');
    await requirePlatformAdmin(request, context);
    const filters = audienceFilters(request);
    await assertAudienceReady();
    return json(await loadAudienceReport(filters));
  } catch (err) { return audienceFailure(err); }
}
