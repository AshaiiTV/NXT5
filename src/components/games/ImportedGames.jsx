import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Search, X } from "lucide-react";
import { Button, SelectInput, Surface } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName, ROSTER_ROLE_ORDER } from "../../pages/workspace/workspace-shared.jsx";
import { matchCategoryIds, matchDisplayName } from "../../utils/matches.js";
import { trendMatchTimestamp } from "../../utils/trends.js";
import { filterImportedGames, importedGameDurationSeconds, importedGameImportTimestamp, importedGameSide } from "../../utils/imported-games.js";
import "./imported-games.css";

const pluralCount = (count) => count !== 1 && (count !== 0 || getLocale() !== "fr-FR");

const initialFilters = { query: "", result: "", review: "", side: "", category: "", sort: "newest", page: 1, pageSize: 10 };

function gameDate(match, history) {
  const timestamp = history ? importedGameImportTimestamp(match) : trendMatchTimestamp(match);
  return timestamp === null ? null : new Date(timestamp);
}

function gameDuration(match) {
  const seconds = importedGameDurationSeconds(match);
  if (seconds === null) return t("Durée inconnue");
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function GameComposition({ participants, teamKey, side, id }) {
  useLanguage();
  const roleIndex = (row) => {
    const index = ROSTER_ROLE_ORDER.indexOf(row.role);
    return index < 0 ? ROSTER_ROLE_ORDER.length : index;
  };
  const rows = participants.filter((row) => row.team_key === teamKey).sort((a, b) => roleIndex(a) - roleIndex(b)).slice(0, 5);
  return <span id={id} className={`ig-composition ig-composition-${teamKey.toLowerCase()}`}>
    <span className="ig-composition-label">{teamKey === "ALLY" ? t("Alliés") : t("Ennemis")}</span>
    <span className="ig-champions">{rows.length ? rows.map((row, index) => <ChampionPortrait key={row.id || index} row={row} champion={row.champion} alt={championDisplayName(row.champion)} className="ig-champion" />) : <span className="ig-missing">{t("Composition indisponible")}</span>}</span>
    <span className={`ig-side ${side ? `ig-side-${side}` : ""}`}>{side === "blue" ? t("Côté bleu") : side === "red" ? t("Côté rouge") : t("Côté inconnu")}</span>
  </span>;
}

export function ImportedGames({ matches = [], categories = [], selectedMatchId, selectedMatch, selectedReport, onSelectMatch, onCreateReview, onOpenReview, onViewStats, onResetScope, scopeName = "", history = false, dateTimeZone, headerActions, categoryManager, selectionActions, selectionDetails, selectionLocked = false, showSelection = true, showCategoryFilter = history, allowImportSort = history, title, description, emptyAction }) {
  const language = useLanguage();
  const locale = getLocale(language);
  const { dateFormat, timeFormat } = useMemo(() => ({
    dateFormat: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: dateTimeZone }),
    timeFormat: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: dateTimeZone }),
  }), [dateTimeZone, locale]);
  const [filters, setFilters] = useState(() => ({ ...initialFilters, sort: history ? "import-newest" : "newest" }));
  const titleId = useId();
  const searchId = useId();
  const searchRef = useRef(null);
  const resultsRef = useRef(null);
  const deferredQuery = useDeferredValue(filters.query);
  const results = useMemo(() => filterImportedGames(matches, { ...filters, query: deferredQuery }, categories), [matches, categories, deferredQuery, filters.result, filters.review, filters.side, filters.category, filters.sort, locale]);
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
  const revealSelection = () => {
    const ordered = filterImportedGames(matches, { sort: filters.sort }, categories);
    const index = ordered.findIndex((match) => String(match.id) === String(selectedMatchId));
    setFilters((current) => ({ ...initialFilters, sort: current.sort, pageSize: current.pageSize, page: Math.floor(Math.max(0, index) / current.pageSize) + 1 }));
  };
  const changePage = (nextPage) => {
    setFilters((current) => ({ ...current, page: nextPage }));
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: "start" });
  };

  return <Surface className="ig-surface">
    <section className={`imported-games${history ? " import-history" : ""}`} aria-labelledby={titleId}>
      <header className="ig-heading">
        <div className="ig-heading-copy">
          <div className="ig-heading-title">
            <h3 id={titleId}>{title || (history ? t("Historique des imports") : t("Parties importées"))}</h3>
            <p className="ig-total"><strong>{matches.length}</strong>{t(pluralCount(matches.length) ? " parties" : " partie")}</p>
          </div>
          {scopeName && <p className="ig-scope-name">{scopeName}</p>}
          <p className="ig-description">{description || (history ? t("Retrouve tes imports, classe tes parties et vérifie les joueurs associés.") : t("Retrouve une partie, consulte son bilan et prépare son débrief."))}</p>
        </div>
        {headerActions}
      </header>
      {categoryManager}

      <div className={`ig-controls${showCategoryFilter ? " ig-controls-with-category" : ""}`}>
      <div className="ig-search-row">
        <div className="ig-search">
          <label htmlFor={searchId} className="ig-label">{t("Rechercher une partie")}</label>
          <span className="ig-search-field">
            <Search aria-hidden="true" />
            <input id={searchId} ref={searchRef} type="search" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") clearSearch(); }} placeholder={t("Adversaire, identifiant, joueur, champion…")} className="nxt5-input-shell nxt5-control" />
            {filters.query && <button type="button" onClick={clearSearch} aria-label={t("Effacer la recherche")}><X aria-hidden="true" /></button>}
          </span>
        </div>
        <div className="ig-sort"><SelectInput label={t("Trier par")} value={filters.sort} onChange={(value) => setFilter("sort", value)}>
          {allowImportSort && <><option value="import-newest">{t("Derniers imports")}</option><option value="import-oldest">{t("Premiers imports")}</option></>}
          <option value="newest">{t("Plus récentes")}</option><option value="oldest">{t("Plus anciennes")}</option><option value="longest">{t("Plus longues")}</option><option value="shortest">{t("Plus courtes")}</option>
        </SelectInput></div>
      </div>
      <div className={`ig-filters${showCategoryFilter ? " ig-filters-history" : ""}`}>
        {showCategoryFilter && <SelectInput label={t("Catégorie")} value={filters.category} onChange={(value) => setFilter("category", value)}>
          <option value="">{t("Toutes")}</option><option value="__uncategorized__">{t("Non classées")}</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          {filters.category && filters.category !== "__uncategorized__" && !categories.some((category) => String(category.id) === filters.category) && <option value={filters.category}>{t("Catégorie supprimée")}</option>}
        </SelectInput>}
        <SelectInput label={t("Résultat")} value={filters.result} onChange={(value) => setFilter("result", value)}>
          <option value="">{t("Tous")}</option><option value="Victoire">{t("Victoires")}</option><option value="Défaite">{t("Défaites")}</option>
        </SelectInput>
        <SelectInput label={t("Débrief")} value={filters.review} onChange={(value) => setFilter("review", value)}>
          <option value="">{t("Tous")}</option><option value="todo">{t("À faire")}</option><option value="done">{t("Terminés")}</option>
        </SelectInput>
        <SelectInput label={t("Côté")} value={filters.side} onChange={(value) => setFilter("side", value)}>
          <option value="">{t("Tous les côtés")}</option><option value="blue">{t("Côté bleu")}</option><option value="red">{t("Côté rouge")}</option>
        </SelectInput>
      </div>
      </div>
      <div className="ig-results-summary">
        <p role="status" aria-live="polite">{deferredQuery !== filters.query ? t("Recherche en cours…") : hasFilters ? t(pluralCount(results.length) ? "{0} parties sur {1}" : "{0} partie sur {1}", [results.length, matches.length]) : t(pluralCount(results.length) ? "{0} parties disponibles" : "{0} partie disponible", [results.length])}</p>
        {hasFilters ? <button type="button" className="ig-text-action" onClick={resetFilters}><X aria-hidden="true" />{t(" Réinitialiser les filtres")}</button> : <p className="ig-search-hint">{t("Essaie « Jinx défaite »")}</p>}
      </div>

      {showSelection && selectedMatch && <div className="ig-selection">
        <div className="ig-selection-title">
          <span className="ig-label">{t("Sélection active")}</span>
          <h4>{matchDisplayName(selectedMatch, t("Partie"))}</h4>
          {!selectionVisible && <p>{t("Cette partie reste sélectionnée hors des résultats affichés.")}{selectionInScope && <> <button type="button" className="ig-text-action" onClick={revealSelection}>{t("Afficher dans la liste")}</button></>}</p>}
        </div>
        <div className="ig-selection-actions">
          {selectionActions ?? <>
          <Button type="button" variant="ghost" icon={ArrowRight} onClick={onViewStats}>{t("Voir le bilan")}</Button>
          <Button type="button" icon={FileText} onClick={selectedReport ? onOpenReview : onCreateReview}>{selectedReport ? t("Ouvrir le débrief") : t("Créer un débrief")}</Button>
          {selectedReport && <button type="button" className="ig-text-action" onClick={onCreateReview}>{t("Nouveau débrief")}</button>}
          </>}
          <button type="button" className="ig-icon-button" disabled={selectionLocked} onClick={() => onSelectMatch("")} aria-label={t("Désélectionner la partie")}><X aria-hidden="true" /></button>
        </div>
      </div>}
      {selectedMatch && selectionDetails}

      <div ref={resultsRef} className="ig-results" tabIndex={-1} aria-label={t("Liste des parties")} aria-busy={deferredQuery !== filters.query}>
        <div className="ig-column-labels" aria-hidden="true"><span>{t("Résultat")}</span><span>{t("Partie")}</span><span>{t("Composition alliée")}</span><span>{t("Composition ennemie")}</span><span>{history ? t("Import / durée") : t("Date / durée")}</span><span>{t("Débrief")}</span><span /></div>
        {visibleMatches.length ? <ul className="ig-list">{visibleMatches.map((match) => {
          const active = String(match.id) === String(selectedMatchId);
          const won = match.result === "Victoire";
          const lost = match.result === "Défaite";
          const done = match.review_status === "done";
          const side = importedGameSide(match);
          const date = gameDate(match, history);
          const matchCategories = matchCategoryIds(match).map((id) => categories.find((category) => String(category.id) === id)?.name).filter(Boolean);
          const compositionId = `${titleId}-${match.id}-composition`;
          return <li key={match.id}>
            <button type="button" className="ig-game" data-match-id={match.id} disabled={selectionLocked} aria-pressed={active} aria-describedby={`${compositionId}-ally ${compositionId}-enemy`} onClick={() => onSelectMatch(active ? "" : match.id)} aria-label={`${active ? t("Désélectionner") : t("Sélectionner")} ${matchDisplayName(match, t("Partie"))} · ${t(match.result || "Sans résultat")} · ${done ? t("Débrief terminé") : t("À revoir")} · ${match.game_id || t("Partie")}`}>
              <span className={`ig-result ${won ? "ig-win" : lost ? "ig-loss" : ""}`}><span aria-hidden="true">{won ? language === "en" ? "W" : "V" : lost ? language === "en" ? "L" : "D" : "—"}</span>{won ? t("Victoire") : lost ? t("Défaite") : t("Sans résultat")}</span>
              <span className="ig-game-identity"><strong>{matchDisplayName(match, t("Partie"))}</strong><span>{match.game_id || t("Identifiant indisponible")}</span><span className="ig-game-categories">{matchCategories.length ? matchCategories.join(" · ") : t("Non classée")}</span>{history && (match.created_by_name || match.created_by_account) && <span>{t("Par ")}{match.created_by_name || match.created_by_account}</span>}</span>
              <GameComposition participants={match.participants || []} teamKey="ALLY" side={side} id={`${compositionId}-ally`} />
              <GameComposition participants={match.participants || []} teamKey="ENEMY" side={side === "blue" ? "red" : side === "red" ? "blue" : ""} id={`${compositionId}-enemy`} />
              <span className="ig-date">{date ? <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time> : <span>{t("Date inconnue")}</span>}<span>{date && <>{timeFormat.format(date)} · </>}{gameDuration(match)}</span></span>
              <span className={`ig-review ${done ? "ig-review-done" : ""}`}>{done ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}{done ? t("Terminé") : t("À revoir")}</span>
              <span className="ig-open" aria-hidden="true">{active ? <Check /> : <ChevronRight />}</span>
            </button>
          </li>;
        })}</ul> : <div className="ig-empty">
          <Search aria-hidden="true" />
          <h4>{hasFilters ? t("Aucune partie ne correspond") : history ? t("Aucune partie importée") : t("Aucune partie dans cette sélection")}</h4>
          <p>{hasFilters ? t("Essaie moins de mots ou élargis tes filtres.") : emptyAction ? t("Importe une première partie pour retrouver ici son bilan.") : history ? t("Importe une première partie pour alimenter ton historique et tes statistiques.") : t("Choisis une autre catégorie pour retrouver tes parties.")}</p>
          {hasFilters ? <Button type="button" variant="ghost" onClick={resetFilters}>{t("Réinitialiser les filtres")}</Button> : emptyAction || onResetScope && <Button type="button" variant="ghost" onClick={onResetScope}>{t("Voir toutes les parties")}</Button>}
        </div>}
      </div>
      {results.length > 0 && <footer className="ig-pagination">
        <p>{t("{0}–{1} sur {2}", [start + 1, Math.min(start + filters.pageSize, results.length), results.length])}</p>
        <label className="ig-page-size">{t("Par page ")}<select value={filters.pageSize} onChange={(event) => setFilter("pageSize", Number(event.target.value))}>{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <nav aria-label={t("Pagination des parties")}><button type="button" className="ig-icon-button" aria-label={t("Page précédente")} disabled={page === 1} onClick={() => changePage(page - 1)}><ChevronLeft aria-hidden="true" /></button><span>{t("Page ")}{page} / {pageCount}</span><button type="button" className="ig-icon-button" aria-label={t("Page suivante")} disabled={page === pageCount} onClick={() => changePage(page + 1)}><ChevronRight aria-hidden="true" /></button></nav>
      </footer>}
    </section>
  </Surface>;
}
