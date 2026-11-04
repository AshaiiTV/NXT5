import type { Context } from "@netlify/functions";
import { assertMethod, handleError, json, readJson } from "./_lib/http";
import { assertRateLimit } from "./_lib/rate-limit";
import { assertMatchSourceMutationEnvironment } from "./_lib/match-source-environment";
import { connectTeamImport } from "./_lib/team-import";

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, "POST");
    assertMatchSourceMutationEnvironment(context);
    await assertRateLimit(request, "team-import-connect", { limit: 10, windowSeconds: 60 });
    const body = await readJson(request, 4096);
    return json(await connectTeamImport(body.code, body.label));
  } catch (err) {
    return handleError(err);
  }
}
