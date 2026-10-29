import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Button, SelectInput, TextInput } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { resultLabel, resultSummary, winrateLabel } from "../../utils/statistics.js";
import { buildChampionAnalysis } from "../../utils/champion-analysis.js";
import "./champion-analysis.css";

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const PAGE_SIZE = 6;
const shortRecord = (row) => `${row.wins} V · ${row.losses} D${row.unknown ? ` · ${row.unknown} ?` : ""}`;

export function DraftSignals({ analysis, onSources }) {
  useLanguage();
  return <>
    <p className="draft-description">{analysis.completeGames}{t(analysis.completeGames > 1 ? " compositions" : " composition")}{t(analysis.completeGames > 1 ? " complètes" : " complète")}{t(analysis.completeGames > 1 ? " analysées" : " analysée")}{analysis.incompleteGames ? t(" · {0} incomplète{1} exclue{2}", [analysis.incompleteGames, analysis.incompleteGames > 1 ? "s" : "", analysis.incompleteGames > 1 ? "s" : ""]) : ""}.</p>
    {analysis.signals.length ? <ul className="champion-signals">{analysis.signals.map((signal) => <li key={signal.label}><button type="button" disabled={!onSources} onClick={() => onSources(signal, signal.label, `${signal.games} / ${analysis.completeGames} compositions complètes de la sélection.`)}><strong>{t(signal.label)}</strong><span>{signal.games} / {analysis.completeGames}{t(" compositions · ")}{t(resultLabel(signal))}</span>{onSources && <span>{t("Examiner ces parties →")}</span>}</button></li>)}</ul> : <p className="draft-context">{analysis.completeGames ? t("Aucun de ces signaux dans les compositions complètes.") : t("Il faut les cinq rôles et leurs champions pour examiner les signaux de composition.")}</p>}
    <p className="draft-footnote">{t("Ces pistes viennent des marqueurs de style des champions, calculés séparément pour chaque partie. Elles ne prouvent ni un problème de draft ni la cause d’une défaite.")}</p>
  </>;
}

function AssociationList({ title, rows, empty, onSources, prefix }) {
  useLanguage();
  const [expanded, setExpanded] = useState(false);
  return <section className="champion-associations">
    <h5>{t(title)}</h5>
    {rows.length ? <ul>{(expanded ? rows : rows.slice(0, 3)).map((row) => <li key={`${row.champion}-${row.role}`}>
      <button type="button" disabled={!onSources} className="champion-association" aria-label={t("{0} {1}, {2}, {3} parties, {4}", [prefix, championDisplayName(row.champion), t(roleLabel(row.role)), row.games, t(resultLabel(row))])} onClick={() => onSources(row, `${prefix} ${championDisplayName(row.champion)}`, `${roleLabel(row.role)} · ${row.games} parties`)}>
        <span><strong>{championDisplayName(row.champion)}</strong><span>{t(roleLabel(row.role))} · {row.games}{t(row.games > 1 ? " parties" : " partie")}</span></span>
        <span>{shortRecord(row)}<ArrowRight aria-hidden="true" /></span>
      </button>
    </li>)}</ul> : <p className="draft-context">{t(empty)}</p>}
    {rows.length > 3 && <button type="button" className="draft-source-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? t("Réduire la liste") : t("Afficher les {0} associations", [rows.length])}</button>}
  </section>;
}

function ChampionDossier({ pick, onSources, headingRef, headingId }) {
  useLanguage();
  const name = championDisplayName(pick.champion);
  const losses = { ...resultSummary(pick.lossMatches), wr: 0, matches: pick.lossMatches };
  return <section className="champion-dossier" aria-labelledby={headingId}>
    <div className="champion-dossier-heading">
      <span className="draft-key-portrait" aria-hidden="true"><ChampionPortrait champion={pick.champion} alt="" /></span>
      <div><p className="draft-context">{t(roleLabel(pick.role))} · {pick.games}{t(pick.games > 1 ? " parties" : " partie")}</p><h4 id={headingId} tabIndex={-1} ref={headingRef}>{name}</h4></div>
    </div>
    <dl className="champion-metrics">
      <div><dt>{t("Victoires")}</dt><dd>{t(winrateLabel(pick.wr))}</dd><span>{t(resultLabel(pick))}</span>{pick.unknown > 0 && <span>{t("Sur ")}{pick.known}{t(pick.known > 1 ? " résultats" : " résultat")}{t(pick.known > 1 ? " connus" : " connu")}</span>}</div>
      <div><dt>KDA</dt><dd>{pick.kda ?? "—"}</dd><span>{pick.kdaGames}{t(pick.kdaGames > 1 ? " parties" : " partie")}{t(" avec statistiques")}</span></div>
    </dl>
    {pick.known < 5 && <p className="draft-context champion-sample-note">{pick.known ? t("Encore peu de parties pour tirer une conclusion.") : t("Les résultats de ces parties ne sont pas encore renseignés.")}</p>}
    {onSources && <div className="champion-actions"><Button type="button" icon={ArrowRight} onClick={() => onSources(pick, `${name} · ${roleLabel(pick.role)}`, "Parties du champion dans le contexte sélectionné.")}>{t("Voir les ")}{pick.games}{t(" parties")}</Button>{pick.lossMatches.length > 0 && <button type="button" className="draft-source-link" onClick={() => onSources(losses, `${name} · ${roleLabel(pick.role)}`, "Défaites à examiner dans le contexte sélectionné.")}>{t("Revoir les ")}{pick.lossMatches.length}{t(" défaites ")}<ArrowRight aria-hidden="true" /></button>}</div>}
    <details className="trends-secondary-disclosure champion-deeper"><summary>{t("Comparer et approfondir")}</summary>
    <div className="champion-comparison"><h5>{t("Avec les autres champions à ce rôle")}</h5>
      {pick.otherPicks.games ? <><p><strong>{t(winrateLabel(pick.otherPicks.wr))}</strong>{t(" de victoires · ")}{t(resultLabel(pick.otherPicks))} · {pick.otherPicks.games}{t(" parties")}</p><p className="draft-context">{t("Même sélection, parties de ")}{name}{t(" exclues. Adversaires et joueurs peuvent différer ; cet écart ne mesure pas l’effet du champion.")}</p>{onSources && <button type="button" className="draft-source-link" onClick={() => onSources(pick.otherPicks, `Autres champions · ${roleLabel(pick.role)}`, `Parties sans ${name} à ce rôle.`)}>{t("Comparer les parties sources ")}<ArrowRight aria-hidden="true" /></button>}</> : <p className="draft-context">{t("Aucune autre partie avec un champion différent à ce rôle dans la sélection.")}</p>}
    </div>
    <div className="champion-context-lists">
      <AssociationList key={`${pick.id}-opponents`} title={t("Adversaires au même rôle")} rows={pick.matchups} empty="Aucun adversaire au même rôle identifiable dans ces imports." onSources={onSources} prefix={`${name} face à`} />
      <AssociationList key={`${pick.id}-partners`} title={t("Associations alliées")} rows={pick.partners} empty="Aucun autre champion allié renseigné." onSources={onSources} prefix={`${name} avec`} />
    </div>
    <p className="draft-context champion-evidence-note">{t("V = victoires, D = défaites, ? = résultat inconnu. Les associations décrivent des parties jouées ensemble, pas une synergie démontrée. KDA = (éliminations + assistances) / morts, diviseur minimum 1.")}</p>
    </details>
  </section>;
}

export function ChampionAnalysis({ active, analysis: providedAnalysis, onSources }) {
  useLanguage();
  const analysis = useMemo(() => providedAnalysis || buildChampionAnalysis(active), [active, providedAnalysis]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const headingRef = useRef(null);
  const headingId = useId();
  const searchTerms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const filtered = analysis.picks.filter((pick) => (!role || pick.role === role) && searchTerms.every((term) => normalize(`${championDisplayName(pick.champion)} ${roleLabel(pick.role)}`).includes(term)))
    .sort((a, b) => b.games - a.games || b.known - a.known || a.id.localeCompare(b.id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = visible.find((pick) => pick.id === selectedId) || visible[0];
  const changeFilter = (setter) => (value) => { setter(value); setPage(0); };
  const reset = () => { setQuery(""); setRole(""); setPage(0); };
  const roles = [...new Set([...analysis.roleCoverage.map((entry) => entry.role), ...analysis.picks.map((pick) => pick.role), role].filter(Boolean))];
  return <section className="champion-analysis" aria-label={t("Explorer les champions")}>
    <div className="draft-section-heading"><h4>{t("Champions joués")}</h4><p className="draft-context">{t("Les plus joués en premier. Choisis-en un pour voir ses parties.")}</p></div>
    <div className="champion-filters">
      <TextInput label={t("Rechercher un champion")} type="search" icon={Search} placeholder={t("Champion ou rôle…")} value={query} onChange={changeFilter(setQuery)} />
      <SelectInput label={t("Rôle")} value={role} onChange={changeFilter(setRole)}><option value="">{t("Tous les rôles")}</option>{roles.map((value) => <option key={value} value={value}>{t(roleLabel(value))}</option>)}</SelectInput>
    </div>
    <div className="champion-results-heading"><p role="status" className="draft-context">{filtered.length}{t(filtered.length > 1 ? " champions" : " champion")}{t(filtered.length > 1 ? " / rôles" : " / rôle")}{filtered.length > PAGE_SIZE ? ` · ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)}` : ""}</p>{(query || role) && <Button variant="ghost" type="button" onClick={reset}>{t("Réinitialiser")}</Button>}</div>
    {selected ? <div className="champion-workbench">
      <div className="champion-mobile-picker"><SelectInput label={t("Champion à examiner")} value={selected.id} onChange={(id) => { setSelectedId(id); setPage(Math.floor(filtered.findIndex((pick) => pick.id === id) / PAGE_SIZE)); }}>{filtered.map((pick) => <option key={pick.id} value={pick.id}>{championDisplayName(pick.champion)} · {t(roleLabel(pick.role))} · {pick.games}{t(" parties")}</option>)}</SelectInput></div>
      <div className="champion-picker"><ul>{visible.map((pick) => <li key={pick.id}><button type="button" className="champion-pick" aria-pressed={selected.id === pick.id} aria-controls={headingId} onClick={() => { setSelectedId(pick.id); requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: false })); }}>
        <span className="draft-champion-portrait" aria-hidden="true"><ChampionPortrait champion={pick.champion} alt="" /></span>
        <span><strong>{championDisplayName(pick.champion)}</strong><span>{t(roleLabel(pick.role))} · {pick.games}{t(" parties · ")}{shortRecord(pick)}</span></span>
        <span className="champion-pick-wr">{t(winrateLabel(pick.wr))}</span>
      </button></li>)}</ul>
        {filtered.length > PAGE_SIZE && <nav className="champion-pagination" aria-label={t("Pagination des champions")}><Button type="button" variant="ghost" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>{t("Précédents")}</Button><span>{currentPage + 1} / {Math.ceil(filtered.length / PAGE_SIZE)}</span><Button type="button" variant="ghost" disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(currentPage + 1)}>{t("Suivants")}</Button></nav>}
      </div>
      <ChampionDossier key={selected.id} pick={selected} onSources={onSources} headingRef={headingRef} headingId={headingId} />
    </div> : <p className="draft-empty">{t("Aucun champion ne correspond à ces filtres. Modifie la recherche ou le rôle.")}</p>}
  </section>;
}
