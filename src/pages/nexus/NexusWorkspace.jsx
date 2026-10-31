import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw, Unplug, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { Badge, Button, SelectInput, SkeletonRows, Surface } from "../../components/ui/Core.jsx";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { NexusSeasonManager } from "./NexusTournament.jsx";
import NexusScheduleEditor from "./NexusScheduleEditor.jsx";

const showStat = value => typeof value === "number" && Number.isFinite(value) ? value : "—";
const statusLabel = status => status === "accepted" ? t("Validé") : status === "rejected" ? t("Refusé") : t("À vérifier");
const statusTone = status => status === "accepted" ? "green" : status === "rejected" ? "red" : "yellow";
const displayDate = value => value ? new Date(value).toLocaleString(getLocale()) : t("À programmer");

export default function NexusWorkspace({ onSessionExpired, onNavigationState, request = apiFetch }) {
  useLanguage();
  const [data, setData] = useState({ fixtures: [], pairings: [], submissions: [], teams: [], seasons: [], registrations: [], standings: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [seasonDirty, setSeasonDirty] = useState(false);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [rosterRevision, setRosterRevision] = useState(0);
  const [captain, setCaptain] = useState("");
  const [pairingCode, setPairingCode] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [revokeId, setRevokeId] = useState("");
  const generation = useRef(0);
  const actionLock = useRef(false);
  const mounted = useRef(true);
  const fixture = data.fixtures.find(item => item.id === selectedId);
  const pairings = data.pairings.filter(item => item.fixtureId === selectedId);
  const submissions = data.submissions.filter(item => item.fixtureId === selectedId);
  const dirty = seasonDirty || scheduleDirty;
  const visibleFixtures = seasonId ? data.fixtures.filter(item => item.seasonId === seasonId) : data.fixtures;
  useEffect(() => { setSelectedId(current => visibleFixtures.some(item => item.id === current) ? current : visibleFixtures[0]?.id || ""); }, [seasonId, data.fixtures]);
  useEffect(() => {
    onNavigationState?.({ dirty, busy });
    return () => onNavigationState?.({ dirty: false, busy: false });
  }, [dirty, busy, onNavigationState]);

  const fail = issue => {
    if (!mounted.current) return;
    if (issue.status === 401 || issue.status === 403) onSessionExpired?.();
    else setError(issue.message || t("Chargement impossible. Réessaie."));
  };
  async function refresh(signal) {
    const next = await request("nexus-admin", { signal });
    if (!mounted.current || signal?.aborted) return;
    setData({ fixtures: next.fixtures || [], pairings: next.pairings || [], submissions: next.submissions || [], teams: next.teams || [], seasons: next.seasons || [], registrations: next.registrations || [], standings: next.standings || [] });
    setSeasonId(current => next.seasons?.some(item => item.id === current) ? current : next.seasons?.[0]?.id || "");
    setSelectedId(current => next.fixtures?.some(item => item.id === current) ? current : next.fixtures?.[0]?.id || "");
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    refresh(controller.signal).catch(issue => { if (!controller.signal.aborted) fail(issue); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); generation.current += 1; };
  }, []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, busy]);
  useEffect(() => {
    generation.current += 1;
    setDetail(null); setDetailLoading(false); setCaptain(""); setPairingCode(null); setRevokeId("");
  }, [selectedId]);

  async function action(body, onSuccess) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request("nexus-admin", { method: "POST", body: JSON.stringify(body) });
      if (!mounted.current) return;
      if (body.action === "refreshRegistrationRoster") setRosterRevision(value=>value+1);
      onSuccess?.(result);
      await refresh();
    } catch (issue) { fail(issue); }
    finally { actionLock.current = false; if (mounted.current) setBusy(false); }
  }
  async function openDetail(id) {
    const current = ++generation.current;
    setDetail(null); setDetailLoading(true); setError("");
    try {
      const result = await request(`nexus-admin?submissionId=${encodeURIComponent(id)}`);
      if (mounted.current && current === generation.current) setDetail(result.submission);
    } catch (issue) { if (current === generation.current) fail(issue); }
    finally { if (mounted.current && current === generation.current) setDetailLoading(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(pairingCode.code); setNotice(t("Code copié.")); }
    catch { setError(t("Copie le code manuellement depuis le champ.")); }
  }

  return <div className="nexus-workspace">
    <div className="nexus-workspace-title"><div><p className="nexus-eyebrow">{t("Espace staff")}</p><h1 translate="no">Nexus Rising</h1><p>{t("Prépare les rencontres et vérifie les statistiques reçues par l’importeur.")}</p></div><div className="nexus-actions"><Button variant="ghost" icon={RefreshCw} disabled={loading || busy || dirty} onClick={() => { setLoading(true); setError(""); refresh().catch(fail).finally(() => { if (mounted.current) setLoading(false); }); }}>{t("Actualiser")}</Button></div></div>
    {error && <div className="nexus-message nexus-error" role="alert">{error}</div>}
    {notice && <div className="nexus-message" role="status">{notice}</div>}
    <NexusSeasonManager data={data} seasonId={seasonId} setSeasonId={setSeasonId} busy={busy || scheduleDirty} action={action} onDirtyChange={setSeasonDirty} />
    {loading && <div role="status" aria-label={t("Chargement des rencontres")}><SkeletonRows count={3} /></div>}
    {!!visibleFixtures.length && <div className="nexus-layout"><aside className="nexus-fixtures" aria-label={t("Rencontres")}><h2>{t("Rencontres")}</h2>{visibleFixtures.map(item => <button type="button" key={item.id} className="nexus-fixture" aria-pressed={selectedId === item.id} disabled={busy || seasonDirty || scheduleDirty} onClick={() => setSelectedId(item.id)}><strong>{item.label}</strong><span>{item.teamA} · {item.teamB}</span><small>{displayDate(item.startsAt)}</small></button>)}</aside>
      {fixture && <div className="nexus-fixture-detail"><Surface variant="reading" className="nexus-card"><div className="nexus-section-title"><div><h2>{fixture.label}</h2><p>{fixture.teamA} · {fixture.teamB}</p></div><Badge tone="cyan">EUW</Badge></div><p className="nexus-muted">{displayDate(fixture.startsAt)} → {displayDate(fixture.endsAt)}</p>
        {fixture.seasonId && fixture.teamAId && fixture.teamBId && <NexusScheduleEditor key={fixture.id} fixture={fixture} refreshToken={rosterRevision} request={request} busy={busy || seasonDirty} action={action} onDirtyChange={setScheduleDirty} onAccessLost={onSessionExpired} onSaved={() => { setPairingCode(null); setCaptain(""); setNotice(t("Programmation enregistrée.")); }} />}
        <details className="nexus-roster"><summary>{t("Voir les dix joueurs autorisés")}</summary><div className="nexus-form-grid"><div><h3>{fixture.teamA}</h3><ul>{(fixture.roster || []).slice(0, 5).map(id => <li key={id}>{id}</li>)}</ul></div><div><h3>{fixture.teamB}</h3><ul>{(fixture.roster || []).slice(5).map(id => <li key={id}>{id}</li>)}</ul></div></div></details>
        <div className="nexus-pairing-form"><SelectInput label={t("Joueur équipé de l’importeur")} value={captain} onChange={setCaptain} disabled={busy || seasonDirty}><option value="">{t("Choisir un joueur")}</option>{(fixture.roster || []).map(id => <option key={id} value={id}>{id}</option>)}</SelectInput><Button variant="ghost" disabled={!captain || busy || seasonDirty || (fixture.roster || []).length !== 10 || fixture.rosterReady === false} onClick={() => action({ action: "createPairing", fixtureId: fixture.id, uploaderRiotId: captain }, result => setPairingCode({ ...result, captain }))}>{t("Créer un code de liaison")}</Button></div>
        {pairingCode && <div className="nexus-code" role="status"><strong>{t("Code de liaison pour {0}", [pairingCode.captain])}</strong><p>{t("À saisir dans NXT5 Importer. Ce code est affiché une seule fois ; partage-le uniquement avec ce joueur.")}</p><div className="nexus-code-copy"><input readOnly value={pairingCode.code} aria-label={t("Code de liaison")} autoComplete="off" spellCheck={false} /><Button variant="ghost" icon={Copy} onClick={copyCode}>{t("Copier")}</Button></div><small>{t("Valable jusqu’au {0}", [displayDate(pairingCode.expiresAt)])}</small><Button variant="ghost" onClick={() => setPairingCode(null)}>{t("Masquer le code")}</Button></div>}
        {!!pairings.length && <ul className="nexus-pairings">{pairings.map(pair => <li key={pair.id}><div><strong>{pair.uploaderRiotId}</strong><small>{pair.revokedAt ? t("Liaison révoquée") : pair.connectedAt ? t("Importeur lié") : t("En attente de connexion")}</small></div>{!pair.revokedAt && (revokeId === pair.id ? <div className="nexus-revoke"><p>{t("La révocation arrête les prochains envois. Les statistiques déjà reçues restent disponibles.")}</p><Button variant="danger" disabled={busy || seasonDirty} onClick={() => action({ action: "revokePairing", pairingId: pair.id }, () => { setRevokeId(""); setNotice(t("Liaison révoquée.")); })}>{t("Confirmer la révocation")}</Button><Button variant="ghost" disabled={busy || seasonDirty} onClick={() => setRevokeId("")}>{t("Annuler")}</Button></div> : <Button variant="ghost" icon={Unplug} disabled={busy || seasonDirty} onClick={() => setRevokeId(pair.id)}>{t("Révoquer")}</Button>)}</li>)}</ul>}
      </Surface>
      <Surface variant="reading" className="nexus-card"><h2>{t("Parties reçues")}</h2><p className="nexus-muted">{t("Après validation, le résultat devient public et les statistiques sont accessibles aux membres des équipes concernées.")}</p>{!submissions.length ? <p className="nexus-empty-copy">{t("Aucune partie reçue pour cette rencontre.")}</p> : <ul className="nexus-submissions">{submissions.map(item => <li key={item.id}><div><strong>{item.gameId}</strong><span>{item.uploaderRiotId} · {displayDate(item.createdAt)}</span></div><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge><Button variant="ghost" disabled={busy || seasonDirty || detailLoading} onClick={() => openDetail(item.id)}>{t("Examiner")}</Button></li>)}</ul>}
      </Surface>
      {detailLoading && <div role="status" aria-label={t("Chargement des statistiques")}><SkeletonRows count={2} /></div>}
      {detail && <Surface variant="reading" className="nexus-card"><div className="nexus-section-title"><div><h2>{detail.gameId}</h2><p>{detail.uploaderRiotId}</p></div><Badge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</Badge></div><p className="nexus-muted">{t("Données envoyées par le client du joueur, à comparer aux preuves de la rencontre. Une valeur absente est affichée par un tiret.")}</p><div className="nexus-stats" role="region" aria-label={t("Statistiques de la partie")} tabIndex={0}><table><thead><tr>{["Joueur", "Champion", "K / D / A", "CS", "Gold", "Dégâts", "Vision"].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{(detail.payload?.match?.info?.participants || []).map((player, index) => <tr key={player.participantId || index}><th scope="row">{player.riotIdGameName ? `${player.riotIdGameName}${player.riotIdTagline ? `#${player.riotIdTagline}` : ""}` : player.summonerName || "—"}</th><td>{player.championName || "—"}</td><td>{showStat(player.kills)} / {showStat(player.deaths)} / {showStat(player.assists)}</td><td>{typeof player.totalMinionsKilled === "number" && typeof player.neutralMinionsKilled === "number" ? player.totalMinionsKilled + player.neutralMinionsKilled : "—"}</td><td>{showStat(player.goldEarned)}</td><td>{showStat(player.totalDamageDealtToChampions)}</td><td>{showStat(player.visionScore)}</td></tr>)}</tbody></table></div><p className="nexus-muted">{t(detail.payload?.timeline ? "Chronologie disponible." : "Chronologie indisponible pour cette contribution.")}</p>{detail.status === "pending_review" && <div className="nexus-actions"><Button icon={Check} disabled={busy || seasonDirty} onClick={() => action({ action: "review", submissionId: detail.id, status: "accepted" }, result => setDetail(previous => ({ ...previous, ...result.submission })))}>{t("Valider la contribution")}</Button><Button icon={X} variant="danger" disabled={busy || seasonDirty} onClick={() => action({ action: "review", submissionId: detail.id, status: "rejected" }, result => setDetail(previous => ({ ...previous, ...result.submission })))}>{t("Refuser la contribution")}</Button></div>}</Surface>}
      </div>}
    </div>}
  </div>;
}
