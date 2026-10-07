import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Expand, GalleryHorizontalEnd, IdCard, Loader2, RotateCcw, Rotate3d, X } from "lucide-react";
import { Badge, Button, EmptyState, Surface, TabNav } from "../ui/Core.jsx";
import { ModalDialog } from "../ui/ModalDialog.jsx";
import { championDisplayName } from "../../../shared/champions.js";
import { buildProfileShowcase } from "../../utils/profile-showcase.js";
import { drawProfileShowcase, loadProfileShowcaseAssets } from "../../utils/profile-showcase-canvas.js";
import { pngDownloadPages, pngNumber, pngPercent } from "../../utils/png-report.js";
import "./profile-showcase.css";

const VIEWS = [{ id: "card", label: "La carte", icon: IdCard }, { id: "story", label: "Le Wrapped", icon: GalleryHorizontalEnd }];
const CHAPTERS = ["Le bilan", "Le champion signature", "La partie marquante", "L’évolution", "L’équipe"];
const CHAPTER_LABELS = ["Bilan", "Signature", "Moment", "Évolution", "Équipe"];
const METRICS = [
  ["kda", "Ratio KDA", 1, ""], ["csPerMin", "CS par minute", 1, ""], ["kp", "Participation aux éliminations", 0, " %"],
  ["damagePerMin", "Dégâts aux champions par minute", 0, ""], ["vision", "Score de vision par partie", 1, ""],
];
const number = (value, digits = 0, suffix = "") => value === null || value === undefined ? "—" : `${pngNumber(value, digits)}${suffix}`;
const evolutionDigits = (progression) => progression?.key === "visionPerMin" ? 2 : 1;
function evolutionDelta(progression) {
  if (!progression) return "À découvrir";
  const digits = evolutionDigits(progression);
  const rounded = Number(progression.delta.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${number(rounded, digits)} ${progression.unit}`;
}

function chapterCopy(report, chapter) {
  const { results, signature, highlight, progression } = report;
  if (chapter === 1) return { title: signature ? `${championDisplayName(signature.champion)}. La signature.` : "La signature reste à découvrir.", description: signature ? `${signature.games} partie${signature.games > 1 ? "s" : ""} sur ${report.games} : c’est le champion le plus joué de cette sélection. ${signature.wins} victoire${signature.wins > 1 ? "s" : ""}, ${signature.losses} défaite${signature.losses > 1 ? "s" : ""}${signature.unknown ? ` et ${signature.unknown} résultat${signature.unknown > 1 ? "s" : ""} inconnu${signature.unknown > 1 ? "s" : ""}` : ""}.` : "Aucun champion renseigné dans les parties sélectionnées." };
  if (chapter === 2) return { title: highlight ? "Une partie à revivre." : "Le moment reste à écrire.", description: highlight ? `${highlight.kills} éliminations, ${highlight.deaths} mort${highlight.deaths > 1 ? "s" : ""}, ${highlight.assists} assistance${highlight.assists > 1 ? "s" : ""}${highlight.champion ? ` sur ${championDisplayName(highlight.champion)}` : ""}. ${highlight.selectionReason}.` : "Aucune partie avec éliminations, morts et assistances toutes renseignées dans cette sélection." };
  if (chapter === 3) return { title: progression ? `De ${number(progression.early.value, evolutionDigits(progression))} à ${number(progression.recent.value, evolutionDigits(progression))} ${progression.unit}.` : "La courbe se construit.", description: progression ? `Moyenne des ${progression.early.count} premières parties comparée aux ${progression.recent.count} suivantes, parmi les ${progression.count} mesures datées. L’écart décrit cette sélection ; il ne constitue pas une note de niveau.` : "L’évolution demande au moins six mesures datées et deux blocs d’au moins trois parties dont l’ordre peut être établi." };
  if (chapter === 4) return { title: report.teamName ? `Avec ${report.teamName}.` : "Une histoire d’équipe.", description: `${report.playerName}${report.role ? ` · ${report.role}` : ""}. Cette édition réunit ses ${report.games} partie${report.games > 1 ? "s" : ""} dans la sélection « ${report.contextLabel} ». L’effectif présenté est celui de l’équipe actuelle.` };
  return { title: `${report.games} partie${report.games > 1 ? "s" : ""}. Une histoire.`, description: `${results.wins} victoire${results.wins > 1 ? "s" : ""}, ${results.losses} défaite${results.losses > 1 ? "s" : ""}${results.unknown ? ` et ${results.unknown} résultat${results.unknown > 1 ? "s" : ""} inconnu${results.unknown > 1 ? "s" : ""}` : ""}. Du bilan au collectif, cinq chapitres pour retrouver ce qui a marqué cette sélection.` };
}

function WrappedNavigation({ chapter, onChange }) {
  const chapterButtons = useRef([]);
  function move(event, index) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const next = event.key === "ArrowRight" ? (index + 1) % CHAPTERS.length
      : event.key === "ArrowLeft" ? (index + CHAPTERS.length - 1) % CHAPTERS.length
        : event.key === "Home" ? 0 : event.key === "End" ? CHAPTERS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    chapterButtons.current[next]?.focus();
  }
  return <div className="profile-showcase-reader">
    <div className="profile-showcase-step">
      <Button type="button" variant="ghost" icon={ArrowLeft} aria-label="Précédent" onClick={() => onChange(chapter - 1)} disabled={chapter === 0}><span className="profile-showcase-step-label">Précédent</span></Button>
      <span className="profile-showcase-position" aria-label={`Chapitre ${chapter + 1} sur ${CHAPTERS.length} : ${CHAPTERS[chapter]}`}><span className="profile-showcase-position-count">{String(chapter + 1).padStart(2, "0")} <span>/ {String(CHAPTERS.length).padStart(2, "0")}</span></span><span className="profile-showcase-position-label">{CHAPTER_LABELS[chapter]}</span></span>
      <Button type="button" variant="ghost" icon={chapter === 4 ? RotateCcw : ArrowRight} aria-label={chapter === 4 ? "Revoir le bilan" : "Suivant"} onClick={() => onChange((chapter + 1) % CHAPTERS.length)}><span className="profile-showcase-step-label">{chapter === 4 ? "Revoir le bilan" : "Suivant"}</span></Button>
    </div>
    <nav className="profile-showcase-chapters" aria-label="Chapitres du Wrapped">{CHAPTERS.map((label, index) => <button type="button" key={label} ref={(node) => { chapterButtons.current[index] = node; }} aria-label={`Chapitre ${index + 1} : ${label}`} aria-current={chapter === index ? "step" : undefined} tabIndex={chapter === index ? 0 : -1} onKeyDown={(event) => move(event, index)} onClick={() => onChange(index)}><span className="profile-showcase-chapter-index">{String(index + 1).padStart(2, "0")}</span><span className="profile-showcase-chapter-label">{CHAPTER_LABELS[index]}</span></button>)}</nav>
  </div>;
}

function WrappedContext({ report, chapter }) {
  if (chapter === 1) return report.champions.length > 0 && <div className="profile-showcase-context">
    <h4>Les champions de cette édition</h4>
    <ol className="profile-showcase-champion-list">{report.champions.slice(0, 3).map((entry, index) => <li key={entry.champion}><span className="profile-showcase-rank">{String(index + 1).padStart(2, "0")}</span><span><strong>{championDisplayName(entry.champion)}</strong><span>{entry.games} partie{entry.games > 1 ? "s" : ""}</span></span><span>{pngPercent(entry.rate)}<small>de victoires</small></span></li>)}</ol>
    <p className="profile-showcase-meta">{report.champions.length > 3 ? `Les 3 plus joués parmi ${report.champions.length} champions. ` : ""}Taux calculés sur les résultats connus.</p>
  </div>;
  if (chapter === 2) return report.highlight && <div className="profile-showcase-context">
    <h4>{report.highlight.title}</h4><p className="profile-showcase-meta">{report.highlight.dateLabel} · {report.highlight.result === "win" ? "Victoire" : report.highlight.result === "loss" ? "Défaite" : "Résultat inconnu"}</p>
    <dl className="profile-showcase-facts"><div><dt>Ratio KDA</dt><dd>{number(report.highlight.kda, 1)}</dd></div><div><dt>Participation aux éliminations</dt><dd>{number(report.highlight.kp, 0, " %")}</dd></div></dl>
  </div>;
  if (chapter === 3) return report.progression && <div className="profile-showcase-context">
    <h4>{report.progression.label}</h4>
    <dl className="profile-showcase-periods">{[["Première période", report.progression.early], ["Seconde période", report.progression.recent]].map(([label, period]) => <div key={label}><dt>{label}<span>{period.startDateLabel} – {period.endDateLabel}</span></dt><dd>{number(period.value, evolutionDigits(report.progression))}<span>{period.count} parties</span></dd></div>)}</dl>
    <p className="profile-showcase-meta">Écart entre les deux moyennes : <strong>{evolutionDelta(report.progression)}</strong>.</p>
  </div>;
  if (chapter === 4) return <div className="profile-showcase-context">
    <h4>L’effectif actuel</h4>
    {report.teammates.length ? <ul className="profile-showcase-roster">{report.teammates.map((member) => <li key={member.id || `${member.name}|${member.role}`}><span>{member.role || "—"}</span><strong>{member.name}</strong>{report.playerId && member.id === report.playerId && <span className="profile-showcase-roster-selected">Ce profil</span>}</li>)}</ul> : <p className="profile-showcase-meta">Aucun autre profil renseigné dans l’effectif.</p>}
    <p className="profile-showcase-meta">L’effectif actuel ne permet pas d’établir qui a joué chaque partie.</p>
  </div>;
  return <div className="profile-showcase-context">
    <h4>Les repères de la sélection</h4>
    <dl className="profile-showcase-facts"><div><dt>Taux de victoire</dt><dd>{pngPercent(report.results.rate)}</dd><p>{report.results.known} résultat{report.results.known > 1 ? "s" : ""} connu{report.results.known > 1 ? "s" : ""}</p></div><div><dt>Ratio KDA</dt><dd>{number(report.metrics.kda.value, 1)}</dd><p>{report.metrics.kda.count} partie{report.metrics.kda.count > 1 ? "s" : ""} renseignée{report.metrics.kda.count > 1 ? "s" : ""}</p></div></dl>
    <p className="profile-showcase-meta">{report.dateLabel}{report.datedGames < report.games ? ` · ${report.datedGames} parties datées sur ${report.games}` : ""}</p>
  </div>;
}

function accessibleDescription(report, view, chapter) {
  const identity = `${report.playerName}, ${report.teamName || "équipe non renseignée"}. ${report.contextLabel}. ${report.dateLabel}.`;
  const results = `${report.games} parties ; ${report.results.wins} victoires, ${report.results.losses} défaites, ${report.results.unknown} résultats inconnus. Taux de victoire ${pngPercent(report.results.rate)}.`;
  return `${identity} ${view === "story" ? chapterCopy(report, chapter).description : results} Les données et leur couverture sont également accessibles sous le visuel.`;
}

function ShowcaseCanvas({ canvasRef, report, assets, view, chapter, onError }) {
  const ownRef = useRef(null);
  const ref = canvasRef || ownRef;
  useEffect(() => {
    if (!ref.current) return;
    try {
      drawProfileShowcase(ref.current, report, { view, chapter, assets });
    } catch (error) { onError(error); }
  }, [report, assets, view, chapter, onError, ref]);
  return <canvas ref={ref} width={1080} height={1620} role="img" aria-label={accessibleDescription(report, view, chapter)} className="profile-showcase-canvas" />;
}

export function ProfileShowcase({ player, rows = [], teamName = "", category = "Toutes les parties", teammates = [], navigate }) {
  const report = useMemo(() => buildProfileShowcase({ player, rows, teamName, category, teammates }), [player, rows, teamName, category, teammates]);
  const [mode, setMode] = useState("card");
  const [back, setBack] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [assetState, setAssetState] = useState({ key: "", assets: {}, ready: false });
  const [retry, setRetry] = useState(0);
  const [renderError, setRenderError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportFailed, setExportFailed] = useState(false);
  const canvasRef = useRef(null);
  const expandTrigger = useRef(null);
  const figureRef = useRef(null);
  const rootRef = useRef(null);
  const alive = useRef(true);
  const exportLock = useRef(false);
  const champion = (mode === "story" && chapter === 2 ? report.highlight?.champion : report.signature?.champion) || "";
  const assetKey = `${champion}|${retry}`;
  const assets = assetState.key === assetKey ? assetState.assets : {};
  const ready = assetState.key === assetKey && assetState.ready;
  const view = mode === "story" ? "story" : back ? "back" : "front";
  const currentLabel = mode === "story" ? `Chapitre ${chapter + 1} · ${CHAPTERS[chapter]}` : `Carte · ${back ? "Verso" : "Recto"}`;
  const copy = chapterCopy(report, mode === "story" ? chapter : 0);
  const onRenderError = useCallback(() => setRenderError("Le visuel n’a pas pu être préparé. Les statistiques restent consultables ci-dessous."), []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setRenderError("");
    if (!report.games) return;
    Promise.all([loadProfileShowcaseAssets(champion), document.fonts?.ready]).then(([loaded]) => {
      if (!cancelled) setAssetState({ key: assetKey, assets: loaded, ready: true });
    }).catch(() => { if (!cancelled) { setAssetState({ key: assetKey, assets: {}, ready: true }); onRenderError(); } });
    return () => { cancelled = true; };
  }, [champion, assetKey, onRenderError, report.games]);

  function openChapter(index, reveal = false) {
    setMode("story"); setChapter(Math.max(0, Math.min(CHAPTERS.length - 1, index))); setExportStatus("");
    // Navigation stays beside the image; only a card teaser needs to reveal it.
    if (reveal && figureRef.current && rootRef.current?.getBoundingClientRect().width <= 720) figureRef.current.scrollIntoView?.({ behavior: "instant", block: "start" });
  }
  function changeMode(next) { setMode(next); setExportStatus(""); }
  async function download() {
    if (!canvasRef.current || !ready || renderError || exportLock.current) return;
    exportLock.current = true; setExporting(true); setExportStatus(""); setExportFailed(false);
    try {
      // Snapshot the visible face before any later interaction can redraw it.
      const snapshot = document.createElement("canvas");
      snapshot.width = canvasRef.current.width; snapshot.height = canvasRef.current.height;
      const context = snapshot.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(canvasRef.current, 0, 0);
      const name = String(report.playerName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 70) || "joueur";
      const part = mode === "story" ? `wrapped-${chapter + 1}` : back ? "carte-verso" : "carte";
      await pngDownloadPages([snapshot], `nxt5-${name}-${part}.png`);
      if (alive.current) setExportStatus("Le visuel a été téléchargé en PNG.");
    } catch {
      if (alive.current) { setExportFailed(true); setExportStatus("Le téléchargement a échoué. Réessaie avec le bouton d’export."); }
    } finally { exportLock.current = false; if (alive.current) setExporting(false); }
  }

  if (!report.games) return <Surface><EmptyState icon={IdCard} title="La carte commence avec une partie" text="Aucune partie reliée à ce joueur dans cette sélection. Change la catégorie ou importe une partie pour créer sa carte et son Wrapped." /></Surface>;
  return <div className="profile-showcase" ref={rootRef}>
    <div className="profile-showcase-toolbar">
      <TabNav items={VIEWS} activeId={mode} onChange={changeMode} label="Format du souvenir" idPrefix="showcase" panelId="showcase-panel" />
      <Badge tone="purple">{report.contextLabel}</Badge>
    </div>
    <div id="showcase-panel" role="tabpanel" aria-labelledby={`showcase-tab-${mode}`} className={`profile-showcase-layout${mode === "story" ? " is-story" : ""}`}>
      <figure ref={figureRef} className="profile-showcase-figure" aria-label={currentLabel}>
        {mode === "story" && <WrappedNavigation chapter={chapter} onChange={openChapter} />}
        <div className="profile-showcase-art" aria-busy={!ready}>
          <ShowcaseCanvas canvasRef={canvasRef} report={report} assets={assets} view={view} chapter={chapter} onError={onRenderError} />
        </div>
        <figcaption>{currentLabel} <span>· {report.dateLabel}</span></figcaption>
        <div className="profile-showcase-actions">
          {mode === "card" && <Button type="button" variant="ghost" icon={Rotate3d} onClick={() => { setBack(!back); setExportStatus(""); }}>Voir le {back ? "recto" : "verso"}</Button>}
          <span ref={expandTrigger}><Button type="button" variant="ghost" icon={Expand} onClick={() => setExpanded(true)} disabled={!!renderError}>Agrandir</Button></span>
        </div>
        {!ready && <p className="profile-showcase-status" role="status">Préparation du visuel…</p>}
        {ready && champion && !assets.art && !renderError && <p className="profile-showcase-status">Portrait indisponible : les données restent affichées. <button type="button" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></p>}
        {renderError && <div role="alert" className="profile-showcase-error"><p>{renderError}</p><Button type="button" variant="ghost" onClick={() => setRetry((value) => value + 1)}>Réessayer</Button></div>}
      </figure>
      <section className="profile-showcase-story" aria-label={mode === "story" ? "Parcourir le Wrapped" : "Bilan de la carte"}>
        <p className="profile-showcase-eyebrow">{mode === "story" ? `${String(chapter + 1).padStart(2, "0")} / 05 · ${CHAPTERS[chapter]}` : "L’édition personnelle"}</p>
        <h3>{mode === "card" ? "Les parties ont leur signature." : copy.title}</h3>
        <p className="profile-showcase-description">{copy.description}</p>
        {mode === "card" ? <>
          <div className="profile-showcase-result"><strong>{pngPercent(report.results.rate)}</strong><span>de victoires<br />{report.results.wins} V · {report.results.losses} D{report.results.unknown ? ` · ${report.results.unknown} ?` : ""}</span></div>
          <p className="profile-showcase-meta">{report.results.known} résultat{report.results.known > 1 ? "s" : ""} connu{report.results.known > 1 ? "s" : ""} sur {report.games} partie{report.games > 1 ? "s" : ""}</p>
          <div className="profile-showcase-results" aria-label="Résultats des parties affichées">{report.recentResults.map((result, index) => <span key={`${result.matchId}-${index}`} className={`result-${result.result}`} aria-label={`${result.dateLabel} : ${result.result === "win" ? "victoire" : result.result === "loss" ? "défaite" : "résultat inconnu"}`}>{result.result === "win" ? "V" : result.result === "loss" ? "D" : "?"}</span>)}</div>
          <p className="profile-showcase-meta">{report.datedGames === report.games ? `${report.recentResultsCount} dernière${report.recentResultsCount > 1 ? "s" : ""} partie${report.recentResultsCount > 1 ? "s" : ""} · de la plus ancienne à la plus récente` : `${report.recentResultsCount} parties affichées · ordre des dates connues`}</p>
          <div className="profile-showcase-teasers">
            <button type="button" onClick={() => openChapter(1, true)}><span>Champion signature</span><strong>{report.signature ? championDisplayName(report.signature.champion) : "À découvrir"}</strong><ArrowRight aria-hidden="true" /></button>
            <button type="button" onClick={() => openChapter(2, true)}><span>Partie marquante</span><strong>{report.highlight ? `${report.highlight.kills} / ${report.highlight.deaths} / ${report.highlight.assists}` : "À découvrir"}</strong><ArrowRight aria-hidden="true" /></button>
            <button type="button" onClick={() => openChapter(3, true)}><span>Évolution</span><strong>{evolutionDelta(report.progression)}</strong><ArrowRight aria-hidden="true" /></button>
          </div>
          <Button type="button" icon={ArrowRight} onClick={() => openChapter(0, true)}>Découvrir le Wrapped</Button>
        </> : <>
          <WrappedContext report={report} chapter={chapter} />
          {chapter === 2 && report.highlight?.matchId && <a className="profile-text-action" href={`/games?match=${encodeURIComponent(report.highlight.matchId)}`} onClick={(event) => { if (!navigate || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); navigate(`/games?match=${encodeURIComponent(report.highlight.matchId)}`); }}>Ouvrir la partie source <ArrowRight aria-hidden="true" /></a>}
          {chapter === 3 && report.progression?.excludedCount > 0 && <p className="profile-showcase-meta">{report.progression.excludedCount} partie{report.progression.excludedCount > 1 ? "s" : ""} exclue{report.progression.excludedCount > 1 ? "s" : ""} de cette comparaison : date ou mesure indisponible.</p>}
        </>}
        <div className="profile-showcase-download"><Button type="button" variant="ghost" icon={exporting ? Loader2 : Download} onClick={download} disabled={exporting || !ready || !!renderError}>{exporting ? "Export en cours…" : mode === "story" ? "Exporter ce chapitre" : back ? "Exporter le verso" : "Exporter la carte"}</Button><p>Une image PNG · 1 080 × 1 620 px</p></div>
        {exportStatus && <p role={exportFailed ? "alert" : "status"} className="profile-showcase-status">{exportStatus}</p>}
      </section>
    </div>
    <details className="profile-disclosure profile-showcase-data"><summary>Données et méthode de cette édition</summary>
      <p>{report.contextLabel} · {report.dateLabel}. {report.datedGames} partie{report.datedGames > 1 ? "s" : ""} datée{report.datedGames > 1 ? "s" : ""} sur {report.games}. « — » indique une valeur indisponible.</p>
      <dl>{METRICS.map(([key, label, digits, suffix]) => <div key={key}><dt>{label}</dt><dd>{number(report.metrics[key].value, digits, suffix)}</dd><p>{report.metrics[key].count} / {report.games} parties renseignées</p></div>)}</dl>
      <p>Le KDA vaut (éliminations + assistances) ÷ morts, avec un minimum de 1 au dénominateur, sur les parties complètes. Les CS comptent les sbires et monstres tués. La participation aux éliminations (KP) est la part des éliminations de l’équipe avec une élimination ou une assistance du joueur. Les moyennes portent sur les valeurs renseignées.</p>
      <p>Le champion signature est le plus joué. {report.highlight?.selectionReason || "La partie marquante requiert des éliminations, morts et assistances renseignées."} L’évolution compare les deux moitiés chronologiques des parties datées et renseignées : CS par minute, ou vision par minute pour le support. Ces mesures décrivent la sélection et ne constituent pas une note de niveau.</p>
    </details>
    <span className="sr-only" role="status" aria-live="polite">{currentLabel}</span>
    {expanded && <ModalDialog className="profile-showcase-dialog" aria-labelledby="showcase-dialog-title" onClose={() => setExpanded(false)} returnFocusRef={expandTrigger} handleHistory>
      <header><h3 id="showcase-dialog-title">{report.playerName} · {currentLabel}</h3><Button type="button" variant="ghost" icon={X} onClick={() => setExpanded(false)}>Fermer</Button></header>
      {mode === "story" && <WrappedNavigation chapter={chapter} onChange={openChapter} />}
      <ShowcaseCanvas report={report} assets={assets} view={view} chapter={chapter} onError={onRenderError} />
      <p>{report.contextLabel} · {report.dateLabel}</p>
    </ModalDialog>}
  </div>;
}
