import { sql } from "./db";

export const NEXUS_TEAM_ENGAGED = "NEXUS_TEAM_ENGAGED";
const TEAM_MESSAGE =
  "Cette équipe est inscrite à une saison Nexus Rising en cours. Demande au staff de rejeter l’inscription ou de clôturer la saison, ou transfère l’équipe, avant de la supprimer.";
const ACCOUNT_MESSAGE =
  "Une équipe de ce compte est inscrite à une saison Nexus Rising en cours. Transfère-la ou fais clôturer la saison avant de supprimer le compte.";

/** Teams owned by `ownerId`, narrowed to one team when `teamId` is given. */
export type NexusTeamScope = { ownerId: string; teamId?: string };

// A pending or approved registration in a season that is not completed keeps the
// team's fixtures and its players' seats consistent for the whole league. Only
// teams the caller owns are inspected, so a stranger learns nothing.
function engagedCount(tx: any, scope: NexusTeamScope) {
  return tx`select count(*)::int as engaged from nexus_registrations r join nexus_seasons s on s.id=r.season_id
    where r.status<>'rejected' and s.status<>'completed'
      and r.team_id in (select id from teams where owner_id=${scope.ownerId} and (${scope.teamId ?? null}::uuid is null or id=${scope.teamId ?? null}::uuid))`;
}

export function nexusEngagementError(scope: NexusTeamScope) {
  return Object.assign(new Error(scope.teamId ? TEAM_MESSAGE : ACCOUNT_MESSAGE), {
    status: 409,
    code: NEXUS_TEAM_ENGAGED,
  });
}

/** Explain the refusal before the transaction; the in-transaction guard covers races. */
export async function assertNotEngagedInNexus(scope: NexusTeamScope): Promise<void> {
  const rows = await engagedCount(sql, scope);
  if (Number(rows[0]?.engaged || 0) > 0) throw nexusEngagementError(scope);
}

/** Same check under the row locks of the deleting transaction. A 22012 aborts it. */
export function nexusEngagementGuard(tx: any, scope: NexusTeamScope) {
  return tx`select 1/case when count(*)=0 then 1 else 0 end as nexus_free from nexus_registrations r join nexus_seasons s on s.id=r.season_id
    where r.status<>'rejected' and s.status<>'completed'
      and r.team_id in (select id from teams where owner_id=${scope.ownerId} and (${scope.teamId ?? null}::uuid is null or id=${scope.teamId ?? null}::uuid))`;
}
