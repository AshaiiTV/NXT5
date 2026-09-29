import { useRef, useState } from "react";
import { apiFetch } from "../api/client.js";
import { openAppPath } from "../app/routing.js";

// Owned by MainApp: bootstrap guards may unmount every Teams instance.
export function useTeamCreation({ setSelectedTeamId, refreshAll, pushToast }) {
  const operation = useRef(null);
  const locked = useRef(false);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);

  async function create(form, players) {
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
        await apiFetch("players-create", { method: "POST", body: JSON.stringify(current.players[current.next]) });
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
  }
  return { pending, busy, completed, create };
}
