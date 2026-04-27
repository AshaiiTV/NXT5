import { json, handleError } from './_lib/http.mjs';
import { requireAuth } from './_lib/auth.mjs';
import { isRiotConfigured } from './_lib/riot.mjs';

export default async function handler(request, context) {
  try {
    await requireAuth(request, context);

    return json({
      configured: isRiotConfigured(),
      services: {
        account: 'Account-V1',
        match: 'Match-V5',
        championMastery: 'Champion-Mastery-V4',
        dataDragon: 'Data Dragon'
      }
    });
  } catch (err) {
    return handleError(err);
  }
}
