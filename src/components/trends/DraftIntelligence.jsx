import React, { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { ROLES } from "../../../shared/roles.js";
import { draftOrder } from "../../../shared/draft-order.js";
import { canonicalChampion } from "../../../shared/champions.js";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Badge, Button, Surface, TextInput } from "../ui/Core.jsx";
import "./draft-intelligence.css";

const percentage = ({ count, total }) => total ? `${Math.round(100 * count / total)} %` : "—";
const ratio = ({ count, total }) => total ? Math.min(100, 100 * count / total) : 0;
const metricFor = (row, phase) => phase === "all" ? row : row[`phase${phase}`];
const sourcesFor = (row, phase) => phase === "all" ? row.sources : row[`phase${phase}`].sources;
const fold = (value) => String(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const POOL_STATUS = { lock: "Confiance", pocket: "Situationnel", work: "En validation", danger: "En entraînement" };

/** Native radio group styled as a segmented control: arrow keys, labels and form semantics come for free. */
export function Segmented({ label, value, onChange, options, className = "" }) {
  const name = useId();
  return <fieldset className={`draft-segmented ${className}`.trim()}>
    <legend>{label}</legend>
    <div className="draft-segmented-options">{options.map(([optionValue, optionLabel, tone]) => <label key={optionValue} data-tone={tone || undefined}>
      <input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={(event) => onChange(event.target.value)} />
      <span>{optionLabel}</span>
    </label>)}</div>
  </fieldset>;
}

/** Thin horizontal meter; the number it represents is always printed next to it. */
export function Meter({ value, tone = "cyan" }) {
  return <span className="draft-meter" data-tone={tone} aria-hidden="true"><span style={{ width: `${value}%` }} /></span>;
}

function PhaseLegend() {
  return <ul className="draft-phase-legend" aria-label={t("Légende des phases")}>
    <li data-phase="1"><span aria-hidden="true" />{t("P1 · avant les picks")}</li>
    <li data-phase="2"><span aria-hidden="true" />{t("P2 · après 3 picks par camp")}</li>
  </ul>;
}

function SourceDrafts({ sources = [], onOpenDraft, draftLabel }) {
  const [expanded, setExpanded] = useState(false);
  return <>
    <ul className="draft-source-list">{sources.slice(0, expanded ? undefined : 3).map((draft) => <li key={draft.id}>
      <button type="button" className="draft-source-button" onClick={() => onOpenDraft(draft.id)}><span>{draftLabel(draft)}</span><ArrowRight aria-hidden="true" size={16} /></button>
    </li>)}</ul>
    {sources.length > 3 && <button type="button" className="draft-source-more" onClick={() => setExpanded(!expanded)}>{expanded ? t("Réduire la liste") : t("Voir les {0} drafts sources", [sources.length])}</button>}
  </>;
}

function ChampionChip({ champion, caption, value }) {
  return <li className="draft-chip">
    <ChampionPortrait champion={champion} className="h-9 w-9 rounded-md object-cover" />
    <span><strong>{championDisplayName(champion)}</strong>{caption && <small>{caption}</small>}</span>
    {value && <em>{value}</em>}
  </li>;
}

function BanDetail({ row, phase, camp, onOpenDraft, draftLabel, detailRef }) {
  const metric = metricFor(row, phase);
  const sources = sourcesFor(row, phase);
  const name = championDisplayName(row.champion);
  const early = row.slots.filter((slot) => slot.slot <= 3).reduce((sum, slot) => sum + slot.count, 0);
  const late = row.slots.filter((slot) => slot.slot > 3).reduce((sum, slot) => sum + slot.count, 0);
  const hasKnownPhase = early + late > 0;
  const example = sources.find((source) => draftOrder(source.snapshot).status === "known");
  const exampleOrder = example ? draftOrder(example.snapshot) : null;
  const targetSide = example && (camp === "enemy" ? example.allySide : example.allySide === "blue" ? "red" : "blue");
  const ban = exampleOrder?.events.find((event) => event.kind === "ban" && event.side !== targetSide && canonicalChampion(event.champion) === row.champion);
  const revealed = exampleOrder?.events.filter((event) => event.kind === "pick" && event.side === targetSide && event.order < ban?.order) || [];
  return <section ref={detailRef} tabIndex={-1} className="draft-ban-detail" aria-label={t("Comprendre les bans de {0}", [name])}>
    <header className="draft-ban-hero">
      <ChampionPortrait champion={row.champion} className="h-16 w-16 rounded-xl object-cover" />
      <div className="draft-ban-hero-name"><h4>{name}</h4><Badge tone="cyan">{metric.count < 3 ? t("À confirmer") : t("Observation répétée")}</Badge></div>
      <p className="draft-ban-hero-rate"><strong>{percentage(metric)}</strong><span>{metric.total ? t("{0}/{1} drafts", [metric.count, metric.total]) : t("Fréquence indisponible")}</span></p>
    </header>
    {!metric.total && <p className="draft-note">{t("Bans renseignés, mais données trop incomplètes pour une fréquence.")}</p>}

    <dl className="draft-kpis">
      <div data-phase="1"><dt>{t("Phase 1")}</dt><dd>{row.phase1.count}/{row.phase1.total}</dd><Meter value={ratio(row.phase1)} /></div>
      <div data-phase="2"><dt>{t("Phase 2")}</dt><dd>{row.phase2.count}/{row.phase2.total}</dd><Meter value={ratio(row.phase2)} tone="lavender" /></div>
      {row.unknownPhase > 0 && <div><dt>{t("Sans phase vérifiée")}</dt><dd>{row.unknownPhase}</dd></div>}
    </dl>

    {hasKnownPhase && <div className="draft-detail-block"><h5>{t("Emplacement du ban")}</h5>
      <ol className="draft-ban-slots">{row.slots.map((slot) => <li key={slot.slot} data-phase={slot.slot <= 3 ? 1 : 2} style={{ "--heat": slot.total ? slot.count / slot.total : 0 }}>
        <span>{t("Ban {0}", [slot.slot])}</span><strong>{slot.count}/{slot.total}</strong>
      </li>)}</ol></div>}

    <div className="draft-detail-block"><h5>{t(camp === "enemy" ? "Qui peut être concerné ?" : "Quels rôles adverses sont concernés ?")}</h5>
      {!!row.poolPlayers?.length && <ul className="draft-pool-players">{row.poolPlayers.map((player) => <li key={`${player.id}-${player.role}`}>
        <RoleIcon role={player.role} className="h-6 w-6" /><span><strong>{player.name}</strong><small>{player.role} · {t(POOL_STATUS[player.status] || "En validation")}</small></span>
      </li>)}</ul>}
      {row.roles.length > 0 ? <ul className="draft-role-chips" aria-label={t("Rôles observés dans les parties")}>{row.roles.map((role) => <li key={role.role}><RoleIcon role={role.role} className="h-5 w-5" /><span>{role.role}</span><strong>{role.games === 1 ? t("1 partie") : t("{0} parties", [role.games])}</strong></li>)}</ul>
        : <p className="draft-note">{t("Aucun rôle joué vérifiable dans les parties disponibles.")}</p>}
    </div>

    {example && ban && <div className="draft-detail-block"><h5>{t(revealed.length ? "Exemple · ban {0}, phase {1} · picks déjà révélés" : "Exemple · ban {0}, phase {1}", [ban.slot, ban.phase])}</h5>
      {revealed.length ? <ul className="draft-chip-row" aria-label={t("Picks déjà révélés")}>{revealed.map((event) => <ChampionChip key={event.order} champion={event.champion} />)}</ul>
        : <p className="draft-note">{t("Aucun pick encore révélé.")}</p>}
      <SourceDrafts sources={[example]} onOpenDraft={onOpenDraft} draftLabel={draftLabel} /></div>}

    <div className="draft-detail-block"><h5>{t("Joué à la place")}</h5>
      {row.alternatives.length ? <ul className="draft-chip-row">{row.alternatives.slice(0, 4).map((item) => <ChampionChip key={`${item.champion}-${item.role}`} champion={item.champion} caption={item.role} value={`${item.count}/${item.total}`} />)}</ul>
        : <p className="draft-note">{t("Pas encore de partie liée compatible.")}</p>}
    </div>

    <div className="draft-detail-block"><h5>{t("Drafts sources")}</h5><SourceDrafts key={`${row.champion}-${phase}`} sources={sources} onOpenDraft={onOpenDraft} draftLabel={draftLabel} /></div>

    <details className="draft-intelligence-disclosure draft-limits"><summary><Info aria-hidden="true" />{t("Comment lire cette fiche")}</summary><ul>
      <li>{t("Taux calculés sur les phases renseignées, pas seulement quand le champion était disponible.")}</li>
      <li>{t("Bans 1 à 3 : phase 1. Bans 4 et 5 : phase 2. Les cases inconnues sont exclues de chaque emplacement.")}</li>
      <li>{t("Pools actuels, pas historiques. Un champion partagé concerne plusieurs joueurs ; le rapprochement ne prouve pas l’intention du ban.")}</li>
      <li>{t("« Joué à la place » : choix observés au même rôle pendant ce ban, toutes phases confondues. Ni remplacement garanti, ni classement de puissance.")}</li>
      <li>{t("Les sources incluent les bans renseignés même lorsque d’autres cases manquent.")}</li>
    </ul></details>
  </section>;
}

function BanBar({ row, phase }) {
  const metric = metricFor(row, phase);
  const p1 = phase === "2" ? 0 : row.phase1.count;
  const p2 = phase === "1" ? 0 : row.phase2.count;
  return <span className="draft-ban-bar" aria-hidden="true"><span style={{ width: `${ratio(metric)}%` }}>
    {p1 + p2 > 0 ? <><span data-phase="1" style={{ flexGrow: p1 }} /><span data-phase="2" style={{ flexGrow: p2 }} /></> : <span data-phase="unknown" style={{ flexGrow: 1 }} />}
  </span></span>;
}

export function DraftBanIntelligence({ model, camp, onOpenDraft, draftLabel }) {
  useLanguage();
  const [phase, setPhase] = useState("all");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [selectedChampion, setSelectedChampion] = useState("");
  const [expanded, setExpanded] = useState(false);
  const detailRef = useRef(null);
  const focusRequested = useRef(false);
  const campModel = model.camps[camp];
  const allRows = campModel.bans;
  const rows = useMemo(() => allRows.filter((row) => fold(championDisplayName(row.champion)).includes(fold(query))
    && (!role || row.roles.some((entry) => entry.role === role) || row.poolPlayers?.some((entry) => entry.role === role))
    && (phase === "all" || row[`phase${phase}`].sources.length > 0))
    .sort((a, b) => metricFor(b, phase).count - metricFor(a, phase).count || b.observed - a.observed || a.champion.localeCompare(b.champion)), [allRows, query, role, phase]);
  const visibleRows = rows.slice(0, expanded ? undefined : 8);
  const selected = visibleRows.find((row) => row.champion === selectedChampion) || visibleRows[0];
  const focusDetail = () => {
    detailRef.current?.focus({ preventScroll: true });
    detailRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  useLayoutEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    focusDetail();
  }, [selected?.champion]);
  const affectedPlayers = new Set(allRows.filter((row) => row.observed > 0).flatMap((row) => row.poolPlayers || []).map((player) => player.id));
  const updateFilter = (setter) => (value) => { setter(value); setSelectedChampion(""); setExpanded(false); };
  return <Surface className="draft-intelligence" glow>
    <header className="draft-intelligence-section-heading"><div><h3>{t(camp === "enemy" ? "Bans contre nous" : "Nos bans")}</h3><p className="drafter-muted" role="status">{t("{0} champions dans cette vue", [rows.length])}</p></div><PhaseLegend /></header>
    <div className="draft-intelligence-filters">
      <Segmented label={t("Phase des bans")} value={phase} onChange={updateFilter(setPhase)} options={[["all", t("Toutes")], ["1", t("Phase 1"), "phase1"], ["2", t("Phase 2"), "phase2"]]} />
      <fieldset className="draft-segmented draft-role-filter"><legend>{t("Rôle concerné")}</legend><div className="draft-segmented-options">
        {["", ...ROLES].map((value) => <label key={value || "all"} title={value || undefined}>
          <input type="radio" name={`ban-role-${camp}`} value={value} checked={role === value} onChange={(event) => updateFilter(setRole)(event.target.value)} />
          <span>{value ? <><RoleIcon role={value} className="h-5 w-5" /><span className="sr-only">{value}</span></> : t("Tous")}</span>
        </label>)}
      </div></fieldset>
      <TextInput label={t("Rechercher un champion banni")} value={query} onChange={updateFilter(setQuery)} type="search" />
    </div>
    {!rows.length ? <p className="draft-note">{allRows.length ? t("Aucun ban ne correspond à ces filtres. Essaie un autre rôle, champion ou une autre phase.") : t("Aucun champion banni renseigné pour ce camp. Les bans non utilisés ne sont pas des données manquantes.")}</p> : <div className="draft-ban-layout">
      <div><ol className="draft-ban-list">{visibleRows.map((row, index) => {
        const metric = metricFor(row, phase);
        return <li key={row.champion}><button type="button" className="draft-ban-row" aria-pressed={selected?.champion === row.champion} aria-label={t("Analyser les bans de {0}", [championDisplayName(row.champion)])} onClick={() => { if (selected?.champion === row.champion) { focusDetail(); return; } focusRequested.current = true; setSelectedChampion(row.champion); }}>
          <span className="draft-ban-rank" aria-hidden="true">{index + 1}</span>
          <ChampionPortrait champion={row.champion} className="h-10 w-10 rounded-md object-cover" />
          <span className="draft-ban-main">
            <span className="draft-ban-line"><strong>{championDisplayName(row.champion)}</strong><span className="draft-ban-count">{metric.total ? `${metric.count}/${metric.total}` : t("Fréquence indisponible")}</span></span>
            <BanBar row={row} phase={phase} />
            <span className="draft-ban-phases"><span data-phase="1">P1 {row.phase1.count}/{row.phase1.total}</span><span data-phase="2">P2 {row.phase2.count}/{row.phase2.total}</span></span>
          </span>
          <strong className="draft-ban-rate">{percentage(metric)}</strong>
        </button></li>;
      })}</ol>{rows.length > 8 && <Button type="button" variant="ghost" onClick={() => setExpanded(!expanded)}>{expanded ? t("Réduire la liste") : t("Voir les {0} champions", [rows.length])}</Button>}</div>
      {selected && <BanDetail detailRef={detailRef} row={selected} phase={phase} camp={camp} onOpenDraft={onOpenDraft} draftLabel={draftLabel} />}
    </div>}
    {camp === "enemy" && <details className="draft-intelligence-disclosure draft-pool-section" open><summary>{t("Qui perd des options ?")}{model.poolCoverage > 0 && <span className="draft-pool-count">{affectedPlayers.size === 1 ? t("1 joueur concerné") : t("{0} joueurs concernés", [affectedPlayers.size])}</span>}</summary>
      {model.poolPressure?.length ? <><ul className="draft-pool-pressure">{model.poolPressure.map((player) => <li key={`${player.id}-${player.role}`}>
        <span className="draft-pool-player"><RoleIcon role={player.role} className="h-7 w-7" /><span><strong>{player.name}</strong><small>{player.role}</small></span></span>
        <ul className="draft-pool-champions" aria-label={t("Champions bannis de son pool")}>{player.champions.map((entry) => <li key={entry.champion} title={championDisplayName(entry.champion)}><ChampionPortrait champion={entry.champion} className="h-8 w-8 rounded-md object-cover" /><span className="sr-only">{championDisplayName(entry.champion)}</span></li>)}</ul>
        <span className="draft-pool-meter"><strong>{player.count}/{player.total}</strong><span>{t("drafts avec une option retirée")}</span><Meter value={ratio(player)} tone="lavender" /></span>
      </li>)}</ul><p className="draft-note">{t("Pools déclarés actuels. Une draft compte une fois par joueur et rôle.")}</p></>
        : <p className="draft-note">{t(model.poolCoverage ? "Aucun ban renseigné ne correspond aux pools déclarés dans ce périmètre." : "Déclare les champions préparés par tes joueurs dans Draft & Pool pour mesurer leur exposition aux bans.")}</p>}
    </details>}
  </Surface>;
}

export function DraftRotations({ model, onOpenDraft, draftLabel }) {
  useLanguage();
  const [position, setPosition] = useState("opening");
  const rotations = model.rotations.filter((row) => row.id.startsWith(position) && row.total > 0);
  return <Surface className="draft-intelligence"><div className="draft-intelligence-section-heading"><div><h3>{t("Nos rotations de picks")}</h3><p className="drafter-muted">{t("Picks consécutifs avant de rendre la main. Rang de sélection ≠ rôle joué.")}</p></div>
    <Segmented label={t("Notre position dans la sélection")} value={position} onChange={setPosition} options={[["opening", t("Premier pick")], ["responding", t("Réponse au premier pick")]]} /></div>
    {!rotations.length ? <p className="draft-note">{t("Aucune rotation vérifiée dans cette position. Essaie l’autre position ou réimporte les drafts sans ordre.")}</p> : <ol className="draft-rotation-grid">{rotations.map((rotation) => <li className="draft-rotation" data-phase={rotation.phase} key={rotation.id}>
      <header><Badge tone={rotation.phase === 1 ? "cyan" : "purple"}>{t("Phase {0}", [rotation.phase])}</Badge><span className="draft-rotation-slots">{rotation.labels.join(" / ")}</span><h4>{t(rotation.label)}</h4><p className="drafter-muted">{t("{0} drafts exploitables", [rotation.total])}</p></header>
      <ul className="draft-rotation-champions">{rotation.champions.slice(0, 3).map((item) => <li key={item.champion}>
        <ChampionPortrait champion={item.champion} className="h-9 w-9 rounded-md object-cover" />
        <span className="draft-rotation-champion"><span><span>{championDisplayName(item.champion)}</span><strong>{item.count}/{item.total}</strong></span><Meter value={ratio(item)} tone={rotation.phase === 1 ? "cyan" : "lavender"} /></span>
      </li>)}</ul>
      {rotation.roles.length ? <ul className="draft-role-chips" aria-label={t("Rôles retrouvés")}>{rotation.roles.map((item) => <li key={item.role}><RoleIcon role={item.role} className="h-5 w-5" /><span>{item.role}</span><strong>{item.count}/{item.total}</strong></li>)}</ul>
        : <p className="draft-note">{t("Rôles indisponibles sans partie liée compatible.")}</p>}
      <details className="draft-intelligence-disclosure"><summary>{t("Vérifier cette rotation")}</summary><SourceDrafts sources={rotation.sources} onOpenDraft={onOpenDraft} draftLabel={draftLabel} /></details>
    </li>)}</ol>}
  </Surface>;
}
