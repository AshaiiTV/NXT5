import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, Link, Loader2, RefreshCw, Unlink, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Badge, Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import { DraftSnapshot, SnapshotContext, SourceLink } from "./OpponentsWorkspace.jsx";
import DraftBoard from "../draft/DraftBoard.jsx";
import "./match-drafter-panel.css";

function MatchDraft({ teamId, matchId, onChanged }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [load, setLoad] = useState("loading");
  const [reload, setReload] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [side, setSide] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  const requests = useRef(new Set());
  const previewRequest = useRef(null);
  const previewRevision = useRef(0);
  const mutation = useRef(false);
  const previewTitle = useRef(null);

  useEffect(() => {
    mounted.current = true;
    const pending = requests.current;
    return () => { mounted.current = false; for (const request of pending) request.abort(); pending.clear(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoad("loading"); setError("");
    apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "get-match-draft", teamId, matchId }), signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setDraft(result.draft || null); setCanEdit(result.canEdit === true);
        setEditorOpen(!result.draft && result.canEdit === true); setLoad("ready");
      }).catch((failure) => { if (!controller.signal.aborted) { setError(failure.message || t("Impossible de charger la draft liée.")); setLoad("error"); } });
    return () => controller.abort();
  }, [teamId, matchId, reload]);

  async function request(action, payload = {}, controller = new AbortController()) {
    requests.current.add(controller);
    try {
      return await apiFetch("opponents-drafts", {
        method: "POST", body: JSON.stringify({ action, teamId, ...(action === "preview" ? {} : { matchId }), ...payload }),
        signal: controller.signal, timeoutMs: action === "preview" ? 45000 : 20000,
      });
    } finally { requests.current.delete(controller); }
  }

  function changeUrl(value) {
    previewRevision.current += 1; previewRequest.current?.abort();
    setUrl(value); setPreview(null); setSide(""); setError(""); setNotice("");
    if (!mutation.current) setBusy("");
  }

  function toggleEditor(open) {
    changeUrl(""); setEditorOpen(open); setUnlinkOpen(false);
  }

  async function readDraft(event) {
    event.preventDefault();
    if (!canEdit || !url.trim() || mutation.current) return;
    previewRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    const revision = ++previewRevision.current;
    setBusy("preview"); setError(""); setNotice(""); setPreview(null); setSide("");
    try {
      const result = await request("preview", { url: url.trim() }, controller);
      if (mounted.current && !controller.signal.aborted && revision === previewRevision.current) setPreview(result);
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted && revision === previewRevision.current) setError(failure.message || t("Impossible de lire cette draft. Vérifie le lien puis réessaie."));
    } finally {
      if (mounted.current && revision === previewRevision.current) setBusy("");
    }
  }
  useEffect(() => { if (preview) previewTitle.current?.focus(); }, [preview]);

  async function refreshAfterSave() {
    try { await onChanged?.(); }
    catch { if (mounted.current) setError(t("La modification est enregistrée. Recharge la page pour actualiser les autres données.")); }
  }

  async function save() {
    if (!canEdit || !preview?.previewToken || !["blue", "red"].includes(side) || mutation.current) return;
    mutation.current = true; setBusy("save"); setError(""); setNotice("");
    try {
      const result = await request("save-match-draft", { allySide: side, previewToken: preview.previewToken });
      if (!mounted.current) return;
      setDraft(result.draft); setPreview(null); setUrl(""); setSide(""); setEditorOpen(false);
      setNotice(t("Draft rattachée à cette partie."));
      await refreshAfterSave();
    } catch (failure) { if (mounted.current) setError(failure.message || t("Impossible de rattacher cette draft. Réessaie.")); }
    finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  async function unlink() {
    if (!canEdit || !draft || !unlinkOpen || mutation.current) return;
    mutation.current = true; setBusy("unlink"); setError(""); setNotice("");
    try {
      await request("unlink-match-draft");
      if (!mounted.current) return;
      setDraft(null); setUnlinkOpen(false); changeUrl(""); setEditorOpen(true);
      setNotice(t("Lien retiré. La draft reste dans l’historique des analyses."));
      await refreshAfterSave();
    } catch (failure) { if (mounted.current) setError(failure.message || t("Impossible de retirer le lien. Réessaie.")); }
    finally { mutation.current = false; if (mounted.current) setBusy(""); }
  }

  const mutating = busy === "save" || busy === "unlink";
  const enemyName = preview && side ? preview.snapshot[side === "blue" ? "redName" : "blueName"] : "";

  return <Surface className="match-drafter-panel">
    <section className="opponents-workspace match-drafter-content" aria-labelledby={`${id}-title`}>
      <div className="match-drafter-heading"><div><h3 id={`${id}-title`}>{t("Draft de la partie (facultatif)")}</h3><p>{t("Ajoute un lien Drafter pour retrouver les picks et bans de cette partie.")}</p></div>{draft && <Badge tone="cyan">{t("Draft liée")}</Badge>}</div>
      {load === "loading" && <p role="status" className="opponents-help">{t("Chargement de la draft liée…")}</p>}
      {error && <p role="alert" className="opponents-error">{t(error)}</p>}
      {load === "error" && <Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Réessayer")}</Button>}
      <p role="status" aria-live="polite" aria-atomic="true" className={notice ? "opponents-notice" : "sr-only"}>{notice}</p>
      {load === "ready" && <>
        {draft ? <div className="match-drafter-linked">
          <div className="match-drafter-summary"><div><strong>{draft.snapshot.blueName} / {draft.snapshot.redName}</strong><p>{t("Game {0}", [draft.gameNumber])}</p></div><SourceLink snapshot={draft.snapshot} /></div>
          <a className="opponents-source" href={`/tendances?rubrique=drafts&draft=${encodeURIComponent(draft.id)}`}>{t("Analyser cette draft")}<ArrowRight size={16} aria-hidden="true" /></a>
          <details className="match-drafter-details"><summary>{t("Voir les picks et bans")}</summary><DraftBoard snapshot={draft.snapshot} allySide={draft.allySide} /><SnapshotContext snapshot={draft.snapshot} importedAt={draft.importedAt} /></details>
          {canEdit && !editorOpen && <div className="match-drafter-actions"><Button type="button" variant="ghost" icon={Link} disabled={mutating} onClick={() => toggleEditor(true)}>{t("Remplacer la draft")}</Button><Button type="button" variant="ghost" icon={Unlink} disabled={mutating} aria-expanded={unlinkOpen} aria-controls={`${id}-unlink`} onClick={() => { setUnlinkOpen((value) => !value); setError(""); }}>{t("Détacher la draft")}</Button></div>}
          {canEdit && unlinkOpen && <div id={`${id}-unlink`} className="match-drafter-unlink"><p>{t("Retirer cette draft de la partie ? Elle restera disponible dans l’historique des analyses.")}</p><div className="match-drafter-actions"><Button type="button" variant="ghost" disabled={mutating} onClick={() => setUnlinkOpen(false)}>{t("Annuler")}</Button><Button type="button" variant="danger" icon={busy === "unlink" ? Loader2 : Unlink} disabled={mutating} onClick={unlink}>{t(busy === "unlink" ? "Détachement…" : "Confirmer le détachement")}</Button></div></div>}
        </div> : !canEdit && <p className="opponents-help">{t("Aucune draft liée à cette partie. Le staff peut en ajouter une.")}</p>}
        {canEdit && editorOpen && <div className="match-drafter-editor">
          {draft && <div className="match-drafter-replace"><p>{t("Le nouveau lien remplacera la draft de cette partie. L’ancienne restera dans l’historique des analyses.")}</p><Button type="button" variant="ghost" icon={X} disabled={mutating} onClick={() => toggleEditor(false)}>{t("Annuler le remplacement")}</Button></div>}
          <form className="opponents-url-form" onSubmit={readDraft}>
            <TextInput label={t("Lien Drafter.lol")} value={url} onChange={changeUrl} type="url" required maxLength={500} placeholder="https://drafter.lol/draft/…?game=2" disabled={mutating} />
            <Button type="submit" variant="ghost" icon={busy === "preview" ? Loader2 : Link} disabled={!url.trim() || Boolean(busy)}>{t(busy === "preview" ? "Lecture de la draft…" : "Vérifier la draft")}</Button>
          </form>
          {busy === "preview" && <p role="status" className="opponents-help">{t("Récupération des équipes, des picks et des bans…")}</p>}
          {preview && <div className="opponents-preview">
            <div className="opponents-preview-heading"><h4 ref={previewTitle} tabIndex={-1}>{t("Aperçu de la game {0}", [preview.snapshot.gameNumber])}</h4><SourceLink snapshot={preview.snapshot} /></div>
            <DraftSnapshot snapshot={preview.snapshot} allySide={side} /><SnapshotContext snapshot={preview.snapshot} />
            <div className="opponents-save">
              <SelectInput label={t("Côté de notre équipe")} value={side} onChange={setSide} disabled={mutating}><option value="">{t("Choisir notre côté")}</option><option value="blue">{t("Bleu : {0}", [preview.snapshot.blueName || t("Équipe sans nom")])}</option><option value="red">{t("Rouge : {0}", [preview.snapshot.redName || t("Équipe sans nom")])}</option></SelectInput>
              <p className="opponents-help">{side ? t("Équipe adverse de la draft : {0}.", [enemyName || t("Équipe sans nom")]) : t("Choisis le côté de notre équipe pour rattacher la draft.")}</p>
              <Button type="button" icon={busy === "save" ? Loader2 : Check} disabled={mutating || !side} onClick={save}>{t(busy === "save" ? "Enregistrement…" : draft ? "Remplacer la draft liée" : "Rattacher la draft")}</Button>
            </div>
          </div>}
        </div>}
      </>}
    </section>
  </Surface>;
}

export function MatchDrafterPanel({ teamId, match, user, onChanged }) {
  useLanguage();
  if (!teamId || !match?.id || (match.team_id && match.team_id !== teamId)) return null;
  return <MatchDraft key={`${teamId}:${match.id}:${user?.id || ""}`} teamId={teamId} matchId={match.id} onChanged={onChanged} />;
}

export default MatchDrafterPanel;
