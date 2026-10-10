import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Expand, GalleryHorizontalEnd, IdCard, Loader2, Play, RotateCcw, Rotate3d, X } from "lucide-react";
import { Button, EmptyState, Surface, TabNav } from "../ui/Core.jsx";
import { ModalDialog } from "../ui/ModalDialog.jsx";
import { championDisplayName } from "../../../shared/champions.js";
import { buildProfileShowcase } from "../../utils/profile-showcase.js";
import { drawProfileShowcase, loadProfileShowcaseAssets } from "../../utils/profile-showcase-canvas.js";
import { pngDownloadPages, pngNumber, pngPercent } from "../../utils/png-report.js";
import "./profile-showcase.css";

const VIEWS = [{ id: "card", label: "La carte", icon: IdCard }, { id: "story", label: "Le Wrapped", icon: GalleryHorizontalEnd }];
const CHAPTERS = ["Le bilan", "Le champion signature", "La partie marquante", "L’évolution", "L’équipe"];
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
  if (chapter === 1) return { title: signature ? championDisplayName(signature.champion) : "Champion indisponible", description: signature ? `${signature.games} partie${signature.games > 1 ? "s" : ""} sur le champion le plus joué. ${signature.wins} victoire${signature.wins > 1 ? "s" : ""}, ${signature.losses} défaite${signature.losses > 1 ? "s" : ""}${signature.unknown ? ` et ${signature.unknown} résultat${signature.unknown > 1 ? "s" : ""} inconnu${signature.unknown > 1 ? "s" : ""}` : ""}.` : "Aucun champion renseigné dans les parties sélectionnées." };
  if (chapter === 2) return { title: highlight ? "Une partie à retrouver." : "Partie indisponible", description: highlight ? `${highlight.kills} éliminations, ${highlight.deaths} mort${highlight.deaths > 1 ? "s" : ""}, ${highlight.assists} assistance${highlight.assists > 1 ? "s" : ""} sur ${championDisplayName(highlight.champion)}. ${highlight.selectionReason}.` : "Aucune partie avec éliminations, morts et assistances toutes renseignées dans cette sélection." };
  if (chapter === 3) return { title: "L’évolution, partie après partie.", description: progression ? `${number(progression.early.value, evolutionDigits(progression))} à ${number(progression.recent.value, evolutionDigits(progression))} ${progression.unit} entre le premier et le second bloc de ${progression.early.count} et ${progression.recent.count} parties datées. Une comparaison descriptive, à relire dans son contexte.` : "L’évolution demande au moins six mesures datées et deux blocs d’au moins trois parties dont l’ordre peut être établi." };
  if (chapter === 4) return { title: report.teamName ? `Avec ${report.teamName}.` : "L’équipe", description: "L’effectif actuel de l’équipe. Il ne représente pas nécessairement les joueurs présents dans les parties sélectionnées." };
  return { title: "Le bilan de la sélection", description: `${report.games} partie${report.games > 1 ? "s" : ""} : ${results.wins} victoire${results.wins > 1 ? "s" : ""}, ${results.losses} défaite${results.losses > 1 ? "s" : ""}${results.unknown ? ` et ${results.unknown} résultat${results.unknown > 1 ? "s" : ""} inconnu${results.unknown > 1 ? "s" : ""}` : ""}.` };
}

function ChapterControls({ chapter, onChange }) {
  return <div className="profile-showcase-reader">
    <nav className="profile-showcase-chapters" aria-label={"Chapitres du Wrapped"}>{CHAPTERS.map((label, index) => <button type="button" key={label} aria-label={`Chapitre ${index + 1} : ${label}`} aria-current={index === chapter ? "step" : undefined} onClick={() => onChange(index)}><span>{String(index + 1).padStart(2, "0")}</span><span className="profile-showcase-chapter-line" aria-hidden="true" /></button>)}</nav>
    <div className="profile-showcase-step">
      <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => onChange(chapter - 1)} disabled={chapter === 0}>{"Précédent"}</Button>
      <Button type="button" variant="ghost" icon={chapter === 4 ? RotateCcw : ArrowRight} onClick={() => onChange((chapter + 1) % CHAPTERS.length)}>{chapter === 4 ? "Revoir le bilan" : "Suivant"}</Button>
    </div>
  </div>;
}

function StoryHeadline({ report, chapter }) {
  if (chapter === 1) return <>{"Ta signature."}<strong>{report.signature ? championDisplayName(report.signature.champion) : "À découvrir"}</strong></>;
  if (chapter === 2) return <>{"Ce moment-là."}<strong>{report.highlight ? `${report.highlight.kills} / ${report.highlight.deaths} / ${report.highlight.assists}` : "—"}</strong></>;
  if (chapter === 3) return <>{"Le chemin parcouru."}<strong>{evolutionDelta(report.progression)}</strong></>;
  if (chapter === 4) return <>{"L’histoire continue."}<strong>{report.teamName}</strong></>;
  return <>{"Tout commence par"}<strong>{`${report.games} parties.`}</strong></>;
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
      drawProfileShowcase(ref.current, report, { view, chapter, assets, artFocus: assets.artFocus });
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
  const [direction, setDirection] = useState("forward");
  const [assetState, setAssetState] = useState({ key: "", assets: {}, ready: false });
  const [retry, setRetry] = useState(0);
  const [renderError, setRenderError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportFailed, setExportFailed] = useState(false);
  const canvasRef = useRef(null);
  const expandTrigger = useRef(null);
  const pointerStart = useRef(null);
  const figureRef = useRef(null);
  const rootRef = useRef(null);
  const alive = useRef(true);
  const exportLock = useRef(false);
  const champion = (mode === "story" && chapter === 2 ? report.highlight?.champion : report.signature?.champion) || "";
  const assetKey = `${champion}|${retry}`;
  const assets = assetState.key === assetKey ? assetState.assets : {};
  const ready = assetState.key === assetKey && assetState.ready;
  const view = mode === "story" ? "story" : back ? "back" : "front";
  const currentLabel = mode === "story" ? `Chapitre ${chapter + 1} · ${CHAPTERS[chapter]}` : `Carte · ${(back ? "Verso" : "Recto")}`;
  const copy = chapterCopy(report, mode === "story" ? chapter : 0);
  const onRenderError = useCallback(() => setRenderError("Le visuel n’a pas pu être préparé. Les statistiques restent consultables ci-dessous."), []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    rootRef.current?.querySelectorAll(".profile-showcase-content").forEach((content) => { content.scrollTop = 0; });
  }, [mode, chapter, expanded]);
  useEffect(() => {
    let cancelled = false;
    setRenderError("");
    if (!report.games) return;
    Promise.all([loadProfileShowcaseAssets(champion), document.fonts?.ready]).then(([loaded]) => {
      if (!cancelled) setAssetState({ key: assetKey, assets: loaded, ready: true });
    }).catch(() => { if (!cancelled) { setAssetState({ key: assetKey, assets: {}, ready: true }); onRenderError(); } });
    return () => { cancelled = true; };
  }, [champion, assetKey, onRenderError, report.games]);

  function openChapter(index) {
    const next = Math.max(0, Math.min(CHAPTERS.length - 1, index));
    setDirection(next < chapter ? "backward" : "forward");
    setMode("story"); setChapter(next); setExportStatus("");
  }
  function changeMode(next) { setMode(next); setExportStatus(""); }
  function openReader(event) {
    // The launch CTA leaves the stage when the reader opens; return to its persistent tab.
    expandTrigger.current = rootRef.current?.querySelector("#showcase-tab-story") || event?.currentTarget || null;
    setDirection("forward"); setMode("story"); setChapter(0); setExportStatus(""); setExpanded(true);
  }
  function expand(event) { expandTrigger.current = event?.currentTarget || null; setExpanded(true); }
  function navigateWithKeys(event) {
    if (mode !== "story" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target?.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || "")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault(); openChapter(chapter + (event.key === "ArrowRight" ? 1 : -1));
    }
  }
  function startSwipe(event) { pointerStart.current = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null; }
  function finishSwipe(event) {
    const start = pointerStart.current; pointerStart.current = null;
    if (!start || mode !== "story") return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 55 && Math.abs(dy) < 55) openChapter(chapter + (dx < 0 ? 1 : -1));
  }
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


  const exportLabel = exporting ? "Export en cours…" : mode === "story" ? "Exporter ce chapitre" : back ? "Exporter le verso" : "Exporter la carte";
  function renderStage(inDialog = false) {
    return <div className={"profile-showcase-stage " + (mode === "story" ? "is-story" : "is-card") + " chapter-" + chapter} data-direction={direction} onKeyDown={navigateWithKeys}>
      <div className="profile-showcase-content">
      <section key={mode + "-" + chapter} className="profile-showcase-story" aria-label={mode === "story" ? "Parcourir le Wrapped" : "Bilan de la carte"}>
        <p className="profile-showcase-eyebrow"><span />{mode === "story" ? String(chapter + 1).padStart(2, "0") + " / 05 · " + CHAPTERS[chapter] : "Édition joueur" + " / " + (report.role || "NXT5")}</p>
        <h3 className="profile-showcase-headline">{mode === "story" ? <StoryHeadline report={report} chapter={chapter} /> : <>{"Ta carte."}<strong>{"Ton empreinte."}</strong></>}</h3>
        <p className="profile-showcase-identity">{mode === "card" ? report.playerName + " · " + report.teamName : report.playerName}</p>
        <p className="profile-showcase-description">{mode === "card" ? "Tes parties, ton champion, tes moments. Une carte à garder. Un parcours à découvrir." : copy.description}</p>
        {mode === "card" && <div className="profile-showcase-launch"><Button type="button" icon={Play} onClick={openReader}>{"Découvrir le Wrapped"}</Button><span>{"5 chapitres · à ton rythme"}</span></div>}
        {mode === "story" && chapter === 2 && report.highlight?.matchId && <a className="profile-text-action" href={"/games?match=" + encodeURIComponent(report.highlight.matchId)} onClick={(event) => { if (!navigate || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); if (inDialog) setExpanded(false); navigate("/games?match=" + encodeURIComponent(report.highlight.matchId)); }}>{"Ouvrir la partie source"}<ArrowRight aria-hidden="true" /></a>}
        {mode === "story" && chapter === 3 && report.progression?.excludedCount > 0 && <p className="profile-showcase-meta">{`${report.progression.excludedCount} parties exclues : date ou mesure indisponible.`}</p>}
        {mode === "story" && chapter === 3 && report.progression && <p className="sr-only">Première période : {report.progression.early.startDateLabel} – {report.progression.early.endDateLabel}. Seconde période : {report.progression.recent.startDateLabel} – {report.progression.recent.endDateLabel}.</p>}
        {mode === "story" && chapter === 4 && <div className="profile-showcase-finale"><p>{"La suite se joue avec eux."}</p><ul className="profile-showcase-roster" aria-label={"Effectif actuel de l’équipe"}>{report.teammates.map((member) => <li key={member.id || member.name + "|" + member.role}><span>{member.role || "—"}</span><strong>{member.name}</strong></li>)}</ul><Button type="button" variant="ghost" icon={IdCard} onClick={(event) => { const focusTarget = inDialog ? event.currentTarget.closest("dialog")?.querySelector("header button") : rootRef.current?.querySelector("#showcase-tab-card"); focusTarget?.focus(); setMode("card"); setBack(false); setExportStatus(""); }}>{"Retrouver ma carte"}</Button></div>}
        <p className="profile-showcase-context">{report.contextLabel}<br />{report.dateLabel}</p>
      </section>
      <figure ref={inDialog ? undefined : figureRef} className="profile-showcase-figure" aria-label={currentLabel}>
        <div key={view + "-" + chapter + "-" + report.playerName} className="profile-showcase-art" aria-busy={!ready} onPointerDown={startSwipe} onPointerUp={finishSwipe} onPointerCancel={() => { pointerStart.current = null; }}>
          <ShowcaseCanvas canvasRef={inDialog ? undefined : canvasRef} report={report} assets={assets} view={view} chapter={chapter} onError={onRenderError} />
        </div>
        <figcaption>{currentLabel}</figcaption>
        {!ready && <p className="profile-showcase-status" role="status">{"Préparation du visuel…"}</p>}
        {ready && champion && !assets.art && !renderError && <p className="profile-showcase-status">{"Portrait indisponible : les données restent affichées. "}<button type="button" onClick={() => setRetry((value) => value + 1)}>{"Réessayer"}</button></p>}
        {renderError && <div role="alert" className="profile-showcase-error"><p>{renderError}</p><Button type="button" variant="ghost" onClick={() => setRetry((value) => value + 1)}>{"Réessayer"}</Button></div>}
      </figure>
      </div>
      <div className="profile-showcase-controls">
        {mode === "story" && <ChapterControls chapter={chapter} onChange={openChapter} />}
        <div className="profile-showcase-actions">
          {mode === "card" && <Button type="button" variant="ghost" icon={Rotate3d} onClick={() => { setBack(!back); setExportStatus(""); }}>{(back ? "Voir le recto" : "Voir le verso")}</Button>}
          {!inDialog && <Button type="button" variant="ghost" icon={Expand} onClick={expand} disabled={!!renderError}>{"Agrandir"}</Button>}
          <Button type="button" variant="ghost" icon={exporting ? Loader2 : Download} onClick={download} disabled={exporting || !ready || !!renderError}>{exportLabel}</Button>
        </div>
        {exportStatus && <p role={exportFailed ? "alert" : "status"} className="profile-showcase-status">{exportStatus}</p>}
        {mode === "story" && <p className="profile-showcase-reader-hint">{"À ton rythme · flèches du clavier ou glissement sur le visuel"}</p>}
      </div>
    </div>;
  }

  if (!report.games) return <Surface><EmptyState icon={IdCard} title={"La carte commence avec une partie"} text={"Aucune partie reliée à ce joueur dans cette sélection. Change la catégorie ou importe une partie pour créer sa carte et son Wrapped."} /></Surface>;
  return <div className="profile-showcase" ref={rootRef}>
    <div className="profile-showcase-toolbar">
      <TabNav items={VIEWS} activeId={mode} onChange={changeMode} label={"Format du visuel"} idPrefix="showcase" panelId="showcase-panel" />
      <p className="profile-showcase-meta">{`${report.games} parties`} · {report.dateLabel}</p>
    </div>
    <div id="showcase-panel" role="tabpanel" aria-labelledby={"showcase-tab-" + mode}>{renderStage()}</div>
    <details className="profile-disclosure profile-showcase-data"><summary>{"Données et méthode de cette édition"}</summary>
      <p>{report.contextLabel} · {report.dateLabel}. {report.datedGames}{" partie"}{report.datedGames > 1 ? "s" : ""}{" datée"}{report.datedGames > 1 ? "s" : ""}{" sur "}{report.games}{". « — » indique une valeur indisponible."}</p>
      <p>{copy.description}{" Taux de victoire : "}{pngPercent(report.results.rate)}{", sur "}{report.results.known}{" résultats connus."}</p>
      <div className="profile-showcase-results" aria-label={"Résultats des parties affichées"}>{report.recentResults.map((result, index) => <span key={`${result.matchId}-${index}`} className={`result-${result.result}`} aria-label={`${result.dateLabel} : ${result.result === "win" ? "victoire" : result.result === "loss" ? "défaite" : "résultat inconnu"}`}>{result.result === "win" ? "V" : result.result === "loss" ? "D" : "?"}</span>)}</div>
      <p className="profile-showcase-meta">{report.datedGames === report.games ? `${report.recentResultsCount} dernière${report.recentResultsCount > 1 ? "s" : ""} partie${report.recentResultsCount > 1 ? "s" : ""} · de la plus ancienne à la plus récente` : `${report.recentResultsCount} parties affichées · ordre des dates connues`}</p>
      <dl>{METRICS.map(([key, label, digits, suffix]) => <div key={key}><dt>{label}</dt><dd>{number(report.metrics[key].value, digits, suffix)}</dd><p>{report.metrics[key].count} / {report.games}{" parties renseignées"}</p></div>)}</dl>
      <p>{"Le KDA vaut (éliminations + assistances) ÷ morts, avec un minimum de 1 au dénominateur, sur les parties complètes. Les CS comptent les sbires et monstres tués. La participation aux éliminations (KP) est la part des éliminations de l’équipe avec une élimination ou une assistance du joueur. Les moyennes portent sur les valeurs renseignées."}</p>
      <p>{"Le champion signature est le plus joué. "}{report.highlight?.selectionReason || "La partie marquante requiert des éliminations, morts et assistances renseignées."}{" L’évolution compare les deux moitiés chronologiques des parties datées et renseignées : CS par minute, ou vision par minute pour le support. Ces mesures décrivent la sélection et ne constituent pas une note de niveau."}</p>
    </details>
    <span className="sr-only" role="status" aria-live="polite">{currentLabel}</span>

    {expanded && <ModalDialog className="profile-showcase-dialog" aria-labelledby="showcase-dialog-title" onClose={() => setExpanded(false)} onKeyDown={navigateWithKeys} returnFocusRef={expandTrigger} handleHistory>
      <header><h3 id="showcase-dialog-title">{report.playerName} <span>/ {mode === "story" ? "WRAPPED" : "Carte joueur"}</span></h3><Button type="button" variant="ghost" icon={X} onClick={() => setExpanded(false)}>{"Fermer"}</Button></header>
      {renderStage(true)}
      <span className="sr-only" role="status" aria-live="polite">{currentLabel}</span>
    </ModalDialog>}

  </div>;
}
