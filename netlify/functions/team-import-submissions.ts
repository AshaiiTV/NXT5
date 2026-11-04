import type { Context } from "@netlify/functions";
import { assertMethod, handleError, json, readJson } from "./_lib/http";
import { assertRateLimit } from "./_lib/rate-limit";
import { assertMatchSourceMutationEnvironment } from "./_lib/match-source-environment";
import { assertSessionSecret } from "./_lib/auth";
import { ensureAuditLogsSchema } from "./_lib/schema";
import { wakeDiscordPublications } from "./_lib/discord-wake";
import { withDiscordRuntime } from "./_lib/discord-runtime";
import { TEAM_IMPORT_MAX_BODY, readTeamImportBearer, submitTeamImport } from "./_lib/team-import";

async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, "POST");
    assertMatchSourceMutationEnvironment(context);
    assertSessionSecret();
    const token = readTeamImportBearer(request);
    await assertRateLimit(request, "team-import-submit", { limit: 30, windowSeconds: 60 });
    await ensureAuditLogsSchema();
    const body = await readJson(request, TEAM_IMPORT_MAX_BODY);
    const result = await submitTeamImport(token, body, request.headers.get("idempotency-key") || "", request.signal);
    if (result.imported && result.inserted) wakeDiscordPublications(context);
    return json(result, result.duplicate ? 200 : 201);
  } catch (err) {
    return handleError(err);
  }
}
export default withDiscordRuntime(handler);
