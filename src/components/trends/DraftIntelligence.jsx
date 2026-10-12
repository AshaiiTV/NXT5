import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { ROLES } from "../../../shared/roles.js";
import { draftOrder } from "../../../shared/draft-order.js";
import { canonicalChampion } from "../../../shared/champions.js";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { Badge, Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import "./draft-intelligence.css";

const percentage = ({ count, total }) => total ? `${Math.round(100 * count / total)} %` : "—";
const metricFor = (row, phase) => phase === "all" ? row : row[`phase${phase}`];
const sourcesFor = (row, phase) => phase === "all" ? row.sources : row[`phase${phase}`].sources;
const fold = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function SourceDrafts({ sources = [], onOpenDraft, draftLabel }) {
  const [expanded, setExpanded] = useState(false);
  return <>
    <ul className="draft-source-list">{sources.slice(0, expanded ? undefined : 3).map((draft) => <li key={draft.id}>
      <button type="button" className="draft-source-button" onClick={() => onOpenDraft(draft.id)}><span>{draftLabel(draft)}</span><ArrowRight aria-hidden="true" size={16} /></button>
    </li>)}</ul>
    {sources.length > 3 && <button type="button" className="draft-source-more" onClick={() => setExpanded(!expanded)}>{expanded ? t("Réduire la liste") : t("Voir les {0} drafts sources", [sources.length])}</button>}
  </>;
}

function BanDetail({ row, phase, camp, onOpenDraft, draftLabel, detailRef }) {
  const metric = metricFor(row, phase);
  const sources = sourcesFor(row, phase);
  const name = championDisplayName(row.champion);
  const early = row.slots.filter((slot) => slot.slot <= 3).reduce((sum, slot) => sum + slot.count, 0);
  const late = row.slots.filter((slot) => slot.slot > 3).reduce((sum, slot) => sum + slot.count, 0);
  const hasLateBans = phase === "2" || (phase === "all" && late > early);
  const hasKnownPhase = early + late > 0;
  const example = sources.find((source) => draftOrder(source.snapshot).status === "known");
  const exampleOrder = example ? draftOrder(example.snapshot) : null;
  const targetSide = example && (camp === "enemy" ? example.allySide : example.allySide === "blue" ? "red" : "blue");
  const ban = exampleOrder?.events.find((event) => event.kind === "ban" && event.side !== targetSide && canonicalChampion(event.champion) === row.champion);
  const revealed = exampleOrder?.events.filter((event) => event.kind === "pick" && event.side === targetSide && event.order < ban?.order) || [];
  return <section ref={detailRef} tabIndex={-1} className="draft-ban-detail" aria-label={t("Comprendre les bans de {0}", [name])}>
    <div className="draft-ban-detail-heading"><ChampionPortrait champion={row.champion} className="h-12 w-12 rounded-lg object-cover" /><div><p className="drafter-muted">{t("Lire le signal")}</p><h4>{name}</h4></div><Badge tone="cyan">{metric.count < 3 ? t("À confirmer") : t("Observation répétée")}</Badge></div>
    <div className="draft-insight"><h5>{t("Ce qu’on observe")}</h5><p>{metric.total ? t("{0} bans sur {1} drafts exploitables dans cette vue.", [metric.count, metric.total]) : t("Des bans sont renseignés, mais les données sont trop incomplètes pour calculer une fréquence.")}</p>
      <p className="drafter-muted">{t("Phase 1 : {0}/{1} · Phase 2 : {2}/{3}", [row.phase1.count, row.phase1.total, row.phase2.count, row.phase2.total])}</p>
      {row.unknownPhase > 0 && <p className="drafter-muted">{t("Bans observés sans phase vérifiée : {0}.", [row.unknownPhase])}</p>}
      <p className="drafter-muted">{t("Ces taux portent sur les phases renseignées, pas sur les seules drafts où le champion était encore disponible.")}</p>
      {hasKnownPhase && <details className="draft-intelligence-disclosure"><summary>{t("À quel emplacement est-il banni ?")}</summary><ol className="draft-ban-slots">{row.slots.map((slot) => <li key={slot.slot}><span>{t("Ban {0}", [slot.slot])}</span><strong>{slot.count}/{slot.total}</strong></li>)}</ol><p className="drafter-muted">{t("Bans 1 à 3 : phase 1. Bans 4 et 5 : phase 2. Chaque emplacement exclut les cases inconnues de son propre calcul.")}</p></details>}
    </div>
    <div className="draft-insight"><h5>{t(camp === "enemy" ? "Qui peut être concerné ?" : "Quels rôles adverses sont concernés ?")}</h5>
      {!!row.poolPlayers?.length && <><p className="drafter-muted">{t("Dans les champions préparés actuellement par :")}</p><ul className="draft-pool-players">{row.poolPlayers.map((player) => <li key={`${player.id}-${player.role}`}><strong>{player.name}</strong><span>{player.role} · {t(({ lock: "Confiance", pocket: "Situationnel", work: "En validation", danger: "En entraînement" })[player.status] || "En validation")}</span></li>)}</ul></>}
      {row.roles.length > 0 ? <p className="drafter-muted">{t("Rôles déjà observés dans les parties disponibles : {0}.", [row.roles.map((role) => `${role.role} (${role.games})`).join(" · ")])}</p> : <p className="drafter-muted">{t("Aucun rôle joué vérifiable pour ce champion dans les parties disponibles.")}</p>}
      <p className="drafter-muted">{t("Un champion partagé peut concerner plusieurs joueurs. Ce rapprochement ne prouve pas l’intention du ban.")}</p>
    </div>
    <div className="draft-insight"><h5>{t("Ce que ça peut vouloir dire")}</h5><p>{t(!hasKnownPhase ? "Sans phase vérifiée, impossible de relier ce ban aux picks déjà révélés. Réimporte les drafts sources pour préciser le contexte." : hasLateBans ? "En phase 2, chaque équipe a déjà montré trois picks. Ce ban peut réduire les options restantes ou retirer une réponse à la composition révélée." : "En phase 1, aucun pick n’est encore révélé. Ce ban peut retirer un confort connu ou une priorité générale ; le seul comptage ne permet pas de trancher.")}</p>
      <h5>{t("À préparer pour la prochaine draft")}</h5><p>{t(camp === "ally" ? "Vérifiez si ce retrait répond aux priorités de cet adversaire et quelles options il lui laisse. Comparez avec les picks révélés avant de reconduire ce ban." : hasKnownPhase && hasLateBans ? "Si ce champion doit rester disponible jusqu’en seconde phase, discutez d’un pick plus tôt et préparez une autre option au même poste." : "Préparez un plan sans ce champion et vérifiez les bans des prochains adversaires avant de construire votre ouverture autour de lui.")}</p>
    </div>
    {example && ban && <div className="draft-insight"><h5>{t("Un exemple dans son contexte")}</h5><p>{t("Ban n° {0} · phase {1}", [ban.slot, ban.phase])}</p><p className="drafter-muted">{revealed.length ? t("Picks déjà révélés par le camp concerné : {0}.", [revealed.map((event) => championDisplayName(event.champion)).join(" · ")]) : t("Aucun pick n’était encore révélé au moment de ce ban.")}</p><SourceDrafts sources={[example]} onOpenDraft={onOpenDraft} draftLabel={draftLabel} /></div>}
    <div className="draft-insight"><h5>{t("Ce qui a été joué à la place")}</h5>
      {row.alternatives.length ? <><ul className="draft-alternatives">{row.alternatives.slice(0, 4).map((item) => <li key={`${item.champion}-${item.role}`}><span className="drafter-champion"><ChampionPortrait champion={item.champion} className="h-8 w-8 rounded-md object-cover" /><span>{championDisplayName(item.champion)} · {item.role}</span></span><strong>{item.count} / {item.total}</strong></li>)}</ul><p className="drafter-muted">{t("Choix observés aux mêmes rôles lorsque ce champion était banni, toutes phases confondues. Ce ne sont pas des remplacements garantis ni un classement de puissance.")}</p></>
        : <p className="drafter-muted">{t("Pas encore de partie liée compatible pour identifier une réponse au même poste.")}</p>}
    </div>
    <div className="draft-insight"><h5>{t("Vérifier dans les drafts")}</h5><p className="drafter-muted">{t("Les sources incluent les bans explicitement renseignés, même lorsque d’autres cases manquent.")}</p><SourceDrafts key={`${row.champion}-${phase}`} sources={sources} onOpenDraft={onOpenDraft} draftLabel={draftLabel} /></div>
  </section>;
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
    <header className="draft-intelligence-section-heading"><h3>{t(camp === "enemy" ? "Bans contre nous" : "Nos bans")}</h3><p className="drafter-muted" role="status">{t("{0} champions dans cette vue", [rows.length])}</p></header>
    <div className="draft-intelligence-filters">
      <SelectInput label={t("Phase des bans")} value={phase} onChange={updateFilter(setPhase)}><option value="all">{t("Toutes les phases")}</option><option value="1">{t("Phase 1 · avant les picks")}</option><option value="2">{t("Phase 2 · après trois picks")}</option></SelectInput>
      <SelectInput label={t("Rôle concerné")} value={role} onChange={updateFilter(setRole)}><option value="">{t("Tous les rôles")}</option>{ROLES.map((value) => <option key={value} value={value}>{value}</option>)}</SelectInput>
      <TextInput label={t("Rechercher un champion banni")} value={query} onChange={updateFilter(setQuery)} type="search" />
    </div>
    {!rows.length ? <p className="draft-insight drafter-muted">{allRows.length ? t("Aucun ban ne correspond à ces filtres. Essaie un autre rôle, champion ou une autre phase.") : t("Aucun champion banni renseigné pour ce camp. Les bans non utilisés ne sont pas des données manquantes.")}</p> : <div className="draft-ban-layout">
      <div><ol className="draft-ban-list">{visibleRows.map((row) => {
        const metric = metricFor(row, phase);
        const phaseTotal = row.phase1.count + row.phase2.count;
        return <li key={row.champion}><button type="button" className="draft-ban-row" aria-pressed={selected?.champion === row.champion} aria-label={t("Analyser les bans de {0}", [championDisplayName(row.champion)])} onClick={() => { if (selected?.champion === row.champion) { focusDetail(); return; } focusRequested.current = true; setSelectedChampion(row.champion); }}>
          <span className="draft-ban-identity"><ChampionPortrait champion={row.champion} className="h-10 w-10 rounded-md object-cover" /><span><strong>{championDisplayName(row.champion)}</strong><span>{metric.total ? t("{0}/{1} drafts exploitables", [metric.count, metric.total]) : t("Fréquence indisponible")}</span></span></span><strong className="draft-ban-rate">{percentage(metric)}</strong>
          <span className="draft-ban-phases"><span>{t("Phase 1 : {0}/{1}", [row.phase1.count, row.phase1.total])}</span><span>{t("Phase 2 : {0}/{1}", [row.phase2.count, row.phase2.total])}</span></span>
          <span className="draft-phase-track" aria-hidden="true"><span data-phase="1" style={{ width: `${phaseTotal ? row.phase1.count / phaseTotal * 100 : 0}%` }} /><span data-phase="2" style={{ width: `${phaseTotal ? row.phase2.count / phaseTotal * 100 : 0}%` }} /></span>
        </button></li>;
      })}</ol>{rows.length > 8 && <Button type="button" variant="ghost" onClick={() => setExpanded(!expanded)}>{expanded ? t("Réduire la liste") : t("Voir les {0} champions", [rows.length])}</Button>}<p className="drafter-muted">{t("Les barres montrent la répartition des bans dans les phases exploitables. Chaque taux garde son propre échantillon.")}</p></div>
      {selected && <BanDetail detailRef={detailRef} row={selected} phase={phase} camp={camp} onOpenDraft={onOpenDraft} draftLabel={draftLabel} />}
    </div>}
    {camp === "enemy" && <details className="draft-intelligence-disclosure"><summary>{t("Qui perd des options ?")}{model.poolCoverage > 0 && <span className="draft-pool-count">{affectedPlayers.size === 1 ? t("1 joueur concerné") : t("{0} joueurs concernés", [affectedPlayers.size])}</span>}</summary><p className="drafter-muted">{t("Rapprochement avec les pools déclarés actuels, pas avec leur état historique. Une draft compte une seule fois par joueur et rôle, même avec plusieurs champions bannis.")}</p>
      {model.poolPressure?.length ? <ul className="draft-pool-pressure">{model.poolPressure.map((player) => <li key={`${player.id}-${player.role}`}><div><strong>{player.name} · {player.role}</strong><p>{player.champions.map((entry) => championDisplayName(entry.champion)).join(" · ")}</p></div><span>{t("Au moins une option retirée dans {0}/{1} drafts", [player.count, player.total])}</span></li>)}</ul> : <p className="drafter-muted">{t(model.poolCoverage ? "Aucun ban renseigné ne correspond aux pools déclarés dans ce périmètre." : "Déclare les champions préparés par tes joueurs dans Draft & Pool pour mesurer leur exposition aux bans.")}</p>}
    </details>}
  </Surface>;
}

export function DraftRotations({ model, onOpenDraft, draftLabel }) {
  useLanguage();
  const [position, setPosition] = useState("opening");
  const rotations = model.rotations.filter((row) => row.id.startsWith(position) && row.total > 0);
  return <Surface className="draft-intelligence"><div className="draft-intelligence-section-heading"><div><h3>{t("À quelle rotation joue-t-on nos champions ?")}</h3><p className="drafter-muted">{t("Une rotation regroupe nos picks consécutifs avant de rendre la main. Les rangs de sélection ne sont pas les rôles joués.")}</p></div></div>
    <SelectInput label={t("Notre position dans la sélection")} value={position} onChange={setPosition}><option value="opening">{t("Nous avons le premier pick")}</option><option value="responding">{t("Nous répondons au premier pick")}</option></SelectInput>
    {!rotations.length ? <p className="draft-insight drafter-muted">{t("Aucune rotation vérifiée dans cette position. Essaie l’autre position ou réimporte les drafts sans ordre.")}</p> : <div className="draft-rotation-grid">{rotations.map((rotation) => <section className="draft-rotation" key={rotation.id}><header><Badge tone={rotation.phase === 1 ? "cyan" : "purple"}>{t("Phase {0}", [rotation.phase])}</Badge><h4>{t(rotation.label)}</h4><p className="drafter-muted">{rotation.labels.join(" / ")}</p><p className="drafter-muted">{t("{0} drafts exploitables", [rotation.total])}</p></header><ul>{rotation.champions.slice(0, 3).map((item) => <li key={item.champion}><span className="drafter-champion"><ChampionPortrait champion={item.champion} className="h-8 w-8 rounded-md object-cover" /><span>{championDisplayName(item.champion)}</span></span><strong>{item.count}/{item.total}</strong></li>)}</ul>
      <p className="draft-rotation-context">{rotation.roles.length ? t("Rôles retrouvés : {0}", [rotation.roles.map((item) => `${item.role} (${item.count}/${item.total})`).join(" · ")]) : t("Rôles indisponibles sans partie liée compatible.")}</p>
      <details className="draft-intelligence-disclosure"><summary>{t("Vérifier cette rotation")}</summary><SourceDrafts sources={rotation.sources} onOpenDraft={onOpenDraft} draftLabel={draftLabel} /></details>
    </section>)}</div>}
    <p className="drafter-muted">{t("Piste de préparation : un champion régulièrement retiré en phase 2 mérite une discussion sur son choix plus tôt, sans sacrifier automatiquement vos autres priorités.")}</p>
  </Surface>;
}
