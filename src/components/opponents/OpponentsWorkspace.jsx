import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ExternalLink, Loader2, Plus, RefreshCw, Shield, Swords } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { getLocale } from "../../i18n/locale.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { Badge, Button, EmptyState, PageHeader, SkeletonRows, Surface, TextAreaInput, TextInput } from "../ui/Core.jsx";
import { buildOpponentObservations } from "../../utils/opponent-observations.js";
import "./opponents-workspace.css";

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

function FrequencyList({ title, entries, coverage, total }) {
  return <section className="opponents-frequency"><h4>{title}</h4>
    <p className="opponents-help">{coverage === 1 ? t("1 partie exploitable sur {0}", [total]) : t("{0} parties exploitables sur {1}", [coverage, total])}</p>
    {entries.length ? <ul>{entries.slice(0, 8).map(({ champion, count, total: denominator }) => <li key={champion}>
      <span className="opponents-frequency-champion"><span aria-hidden="true"><ChampionPortrait champion={champion} className="h-8 w-8 rounded-md object-cover" /></span><span>{championDisplayName(champion)}</span></span><strong>{count} / {denominator}</strong>
    </li>)}</ul> : <p className="opponents-help">{t("Aucune donnée disponible.")}</p>}
  </section>;
}

function MatchHistory({ observations }) {
  return <section className="opponents-match-history">
    <h3>{t("Parties contre cet adversaire")}</h3>
    <ul>{observations.map((match) => {
      const date = new Date(match.date || NaN);
      return <li key={match.id}>
        <div className="opponents-match-heading"><div><h4>{match.label || match.gameId || t("Partie sans nom")}</h4>
          <p className="opponents-help">{Number.isFinite(date.getTime()) && <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(date)}</time>}{match.result && <span>{t("Résultat de notre équipe : {0}", [t(match.result)])}</span>}</p>
        </div><a className="opponents-source" href={`/games?match=${encodeURIComponent(match.id)}`}>{t("Ouvrir la partie")}<ArrowRight size={16} aria-hidden="true" /></a></div>
        <p className="opponents-pick-source">{t(match.pickSource === "match" ? "Champions joués" : match.pickSource === "draft" ? "Picks de la draft liée · champions joués non confirmés" : "Champions de la partie incomplets")}</p>
        <ChampionList champions={match.picks} />
      </li>;
    })}</ul>
  </section>;
}

function GroupHistory({ groups, teamId }) {
  if (!groups.length) return null;
  return <section className="opponents-group-history">
    <h3>{t("Groupes contre cet adversaire")}</h3>
    <ul>{groups.map((group) => <li key={group.id}>
      <div><h4>{group.name}</h4><p className="opponents-help">{t(group.matchIds.length === 1 ? "{0} partie dans ce groupe" : "{0} parties dans ce groupe", [group.matchIds.length])}</p></div>
      <a className="opponents-source" href={`/games?view=groups&archive=${encodeURIComponent(group.id)}&team=${encodeURIComponent(teamId)}`}>{t("Ouvrir le groupe")}<ArrowRight size={16} aria-hidden="true" /></a>
    </li>)}</ul>
  </section>;
}

function TeamOpponents({ teamId, opponentId = "" }) {
  const id = useId();
  const [collection, setCollection] = useState({ opponents: [], opponentMatches: [], opponentGroups: [], drafts: [], canEdit: false });
  const [loadState, setLoadState] = useState("loading");
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(opponentId);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const requests = useRef(new Set());
  const mutationRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => { setSelectedId(opponentId); }, [opponentId]);

  useEffect(() => {
    mounted.current = true;
    const pending = requests.current;
    return () => { mounted.current = false; for (const request of pending) request.abort(); pending.clear(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading"); setLoadError("");
    apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "list", teamId }), signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) {
        setCollection({ opponents: [], opponentMatches: [], opponentGroups: [], drafts: [], ...result });
        setSelectedId((current) => result.opponents.some((item) => item.id === current) ? current : "");
        setLoadState("ready");
      } })
      .catch((error) => { if (!controller.signal.aborted) { setLoadError(error.message || t("Impossible de charger les adversaires.")); setLoadState("error"); } });
    return () => controller.abort();
  }, [teamId, reload]);

  const selected = collection.opponents.find((opponent) => opponent.id === selectedId);
  const groups = collection.opponentGroups.filter((group) => group.opponentId === selectedId);
  const model = useMemo(() => buildOpponentObservations(selectedId, collection.opponentMatches, collection.drafts), [selectedId, collection.opponentMatches, collection.drafts]);
  const canEdit = loadState === "ready" && collection.canEdit;

  async function createOpponent(event) {
    event.preventDefault();
    if (!canEdit || !name.trim() || mutationRef.current) return;
    mutationRef.current = true;
    const controller = new AbortController(); requests.current.add(controller);
    setCreating(true); setCreateError(""); setNotice("");
    try {
      const { opponent } = await apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({ action: "create-opponent", teamId, name: name.trim(), notes: notes.trim() }), signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setCollection((current) => ({ ...current, opponents: [...current.opponents.filter((item) => item.id !== opponent.id), opponent] }));
      setSelectedId(opponent.id); setCreateOpen(false); setName(""); setNotes("");
      setNotice(t("Fiche adversaire créée."));
    } catch (error) { if (mounted.current && !controller.signal.aborted) setCreateError(error.message || t("Impossible de créer cet adversaire.")); }
    finally { requests.current.delete(controller); mutationRef.current = false; if (mounted.current) setCreating(false); }
  }

  return <>
    <div role="status" aria-live="polite" aria-atomic="true" className={notice ? "opponents-notice" : "sr-only"}>{notice && <Check size={18} aria-hidden="true" />}{notice}</div>
    {loadState === "loading" ? <Surface><p role="status">{t("Chargement des adversaires…")}</p><SkeletonRows count={3} /></Surface> : loadState === "error" ? <Surface><p role="alert">{t(loadError)}</p><Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setReload((value) => value + 1)}>{t("Réessayer")}</Button></Surface> : <div className="opponents-layout">
      <Surface className="opponents-directory">
        <div className="opponents-section-heading"><h2>{t("Fiches adversaires")}</h2><span>{collection.opponents.length}</span></div>
        <Button type="button" variant="ghost" icon={RefreshCw} disabled={creating} onClick={() => { setNotice(""); setReload((value) => value + 1); }}>{t("Actualiser")}</Button>
        {collection.opponents.length ? <ul className="opponents-list">{collection.opponents.map((opponent) => <li key={opponent.id}><button type="button" disabled={creating} aria-pressed={selectedId === opponent.id} onClick={() => { setSelectedId(opponent.id); setNotice(""); }}><Shield size={18} aria-hidden="true" /><span>{opponent.name}</span>{selectedId === opponent.id && <Check size={16} aria-hidden="true" />}</button></li>)}</ul> : <p className="opponents-muted">{t("Crée une fiche pour regrouper les parties d’un adversaire.")}</p>}
        {canEdit && <Button type="button" variant="ghost" icon={Plus} disabled={creating} aria-expanded={createOpen} aria-controls={`${id}-create`} onClick={() => setCreateOpen((open) => !open)}>{t("Ajouter un adversaire")}</Button>}
        {canEdit && createOpen && <form id={`${id}-create`} className="opponents-create" onSubmit={createOpponent}>
          <TextInput label={t("Nom de l’adversaire")} value={name} onChange={setName} maxLength={80} required disabled={creating} autoComplete="off" />
          <TextAreaInput label={t("Notes du staff (facultatif)")} value={notes} onChange={setNotes} maxLength={2000} rows={3} disabled={creating} />
          {createError && <p className="opponents-error" role="alert">{t(createError)}</p>}
          <Button type="submit" icon={creating ? Loader2 : Plus} disabled={creating || !name.trim()}>{t(creating ? "Création…" : "Créer la fiche")}</Button>
        </form>}
        {!canEdit && <p className="opponents-help">{t("Lecture seule : le staff peut créer les fiches adversaires.")}</p>}
      </Surface>
      <Surface className="opponents-dossier">
        {selected ? <>
          <div className="opponents-section-heading"><h2>{selected.name}</h2><Badge>{t(model.total === 1 ? "{0} partie rattachée" : "{0} parties rattachées", [model.total])}</Badge></div>
          {selected.notes && <p className="opponents-notes">{selected.notes}</p>}
          <GroupHistory groups={groups} teamId={teamId} />
          {model.total ? <>
            <div className="opponents-frequencies">
              <FrequencyList title={t("Champions joués")} entries={model.playedPicks} coverage={model.coverage.played} total={model.total} />
              <FrequencyList title={t("Bans des drafts liées")} entries={model.bans} coverage={model.coverage.bans} total={model.total} />
              {model.coverage.draft > 0 && <FrequencyList title={t("Picks de draft en complément")} entries={model.draftPicks} coverage={model.coverage.draft} total={model.total} />}
            </div>
            <p className="opponents-help">{t("Chaque partie compte une fois. Les champions joués proviennent de ses participants ; les picks d’une draft liée servent seulement si ces données sont incomplètes.")}</p>
            <p className="opponents-help">{t("Les fréquences de bans utilisent uniquement les drafts liées à ces parties avec leurs cinq bans renseignés ou explicitement non utilisés.")}</p>
            {model.coverage.unknown > 0 && <p className="opponents-help">{t("Champions incomplets pour {0} parties : ces parties sont exclues des fréquences de champions.", [model.coverage.unknown])}</p>}
            <MatchHistory observations={model.observations} />
          </> : <p className="opponents-muted">{t("Aucune partie rattachée à cet adversaire. Choisis cette équipe depuis une fiche de partie.")}</p>}
          <a className="opponents-source" href="/games">{t("Ouvrir les parties")}<ArrowRight size={16} aria-hidden="true" /></a>
        </> : <EmptyState icon={Swords} title={t("Un dossier pour chaque adversaire")} text={t("Sélectionne une fiche pour retrouver ses parties, ses champions observés et les notes du staff.")} />}
      </Surface>
    </div>}
  </>;
}

export function OpponentsWorkspace({ selectedTeamId, user, embedded = false, title, opponentId = "" }) {
  useLanguage();
  return <div className="opponents-workspace">
    {embedded ? <div className="opponents-intro"><h3>{title || t("Équipes adversaires")}</h3><p>{t("Prépare les prochaines rencontres à partir des parties de tes adversaires.")}</p></div> : <PageHeader title={title || t("Adversaires")} subtitle={t("Prépare les prochaines rencontres à partir des parties de tes adversaires.")} />}
    {selectedTeamId ? <TeamOpponents key={`${selectedTeamId}:${user?.id || ""}`} teamId={selectedTeamId} opponentId={opponentId} /> : <Surface><EmptyState icon={Shield} title={t("Choisis une équipe")} text={t("Les fiches adversaires et leurs parties appartiennent à l’équipe sélectionnée.")} /></Surface>}
  </div>;
}

export default OpponentsWorkspace;
