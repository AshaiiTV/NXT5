import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import "./group-opponent-panel.css";

function GroupOpponent({ teamId, archiveId, onChanged, onCountChange }) {
  const id = useId();
  const [opponents, setOpponents] = useState([]);
  const [savedId, setSavedId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [matchCount, setMatchCount] = useState(0);
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
    apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "get-group-opponent", teamId, archiveId }), signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOpponents(result.opponents || []); setSavedId(result.opponentId || ""); setSelectedId(result.opponentId || "");
        setMatchCount(Number(result.matchCount) || 0); setCanEdit(result.canEdit === true); setLoad("ready");
      }).catch((failure) => { if (!controller.signal.aborted) { setError(failure.message || t("Impossible de charger l’équipe du groupe.")); setLoad("error"); } });
    return () => controller.abort();
  }, [teamId, archiveId, reload]);

  useEffect(() => {
    onCountChange?.(load === "ready" ? opponents.length : null);
  }, [onCountChange, load, opponents.length]);

  async function request(action, payload) {
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      return await apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action, teamId, ...(action === "create-opponent" ? {} : { archiveId }), ...payload }), signal: controller.signal });
    } finally { requests.current.delete(controller); }
  }

  async function save(event) {
    event.preventDefault();
    if (load !== "ready" || !canEdit || selectedId === savedId || mutation.current) return;
    mutation.current = true; setBusy("save"); setError(""); setNotice("");
    try {
      const result = await request("set-group-opponent", { opponentId: selectedId || null });
      if (!mounted.current) return;
      const nextId = result.opponentId || "";
      setSavedId(nextId); setSelectedId(nextId); setMatchCount(Number(result.matchCount) || 0);
      try { await onChanged?.(); }
      catch { if (mounted.current) setError(t("Le lien du groupe est enregistré. Recharge la page pour actualiser les autres données.")); return; }
      if (mounted.current) setNotice(t(nextId ? (Number(result.matchCount) === 1 ? "Équipe liée au groupe et à sa partie." : "Équipe liée au groupe et à ses {0} parties.") : "Lien du groupe retiré. Les équipes de ses parties sont conservées.", [Number(result.matchCount) || 0]));
    } catch (failure) { if (mounted.current) setError(failure.message || t("Impossible d’enregistrer l’équipe du groupe. Réessaie.")); }
    finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  async function create(event) {
    event.preventDefault();
    if (load !== "ready" || !canEdit || !name.trim() || mutation.current) return;
    mutation.current = true; setBusy("create"); setError(""); setNotice("");
    try {
      const result = await request("create-opponent", { name: name.trim(), notes: "" });
      if (!mounted.current) return;
      setOpponents((current) => [...current.filter((item) => item.id !== result.opponent.id), result.opponent]);
      setSelectedId(result.opponent.id); setCreateOpen(false); setName("");
      setNotice(t("Équipe créée. Enregistre le lien pour l’associer à ce groupe."));
    } catch (failure) { if (mounted.current) setError(failure.message || t("Impossible de créer cet adversaire.")); }
    finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  const savedOpponent = opponents.find((item) => item.id === savedId);
  return <Surface className="group-opponent-panel">
    <section aria-labelledby={`${id}-title`} aria-busy={load === "loading" || Boolean(busy)}>
      <div className="group-opponent-heading"><h3 id={`${id}-title`}>{t("Équipe adverse du groupe")}</h3><p id={`${id}-help`}>{t("Le lien s’applique à toutes les parties du groupe, y compris celles ajoutées ensuite.")}</p></div>
      {load === "loading" && <p role="status">{t("Chargement de l’équipe du groupe…")}</p>}
      {error && <p role="alert" className="group-opponent-error">{t(error)}</p>}
      {load === "error" && <Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Réessayer")}</Button>}
      <p role="status" aria-live="polite" aria-atomic="true" className={notice ? "group-opponent-notice" : "sr-only"}>{notice}</p>
      {load === "ready" && <>
        <div className="group-opponent-current">
          {savedOpponent ? <a href={`/games?view=teams&opponent=${encodeURIComponent(savedOpponent.id)}&team=${encodeURIComponent(teamId)}`} className="group-opponent-link">{t("Voir l’équipe : {0}", [savedOpponent.name])}</a> : <p>{t("Aucune équipe liée à ce groupe.")}</p>}
          <span>{t(matchCount === 1 ? "{0} partie dans ce groupe" : "{0} parties dans ce groupe", [matchCount])}</span>
        </div>
        {canEdit ? <>
          <form onSubmit={save} className="group-opponent-selection">
            <SelectInput label={t("Associer une équipe au groupe")} value={selectedId} disabled={Boolean(busy)} aria-describedby={`${id}-help ${id}-unlink`} onChange={(value) => { setSelectedId(value); setNotice(""); setError(""); }}><option value="">{t("Aucune équipe liée")}</option>{opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</SelectInput>
            <Button type="submit" icon={busy === "save" ? Loader2 : Check} disabled={Boolean(busy) || selectedId === savedId}>{t(busy === "save" ? "Enregistrement…" : "Enregistrer le lien")}</Button>
          </form>
          <p id={`${id}-unlink`} className="group-opponent-help">{t("Retirer le lien conserve les équipes déjà associées aux parties.")}</p>
          <Button type="button" variant="ghost" icon={createOpen ? X : Plus} disabled={Boolean(busy)} aria-expanded={createOpen} aria-controls={`${id}-create`} onClick={() => { setCreateOpen((value) => !value); setError(""); }}>{t(createOpen ? "Annuler la création" : "Créer une équipe adverse")}</Button>
          {createOpen && <form id={`${id}-create`} className="group-opponent-create" onSubmit={create}>
            <TextInput label={t("Nom de l’équipe adverse")} value={name} onChange={setName} required maxLength={80} disabled={Boolean(busy)} autoComplete="off" />
            <Button type="submit" icon={busy === "create" ? Loader2 : Plus} disabled={Boolean(busy) || !name.trim()}>{t(busy === "create" ? "Création…" : "Créer l’équipe")}</Button>
          </form>}
        </> : <p className="group-opponent-help">{t("Le capitaine ou le staff peut modifier le lien du groupe.")}</p>}
      </>}
    </section>
  </Surface>;
}

export function GroupOpponentPanel({ teamId, archive, user, onChanged, onCountChange }) {
  useLanguage();
  if (!teamId || !archive?.id || (archive.team_id && archive.team_id !== teamId)) return null;
  return <GroupOpponent key={`${teamId}:${archive.id}:${user?.id || ""}`} teamId={teamId} archiveId={archive.id} onChanged={onChanged} onCountChange={onCountChange} />;
}

export default GroupOpponentPanel;
