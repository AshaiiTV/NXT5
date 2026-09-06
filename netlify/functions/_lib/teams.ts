/** Fields shared with every team member. Invitations use their own role-gated response. */
export function safeTeam(team: Record<string, any>) {
  return {
    id: team.id,
    owner_id: team.owner_id,
    name: team.name,
    tag: team.tag,
    region: team.region,
    avatar_data_url: team.avatar_data_url,
    avatar_zoom: team.avatar_zoom,
    avatar_x: team.avatar_x,
    avatar_y: team.avatar_y,
    created_at: team.created_at,
    updated_at: team.updated_at
  };
}
