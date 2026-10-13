const DAY = 86400000;

// This describes imports, not logins, matches played or overall team activity.
export function importStatus(team, referenceDate) {
  if (!Number(team.matches)) return { id: "never", label: "Aucun import", tone: "slate" };
  const last = Date.parse(team.lastActivityAt);
  const reference = Date.parse(referenceDate);
  if (!Number.isFinite(last) || !Number.isFinite(reference)) return { id: "unknown", label: "Date inconnue", tone: "slate" };
  const days = Math.max(0, Math.floor((reference - last) / DAY));
  if (reference - last <= 30 * DAY) return { id: "recent", label: "Import récent", tone: "green", days };
  return { id: "quiet", label: "Sans import depuis 30 j", tone: "yellow", days };
}

export function selectTeams(teams, { search = "", filter = "all", sort = "latest", direction = sort === "name" ? "ascending" : "descending", referenceDate }) {
  const normalized = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  const query = normalized(search.trim());
  return teams.filter((team) => {
    const matchesQuery = normalized(`${team.name} ${team.tag || ""} ${team.region || ""}`).includes(query);
    const matchesFilter = filter === "all" || (filter === "empty" ? !Number(team.players) : importStatus(team, referenceDate).id === filter);
    return matchesQuery && matchesFilter;
  }).sort((a, b) => {
    const sign = direction === "ascending" ? 1 : -1;
    const nameOrder = String(a.name).localeCompare(String(b.name), "fr");
    if (sort === "name") return sign * nameOrder;
    if (sort === "volume") return sign * (Number(a.matches || 0) - Number(b.matches || 0)) || nameOrder;
    const av = Date.parse(a.lastActivityAt), bv = Date.parse(b.lastActivityAt);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) return Number.isFinite(av) ? -1 : Number.isFinite(bv) ? 1 : nameOrder;
    return sign * (av - bv) || nameOrder;
  });
}

export function rate(value, total) {
  return Number(total) > 0 ? `${Math.round(Number(value || 0) / Number(total) * 100)} %` : "—";
}
