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
const number = (value) => value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const signed = (value) => value === null || value === undefined ? "—" : (value > 0 ? "+" : "") + number(value);
const noteKey = (note) => note.role + "|" + championKey(note.opponentChampion);
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("fr-FR") : "";

export function ChampionSectionTabs({ active, onChange, id }) {
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
  return <div className="matchup-section-tabs" role="tablist" aria-label="Rubriques du champion">
    {tabs.map((tab, index) => <button type="button" role="tab" key={tab.id} id={id + "-" + tab.id} aria-controls={id + "-panel"} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={(event) => selectWithKey(event, index)}>{tab.id === "matchups" && <BookOpen size={16} aria-hidden="true" />}{tab.label}</button>)}
  </div>;
}

function notebookStatus(note) {
  if (note?.experiments?.some((experiment) => experiment.status === "active")) return ["Essai en cours", "purple"];
  if (note?.plan?.lanePlan?.trim()) return ["Plan renseigné", "cyan"];
  if (note?.experiments?.length) return ["Essais renseignés", "purple"];
  return ["À préparer", "slate"];
}

export function MatchupNotebook({ champion, rows = [], teamId, playerId, userId, bootstrapRevision, navigate, renderGames }) {
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
  const matchesQuery = (group) => (championDisplayName(group.opponentChampion) + " " + roleLabel(group.role)).toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"));
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
      <Button variant="ghost" type="button" icon={ArrowLeft} onClick={back}>Tous les matchups</Button>
      <header className="matchup-heading">
        <ChampionPortrait champion={selected.opponentChampion} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        <div><h4 ref={heading} tabIndex={-1}>{championDisplayName(champion)} face à {championDisplayName(selected.opponentChampion)}</h4><p>{roleLabel(selected.role)} · {selected.games} game{selected.games > 1 ? "s" : ""} dans la catégorie sélectionnée</p></div>
      </header>
      <p className="matchup-meta">Carnet de ce joueur, partagé avec l’équipe. Le plan et les essais sont communs aux catégories et aux patches.</p>
      {collection.loading && <p role="status" className="matchup-notice">Chargement du carnet partagé…</p>}
      {collection.error && <div role="alert" className="matchup-error"><p>{collection.error}</p><Button type="button" variant="ghost" onClick={collection.retry}>Réessayer le carnet</Button></div>}
      {!collection.loading && !collection.error && <NotebookContent key={[userId, teamId, playerId, championKey(champion), selectedKey].join("|")} draftKey={[userId, teamId, playerId, championKey(champion), selectedKey].join("|")} group={selected} notebook={selectedNote} canEdit={collection.canEdit} onSave={(draft, revision) => collection.save({ opponentChampion: selected.opponentKey, role: selected.role }, draft, revision)} onReload={collection.retry} navigate={navigate} />}
      <MatchupStatistics key={selectedKey} group={selected} teamId={teamId} bootstrapRevision={bootstrapRevision} renderGames={renderGames} />
    </> : <>
      <header className="matchup-heading"><div><h4>Ton carnet de matchups</h4><p>Retrouve tes duels, prépare ton plan de lane et garde les conclusions de tes essais.</p></div></header>
      <label className="matchup-search"><span>Rechercher un adversaire</span><div><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Champion ou poste" /></div></label>
      {collection.loading && <p role="status" className="matchup-meta">Chargement des plans et essais…</p>}
      {collection.error && <div role="alert" className="matchup-error"><p>{collection.error}</p><Button type="button" variant="ghost" onClick={collection.retry}>Réessayer</Button></div>}
      <p className="matchup-meta" role="status">{visible.length} matchup{visible.length > 1 ? "s" : ""} · les victoires sont celles des games entières</p>
      <div className="matchup-list">{visible.map((group) => {
        const note = collection.notebooks.find((item) => noteKey(item) === group.key);
        const [status, tone] = notebookStatus(note);
        return <button type="button" key={group.key} data-matchup={group.key} className="matchup-row" onClick={() => setSelectedKey(group.key)}>
          <span className="matchup-identity"><ChampionPortrait champion={group.opponentChampion} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /><span><strong>{championDisplayName(group.opponentChampion)}</strong><small>{roleLabel(group.role)}</small></span></span>
          <span><strong>{group.games}</strong><small>game{group.games > 1 ? "s" : ""}</small></span>
          <span><strong>{number(group.results.rate)}{group.results.rate === null ? "" : " %"}</strong><small>{group.results.count} résultats connus</small></span>
          <span><strong>{signed(group.cs10.value)}{group.cs10.value === null ? "" : " CS"}</strong><small>Écart à 10 min · {group.cs10.count} games</small></span>
          <span className="matchup-row-status"><Badge tone={tone}>{collection.error ? "Carnet indisponible" : collection.loading ? "Chargement…" : status}</Badge><ArrowRight size={18} aria-hidden="true" /></span>
        </button>;
      })}</div>
      {!visible.length && <p className="matchup-notice">{query ? "Aucun matchup ne correspond à cette recherche." : "Les matchups apparaissent avec les games importées et un adversaire identifié au même poste."}</p>}
      {excluded > 0 && <p className="matchup-meta">{excluded} game{excluded > 1 ? "s" : ""} sans adversaire de même poste identifié sans ambiguïté. Vérifie les postes dans Games pour les retrouver ici.</p>}
    </>}
  </section>;
}

function NotebookContent({ draftKey, group, notebook, canEdit, onSave, onReload, navigate }) {
  const draft = useNotebookDraft(draftKey, notebook, onSave);
  const [editing, setEditing] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const formId = useId();
  const editingNow = canEdit && (editing || draft.dirty);
  const current = canEdit ? draft.value : notebook || emptyNotebook();
  const updatePlan = (field, value) => draft.change({ ...current, plan: { ...current.plan, [field]: value } });
  const updateExperiment = (id, value) => draft.change({ ...current, experiments: current.experiments.map((experiment) => experiment.id === id ? { ...experiment, ...value } : experiment) });
  const cancel = () => {
    if (draft.dirty && !window.confirm("Annuler les modifications non enregistrées de ce carnet ?")) return;
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
    <div className="matchup-section-heading"><div><h5>Plan de lane et essais</h5><p className="matchup-meta">{notebook?.updatedAt ? "Mis à jour le " + date(notebook.updatedAt) + (notebook.updatedByName ? " par " + notebook.updatedByName : "") : "Prépare la prochaine rencontre."}</p></div>
      {canEdit && !editingNow && <Button type="button" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>{notebook ? "Modifier le carnet" : "Préparer le carnet"}</Button>}
    </div>
    {!canEdit && <p className="matchup-meta">Le joueur lié au profil et le staff peuvent modifier ce carnet.</p>}
    {!canEdit && draft.dirty && <div className="matchup-notice"><p>Un brouillon non enregistré est conservé. Tu consultes la version partagée ; tes droits actuels ne permettent plus de la modifier.</p><Button type="button" variant="ghost" icon={Copy} onClick={copy}>Copier mon brouillon</Button>{copyMessage && <p role="status">{copyMessage}</p>}</div>}
    {draft.saved && <p className="matchup-saved" role="status"><Check size={16} aria-hidden="true" />Carnet enregistré.</p>}
    {editingNow ? <form id={formId} onSubmit={async (event) => { event.preventDefault(); if (await draft.submit()) setEditing(false); }}>
      <fieldset disabled={draft.busy} className="matchup-fields">
        <legend className="sr-only">Modifier le plan et les essais</legend>
        <div className="matchup-plan-fields">{PLAN_FIELDS.map(([field, label]) => <TextAreaInput key={field} label={label} value={current.plan[field]} onChange={(value) => updatePlan(field, value)} maxLength={4000} rows={field === "lanePlan" ? 4 : 3} />)}</div>
        <div className="matchup-section-heading"><h5>Essais</h5><Button type="button" variant="ghost" icon={Plus} disabled={current.experiments.length >= 20} onClick={addExperiment}>Ajouter un essai</Button></div>
        {!current.experiments.length && <p className="matchup-meta">Ajoute une approche à tester, puis associe les games et tes observations.</p>}
        {current.experiments.map((experiment, index) => <ExperimentEditor key={experiment.id} experiment={experiment} index={index} rows={group.rows} onChange={(value) => updateExperiment(experiment.id, value)} onRemove={() => {
          if ((experiment.title || experiment.plan || experiment.observation || experiment.conclusion || experiment.matchIds.length) && !window.confirm("Retirer cet essai du carnet ?")) return;
          draft.change({ ...current, experiments: current.experiments.filter((item) => item.id !== experiment.id) });
        }} />)}
      </fieldset>
      {draft.error && <div className="matchup-error" role="alert"><p>{draft.error}</p><div className="matchup-actions"><Button type="button" variant="ghost" icon={Copy} onClick={copy}>Copier mon brouillon</Button><Button type="button" variant="ghost" onClick={() => {
        if (!window.confirm("Recharger la version enregistrée ? Les modifications de ce brouillon seront abandonnées.")) return;
        draft.discard(); setEditing(false); onReload();
      }}>Recharger le carnet</Button></div>{copyMessage && <p role="status">{copyMessage}</p>}</div>}
      <div className="matchup-savebar"><p role="status">{draft.busy ? "Enregistrement…" : draft.dirty ? "Modifications non enregistrées · brouillon conservé pendant la navigation." : "Aucune modification."}</p><div className="matchup-actions"><Button type="button" variant="ghost" disabled={draft.busy} onClick={cancel}>Annuler</Button><Button type="submit" icon={draft.busy ? Loader2 : Save} disabled={draft.busy || !draft.dirty}>Enregistrer le carnet</Button></div></div>
    </form> : <>
      <dl className="matchup-plan">{PLAN_FIELDS.map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{current.plan[field] || "À renseigner."}</dd></div>)}</dl>
      <div className="matchup-section-heading"><h5>Essais et conclusions</h5><span className="matchup-meta">{current.experiments.length} essai{current.experiments.length > 1 ? "s" : ""}</span></div>
      {current.experiments.length ? current.experiments.map((experiment) => <details className="matchup-experiment" key={experiment.id}>
        <summary><strong>{experiment.title}</strong><Badge tone={experiment.status === "active" ? "purple" : "cyan"}>{EXPERIMENT_STATES[experiment.status]}</Badge><span className="matchup-meta">{experiment.matchIds.length} game{experiment.matchIds.length > 1 ? "s associées" : " associée"}</span></summary>
        <dl className="matchup-plan">{[["plan", "À tester"], ["observation", "Observations"], ["conclusion", "Conclusion du joueur et du staff"]].map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{experiment[key] || "À renseigner."}</dd></div>)}</dl>
        <LinkedGames ids={experiment.matchIds} rows={group.rows} navigate={navigate} />
      </details>) : <p className="matchup-meta">Aucun essai enregistré pour ce duel.</p>}
    </>}
  </section>;
}

function LinkedGames({ ids, rows, navigate }) {
  if (!ids.length) return <p className="matchup-meta">Aucune game associée.</p>;
  return <ul className="matchup-linked-games">{ids.map((id) => {
    const match = rows.find((row) => row.match?.id === id)?.match;
    const href = "/games?match=" + encodeURIComponent(id);
    return <li key={id}><a href={href} onClick={(event) => { if (navigate && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); navigate(href); } }}>{match ? matchDisplayName(match) : "Game hors du périmètre actuel"}<ArrowRight size={14} aria-hidden="true" /></a></li>;
  })}</ul>;
}

function ExperimentEditor({ experiment, index, rows, onChange, onRemove }) {
  const choices = new Map(rows.filter((row) => row.match?.id).map((row) => [row.match.id, matchDisplayName(row.match)]));
  experiment.matchIds.forEach((id) => { if (!choices.has(id)) choices.set(id, "Game hors de la catégorie actuelle"); });
  return <fieldset className="matchup-experiment-editor">
    <legend>Essai {index + 1}</legend>
    <div className="matchup-experiment-title"><TextInput label="Titre de l’essai" value={experiment.title} onChange={(title) => onChange({ title })} maxLength={120} required /><SelectInput label="État de l’essai" value={experiment.status} onChange={(status) => onChange({ status })}>{Object.entries(EXPERIMENT_STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</SelectInput></div>
    <TextAreaInput label="Ce qu’on veut tester" value={experiment.plan} onChange={(plan) => onChange({ plan })} rows={3} maxLength={2000} />
    <div className="matchup-experiment-texts"><TextAreaInput label="Observations du joueur" value={experiment.observation} onChange={(observation) => onChange({ observation })} rows={3} maxLength={2000} /><TextAreaInput label="Conclusion du joueur et du staff" value={experiment.conclusion} onChange={(conclusion) => onChange({ conclusion })} rows={3} maxLength={2000} /></div>
    <details className="matchup-game-picker"><summary>Associer des games <span>· {experiment.matchIds.length} sélectionnée{experiment.matchIds.length > 1 ? "s" : ""}</span></summary><p className="matchup-meta">Choisis les parties qui ont servi à cet essai, dans la catégorie actuelle. Les associations précédentes sont conservées.</p>
      {choices.size ? <div>{[...choices.entries()].map(([id, label]) => <label key={id}><input type="checkbox" checked={experiment.matchIds.includes(id)} disabled={!experiment.matchIds.includes(id) && experiment.matchIds.length >= 50} onChange={(event) => onChange({ matchIds: event.target.checked ? [...experiment.matchIds, id] : experiment.matchIds.filter((matchId) => matchId !== id) })} /><span>{label}</span></label>)}</div> : <p className="matchup-meta">Aucune game à associer dans cette catégorie.</p>}
    </details>
    <Button type="button" variant="ghost" icon={Trash2} onClick={onRemove}>Retirer cet essai</Button>
  </fieldset>;
}

function MatchupStatistics({ group, teamId, bootstrapRevision, renderGames }) {
  const [patch, setPatch] = useState("");
  const rows = group.rows.filter((row) => !patch || String(row.match?.patch || "") === patch);
  const patches = [...new Set(group.rows.map((row) => row.match?.patch).filter(Boolean))].sort((a, b) => b.localeCompare(a, "fr", { numeric: true }));
  const details = useMatchupStatRows(teamId, rows, bootstrapRevision);
  const stats = notebookStats(details.rows);
  return <section className="matchup-statistics">
    <div className="matchup-section-heading"><div><h5>Statistiques du duel</h5><p className="matchup-meta">Écart moyen du joueur avec l’adversaire au même poste. Chaque mesure indique ses games disponibles.</p></div><SelectInput label="Patch des statistiques" value={patch} onChange={setPatch}><option value="">Tous les patches</option>{patches.map((value) => <option key={value} value={value}>{value}</option>)}</SelectInput></div>
    <p>{rows.length} game{rows.length > 1 ? "s" : ""} · {stats.results.rate === null ? "Résultats indisponibles" : number(stats.results.rate) + " % de victoires"} <span className="matchup-meta">{stats.results.count} résultats connus · le résultat de la game ne mesure pas à lui seul le duel de lane.</span></p>
    {details.loading && <p className="matchup-notice" role="status">Chargement des relevés de lane… {details.loaded}/{details.total} games</p>}
    {details.error && <div className="matchup-error" role="alert"><p>{details.error} Les mesures disponibles restent affichées.</p><Button type="button" variant="ghost" onClick={details.retry}>Réessayer les statistiques</Button></div>}
    <div className="matchup-milestones">{stats.milestones.map((milestone) => <section key={milestone.minute}><h6>À {milestone.minute} minutes</h6><dl>{[["cs", "Écart de CS", " CS"], ["gold", "Écart d’or", " PO"], ["xp", "Écart d’expérience", " XP"]].map(([field, label, unit]) => {
      const metric = milestone[field];
      return <div key={field}><dt>{label}</dt><dd className={metric.value > 0 ? "matchup-positive" : metric.value < 0 ? "matchup-negative" : ""}>{signed(metric.value)}{metric.value === null ? "" : unit}<small>{metric.count}/{rows.length} games renseignées</small></dd></div>;
    })}</dl></section>)}</div>
    <p className="matchup-meta">« — » : donnée indisponible. Les relevés peuvent être décalés d’au plus une minute. Les swaps de lane restent à vérifier en review.</p>
    <section className="matchup-source-games"><h5>Games, runes et équipements</h5><p className="matchup-meta">Ouvre une game pour comparer les runes, les compétences et les achats des deux joueurs.</p>{renderGames?.(rows)}</section>
  </section>;
}
