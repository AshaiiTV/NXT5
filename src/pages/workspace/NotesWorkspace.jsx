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
import { isTeamNote, reportMatchIds, noteBody, savedDebrief } from "../../../shared/report-notes.js";
import { emptyReviewDraft, reviewDraftChanged, reviewDrafts } from "../../utils/review-drafts.js";
import { canStaffManage } from "./workspace-shared.jsx";

function noteDate(note) {
  if (!note.updated_at && !note.created_at) return "";
  const date = new Date(note.updated_at || note.created_at || 0);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(getLocale()) : "";
}

function NotesWorkspace({ data, selectedTeamId, refreshAll, pushToast, currentMember, user, route, match }) {
  useLanguage();
  const params = new URLSearchParams(route?.search ?? (typeof window !== "undefined" ? window.location.search : ""));
  const requestedNoteId = match ? "" : params.get("report") || "";
  const requestedMatchId = params.get("match") || "";
  const wantsCompose = !match && params.get("compose") === "1";
  const notes = useMemo(() => (data.reports || []).filter((note) => note.team_id === selectedTeamId && isTeamNote(note) && (!match || reportMatchIds(note).includes(String(match.id)))), [data.reports, selectedTeamId, match?.id]);
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
  const resumesHere = dirty && (!match || form.matchIds.includes(String(match.id)));
  function canEdit(note) {
    return Boolean(user?.id && (selectedTeam?.owner_id === user.id || (currentMember?.user_id === user.id && currentMember?.team_id === selectedTeamId && canStaffManage(currentMember.role)) || (note.discord_status !== "draft" && note.created_by === user.id)));
  }

  useEffect(() => { reviewDrafts.write(user?.id, selectedTeamId, form, baseline); }, [user?.id, selectedTeamId, form, baseline]);
  useEffect(() => { setSelectedId(requestedNoteId); }, [requestedNoteId]);
  const composedFor = useRef("");
  useEffect(() => {
    if (!wantsCompose) { composedFor.current = ""; return; }
    if (!requestedMatchId || composedFor.current === requestedMatchId) return;
    composedFor.current = requestedMatchId;
    if (dirty && !window.confirm(t("Remplacer le brouillon actuel ?"))) return;
    const match = matchesById.get(requestedMatchId);
    const next = { id: null, title: match ? t("Notes · {0}", [matchDisplayName(match)]) : t("Notes de partie"), content: "", matchIds: [requestedMatchId] };
    setForm(next);
    setBaseline(next);
    setEditing(true);
    window.history.replaceState({}, "", `/notes?match=${encodeURIComponent(requestedMatchId)}`);
  }, [wantsCompose, requestedMatchId, matchesById]);

  const visible = notes.filter((note) => {
    if (!deferredQuery) return true;
    const matchNames = reportMatchIds(note).map((id) => matchDisplayName(matchesById.get(id) || {}, id)).join(" ");
    return [note.title, note.author_name, noteBody(note), matchNames].some((value) => String(value || "").toLocaleLowerCase().includes(deferredQuery));
  }).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

  const requestedLegacy = requestedNoteId && (data.reports || []).find((item) => item.team_id === selectedTeamId && String(item.id) === requestedNoteId && !isTeamNote(item));
  const legacyReport = requestedLegacy && savedDebrief(requestedLegacy);
  const selected = legacyReport ? null : visible.find((note) => String(note.id) === String(selectedId)) || visible.find((note) => requestedMatchId && reportMatchIds(note).includes(requestedMatchId)) || visible[0];
  function begin(next, nextBaseline = emptyReviewDraft()) {
    if (dirty && !window.confirm(t("Remplacer le brouillon actuel ?"))) return;
    setForm(next);
    setBaseline(nextBaseline);
    setEditing(true);
  }

  function createNote() {
    if (resumesHere) { setEditing(true); return; }
    const initial = emptyReviewDraft();
    if (match) {
      initial.title = t("Notes · {0}", [matchDisplayName(match)]);
      initial.matchIds = [String(match.id)];
    }
    begin(initial, initial);
  }
  function selectNote(id) {
    setSelectedId(id);
    openAppPath(`/notes?report=${encodeURIComponent(id)}`);
    if (window.matchMedia?.("(max-width: 1279px)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  function editNote(note) {
    const draft = { id: note.id, title: note.title || "", content: noteBody(note), matchIds: reportMatchIds(note) };
    begin(draft, draft);
  }

  async function saveNote(event) {
    event.preventDefault();
    if (saving || !form.title.trim() || !form.content.trim() || form.matchIds.length > 20) return;
    setSaving(true);
    try {
      const result = await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ kind: "note", action: form.id ? "update" : "create", teamId: selectedTeamId, reportId: form.id, title: form.title.trim(), content: form.content, matchIds: form.matchIds }) });
      setEditing(false);
      setForm(emptyReviewDraft());
      setBaseline(emptyReviewDraft());
      await refreshAll();
      setSelectedId(result.report.id);
      if (!match) openAppPath(`/notes?report=${encodeURIComponent(result.report.id)}`);
      pushToast?.({ type: "green", title: form.id ? "Note mise à jour" : "Note créée", text: "La note est enregistrée." });
    } catch (error) {
      pushToast?.({ type: "red", title: "Enregistrement impossible", text: error.message });
    } finally { setSaving(false); }
  }

  async function deleteNote(note) {
    if (!note || !canEdit(note) || !window.confirm(t("Supprimer cette note ?"))) return;
    setSaving(true);
    try {
      await apiFetch("reports-manage", { method: "POST", body: JSON.stringify({ kind: "note", action: "delete", teamId: selectedTeamId, reportId: note.id }) });
      setSelectedId("");
      await refreshAll();
      if (!match) openAppPath("/notes");
      pushToast?.({ type: "green", title: "Note supprimée", text: "La note a été retirée." });
    } catch (error) {
      pushToast?.({ type: "red", title: "Suppression impossible", text: error.message });
    } finally { setSaving(false); }
  }

  function noteArticle(note) {
    const body = noteBody(note);
    const ids = reportMatchIds(note);
    return <article key={note.id} className="match-note">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="break-words text-lg font-bold">{note.title}</h3>
          <p className="mt-1 text-sm text-slate-300">{[note.author_name, noteDate(note), !note.is_team_note && t("Issue d’un débrief"), note.discord_status === "draft" && t("Brouillon · staff uniquement")].filter(Boolean).join(" · ")}</p></div>
        {canEdit(note) && <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => editNote(note)} disabled={saving}>{t("Modifier")}</Button>
          <Button type="button" variant="ghost" icon={Trash2} aria-label={t("Supprimer la note")} onClick={() => deleteNote(note)} disabled={saving} />
        </div>}
      </header>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{body.trim() ? body : t("Cet ancien débrief ne contient pas de note rédigée par l’équipe.")}</p>
      {ids.some((id) => id !== String(match?.id)) && <div className="mt-4 flex flex-wrap gap-2" aria-label={t("Parties liées")}>{ids.filter((id) => id !== String(match?.id)).map((id) =>
        <a key={id} href={`/games?match=${encodeURIComponent(id)}`} onClick={(event) => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); openAppPath(`/games?match=${encodeURIComponent(id)}`); }} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-100 underline"><ArrowRight aria-hidden="true" className="h-4 w-4" />{matchesById.has(id) ? t("Voir la partie : {0}", [matchDisplayName(matchesById.get(id))]) : t("Partie {0}", [id])}</a>)}</div>}
    </article>;
  }

  const createButton = <Button type="button" icon={Plus} onClick={createNote} disabled={saving || !selectedTeamId}>{resumesHere ? t("Reprendre le brouillon") : t("Nouvelle note")}</Button>;
  return <div className="nxt5-notes-page min-w-0">
    {match ? <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="text-lg font-semibold">{t("Notes de la partie")}</h4>{createButton}
    </div> : <PageHeader title={t("Notes")} subtitle={t("Garde les observations et décisions de l’équipe au même endroit.")}>{createButton}</PageHeader>}
    {resumesHere && !editing && <p role="status" className="mb-4 text-sm text-slate-300">{t("Un brouillon est conservé pendant cette session. Enregistre-le avant de recharger la page.")}</p>}
    {match ? <div className="match-note-list">{visible.length ? visible.map(noteArticle) : <p className="py-5 text-sm text-slate-300">{t("Aucune note pour cette partie.")}</p>}</div> :
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
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{note.title}</strong><span className="mt-1 block truncate text-xs text-slate-300">{note.author_name || "NXT5"} · {noteDate(note)}</span><span className="mt-1 block truncate text-xs text-cyan-100/80">{reportMatchIds(note).length ? t(reportMatchIds(note).length > 1 ? "{0} parties liées" : "{0} partie liée", [reportMatchIds(note).length]) : t("Sans partie liée")}</span></span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </li>)}</ul> : <div className="p-4 sm:p-5"><EmptyState icon={FileText} title={query ? t("Aucune note trouvée") : t("Aucune note") } text={query ? t("Essaie une autre recherche.") : t("Ajoute une première observation pour ton équipe.")} /></div>}
      </Surface>
      {(selected || legacyReport) && <div ref={detailRef} className="min-w-0 scroll-mt-4"><Surface variant="reading" className="min-w-0 p-5 sm:p-6">
        {selected ? noteArticle(selected) : <><h2 className="text-lg font-semibold">{legacyReport.title}</h2>
          {reportMatchIds(legacyReport).map((id) => <Button key={id} type="button" variant="ghost" icon={ArrowRight} onClick={() => openAppPath(`/games?match=${encodeURIComponent(id)}`)}>{matchesById.has(id) ? t("Voir la partie : {0}", [matchDisplayName(matchesById.get(id))]) : t("Voir la partie")}</Button>)}
          {!reportMatchIds(legacyReport).length && <p className="mt-4 whitespace-pre-wrap break-words">{legacyReport.content}</p>}</>}
      </Surface></div>}
    </div>}
    {editing && <ModalDialog aria-labelledby="note-editor-title" className="team-note-editor w-[min(44rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-cyan-200/25 bg-[var(--nxt5-surface)] p-5 text-white sm:p-6" busy={saving} handleHistory onClose={() => setEditing(false)}>
      <form onSubmit={saveNote}><fieldset disabled={saving} className="min-w-0">
        <div className="flex items-start justify-between gap-3"><div><h2 id="note-editor-title" className="text-xl font-bold sm:text-2xl">{form.id ? t("Modifier la note") : t("Nouvelle note")}</h2><p className="mt-2 text-sm text-slate-300">{t("Écris ce que l’équipe veut retenir ou essayer ensuite.")}</p></div><Button type="button" variant="ghost" className="shrink-0" icon={X} aria-label={t("Fermer")} onClick={() => setEditing(false)} /></div>
        <label className="mt-5 block text-sm font-semibold">{t("Titre")}<input autoFocus value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} maxLength={140} required className="mt-2 block min-h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 text-base text-white focus:border-cyan-200 focus:outline-none" /></label>
        <label className="mt-4 block text-sm font-semibold">{t("Note de l’équipe")}<textarea value={form.content} onChange={(event) => setForm((value) => ({ ...value, content: event.target.value }))} required rows={9} className="mt-2 block min-h-48 w-full resize-y rounded-xl border border-white/15 bg-black/25 p-3 text-base leading-6 text-white focus:border-cyan-200 focus:outline-none" /></label>
        {match && <p className="mt-3 text-sm text-slate-300">{t("Partie liée : {0}", [matchDisplayName(match)])}</p>}
        <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{t("Associer des parties ({0})", [form.matchIds.length])}</summary><div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{[...new Set([...form.matchIds, ...matches.map((match) => String(match.id))])].map((id) => <label key={id} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-white/[0.05]"><input type="checkbox" disabled={Boolean(match) && id === String(match.id)} checked={form.matchIds.includes(id)} onChange={() => setForm((value) => ({ ...value, matchIds: value.matchIds.includes(id) ? value.matchIds.filter((item) => item !== id) : [...value.matchIds, id] }))} /><span>{matchesById.has(id) ? matchDisplayName(matchesById.get(id)) : t("Partie {0}", [id])}</span></label>)}</div>{form.matchIds.length > 20 && <p role="alert" className="mt-2 text-sm text-amber-100">{t("20 parties maximum par note.")}</p>}</details>
        <div className="team-note-editor-actions mt-5"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>{dirty ? t("Fermer et garder le brouillon") : t("Annuler")}</Button><Button type="submit" disabled={saving || !form.title.trim() || !form.content.trim() || form.matchIds.length > 20}>{saving ? t("Enregistrement…") : t("Enregistrer la note")}</Button></div>
      </fieldset></form>
    </ModalDialog>}
  </div>;
}

export default NotesWorkspace;
