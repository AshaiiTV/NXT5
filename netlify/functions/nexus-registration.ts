import type { Context } from "@netlify/functions";
import { assertSessionSecret, requireAuth } from "./_lib/auth";
import { assertMethod, handleError, json, readJson } from "./_lib/http";
import { assertRateLimit } from "./_lib/rate-limit";
import { assertMatchSourceMutationEnvironment } from "./_lib/match-source-environment";
import { sql } from "./_lib/db";
import { assertNexusSchema } from "./_lib/nexus-store";
import { nexusError } from "./_lib/nexus-domain";
import {
  managedTeams,
  registerTeam,
  seasonView,
  registrationView,
} from "./_lib/nexus-tournament-store";

export default async function handler(request: Request, context: Context) {
  try {
    assertMethod(request, request.method === "GET" ? "GET" : "POST");
    assertSessionSecret();
    const user = await requireAuth(request, context);
    await assertRateLimit(request, "nexus-registration", {
      limit: 30,
      windowSeconds: 60,
    });
    await assertNexusSchema();
    if (request.method === "GET") {
      const teams = await managedTeams(user.id);
      const [seasons, registrations] = await Promise.all([
        sql`select * from nexus_seasons where status <> 'draft' order by created_at desc limit 50`,
        sql`select r.*,t.name as team_name from nexus_registrations r join teams t on t.id=r.team_id where r.team_id=any(${teams.map((row) => row.id)}::uuid[]) order by r.created_at desc`,
      ]);
      return json({
        teams,
        seasons: seasons
          .map(seasonView)
          .map(({ tieResolutionNote, ...row }) => row),
        registrations: registrations.map(registrationView),
      });
    }
    assertMatchSourceMutationEnvironment(context);
    const body = await readJson(request, 4096);
    if (body.action !== "register")
      nexusError("Action d’inscription inconnue.");
    return json({ registration: await registerTeam(user.id, body) }, 201);
  } catch (err) {
    return handleError(err);
  }
}
