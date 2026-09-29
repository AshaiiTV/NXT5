// A milestone must be observed within five seconds after its target minute.
export const MILESTONE_TOLERANCE_MS = 5000;

export function csFromTimelineFrames(frames, participantId, minute) {
  const target = Number(minute) * 60000;
  const frame = frames.find(item => Number(item.timestamp) >= target && Number(item.timestamp) <= target + MILESTONE_TOLERANCE_MS);
  const participant = frame?.participantFrames?.[String(participantId)];
  return Number.isFinite(participant?.minionsKilled) && Number.isFinite(participant?.jungleMinionsKilled)
    ? participant.minionsKilled + participant.jungleMinionsKilled : null;
}
