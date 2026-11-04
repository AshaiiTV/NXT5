import type { Context } from "@netlify/functions";
import { assertMethod, handleError, json, readJson } from "./_lib/http";
import { assertSessionSecret, requireAuth } from "./_lib/auth";
import { assertRateLimit } from "./_lib/rate-limit";
import { ensureAuditLogsSchema } from "./_lib/schema";
import { createTeamImportCode, dismissTeamImport, importError, listTeamImport, pendingTeamImport, revokeTeamImportLink } from "./_lib/team-import";

const ACTIONS: Record<string, (userId: string, body: any) => Promise<unknown>> = {
  create: createTeamImportCode,
  revoke: revokeTeamImportLink,
  pending: pendingTeamImport,
  dismiss: dismissTeamImport,
};

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, request.method === "GET" ? "GET" : "POST");
    assertSessionSecret();
    const user = await requireAuth(request, context);
    if (request.method === "GET") return json(await listTeamImport(user.id, new URL(request.url).searchParams.get("teamId")));
    await assertRateLimit(request, "team-import-link", { limit: 20, windowSeconds: 60 });
    await ensureAuditLogsSchema();
    const body = await readJson(request, 8192);
    const run = ACTIONS[String(body.action || "")];
    if (!run) importError("Action de liaison inconnue.");
    return json(await run(user.id, body), body.action === "create" ? 201 : 200);
  } catch (err) {
    return handleError(err);
  }
}
