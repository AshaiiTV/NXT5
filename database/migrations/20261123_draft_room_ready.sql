-- Draft room readiness: each captain confirms "Prêt" before the first ban of a game.
-- host = the team that created the room (ally_side), guest = the invited captain.
-- Rooms that already have moves keep playing; only games still at 0/20 wait for both. Idempotent.
alter table draft_rooms
  add column if not exists host_ready_at timestamptz,
  add column if not exists guest_ready_at timestamptz;
