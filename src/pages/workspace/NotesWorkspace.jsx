import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText, Plus, Search, Trash2, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { openAppPath } from "../../app/routing.js";
import { Button, EmptyState, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { ModalDialog } from "../../components/ui/ModalDialog.jsx";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { matchDisplayName } from "../../utils/matches.js";
import { staffNotesFromReport } from "../../utils/report-notes.js";
import { emptyReviewDraft, reviewDraftChanged, reviewDrafts } from "../../utils/review-drafts.js";
import { canStaffManage } from "./workspace-shared.jsx";

function linkedIds(note) {
  if (Array.isArray(note?.match_ids)) return note.match_ids.map(String);
  if (typeof note?.match_ids === "string") {
    try { const ids = JSON.parse(note.match_ids); if (Array.isArray(ids)) return ids.map(String); } catch { /* Legacy single match below. */ }
  }
  return note?.match_id ? [String(note.match_id)] : [];
}

function noteDate(note) {
  if (!note.updated_at && !note.created_at) return "";
  const date = new Date(note.updated_at || note.created_at || 0);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(getLocale()) : "";
}

function NotesWorkspace({ data, selectedTeamId, refreshAll, pushToast, currentMember, user, route }) {
  useLanguage();
  const params = new URLSearchParams(route?.search || window.location.search);
  const requestedNoteId = params.get("report") || "";
  const requestedMatchId = params.get("match") || "";
  const wantsCompose = params.get("compose") === "1";
  const notes = useMemo(() => (data.reports || []).filter((note) => note.team_id === selectedTeamId && note.source !== "auto"), [data.reports, selectedTeamId]);
  const selectedTeam = (data.teams || []).find((team) => team.id === selectedTeamId);
  const matches = useMemo(() => (data.matches || []).filter((match) => match.team_id === selectedTeamId), [data.matches, selectedTeamId]);
  const matchesById = useMemo(() => new Map(matches.map((match) => [String(match.id), match])), [matches]);
  const [selectedId, setSelectedId] = useState(requestedNoteId);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const [form, setForm] = useState(() => reviewDrafts.read(user?.id, selectedTeamId));
  const [baseline, setBaseline] = useState(() => reviewDrafts.readBaseline(user?.id, selectedTeamId));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const detailRef = useRef(null);
  const dirty = reviewDraftChanged(form, baseline);
  const selected = selectedId ? notes.find((note) => String(note.id) === String(selectedId)) || null : notes[0] || null;
  const canEdit = selected && (selectedTeam?.owner_id === user?.id || canStaffManage(currentMember?.role) || selected.created_by === user?.id);

  useEffect(() => { reviewDrafts.write(user?.id, selectedTeamId, form, baseline); }, [user?.id, selectedTeamId, form, baseline]);
  useEffect(() => { if (requestedNoteId) setSelectedId(requestedNoteId); }, [requestedNoteId]);
  useEffect(() => {
    if (!wantsCompose || !requestedMatchId) return;
    if (dirty && !window.confirm(t("Remplacer le brouillon actuel ?"))) return;
    const match = matchesById.get(requestedMatchId);
    setForm({ id: null, title: match ? `Notes · ${matchDisplayName(match)}` : t("Notes de partie"), content: "", matchIds: [requestedMatchId] });
    setBaseline(emptyReviewDraft());
    setEditing(true);
    window.history.replaceState({}, "", `/notes?match=${encodeURIComponent(requestedMatchId)}`);
  }, [wantsCompose, requestedMatchId, matchesById]);

  const visible = notes.filter((note) => {
    if (!deferredQuery) return true;
    const matchNames = linkedIds(note).map((id) => matchDisplayName(matchesById.get(id) || {}, id)).join(" ");
    return [note.title, note.author_name, staffNotesFromReport(note.content), matchNames].some((value) => String(value || "").toLocaleLowerCase().includes(deferredQuery));
  }).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

  function begin(next, nextBaseline = emptyReviewDraft()) {
    if (dirty && !window.confirm(t("Remplacer le brouillon actuel ?"))) return;
    setForm(next);
    setBaseline(nextBaseline);
    setEditing(true);
  }

  function createNote() { if (dirty) setEditing(true); else begin(emptyReviewDraft()); }
  function selectNote(id) {
    setSelectedId(id);
    openAppPath(`/notes?report=${encodeURIComponent(id)}`);
    if (window.matchMedia?.("(max-width: 1279px)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  function editNote(note) {
    const draft = { id: note.id, title: note.title || "", content: staffNotesFromReport(note.content), matchIds: linkedIds(note) };
    begin(draft, draft);
  }

  async function saveNote(event) {
    event.preventDefault();
    if (saving || !form.title.trim() || !form.content.trim() || form.matchIds.length > 20) return;
    setSaving(true);
    try {
      const result = await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: form.id ? "update" : "create", teamId: selectedTeamId, reportId: form.id, title: form.title.trim(), content: form.content, matchIds: form.matchIds }) });
      setEditing(false);
      setForm(emptyReviewDraft());
      setBaseline(emptyReviewDraft());
      await refreshAll();
      setSelectedId(result.report.id);
      openAppPath(`/notes?report=${encodeURIComponent(result.report.id)}`);
      pushToast?.({ type: "green", title: form.id ? "Note mise à jour" : "Note créée", text: "La note est enregistrée." });
    } catch (error) {
      pushToast?.({ type: "red", title: "Enregistrement impossible", text: error.message });
    } finally { setSaving(false); }
  }

  async function deleteNote() {
    if (!selected || !canEdit || !window.confirm(t("Supprimer cette note ?"))) return;
    setSaving(true);
    try {
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ action: "delete", teamId: selectedTeamId, reportId: selected.id }) });
      setSelectedId("");
      await refreshAll();
      openAppPath("/notes");
      pushToast?.({ type: "green", title: "Note supprimée", text: "La note a été retirée." });
    } catch (error) {
      pushToast?.({ type: "red", title: "Suppression impossible", text: error.message });
    } finally { setSaving(false); }
  }

  const selectedBody = selected ? staffNotesFromReport(selected.content) : "";
  return <div className="nxt5-notes-page min-w-0">
    <PageHeader title={t("Notes")} subtitle={t("Garde les observations et décisions de l’équipe au même endroit.")}>
      <Button type="button" icon={Plus} onClick={createNote}>{dirty ? t("Reprendre le brouillon") : t("Nouvelle note")}</Button>
    </PageHeader>
    {dirty && !editing && <p role="status" className="mb-4 text-sm text-slate-300">{t("Un brouillon est conservé pendant cette session. Enregistre-le avant de recharger la page.")}</p>}
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <Surface variant="glass" className="min-w-0 self-start overflow-hidden p-0">
        <div className="border-b border-white/10 p-4 sm:p-5">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 focus-within:border-cyan-200/60 focus-within:ring-2 focus-within:ring-cyan-300/15">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-100" />
            <span className="sr-only">{t("Rechercher une note")}</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Rechercher dans les notes")} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
          </label>
          <p className="mt-3 text-xs font-semibold text-slate-300">{t(visible.length > 1 ? "{0} notes" : "{0} note", [visible.length])}</p>
        </div>
        {visible.length ? <ul className="max-h-[min(65vh,42rem)] overflow-y-auto">
          {visible.map((note) => <li key={note.id} className="border-b border-white/10 last:border-b-0">
            <button type="button" aria-current={selected?.id === note.id ? "true" : undefined} onClick={() => selectNote(note.id)} className={`flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-200 sm:px-5 ${selected?.id === note.id ? "bg-cyan-300/10" : "hover:bg-white/[0.05]"}`}>
              <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-100" />
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{note.title}</strong><span className="mt-1 block truncate text-xs text-slate-300">{note.author_name || "NXT5"} · {noteDate(note)}</span><span className="mt-1 block truncate text-xs text-cyan-100/80">{linkedIds(note).length ? t(linkedIds(note).length > 1 ? "{0} parties liées" : "{0} partie liée", [linkedIds(note).length]) : t("Sans partie liée")}</span></span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </li>)}</ul> : <div className="p-4 sm:p-5"><EmptyState icon={FileText} title={query ? t("Aucune note trouvée") : t("Aucune note") } text={query ? t("Essaie une autre recherche.") : t("Ajoute une première observation pour ton équipe.")} /></div>}
      </Surface>
      <div ref={detailRef} className="min-w-0 scroll-mt-4"><Surface variant="reading" className="min-w-0 p-5 sm:p-6">
        {selected ? <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div className="min-w-0"><h2 className="break-words text-xl font-bold text-white sm:text-2xl">{selected.title}</h2><p className="mt-2 text-sm text-slate-300">{t("Par {0} · {1}", [selected.author_name || "NXT5", noteDate(selected)])}</p></div>
            {canEdit && <div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => editNote(selected)}>{t("Modifier")}</Button><Button type="button" variant="ghost" icon={Trash2} aria-label={t("Supprimer la note")} onClick={deleteNote} disabled={saving} /></div>}
          </div>
          {selectedBody.trim() ? <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-100">{selectedBody}</p> : <p className="mt-5 text-sm text-slate-300">{t("Cet ancien débrief ne contient pas de note rédigée par l’équipe.")}</p>}
          {linkedIds(selected).length > 0 && <div className="mt-6 border-t border-white/10 pt-4"><h3 className="text-sm font-semibold text-white">{t("Parties liées")}</h3><div className="mt-3 flex flex-wrap gap-2">{linkedIds(selected).map((id) => <a key={id} href={`/games?match=${encodeURIComponent(id)}`} onClick={(event) => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); openAppPath(`/games?match=${encodeURIComponent(id)}`); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm font-semibold text-cyan-100 hover:border-cyan-200/40 focus-visible:outline-2 focus-visible:outline-cyan-200"><ArrowRight aria-hidden="true" className="h-4 w-4" />{matchesById.has(id) ? t("Voir la partie : {0}", [matchDisplayName(matchesById.get(id))]) : t("Voir la partie")}</a>)}</div></div>}
        </> : <EmptyState icon={FileText} title={t("Aucune note sélectionnée")} text={t("Choisis une note ou crée la première.")} />}
      </Surface></div>
    </div>
    {editing && <ModalDialog aria-labelledby="note-editor-title" className="w-[min(44rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-cyan-200/25 bg-[var(--nxt5-surface)] p-5 text-white sm:p-6" busy={saving} handleHistory onClose={() => setEditing(false)}>
      <form onSubmit={saveNote}>
        <div className="flex items-start justify-between gap-3"><div><h2 id="note-editor-title" className="text-xl font-bold sm:text-2xl">{form.id ? t("Modifier la note") : t("Nouvelle note")}</h2><p className="mt-2 text-sm text-slate-300">{t("Écris ce que l’équipe veut retenir ou essayer ensuite.")}</p></div><Button type="button" variant="ghost" icon={X} aria-label={t("Fermer")} onClick={() => setEditing(false)} /></div>
        <label className="mt-5 block text-sm font-semibold">{t("Titre")}<input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} maxLength={140} required className="mt-2 block min-h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-base text-white focus:border-cyan-200 focus:outline-none" /></label>
        <label className="mt-4 block text-sm font-semibold">{t("Note de l’équipe")}<textarea value={form.content} onChange={(event) => setForm((value) => ({ ...value, content: event.target.value }))} required rows={9} className="mt-2 block min-h-48 w-full resize-y rounded-xl border border-white/15 bg-black/25 p-3 text-base leading-6 text-white focus:border-cyan-200 focus:outline-none" /></label>
        <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{t("Associer des parties ({0})", [form.matchIds.length])}</summary><div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{[...new Set([...form.matchIds, ...matches.map((match) => String(match.id))])].map((id) => <label key={id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-white/[0.05]"><input type="checkbox" checked={form.matchIds.includes(id)} onChange={() => setForm((value) => ({ ...value, matchIds: value.matchIds.includes(id) ? value.matchIds.filter((item) => item !== id) : [...value.matchIds, id] }))} /><span>{matchesById.has(id) ? matchDisplayName(matchesById.get(id)) : t("Partie {0}", [id])}</span></label>)}</div>{form.matchIds.length > 20 && <p role="alert" className="mt-2 text-sm text-amber-100">{t("20 parties maximum par note.")}</p>}</details>
        <div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>{dirty ? t("Fermer et garder le brouillon") : t("Annuler")}</Button><Button type="submit" disabled={saving || !form.title.trim() || !form.content.trim() || form.matchIds.length > 20}>{saving ? t("Enregistrement…") : t("Enregistrer la note")}</Button></div>
      </form>
    </ModalDialog>}
  </div>;
}

export default NotesWorkspace;
