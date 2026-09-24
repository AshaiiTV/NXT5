import React, { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import { championDisplayName, ROSTER_ROLE_ORDER, tagLabel } from "../../pages/workspace/workspace-shared.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { DRAFT_SCORE_TAGS, DraftMiniChampion, DraftScoreBoard, DraftTrendTable } from "./DraftTrends.jsx";
import "./draft-trend-details.css";

const PICK_SECTIONS = new Set(["pick-repere", "confort", "a-revoir", "roles"]);
const SECTION_CRITERIA = {
  "pick-repere": "Le champion repère est le plus joué parmi les champions rejoués avec succès : au moins 2 parties et 50% de victoires. Si aucun champion ne remplit ces critères, le champion le plus joué sert de repère. À nombre de parties égal, le taux de victoire départage les champions.",
  confort: "Un champion rejoué avec succès associe un champion et un rôle, avec au moins 2 parties et 50% de victoires sur la période sélectionnée. Tous les champions qui remplissent ces critères sont affichés ici.",
  profil: "Le profil regroupe les marqueurs de style des champions joués. Un champion peut contribuer à plusieurs marqueurs, y compris dans une même famille. Le total compte les marqueurs et la moyenne les rapporte au nombre de drafts.",
  compositions: "Chaque draft est classée selon le marqueur de style le plus présent parmi ses champions. Une identité décrit les possibilités de la composition ; elle ne mesure pas la manière dont la partie a été jouée.",
  duos: "Un duo associe deux champions joués ensemble dans une même partie à une paire de rôles donnée. Trois paires sont suivies : Jungle + Mid, ADC + Support et Top + Jungle. Les autres associations de rôles ne sont pas comptabilisées.",
  "a-revoir": "Les champions à revoir ont été joués au moins 2 fois avec moins de 50% de victoires sur la période. Les signaux de style sont des pistes de débrief : ouvre les parties sources pour examiner le contexte et les décisions de l’équipe.",
  roles: "Chaque champion est compté séparément au rôle auquel il a été joué. Tous les champions sont disponibles ici, y compris ceux joués une seule fois. La recherche et le filtre de rôle permettent de comparer leur utilisation.",
};

const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
const matchesSearch = (value, query) => normalizeSearch(query).trim().split(/\s+/).filter(Boolean).every((term) => normalizeSearch(value).includes(term));
const frequency = (games, total) => total ? `${Math.round((games / total) * 100)}%` : "—";

function DetailFilters({ query, setQuery, searchLabel, filter, setFilter, filterLabel, options, count, total, noun = "résultats" }) {
  const hasFilters = Boolean(query || filter);
  return <div className="draft-detail-controls">
    <div className="draft-detail-filter-fields">
      <TextInput label={searchLabel} type="search" icon={Search} value={query} onChange={setQuery} placeholder="Nom, rôle ou style…" />
      {options && <SelectInput label={filterLabel} value={filter} onChange={setFilter}><option value="">{filterLabel === "Rôle" ? "Tous les rôles" : "Toutes les paires"}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectInput>}
    </div>
    <div className="draft-detail-results">
      <p className="draft-context" role="status">Affichage : {count} / {total} {noun}</p>
      {hasFilters && <Button type="button" variant="ghost" onClick={() => { setQuery(""); setFilter?.(""); }}>Réinitialiser la recherche</Button>}
    </div>
  </div>;
}

function DraftTrendDetails({ sectionId, model, onOpenSources, sourceGamesForMatches }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [pair, setPair] = useState("");
  const active = model?.ally;
  if (!active?.games) return <Surface className="draft-trends-surface"><div className="draft-trends-content"><p className="draft-empty">Aucune donnée de draft sur cette sélection. Élargis la période ou importe des parties avec leurs participants.</p></div></Surface>;

  const openSources = (entry, title, subtitle) => onOpenSources?.({
    title,
    subtitle,
    metrics: [
      { label: "Parties", value: String(entry.games) },
      { label: "Bilan", value: `${entry.wins} V · ${entry.games - entry.wins} D` },
      { label: "Victoires", value: `${entry.wr}%` },
      { label: "Fréquence", value: frequency(entry.games, active.games) },
    ],
    games: sourceGamesForMatches?.(entry.matches || []) || [],
  });
  const sourceAction = (pick) => onOpenSources ? () => openSources(pick, `Champion de l’équipe : ${championDisplayName(pick.champion)}`, `${roleLabel(pick.role)} · ${pick.games} parties · ${pick.wr}% de victoires`) : undefined;
  const tableSources = onOpenSources ? (row) => openSources(row, row.label || (row.tag ? `Composition équipe : ${tagLabel(row.tag)}` : row.champions), `${row.pair ? `${row.pair} · ` : ""}${row.games} parties · ${row.wr}% de victoires`) : undefined;
  const picks = active.picks || [];
  const eligiblePicks = sectionId === "confort" ? picks.filter((pick) => pick.games >= 2 && pick.wr >= 50)
    : sectionId === "a-revoir" ? picks.filter((pick) => pick.games >= 2 && pick.wr < 50).slice().sort((a, b) => a.wr - b.wr || b.games - a.games)
      : picks;
  const visiblePicks = eligiblePicks.filter((pick) => (!role || pick.role === role) && matchesSearch(`${championDisplayName(pick.champion)} ${roleLabel(pick.role)} ${(pick.tags || []).map(tagLabel).join(" ")}`, query));
  const availableRoles = [...ROSTER_ROLE_ORDER, ...new Set([...eligiblePicks.map((pick) => pick.role), role].filter((pickRole) => pickRole && !ROSTER_ROLE_ORDER.includes(pickRole)))];
  const mainPick = active.comfort?.[0] || picks[0];
  const allDuos = active.allDuos || active.duos || [];
  const visibleDuos = allDuos.filter((duo) => (!pair || duo.pair === pair) && matchesSearch(`${duo.champions} ${duo.pair}`, query));
  const visibleArchetypes = (active.archetypes || []).filter((entry) => matchesSearch(tagLabel(entry.tag), query));
  const profileRows = DRAFT_SCORE_TAGS.map(([id, tags]) => {
    const drafts = (active.matchDrafts || []).filter((entry) => entry.identity.scores.some((score) => score.id === id && score.count > 0));
    const wins = drafts.filter((entry) => entry.win).length;
    return { label: tagLabel(id), tag: id, games: drafts.length, wins, wr: drafts.length ? Math.round((wins / drafts.length) * 100) : 0, matches: drafts.map((entry) => entry.match), tags };
  }).filter((row) => row.games > 0).sort((a, b) => b.games - a.games || b.wr - a.wr);
  const pickList = (list) => <div className="draft-champion-list">{list.map((pick) => <DraftMiniChampion key={`${pick.role}-${pick.champion}`} item={pick} onSources={sourceAction(pick)} detailed totalGames={active.games} />)}</div>;

  return <Surface className="draft-trends-surface draft-detail-surface">
    <div className="draft-trends-content draft-detail-content">
      <div className="draft-detail-intro">
        <p className="draft-description">{SECTION_CRITERIA[sectionId]}</p>
        <p className="draft-footnote">Fréquence = nombre de parties {sectionId === "profil" ? "avec au moins un marqueur de cette famille" : "avec ce champion, cette composition ou ce duo"} / {active.games} drafts disponibles. Le taux de victoire (WR) porte uniquement sur les parties de la ligne. V = victoires, D = défaites. Ces résultats décrivent cet échantillon, sans établir de causalité.</p>
      </div>

      {sectionId === "pick-repere" && mainPick && <section className="draft-detail-section">
        <h3>Le repère de cette période</h3>
        {pickList([mainPick])}
        <p className="draft-footnote">KDA = (kills + assists) / morts, calculé sur l’ensemble des parties du champion ; le diviseur vaut 1 si aucune mort n’est enregistrée.</p>
      </section>}

      {sectionId === "a-revoir" && <section className="draft-detail-section">
        <h3>Signaux à vérifier</h3>
        {active.identity?.gaps?.length ? <ul className="draft-warning-list">{active.identity.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p className="draft-description">Aucun signal de style particulier sur cette sélection.</p>}
        <p className="draft-footnote">Les signaux d’initiation, de première ligne résistante (frontline) et de contrôle signalent l’absence de leurs marqueurs dans les champions du bloc. Les signaux de progression en fin de partie ou de rythme de jeu apparaissent à partir de trois marqueurs correspondants dans le bloc.</p>
        {onOpenSources && <button type="button" className="draft-source-link" onClick={() => openSources({ games: active.games, wins: active.wins, wr: active.wr, matches: active.matchDrafts.map((entry) => entry.match) }, "Drafts à examiner", "Ensemble des drafts de la période pour remettre les signaux en contexte.")}>Examiner les parties du bloc <ArrowRight aria-hidden="true" /></button>}
      </section>}

      {PICK_SECTIONS.has(sectionId) && <section className="draft-detail-section">
        <h3>{sectionId === "confort" ? "Tous les champions rejoués avec succès" : sectionId === "a-revoir" ? "Tous les champions à revoir" : sectionId === "roles" ? "Tous les champions par rôle" : "Tous les champions de la période"}</h3>
        <p className="draft-description">{sectionId === "a-revoir" ? "Tri par taux de victoire croissant, puis par nombre de parties." : "Tri par nombre de parties, puis par taux de victoire."} Un même champion joué à plusieurs rôles apparaît sur plusieurs lignes.</p>
        <DetailFilters query={query} setQuery={setQuery} searchLabel="Rechercher un champion" filter={role} setFilter={setRole} filterLabel="Rôle" options={availableRoles.map((value) => ({ value, label: roleLabel(value) }))} count={visiblePicks.length} total={eligiblePicks.length} noun="champions" />
        {visiblePicks.length ? sectionId === "roles" ? availableRoles.map((pickRole) => {
          const rolePicks = visiblePicks.filter((pick) => pick.role === pickRole);
          if (!rolePicks.length) return null;
          return <section className="draft-detail-role" key={pickRole}><h4 className="draft-detail-role-heading"><span aria-hidden="true"><RoleIcon role={pickRole} className="draft-role-icon" lightweight /></span><span>{roleLabel(pickRole)}</span><span className="draft-context">{rolePicks.length} champion{rolePicks.length > 1 ? "s" : ""}</span></h4>{pickList(rolePicks)}</section>;
        }) : pickList(visiblePicks) : <p className="draft-empty">{eligiblePicks.length ? "Aucun champion ne correspond à cette recherche. Modifie le rôle ou le nom recherché." : "Aucun champion ne remplit ces critères sur cette sélection. Élargis la période pour retrouver davantage de parties."}</p>}
        {onOpenSources && visiblePicks.length > 0 && <p className="draft-footnote">Sélectionne un champion pour consulter ses parties sources.</p>}
      </section>}

      {sectionId === "duos" && <section className="draft-detail-section">
        <h3>Tous les duos de la période</h3>
        <p className="draft-description">Tri par nombre de parties, puis par taux de victoire. Une partie peut contribuer à trois duos. Un duo n’est compté que si les deux rôles sont renseignés.</p>
        <DetailFilters query={query} setQuery={setQuery} searchLabel="Rechercher un duo" filter={pair} setFilter={setPair} filterLabel="Paire de rôles" options={[["JGL", "MID"], ["ADC", "SUP"], ["TOP", "JGL"]].map(([left, right]) => { const label = `${roleLabel(left)} + ${roleLabel(right)}`; return { value: label, label }; })} count={visibleDuos.length} total={allDuos.length} noun="duos" />
        <DraftTrendTable variant="duos" rows={visibleDuos} showHeading={false} description={false} limit={null} totalGames={active.games} onSources={tableSources} empty={allDuos.length ? "Aucun duo ne correspond à cette recherche. Modifie la paire de rôles ou les champions recherchés." : "Aucun duo disponible : vérifie les champions et les rôles renseignés dans les parties importées."} />
        <p className="draft-footnote">Les fréquences utilisent les {active.games} drafts du bloc, y compris celles dont les rôles sont incomplets. Les pourcentages des différents duos ne s’additionnent pas nécessairement à 100%.</p>
      </section>}

      {sectionId === "compositions" && <section className="draft-detail-section">
        <h3>Toutes les identités de composition</h3>
        <p className="draft-description">Tri par nombre de parties, puis par taux de victoire. « Standard » indique qu’aucun marqueur plus spécifique n’a été identifié.</p>
        <DetailFilters query={query} setQuery={setQuery} searchLabel="Rechercher une composition" count={visibleArchetypes.length} total={(active.archetypes || []).length} noun="compositions" />
        <DraftTrendTable rows={visibleArchetypes} showHeading={false} description={false} limit={null} totalGames={active.games} onSources={tableSources} empty="Aucune composition ne correspond à cette recherche." />
        <p className="draft-footnote">Deux compositions avec des champions différents peuvent partager la même identité. Ouvre les sources pour consulter les champions de chaque partie.</p>
      </section>}

      {sectionId === "profil" && <>
        <section className="draft-detail-section"><h3>Répartition des marqueurs</h3><DraftScoreBoard identity={active.identity} games={active.games} showHeading={false} /></section>
        <section className="draft-detail-section"><h3>Présence et résultats par draft</h3><p className="draft-description">Chaque draft compte une seule fois par famille de marqueurs présente, quel que soit le nombre de champions qui y contribuent. Une draft peut figurer dans plusieurs familles.</p><DraftTrendTable rows={profileRows} showHeading={false} description={false} limit={null} totalGames={active.games} onSources={tableSources} empty="Aucun marqueur de style identifié dans les drafts disponibles." /></section>
        <section className="draft-detail-section"><h3>Comment les familles sont définies</h3><dl className="draft-detail-definitions">{DRAFT_SCORE_TAGS.map(([id, tags]) => <div key={id}><dt>{tagLabel(id)}</dt><dd>{tags.map(tagLabel).join(" · ")}</dd></div>)}</dl><p className="draft-footnote">Ces familles utilisent les marqueurs de champions connus par NXT5. Les champions sans marqueurs spécifiques restent classés « Standard » ; leurs possibilités ne sont pas déduites du résultat de la partie.</p></section>
      </>}
    </div>
  </Surface>;
}

export { DraftTrendDetails };
