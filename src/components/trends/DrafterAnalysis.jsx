import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Info, ListOrdered, RefreshCw, Shield } from "lucide-react";
import { loadDraftHistory } from "../../api/draft-history.js";
import { openAppPath } from "../../app/routing.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { buildDraftIntelligence } from "../../utils/draft-intelligence.js";
import { DraftBanIntelligence, DraftRotations, Meter, Segmented } from "./DraftIntelligence.jsx";
import { draftMode, buildDraftAnalysis, normalizeDraftRows } from "../../utils/draft-analysis.js";
import { matchDisplayName } from "../../utils/matches.js";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { Badge, Button, EmptyState, SelectInput, SkeletonRows, Surface } from "../ui/Core.jsx";
import { SourceLink } from "../opponents/OpponentsWorkspace.jsx";
import DraftBoard from "../draft/DraftBoard.jsx";
import "./drafter-analysis.css";

function Frequency({ title, entries = [], coverage = 0, total = 0, limit = 8 }) {
  return <section className="drafter-frequency">
    <h4>{title}</h4>
    <p className="drafter-muted">{coverage === 1 ? t("1 draft exploitable sur {0}", [total]) : t("{0} drafts exploitables sur {1}", [coverage, total])}</p>
    {entries.length ? <ol>{entries.slice(0, limit).map(({ champion, count, total: denominator }) => <li key={champion}>
      <ChampionPortrait champion={champion} className="h-8 w-8 rounded-md object-cover" />
      <span className="drafter-frequency-bar"><span><span>{championDisplayName(champion)}</span><strong>{count} / {denominator}</strong></span><Meter value={denominator ? 100 * count / denominator : 0} /></span>
    </li>)}</ol> : <p className="drafter-muted">{t("Aucune donnée disponible.")}</p>}
  </section>;
}

function Coverage({ label, count, total, children }) {
  return <div><dt>{label}</dt><dd>{children || `${count} / ${total}`}</dd><Meter value={total ? 100 * count / total : 0} tone={count === total ? "cyan" : "lavender"} /></div>;
}

export function DraftChronology({ snapshot, allySide }) {
  return <DraftBoard snapshot={snapshot} allySide={allySide} />;
}

function TeamDrafterAnalysis({ teamId, matches, players, championPool }) {
  const [state, setState] = useState({ loading: true, error: "", opponents: [], drafts: [] });
  const [reload, setReload] = useState(0);
  const [opponentId, setOpponentId] = useState("");
  const [camp, setCamp] = useState("enemy");
  const [scope, setScope] = useState("all");
  const [side, setSide] = useState("");
  const [patch, setPatch] = useState("");
  const [mode, setMode] = useState("");
  const chronologyRef = useRef(null);
  const chronologySummary = useRef(null);
  const [selectedId, setSelectedId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("draft") || "");
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, error: "", opponents: [], drafts: [] });
    loadDraftHistory(teamId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setState({ ...result, loading: false, error: "" }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ loading: false, error: error.message, opponents: [], drafts: [] }); });
    return () => controller.abort();
  }, [teamId, reload]);
  const normalized = useMemo(() => normalizeDraftRows(state.drafts), [state.drafts]);
  const patches = [...new Set(normalized.drafts.map((draft) => draft.snapshot?.patch).filter(Boolean))].sort();
  const filtered = useMemo(() => normalized.drafts.filter((draft) => (!opponentId || (opponentId === "unassigned" ? !draft.opponentId : draft.opponentId === opponentId))
    && (scope === "all" || (scope === "linked" ? Boolean(draft.matchId) : !draft.matchId))
    && (!side || draft.allySide === side) && (!patch || (patch === "unknown" ? !draft.snapshot?.patch : draft.snapshot?.patch === patch))
    && (!mode || draftMode(draft.snapshot) === mode)), [normalized.drafts, opponentId, scope, side, patch, mode]);
  const intelligence = useMemo(() => buildDraftIntelligence(filtered, matches, { teamId, players, championPool }), [filtered, matches, teamId, players, championPool]);
  const drafts = intelligence.drafts;
  const model = useMemo(() => buildDraftAnalysis(drafts), [drafts]);
  const stats = model[camp];
  const banStats = intelligence.camps[camp];
  const phaseTwoCount = banStats.bans.reduce((sum, row) => sum + row.phase2.count, 0);
  const selected = drafts.find((draft) => draft.id === selectedId) || drafts[0];
  const matchNames = useMemo(() => new Map(matches.map((match) => [String(match.id), matchDisplayName(match)])), [matches]);
  const opponentNames = useMemo(() => new Map(state.opponents.map((opponent) => [opponent.id, opponent.name])), [state.opponents]);
  const draftLabel = (draft) => `${opponentNames.get(draft.opponentId) || draft.snapshot[draft.allySide === "blue" ? "redName" : "blueName"]} · ${t("Game {0}", [draft.gameNumber])} · ${draft.snapshot.source === "nxt5" ? "NXT5" : draft.sourceId}`;
  const changeOpponent = (value) => { setOpponentId(value); setSelectedId(""); };
  const changeScope = (value) => { setScope(value); setSelectedId(""); };
  const inspectDraft = (id) => {
    setSelectedId(id);
    if (chronologyRef.current) chronologyRef.current.open = true;
    chronologySummary.current?.focus();
    chronologyRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const scopeKey = [opponentId, scope, side, patch, mode, camp].join("|");

  if (state.loading) return <Surface><p role="status">{t("Chargement des drafts…")}</p><SkeletonRows /></Surface>;
  if (state.error) return <Surface><p role="alert">{t(state.error)}</p><Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Réessayer")}</Button></Surface>;
  if (!state.drafts.length) return <Surface><EmptyState icon={ListOrdered} title={t("Les drafts importées commencent l’analyse")} text={t("Ajoute un lien Drafter dans le détail d’une partie pour retrouver ses picks, ses bans et leur ordre. Le lien vers une équipe adverse reste facultatif.")} /><Button type="button" icon={ArrowRight} onClick={() => openAppPath("/games")}>{t("Ouvrir les parties")}</Button></Surface>;
  const warnings = [...new Set([...normalized.warnings, ...model.warnings, ...(intelligence.warnings || [])])].map((warning) => t(warning));
  if (intelligence.patches.length > 1 || intelligence.modes.length > 1) warnings.push(t("Plusieurs patchs ou formats mélangés : affine le périmètre pour comparer."));
  if (intelligence.coverage.mismatched > 0) warnings.push(t("{0} liens de parties ont des champions absents ou différents : leurs rôles ne sont pas attribués à ces drafts.", [intelligence.coverage.mismatched]));
  return <div className="drafter-analysis">
    <Surface>
      <div className="drafter-analysis-heading"><div className="drafter-analysis-title"><h3>{t("Drafts & bans")}</h3><p className="drafter-sample" role="status" aria-atomic="true"><strong>{model.total}</strong> {t("Drafts analysées")}</p></div><Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Actualiser")}</Button></div>
      <div className="drafter-filters">
        <Segmented label={t("Bans à analyser")} value={camp} onChange={setCamp} options={[["enemy", t("Contre nous")], ["ally", t("Les nôtres")]]} />
        <Segmented label={t("Côté de notre équipe")} value={side} onChange={(value) => { setSide(value); setSelectedId(""); }} options={[["", t("Les deux")], ["blue", t("Bleu"), "blue"], ["red", t("Rouge"), "red"]]} />
        <SelectInput label={t("Équipe adverse liée")} value={opponentId} onChange={changeOpponent}><option value="">{t("Toutes les équipes et sans équipe")}</option><option value="unassigned">{t("Sans équipe liée")}</option>{state.opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</SelectInput>
      </div>
      <dl className="drafter-coverage" aria-label={t("Qualité des données")}>
        <Coverage label={t("Ordre disponible")} count={model.ordered} total={model.total} />
        <Coverage label={t("Liées à une partie")} count={model.linked} total={model.total} />
        <Coverage label={t("Bans complets")} count={banStats.coverage.bans} total={model.total} />
        <div><dt>{t("Retraits en phase 2")}</dt><dd>{phaseTwoCount}<span>{t("sur {0} drafts exploitables", [banStats.coverage.phase2])}</span></dd></div>
      </dl>
      {warnings.length > 0 && <ul className="drafter-warnings">{warnings.map((warning) => <li key={warning}><AlertTriangle aria-hidden="true" /><span>{warning}</span></li>)}</ul>}
      <div className="drafter-disclosures">
        <details className="draft-intelligence-disclosure"><summary>{t("Affiner le périmètre")}</summary><div className="drafter-filters">
          <SelectInput label={t("Drafts incluses")} value={scope} onChange={changeScope}><option value="all">{t("Toutes les drafts")}</option><option value="linked">{t("Liées à une partie")}</option><option value="unlinked">{t("Sans partie liée")}</option></SelectInput>
          <SelectInput label={t("Patch de la draft")} value={patch} onChange={(value) => { setPatch(value); setSelectedId(""); }}><option value="">{t("Tous les patchs")}</option><option value="unknown">{t("Patch non renseigné")}</option>{patches.map((value) => <option key={value} value={value}>{value}</option>)}</SelectInput>
          <SelectInput label={t("Format de draft")} value={mode} onChange={(value) => { setMode(value); setSelectedId(""); }}><option value="">{t("Tous les formats")}</option><option value="standard">{t("Standard")}</option><option value="fearless">Fearless</option><option value="ironman">Ironman</option><option value="unknown">{t("Non renseigné")}</option></SelectInput>
        </div></details>
        <details className="draft-intelligence-disclosure drafter-data-details"><summary><Info aria-hidden="true" />{t("Comprendre les données")}</summary><ul>
          <li>{t("Les filtres portent sur toutes les drafts enregistrées, liées ou non à une partie.")}</li>
          <li>{t("Les fréquences décrivent cet échantillon, pas une préférence durable ni l’efficacité d’un choix. Les données incomplètes sont exclues du calcul concerné.")}</li>
          <li>{t("Phase 1 : avant les picks. Phase 2 : après trois picks de chaque côté. Un ban retire le champion aux deux équipes.")}</li>
        </ul></details>
      </div>
    </Surface>
    {!drafts.length ? <Surface><EmptyState icon={Shield} title={t("Aucune draft dans cette sélection")} text={t("Change l’adversaire ou la portée pour retrouver les drafts enregistrées.")} /></Surface> : <>
      <DraftBanIntelligence key={scopeKey} model={intelligence} camp={camp} onOpenDraft={inspectDraft} draftLabel={draftLabel} />
      <DraftRotations key={`rotations-${scopeKey}`} model={intelligence} onOpenDraft={inspectDraft} draftLabel={draftLabel} />
      <Surface><details className="draft-intelligence-disclosure" ref={chronologyRef} open={Boolean(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("draft")) || undefined}>
        <summary ref={chronologySummary}>{t("Ordre des picks et des bans")}</summary>
        <div className="drafter-analysis-heading"><h3>{t("Revoir une draft source")}</h3><Badge>{t("Game {0}", [selected.gameNumber])}</Badge></div>
        <SelectInput label={t("Draft à revoir")} value={selected.id} onChange={setSelectedId}>{drafts.map((draft) => <option key={draft.id} value={draft.id}>{draftLabel(draft)}</option>)}</SelectInput>
        <div className="drafter-source-links"><SourceLink snapshot={selected.snapshot} />{selected.matchId && <a href={`/games?match=${encodeURIComponent(selected.matchId)}`}>{t("Voir la partie liée")}{matchNames.has(String(selected.matchId)) && <span> · {matchNames.get(String(selected.matchId))}</span>}</a>}</div>
        <p className="drafter-muted">{selected.opponentId && opponentNames.has(selected.opponentId) ? t("Équipe liée à la partie : {0}", [opponentNames.get(selected.opponentId)]) : t("Aucune équipe adverse liée. Les noms ci-dessous sont ceux du Drafter.")}</p>
        <DraftChronology snapshot={selected.snapshot} allySide={selected.allySide} />
      </details></Surface>
      <Surface><details className="drafter-priorities"><summary>{t("Comparer les priorités de sélection")}</summary>
        <p className="drafter-muted">{t(camp === "enemy" ? "Ces listes décrivent les picks adverses." : "Ces listes décrivent nos picks.")} {t("Premier pick global : seulement quand ce camp ouvre. Rangs 1 à 5 ≠ rôles joués.")}</p>
        <div className="drafter-frequencies">
          <Frequency title={t("Champions sélectionnés")} entries={stats.picks} coverage={stats.coverage.picks} total={model.total} />
          <Frequency title={t("Premier pick global")} entries={stats.firstPicks} coverage={stats.coverage.firstPicks} total={model.total} /></div>
        <div className="drafter-pick-slots">{[1, 2, 3, 4, 5].map((slot) => <Frequency key={slot} title={t("Choix n° {0}", [slot])} entries={stats.pickSlots[slot]} coverage={stats.coverage.pickSlots[slot]} total={model.total} limit={3} />)}</div>
      </details></Surface>
    </>}
  </div>;
}

export default function DrafterAnalysis({ teamId, matches = [], players = [], championPool = [] }) {
  useLanguage();
  return teamId ? <TeamDrafterAnalysis key={teamId} teamId={teamId} matches={matches} players={players} championPool={championPool} />
    : <Surface><EmptyState icon={Shield} title={t("Choisis une équipe")} text={t("Les drafts analysées appartiennent à l’équipe sélectionnée.")} /></Surface>;
}
