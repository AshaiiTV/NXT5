import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const db = vi.hoisted(() => ({
  pg: null as any,
  beforeBatch: null as null | (() => Promise<void>),
}));
const identity = vi.hoisted(() => ({ user: null as any, cookie: "" }));
vi.mock("../../netlify/functions/_lib/auth", () => ({
  readSessionCookie: () => identity.cookie,
  requireAuth: async () => {
    if (!identity.user)
      throw Object.assign(new Error("Expired"), { status: 401 });
    return identity.user;
  },
  isPlatformAdmin: (user: any) => user?.is_platform_admin === true,
  assertSessionSecret: () => {},
}));
vi.mock("../../netlify/functions/_lib/platform-admin", () => ({
  requirePlatformAdmin: async () => {
    if (!identity.user?.is_platform_admin)
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    return identity.user;
  },
}));
vi.mock("../../netlify/functions/_lib/rate-limit", () => ({
  assertRateLimit: async () => {},
  assertSubjectRateLimit: async () => {},
}));
vi.mock("../../netlify/functions/_lib/db", async () => {
  const { neon, neonConfig } = await import("@neondatabase/serverless");
  neonConfig.fetchFunction = async (_url, options: any) => {
    const body = JSON.parse(options.body);
    async function execute(connection: any, statement: any) {
      const result = await connection.query(statement.query, statement.params);
      return {
        fields: result.fields,
        rows: result.rows.map((row: any) =>
          result.fields.map((field: any) => {
            const value = row[field.name];
            if (value == null) return null;
            if ([114, 3802].includes(field.dataTypeID))
              return JSON.stringify(value);
            if (typeof value === "boolean") return value ? "t" : "f";
            if (value instanceof Date)
              return value
                .toISOString()
                .replace("T", " ")
                .replace("Z", field.dataTypeID === 1184 ? "+00" : "");
            return String(value);
          }),
        ),
        rowCount: result.affectedRows ?? result.rows.length,
      };
    }
    try {
      if (body.queries) {
        const mutate = db.beforeBatch;
        db.beforeBatch = null;
        await mutate?.();
        const results = await db.pg.transaction(async (tx: any) => {
          const results = [];
          for (const query of body.queries)
            results.push(await execute(tx, query));
          return results;
        });
        return new Response(JSON.stringify({ results }));
      }
      return new Response(JSON.stringify(await execute(db.pg, body)));
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          message: err.message,
          code: err.code,
          constraint: err.constraint,
        }),
        { status: 400 },
      );
    }
  };
  return { sql: neon("postgresql://test:test@local-test.invalid/nexus") };
});

import {
  nexusHash,
  normalizeFixture,
  validateSubmission,
} from "../../netlify/functions/_lib/nexus-domain";
import {
  assertNexusSchema,
  connectNexus,
  createNexusPairing,
  readImportAuthorization,
  revokeNexusPairing,
  reviewNexusSubmission,
  saveNexusSubmission,
} from "../../netlify/functions/_lib/nexus-store";
import overviewHandler, {
  nexusOverview,
} from "../../netlify/functions/nexus-overview";
import adminHandler from "../../netlify/functions/nexus-admin";
import sessionHandler from "../../netlify/functions/nexus-import-session";
import submissionHandler from "../../netlify/functions/nexus-import-submissions";
import registrationHandler from "../../netlify/functions/nexus-registration";
import {
  createSeason,
  updateSeason,
  registerTeam,
  reviewRegistration,
  generateSchedule,
  scheduleFixture,
  loadTournamentState,
  mutateSeason,
} from "../../netlify/functions/_lib/nexus-tournament-store";

const roster = Array.from({ length: 10 }, (_, i) => `Player ${i + 1}#EUW`);
const start = Date.now() - 3_600_000;
const fixtureInput = () => ({
  label: "Saison I · journée 1",
  teamA: "Alpha",
  teamB: "Beta",
  platform: "EUW1",
  startsAt: new Date(start - 60_000).toISOString(),
  endsAt: new Date(start + 3_600_000).toISOString(),
  roster,
});
// Seed a validated native fixture directly. Production creation now goes through
// registration, generation and native player selection (covered by flow tests).
async function createNexusFixture(input: any) {
  const normalized = normalizeFixture(input);
  const ids = [normalized.teamAId, normalized.teamBId];
  for (let i = 0; i < 2; i++) {
    if (ids[i]) {
      if (
        !(await db.pg.query("select id from teams where id=$1", [ids[i]])).rows
          .length
      )
        throw new Error("Équipe introuvable");
    } else {
      ids[i] = randomUUID();
      await db.pg.query("insert into teams(id,name) values($1,$2)", [
        ids[i],
        i ? "Beta" : "Alpha",
      ]);
    }
  }
  const seasonId = randomUUID();
  const id = randomUUID();
  await db.pg.query(
    "insert into nexus_seasons(id,name,status,rules_confirmed,schedule_generated) values($1,'Intake test','running',true,true)",
    [seasonId],
  );
  for (const teamId of ids)
    await db.pg.query(
      "insert into nexus_registrations(season_id,team_id,status) values($1,$2,'approved')",
      [seasonId, teamId],
    );
  await db.pg.query(
    "insert into nexus_fixtures(id,season_id,stage,fixture_key,label,team_a,team_b,team_a_id,team_b_id,platform,starts_at,ends_at,roster) values($1,$2,'regular','test',$3,$4,$5,$6,$7,'EUW1',$8,$9,$10::jsonb)",
    [
      id,
      seasonId,
      input.label,
      input.teamA,
      input.teamB,
      ...ids,
      input.startsAt,
      input.endsAt,
      JSON.stringify(input.roster),
    ],
  );
  return { id, ...normalized, teamAId: ids[0], teamBId: ids[1], seasonId };
}
const payload = (game = "EUW1_123456") => ({
  source: "lcu-match-history",
  timeline: null,
  match: {
    metadata: { matchId: game },
    info: {
      gameType: "CUSTOM_GAME",
      queueId: 0,
      mapId: 11,
      gameCreation: start,
      gameDuration: 1800,
      teams: [
        { teamId: 100, win: true },
        { teamId: 200, win: false },
      ],
      participants: roster.map((id, index) => ({
        participantId: index + 1,
        teamId: index < 5 ? 100 : 200,
        championId: index + 1,
        championName: `Champion${index + 1}`,
        riotIdGameName: id.split("#")[0],
        riotIdTagline: "EUW",
        kills: 1,
        deaths: 1,
        assists: 1,
        goldEarned: null,
      })),
    },
  },
});
async function bound(uploader = roster[0], fixture?: any) {
  fixture ||= await createNexusFixture(fixtureInput());
  const pairing = await createNexusPairing({
    fixtureId: fixture.id,
    uploaderRiotId: uploader,
  });
  const connection = await connectNexus(pairing.code);
  return {
    fixture,
    pairing: pairing.pairing,
    code: pairing.code,
    ...connection,
  };
}
const body = (connection: any, data = payload()) => ({
  fixtureId: connection.fixture.id,
  payload: data,
});
async function stored() {
  return (
    await db.pg.query("select * from nexus_submissions order by created_at")
  ).rows;
}

beforeAll(async () => {
  db.pg = new PGlite();
  await db.pg.exec(
    "create table users(id uuid primary key);create table teams (id uuid primary key, name text, owner_id uuid); create table team_members (team_id uuid, user_id uuid,role text);create table players(id uuid primary key,team_id uuid,name text,riot_id text,role text,roster_status text); create table app_schema_migrations (migration_key text primary key);",
  );
  await db.pg.exec(
    readFileSync(
      new URL(
        "../../database/migrations/20261031_nexus_import.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.pg.exec(
    readFileSync(
      new URL(
        "../../database/migrations/20261101_nexus_tournament.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.pg.exec(
    "insert into app_schema_migrations values ('nexus-tournament-20261101-v1')",
  );
}, 20_000);
beforeEach(async () => {
  db.beforeBatch = null;
  identity.user = null;
  identity.cookie = "";
  for (const key of ["AWS_LAMBDA_FUNCTION_NAME", "LAMBDA_TASK_ROOT", "SITE_ID"])
    vi.stubEnv(key, "");
  await db.pg.exec(
    "truncate nexus_seasons cascade; truncate teams cascade; truncate team_members;truncate players cascade;truncate users cascade;",
  );
});
afterAll(async () => {
  await db.pg.close();
});

describe("Nexus independent captain intake", () => {
  it("has a dedicated migration marker and never stores pairing or bearer secrets", async () => {
    await assertNexusSchema();
    const connected = await bound();
    const row = (await db.pg.query("select * from nexus_import_pairings"))
      .rows[0];
    expect(row.token_hash).toBe(nexusHash(connected.token));
    expect(row.code_hash).toBeNull();
    expect(JSON.stringify(row)).not.toContain(connected.token);
    expect(connected.binding).toMatchObject({
      competitionId: "nexus-rising",
      fixtureId: connected.fixture.id,
      roster,
      platform: "EUW1",
    });
  });
  it("consumes a pairing code once, including simultaneous connects", async () => {
    const fixture = await createNexusFixture(fixtureInput());
    const pairing = await createNexusPairing({
      fixtureId: fixture.id,
      uploaderRiotId: roster[0],
    });
    const result = await Promise.allSettled([
      connectNexus(pairing.code),
      connectNexus(pairing.code),
    ]);
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(result.filter((item) => item.status === "rejected")).toHaveLength(1);
  });
  it("blocks expired and revoked codes without allocating a token", async () => {
    const fixture = await createNexusFixture(fixtureInput());
    const pairing = await createNexusPairing({
      fixtureId: fixture.id,
      uploaderRiotId: roster[0],
    });
    await db.pg.query(
      "update nexus_import_pairings set code_expires_at=now()-interval '1 second'",
    );
    await expect(connectNexus(pairing.code)).rejects.toMatchObject({
      status: 401,
    });
    const second = await createNexusPairing({
      fixtureId: fixture.id,
      uploaderRiotId: roster[0],
    });
    await revokeNexusPairing(second.pairing.id);
    await expect(connectNexus(second.code)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("deduplicates retries after an interrupted response and simultaneous sends", async () => {
    const c = await bound();
    const results = await Promise.all([
      saveNexusSubmission(c.token, body(c), "same-game"),
      saveNexusSubmission(c.token, body(c), "same-game"),
    ]);
    expect(results.every((row) => row.accepted)).toBe(true);
    expect(results.map((row) => row.duplicate).sort()).toEqual([false, true]);
    expect(await stored()).toHaveLength(1);
    expect(
      await saveNexusSubmission(c.token, body(c), "same-game"),
    ).toMatchObject({
      accepted: true,
      duplicate: true,
      status: "pending_review",
    });
  });
  it("does not overwrite conflicting retries or reuse an idempotency key for another game", async () => {
    const c = await bound();
    await saveNexusSubmission(c.token, body(c), "game-key");
    const changed = payload();
    changed.match.info.participants[0].kills = 9;
    await expect(
      saveNexusSubmission(c.token, body(c, changed), "game-key"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveNexusSubmission(c.token, body(c, payload("EUW1_9876")), "game-key"),
    ).rejects.toMatchObject({ status: 409 });
    expect((await stored())[0].payload.match.info.participants[0].kills).toBe(
      1,
    );
    expect(await stored()).toHaveLength(1);
  });
  it("stores two captain contributions separately and approves one public source", async () => {
    const a = await bound();
    const b = await bound(roster[5], a.fixture);
    const one = await saveNexusSubmission(a.token, body(a), "a");
    const two = await saveNexusSubmission(b.token, body(b), "b");
    expect(await stored()).toHaveLength(2);
    await reviewNexusSubmission({
      submissionId: one.submissionId,
      status: "accepted",
    });
    await expect(
      reviewNexusSubmission({
        submissionId: two.submissionId,
        status: "accepted",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await stored()).filter((row: any) => row.status === "accepted"),
    ).toHaveLength(1);
  });
  it("rejects an authorization revoked after data validation and rolls back the batch", async () => {
    const c = await bound();
    db.beforeBatch = () =>
      db.pg.query(
        "update nexus_import_pairings set revoked_at=now() where id=$1",
        [c.pairing.id],
      );
    await expect(
      saveNexusSubmission(c.token, body(c), "revoked"),
    ).rejects.toMatchObject({ status: 401 });
    expect(await stored()).toHaveLength(0);
    await expect(readImportAuthorization(c.token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("rejects a token expiring while payload processing runs", async () => {
    const c = await bound();
    db.beforeBatch = () =>
      db.pg.query(
        "update nexus_import_pairings set expires_at=now()-interval '1 second' where id=$1",
        [c.pairing.id],
      );
    await expect(
      saveNexusSubmission(c.token, body(c), "expired"),
    ).rejects.toMatchObject({ status: 401 });
    expect(await stored()).toHaveLength(0);
  });
  it("does not let a token target another fixture", async () => {
    const a = await bound();
    const b = await bound();
    await expect(
      saveNexusSubmission(a.token, body(b), "foreign"),
    ).rejects.toMatchObject({ status: 403 });
    expect(await stored()).toHaveLength(0);
  });
  it("caps stored games and still acknowledges retries at quota", async () => {
    const c = await bound();
    for (let i = 0; i < 20; i++)
      await saveNexusSubmission(
        c.token,
        body(c, payload(`EUW1_${1000 + i}`)),
        `game-${i}`,
      );
    await expect(
      saveNexusSubmission(c.token, body(c, payload("EUW1_9999")), "over-quota"),
    ).rejects.toMatchObject({ status: 429 });
    expect(
      await saveNexusSubmission(
        c.token,
        body(c, payload("EUW1_1000")),
        "game-0",
      ),
    ).toMatchObject({ duplicate: true });
    expect(await stored()).toHaveLength(20);
  });
});

describe("Nexus match validation and private/public views", () => {
  const fixture = () => ({
    ...fixtureInput(),
    starts_at: fixtureInput().startsAt,
    ends_at: fixtureInput().endsAt,
    roster,
  });
  it("orders games by match time and withholds game numbers when chronology is missing or tied", () => {
    const f = { ...fixture(), id: "fixture" };
    const captured = (id: string, time?: number) => ({
      fixture_id: f.id,
      game_id: id,
      status: "accepted",
      summary: { winner: "A", duration: 1800, gameStartedAt: time },
    });
    const rows = [
      captured("EUW1_100", start + 3600000),
      captured("EUW1_200", start),
    ];
    const ordered = nexusOverview([f], rows, new Set())[0].games;
    expect(ordered.map((row: any) => [row.gameId, row.gameNumber])).toEqual([
      ["EUW1_200", 1],
      ["EUW1_100", 2],
    ]);
    for (const extra of [captured("EUW1_300"), captured("EUW1_300", start)]) {
      const ambiguous = nexusOverview([f], [...rows, extra], new Set())[0]
        .games;
      expect(
        ambiguous.every((row: any) => !Object.hasOwn(row, "gameNumber")),
      ).toBe(true);
    }
  });
  it("keeps missing statistics missing, while accepting a genuine measured zero", () => {
    const data = payload();
    data.match.info.participants[0].kills = 0;
    const result = validateSubmission(data, fixture());
    expect(result.payload.match.info.participants[0].kills).toBe(0);
    expect(result.payload.match.info.participants[0].goldEarned).toBeNull();
    expect(result.payload.match.info.participants[0]).not.toHaveProperty(
      "visionScore",
    );
  });
  it("accepts EOG with a real end timestamp without inventing gameCreation", () => {
    const data: any = payload();
    data.source = "lcu-end-of-game";
    delete data.match.info.gameCreation;
    data.match.info.gameEndTimestamp = start + 1_800_000;
    expect(validateSubmission(data, fixture()).gameId).toBe("EUW1_123456");
    delete data.match.info.gameEndTimestamp;
    expect(() => validateSubmission(data, fixture())).toThrow("Horaires");
  });
  it.each([
    [
      "ranked",
      (p: any) => {
        p.match.info.queueId = 420;
      },
    ],
    [
      "other platform",
      (p: any) => {
        p.match.metadata.matchId = "NA1_123";
      },
    ],
    [
      "incomplete tag",
      (p: any) => {
        delete p.match.info.participants[0].riotIdTagline;
      },
    ],
    [
      "outsider",
      (p: any) => {
        p.match.info.participants[0].riotIdGameName = "Other";
      },
    ],
    [
      "wrong sides",
      (p: any) => {
        p.match.info.participants[0].teamId = 200;
        p.match.info.participants[5].teamId = 100;
      },
    ],
    [
      "duplicate player",
      (p: any) => {
        p.match.info.participants[1].riotIdGameName = "Player 1";
      },
    ],
    [
      "unknown result",
      (p: any) => {
        p.match.info.teams[0].win = false;
      },
    ],
    [
      "outside window",
      (p: any) => {
        p.match.info.gameCreation = start - 3_600_000;
      },
    ],
    [
      "negative stats",
      (p: any) => {
        p.match.info.participants[0].kills = -1;
      },
    ],
    [
      "foreign timeline",
      (p: any) => {
        p.timeline = { metadata: { matchId: "EUW1_999" } };
      },
    ],
  ])("rejects %s", (_name, change) => {
    const data = payload();
    change(data);
    expect(() => validateSubmission(data, fixture())).toThrow();
  });
  it("permits swapping blue/red between games while preserving the two rosters", () => {
    const data = payload();
    for (const player of data.match.info.participants)
      player.teamId = player.teamId === 100 ? 200 : 100;
    expect(validateSubmission(data, fixture()).gameId).toBe("EUW1_123456");
  });
  it("rejects a guessed NXT team mapping and duplicate roster identities", async () => {
    await expect(
      createNexusFixture({
        ...fixtureInput(),
        teamAId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow("introuvable");
    expect(() =>
      normalizeFixture({
        ...fixtureInput(),
        roster: roster.map(() => roster[0]),
      }),
    ).toThrow("distincts");
  });
  it("only exposes approved results to guests and approved stats to linked team members", () => {
    const f = {
      ...fixture(),
      id: "fixture",
      team_a: "Alpha",
      team_b: "Beta",
      team_a_id: "team-a",
      team_b_id: "team-b",
    };
    const accepted: any = {
      fixture_id: "fixture",
      game_id: "EUW1_123456",
      status: "accepted",
      payload: payload(),
      summary: validateSubmission(payload(), fixture()).summary,
      created_at: "now",
    };
    accepted.payload.match.secret = "private-staff-note";
    const pending = {
      ...accepted,
      status: "pending_review",
      game_id: "EUW1_99",
    };
    const guest = nexusOverview([f], [accepted, pending], new Set())[0];
    expect(guest.games).toHaveLength(1);
    expect(guest.canViewDetails).toBe(false);
    expect(guest).not.toHaveProperty("roster");
    expect(guest).not.toHaveProperty("statistics");
    expect(
      nexusOverview([f], [accepted], new Set(["other-team"]))[0].canViewDetails,
    ).toBe(false);
    const member = nexusOverview(
      [f],
      [accepted, pending],
      new Set(["team-a"]),
    )[0];
    expect(member.statistics).toHaveLength(1);
    expect(member.roster).toEqual(roster);
    expect(JSON.stringify(member)).not.toContain("private-staff-note");
    expect(member).not.toHaveProperty("payload");
    expect(
      nexusOverview([f], [accepted], new Set(), true)[0].canViewDetails,
    ).toBe(true);
  });
});

describe("Nexus HTTP authorization and disclosure", () => {
  const context = {} as any;
  const request = (
    name: string,
    body?: any,
    headers: Record<string, string> = {},
  ) =>
    new Request(
      `https://nxt5.org/.netlify/functions/${name}`,
      body === undefined
        ? { headers }
        : {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: JSON.stringify(body),
          },
    );
  it("allows guest consultation and refuses captain/admin endpoints without their distinct credentials", async () => {
    await createNexusFixture(fixtureInput());
    const publicView = await overviewHandler(
      request("nexus-overview"),
      context,
    );
    expect(publicView.status).toBe(200);
    expect(await publicView.json()).toMatchObject({
      access: "guest",
      fixtures: [{ canViewDetails: false }],
    });
    expect((await adminHandler(request("nexus-admin"), context)).status).toBe(
      403,
    );
    expect((await sessionHandler(request("nexus-import-session"))).status).toBe(
      401,
    );
    expect(
      (
        await submissionHandler(
          request("nexus-import-submissions", {}),
          context,
        )
      ).status,
    ).toBe(401);
  });
  it("does not disclose staff tie-resolution notes through the registration endpoint", async () => {
    await createNexusFixture(fixtureInput());
    await db.pg.exec(
      "update nexus_seasons set tie_resolution_note='Private staff deliberation'",
    );
    identity.user = { id: randomUUID() };
    const response = await registrationHandler(
      request("nexus-registration"),
      context,
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.seasons).toHaveLength(1);
    expect(data.seasons[0]).not.toHaveProperty("tieResolutionNote");
    expect(JSON.stringify(data)).not.toContain("Private staff deliberation");
  });
  it("requires both an NXT account and active membership in a mapped Nexus team for detailed data", async () => {
    const teamId = "00000000-0000-4000-8000-000000000021";
    const userId = "00000000-0000-4000-8000-000000000022";
    await db.pg.query("insert into teams(id,name) values ($1,$2)", [
      teamId,
      "Alpha NXT",
    ]);
    const fixture = await createNexusFixture({
      ...fixtureInput(),
      teamAId: teamId,
    });
    const c = await bound(roster[0], fixture);
    const submission = await saveNexusSubmission(c.token, body(c), "accepted");
    await reviewNexusSubmission({
      submissionId: submission.submissionId,
      status: "accepted",
    });
    identity.cookie = "valid-nxt";
    identity.user = { id: userId };
    let response = await (
      await overviewHandler(request("nexus-overview"), context)
    ).json();
    expect(response.access).toBe("guest");
    expect(response.fixtures[0]).not.toHaveProperty("statistics");
    await db.pg.query("insert into team_members values ($1,$2,'player')", [
      teamId,
      userId,
    ]);
    response = await (
      await overviewHandler(request("nexus-overview"), context)
    ).json();
    expect(response.access).toBe("member");
    expect(response.fixtures[0].statistics[0].participants).toHaveLength(10);
    expect(JSON.stringify(response)).not.toContain("token_hash");
    await db.pg.query("delete from team_members where user_id=$1", [userId]);
    response = await (
      await overviewHandler(request("nexus-overview"), context)
    ).json();
    expect(response.fixtures[0]).not.toHaveProperty("statistics");
    identity.user = null;
    expect(
      (await overviewHandler(request("nexus-overview"), context)).status,
    ).toBe(200);
  });
  it("keeps pending captures out of the guest response, but accessible to staff with explicit admin auth", async () => {
    const c = await bound();
    const submission = await saveNexusSubmission(c.token, body(c), "pending");
    const guest = await (
      await overviewHandler(request("nexus-overview"), context)
    ).json();
    expect(guest.fixtures[0].games).toEqual([]);
    identity.cookie = "admin-nxt";
    identity.user = {
      id: "00000000-0000-4000-8000-000000000099",
      is_platform_admin: true,
    };
    const admin = await (
      await adminHandler(request("nexus-admin"), context)
    ).json();
    expect(admin.submissions[0]).toMatchObject({
      id: submission.submissionId,
      status: "pending_review",
    });
    expect(JSON.stringify(admin)).not.toContain("token_hash");
    expect(JSON.stringify(admin)).not.toContain(c.token);
    const detail = await (
      await adminHandler(
        request(`nexus-admin?submissionId=${submission.submissionId}`),
        context,
      )
    ).json();
    expect(detail.submission.payload.match.metadata.matchId).toBe(
      "EUW1_123456",
    );
  });
  it("rejects browser cross-site mutations before accepting a bearer payload", async () => {
    const c = await bound();
    const result = await submissionHandler(
      request("nexus-import-submissions", body(c), {
        authorization: `Bearer ${c.token}`,
        "idempotency-key": "cross-site",
        origin: "https://untrusted.example",
        "sec-fetch-site": "cross-site",
      }),
      context,
    );
    expect(result.status).toBe(403);
    expect(await stored()).toHaveLength(0);
  });
});

describe("Nexus native roster enrollment security", () => {
  async function season() {
    const row = await createSeason({
      name: "Native season",
      legs: 1,
      regularBestOf: 1,
      playoffSize: 4,
      playoffBestOf: 3,
      playoffEnabled: false,
      rulesConfirmed: true,
    });
    await updateSeason({ seasonId: row.id, status: "open" });
    return row;
  }
  async function nativeTeam(prefix = "Team") {
    const ownerId = randomUUID(),
      id = randomUUID();
    await db.pg.query("insert into users(id) values($1)", [ownerId]);
    await db.pg.query("insert into teams(id,name,owner_id) values($1,$2,$3)", [
      id,
      prefix,
      ownerId,
    ]);
    const players = [];
    for (let i = 0; i < 5; i++) {
      const playerId = randomUUID();
      const riotId = `${prefix}${i}#EUW`;
      await db.pg.query(
        "insert into players(id,team_id,name,riot_id,role,roster_status) values($1,$2,$3,$4,$5,'MAIN')",
        [
          playerId,
          id,
          `${prefix}${i}`,
          riotId,
          ["TOP", "JGL", "MID", "ADC", "SUP"][i],
        ],
      );
      players.push({ id: playerId, riotId });
    }
    return { id, ownerId, players };
  }
  it("uses direct elimination configuration before unused secondary playoff settings", async () => {
    const base = {
      name: "Format",
      legs: 1,
      regularBestOf: 1,
      playoffBestOf: 3,
      rulesConfirmed: true,
    };
    await expect(
      createSeason({
        ...base,
        format: "single_elimination",
        playoffFormat: "double_elimination",
        playoffSize: 2,
      }),
    ).resolves.toMatchObject({ format: "single_elimination", playoffSize: 2 });
    await expect(
      createSeason({
        ...base,
        format: "single_elimination",
        playoffFormat: "double_elimination",
        doubleVariant: "nexus_site",
        playoffSize: 6,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      createSeason({
        ...base,
        format: "round_robin",
        playoffEnabled: false,
        playoffFormat: "double_elimination",
        playoffSize: 2,
      }),
    ).resolves.toMatchObject({ playoffEnabled: false });
  });
  it("ignores qualification settings when generating groups without playoffs", async () => {
    const s = await createSeason({
      name: "Groups only",
      format: "groups",
      legs: 1,
      regularBestOf: 1,
      playoffBestOf: 3,
      playoffSize: 2,
      playoffEnabled: false,
      groupCount: 2,
      advancePerGroup: 8,
      rulesConfirmed: true,
    });
    await updateSeason({ seasonId: s.id, status: "open" });
    for (let i = 0; i < 4; i++) {
      const team = await nativeTeam(`Group${i}`);
      const registration = await registerTeam(team.ownerId, {
        seasonId: s.id,
        teamId: team.id,
      });
      await reviewRegistration({
        registrationId: registration.id,
        status: "approved",
      });
    }
    const result = await generateSchedule({ seasonId: s.id });
    expect(result.fixtures).toHaveLength(2);
    expect(new Set(result.fixtures.map((row: any) => row.groupId)).size).toBe(
      2,
    );
  });
  it("refuses writing tournament decisions from a snapshot superseded by another staff action", async () => {
    const s = await season();
    const state = await loadTournamentState();
    const snapshot = state.rawSeasons.find((row) => row.id === s.id)!;
    await updateSeason({
      seasonId: s.id,
      name: "Changed by another staff member",
    });
    await expect(
      mutateSeason(snapshot, (tx) => [
        tx`update nexus_seasons set name='Stale overwrite' where id=${s.id}`,
      ]),
    ).rejects.toMatchObject({ status: 409, code: "NEXUS_STALE_SEASON" });
    expect(
      (await db.pg.query("select name from nexus_seasons where id=$1", [s.id]))
        .rows[0].name,
    ).toBe("Changed by another staff member");
  });
  it("refuses registering somebody else’s team and ignores client-supplied roster replacements", async () => {
    const s = await season(),
      team = await nativeTeam();
    await expect(
      registerTeam(randomUUID(), { seasonId: s.id, teamId: team.id }),
    ).rejects.toMatchObject({ status: 403 });
    const registration = await registerTeam(team.ownerId, {
      seasonId: s.id,
      teamId: team.id,
      roster: ["Forged#EUW"],
    });
    expect([...registration.rosterRiotIds].sort()).toEqual(
      team.players.map((row) => row.riotId).sort(),
    );
  });
  it("rechecks captain permissions in the inscription transaction", async () => {
    const s = await season(),
      team = await nativeTeam();
    const captain = randomUUID();
    await db.pg.query("insert into users values($1)", [captain]);
    await db.pg.query("insert into team_members values($1,$2,'captain')", [
      team.id,
      captain,
    ]);
    db.beforeBatch = () =>
      db.pg.query("delete from team_members where user_id=$1", [captain]);
    await expect(
      registerTeam(captain, { seasonId: s.id, teamId: team.id }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await db.pg.query("select * from nexus_registrations")).rows,
    ).toHaveLength(0);
  });
  it("deduplicates simultaneous native inscriptions", async () => {
    const s = await season(),
      team = await nativeTeam();
    const [a, b] = await Promise.all([
      registerTeam(team.ownerId, { seasonId: s.id, teamId: team.id }),
      registerTeam(team.ownerId, { seasonId: s.id, teamId: team.id }),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      (await db.pg.query("select * from nexus_registrations")).rows,
    ).toHaveLength(1);
  });
  it("keeps a Riot account reserved to its approved season team even after an approved roster refresh", async () => {
    const s = await season(),
      a = await nativeTeam("Alpha"),
      b = await nativeTeam("Beta");
    await db.pg.query("update players set riot_id=$1 where id=$2", [
      a.players[0].riotId,
      b.players[0].id,
    ]);
    const ra = await registerTeam(a.ownerId, { seasonId: s.id, teamId: a.id });
    const rb = await registerTeam(b.ownerId, { seasonId: s.id, teamId: b.id });
    await reviewRegistration({ registrationId: ra.id, status: "approved" });
    await expect(
      reviewRegistration({ registrationId: rb.id, status: "approved" }),
    ).rejects.toMatchObject({ status: 409 });
    await db.pg.query("update players set riot_id=$1 where id=$2", [
      "NewAccount#EUW",
      a.players[0].id,
    ]);
    await reviewRegistration({
      registrationId: ra.id,
      status: "approved",
      refreshRoster: true,
    });
    await expect(
      reviewRegistration({ registrationId: rb.id, status: "approved" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects foreign native players and locks the selected snapshot after issuing an importer code", async () => {
    const s = await season(),
      a = await nativeTeam("Alpha"),
      b = await nativeTeam("Beta");
    for (const team of [a, b]) {
      const r = await registerTeam(team.ownerId, {
        seasonId: s.id,
        teamId: team.id,
      });
      await reviewRegistration({ registrationId: r.id, status: "approved" });
    }
    const generated = await generateSchedule({ seasonId: s.id });
    const fixture = generated.fixtures[0];
    const ta = fixture.teamAId === a.id ? a : b,
      tb = fixture.teamBId === b.id ? b : a;
    const input = {
      fixtureId: fixture.id,
      startsAt: fixtureInput().startsAt,
      endsAt: fixtureInput().endsAt,
      playerIdsA: ta.players.map((row) => row.id),
      playerIdsB: tb.players.map((row) => row.id),
    };
    await expect(
      scheduleFixture({
        ...input,
        playerIdsA: tb.players.map((row) => row.id),
      }),
    ).rejects.toMatchObject({ status: 400 });
    const ready = await scheduleFixture(input);
    await createNexusPairing({
      fixtureId: ready.id,
      uploaderRiotId: ready.roster[0],
    });
    await expect(scheduleFixture(input)).rejects.toMatchObject({ status: 409 });
    const saved = (
      await db.pg.query("select roster from nexus_fixtures where id=$1", [
        ready.id,
      ])
    ).rows[0].roster;
    await db.pg.query("update players set riot_id=$1 where id=$2", [
      "ChangedLater#EUW",
      ta.players[0].id,
    ]);
    expect(
      (
        await db.pg.query("select roster from nexus_fixtures where id=$1", [
          ready.id,
        ])
      ).rows[0].roster,
    ).toEqual(saved);
  });
});
