export function csAtMinute(row, minute) {
  const participantId = Number(row?.raw?.participantId || row?.participantId || 0);
  const match = row?.match;
  const target = Number(minute) * 60 * 1000;
  const seconds = Number(match?.raw?.info?.gameDuration || match?.game_duration || row?.raw?.timePlayed || 0);
  const durationParts = String(match?.duration || "").match(/^(\d+):(\d{2})$/);
  const durationMs = seconds ? seconds * 1000 : durationParts ? (Number(durationParts[1]) * 60 + Number(durationParts[2])) * 1000 : 0;
  if (!participantId || (durationMs && durationMs < target)) return null;
  const frames = match?.raw?.timeline?.info?.frames || match?.raw?.metadata?.timeline?.info?.frames || match?.raw?.timeline?.frames || [];
  if (!frames.length) {
    const value = match?.raw?.nxt5?.timelineSummary?.csMilestones?.[String(participantId)]?.[`cs${minute}`];
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  }
  const frame = frames.find((item) => Number(item.timestamp || 0) >= target && Number(item.timestamp || 0) <= target + 60000);
  const participant = frame?.participantFrames?.[String(participantId)];
  return participant ? Number(participant.minionsKilled || 0) + Number(participant.jungleMinionsKilled || 0) : null;
}
