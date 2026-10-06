import { useEffect, useState } from "react";
import { onboardingVisitsForRoute } from "../utils/onboarding.js";

const EMPTY = { dismissed: false, discovered: [] };
function read(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key));
    return { dismissed: value?.dismissed === true, discovered: Array.isArray(value?.discovered) ? value.discovered.filter(id => ["profile", "reading", "team-review"].includes(id)) : [] };
  } catch { return EMPTY; }
}

export function useOnboarding({ user, currentTeam, data, route, ready }) {
  const key = `nxt5_start_v2:${user?.id || ""}:${currentTeam?.id || ""}`;
  const [preferences, setPreferences] = useState({});
  const state = preferences[key] || read(key);
  function update(change) {
    const next = { ...state, ...change };
    setPreferences(current => ({ ...current, [key]: next }));
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* UI remains usable without storage. */ }
  }
  const visits = ready ? onboardingVisitsForRoute({ user, currentTeam, data, route }).filter(id => !state.discovered.includes(id)) : [];
  const visitKey = visits.join(",");
  useEffect(() => {
    if (visitKey) update({ discovered: [...new Set([...state.discovered, ...visits])] });
  }, [key, visitKey]);
  return { ...state, dismiss: () => update({ dismissed: true }), resume: () => update({ dismissed: false }) };
}
