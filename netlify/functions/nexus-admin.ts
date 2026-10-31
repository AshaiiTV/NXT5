import type { Context } from "@netlify/functions";
import { assertMethod, handleError, json, readJson } from "./_lib/http";
import { assertSessionSecret } from "./_lib/auth";
import { requirePlatformAdmin } from "./_lib/platform-admin";
import { sql } from "./_lib/db";
import { assertRateLimit } from "./_lib/rate-limit";
import { assertMatchSourceMutationEnvironment } from "./_lib/match-source-environment";
import { nexusError, nexusUuid } from "./_lib/nexus-domain";
import {
  assertNexusSchema,
  createNexusFixture,
  createNexusPairing,
  fixtureView,
  pairingView,
  revokeNexusPairing,
  reviewNexusSubmission,
  submissionView,
} from "./_lib/nexus-store";
import {
  createSeason,
  updateSeason,
  reviewRegistration,
  generateSchedule,
  scheduleFixture,
  seedPlayoffs,
  reviewTournamentSubmission,
  loadTournamentState,
  fixtureRosters,
} from "./_lib/nexus-tournament-store";
import {
  advanceSwissRound,
  createManualFixture,
} from "./_lib/nexus-extra-formats";

export default async function handler(request: Request, context: Context) {
  try {
    assertMethod(request, request.method === "GET" ? "GET" : "POST");
    assertSessionSecret();
    await requirePlatformAdmin(request, context);
    await assertRateLimit(request, "nexus-admin", {
      limit: 60,
      windowSeconds: 60,
    });
    await assertNexusSchema();
    if (request.method === "GET") {
      const fixtureId = new URL(request.url).searchParams.get("fixtureId");
      if (fixtureId) return json(await fixtureRosters(fixtureId));
      const submissionId = new URL(request.url).searchParams.get(
        "submissionId",
      );
      if (submissionId) {
        const rows =
          await sql`select s.*, p.uploader_riot_id from nexus_submissions s join nexus_import_pairings p on p.id = s.pairing_id where s.id = ${nexusUuid(submissionId)}`;
        if (!rows.length) nexusError("Contribution introuvable.", 404);
        return json({
          submission: { ...submissionView(rows[0]), payload: rows[0].payload },
        });
      }
      const [state, pairings, submissions, teams] = await Promise.all([
        loadTournamentState(),
        sql`select id, fixture_id, uploader_riot_id, expires_at, revoked_at, connected_at from nexus_import_pairings order by created_at desc limit 1000`,
        sql`select s.id,s.fixture_id,s.game_id,s.status,s.created_at,s.reviewed_at,s.source,p.uploader_riot_id from nexus_submissions s join nexus_import_pairings p on p.id=s.pairing_id order by s.created_at desc limit 1000`,
        sql`select id,name from teams order by name limit 2000`,
      ]);
      return json({
        seasons: state.seasons,
        registrations: state.registrations,
        fixtures: state.fixtures,
        standings: state.standings,
        playoffs: state.playoffs,
        pairings: pairings.map(pairingView),
        submissions: submissions.map(submissionView),
        teams,
      });
    }
    assertMatchSourceMutationEnvironment(context);
    const body = await readJson(request, 32_768);
    if (body.action === "createSeason")
      return json({ season: await createSeason(body) }, 201);
    if (body.action === "updateSeason")
      return json({ season: await updateSeason(body) });
    if (
      body.action === "approveRegistration" ||
      body.action === "rejectRegistration"
    )
      return json(
        await reviewRegistration({
          ...body,
          status:
            body.action === "approveRegistration" ? "approved" : "rejected",
        }),
      );
    if (body.action === "refreshRegistrationRoster")
      return json(
        await reviewRegistration({
          ...body,
          status: "approved",
          refreshRoster: true,
        }),
      );
    if (body.action === "generateSchedule")
      return json(await generateSchedule(body));
    if (body.action === "advanceSwissRound")
      return json(await advanceSwissRound(body));
    if (body.action === "createManualFixture")
      return json(await createManualFixture(body));
    if (body.action === "scheduleFixture")
      return json({ fixture: await scheduleFixture(body) });
    if (body.action === "seedPlayoffs") return json(await seedPlayoffs(body));
    if (body.action === "createFixture")
      return json({ fixture: await createNexusFixture(body) }, 201);
    if (body.action === "createPairing")
      return json(await createNexusPairing(body), 201);
    if (body.action === "revokePairing")
      return json(await revokeNexusPairing(body.pairingId));
    if (body.action === "review")
      return json({ submission: await reviewTournamentSubmission(body) });
    nexusError("Action Nexus inconnue.");
  } catch (err) {
    return handleError(err);
  }
}
