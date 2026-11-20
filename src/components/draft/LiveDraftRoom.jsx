import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Eye, Maximize2, Minimize2, Swords } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import { matchDisplayName } from "../../utils/matches.js";
import { camp, DraftArena } from "./DraftArena.jsx";
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

function RoomFinish({room,teamId,matches,pending,mutate,live}) {
  const [matchId,setMatchId] = useState(""), [side,setSide] = useState(room.side || "blue"), [firstPick,setFirstPick] = useState("blue");
  return <div className="live-finish">
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
  const inFlight = useRef(false), latest = useRef(null), frame = useRef(null), mounted = useRef(true);
  const request = useCallback((action, fields = {}, signal) => roomRequest({ action, roomId, ...(invite === undefined ? {teamId} : {invite}),
    ...(pinned ? {gameNumber:pinned} : {}), ...fields }, signal), [roomId,teamId,invite,pinned]);
  const accept = useCallback(next => {
    if (!mounted.current) return;
    const prev = latest.current;
    if (prev?.gameNumber === next.gameNumber && prev.turnStartedAt && !next.turnStartedAt) return;
    if (prev && (prev.gameNumber > next.gameNumber || prev.gameNumber === next.gameNumber &&
      (prev.moves.length > next.moves.length || prev.matchId && !next.matchId && prev.moves.length === next.moves.length))) return;
    // Polling spectators shouldn't repaint the champion catalogue between turns.
    if (prev && prev.gameId === next.gameId && prev.moves.length === next.moves.length && prev.latestGame === next.latestGame
      && prev.side === next.side && prev.invite === next.invite && prev.matchId === next.matchId && prev.turnStartedAt === next.turnStartedAt
      && (!next.turnSeconds || Math.abs(next.serverTime-prev.serverTime) < 30000)) return;
    if (prev?.gameNumber !== next.gameNumber) setRecent(-1);
    else if (prev.moves.length < next.moves.length) setRecent(next.moves.length-1);
    latest.current = next; setRoom(next);
  }, []);
  const finished = room?.moves.length === 20 && (Boolean(pinned) || room.gameNumber === room.seriesLength);
  useEffect(() => {
    mounted.current = true;
    const change = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange",change);
    return () => { mounted.current = false; document.removeEventListener("fullscreenchange",change); };
  },[]);
  useEffect(() => {
    if (finished) return;
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
  }, [request, accept, finished]);
  async function mutate(action, fields) {
    if (inFlight.current || !room) return;
    inFlight.current = true; setPending(true); setActionError("");
    try { const result = await request(action, {gameNumber:room.gameNumber, ...fields}); accept(result.room); setLoadError(""); }
    catch (err) {
      setActionError(err.message);
      try { accept((await request("read")).room); } catch { /* Polling retries. */ }
    } finally { inFlight.current = false; setPending(false); }
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await frame.current.requestFullscreen(); }
    catch { setActionError(t("Le plein écran est indisponible.")); }
  }
  const Heading = invite === undefined ? "h2" : "h1";
  return <div ref={frame} className="live-room live-session">
    <div className="live-heading"><div>{onBack && <button type="button" className="live-back" onClick={onBack}><ArrowLeft size={16} />{t("Toutes les salles")}</button>}
      <Heading>{t("Salle de draft")}</Heading></div><div className="live-actions">
      {room?.invite && <><RoomInvitation room={room} /><RoomInvitation room={room} spectator /></>}
      {typeof document !== "undefined" && document.fullscreenEnabled && <button type="button" className="live-tool" onClick={fullscreen} aria-label={full ? t("Quitter le plein écran") : t("Plein écran")} title={full ? t("Quitter le plein écran") : t("Plein écran")}>{full ? <Minimize2 /> : <Maximize2 />}</button>}
    </div></div>
    {loadError && <p role="alert">{t(loadError)}</p>}
    {!room && !loadError && <p role="status">{t("Chargement…")}</p>}
    {room && <>
      <div className="live-series"><span>{room.mode === "fearless" ? t("Fearless") : t("Standard")}</span>
        <strong>{gameLabel(room.gameNumber,room.seriesLength)}</strong>
        {room.side ? <span>{camp(room.side)}</span> : <span><Eye size={14}/>{t("Spectateur")}</span>}
        {room.latestGame > 1 && <select aria-label={t("Partie de la série")} value={pinned || ""} onChange={e => onPin(Number(e.target.value) || null)}>
          <option value="">{t("En direct")}</option>{Array.from({length:room.latestGame},(_,i) => <option key={i} value={i+1}>{gameLabel(i+1,room.seriesLength)}</option>)}</select>}
        {pinned && <button type="button" onClick={() => onPin(null)}>{t("Revenir au direct")}</button>}
      </div>
      {actionError && <p role="alert">{t(actionError)}</p>}
      <DraftArena key={room.gameId} room={room} recent={recent} pending={pending} onStart={() => mutate("start",{})} onMove={champion => mutate("move",{step:room.moves.length,champion})} />
      {room.moves.length === 20 && <RoomFinish key={room.gameId} {...{room,teamId,matches,pending,mutate}} live={!pinned} />}
    </>}
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


export function DraftRoomWorkspace({ teamId, matches, route, navigate }) {
  useLanguage();
  const id = new URLSearchParams(route.search).get("room");
  const [rooms,setRooms] = useState([]), [editable,setEditable] = useState(null), [error,setError] = useState("");
  const [name,setName] = useState(""), [side,setSide] = useState("blue"), [busy,setBusy] = useState(false), [reload,setReload] = useState(0);
  const [seriesLength,setSeriesLength] = useState("1"), [mode,setMode] = useState("standard"), [firstPick,setFirstPick] = useState("blue");
  const [turnSeconds,setTurnSeconds] = useState("0");
  const creation = useRef(null);
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
  if (!teamId) return <Surface><p>{t("Sélectionne une équipe.")}</p></Surface>;
  if (id) return <Surface><LiveDraftRoom key={id+route.search} roomId={id} initialGame={Number(new URLSearchParams(route.search).get("game"))} teamId={teamId} matches={matches} onBack={() => navigate("/draft/salle")} /></Surface>;
  return <Surface><div className="live-room"><h2>{t("Salle de draft")}</h2>
    {error && <p role="alert">{t(error)} <button type="button" onClick={() => setReload(n => n+1)}>{t("Réessayer")}</button></p>}
    {editable === null && !error && <p role="status">{t("Chargement…")}</p>}
    {editable && <form onSubmit={create} className="live-create"><div className="live-create-cover"><Swords aria-hidden="true" /><p>{t("Choisis ton côté et invite le capitaine adverse.")}</p></div>
      <div className="live-create-fields">
        <TextInput label={t("Adversaire (facultatif)")} value={name} onChange={setName} maxLength={80} />
        <SideSelect label={t("Notre côté")} value={side} onChange={setSide} />
        <SelectInput label={t("Nombre de parties")} value={seriesLength} onChange={setSeriesLength}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</SelectInput>
        <SideSelect label={t("Premier choix")} value={firstPick} onChange={setFirstPick} />
      </div>
      <div className="live-clock-setting"><SelectInput label={t("Temps de réflexion par tour")} value={turnSeconds} onChange={setTurnSeconds}>
        <option value="0">{t("Libre")}</option><option value="30">30 s</option><option value="60">60 s</option></SelectInput>
        {turnSeconds !== "0" && <p>{t("Le chrono démarre quand l’adversaire est prêt. Chaque capitaine confirme son choix, même en prolongation.")}</p>}</div>
      <fieldset className="live-modes"><legend>{t("Format de draft")}</legend>{["standard","fearless"].map(value => <label key={value} data-selected={mode === value}>
        <input type="radio" name="draft-mode" checked={mode === value} onChange={() => setMode(value)} /><span><strong>{value === "standard" ? t("Standard") : t("Fearless")}</strong>
        <small>{value === "standard" ? t("Tous les champions reviennent à chaque partie.") : t("Un champion joué est bloqué pour les deux camps jusqu’à la fin de la série.")}</small></span></label>)}</fieldset>
      <Button type="submit" disabled={busy} icon={Swords}>{t("Créer la salle")}</Button></form>}
    {rooms.length > 0 && <section><h3>{t("Salles récentes")}</h3><ul className="live-history">{rooms.map(r => <li key={r.id}>
      <a href={`/draft/salle?room=${r.id}`}><span>{r.blue_name} · {r.red_name}</span><small>{r.series_length > 1 && gameLabel(r.game_number,r.series_length) + " · "}{r.step === 20 ? t("Draft terminée") : t("{0} choix sur 20", [r.step])}</small></a></li>)}</ul></section>}
    {editable === false && !rooms.length && <p>{t("Aucune salle de draft pour cette équipe.")}</p>}
  </div></Surface>;
}
