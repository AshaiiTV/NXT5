import { useCallback, useMemo, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";
import { openAppPath } from "../app/routing.js";

// Owned by MainApp: bootstrap guards may unmount every Teams instance.
export function useTeamCreation({ setSelectedTeamId, refreshAll, pushToast }) {
  const operation = useRef(null);
  const locked = useRef(false);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState("");

  const create = useCallback(async (form, players) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    let current = operation.current;
    try {
      if (!current) {
        const { team } = await apiFetch("teams-create", { method: "POST", body: JSON.stringify({ name: form.name, tag: form.tag, region: form.region }) });
        current = { team, next: 0, players: players.map(player => ({ ...player, teamId: team.id })) };
        operation.current = current;
        setPending({ ...current });
      }
      setSelectedTeamId(current.team.id);
      while (current.next < current.players.length) {
        try {
          await apiFetch("players-create", { method: "POST", body: JSON.stringify(current.players[current.next]) });
        } catch (err) {
          // A lost response can leave this player already saved. Other conflicts
          // (main role occupied or permissions changed) still require attention.
          if (err.status !== 409 || err.code !== "PLAYER_RIOT_ID_EXISTS") throw err;
        }
        current.next += 1;
        setPending({ ...current });
      }
      operation.current = null;
      setPending(null);
      setCompleted(value => value + 1);
      openAppPath("/accueil");
      pushToast({ type: "green", title: "Équipe créée", text: current.next ? `${current.next} joueur(s) ajouté(s). Tu peux importer ta première partie.` : "Ton espace est prêt. Importe ta première partie pour commencer." });
    } catch (err) {
      setError(err.message || "La création n’a pas abouti. Tu peux réessayer.");
      pushToast({ type: "red", title: current ? "Équipe créée, joueurs à compléter" : "Création impossible", text: current ? `${current.next} joueur(s) ajouté(s). Reprends uniquement les joueurs manquants. ${err.message}` : err.message });
    } finally {
      try {
        if (current) await refreshAll({ teamId: current.team.id });
      } catch (err) {
        pushToast({ type: "red", title: "Actualisation impossible", text: `L’équipe est créée. ${err.message}` });
      } finally {
        locked.current = false;
        setBusy(false);
      }
    }
  }, [setSelectedTeamId, refreshAll, pushToast]);

  const abandon = useCallback(() => {
    if (locked.current) return false;
    operation.current = null;
    setPending(null);
    setError("");
    return true;
  }, []);

  return useMemo(() => ({ pending, busy, completed, error, create, abandon }), [pending, busy, completed, error, create, abandon]);
}
