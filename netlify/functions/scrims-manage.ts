import type { Context } from "@netlify/functions";
import { assertMethod, handleError, json, readJson } from "./_lib/http";
import { assertSessionSecret, requireAuth } from "./_lib/auth";
import { assertRateLimit } from "./_lib/rate-limit";
import { ensureAuditLogsSchema } from "./_lib/schema";
import { acceptScrimRequest, cancelScrimOffer, createScrimOffer, declineScrimRequest, listScrims, respondToScrim, scrimError, withdrawScrimRequest } from "./_lib/scrims";

const ACTIONS: Record<string, (userId: string, body: any) => Promise<unknown>> = {
  create: createScrimOffer,
  cancel: cancelScrimOffer,
  respond: respondToScrim,
  withdraw: withdrawScrimRequest,
  accept: acceptScrimRequest,
  decline: declineScrimRequest,
};

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    assertMethod(request, request.method === "GET" ? "GET" : "POST");
    assertSessionSecret();
    const user = await requireAuth(request, context);
    if (request.method === "GET") {
      return json(await listScrims(user.id, new URL(request.url).searchParams.get("teamId")));
    }
    await assertRateLimit(request, "scrims", { limit: 30, windowSeconds: 60 });
    await ensureAuditLogsSchema();
    const body = await readJson(request, 8192);
    const run = ACTIONS[String(body.action || "")];
    if (!run) scrimError("Action de scrim inconnue.");
    return json(await run(user.id, body), body.action === "create" || body.action === "respond" ? 201 : 200);
  } catch (err) {
    return handleError(err);
  }
}
