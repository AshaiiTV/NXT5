import React, { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Search, X } from "lucide-react";
import { Button, SelectInput, Surface } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName, ROSTER_ROLE_ORDER } from "../../pages/workspace/workspace-shared.jsx";
import { matchCategoryIds, matchDisplayName } from "../../utils/matches.js";
import { trendMatchTimestamp } from "../../utils/trends.js";
import { filterImportedGames, importedGameDurationSeconds, importedGameImportTimestamp, importedGameSide } from "../../utils/imported-games.js";
import "./imported-games.css";

const initialFilters = { query: "", result: "", review: "", side: "", category: "", sort: "newest", page: 1, pageSize: 10 };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function gameDate(match, history) {
  const timestamp = history ? importedGameImportTimestamp(match) : trendMatchTimestamp(match);
  return timestamp === null ? null : new Date(timestamp);
}

function gameDuration(match) {
  const seconds = importedGameDurationSeconds(match);
  if (seconds === null) return "Durée inconnue";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function ImportedGames({ matches = [], categories = [], selectedMatchId, selectedMatch, selectedReport, onSelectMatch, onCreateReview, onOpenReview, onViewStats, onResetScope, scopeName = "", history = false, headerActions, categoryManager, selectionActions, selectionDetails, selectionLocked = false }) {
  const [filters, setFilters] = useState(() => ({ ...initialFilters, sort: history ? "import-newest" : "newest" }));
  const titleId = useId();
  const searchId = useId();
  const searchRef = useRef(null);
  const resultsRef = useRef(null);
  const deferredQuery = useDeferredValue(filters.query);
  const results = useMemo(() => filterImportedGames(matches, { ...filters, query: deferredQuery }, categories), [matches, categories, deferredQuery, filters.result, filters.review, filters.side, filters.category, filters.sort]);
  const pageCount = Math.max(1, Math.ceil(results.length / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * filters.pageSize;
  const visibleMatches = results.slice(start, start + filters.pageSize);
  const hasFilters = Boolean(filters.query.trim() || filters.result || filters.review || filters.side || filters.category);
  const selectionVisible = visibleMatches.some((match) => String(match.id) === String(selectedMatchId));
  const selectionInScope = matches.some((match) => String(match.id) === String(selectedMatchId));
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  const resetFilters = () => setFilters((current) => ({ ...initialFilters, sort: current.sort, pageSize: current.pageSize }));
  const clearSearch = () => { setFilter("query", ""); searchRef.current?.focus(); };
  const showSelection = () => {
    const ordered = filterImportedGames(matches, { sort: filters.sort }, categories);
    const index = ordered.findIndex((match) => String(match.id) === String(selectedMatchId));
    setFilters((current) => ({ ...initialFilters, sort: current.sort, pageSize: current.pageSize, page: Math.floor(Math.max(0, index) / current.pageSize) + 1 }));
  };
  const changePage = (nextPage) => {
    setFilters((current) => ({ ...current, page: nextPage }));
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: "start" });
  };

  return <Surface className="mt-5">
    <section className={`imported-games${history ? " import-history" : ""}`} aria-labelledby={titleId}>
      <header className="ig-heading">
        <div>
          <h3 id={titleId}>{history ? "Historique des imports" : "Games importées"}</h3>
          <p>{history ? "Retrouve tes imports, classe tes games et ajuste les assignations." : "Retrouve une game, consulte ses stats et prépare sa review."}</p>
        </div>
        <p className="ig-total"><strong>{matches.length}</strong> {scopeName || `game${matches.length > 1 ? "s" : ""}`}</p>
        {headerActions}
      </header>
      {categoryManager}

      <div className="ig-search-row">
        <div className="ig-search">
          <label htmlFor={searchId} className="ig-label">Rechercher une game</label>
          <span className="ig-search-field">
            <Search aria-hidden="true" />
            <input id={searchId} ref={searchRef} type="search" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") clearSearch(); }} placeholder="Adversaire, Game ID, joueur, champion…" className="nxt5-input-shell nxt5-control" />
            {filters.query && <button type="button" onClick={clearSearch} aria-label="Effacer la recherche"><X aria-hidden="true" /></button>}
          </span>
        </div>
        <div className="ig-sort"><SelectInput label="Trier par" value={filters.sort} onChange={(value) => setFilter("sort", value)}>
          {history && <><option value="import-newest">Derniers imports</option><option value="import-oldest">Premiers imports</option></>}
          <option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="longest">Plus longues</option><option value="shortest">Plus courtes</option>
        </SelectInput></div>
      </div>
      <div className={`ig-filters${history ? " ig-filters-history" : ""}`}>
        {history && <SelectInput label="Catégorie" value={filters.category} onChange={(value) => setFilter("category", value)}>
          <option value="">Toutes</option><option value="__uncategorized__">Non classées</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          {filters.category && filters.category !== "__uncategorized__" && !categories.some((category) => String(category.id) === filters.category) && <option value={filters.category}>Catégorie supprimée</option>}
        </SelectInput>}
        <SelectInput label="Résultat" value={filters.result} onChange={(value) => setFilter("result", value)}>
          <option value="">Tous</option><option value="Victoire">Victoires</option><option value="Défaite">Défaites</option>
        </SelectInput>
        <SelectInput label="Review" value={filters.review} onChange={(value) => setFilter("review", value)}>
          <option value="">Toutes</option><option value="todo">À revoir</option><option value="done">Terminées</option>
        </SelectInput>
        <SelectInput label="Côté" value={filters.side} onChange={(value) => setFilter("side", value)}>
          <option value="">Tous les côtés</option><option value="blue">Côté bleu</option><option value="red">Côté rouge</option>
        </SelectInput>
      </div>
      <div className="ig-results-summary">
        <p role="status" aria-live="polite">{deferredQuery !== filters.query ? "Recherche en cours…" : `${results.length} game${results.length > 1 ? "s" : ""} ${hasFilters ? `sur ${matches.length}` : "disponible" + (results.length > 1 ? "s" : "")}`}</p>
        {hasFilters ? <button type="button" className="ig-text-action" onClick={resetFilters}><X aria-hidden="true" /> Réinitialiser les filtres</button> : <p className="ig-search-hint">Essaie « Jinx défaite »</p>}
      </div>

      {selectedMatch && <div className="ig-selection">
        <div className="ig-selection-title">
          <span className="ig-label">Sélection active</span>
          <h4>{matchDisplayName(selectedMatch)}</h4>
          {!selectionVisible && <p>Cette game reste sélectionnée hors des résultats affichés.{selectionInScope && <> <button type="button" className="ig-text-action" onClick={showSelection}>Afficher dans la liste</button></>}</p>}
        </div>
        <div className="ig-selection-actions">
          {selectionActions ?? <>
          <Button type="button" variant="ghost" icon={ArrowRight} onClick={onViewStats}>Voir les stats</Button>
          <Button type="button" icon={FileText} onClick={selectedReport ? onOpenReview : onCreateReview}>{selectedReport ? "Ouvrir la review" : "Créer une review"}</Button>
          {selectedReport && <button type="button" className="ig-text-action" onClick={onCreateReview}>Nouvelle review</button>}
          </>}
          <button type="button" className="ig-icon-button" disabled={selectionLocked} onClick={() => onSelectMatch("")} aria-label="Désélectionner la game"><X aria-hidden="true" /></button>
        </div>
      </div>}
      {selectedMatch && selectionDetails}

      <div ref={resultsRef} className="ig-results" tabIndex={-1} aria-label="Liste des games" aria-busy={deferredQuery !== filters.query}>
        <div className="ig-column-labels" aria-hidden="true"><span>Résultat</span><span>Game</span><span>Composition alliée</span><span>{history ? "Import / durée" : "Date / durée"}</span><span>Review</span><span /></div>
        {visibleMatches.length ? <ul className="ig-list">{visibleMatches.map((match) => {
          const active = String(match.id) === String(selectedMatchId);
          const won = match.result === "Victoire";
          const lost = match.result === "Défaite";
          const done = match.review_status === "done";
          const side = importedGameSide(match);
          const date = gameDate(match, history);
          const matchCategories = matchCategoryIds(match).map((id) => categories.find((category) => String(category.id) === id)?.name).filter(Boolean);
          const allies = (match.participants || []).filter((row) => row.team_key === "ALLY").sort((a, b) => ROSTER_ROLE_ORDER.indexOf(a.role) - ROSTER_ROLE_ORDER.indexOf(b.role)).slice(0, 5);
          return <li key={match.id}>
            <button type="button" className="ig-game" disabled={selectionLocked} aria-pressed={active} onClick={() => onSelectMatch(active ? "" : match.id)} aria-label={`${active ? "Désélectionner" : "Sélectionner"} ${matchDisplayName(match)} · ${match.result || "Sans résultat"} · ${done ? "Review terminée" : "À revoir"} · ${match.game_id || "Game"}`}>
              <span className={`ig-result ${won ? "ig-win" : lost ? "ig-loss" : ""}`}><span aria-hidden="true">{won ? "V" : lost ? "D" : "—"}</span>{won ? "Victoire" : lost ? "Défaite" : "Sans résultat"}</span>
              <span className="ig-game-identity"><strong>{matchDisplayName(match)}</strong><span>{match.game_id || "Identifiant indisponible"}</span><span className="ig-game-categories">{matchCategories.length ? matchCategories.join(" · ") : "Non classée"}</span>{history && (match.created_by_name || match.created_by_account) && <span>Par {match.created_by_name || match.created_by_account}</span>}</span>
              <span className="ig-composition"><span className="ig-champions">{allies.length ? allies.map((row, index) => <ChampionPortrait key={row.id || index} row={row} champion={row.champion} alt={championDisplayName(row.champion)} className="ig-champion" />) : <span className="ig-missing">Composition indisponible</span>}</span><span className={`ig-side ${side ? `ig-side-${side}` : ""}`}>{side === "blue" ? "Côté bleu" : side === "red" ? "Côté rouge" : "Côté inconnu"}</span></span>
              <span className="ig-date">{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : <span>Date inconnue</span>}<span>{date && <>{timeFormat.format(date)} · </>}{gameDuration(match)}</span></span>
              <span className={`ig-review ${done ? "ig-review-done" : ""}`}>{done ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}{done ? "Terminée" : "À revoir"}</span>
              <span className="ig-open" aria-hidden="true">{active ? <Check /> : <ChevronRight />}</span>
            </button>
          </li>;
        })}</ul> : <div className="ig-empty">
          <Search aria-hidden="true" />
          <h4>{hasFilters ? "Aucune game ne correspond" : history ? "Aucune game importée" : "Aucune game dans cette sélection"}</h4>
          <p>{hasFilters ? "Essaie moins de mots ou élargis tes filtres." : history ? "Importe une première game pour alimenter ton historique et tes statistiques." : "Choisis une autre catégorie pour retrouver tes games."}</p>
          {hasFilters ? <Button type="button" variant="ghost" onClick={resetFilters}>Réinitialiser les filtres</Button> : onResetScope && <Button type="button" variant="ghost" onClick={onResetScope}>Voir toutes les games</Button>}
        </div>}
      </div>
      {results.length > 0 && <footer className="ig-pagination">
        <p>{start + 1}–{Math.min(start + filters.pageSize, results.length)} sur {results.length}</p>
        <label className="ig-page-size">Par page <select value={filters.pageSize} onChange={(event) => setFilter("pageSize", Number(event.target.value))}>{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <nav aria-label="Pagination des games"><button type="button" className="ig-icon-button" aria-label="Page précédente" disabled={page === 1} onClick={() => changePage(page - 1)}><ChevronLeft aria-hidden="true" /></button><span>Page {page} / {pageCount}</span><button type="button" className="ig-icon-button" aria-label="Page suivante" disabled={page === pageCount} onClick={() => changePage(page + 1)}><ChevronRight aria-hidden="true" /></button></nav>
      </footer>}
    </section>
  </Surface>;
}
