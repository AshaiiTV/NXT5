import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Clock3, Copy, Eye, Flag, Layers3, Link2, Maximize2, Minimize2, PencilLine, Swords, Trash2, Volume2, VolumeX } from "lucide-react";
import { getLocale } from "../../i18n/locale.js";
import { ChampionPortrait } from "../../pages/workspace/workspace-shared.jsx";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import { matchDisplayName } from "../../utils/matches.js";
import { Nxt5Wordmark } from "../brand/BrandAssets.jsx";
import { camp, DraftArena } from "./DraftArena.jsx";
import { useDraftVoices } from "./useDraftVoices.js";
import { draftTurns } from "../../../shared/draft-order.js";
import { championDisplayName } from "../../../shared/champions.js";
import "./live-draft-room.css";


export const roomRequest = (body, signal) => apiFetch("draft-rooms", { method: "POST", body: JSON.stringify(body), signal });
const isRoomId = id => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || "");
const gameLabel = (n,length) => t("Partie {0} sur {1}",[n,length]);
function SideSelect({label,value,onChange}) {
  return <SelectInput {...{label,value,onChange}}><option value="blue">{camp("blue")}</option><option value="red">{camp("red")}</option></SelectInput>;
}

function RoomInvitation({ room, spectator = false }) {
  const [copied,setCopied] = useState(false), [fallback,setFallback] = useState(false);
  const label = spectator ? t("Copier le lien spectateur") : t("Copier le lien adverse");
  const link = new URL("/salle-de-draft", window.location.origin);
  link.searchParams.set("room", room.id);
  link.hash = spectator ? room.spectatorInvite : room.invite;
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false),2000);
    return () => clearTimeout(timer);
  },[copied]);
  async function copy() {
    try { await navigator.clipboard.writeText(link.href); setCopied(true); }
    catch { setFallback(true); }
  }
  return <div className="live-invite"><button type="button" className="live-tool" onClick={copy}>{copied ? <Check /> : spectator ? <Eye /> : <Copy />}{copied ? t("Lien copié") : label}</button>
    {fallback && <input className="live-share-url" aria-label={label} value={link.href} readOnly onFocus={e => e.target.select()} />}</div>;
}

function RoomFinish({room,teamId,matches,pending,mutate,live,onCorrect,editButton}) {
  const [matchId,setMatchId] = useState(""), [side,setSide] = useState(room.side || "blue"), [firstPick,setFirstPick] = useState("blue");
  return <div className="live-finish">
    {room.invite && <div><Button ref={editButton} type="button" variant="ghost" icon={PencilLine} disabled={pending} onClick={onCorrect}>{t("Corriger la draft")}</Button></div>}
    {live && room.gameNumber < room.seriesLength && (room.invite ? <div className="live-next"><h3>{gameLabel(room.gameNumber+1,room.seriesLength)}</h3>
      <div className="live-create-fields"><SideSelect label={t("Notre côté")} value={side} onChange={setSide} />
      <SideSelect label={t("Premier choix")} value={firstPick} onChange={setFirstPick} /></div>
      <Button type="button" icon={Swords} disabled={pending} onClick={() => mutate("next",{side,firstPick})}>{t("Lancer la partie suivante")}</Button>
    </div> : <p role="status">{t("En attente de la prochaine partie.")}</p>)}
    {teamId && <div className="live-link"><a href={`/tendances?rubrique=drafts&draft=${room.gameId}`}>{t("Analyser la draft")}</a>
      {room.matchId ? <a href={`/games?match=${room.matchId}`}>{t("Voir la partie liée")}</a> : room.invite && matches.length > 0 && <>
        <SelectInput label={t("Partie jouée")} value={matchId} onChange={setMatchId}><option value="">{t("Choisir une partie")}</option>{matches.map(m => <option key={m.id} value={m.id}>{matchDisplayName(m)} · {m.game_id}</option>)}</SelectInput>
        <Button disabled={pending || !matchId} onClick={() => mutate("link", {matchId})}>{t("Associer à la partie")}</Button></>}
    </div>}
  </div>;
}

function RoomSession({ roomId, teamId, invite, matches = [], pinned, onPin, onBack }) {
  useLanguage();
  const [room,setRoom] = useState(null), [loadError,setLoadError] = useState(""), [actionError,setActionError] = useState("");
  const [pending,setPending] = useState(false), [recent,setRecent] = useState(-1), [full,setFull] = useState(false);
  const [correction,setCorrection] = useState(null), editButton = useRef(null);
  const inFlight = useRef(false), latest = useRef(null), frame = useRef(null), mounted = useRef(true);
  const { active: voicesActive, toggleButton, toggle: toggleVoices, playConfirmed, prepareVoice } = useDraftVoices(!pinned);
  const request = useCallback((action, fields = {}, signal) => roomRequest({ action, roomId, ...(invite === undefined ? {teamId} : {invite}),
    ...(pinned ? {gameNumber:pinned} : {}), ...fields }, signal), [roomId,teamId,invite,pinned]);
  const accept = useCallback(next => {
    if (!mounted.current) return;
    const prev = latest.current;
    if (prev?.gameNumber === next.gameNumber && prev.turnStartedAt && !next.turnStartedAt) return;
    if (prev && (prev.gameNumber > next.gameNumber || prev.gameNumber === next.gameNumber &&
      (prev.moves.length > next.moves.length || prev.matchId && !next.matchId && prev.moves.length === next.moves.length))) return;
    // Polling spectators shouldn't repaint the champion catalogue between turns.
    // A correction keeps the move count but changes its content, so compare the board itself.
    if (prev && prev.gameId === next.gameId && JSON.stringify(prev.moves) === JSON.stringify(next.moves) && prev.latestGame === next.latestGame
      && prev.side === next.side && prev.invite === next.invite && prev.matchId === next.matchId && prev.turnStartedAt === next.turnStartedAt
      && (!next.turnSeconds || Math.abs(next.serverTime-prev.serverTime) < 30000)) return;
    if (prev?.gameNumber !== next.gameNumber) setRecent(-1);
    else if (prev.moves.length < next.moves.length) setRecent(next.moves.length-1);
    latest.current = next; setRoom(next);
    playConfirmed(prev, next);
  }, [playConfirmed]);
  const finished = room?.moves.length === 20 && (Boolean(pinned) || room.gameNumber === room.seriesLength);
  const correcting = Boolean(correction);
  // A correction belongs to the game it was opened on; drop it if the session moves to another game.
  useEffect(() => { if (correction && room?.gameId !== correction.gameId) setCorrection(null); }, [room?.gameId, correction]);
  useEffect(() => {
    mounted.current = true;
    const change = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange",change);
    return () => { mounted.current = false; document.removeEventListener("fullscreenchange",change); };
  },[]);
  useEffect(() => {
    if (finished || correcting) return;
    let active = true, timer;
    const controller = new AbortController();
    async function poll() {
      let again = true;
      try {
        const {room:updated} = await request("read", {}, controller.signal);
        if (active) { accept(updated); setLoadError(""); }
      } catch (err) {
        if (active) setLoadError(err.message);
        again = ![400,401,403,404].includes(err.status);
      }
      if (active && again) timer = setTimeout(poll, document.hidden ? 8000 : 1400);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [request, accept, finished, correcting]);
  async function mutate(action, fields) {
    if (inFlight.current || !room) return false;
    inFlight.current = true; setPending(true); setActionError("");
    try { const result = await request(action, {gameNumber:room.gameNumber, ...fields}); accept(result.room); setLoadError(""); return true; }
    catch (err) {
      setActionError(err.message);
      try { accept((await request("read")).room); } catch { /* Polling retries. */ }
      return false;
    } finally { inFlight.current = false; setPending(false); }
  }
  function closeCorrection() {
    setCorrection(null);
    globalThis.requestAnimationFrame?.(() => editButton.current?.focus());
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await frame.current.requestFullscreen(); }
    catch { setActionError(t("Le plein écran est indisponible.")); }
  }
  const Heading = invite === undefined ? "h2" : "h1";
  return <div ref={frame} className="live-room live-session">
    <div className="live-session-top">
      <div className="live-heading"><div className="live-session-name">{invite !== undefined && <Nxt5Wordmark className="live-wordmark" sizes="72px" loading="eager" />}{onBack && <button type="button" className="live-back" onClick={onBack}><ArrowLeft size={16} />{t("Toutes les salles")}</button>}
        <Heading>{t("Salle de draft")}</Heading></div><div className="live-actions">
        {room?.invite && <><RoomInvitation room={room} /><RoomInvitation room={room} spectator /></>}
        <div className="live-room-controls">
          {room && !pinned && <button type="button" className="live-tool live-voice-toggle" ref={toggleButton}
            aria-label={t("Voix des champions")} aria-pressed={voicesActive} onClick={toggleVoices}
            title={voicesActive ? t("Couper les voix des champions") : t("Activer les voix des champions")}>
            {voicesActive ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
          </button>}
          {typeof document !== "undefined" && document.fullscreenEnabled && <button type="button" className="live-tool" onClick={fullscreen} aria-label={full ? t("Quitter le plein écran") : t("Plein écran")} title={full ? t("Quitter le plein écran") : t("Plein écran")}>{full ? <Minimize2 /> : <Maximize2 />}</button>}
        </div>
      </div></div>
      {room && <div className="live-series"><span>{room.mode === "fearless" ? t("Fearless") : t("Standard")}</span>
        <strong>{gameLabel(room.gameNumber,room.seriesLength)}</strong>
        {room.side ? <span>{camp(room.side)}</span> : <span><Eye size={14}/>{t("Spectateur")}</span>}
        {room.latestGame > 1 && <select aria-label={t("Partie de la série")} value={pinned || ""} onChange={e => onPin(Number(e.target.value) || null)}>
          <option value="">{t("En direct")}</option>{Array.from({length:room.latestGame},(_,i) => <option key={i} value={i+1}>{gameLabel(i+1,room.seriesLength)}</option>)}</select>}
        {pinned && <button type="button" onClick={() => onPin(null)}>{t("Revenir au direct")}</button>}
      </div>}
    </div>
    {loadError && <p role="alert">{t(loadError)}</p>}
    {!room && !loadError && <p role="status">{t("Chargement…")}</p>}
    {room && <React.Fragment key={room.gameId}>
      {actionError && <p role="alert">{t(actionError)}</p>}
      <DraftArena room={room} recent={recent} pending={pending} onPrepareVoice={prepareVoice} onStart={() => mutate("start",{})} onMove={champion => mutate("move",{step:room.moves.length,champion})}
        edit={correction && {...correction, onSelect: selected => setCorrection(c => ({...c, selected})),
          onChoose: champion => setCorrection(c => ({...c, moves: c.moves.map((id,i) => i === c.selected ? champion : id)})),
          onCancel: closeCorrection, onSave: async () => { if (await mutate("correct",{moves:correction.moves,expected:correction.base})) closeCorrection(); }}} />
      {room.moves.length === 20 && !correction && <RoomFinish {...{room,teamId,matches,pending,mutate,editButton}} live={!pinned}
        onCorrect={() => { setActionError(""); setCorrection({gameId:room.gameId, base:[...room.moves], moves:[...room.moves], selected:0}); }} />}
    </React.Fragment>}
  </div>;
}

export function LiveDraftRoom({initialGame,...props}) {
  const [pinned,setPinned] = useState(initialGame || null);
  return <RoomSession key={pinned || "live"} {...props} pinned={pinned} onPin={setPinned} />;
}

export function GuestDraftRoom() {
  const id = new URLSearchParams(window.location.search).get("room");
  const invite = window.location.hash.slice(1);
  return <main className="live-guest"><Surface>{isRoomId(id) && /^(watch\.)?[A-Za-z0-9_-]{43}$/.test(invite)
    ? <LiveDraftRoom key={id + invite} roomId={id} invite={invite} /> : <p role="alert">{t("Salle introuvable ou invitation invalide.")}</p>}</Surface></main>;
}


function DraftSetting({label, name, options, value, onChange}) {
  return <fieldset className="live-setting">
    <legend>{label}</legend>
    <div className="live-segments">{options.map(option =>
      <label key={option.value} data-side={option.side} data-selected={value === option.value}>
        <input type="radio" name={name} checked={value === option.value} value={option.value} onChange={() => onChange(option.value)} />
        {option.side && <i aria-hidden="true" />}{option.label}
      </label>)}</div>
  </fieldset>;
}

function roomPicks(r) {
  const moves = Array.isArray(r.moves) ? r.moves : [], picks = {blue:[],red:[]};
  draftTurns(r.first_pick || "blue").forEach(([kind,side],i) => { if (kind === "pick") picks[side].push(moves[i]); });
  return picks;
}
function roomDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(getLocale(), {day:"numeric", month:"short"});
}

export function RecentRoom({ room: r, editable, deleting, onDelete, navigate }) {
  const label = `${r.blue_name} · ${r.red_name}`, picks = roomPicks(r), href = `/draft/salle?room=${r.id}`;
  const state = r.step === 20 ? "done" : r.step > 0 ? "live" : "idle";
  const status = state === "done" ? (r.game_number < r.series_length ? t("Partie terminée") : t("Draft terminée")) : state === "live" ? t("En cours") : t("À démarrer");
  const names = side => picks[side].filter(Boolean).map(championDisplayName).join(", ") || t("aucun pick");
  const follow = event => {
    if (!navigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(href);
  };
  return <li className="live-room-row" data-state={state}>
    <a className="live-row-open" href={href} onClick={follow} aria-label={t("Ouvrir la salle {0}",[label])}>
      <span className="live-row-teams">{["blue","red"].map(side => <span key={side} className="live-row-team" data-side={side}>
        <i aria-hidden="true" /><b>{side === "blue" ? r.blue_name : r.red_name}</b>{r.ally_side === side && <small>{t("Nous")}</small>}</span>)}</span>
    </a>
    <div className="live-row-picks" role="img" aria-label={t("Picks : {0} — {1} ; {2} — {3}",[r.blue_name,names("blue"),r.red_name,names("red")])}>
      {["blue","red"].map(side => <span key={side} data-side={side}>{picks[side].map((c,i) =>
        <span key={i} className="live-row-pick" data-empty={!c || undefined}>{c && <ChampionPortrait champion={c} alt="" />}</span>)}</span>)}
    </div>
    <div className="live-row-meta">
      <span className="live-row-status" data-state={state}>{state === "done" ? <Check aria-hidden="true" /> : <span aria-hidden="true" className="live-row-dot" />}{status}</span>
      <span className="live-row-progress" role="progressbar" aria-label={t("Avancement de la partie")} aria-valuemin={0} aria-valuemax={20} aria-valuenow={r.step}
        aria-valuetext={t("{0} choix sur 20",[r.step])}><span style={{width:`${r.step*5}%`}} /></span>
      <small>{[r.series_length > 1 ? gameLabel(r.game_number,r.series_length) : t("1 partie"), r.mode === "fearless" ? t("Fearless") : t("Standard"), roomDate(r.created_at)].filter(Boolean).join(" · ")}</small>
      {r.linked > 0 && <small className="live-row-linked"><Link2 aria-hidden="true" />{r.linked > 1 ? t("{0} parties liées",[r.linked]) : t("1 partie liée")}</small>}
    </div>
    <div className="live-row-actions">
      <ArrowUpRight aria-hidden="true" className="live-row-arrow" />
      {editable && <button type="button" className="live-tool live-delete" disabled={Boolean(deleting)} aria-busy={deleting === r.id}
        aria-label={t("Supprimer la salle {0}",[label])} title={t("Supprimer la salle")} onClick={() => onDelete(r)}><Trash2 aria-hidden="true" /></button>}
    </div>
  </li>;
}

export function DraftRoomWorkspace({ teamId, teamName, matches, route, navigate }) {
  useLanguage();
  const id = new URLSearchParams(route.search).get("room");
  const [rooms,setRooms] = useState([]), [editable,setEditable] = useState(null), [error,setError] = useState("");
  const [name,setName] = useState(""), [side,setSide] = useState("blue"), [busy,setBusy] = useState(false), [reload,setReload] = useState(0);
  const [seriesLength,setSeriesLength] = useState("1"), [mode,setMode] = useState("standard"), [firstPick,setFirstPick] = useState("blue");
  const [turnSeconds,setTurnSeconds] = useState("0"), [deleting,setDeleting] = useState(null), [notice,setNotice] = useState("");
  const creation = useRef(null), listHeading = useRef(null), noticeRef = useRef(null);
  useEffect(() => {
    if (!teamId || id) return;
    const controller = new AbortController();
    setError(""); setEditable(null);
    roomRequest({action:"list", teamId}, controller.signal).then(data => {
      if (!controller.signal.aborted) { setRooms(data.rooms); setEditable(data.canEdit); }
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [teamId,id,reload]);
  const open = roomId => navigate("/draft/salle?room=" + encodeURIComponent(roomId));
  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const fields = JSON.stringify([side,name,seriesLength,mode,firstPick,turnSeconds]);
    if (creation.current?.fields !== fields) creation.current = {fields, key:crypto.randomUUID()};
    try {
      const {room} = await roomRequest({action:"create", teamId, side, opponent:name, seriesLength:Number(seriesLength), mode, firstPick, turnSeconds:Number(turnSeconds), creationKey:creation.current.key});
      creation.current = null; open(room.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove(r) {
    if (deleting) return;
    const label = `${r.blue_name} · ${r.red_name}`;
    const games = r.game_number > 1 ? t("Les {0} parties de la série seront supprimées.",[r.game_number]) : "";
    const linked = r.linked > 0 ? t("{0} partie(s) jouée(s) ne seront plus associées à cette draft.",[r.linked]) : "";
    if (!window.confirm([t("Supprimer la salle « {0} » ?",[label]), games, linked, t("Ses picks et bans disparaîtront aussi des analyses. Cette action est définitive.")].filter(Boolean).join("\n\n"))) return;
    setDeleting(r.id); setError(""); setNotice("");
    try {
      await roomRequest({action:"delete", teamId, roomId:r.id});
      setRooms(list => list.filter(x => x.id !== r.id));
      setNotice(t("Salle « {0} » supprimée.",[label]));
      globalThis.requestAnimationFrame?.(() => (listHeading.current || noticeRef.current)?.focus());
    } catch (err) { setError(err.message); } finally { setDeleting(null); }
  }
  if (!teamId) return <Surface><p>{t("Sélectionne une équipe.")}</p></Surface>;
  if (id) return <Surface><LiveDraftRoom key={id+route.search} roomId={id} initialGame={Number(new URLSearchParams(route.search).get("game"))} teamId={teamId} matches={matches} onBack={() => navigate("/draft/salle")} /></Surface>;
  const sides = ["blue","red"].map(value => ({value,side:value,label:value === "blue" ? t("Bleu") : t("Rouge")}));
  const ally = teamName || t("Notre équipe"), opponent = name.trim() || t("Adversaire");
  const format = mode === "standard" ? t("Standard") : t("Fearless");
  return <Surface className="live-lobby-surface"><div className="live-room live-lobby">
    {error && <p role="alert">{t(error)} <button type="button" onClick={() => setReload(n => n+1)}>{t("Réessayer")}</button></p>}
    <div className="live-match-sheet" data-editable={Boolean(editable)}>
      <header className="live-poster">
        <h2>{t("Salle de draft")}</h2>
        {editable && <div className="live-poster-match">
          <div className="live-matchup">{["blue","red"].map(c => <div key={c} data-side={c}>
            <span>{camp(c)}{firstPick === c && <small><Flag size={12} aria-hidden="true"/>{t("Premier choix")}</small>}</span>
            <strong data-placeholder={side !== c && !name.trim()}>{side === c ? ally : opponent}</strong>
          </div>)}</div>
          <div className="live-match-rules"><span><Layers3/>{seriesLength === "1" ? t("1 partie") : t("{0} parties",[seriesLength])}</span>
            <span><Swords/>{format}</span><span><Clock3/>{turnSeconds === "0" ? t("Libre") : turnSeconds + " s"}</span></div>
        </div>}
      </header>
      {editable === null && !error && <p role="status">{t("Chargement…")}</p>}
      {editable && <form onSubmit={create} className="live-create">
        <div className="live-create-intro"><h3>{t("Configuration")}</h3><p>{t("Choisis ton côté et invite le capitaine adverse.")}</p></div>
        <TextInput label={t("Adversaire (facultatif)")} value={name} onChange={setName} maxLength={80} />
        <div className="live-setting-pair">
          <DraftSetting label={t("Notre côté")} name="side" value={side} onChange={setSide} options={sides} />
          <DraftSetting label={t("Premier choix")} name="first" value={firstPick} onChange={setFirstPick} options={sides} />
        </div>
        <div className="live-setting-pair">
          <DraftSetting label={t("Nombre de parties")} name="games" value={seriesLength} onChange={setSeriesLength} options={["1","2","3","4","5"].map(value => ({value,label:value}))} />
          <DraftSetting label={t("Temps de réflexion par tour")} name="timer" value={turnSeconds} onChange={setTurnSeconds} options={["0","30","60"].map(value => ({value,label:value === "0" ? t("Libre") : value + " s"}))} />
        </div>
        {turnSeconds !== "0" && <p className="live-setting-help">{t("Le chrono démarre quand l’adversaire est prêt. Chaque capitaine confirme son choix, même en prolongation.")}</p>}
        <div><DraftSetting label={t("Format de draft")} name="draft-mode" value={mode} onChange={setMode} options={[{value:"standard",label:t("Standard")},{value:"fearless",label:t("Fearless")}]} />
          <p className="live-setting-help">{mode === "standard" ? t("Tous les champions reviennent à chaque partie.") : t("Un champion joué est bloqué pour les deux camps jusqu’à la fin de la série.")}</p>
        </div>
        <Button type="submit" disabled={busy} icon={Swords}>{t("Créer la salle")}</Button>
      </form>}
    </div>
    {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="live-history-notice">{notice}</p>}
    {rooms.length > 0 && <section className="live-history-section" aria-labelledby="live-history-title">
      <header className="live-history-head"><h3 id="live-history-title" ref={listHeading} tabIndex={-1}>{t("Salles récentes")}</h3>
        <span>{rooms.length > 1 ? t("{0} salles",[rooms.length]) : t("1 salle")}</span></header>
      <ul className="live-history">{rooms.map(r => <RecentRoom key={r.id} room={r} editable={editable} deleting={deleting} onDelete={remove} navigate={navigate} />)}</ul>
    </section>}
    {editable === false && !rooms.length && <p>{t("Aucune salle de draft pour cette équipe.")}</p>}
  </div></Surface>;
}
