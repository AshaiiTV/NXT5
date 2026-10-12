import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Ban, Check, ChevronRight, ExternalLink, FileText, Loader2, Plus, RefreshCw, Search, Shield, Swords } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { Badge, Button, EmptyState, PageHeader, SelectInput, SkeletonRows, Surface, TabNav, TextAreaInput, TextInput } from "../ui/Core.jsx";
import { buildOpponentObservations } from "../../utils/opponent-observations.js";
import { matchResult, resultSummary } from "../../utils/statistics.js";
import DraftBoard from "../draft/DraftBoard.jsx";
import "./opponents-workspace.css";
import "./opponents-directory.css";

function sourceHref(snapshot) {
  try {
    const url = new URL(snapshot.sourceUrl);
    return url.protocol === "https:" && url.hostname === "drafter.lol" && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export function SourceLink({ snapshot }) {
  const href = sourceHref(snapshot);
  return href ? <a className="opponents-source" href={href} target="_blank" rel="noopener noreferrer">{t("Ouvrir sur Drafter")}<ExternalLink size={16} aria-hidden="true" /></a> : null;
}

function ChampionList({ champions = [], bans = false, banStates = [] }) {
  return <ol className={bans ? "opponents-champions opponents-bans" : "opponents-champions"}>
    {Array.from({ length: 5 }, (_, index) => {
      const champion = champions[index];
      const skipped = bans && champion === null && banStates[index] === "skipped";
      return <li key={index} className={bans && index === 3 ? "opponents-ban-phase" : undefined}>
        {champion ? <span aria-hidden="true" className="opponents-portrait"><ChampionPortrait champion={champion} /></span> : <span className="opponents-portrait opponents-unknown" aria-hidden="true">{skipped ? "—" : "?"}</span>}
        <span>{champion ? championDisplayName(champion) : t(skipped ? "Ban non utilisé" : "Non renseigné")}</span>
        {bans && <small>{t("Ban {0}", [index + 1])}</small>}
      </li>;
    })}
  </ol>;
}

export function DraftSnapshot({ snapshot, allySide = "" }) {
  return <div className="opponents-draft-camps">
    {["blue", "red"].map((side) => <section className="opponents-camp" data-side={side} key={side}>
      <div className="opponents-camp-heading"><span>{t(side === "blue" ? "Côté bleu" : "Côté rouge")}</span>{allySide && <Badge tone={allySide === side ? "cyan" : "slate"}>{t(allySide === side ? "Notre équipe" : "Adversaire")}</Badge>}</div>
      <h4>{snapshot[`${side}Name`] || t("Équipe sans nom")}</h4>
      <h5>{t("Picks affichés")}</h5>
      <ChampionList champions={snapshot[`${side}Picks`]} />
      <h5>{t("Bans")}</h5>
      <ChampionList champions={snapshot[`${side}Bans`]} bans banStates={snapshot.banStates?.[side]} />
    </section>)}
  </div>;
}

export function SnapshotContext({ snapshot, importedAt }) {
  const date = new Date(importedAt || snapshot.importedAt);
  return <div className="opponents-snapshot-context">
    <p className="opponents-help">{snapshot.patch ? t("Patch {0}", [snapshot.patch]) : t("Patch non fourni")}{Number.isFinite(date.getTime()) && <> · <time dateTime={date.toISOString()}>{t("Importée le {0}", [new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }).format(date)])}</time></>}</p>
    {snapshot.warnings?.length > 0 && <ul className="opponents-warnings">{snapshot.warnings.map((warning, index) => <li key={index}>{t(warning)}</li>)}</ul>}
    <p className="opponents-help">{t("Les picks suivent l’affichage du drafter : ils ne confirment pas les rôles joués. Les bans manquants restent inconnus.")}</p>
  </div>;
}

const matchCount = (count) => t(count === 1 ? "{0} partie rattachée" : "{0} parties rattachées", [count]);
const draftCount = (count) => t(count === 1 ? "{0} draft liée" : "{0} drafts liées", [count]);
const searchKey = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
const dateValue = (value) => { const date = new Date(value || NaN); return Number.isFinite(date.getTime()) ? date : null; };
function ReferenceDate({ value }) {
  const date = dateValue(value);
  return date ? <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(date)}</time> : <span>{t("Date non renseignée")}</span>;
}
function ResultBadge({ match }) {
  const result = matchResult(match);
  return <span className="opponent-result" data-result={result === 1 ? "win" : result === 0 ? "loss" : "unknown"}>{t(result === 1 ? "Victoire" : result === 0 ? "Défaite" : "Résultat inconnu")}</span>;
}

function FrequencyList({ title, description, entries, coverage, total, icon: Icon }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="opponents-frequency">
    <div className="opponent-frequency-title">{Icon && <Icon size={20} aria-hidden="true" />}<h4>{title}</h4></div>
    {description && <p className="opponents-help">{description}</p>}
    <p className="opponents-help">{coverage === 1 ? t("1 partie exploitable sur {0}", [total]) : t("{0} parties exploitables sur {1}", [coverage, total])}</p>
    {entries.length ? <ol>{entries.slice(0, expanded ? entries.length : 5).map(({ champion, count, total: denominator }, index) => <li key={champion}>
      <span className="opponent-frequency-rank" aria-hidden="true">{index + 1}</span>
      <span className="opponents-frequency-champion"><span aria-hidden="true"><ChampionPortrait champion={champion} className="h-10 w-10 rounded-md object-cover" /></span><span>{championDisplayName(champion)}</span></span>
      <strong>{count} / {denominator}</strong>
    </li>)}</ol> : <p className="opponent-no-frequency">{t("Pas encore de données complètes pour ce classement.")}</p>}
    {entries.length > 5 && <Button type="button" variant="ghost" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{t(expanded ? "Réduire le classement" : "Voir les {0} champions", [entries.length])}</Button>}
  </section>;
}

function MatchHistory({ observations, preview = false, onShowAll }) {
  const [result, setResult] = useState("all");
  const [limit, setLimit] = useState(10);
  const filtered = observations.filter((match) => result === "all" || String(matchResult(match)) === result);
  const visible = preview ? observations.slice(0, 3) : filtered.slice(0, limit);
  return <section className="opponent-history">
    <div className="opponents-section-heading"><div><h3>{t(preview ? "Dernières parties référencées" : "Parties contre cet adversaire")}</h3><p className="opponents-help">{t("Les résultats ci-dessous sont ceux de notre équipe.")}</p></div>{preview && observations.length > 3 && <Button type="button" variant="ghost" onClick={onShowAll}>{t("Voir les {0} parties", [observations.length])}</Button>}</div>
    {!preview && <div className="opponent-history-filter"><SelectInput label={t("Résultat de notre équipe")} value={result} onChange={(value) => { setResult(value); setLimit(10); }}><option value="all">{t("Tous les résultats")}</option><option value="1">{t("Victoires")}</option><option value="0">{t("Défaites")}</option><option value="null">{t("Résultats inconnus")}</option></SelectInput><p role="status">{t(filtered.length === 1 ? "1 partie dans cette vue" : "{0} parties dans cette vue", [filtered.length])}</p></div>}
    <ul className="opponent-match-list">{visible.map((match) => <li key={match.id}>
      <div className="opponent-match-line"><ResultBadge match={match} /><div className="opponent-match-name"><h4>{match.label || match.gameId || t("Partie sans nom")}</h4><ReferenceDate value={match.date} /></div><a className="opponents-source" href={`/games?match=${encodeURIComponent(match.id)}`}>{t("Ouvrir la partie")}<ArrowRight size={16} aria-hidden="true" /></a></div>
      {!preview && <details className="opponent-match-composition"><summary>{t("Voir les champions adverses")}</summary><p className="opponents-pick-source">{t(match.pickSource === "match" ? "Champions joués" : match.pickSource === "draft" ? "Picks de la draft liée · champions joués non confirmés" : "Champions de la partie incomplets")}</p><ChampionList champions={match.picks} /></details>}
    </li>)}</ul>
    {!visible.length && <p className="opponent-empty-inline">{t("Aucune partie ne correspond à ce résultat.")}</p>}
    {!preview && filtered.length > limit && <Button type="button" variant="ghost" onClick={() => setLimit((value) => value + 10)}>{t("Afficher plus de parties")}</Button>}
  </section>;
}

function GroupHistory({ groups, teamId }) {
  if (!groups.length) return null;
  return <details className="opponent-groups"><summary>{t("Groupes contre cet adversaire")}<span>{groups.length}</span></summary><ul>{groups.map((group) => <li key={group.id}>
    <div><h4>{group.name}</h4><p className="opponents-help">{t(group.matchIds.length === 1 ? "{0} partie dans ce groupe" : "{0} parties dans ce groupe", [group.matchIds.length])}</p></div>
    <a className="opponents-source" href={`/games?view=groups&archive=${encodeURIComponent(group.id)}&team=${encodeURIComponent(teamId)}`}>{t("Ouvrir le groupe")}<ArrowRight size={16} aria-hidden="true" /></a>
  </li>)}</ul></details>;
}

function DraftHistory({ observations }) {
  const [selectedId, setSelectedId] = useState("");
  const [limit, setLimit] = useState(8);
  const titleRef = useRef(null);
  const reviewRef = useRef(null);
  const listRef = useRef(null);
  const pendingFocus = useRef(false);
  const selected = observations.find((match) => match.draft.id === selectedId);
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const target = selected ? titleRef.current : listRef.current;
    target?.focus({ preventScroll: true });
    (selected ? reviewRef.current : target)?.scrollIntoView({ block: "start", behavior: "instant" });
    pendingFocus.current = false;
  }, [selected]);
  if (selected) return <section ref={reviewRef} className="opponent-draft-review">
    <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => { pendingFocus.current = true; setSelectedId(""); }}>{t("Retour aux drafts")}</Button>
    <h3 ref={titleRef} tabIndex={-1}>{selected.label || selected.gameId || t("Partie sans nom")}</h3>
    <div className="opponent-draft-links"><SourceLink snapshot={selected.draft.snapshot} /><a className="opponents-source" href={`/games?match=${encodeURIComponent(selected.id)}`}>{t("Ouvrir la partie")}<ArrowRight size={16} aria-hidden="true" /></a></div>
    <DraftBoard snapshot={selected.draft.snapshot} allySide={selected.draft.allySide} />
  </section>;
  return <section className="opponent-draft-library"><h3 ref={listRef} tabIndex={-1}>{t("Drafts des parties rattachées")}</h3><p className="opponents-help">{t("Ouvre le tableau pour revoir les picks, les bans et leurs rotations.")}</p>
    {observations.length ? <ul>{observations.slice(0, limit).map((match) => <li key={match.id}><div><span className="opponent-draft-icon" aria-hidden="true"><Swords size={22} /></span><div><h4>{match.label || match.gameId || t("Partie sans nom")}</h4><p><ReferenceDate value={match.date} /><span>{t("Game {0}", [match.draft.gameNumber])}</span></p></div></div><Button type="button" variant="ghost" icon={ArrowRight} onClick={() => { pendingFocus.current = true; setSelectedId(match.draft.id); }} aria-label={t("Revoir la draft de {0}", [match.label || match.gameId || t("Partie sans nom")])}>{t("Revoir la draft")}</Button></li>)}</ul>
      : <EmptyState icon={Swords} title={t("Aucune draft liée pour le moment")} text={t("Ajoute un lien Drafter depuis une partie rattachée à cet adversaire pour le retrouver ici.")} />}
    {observations.length > limit && <Button type="button" variant="ghost" onClick={() => setLimit((value) => value + 8)}>{t("Afficher plus de drafts")}</Button>}
  </section>;
}

function OpponentDossier({ opponent, model, groups, teamId, headingRef, panel, onPanel }) {
  const id = useId();
  const panelRef = useRef(null);
  const pendingPanelFocus = useRef(false);
  const openGames = () => { pendingPanelFocus.current = true; onPanel("games"); };
  useLayoutEffect(() => {
    if (!pendingPanelFocus.current) return;
    panelRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    pendingPanelFocus.current = false;
  }, [panel]);
  const results = resultSummary(model.observations);
  const drafts = model.observations.filter((match) => match.draft);
  const latest = model.observations.find((match) => dateValue(match.date));
  return <Surface className="opponents-dossier">
    <header className="opponent-dossier-heading"><div className="opponent-dossier-identity"><span className="opponent-team-mark" aria-hidden="true"><Shield size={26} /></span><div><p className="opponent-eyebrow">{t("Fiche adverse")}</p><h2 ref={headingRef} tabIndex={-1}>{opponent.name}</h2></div></div>{latest && <p className="opponent-last-game"><span>{t("Dernière partie référencée")}</span><ReferenceDate value={latest.date} /></p>}</header>
    <dl className="opponent-dossier-metrics">
      <div><dt>{t("Parties rattachées")}</dt><dd>{model.total}</dd><span>{matchCount(model.total)}</span></div>
      <div><dt>{t("Notre bilan contre eux")}</dt><dd>{results.known ? <><span className="opponent-wins">{results.wins}</span><span className="opponent-score-separator"> / </span><span className="opponent-losses">{results.losses}</span></> : "—"}</dd><span>{t("Victoires / défaites")}{results.unknown > 0 && <> · {t(results.unknown === 1 ? "1 résultat inconnu" : "{0} résultats inconnus", [results.unknown])}</>}</span></div>
      <div><dt>{t("Drafts liées")}</dt><dd>{drafts.length}</dd><span>{t("Picks et bans à revoir")}</span></div>
    </dl>
    {opponent.notes && <details className="opponent-staff-notes"><summary><FileText size={18} aria-hidden="true" />{t("Notes du staff")}</summary><p className="opponents-notes">{opponent.notes}</p></details>}
    <TabNav idPrefix={id} panelId={`${id}-panel`} label={t("Contenu de la fiche adverse")} className="opponent-dossier-tabs" activeId={panel} onChange={onPanel} items={[{ id: "overview", label: "Vue d’ensemble" }, { id: "games", label: "Parties", meta: model.total }, { id: "drafts", label: "Drafts", meta: drafts.length }]} />
    <div ref={panelRef} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${panel}`} tabIndex={0} className="opponent-dossier-panel">
      {panel === "overview" && (model.total ? <>
        <div className="opponents-frequencies"><FrequencyList title={t("Leurs champions joués")} description={t("Retrouvés dans les compositions adverses des parties.")} entries={model.playedPicks} coverage={model.coverage.played} total={model.total} icon={Swords} />
          <FrequencyList title={t("Leurs bans contre nous")} description={t("Ces retraits rendent le champion indisponible pour les deux camps.")} entries={model.bans} coverage={model.coverage.bans} total={model.total} icon={Ban} /></div>
        {model.coverage.draft > 0 && <details className="opponent-secondary-data"><summary>{t("Choix de draft non confirmés en partie")}<span>{model.coverage.draft}</span></summary><FrequencyList title={t("Picks de draft en complément")} entries={model.draftPicks} coverage={model.coverage.draft} total={model.total} /><p className="opponents-help">{t("Picks de la draft liée · champions joués non confirmés")}</p></details>}
        <details className="opponent-method"><summary>{t("Comprendre ces chiffres")}</summary><p>{t("Chaque partie compte une fois. Les champions joués proviennent de ses participants ; les picks d’une draft liée servent seulement si ces données sont incomplètes.")}</p><p>{t("Les fréquences de bans utilisent uniquement les drafts liées à ces parties avec leurs cinq bans renseignés ou explicitement non utilisés.")}</p>{model.coverage.unknown > 0 && <p>{t("Champions incomplets pour {0} parties : ces parties sont exclues des fréquences de champions.", [model.coverage.unknown])}</p>}<p>{t("Les dates sont celles des parties quand elles sont disponibles, sinon celles de leur import. Ces observations ne prédisent pas la prochaine draft.")}</p></details>
        <MatchHistory observations={model.observations} preview onShowAll={openGames} />
      </> : <div className="opponent-empty-dossier"><EmptyState icon={Swords} title={t("Cette fiche attend sa première partie")} text={t("Aucune partie rattachée à cet adversaire. Choisis cette équipe depuis une fiche de partie.")} /><a className="opponents-source" href="/games">{t("Ouvrir les parties")}<ArrowRight size={16} aria-hidden="true" /></a>{groups.length > 0 && <Button type="button" variant="ghost" onClick={openGames}>{t("Voir les groupes rattachés")}</Button>}</div>)}
      {panel === "games" && <><GroupHistory groups={groups} teamId={teamId} /><MatchHistory observations={model.observations} /></>}
      {panel === "drafts" && <DraftHistory observations={drafts} />}
    </div>
  </Surface>;
}

function TeamOpponents({ teamId, opponentId = "", refreshRevision = 0, onCountChange }) {
  const id = useId();
  const [collection, setCollection] = useState({ opponents: [], opponentMatches: [], opponentGroups: [], drafts: [], canEdit: false });
  const [loadState, setLoadState] = useState("loading");
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(opponentId);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [panel, setPanel] = useState("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const requests = useRef(new Set());
  const mutationRef = useRef(false);
  const readRequest = useRef(null);
  const hasCollection = useRef(false);
  const mounted = useRef(true);
  const pendingFocus = useRef(null);
  const dossierHeading = useRef(null);
  const dossierTop = useRef(null);
  const directoryHeading = useRef(null);
  const directoryCards = useRef(new Map());

  useEffect(() => { setSelectedId(opponentId); setPanel("overview"); }, [opponentId]);
  useEffect(() => {
    mounted.current = true;
    const pending = requests.current;
    return () => { mounted.current = false; for (const request of pending) request.abort(); pending.clear(); };
  }, []);
  useEffect(() => {
    let disposed = false;
    const load = () => {
      // One read at a time; creation owns the collection until it finishes.
      if (disposed || mutationRef.current || readRequest.current) return;
      const controller = new AbortController();
      readRequest.current = controller;
      if (!hasCollection.current) setLoadState("loading");
      setLoadError("");
      apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "list", teamId }), signal: controller.signal })
        .then((result) => { if (!disposed && !controller.signal.aborted) {
          hasCollection.current = true;
          setCollection({ opponents: [], opponentMatches: [], opponentGroups: [], drafts: [], ...result });
          setSelectedId((current) => result.opponents.some((item) => item.id === current) ? current : "");
          setLoadState("ready");
        } })
        .catch((error) => { if (!disposed && !controller.signal.aborted) {
          if (error.status === 401 || error.status === 403) {
            hasCollection.current = false;
            setCollection({ opponents: [], opponentMatches: [], opponentGroups: [], drafts: [], canEdit: false });
            setSelectedId("");
          }
          setLoadError(error.message || t("Impossible de charger les adversaires."));
          setLoadState(hasCollection.current ? "ready" : "error");
        } })
        .finally(() => { if (readRequest.current === controller) readRequest.current = null; });
    };
    const doc = typeof document === "undefined" ? null : document;
    const win = typeof window === "undefined" ? null : window;
    const loadVisible = () => { if (doc?.visibilityState !== "hidden") load(); };
    load();
    // Remote edits are checked only while this workspace is open and visible.
    const timer = globalThis.setInterval(loadVisible, 30_000);
    doc?.addEventListener?.("visibilitychange", loadVisible);
    win?.addEventListener?.("focus", loadVisible);
    win?.addEventListener?.("online", loadVisible);
    return () => {
      disposed = true;
      readRequest.current?.abort();
      readRequest.current = null;
      globalThis.clearInterval(timer);
      doc?.removeEventListener?.("visibilitychange", loadVisible);
      win?.removeEventListener?.("focus", loadVisible);
      win?.removeEventListener?.("online", loadVisible);
    };
  }, [teamId, reload, refreshRevision]);

  useEffect(() => {
    onCountChange?.(loadState === "ready" ? collection.opponents.length : null);
  }, [onCountChange, loadState, collection.opponents.length]);

  const dossiers = useMemo(() => {
    const bucket = (rows) => { const groups = new Map(); for (const row of rows) { if (!groups.has(row.opponentId)) groups.set(row.opponentId, []); groups.get(row.opponentId).push(row); } return groups; };
    const matches = bucket(collection.opponentMatches), drafts = bucket(collection.drafts), groups = bucket(collection.opponentGroups);
    return collection.opponents.map((opponent) => ({ opponent, model: buildOpponentObservations(opponent.id, matches.get(opponent.id), drafts.get(opponent.id)), groups: groups.get(opponent.id) || [] }));
  }, [collection]);
  const selected = dossiers.find(({ opponent }) => opponent.id === selectedId);
  const filtered = dossiers.filter(({ opponent }) => searchKey(search).split(/\s+/).every((word) => searchKey(opponent.name).includes(word))).sort((a, b) => {
    if (sort === "name") return a.opponent.name.localeCompare(b.opponent.name, getLocale());
    if (sort === "games") return b.model.total - a.model.total || a.opponent.name.localeCompare(b.opponent.name, getLocale());
    return (Date.parse(b.model.observations[0]?.date) || 0) - (Date.parse(a.model.observations[0]?.date) || 0) || a.opponent.name.localeCompare(b.opponent.name, getLocale());
  });
  const canEdit = loadState === "ready" && collection.canEdit;
  useLayoutEffect(() => {
    if (loadState !== "ready" || !pendingFocus.current) return;
    const target = pendingFocus.current === "dossier" && selected ? dossierHeading.current : directoryCards.current.get(pendingFocus.current) || directoryHeading.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    (pendingFocus.current === "dossier" && selected ? dossierTop.current : target)?.scrollIntoView({ block: "start", behavior: "instant" });
    pendingFocus.current = null;
  }, [loadState, selectedId, selected, createOpen]);
  const selectOpponent = (value) => { pendingFocus.current = "dossier"; setSelectedId(value); setPanel("overview"); setNotice(""); };
  const backToDirectory = () => { pendingFocus.current = selectedId; setSelectedId(""); setNotice(""); };
  const refresh = () => { pendingFocus.current = selected ? "dossier" : "directory"; setNotice(""); setReload((value) => value + 1); };

  async function createOpponent(event) {
    event.preventDefault();
    if (!canEdit || !name.trim() || mutationRef.current) return;
    mutationRef.current = true;
    readRequest.current?.abort();
    const controller = new AbortController(); requests.current.add(controller);
    setCreating(true); setCreateError(""); setNotice("");
    try {
      const { opponent } = await apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "create-opponent", teamId, name: name.trim(), notes: notes.trim() }), signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      pendingFocus.current = "dossier";
      setCollection((current) => ({ ...current, opponents: [...current.opponents.filter((item) => item.id !== opponent.id), opponent] }));
      setSelectedId(opponent.id); setPanel("overview"); setCreateOpen(false); setName(""); setNotes("");
      setNotice(t("Fiche adversaire créée."));
    } catch (error) { if (mounted.current && !controller.signal.aborted) setCreateError(error.message || t("Impossible de créer cet adversaire.")); }
    finally { requests.current.delete(controller); mutationRef.current = false; if (mounted.current) { setCreating(false); setReload((value) => value + 1); } }
  }

  return <div className="opponent-browser">
    <div role="status" aria-live="polite" aria-atomic="true" className={notice ? "opponents-notice" : "sr-only"}>{notice && <Check size={18} aria-hidden="true" />}{notice}</div>
    {loadError && loadState === "ready" && <Surface><p role="alert">{t("Les données n’ont pas pu être actualisées")} · {t(loadError)}</p><Button type="button" variant="ghost" icon={RefreshCw} onClick={refresh}>{t("Réessayer")}</Button></Surface>}
    {loadState === "loading" ? <Surface><p role="status">{t("Chargement des adversaires…")}</p><SkeletonRows count={3} /></Surface> : loadState === "error" ? <Surface><p role="alert">{t(loadError)}</p><Button type="button" variant="ghost" icon={RefreshCw} onClick={refresh}>{t("Réessayer")}</Button></Surface> : <>
      {selected ? <>
        <div ref={dossierTop} className="opponent-browser-toolbar"><Button type="button" variant="ghost" icon={ArrowLeft} onClick={backToDirectory}>{t("Toutes les équipes")}</Button></div>
        <OpponentDossier key={selectedId} opponent={selected.opponent} model={selected.model} groups={selected.groups} teamId={teamId} headingRef={dossierHeading} panel={panel} onPanel={setPanel} />
      </> : <Surface className="opponents-directory">
        <div className="opponent-directory-heading"><div><p className="opponent-eyebrow">{t("Préparer une rencontre")}</p><h2 ref={directoryHeading} tabIndex={-1}>{t("Équipes adverses")}</h2><p>{t("Retrouve un adversaire, puis ouvre sa fiche pour préparer la prochaine rencontre.")}</p></div><div className="opponent-directory-actions">{canEdit && <Button type="button" icon={Plus} disabled={creating} aria-expanded={createOpen} aria-controls={`${id}-create`} onClick={() => setCreateOpen((open) => !open)}>{t("Ajouter un adversaire")}</Button>}</div></div>
        {canEdit && createOpen && <form id={`${id}-create`} className="opponents-create" onSubmit={createOpponent}>
          <div><h3>{t("Nouvelle fiche adverse")}</h3><p className="opponents-help">{t("Le nom permet de retrouver cette équipe et de lui rattacher des parties.")}</p></div>
          <TextInput label={t("Nom de l’adversaire")} value={name} onChange={setName} maxLength={80} required disabled={creating} autoComplete="off" autoFocus />
          <TextAreaInput label={t("Notes du staff (facultatif)")} value={notes} onChange={setNotes} maxLength={2000} rows={3} disabled={creating} />
          {createError && <p className="opponents-error" role="alert">{t(createError)}</p>}
          <div className="opponent-form-actions"><Button type="submit" icon={creating ? Loader2 : Plus} disabled={creating || !name.trim()}>{t(creating ? "Création…" : "Créer la fiche")}</Button><Button type="button" variant="ghost" disabled={creating} onClick={() => { pendingFocus.current = "directory"; setCreateOpen(false); }}>{t("Annuler")}</Button></div>
        </form>}
        {collection.opponents.length ? <>
          <div className="opponent-directory-filters"><TextInput label={t("Rechercher une équipe")} type="search" icon={Search} value={search} onChange={setSearch} placeholder={t("Nom de l’équipe adverse")} disabled={creating} /><SelectInput label={t("Tri des équipes")} value={sort} onChange={setSort} disabled={creating}><option value="recent">{t("Parties les plus récentes")}</option><option value="name">{t("Nom de l’équipe")}</option><option value="games">{t("Nombre de parties")}</option></SelectInput></div>
          <div className="opponent-directory-count"><p role="status">{t(filtered.length === 1 ? "1 équipe affichée sur {1}" : "{0} équipes affichées sur {1}", [filtered.length, collection.opponents.length])}</p>{search && <Button type="button" variant="ghost" onClick={() => setSearch("")}>{t("Effacer la recherche")}</Button>}</div>
          {filtered.length ? <ul className="opponent-directory-grid">{filtered.map(({ opponent, model }) => {
            const latest = model.observations.find((match) => dateValue(match.date));
            const draftTotal = model.observations.filter((match) => match.draft).length;
            return <li key={opponent.id}><button type="button" className="opponent-directory-card" ref={(node) => { if (node) directoryCards.current.set(opponent.id, node); else directoryCards.current.delete(opponent.id); }} aria-label={opponent.name} disabled={creating} onClick={() => selectOpponent(opponent.id)}>
              <span className="opponent-card-title"><span className="opponent-team-mark" aria-hidden="true"><Shield size={22} /></span><strong>{opponent.name}</strong><ChevronRight size={18} aria-hidden="true" /></span>
              <span className="opponent-card-counts"><span>{matchCount(model.total)}</span><span>{draftCount(draftTotal)}</span></span>
              <span className="opponent-card-last">{latest ? <><span>{t("Dernière partie référencée")}</span><ReferenceDate value={latest.date} /></> : t("Prête à accueillir vos premières parties")}</span>
              <span className="opponent-card-action">{t("Ouvrir la fiche")}<ArrowRight size={16} aria-hidden="true" /></span>
            </button></li>;
          })}</ul> : <EmptyState icon={Search} title={t("Aucune équipe trouvée")} text={t("Essaie un autre nom ou efface la recherche.")} />}
        </> : <EmptyState icon={Shield} title={t("Un dossier pour chaque adversaire")} text={t("Crée une fiche pour regrouper les parties d’un adversaire.")} />}
      </Surface>}
      {!canEdit && <p className="opponents-help">{t("Lecture seule : le staff peut créer les fiches adversaires.")}</p>}
    </>}
  </div>;
}

export function OpponentsWorkspace({ selectedTeamId, user, embedded = false, title, opponentId = "", refreshRevision = 0, onCountChange }) {
  useLanguage();
  return <div className="opponents-workspace">
    {!embedded && <PageHeader title={title || t("Adversaires")} subtitle={t("Prépare les prochaines rencontres à partir des parties de tes adversaires.")} />}
    {selectedTeamId ? <TeamOpponents key={`${selectedTeamId}:${user?.id || ""}`} teamId={selectedTeamId} opponentId={opponentId} refreshRevision={refreshRevision} onCountChange={onCountChange} /> : <Surface><EmptyState icon={Shield} title={t("Choisis une équipe")} text={t("Les fiches adversaires et leurs parties appartiennent à l’équipe sélectionnée.")} /></Surface>}
  </div>;
}

export default OpponentsWorkspace;
