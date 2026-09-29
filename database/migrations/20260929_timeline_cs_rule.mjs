// Immutable rule 2 snapshot: keep aligned with the shared rule at creation time.
// A milestone must be observed within five seconds after its target minute.
export const MILESTONE_TOLERANCE_MS = 5000;

export function csFromTimelineFrames(frames, participantId, minute) {
  const target = Number(minute) * 60000;
  const frame = frames.find(item => Number(item.timestamp) >= target && Number(item.timestamp) <= target + MILESTONE_TOLERANCE_MS);
  const participant = frame?.participantFrames?.[String(participantId)];
  return Number.isFinite(participant?.minionsKilled) && Number.isFinite(participant?.jungleMinionsKilled)
    ? participant.minionsKilled + participant.jungleMinionsKilled : null;
}

export const sql = '';
export async function run(client) {
  // Only the derived summary is replaced; frames, source participants and archives stay intact.
  await client.query('lock table matches in share row exclusive mode');
  let after = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const rows = (await client.query("select id,raw from matches where id > $1 and raw is not null and coalesce(raw #>> '{nxt5,timelineSummary,csRule}', '') <> '2' order by id limit 50", [after])).rows;
    if (!rows.length) break;
    after = rows.at(-1).id;
    for (const row of rows) {
      const raw = row.raw;
      const timeline = raw.timeline || raw.metadata?.timeline || raw.nxt5?.timeline;
      const frames = timeline?.info?.frames || timeline?.frames || timeline?.timeline?.info?.frames || timeline?.timeline?.frames || [];
      if (!Array.isArray(frames) || !frames.length || !Array.isArray(raw.info?.participants)) continue;
      const csMilestones = {};
      for (const participant of raw.info.participants) {
        const id = Number(participant.participantId || 0);
        csMilestones[String(id)] = {
          participantId: id, champion: participant.championName || '', summonerName: participant.summonerName || participant.riotIdGameName || '',
          cs10: Number(raw.info.gameDuration || 0) < 600 ? null : csFromTimelineFrames(frames, id, 10),
          cs20: Number(raw.info.gameDuration || 0) < 1200 ? null : csFromTimelineFrames(frames, id, 20),
        };
      }
      raw.nxt5 = { ...raw.nxt5, timelineSummary: { ...raw.nxt5?.timelineSummary, csRule: 2, csMilestones } };
      await client.query("update matches set raw=jsonb_set(raw, '{nxt5}', $2::jsonb) where id=$1", [row.id, JSON.stringify(raw.nxt5)]);
    }
  }
}
