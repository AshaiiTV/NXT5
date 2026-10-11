import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import "./match-opponent-panel.css";

function MatchOpponent({ teamId, matchId, onChanged }) {
  const id = useId();
  const [opponents, setOpponents] = useState([]);
  const [savedId, setSavedId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [load, setLoad] = useState("loading");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const mounted = useRef(true);
  const requests = useRef(new Set());
  const mutation = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const pending = requests.current;
    return () => { mounted.current = false; for (const request of pending) request.abort(); pending.clear(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoad("loading"); setError("");
    apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "get-match-opponent", teamId, matchId }), signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOpponents(result.opponents || []); setSavedId(result.opponentId || ""); setSelectedId(result.opponentId || "");
        setCanEdit(result.canEdit === true); setLoad("ready");
      }).catch((failure) => { if (!controller.signal.aborted) { setError(failure.message || t("Impossible de charger l’équipe adverse.")); setLoad("error"); } });
    return () => controller.abort();
  }, [teamId, matchId, reload]);

  async function request(action, payload) {
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      return await apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action, teamId, ...(action === "create-opponent" ? {} : { matchId }), ...payload }), signal: controller.signal });
    } finally { requests.current.delete(controller); }
  }

  async function save(event) {
    event.preventDefault();
    if (!canEdit || selectedId === savedId || mutation.current) return;
    mutation.current = true; setBusy("save"); setError(""); setNotice("");
    try {
      const result = await request("set-match-opponent", { opponentId: selectedId || null });
      if (!mounted.current) return;
      const nextId = result.opponentId || "";
      setSavedId(nextId); setSelectedId(nextId);
      setNotice(t(nextId ? "Équipe adverse enregistrée pour cette partie." : "Équipe adverse retirée de cette partie."));
      try { await onChanged?.(); }
      catch { if (mounted.current) setError(t("La modification est enregistrée. Recharge la page pour actualiser les autres données.")); }
    } catch (failure) { if (mounted.current) setError(failure.message || t("Impossible d’enregistrer l’équipe adverse. Réessaie.")); }
    finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  async function create(event) {
    event.preventDefault();
    if (!canEdit || !name.trim() || mutation.current) return;
    mutation.current = true; setBusy("create"); setError(""); setNotice("");
    try {
      const result = await request("create-opponent", { name: name.trim(), notes: "" });
      if (!mounted.current) return;
      setOpponents((current) => [...current.filter((item) => item.id !== result.opponent.id), result.opponent]);
      setSelectedId(result.opponent.id); setCreateOpen(false); setName("");
      setNotice(t("Équipe créée. Enregistre-la pour l’associer à cette partie."));
    } catch (failure) { if (mounted.current) setError(failure.message || t("Impossible de créer cet adversaire.")); }
    finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  const savedOpponent = opponents.find((item) => item.id === savedId);
  return <Surface className="match-opponent-panel">
    <section aria-labelledby={`${id}-title`}>
      <div className="match-opponent-heading"><h3 id={`${id}-title`}>{t("Équipe adverse")}</h3><p>{t("Rattache cette partie à une équipe adverse, même sans lien Drafter.")}</p></div>
      {load === "loading" && <p role="status">{t("Chargement de l’équipe adverse…")}</p>}
      {error && <p role="alert" className="match-opponent-error">{t(error)}</p>}
      {load === "error" && <Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Réessayer")}</Button>}
      <p role="status" aria-live="polite" aria-atomic="true" className={notice ? "match-opponent-notice" : "sr-only"}>{notice}</p>
      {load === "ready" && (canEdit ? <>
        <form onSubmit={save} className="match-opponent-selection">
          <SelectInput label={t("Équipe adverse de cette partie")} value={selectedId} disabled={Boolean(busy)} onChange={(value) => { setSelectedId(value); setNotice(""); setError(""); }}><option value="">{t("Aucune équipe adverse")}</option>{opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</SelectInput>
          <Button type="submit" icon={busy === "save" ? Loader2 : Check} disabled={Boolean(busy) || selectedId === savedId}>{t(busy === "save" ? "Enregistrement…" : "Enregistrer l’adversaire")}</Button>
        </form>
        <Button type="button" variant="ghost" icon={createOpen ? X : Plus} disabled={Boolean(busy)} aria-expanded={createOpen} aria-controls={`${id}-create`} onClick={() => { setCreateOpen((value) => !value); setError(""); }}>{t(createOpen ? "Annuler la création" : "Créer une équipe adverse")}</Button>
        {createOpen && <form id={`${id}-create`} className="match-opponent-create" onSubmit={create}>
          <TextInput label={t("Nom de l’équipe adverse")} value={name} onChange={setName} required maxLength={80} disabled={Boolean(busy)} autoComplete="off" />
          <Button type="submit" icon={busy === "create" ? Loader2 : Plus} disabled={Boolean(busy) || !name.trim()}>{t(busy === "create" ? "Création…" : "Créer l’équipe")}</Button>
        </form>}
      </> : <p className="match-opponent-readonly">{savedOpponent?.name || t("Aucune équipe adverse renseignée.")}</p>)}
    </section>
  </Surface>;
}

export function MatchOpponentPanel({ teamId, match, user, onChanged }) {
  useLanguage();
  if (!teamId || !match?.id || (match.team_id && match.team_id !== teamId)) return null;
  return <MatchOpponent key={`${teamId}:${match.id}:${user?.id || ""}`} teamId={teamId} matchId={match.id} onChanged={onChanged} />;
}

export default MatchOpponentPanel;
