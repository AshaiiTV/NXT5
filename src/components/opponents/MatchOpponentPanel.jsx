import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, SelectInput, TextInput } from "../ui/Core.jsx";
import { GameOperationDialog } from "../games/GameOperationDialog.jsx";
import "./match-opponent-panel.css";

function MatchOpponent({ teamId, matchId, onChanged, onResolvedName }) {
  const id = useId();
  const [opponents, setOpponents] = useState([]);
  const [linkedGroups, setLinkedGroups] = useState([]);
  const [savedId, setSavedId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [load, setLoad] = useState("loading");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const triggerRef = useRef(null);
  const noticeRef = useRef(null);
  const mounted = useRef(true);
  const requests = useRef(new Set());
  const mutation = useRef(false);

  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);

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
        setLinkedGroups(result.linkedGroups || []);
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
    if (load !== "ready" || !canEdit || linkedGroups.length || selectedId === savedId || mutation.current) return;
    mutation.current = true; setBusy("save"); setError(""); setNotice("");
    try {
      const result = await request("set-match-opponent", { opponentId: selectedId || null });
      if (!mounted.current) return;
      const nextId = result.opponentId || "";
      setSavedId(nextId); setSelectedId(nextId);
      try { await onChanged?.(); }
      catch { if (mounted.current) setError(t("La modification est enregistrée. Recharge la page pour actualiser les autres données.")); return; }
      if (mounted.current) setNotice(t(nextId ? "Équipe adverse enregistrée pour cette partie." : "Équipe adverse retirée de cette partie."));
    } catch (failure) { if (mounted.current) setError(failure.message || t("Impossible d’enregistrer l’équipe adverse. Réessaie.")); }
    finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  async function create(event) {
    event.preventDefault();
    if (load !== "ready" || !canEdit || linkedGroups.length || !name.trim() || mutation.current) return;
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

  function closeEditor() {
    setEditorOpen(false); setSelectedId(savedId); setCreateOpen(false); setName(""); setError(""); setNotice("");
  }

  const savedOpponent = opponents.find((item) => item.id === savedId);
  useEffect(() => {
    onResolvedName?.(load === "ready" ? savedOpponent?.name || "" : "");
  }, [load, savedOpponent?.name, onResolvedName]);
  return <div className="match-context-control match-opponent-control">
    <span className="match-context-label">{t("Équipe adverse")}</span>
    {load === "loading" && <span role="status" className="match-context-value">{t("Chargement de l’équipe adverse…")}</span>}
    {load === "ready" && <>
      <strong className="match-context-value">{savedOpponent?.name || t("Non renseignée")}</strong>
      {(canEdit || linkedGroups.length > 0) && <span ref={triggerRef}><Button type="button" variant="ghost" className="match-context-trigger" aria-haspopup="dialog" aria-label={t(linkedGroups.length ? "Voir les groupes" : savedId ? "Modifier l’équipe adverse" : "Ajouter une équipe adverse")} onClick={() => setEditorOpen(true)}>{t(linkedGroups.length ? "Voir les groupes" : savedId ? "Modifier" : "Ajouter")}</Button></span>}
    </>}
    {load === "error" && <>
      <p role="alert" className="match-opponent-error">{t(error)}</p>
      <Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Réessayer")}</Button>
    </>}
    {editorOpen && (canEdit || linkedGroups.length > 0) && <GameOperationDialog title={t("Équipe adverse")} description={t(linkedGroups.length ? "L’équipe adverse de cette partie est définie par ses groupes." : "Rattache cette partie à une équipe adverse, même sans lien Drafter.")} onClose={closeEditor} busy={Boolean(busy)} dirty={selectedId !== savedId || Boolean(name.trim())} returnFocusRef={triggerRef} compact className="match-opponent-dialog">
      {error && <p role="alert" className="match-opponent-error">{t(error)}</p>}
      <p ref={noticeRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className={notice ? "match-opponent-notice" : "sr-only"}>{notice}</p>
      {load === "ready" && linkedGroups.length > 0 && <div className="match-opponent-groups">
        <p>{t("Pour changer cette équipe, modifie le lien dans les groupes concernés.")}</p>
        <ul>{linkedGroups.map((group) => <li key={group.id}><a href={`/games?view=groups&archive=${encodeURIComponent(group.id)}&team=${encodeURIComponent(teamId)}`}>{group.name}</a></li>)}</ul>
      </div>}
      {load === "ready" && canEdit && !linkedGroups.length && <>
        <form onSubmit={save} className="match-opponent-selection">
          <SelectInput label={t("Équipe adverse de cette partie")} value={selectedId} disabled={Boolean(busy)} onChange={(value) => { setSelectedId(value); setNotice(""); setError(""); }}><option value="">{t("Aucune équipe adverse")}</option>{opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</SelectInput>
          <Button type="submit" icon={busy === "save" ? Loader2 : Check} disabled={Boolean(busy) || selectedId === savedId}>{t(busy === "save" ? "Enregistrement…" : "Enregistrer l’adversaire")}</Button>
        </form>
        <Button type="button" variant="ghost" icon={createOpen ? X : Plus} disabled={Boolean(busy)} aria-expanded={createOpen} aria-controls={`${id}-create`} onClick={() => { if (createOpen) setName(""); setCreateOpen((value) => !value); setError(""); }}>{t(createOpen ? "Annuler la création" : "Créer une équipe adverse")}</Button>
        {createOpen && <form id={`${id}-create`} className="match-opponent-create" onSubmit={create}>
          <TextInput label={t("Nom de l’équipe adverse")} value={name} onChange={setName} required maxLength={80} disabled={Boolean(busy)} autoComplete="off" />
          <Button type="submit" icon={busy === "create" ? Loader2 : Plus} disabled={Boolean(busy) || !name.trim()}>{t(busy === "create" ? "Création…" : "Créer l’équipe")}</Button>
        </form>}
      </>}
    </GameOperationDialog>}
  </div>;
}

export function MatchOpponentPanel({ teamId, match, user, onChanged, onResolvedName }) {
  useLanguage();
  if (!teamId || !match?.id || (match.team_id && match.team_id !== teamId)) return null;
  return <MatchOpponent key={`${teamId}:${match.id}:${user?.id || ""}`} teamId={teamId} matchId={match.id} onChanged={onChanged} onResolvedName={onResolvedName} />;
}

export default MatchOpponentPanel;
