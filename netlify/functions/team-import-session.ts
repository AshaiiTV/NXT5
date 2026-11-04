import { assertMethod, handleError, json } from "./_lib/http";
import { assertRateLimit } from "./_lib/rate-limit";
import { readTeamImportBearer, teamImportSession } from "./_lib/team-import";

export default async function handler(request: Request): Promise<Response> {
  try {
    assertMethod(request, "GET");
    const token = readTeamImportBearer(request);
    await assertRateLimit(request, "team-import-session", { limit: 120, windowSeconds: 60 });
    return json(await teamImportSession(token));
  } catch (err) {
    return handleError(err);
  }
}
