import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ListOrdered, RefreshCw, Shield } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { openAppPath } from "../../app/routing.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { buildDraftAnalysis } from "../../utils/draft-analysis.js";
import { draftOrder } from "../../../shared/draft-order.js";
import { matchDisplayName } from "../../utils/matches.js";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { Badge, Button, EmptyState, SelectInput, SkeletonRows, Surface } from "../ui/Core.jsx";
import { SourceLink } from "../opponents/OpponentsWorkspace.jsx";
import "./drafter-analysis.css";

const phaseGroups = [
  { phase: 1, kind: "ban", title: "Bans · phase 1" },
  { phase: 1, kind: "pick", title: "Picks · phase 1" },
  { phase: 2, kind: "ban", title: "Bans · phase 2" },
  { phase: 2, kind: "pick", title: "Picks · phase 2" },
];

function Frequency({ title, entries = [], coverage = 0, total = 0, limit = 8 }) {
  return <section className="drafter-frequency">
    <h4>{title}</h4>
    <p className="drafter-muted">{coverage === 1 ? t("1 draft exploitable sur {0}", [total]) : t("{0} drafts exploitables sur {1}", [coverage, total])}</p>
    {entries.length ? <ol>{entries.slice(0, limit).map(({ champion, count, total: denominator }) => <li key={champion}>
      <span className="drafter-champion"><ChampionPortrait champion={champion} className="h-8 w-8 rounded-md object-cover" /><span>{championDisplayName(champion)}</span></span>
      <strong>{count} / {denominator}</strong>
    </li>)}</ol> : <p className="drafter-muted">{t("Aucune donnée disponible.")}</p>}
  </section>;
}

export function DraftChronology({ snapshot, allySide }) {
  useLanguage();
  const order = useMemo(() => draftOrder(snapshot), [snapshot]);
  if (order.status !== "known") return <div className="drafter-order-unavailable">
    <p>{t("Ordre de sélection indisponible pour cet import.")}</p>
    <p className="drafter-muted">{t(order.message)}</p>
  </div>;
  return <div className="drafter-chronology">
    <p className="drafter-muted">{t("Ordre reconstitué depuis les emplacements finaux de Drafter. Les corrections pendant la draft ne sont pas un journal d’événements ; les rôles joués restent distincts.")}</p>
    {phaseGroups.map(({ phase, kind, title }) => <section key={`${phase}-${kind}`} className="drafter-phase">
      <h4>{t(title)}</h4>
      <ol>{order.events.filter((event) => event.phase === phase && event.kind === kind).map((event) => <li key={event.order} data-side={event.side} value={event.order}>
        <div className="drafter-event-heading"><strong>#{event.order}</strong><span>{t(event.side === "blue" ? "Côté bleu" : "Côté rouge")}</span></div>
        <p className="drafter-event-team">{snapshot[`${event.side}Name`] || t("Équipe sans nom")}</p>
        <span className="drafter-event-owner">{t(event.side === allySide ? "Notre équipe" : "Adversaire")}</span>
        <div className="drafter-event-pick">{event.champion && <ChampionPortrait champion={event.champion} className="h-10 w-10 rounded-md object-cover" />}<strong>{event.champion ? championDisplayName(event.champion) : event.valueStatus === "skipped" ? t("Ban non utilisé") : t("Non renseigné")}</strong></div>
        <span className="drafter-muted">{t(kind === "pick" ? "Pick {0}" : "Ban {0}", [event.slot])}</span>
      </li>)}</ol>
    </section>)}
  </div>;
}

function TeamDrafterAnalysis({ teamId, matches }) {
  const [state, setState] = useState({ loading: true, error: "", opponents: [], drafts: [] });
  const [reload, setReload] = useState(0);
  const [opponentId, setOpponentId] = useState("");
  const [camp, setCamp] = useState("enemy");
  const [scope, setScope] = useState("all");
  const [selectedId, setSelectedId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("draft") || "");
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, error: "", opponents: [], drafts: [] });
    apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "list", teamId }), signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setState({ ...result, loading: false, error: "" }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ loading: false, error: error.message, opponents: [], drafts: [] }); });
    return () => controller.abort();
  }, [teamId, reload]);
  const drafts = useMemo(() => state.drafts.filter((draft) => (!opponentId || (opponentId === "unassigned" ? !draft.opponentId : draft.opponentId === opponentId))
    && (scope === "all" || (scope === "linked" ? Boolean(draft.matchId) : !draft.matchId))), [state.drafts, opponentId, scope]);
  const model = useMemo(() => buildDraftAnalysis(drafts), [drafts]);
  const stats = model[camp];
  const selected = drafts.find((draft) => draft.id === selectedId) || drafts[0];
  const matchNames = useMemo(() => new Map(matches.map((match) => [String(match.id), matchDisplayName(match)])), [matches]);
  const opponentNames = useMemo(() => new Map(state.opponents.map((opponent) => [opponent.id, opponent.name])), [state.opponents]);
  const draftLabel = (draft) => `${opponentNames.get(draft.opponentId) || draft.snapshot[draft.allySide === "blue" ? "redName" : "blueName"]} · ${t("Game {0}", [draft.gameNumber])} · ${draft.sourceId}`;
  const changeOpponent = (value) => { setOpponentId(value); setSelectedId(""); };
  const changeScope = (value) => { setScope(value); setSelectedId(""); };

  if (state.loading) return <Surface><p role="status">{t("Chargement des drafts…")}</p><SkeletonRows /></Surface>;
  if (state.error) return <Surface><p role="alert">{t(state.error)}</p><Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Réessayer")}</Button></Surface>;
  if (!state.drafts.length) return <Surface><EmptyState icon={ListOrdered} title={t("Les drafts importées commencent l’analyse")} text={t("Ajoute un lien Drafter dans le détail d’une partie pour retrouver ses picks, ses bans et leur ordre. Le lien vers une équipe adverse reste facultatif.")} /><Button type="button" icon={ArrowRight} onClick={() => openAppPath("/games")}>{t("Ouvrir les parties")}</Button></Surface>;
  return <div className="drafter-analysis">
    <Surface>
      <div className="drafter-analysis-heading"><div><h3>{t("Drafts & bans")}</h3><p className="drafter-muted">{t("Ces filtres portent sur les drafts enregistrées, y compris celles qui ne sont pas encore liées à une partie.")}</p></div><Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Actualiser")}</Button></div>
      <div className="drafter-filters">
        <SelectInput label={t("Équipe adverse liée")} value={opponentId} onChange={changeOpponent}><option value="">{t("Toutes les équipes et sans équipe")}</option><option value="unassigned">{t("Sans équipe liée")}</option>{state.opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}</SelectInput>
        <SelectInput label={t("Choix à analyser")} value={camp} onChange={setCamp}><option value="enemy">{t("Adversaires")}</option><option value="ally">{t("Notre équipe")}</option></SelectInput>
        <SelectInput label={t("Drafts incluses")} value={scope} onChange={changeScope}><option value="all">{t("Toutes les drafts")}</option><option value="linked">{t("Liées à une partie")}</option><option value="unlinked">{t("Sans partie liée")}</option></SelectInput>
      </div>
      <dl className="drafter-metrics" aria-live="polite"><div><dt>{t("Drafts analysées")}</dt><dd>{model.total}</dd></div><div><dt>{t("Ordre disponible")}</dt><dd>{model.ordered} / {model.total}</dd></div><div><dt>{t("Liées à une partie")}</dt><dd>{model.linked} / {model.total}</dd></div></dl>
      <p className="drafter-muted">{t("Les fréquences décrivent cet échantillon. Elles ne prouvent ni une préférence durable ni l’efficacité d’un choix. Les données incomplètes sont exclues du calcul concerné.")}</p>
      {model.warnings.map((warning) => <p className="drafter-muted" key={warning}>{t(warning)}</p>)}
    </Surface>
    {!drafts.length ? <Surface><EmptyState icon={Shield} title={t("Aucune draft dans cette sélection")} text={t("Change l’adversaire ou la portée pour retrouver les drafts enregistrées.")} /></Surface> : <>
      <Surface><div className="drafter-frequencies">
        <Frequency title={t("Champions sélectionnés")} entries={stats.picks} coverage={stats.coverage.picks} total={model.total} />
        <Frequency title={t("Champions bannis")} entries={stats.bans} coverage={stats.coverage.bans} total={model.total} />
      </div></Surface>
      <Surface>
        <div className="drafter-analysis-heading"><h3>{t("Ordre des picks et des bans")}</h3><Badge>{t("Game {0}", [selected.gameNumber])}</Badge></div>
        <SelectInput label={t("Draft à revoir")} value={selected.id} onChange={setSelectedId}>{drafts.map((draft) => <option key={draft.id} value={draft.id}>{draftLabel(draft)}</option>)}</SelectInput>
        <div className="drafter-source-links"><SourceLink snapshot={selected.snapshot} />{selected.matchId && <a href={`/games?match=${encodeURIComponent(selected.matchId)}`}>{t("Voir la partie liée")}{matchNames.has(String(selected.matchId)) && <span> · {matchNames.get(String(selected.matchId))}</span>}</a>}</div>
        <p className="drafter-muted">{selected.opponentId && opponentNames.has(selected.opponentId) ? t("Équipe liée à la partie : {0}", [opponentNames.get(selected.opponentId)]) : t("Aucune équipe adverse liée. Les noms ci-dessous sont ceux du Drafter.")}</p>
        <DraftChronology snapshot={selected.snapshot} allySide={selected.allySide} />
      </Surface>
      <Surface><details className="drafter-priorities"><summary>{t("Comparer les priorités de sélection et les phases de bans")}</summary>
        <p className="drafter-muted">{t("Le premier pick global ne compte que les drafts où le camp analysé ouvre la sélection. Les rangs 1 à 5 désignent ses propres choix, pas les rôles joués.")}</p>
        <div className="drafter-frequencies"><Frequency title={t("Premier pick global")} entries={stats.firstPicks} coverage={stats.coverage.firstPicks} total={model.total} />
          <Frequency title={t("Bans · phase 1")} entries={stats.banPhases[1]} coverage={stats.coverage.banPhases[1]} total={model.total} />
          <Frequency title={t("Bans · phase 2")} entries={stats.banPhases[2]} coverage={stats.coverage.banPhases[2]} total={model.total} /></div>
        <div className="drafter-pick-slots">{[1, 2, 3, 4, 5].map((slot) => <Frequency key={slot} title={t("Choix n° {0}", [slot])} entries={stats.pickSlots[slot]} coverage={stats.coverage.pickSlots[slot]} total={model.total} limit={3} />)}</div>
      </details></Surface>
    </>}
  </div>;
}

export default function DrafterAnalysis({ teamId, matches = [] }) {
  useLanguage();
  return teamId ? <TeamDrafterAnalysis key={teamId} teamId={teamId} matches={matches} />
    : <Surface><EmptyState icon={Shield} title={t("Choisis une équipe")} text={t("Les drafts analysées appartiennent à l’équipe sélectionnée.")} /></Surface>;
}
