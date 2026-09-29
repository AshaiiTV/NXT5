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

  const create = useCallback(async (form, players) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
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
          if (err.status !== 409 || err.message !== "Ce Riot ID existe déjà dans cette team.") throw err;
        }
        current.next += 1;
        setPending({ ...current });
      }
      operation.current = null;
      setPending(null);
      setCompleted(value => value + 1);
      openAppPath("/equipes");
      pushToast({ type: "green", title: "Team créée", text: current.next ? `${current.next} joueur(s) importé(s) depuis le multi OP.GG.` : "Tu peux maintenant ajouter le roster ou générer un code d’invitation." });
    } catch (err) {
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
    return true;
  }, []);

  return useMemo(() => ({ pending, busy, completed, create, abandon }), [pending, busy, completed, create, abandon]);
}
