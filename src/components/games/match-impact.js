const measuredDamage = (value) => Number.isFinite(value) && value >= 0;

/** Compare measured champion damage within a complete team; ties remain joint leaders. */
export function getTeamDamageLeaders(snapshot, teamKey) {
  const participants = Array.isArray(snapshot?.participants) ? snapshot.participants : [];
  const rows = participants.filter((row) => row?.teamKey === teamKey);
  const identities = new Map();
  for (const row of participants) {
    if (row?.participantId) identities.set(row.participantId, (identities.get(row.participantId) || 0) + 1);
  }
  const complete = ["ALLY", "ENEMY"].includes(teamKey) && rows.length === 5 && new Set(rows).size === 5
    && participants.every((row) => row && ["ALLY", "ENEMY"].includes(row.teamKey))
    && rows.every((row) => measuredDamage(row.damage) && (!row.participantId || identities.get(row.participantId) === 1));
  if (!complete) return { status: "incomplete", leaders: [], totalDamage: null };

  const totalDamage = rows.reduce((total, row) => total + row.damage, 0);
  if (!Number.isFinite(totalDamage)) return { status: "incomplete", leaders: [], totalDamage: null };
  if (totalDamage === 0) return { status: "zero", leaders: [], totalDamage };

  const highestDamage = Math.max(...rows.map((row) => row.damage));
  return {
    status: "ready",
    totalDamage,
    leaders: rows.filter((row) => row.damage === highestDamage).map((participant) => ({
      participant,
      share: participant.damage / totalDamage * 100,
    })),
  };
}
