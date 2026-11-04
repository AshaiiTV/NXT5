import type { Context } from "@netlify/functions";
import { assertMethod, handleError, json, readJson } from "./_lib/http";
import { assertRateLimit } from "./_lib/rate-limit";
import { assertMatchSourceMutationEnvironment } from "./_lib/match-source-environment";
import { assertSessionSecret } from "./_lib/auth";
import { ensureAuditLogsSchema } from "./_lib/schema";
import { wakeDiscordPublications } from "./_lib/discord-wake";
import { withDiscordRuntime } from "./_lib/discord-runtime";
import { TEAM_IMPORT_MAX_BODY, readTeamImportBearer, submitTeamImport } from "./_lib/team-import";
import { notifyMatchImport } from "./_lib/match-notifications";
import { logFailure } from "./_lib/safe-log";

async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, "POST");
    assertMatchSourceMutationEnvironment(context);
    assertSessionSecret();
    const token = readTeamImportBearer(request);
    await assertRateLimit(request, "team-import-submit", { limit: 30, windowSeconds: 60 });
    await ensureAuditLogsSchema();
    const body = await readJson(request, TEAM_IMPORT_MAX_BODY);
    const result: any = await submitTeamImport(token, body, request.headers.get("idempotency-key") || "", request.signal);
    if (result.imported && result.inserted) {
      wakeDiscordPublications(context);
      const notification = notifyMatchImport({ siteUrl: process.env.PUBLIC_SITE_URL || new URL(request.url).origin, teamId: result.teamId, matchId: result.matchId, gameId: result.submission?.gameId || "" })
        .catch((error) => logFailure("[team-import] notification email failed after match persistence.", error));
      if (typeof (context as any).waitUntil === "function") (context as any).waitUntil(notification); else await notification;
    }
    return json(result, result.duplicate ? 200 : 201);
  } catch (err) {
    return handleError(err);
  }
}
export default withDiscordRuntime(handler);
