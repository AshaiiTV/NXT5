import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Copy, Loader2, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { Badge, Button, SelectInput, TextAreaInput, TextInput } from "../ui/Core.jsx";
import { championAssetId, championDisplayName, ChampionPortrait } from "../../pages/workspace/workspace-shared.jsx";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";
import { matchDisplayName } from "../../utils/matches.js";
import { buildMatchups, championKey, notebookStats } from "../../utils/matchup-notebook.js";
import { emptyNotebook, useMatchupNotebooks, useMatchupStatRows, useNotebookDraft } from "../../hooks/useMatchupNotebooks.js";
import "./matchup-notebook.css";

const EXPERIMENT_STATES = { planned: "À tester", active: "En cours", concluded: "Terminé" };
const PLAN_FIELDS = [["lanePlan", "Plan de départ"], ["vigilance", "Points de vigilance"], ["toKeep", "À conserver"]];
const number = (value) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString(getLocale(), { maximumFractionDigits: 1 });
const signed = (value) => value === null || value === undefined ? "—" : (value > 0 ? "+" : "") + number(value);
const pluralCount = (count) => count !== 1 && (count !== 0 || getLocale() !== "fr-FR");
const noteKey = (note) => note.role + "|" + championKey(note.opponentChampion);
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString(getLocale()) : "";

export function ChampionSectionTabs({ active, onChange, id }) {
  useLanguage();
  const tabs = [{ id: "statistics", label: "Statistiques" }, { id: "matchups", label: "Matchups" }];
  const selectWithKey = (event, index) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    onChange(tabs[next].id);
    event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className="matchup-section-tabs nxt5-tab-nav" role="tablist" aria-label={t("Rubriques du champion")}>
    {tabs.map((tab, index) => <button type="button" className="nxt5-tab" role="tab" key={tab.id} id={id + "-" + tab.id} aria-controls={id + "-panel"} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={(event) => selectWithKey(event, index)}>{tab.id === "matchups" && <BookOpen size={16} aria-hidden="true" />}{t(tab.label)}</button>)}
  </div>;
}

function notebookStatus(note) {
  if (note?.experiments?.some((experiment) => experiment.status === "active")) return ["Essai en cours", "purple"];
  if (note?.plan?.lanePlan?.trim()) return ["Plan renseigné", "cyan"];
  if (note?.experiments?.length) return ["Essais renseignés", "purple"];
  return ["À préparer", "slate"];
}

export function MatchupNotebook({ champion, rows = [], teamId, playerId, userId, bootstrapRevision, navigate, renderGames }) {
  useLanguage();
  const collection = useMatchupNotebooks(teamId, playerId, championKey(champion), bootstrapRevision);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const root = useRef(null);
  const heading = useRef(null);
  const groups = useMemo(() => {
    const entries = buildMatchups(rows);
    for (const note of collection.notebooks) {
      if (!entries.some((entry) => entry.key === noteKey(note))) entries.push({
        key: noteKey(note), opponentChampion: championAssetId(note.opponentChampion.charAt(0).toUpperCase() + note.opponentChampion.slice(1)), opponentKey: championKey(note.opponentChampion), role: note.role,
        rows: [], games: 0, results: { count: 0, rate: null }, cs10: { value: null, count: 0 },
      });
    }
    return entries;
  }, [rows, collection.notebooks]);
  const selected = groups.find((group) => group.key === selectedKey);
  const selectedNote = collection.notebooks.find((note) => noteKey(note) === selectedKey);
  const excluded = rows.length - buildMatchups(rows).reduce((sum, group) => sum + group.games, 0);
  const matchesQuery = (group) => (championDisplayName(group.opponentChampion) + " " + roleLabel(group.role)).toLocaleLowerCase(getLocale()).includes(query.trim().toLocaleLowerCase(getLocale()));
  const visible = groups.filter(matchesQuery);
  useEffect(() => {
    if (selectedKey) heading.current?.focus();
  }, [selectedKey]);
  const back = () => {
    setSelectedKey("");
    requestAnimationFrame(() => root.current?.querySelector('[data-matchup="' + selectedKey + '"]')?.focus());
  };
  return <section className="matchup-notebook" ref={root}>
    {selected ? <>
      <Button variant="ghost" type="button" icon={ArrowLeft} onClick={back}>{t("Tous les matchups")}</Button>
      <header className="matchup-heading">
        <ChampionPortrait champion={selected.opponentChampion} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        <div><h4 ref={heading} tabIndex={-1}>{championDisplayName(champion)}{t(" face à ")}{championDisplayName(selected.opponentChampion)}</h4><p>{t(roleLabel(selected.role))} · {t(pluralCount(selected.games) ? "{0} parties" : "{0} partie", [selected.games])}{t(" dans la catégorie sélectionnée")}</p></div>
      </header>
      <p className="matchup-meta">{t("Carnet de ce joueur, partagé avec l’équipe. Le plan et les essais sont communs aux catégories et aux patches.")}</p>
      {collection.loading && <p role="status" className="matchup-notice">{t("Chargement du carnet partagé…")}</p>}
      {collection.error && <div role="alert" className="matchup-error"><p>{t(collection.error)}</p><Button type="button" variant="ghost" onClick={collection.retry}>{t("Réessayer le carnet")}</Button></div>}
      {!collection.loading && !collection.error && <NotebookContent key={[userId, teamId, playerId, championKey(champion), selectedKey].join("|")} draftKey={[userId, teamId, playerId, championKey(champion), selectedKey].join("|")} group={selected} notebook={selectedNote} canEdit={collection.canEdit} onSave={(draft, revision) => collection.save({ opponentChampion: selected.opponentKey, role: selected.role }, draft, revision)} onReload={collection.retry} navigate={navigate} />}
      <MatchupStatistics key={selectedKey} group={selected} teamId={teamId} bootstrapRevision={bootstrapRevision} renderGames={renderGames} />
    </> : <>
      <header className="matchup-heading"><div><h4>{t("Carnets de matchups")}</h4><p>{t("Prépare chaque duel (matchup), puis garde le plan et les conclusions de l’équipe.")}</p></div></header>
      <label className="matchup-search"><span>{t("Rechercher un adversaire")}</span><div><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Champion ou poste")} /></div></label>
      {collection.loading && <p role="status" className="matchup-meta">{t("Chargement des plans et essais…")}</p>}
      {collection.error && <div role="alert" className="matchup-error"><p>{t(collection.error)}</p><Button type="button" variant="ghost" onClick={collection.retry}>{t("Réessayer")}</Button></div>}
      <p className="matchup-meta" role="status">{t(pluralCount(visible.length) ? "{0} matchups" : "{0} matchup", [visible.length])}{t(" · les victoires concernent les parties entières")}</p>
      <div className="matchup-list">{visible.map((group) => {
        const note = collection.notebooks.find((item) => noteKey(item) === group.key);
        const [status, tone] = notebookStatus(note);
        return <button type="button" key={group.key} data-matchup={group.key} className="matchup-row" onClick={() => setSelectedKey(group.key)}>
          <span className="matchup-identity"><ChampionPortrait champion={group.opponentChampion} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /><span><strong>{championDisplayName(group.opponentChampion)}</strong><small>{t(roleLabel(group.role))}</small></span></span>
          <span><strong>{group.games}</strong><small>{t(pluralCount(group.games) ? "parties" : "partie")}</small></span>
          <span><strong>{number(group.results.rate)}{group.results.rate === null ? "" : " %"}</strong><small>{t("Victoires · ")}{t(pluralCount(group.results.count) ? "{0} résultats connus" : "{0} résultat connu", [group.results.count])}</small></span>
          <span><strong>{signed(group.cs10.value)}{group.cs10.value === null ? "" : " CS"}</strong><small>{t("Écart à 10 min · ")}{t(pluralCount(group.cs10.count) ? "{0} parties" : "{0} partie", [group.cs10.count])}</small></span>
          <span className="matchup-row-status"><Badge tone={tone}>{collection.error ? t("Carnet indisponible") : collection.loading ? t("Chargement…") : t(status)}</Badge><ArrowRight size={18} aria-hidden="true" /></span>
        </button>;
      })}</div>
      {visible.length > 0 && <p className="matchup-meta matchup-list-help">{t("CS : sbires et monstres tués. L’écart est calculé face à l’adversaire au même poste.")}</p>}
      {!visible.length && <p className="matchup-notice">{query ? t("Aucun matchup ne correspond à cette recherche.") : t("Les matchups apparaissent avec les parties importées et un adversaire identifié au même poste.")}</p>}
      {excluded > 0 && <p className="matchup-meta">{t(pluralCount(excluded) ? "{0} parties" : "{0} partie", [excluded])}{t(" sans adversaire de même poste identifié sans ambiguïté. Vérifie les postes dans Parties pour les retrouver ici.")}</p>}
    </>}
  </section>;
}

function NotebookContent({ draftKey, group, notebook, canEdit, onSave, onReload, navigate }) {
  useLanguage();
  const draft = useNotebookDraft(draftKey, notebook, onSave);
  const [editing, setEditing] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const formId = useId();
  const editingNow = canEdit && (editing || draft.dirty);
  const current = canEdit ? draft.value : notebook || emptyNotebook();
  const updatePlan = (field, value) => draft.change({ ...current, plan: { ...current.plan, [field]: value } });
  const updateExperiment = (id, value) => draft.change({ ...current, experiments: current.experiments.map((experiment) => experiment.id === id ? { ...experiment, ...value } : experiment) });
  const cancel = () => {
    if (draft.dirty && !window.confirm(t("Annuler les modifications non enregistrées de ce carnet ?"))) return;
    draft.discard();
    setEditing(false);
    setCopyMessage("");
  };
  const addExperiment = () => {
    draft.change({ ...current, experiments: [...current.experiments, { id: crypto.randomUUID(), title: "", plan: "", observation: "", conclusion: "", status: "planned", matchIds: [] }] });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(draft.value, null, 2)); setCopyMessage("Brouillon copié."); }
    catch { setCopyMessage("Copie indisponible : ton brouillon reste dans les champs."); }
  };
  return <section className="matchup-content">
    <div className="matchup-section-heading"><div><h5>{t("Plan de départ et essais")}</h5><p className="matchup-meta">{notebook?.updatedAt ? t(notebook.updatedByName ? "Mis à jour le {0} par {1}" : "Mis à jour le {0}", [date(notebook.updatedAt), notebook.updatedByName]) : t("Prépare la prochaine rencontre.")}</p></div>
      {canEdit && !editingNow && <Button type="button" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>{notebook ? t("Modifier le carnet") : t("Préparer le carnet")}</Button>}
    </div>
    {!canEdit && <p className="matchup-meta">{t("Le joueur lié au profil et le staff peuvent modifier ce carnet.")}</p>}
    {!canEdit && draft.dirty && <div className="matchup-notice"><p>{t("Un brouillon non enregistré est conservé. Tu consultes la version partagée ; tes droits actuels ne permettent plus de la modifier.")}</p><Button type="button" variant="ghost" icon={Copy} onClick={copy}>{t("Copier mon brouillon")}</Button>{copyMessage && <p role="status">{t(copyMessage)}</p>}</div>}
    {draft.saved && <p className="matchup-saved" role="status"><Check size={16} aria-hidden="true" />{t("Carnet enregistré.")}</p>}
    {editingNow ? <form id={formId} onSubmit={async (event) => { event.preventDefault(); if (await draft.submit()) setEditing(false); }}>
      <fieldset disabled={draft.busy} className="matchup-fields">
        <legend className="sr-only">{t("Modifier le plan et les essais")}</legend>
        <div className="matchup-plan-fields">{PLAN_FIELDS.map(([field, label]) => <TextAreaInput key={field} label={t(label)} value={current.plan[field]} onChange={(value) => updatePlan(field, value)} maxLength={4000} rows={field === "lanePlan" ? 4 : 3} />)}</div>
        <div className="matchup-section-heading"><h5>{t("Essais")}</h5><Button type="button" variant="ghost" icon={Plus} disabled={current.experiments.length >= 20} onClick={addExperiment}>{t("Ajouter un essai")}</Button></div>
        {!current.experiments.length && <p className="matchup-meta">{t("Ajoute une approche à tester, puis associe les parties et tes observations.")}</p>}
        {current.experiments.map((experiment, index) => <ExperimentEditor key={experiment.id} experiment={experiment} index={index} rows={group.rows} onChange={(value) => updateExperiment(experiment.id, value)} onRemove={() => {
          if ((experiment.title || experiment.plan || experiment.observation || experiment.conclusion || experiment.matchIds.length) && !window.confirm(t("Retirer cet essai du carnet ?"))) return;
          draft.change({ ...current, experiments: current.experiments.filter((item) => item.id !== experiment.id) });
        }} />)}
      </fieldset>
      {draft.error && <div className="matchup-error" role="alert"><p>{t(draft.error)}</p><div className="matchup-actions"><Button type="button" variant="ghost" icon={Copy} onClick={copy}>{t("Copier mon brouillon")}</Button><Button type="button" variant="ghost" onClick={() => {
        if (!window.confirm(t("Recharger la version enregistrée ? Les modifications de ce brouillon seront abandonnées."))) return;
        draft.discard(); setEditing(false); onReload();
      }}>{t("Recharger le carnet")}</Button></div>{copyMessage && <p role="status">{t(copyMessage)}</p>}</div>}
      <div className="matchup-savebar"><p role="status">{draft.busy ? t("Enregistrement…") : draft.dirty ? t("Modifications non enregistrées · brouillon conservé pendant la navigation.") : t("Aucune modification.")}</p><div className="matchup-actions"><Button type="button" variant="ghost" disabled={draft.busy} onClick={cancel}>{t("Annuler")}</Button><Button type="submit" icon={draft.busy ? Loader2 : Save} disabled={draft.busy || !draft.dirty}>{t("Enregistrer le carnet")}</Button></div></div>
    </form> : <>
      <dl className="matchup-plan">{PLAN_FIELDS.map(([field, label]) => <div key={field}><dt>{t(label)}</dt><dd>{current.plan[field] || t("À renseigner.")}</dd></div>)}</dl>
      <div className="matchup-section-heading"><h5>{t("Essais et conclusions")}</h5><span className="matchup-meta">{t(pluralCount(current.experiments.length) ? "{0} essais" : "{0} essai", [current.experiments.length])}</span></div>
      {current.experiments.length ? current.experiments.map((experiment) => <details className="matchup-experiment" key={experiment.id}>
        <summary><strong>{experiment.title}</strong><Badge tone={experiment.status === "active" ? "purple" : "cyan"}>{t(EXPERIMENT_STATES[experiment.status])}</Badge><span className="matchup-meta">{t(pluralCount(experiment.matchIds.length) ? "{0} parties associées" : "{0} partie associée", [experiment.matchIds.length])}</span></summary>
        <dl className="matchup-plan">{[["plan", "À tester"], ["observation", "Observations"], ["conclusion", "Conclusion du joueur et du staff"]].map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd>{experiment[key] || t("À renseigner.")}</dd></div>)}</dl>
        <LinkedGames ids={experiment.matchIds} rows={group.rows} navigate={navigate} />
      </details>) : <p className="matchup-meta">{t("Aucun essai enregistré pour ce duel.")}</p>}
    </>}
  </section>;
}

function LinkedGames({ ids, rows, navigate }) {
  useLanguage();
  if (!ids.length) return <p className="matchup-meta">{t("Aucune partie associée.")}</p>;
  return <ul className="matchup-linked-games">{ids.map((id) => {
    const match = rows.find((row) => row.match?.id === id)?.match;
    const href = "/games?match=" + encodeURIComponent(id);
    return <li key={id}><a href={href} onClick={(event) => { if (navigate && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); navigate(href); } }}>{match ? matchDisplayName(match) : t("Partie hors du périmètre actuel")}<ArrowRight size={14} aria-hidden="true" /></a></li>;
  })}</ul>;
}

function ExperimentEditor({ experiment, index, rows, onChange, onRemove }) {
  useLanguage();
  const choices = new Map(rows.filter((row) => row.match?.id).map((row) => [row.match.id, matchDisplayName(row.match)]));
  experiment.matchIds.forEach((id) => { if (!choices.has(id)) choices.set(id, t("Partie hors de la catégorie actuelle")); });
  return <fieldset className="matchup-experiment-editor">
    <legend>{t("Essai ")}{index + 1}</legend>
    <div className="matchup-experiment-title"><TextInput label={t("Titre de l’essai")} value={experiment.title} onChange={(title) => onChange({ title })} maxLength={120} required /><SelectInput label={t("État de l’essai")} value={experiment.status} onChange={(status) => onChange({ status })}>{Object.entries(EXPERIMENT_STATES).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</SelectInput></div>
    <TextAreaInput label={t("Ce qu’on veut tester")} value={experiment.plan} onChange={(plan) => onChange({ plan })} rows={3} maxLength={2000} />
    <div className="matchup-experiment-texts"><TextAreaInput label={t("Observations du joueur")} value={experiment.observation} onChange={(observation) => onChange({ observation })} rows={3} maxLength={2000} /><TextAreaInput label={t("Conclusion du joueur et du staff")} value={experiment.conclusion} onChange={(conclusion) => onChange({ conclusion })} rows={3} maxLength={2000} /></div>
    <details className="matchup-game-picker"><summary>{t("Associer des parties ")}<span>· {t(pluralCount(experiment.matchIds.length) ? "{0} sélectionnées" : "{0} sélectionnée", [experiment.matchIds.length])}</span></summary><p className="matchup-meta">{t("Choisis les parties qui ont servi à cet essai, dans la catégorie actuelle. Les associations précédentes sont conservées.")}</p>
      {choices.size ? <div>{[...choices.entries()].map(([id, label]) => <label key={id}><input type="checkbox" checked={experiment.matchIds.includes(id)} disabled={!experiment.matchIds.includes(id) && experiment.matchIds.length >= 50} onChange={(event) => onChange({ matchIds: event.target.checked ? [...experiment.matchIds, id] : experiment.matchIds.filter((matchId) => matchId !== id) })} /><span>{label}</span></label>)}</div> : <p className="matchup-meta">{t("Aucune partie à associer dans cette catégorie.")}</p>}
    </details>
    <Button type="button" variant="ghost" icon={Trash2} onClick={onRemove}>{t("Retirer cet essai")}</Button>
  </fieldset>;
}

function MatchupStatistics({ group, teamId, bootstrapRevision, renderGames }) {
  useLanguage();
  const [patch, setPatch] = useState("");
  const rows = group.rows.filter((row) => !patch || String(row.match?.patch || "") === patch);
  const patches = [...new Set(group.rows.map((row) => row.match?.patch).filter(Boolean))].sort((a, b) => b.localeCompare(a, getLocale(), { numeric: true }));
  const details = useMatchupStatRows(teamId, rows, bootstrapRevision);
  const stats = notebookStats(details.rows);
  return <section className="matchup-statistics">
    <div className="matchup-section-heading"><div><h5>{t("Statistiques du duel")}</h5><p className="matchup-meta">{t("Écart moyen du joueur avec l’adversaire au même poste. Chaque mesure indique le nombre de parties renseignées.")}</p></div><SelectInput label={t("Patch des statistiques")} value={patch} onChange={setPatch}><option value="">{t("Tous les patches")}</option>{patches.map((value) => <option key={value} value={value}>{value}</option>)}</SelectInput></div>
    <p>{t(pluralCount(rows.length) ? "{0} parties" : "{0} partie", [rows.length])} · {stats.results.rate === null ? t("Résultats indisponibles") : t("{0} % de victoires", [number(stats.results.rate)])} <span className="matchup-meta">{t(pluralCount(stats.results.count) ? "{0} résultats connus" : "{0} résultat connu", [stats.results.count])}{t(" · la victoire ne mesure pas à elle seule la réussite du duel.")}</span></p>
    {details.loading && <p className="matchup-notice" role="status">{t("Chargement des relevés du duel… ")}{t("{0}/{1} parties", [details.loaded, details.total])}</p>}
    {details.error && <div className="matchup-error" role="alert"><p>{t(details.error)}{t(" Les mesures disponibles restent affichées.")}</p><Button type="button" variant="ghost" onClick={details.retry}>{t("Réessayer les statistiques")}</Button></div>}
    <details className="matchup-statistics-details"><summary>{t("Relevés à 10, 15 et 20 minutes")}<span>{t("CS, or et expérience face à l’adversaire")}</span></summary>
    <p className="matchup-meta">{t("CS : sbires et monstres tués · PO : pièces d’or · XP : expérience.")}</p>
    <div className="matchup-milestones">{stats.milestones.map((milestone) => <section key={milestone.minute}><h6>{t("À {0} minutes", [milestone.minute])}</h6><dl>{[["cs", "Écart de CS", " CS"], ["gold", "Écart d’or", " PO"], ["xp", "Écart d’expérience", " XP"]].map(([field, label, unit]) => {
      const metric = milestone[field];
      return <div key={field}><dt>{t(label)}</dt><dd className={metric.value > 0 ? "matchup-positive" : metric.value < 0 ? "matchup-negative" : ""}>{signed(metric.value)}{metric.value === null ? "" : t(unit)}<small>{metric.count}/{rows.length}{t(" parties renseignées")}</small></dd></div>;
    })}</dl></section>)}</div>
    <p className="matchup-meta">{t("« — » : donnée indisponible. Les relevés peuvent être décalés d’au plus une minute. Les changements de poste pendant la partie restent à vérifier en débrief.")}</p>
    </details>
    <section className="matchup-source-games"><h5>{t("Parties, runes et équipements")}</h5><p className="matchup-meta">{t("Ouvre une partie pour comparer les runes, les compétences et les achats des deux joueurs.")}</p>{renderGames?.(rows)}</section>
  </section>;
}
