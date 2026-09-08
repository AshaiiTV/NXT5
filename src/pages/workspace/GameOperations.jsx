import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Ellipsis, FileText, Loader2, Plus, Shield, Swords, Users, Upload, X, Pencil, Settings, Trash2 } from "lucide-react";
import { Surface, Badge, Button, SelectInput, TextInput } from "../../components/ui/Core.jsx";
import { apiFetch, apiUploadJson } from "../../api/client.js";
import { ImporterDownloadPanel } from "./ImporterDownloadPanel.jsx";
import { cx, errorToast, tone, formatUploadSize } from "../../app/helpers.js";
import { matchCategoryIds, matchDisplayName } from "../../utils/matches.js";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { championDisplayName, ChampionPortrait, COMP_ROLES, canStaffManage, isGameplayRole, normalizeProfileKey, matchCategoryTone, championMatchesLane } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import "../../components/games/imported-games.css";
import "./GameOperations.css";

/** Native modal: the browser traps focus and makes the statistics behind it inert. */
export function GameOperationDialog({ title, description, children, onClose, busy = false, returnFocusRef, compact = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTarget = returnFocusRef?.current;
    const previousFocus = returnTarget?.querySelector?.("button, a[href], input, select, textarea, [tabindex]") || returnTarget || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const protectedUrl = window.location.href;
    const protectedState = window.history.state;
    // Browser back/forward must not unmount a draft or an in-flight import.
    // App navigation after a successful import uses a synthetic popstate.
    const protectDraft = (event) => {
      if (!event.isTrusted) return;
      event.stopImmediatePropagation();
      window.history.replaceState(protectedState, "", protectedUrl);
    };
    window.addEventListener("popstate", protectDraft, true);
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      window.removeEventListener("popstate", protectDraft, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected !== false) previousFocus?.focus?.();
    };
  }, []);
  const close = () => { if (!latest.current.busy) latest.current.onClose(); };
  return <dialog ref={dialogRef} className={cx("game-operation-dialog nxt5-data-dense", compact && "game-operation-dialog-compact")} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="game-operation-dialog-inner">
      <header className="game-operation-dialog-header">
        <div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        <button type="button" className="game-operation-close" aria-label="Fermer la fenêtre" onClick={close} disabled={busy} autoFocus><X aria-hidden="true" className="h-5 w-5" /></button>
      </header>
      {children}
    </div>
  </dialog>;
}

function canManageTeamCategories(data, selectedTeamId, currentMember, user) {
  const team = (data.teams || []).find((item) => item.id === selectedTeamId);
  return Boolean(user?.id && (team?.owner_id === user.id || canStaffManage(currentMember?.role)));
}

export function GameActions({ match, data, selectedTeamId, refreshAll, pushToast, currentMember, user, onDeleted, onUpdated, disabled = false }) {
  const [mode, setMode] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ label: "", categoryIds: [] });
  const [roleForm, setRoleForm] = useState({});
  const triggerRef = useRef(null);
  const allowed = Boolean(match?.id && match.team_id === selectedTeamId && user?.id && (canManageTeamCategories(data, selectedTeamId, currentMember, user) || String(match.created_by || "") === String(user.id)));
  const categories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const roster = (data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role));
  useEffect(() => { setMode(""); setEditForm({ label: "", categoryIds: [] }); setRoleForm({}); }, [match?.id, selectedTeamId]);
  const close = () => { if (!saving) setMode(""); };
  const openEditor = (nextMode) => {
    setEditForm({ label: matchImportTitle(match), categoryIds: matchCategoryIds(match) });
    setRoleForm(Object.fromEntries((match.participants || []).map((row) => [row.id, { role: row.role || "", playerId: row.player_id || "" }])));
    setMode(nextMode);
  };
  async function save(action) {
    if (!allowed || saving || (action === "update" && !editForm.label.trim()) || (action === "roles" && !match.participants?.length)) return;
    const matchId = match.id;
    const body = { action, teamId: selectedTeamId, matchId, ...(action === "update" ? { label: editForm.label, categoryIds: editForm.categoryIds || [] } : action === "roles" ? { roles: roleForm } : {}) };
    setSaving(true);
    try {
      const result = await apiFetch("matches-manage", { method: "POST", body: JSON.stringify(body) });
      await refreshAll();
      if (action === "delete") {
        pushToast({ type: "green", title: "Game supprimée", text: "Les autres pages ont été recalculées sans cette game." });
        onDeleted?.(matchId);
      } else {
        pushToast(action === "roles" ? { type: "green", title: "Assignation corrigée", text: "Les profils, statistiques et lectures 5v5 utilisent les bons joueurs." } : { type: "green", title: "Game mise à jour", text: "Les statistiques et reviews utilisent le nouvel intitulé." });
        onUpdated?.({ matchId, action, result });
      }
      setMode("");
    } catch (err) {
      pushToast({ type: "red", title: action === "delete" ? "Suppression impossible" : action === "roles" ? "Correction impossible" : "Modification impossible", text: err.message });
    } finally {
      setSaving(false);
    }
  }
  if (!allowed) return null;
  const title = mode === "update" ? "Modifier les informations" : mode === "roles" ? "Corriger les rôles et profils" : mode === "delete" ? "Supprimer cette game ?" : "Options de la game";
  return <>
    <button ref={triggerRef} type="button" className="game-options-trigger" disabled={disabled || saving} aria-label="Options de la game" title="Options de la game" aria-haspopup="dialog" aria-expanded={Boolean(mode)} onClick={() => setMode("menu")}><Ellipsis aria-hidden="true" className="h-5 w-5" /></button>
    {mode && <GameOperationDialog key={mode} title={title} description={matchImportTitle(match)} onClose={close} busy={saving} returnFocusRef={triggerRef} compact={mode !== "roles"}>
      {mode === "menu" && <div className="game-operation-menu">
        <Button type="button" variant="ghost" icon={Pencil} onClick={() => openEditor("update")}>Modifier les informations</Button>
        <Button type="button" variant="ghost" icon={Settings} disabled={!match.participants?.length} onClick={() => openEditor("roles")}>Corriger les rôles et profils</Button>
        <Button type="button" variant="danger" icon={Trash2} onClick={() => setMode("delete")}>Supprimer</Button>
      </div>}
      {(mode === "update" || mode === "roles") && <ImportHistoryEditor match={match} categories={categories} roster={roster} editing={mode === "update"} editForm={editForm} roleForm={roleForm} saving={saving} showHeading={false} onCancel={close} onSave={() => save(mode)} onChange={setEditForm} onRoleChange={(id, role) => setRoleForm((current) => ({ ...current, [id]: { ...current[id], role } }))} onPlayerChange={(id, playerId) => setRoleForm((current) => ({ ...current, [id]: { ...current[id], playerId } }))} />}
      {mode === "delete" && <div>
        <p className="text-sm leading-6 text-slate-300">Cette game sera retirée. Ses statistiques, les reviews automatiques et les groupes liés seront mis à jour.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={close} disabled={saving}>Annuler</Button><Button type="button" variant="danger" icon={saving ? Loader2 : Trash2} onClick={() => save("delete")} disabled={saving}>{saving ? "Suppression…" : "Supprimer la game"}</Button></div>
      </div>}
    </GameOperationDialog>}
  </>;
}

export function GameCategoryManager({ data, selectedTeamId, refreshAll, pushToast, currentMember, user }) {
  const [open, setOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", color: "cyan" });
  const triggerRef = useRef(null);
  const allowed = canManageTeamCategories(data, selectedTeamId, currentMember, user);
  const categories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  useEffect(() => { setOpen(false); setCreatorOpen(false); setForm({ name: "", color: "cyan" }); }, [selectedTeamId]);
  const close = () => { if (!saving) { setOpen(false); setCreatorOpen(false); setForm({ name: "", color: "cyan" }); } };
  async function createCategory(event) {
    event.preventDefault();
    if (!allowed || saving || !form.name.trim()) return;
    setSaving(true);
    try {
      await apiFetch("match-categories-manage", { method: "POST", body: JSON.stringify({ action: "create", teamId: selectedTeamId, name: form.name, color: form.color }) });
      await refreshAll();
      setForm({ name: "", color: "cyan" });
      setCreatorOpen(false);
      pushToast({ type: "green", title: "Catégorie créée", text: "Tu peux maintenant classer tes games dedans." });
    } catch (err) {
      pushToast({ type: "red", title: "Création impossible", text: err.message });
    } finally { setSaving(false); }
  }
  async function deleteCategory(category) {
    if (!allowed || saving || category.is_default) return;
    if (!window.confirm(`Supprimer la catégorie "${category.name}" ? Les games resteront importées et conserveront leurs autres catégories.`)) return;
    setSaving(true);
    try {
      await apiFetch("match-categories-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, categoryId: category.id }) });
      await refreshAll();
      pushToast({ type: "green", title: "Catégorie supprimée", text: "Les games associées ont été conservées." });
    } catch (err) {
      pushToast({ type: "red", title: "Suppression impossible", text: err.message });
    } finally { setSaving(false); }
  }
  if (!allowed) return null;
  return <>
    <span ref={triggerRef}><Button type="button" variant="ghost" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Catégories</Button></span>
    {open && <GameOperationDialog title="Catégories" description="Organise tes games par contexte : scrim, ligue, bootcamp…" compact onClose={close} busy={saving} returnFocusRef={{ current: triggerRef.current?.querySelector("button") }}>
      <section className="ih-categories" aria-label="Gestion des catégories">
        <header><Button type="button" variant="ghost" icon={creatorOpen ? X : Plus} disabled={saving} onClick={() => { setCreatorOpen((value) => !value); setForm({ name: "", color: "cyan" }); }}>{creatorOpen ? "Fermer la création" : "Ajouter une catégorie"}</Button></header>
        <ul className="ih-category-list">{categories.map((category) => <li key={category.id}><span>{category.name}</span>{category.is_default ? <span className="ih-category-default">Par défaut</span> : <button type="button" className="ig-icon-button" onClick={() => deleteCategory(category)} disabled={saving} aria-label={`Supprimer la catégorie ${category.name}`}><X aria-hidden="true" /></button>}</li>)}</ul>
        {!categories.length && <p>Aucune catégorie pour le moment.</p>}
        {creatorOpen && <form className="ih-category-create" onSubmit={createCategory}><fieldset disabled={saving}>
          <TextInput label="Nom de la catégorie" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} placeholder="Ligue, Bootcamp…" required />
          <SelectInput label="Couleur" value={form.color} onChange={(color) => setForm((current) => ({ ...current, color }))}>{[["cyan", "Cyan"], ["purple", "Violet"], ["green", "Vert"], ["yellow", "Jaune"], ["pink", "Rose"], ["red", "Rouge"], ["blue", "Bleu"], ["slate", "Ardoise"]].map(([color, label]) => <option key={color} value={color}>{label}</option>)}</SelectInput>
          <Button type="submit" icon={saving ? Loader2 : Plus} disabled={saving || !form.name.trim()}>{saving ? "Création…" : "Créer"}</Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={() => { setCreatorOpen(false); setForm({ name: "", color: "cyan" }); }}>Annuler</Button>
        </fieldset></form>}
      </section>
    </GameOperationDialog>}
  </>;
}

export function matchImportTitle(match) {
  return matchDisplayName(match, "Import");
}

export function matchCategoriesForMatch(match, categories) {
  return matchCategoryIds(match)
    .map((id) => (categories || []).find((category) => String(category.id || "") === String(id)))
    .filter(Boolean);
}

export function CategoryMultiSelect({ categories, selectedIds, onChange, label = "Catégories" }) {
  const ids = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
  const toggle = (categoryId) => {
    const id = String(categoryId || "");
    onChange(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };
  return <div>
    <p className="mb-2 text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-300">{label}</p>
    <div className="flex flex-wrap gap-2">
      {(categories || []).map((category) => {
        const active = ids.includes(String(category.id));
        return <button key={category.id} type="button" onClick={() => toggle(category.id)} aria-pressed={active} className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition", active ? [tone(matchCategoryTone(category)), "ring-1 ring-white/35"] : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]")}>{active && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}{category.name}</button>;
      })}
      {!categories?.length && <Badge tone="slate">Aucune catégorie</Badge>}
    </div>
  </div>;
}

export function JsonUploadProgress({ progress }) {
  if (!progress?.active) return null;
  const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
  const uploaded = progress.total ? `${formatUploadSize(progress.loaded)} / ${formatUploadSize(progress.total)}` : "Calcul de l’upload...";
  const phaseLabel = progress.phase === "server" ? "JSON envoyé, analyse NXT5 en cours" : "Upload du JSON";
  return <div className="rounded-2xl border border-cyan-300/18 bg-cyan-400/[0.07] p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-cyan-100">{progress.label || phaseLabel}</p>
        <p className="mt-1 text-xs font-semibold text-slate-300">{phaseLabel} · {uploaded}</p>
      </div>
      <span className="shrink-0 text-sm font-black text-white">{percent}%</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-sky-400 to-fuchsia-300 shadow-[0_0_18px_rgba(34,211,238,.35)] transition-[width] duration-150 ease-out" style={{ width: `${percent}%` }} />
    </div>
  </div>;
}

export function ImportRoleHeader({ role, toneName = "cyan", player = null, fallbackLabel = "À lier" }) {
  const roleTone = toneName === "red"
    ? "border-rose-200/20 bg-rose-500/[0.08] text-rose-100"
    : "border-cyan-200/20 bg-cyan-400/[0.08] text-cyan-100";
  const chipTone = player
    ? "border-white/10 bg-white/[0.055] text-white"
    : "border-white/10 bg-black/20 text-slate-400";
  return (
    <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/24 p-2">
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", roleTone)}>
        <RoleIcon role={role} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">Poste</span>
        <span className="block truncate text-sm font-black text-white">{roleLabel(role)}</span>
      </span>
      <span className={cx("min-w-0 max-w-[46%] shrink rounded-lg border px-2 py-1 text-right text-[0.62rem] font-black uppercase tracking-[0.08em]", chipTone)}>
        <span className="block truncate">{player?.name || fallbackLabel}</span>
      </span>
    </div>
  );
}

export function ImportHistoryEditor({ match, categories, roster, editing, editForm, saving, roleForm, onCancel, onSave, onChange, onRoleChange, onPlayerChange, showHeading = true }) {
  return <form className="ih-editor" onSubmit={(event) => { event.preventDefault(); if (!saving) onSave(); }}>
    {showHeading && <header><h4>{editing ? "Modifier la game" : "Réassigner postes et profils"}</h4><p>{editing ? "Ajuste le nom et les catégories utilisés dans les stats et les reviews." : "Associe chaque champion au bon poste et au bon profil NXT5."}</p></header>}
    <fieldset disabled={saving}>
      {editing ? <div className="ih-edit-fields">
        <TextInput label="Nom de la game" value={editForm.label} onChange={(label) => onChange({ ...editForm, label })} placeholder="Game 1 vs BK, Finale LB…" required icon={FileText} />
        <CategoryMultiSelect categories={categories} selectedIds={editForm.categoryIds || []} onChange={(categoryIds) => onChange({ ...editForm, categoryIds })} />
      </div> : <div className="ih-teams">{["ALLY", "ENEMY"].map((teamKey) => <section key={teamKey} className={`ih-team ih-team-${teamKey.toLowerCase()}`}>
        <h5>{teamKey === "ALLY" ? "Notre équipe" : "Adversaires"}</h5>
        <div className="ih-roster">{(match.participants || []).filter((row) => row.team_key === teamKey).map((row) => {
          const value = roleForm[row.id];
          const form = value && typeof value === "object" ? value : { role: value || row.role || "", playerId: row.player_id || "" };
          const champion = championDisplayName(row.champion);
          return <div key={row.id} className="ih-participant">
            <div className="ih-player"><ChampionPortrait row={row} champion={row.champion} alt={champion} className="ih-portrait" /><div><strong>{champion}</strong><span>{row.summoner_name || row.riot_id || "Joueur"}</span></div></div>
            <div className="ih-role-fields">
              <SelectInput label={`Poste · ${champion}`} value={form.role || ""} onChange={(role) => onRoleChange(row.id, role)}><option value="" disabled>À attribuer</option>{COMP_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</SelectInput>
              {teamKey === "ALLY" && <SelectInput label={`Profil NXT5 · ${champion}`} value={form.playerId || ""} onChange={(playerId) => onPlayerChange(row.id, playerId)}><option value="">Conserver le profil</option>{form.playerId && !roster.some((player) => String(player.id) === String(form.playerId)) && <option value={form.playerId}>Profil lié hors roster</option>}{roster.map((player) => <option key={player.id} value={player.id}>{roleLabel(player.role)} · {player.name}</option>)}</SelectInput>}
            </div>
          </div>;
        })}</div>
        {!(match.participants || []).some((row) => row.team_key === teamKey) && <p className="ih-no-participants">Aucun participant disponible.</p>}
      </section>)}</div>}
      <div className="ih-editor-actions"><Button type="button" variant="ghost" icon={X} onClick={onCancel} disabled={saving}>Annuler</Button><Button type="submit" icon={saving ? Loader2 : Check} disabled={saving || (editing ? !editForm.label.trim() : !match.participants?.length)}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
    </fieldset>
  </form>;
}

export function ImportGameFlow({ data, refreshAll, selectedTeamId, pushToast, onImported, onBusyChange }) {
  const [laneAssignments, setLaneAssignments] = useState({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  const [enemyLaneAssignments, setEnemyLaneAssignments] = useState({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  const [playerAssignments, setPlayerAssignments] = useState({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  const [allyTeamSide, setAllyTeamSide] = useState("");
  const [importDetails, setImportDetails] = useState({ label: "", categoryIds: [] });
  const [importPreview, setImportPreview] = useState(null);
  const [previewPayload, setPreviewPayload] = useState(null);
  const [importing, setImporting] = useState(false);
  const [fileImporting, setFileImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const matchCategories = (data.matchCategories || []).filter((category) => category.team_id === selectedTeamId);
  const gameplayRoster = (data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role));
  const progressTimer = useRef(null);
  useEffect(() => { onBusyChange?.(importing || fileImporting); }, [importing, fileImporting, onBusyChange]);
  useEffect(() => () => { window.clearTimeout(progressTimer.current); }, []);
  useEffect(() => { resetImportDraft(); setUploadProgress(null); }, [selectedTeamId]);
  function updateUploadProgress(next) {
    setUploadProgress((current) => ({ ...(current || {}), ...(next || {}), active: true }));
  }
  function clearUploadProgressSoon() {
    window.clearTimeout(progressTimer.current);
    progressTimer.current = window.setTimeout(() => setUploadProgress(null), 1200);
  }
  function updateLaneAssignment(role, value) {
    setLaneAssignments((current) => ({ ...current, [role]: value }));
  }
  function updateEnemyLaneAssignment(role, value) {
    setEnemyLaneAssignments((current) => ({ ...current, [role]: value }));
  }
  function updatePlayerAssignment(role, value) {
    setPlayerAssignments((current) => ({ ...current, [role]: value }));
  }
  function rosterAssignmentsByRole() {
    return COMP_ROLES.reduce((next, role) => {
      next[role] = gameplayRoster.find((player) => player.role === role)?.id || "";
      return next;
    }, {});
  }
  function normalizePreviewRole(value) {
    const raw = String(value || "").toUpperCase();
    if (raw === "JUNGLE") return "JGL";
    if (raw === "MIDDLE") return "MID";
    if (raw === "BOTTOM") return "ADC";
    if (raw === "UTILITY" || raw === "SUPPORT") return "SUP";
    if (COMP_ROLES.includes(raw)) return raw;
    return "";
  }
  function previewRiotRole(participant) {
    return normalizePreviewRole(participant?.teamPosition || participant?.individualPosition || participant?.lane);
  }
  function previewFallbackRole(participant, index) {
    const participantId = Number(participant?.participantId || 0);
    if (participantId) return COMP_ROLES[(participantId - 1) % 5] || "";
    return COMP_ROLES[index] || "";
  }
  function previewRole(participant, index) {
    return previewRiotRole(participant) || previewFallbackRole(participant, index);
  }
  function previewAssignmentValue(participant) {
    return participant?.riotId || participant?.summonerName || participant?.champion || "";
  }
  function preportIdentityKeys(participant) {
    const riotId = String(participant?.riotId || "").trim();
    const summonerName = String(participant?.summonerName || "").trim();
    const values = [riotId, summonerName];
    if (riotId.includes("#")) values.push(riotId.split("#")[0]);
    return [...new Set(values.map(normalizeProfileKey).filter(Boolean))];
  }
  function rosterIdentityLookup() {
    const lookup = new Map();
    gameplayRoster.forEach((player) => {
      [player.riot_id, player.name].forEach((value) => {
        const key = normalizeProfileKey(value);
        if (key && !lookup.has(key)) lookup.set(key, player);
      });
      const riotName = String(player.riot_id || "").split("#")[0];
      const riotNameKey = normalizeProfileKey(riotName);
      if (riotNameKey && !lookup.has(riotNameKey)) lookup.set(riotNameKey, player);
    });
    return lookup;
  }
  function matchedRosterPlayer(participant, lookup) {
    return preportIdentityKeys(participant).map((key) => lookup.get(key)).find(Boolean) || null;
  }
  function previewRoleScore(participant, role, index, matchedPlayer) {
    const riotRole = previewRiotRole(participant);
    const fallbackRole = previewFallbackRole(participant, index);
    const champion = participant?.champion;
    let score = 0;
    if (matchedPlayer?.role === role) score += 140;
    if (matchedPlayer && matchedPlayer.role !== role) score -= 70;
    if (riotRole === role) score += 110;
    if (riotRole && riotRole !== role) score -= 55;
    if (champion && championMatchesLane(champion, role)) score += 28;
    if (fallbackRole === role) score += 10;
    return score;
  }
  function roleParticipantMapForSide(side) {
    const team = previewTeams.find((item) => item.side === side);
    const participants = [...(team?.participants || [])].sort((a, b) => Number(a.participantId || 0) - Number(b.participantId || 0));
    const lookup = rosterIdentityLookup();
    const candidates = [];
    participants.forEach((participant, index) => {
      const matched = matchedRosterPlayer(participant, lookup);
      COMP_ROLES.forEach((role) => {
        candidates.push({ role, participant, matched, score: previewRoleScore(participant, role, index, matched) });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    const byRole = new Map();
    const usedParticipants = new Set();
    candidates.forEach((candidate) => {
      const key = candidate.participant?.participantId || previewAssignmentValue(candidate.participant);
      if (!key || candidate.score <= -40 || byRole.has(candidate.role) || usedParticipants.has(key)) return;
      byRole.set(candidate.role, candidate);
      usedParticipants.add(key);
    });
    COMP_ROLES.forEach((role) => {
      if (byRole.has(role)) return;
      const fallback = participants.find((participant, index) => {
        const key = participant?.participantId || previewAssignmentValue(participant);
        return !usedParticipants.has(key) && previewFallbackRole(participant, index) === role;
      }) || participants.find((participant) => {
        const key = participant?.participantId || previewAssignmentValue(participant);
        return !usedParticipants.has(key);
      });
      if (!fallback) return;
      const key = fallback?.participantId || previewAssignmentValue(fallback);
      byRole.set(role, { role, participant: fallback, matched: matchedRosterPlayer(fallback, lookup), score: 0 });
      usedParticipants.add(key);
    });
    return byRole;
  }
  function laneAssignmentsForSide(side) {
    const byRole = roleParticipantMapForSide(side);
    return COMP_ROLES.reduce((next, role) => {
      next[role] = previewAssignmentValue(byRole.get(role)?.participant);
      return next;
    }, {});
  }
  function playerAssignmentsForSide(side) {
    const defaults = rosterAssignmentsByRole();
    const byRole = roleParticipantMapForSide(side);
    return COMP_ROLES.reduce((next, role) => {
      next[role] = byRole.get(role)?.matched?.id || defaults[role] || "";
      return next;
    }, {});
  }
  function selectImportSide(side) {
    const enemySide = side === "BLUE" ? "RED" : "BLUE";
    setAllyTeamSide(side);
    setLaneAssignments(laneAssignmentsForSide(side));
    setEnemyLaneAssignments(laneAssignmentsForSide(enemySide));
    setPlayerAssignments(playerAssignmentsForSide(side));
  }
  function resetImportDraft() {
    setImportPreview(null);
    setPreviewPayload(null);
    setAllyTeamSide("");
    setImportDetails({ label: "", categoryIds: [] });
    setLaneAssignments({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
    setEnemyLaneAssignments({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
    setPlayerAssignments({ TOP: "", JGL: "", MID: "", ADC: "", SUP: "" });
  }
  async function confirmImport(event) {
    event?.preventDefault();
    if (importing || !importReady) return;
    window.clearTimeout(progressTimer.current);
    const payload = { teamId: selectedTeamId, payload: previewPayload, laneAssignments, enemyLaneAssignments, playerAssignments, allyTeamSide, label: importDetails.label, categoryIds: importDetails.categoryIds || [] };
    setImporting(true);
    setUploadProgress({ active: true, label: "Import final", phase: "upload", percent: 0, loaded: 0, total: 0 });
    try {
      const result = await apiUploadJson("matches-import-file", payload, updateUploadProgress);
      resetImportDraft();
      await refreshAll();
      pushToast({ type: "green", title: "Game importée", text: "Side, profils et lanes ont été appliqués à cette game." });
      for (const warning of result?.warnings || []) pushToast({ type: "yellow", title: "Analyse à compléter", text: warning.message });
      clearUploadProgressSoon();
      onImported?.(result);
    } catch (err) {
      pushToast(errorToast(err, "Import impossible", "match-import"));
      clearUploadProgressSoon();
    } finally {
      setImporting(false);
    }
  }
  async function importLocalFile(file) {
    if (!file || importing || fileImporting || !selectedTeamId) return;
    window.clearTimeout(progressTimer.current);
    setFileImporting(true);
    setUploadProgress({ active: true, label: file.name || "Prévisualisation JSON", phase: "prepare", percent: 0, loaded: 0, total: file.size || 0 });
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await apiUploadJson("matches-import-file", { teamId: selectedTeamId, payload, previewOnly: true }, updateUploadProgress);
      resetImportDraft();
      setPreviewPayload(payload);
      setImportPreview(result.match);
      setImportDetails({
        label: payload?.label || payload?.metadata?.label || payload?.opponent || payload?.metadata?.opponent || "",
        categoryIds: []
      });
      pushToast({ type: "green", title: "JSON chargé", text: "Choisis ton side, les champions et les profils avant de confirmer." });
      clearUploadProgressSoon();
    } catch (err) {
      if (err instanceof SyntaxError) pushToast({ type: "red", title: "Import fichier impossible", text: "Le fichier choisi n’est pas un JSON valide. Génère-le avec NXT5 Importer." });
      else pushToast(errorToast(err, "Import fichier impossible", "match-import"));
      clearUploadProgressSoon();
    } finally {
      setFileImporting(false);
    }
  }

  const laneAssignmentsReady = COMP_ROLES.every((role) => String(laneAssignments[role] || "").trim() && String(playerAssignments[role] || "").trim());
  const enemyAssignmentsReady = COMP_ROLES.every((role) => String(enemyLaneAssignments[role] || "").trim());
  const importReady = Boolean(importPreview && allyTeamSide && laneAssignmentsReady && enemyAssignmentsReady && importDetails.label.trim());
  const previewTeams = importPreview?.teams || [];
  const allyPreviewTeam = previewTeams.find((team) => team.side === allyTeamSide);
  const enemyPreviewTeam = previewTeams.find((team) => team.side && team.side !== allyTeamSide);
  const selectedPreviewParticipant = (team, value) => (team?.participants || []).find((participant) => previewAssignmentValue(participant) === value);
  const importFlowSteps = [
    [Upload, "JSON", "Charge le fichier de la game.", Boolean(importPreview)],
    [Shield, "Side", "Choisis ton équipe dans la game.", Boolean(allyTeamSide)],
    [Users, "Roster", "Valide lanes et profils NXT5.", laneAssignmentsReady && enemyAssignmentsReady],
    [Check, "Résumé", "Nom, catégorie et import final.", importReady],
  ];
  return <div className="nxt5-data-dense nxt5-import-page game-import-flow grid min-w-0 gap-5">
        <ImporterDownloadPanel fileImporting={fileImporting || importing} hasTeam={Boolean(selectedTeamId)} hasPreview={Boolean(importPreview)} onImport={importLocalFile}>
          {uploadProgress?.active && <div className="mt-4"><JsonUploadProgress progress={uploadProgress} /></div>}
        </ImporterDownloadPanel>

        {importPreview && <Surface className="min-w-0 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0"><Badge tone={importReady ? "green" : "orange"}>{importReady ? "Prêt à importer" : "À compléter"}</Badge><h3 className="mt-3 text-2xl font-black text-white">Assignation de la game</h3><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Sélectionne le side de ton équipe, puis valide les lanes et profils avant de confirmer l’import.</p></div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {importFlowSteps.map(([Icon, title, text, done], index) => <div key={`rail-${title}`} className={cx("min-w-0 rounded-2xl p-3", done ? "bg-cyan-300/[0.10] text-cyan-50" : "bg-white/[0.035] text-slate-300")}>
              <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0" /><span className="text-xs font-black uppercase tracking-[0.14em]">{index + 1}. {title}</span></span>{done && <Check className="h-4 w-4 shrink-0" />}</div>
              <p className="mt-1 truncate text-[0.68rem] font-semibold text-slate-400">{text}</p>
            </div>)}
          </div>
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(240px,.9fr)_minmax(260px,1.1fr)]">
                  <TextInput label="Nom de la game" value={importDetails.label} onChange={(label) => setImportDetails((current) => ({ ...current, label }))} placeholder="Game 1 vs BK, Finale LB..." required icon={FileText} />
                  <CategoryMultiSelect categories={matchCategories} selectedIds={importDetails.categoryIds || []} onChange={(categoryIds) => setImportDetails((current) => ({ ...current, categoryIds }))} />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {previewTeams.map((team) => <button key={team.side} type="button" onClick={() => selectImportSide(team.side)} aria-pressed={allyTeamSide === team.side} className={cx("rounded-2xl border p-4 text-left transition-colors", allyTeamSide === team.side ? "border-cyan-300/45 bg-cyan-400/14 shadow-[0_0_24px_rgba(34,211,238,.10)]" : "border-white/10 bg-black/24 hover:bg-white/[0.045]")}>
                    <div className="flex items-center justify-between gap-3"><p className="font-black text-white">{team.side === "BLUE" ? "Blue Side" : "Red Side"}</p><Badge tone={team.win ? "green" : "red"}>{team.win ? "Victoire" : "Défaite"}</Badge></div>
                    <div className="mt-3 flex flex-wrap gap-2">{team.participants.map((participant) => <div key={participant.participantId} className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3"><ChampionPortrait champion={participant.champion} alt={participant.champion} className="h-7 w-7 shrink-0 rounded-full object-cover" /><span className="truncate text-xs font-black text-white">{championDisplayName(participant.champion)}</span></div>)}</div>
                  </button>)}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-lg font-black text-white">Notre équipe</h4><Badge tone="cyan">{allyTeamSide || "Side ?"}</Badge></div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {COMP_ROLES.map((role) => {
                        const assignedPlayer = gameplayRoster.find((player) => player.id === playerAssignments[role]) || gameplayRoster.find((player) => player.role === role);
                        const pickedChampion = selectedPreviewParticipant(allyPreviewTeam, laneAssignments[role]);
                        return <div key={role} className={cx("min-w-0 rounded-2xl border p-3 transition", laneAssignments[role] && playerAssignments[role] ? "border-cyan-200/22 bg-cyan-400/[0.06]" : "border-white/10 bg-black/25")}>
                          <ImportRoleHeader role={role} player={assignedPlayer} />
                          <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/24 p-2">
                            {pickedChampion ? <ChampionPortrait champion={pickedChampion.champion} alt={pickedChampion.champion} className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/12 text-slate-500"><Swords className="h-4 w-4" /></span>}
                            <div className="min-w-0"><p className="truncate text-sm font-black text-white">{pickedChampion ? championDisplayName(pickedChampion.champion) : "Champion à choisir"}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">{pickedChampion?.riotId || pickedChampion?.summonerName || "Sélection JSON"}</p></div>
                          </div>
                          <select aria-label={`Champion allié · ${roleLabel(role)}`} value={laneAssignments[role] || ""} onChange={(event) => updateLaneAssignment(role, event.target.value)} disabled={!allyPreviewTeam} className="w-full rounded-xl border border-white/10 bg-black/[0.28] px-3 py-2 text-xs font-black text-white outline-none">
                            <option value="">Champion joué</option>
                            {(allyPreviewTeam?.participants || []).map((participant) => <option key={participant.participantId} value={participant.riotId || participant.summonerName || participant.champion}>{championDisplayName(participant.champion)} · {participant.riotId || participant.summonerName}</option>)}
                          </select>
                          <select aria-label={`Profil NXT5 · ${roleLabel(role)}`} value={playerAssignments[role] || ""} onChange={(event) => updatePlayerAssignment(role, event.target.value)} disabled={!allyPreviewTeam} className="mt-2 w-full rounded-xl border border-cyan-300/14 bg-cyan-400/[0.07] px-3 py-2 text-xs font-black text-white outline-none">
                            <option value="">Profil NXT5 lié</option>
                            {gameplayRoster.map((player) => <option key={player.id} value={player.id}>{roleLabel(player.role)} · {player.name}{player.riot_id ? ` · ${player.riot_id}` : ""}</option>)}
                          </select>
                        </div>;
                      })}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-rose-300/14 bg-rose-500/[0.055] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-lg font-black text-white">Équipe adverse</h4><Badge tone="red">{enemyPreviewTeam?.side || "Side ?"}</Badge></div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {COMP_ROLES.map((role) => {
                        const pickedChampion = selectedPreviewParticipant(enemyPreviewTeam, enemyLaneAssignments[role]);
                        return (
                        <div key={role} className={cx("min-w-0 rounded-2xl border p-3 transition", enemyLaneAssignments[role] ? "border-rose-200/22 bg-rose-500/[0.06]" : "border-white/10 bg-black/25")}>
                          <ImportRoleHeader role={role} toneName="red" fallbackLabel="Adverse" />
                          <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/24 p-2">
                            {pickedChampion ? <ChampionPortrait champion={pickedChampion.champion} alt={pickedChampion.champion} className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/12 text-slate-500"><Shield className="h-4 w-4" /></span>}
                            <div className="min-w-0"><p className="truncate text-sm font-black text-white">{pickedChampion ? championDisplayName(pickedChampion.champion) : "Champion adverse"}</p><p className="truncate text-[0.62rem] font-semibold text-slate-300">{pickedChampion?.riotId || pickedChampion?.summonerName || "Sélection JSON"}</p></div>
                          </div>
                          <select aria-label={`Champion adverse · ${roleLabel(role)}`} value={enemyLaneAssignments[role] || ""} onChange={(event) => updateEnemyLaneAssignment(role, event.target.value)} disabled={!enemyPreviewTeam} className="w-full rounded-xl border border-white/10 bg-black/[0.28] px-3 py-2 text-xs font-black text-white outline-none">
                            <option value="">Champion adverse</option>
                            {(enemyPreviewTeam?.participants || []).map((participant) => <option key={participant.participantId} value={participant.riotId || participant.summonerName || participant.champion}>{championDisplayName(participant.champion)} · {participant.riotId || participant.summonerName}</option>)}
                          </select>
                        </div>
                      );})}
                    </div>
                  </div>
                </div>
                 {importReady && <div className="rounded-2xl border border-emerald-200/16 bg-emerald-400/[0.055] p-4">
                   <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                     <div className="min-w-0">
                       <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-100">Résumé avant import</p>
                       <p className="mt-1 truncate text-lg font-black text-white">{importDetails.label}</p>
                       <p className="mt-1 text-sm font-semibold text-slate-300">{allyTeamSide} side · {COMP_ROLES.map((role) => gameplayRoster.find((player) => player.id === playerAssignments[role])?.name || role).join(" / ")}</p>
                     </div>
                     <Badge tone="green">Prêt</Badge>
                   </div>
                 </div>}
                 <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" icon={X} onClick={() => resetImportDraft()} disabled={importing}>Réinitialiser</Button><Button type="button" icon={importing ? Loader2 : Check} onClick={confirmImport} disabled={importing || !importReady}>Confirmer l’import</Button></div>
              </div>
        </Surface>}

  </div>;
}
