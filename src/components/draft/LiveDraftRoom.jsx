import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Ban, Check, Copy, Search, Swords } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button, SelectInput, Surface, TextInput } from "../ui/Core.jsx";
import { ChampionPortrait } from "../../pages/workspace/workspace-shared.jsx";
import { matchDisplayName } from "../../utils/matches.js";
import { championDisplayName, championNameKey } from "../../../shared/champions.js";
import { STANDARD_DRAFT_TURNS as turns } from "../../../shared/draft-order.js";
import championIds from "../../../shared/riot-champion-ids.json";
import "./live-draft-room.css";

export const roomRequest = (body, signal) => apiFetch("draft-rooms", { method: "POST", body: JSON.stringify(body), signal });
const camp = side => side === "blue" ? t("Côté bleu") : t("Côté rouge");
const catalogue = championIds.map(([, name]) => name).sort((a,b) => championDisplayName(a).localeCompare(championDisplayName(b)));
const isRoomId = id => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || "");

function TeamBoard({ side, room }) {
  return <section className="live-team" data-side={side} aria-label={camp(side)}>
    <div className="live-team-heading"><span>{camp(side)}</span><h3>{room[side + "Name"]}</h3></div>
    {["ban","pick"].map(kind => <div key={kind} className="live-roster">
      <h4>{kind === "ban" ? t("Bans") : t("Picks")}</h4>
      <ol>{turns.map(([type,team,slot], index) => {
        if (type !== kind || team !== side) return null;
        const champion = room.moves[index], current = index === room.moves.length;
        const value = champion ? championDisplayName(champion) : champion === null ? t("Ban non utilisé") : t("À venir");
        return <li key={index} data-current={current} aria-current={current ? "step" : undefined} title={value}>
          <span className="live-slot" aria-hidden="true">{champion ? <ChampionPortrait champion={champion} /> : champion === null ? "—" : slot}</span>
          <span className="live-slot-name">{champion ? value : <span className="sr-only">{value}</span>}</span>
        </li>;
      })}</ol>
    </div>)}
  </section>;
}

function RoomInvitation({ room }) {
  const [copied, setCopied] = useState(false), [fallback, setFallback] = useState(false);
  const link = new URL("/salle-de-draft", window.location.origin);
  link.searchParams.set("room", room.id);
  link.hash = room.invite;
  async function copy() {
    try { await navigator.clipboard.writeText(link.href); setCopied(true); }
    catch { setFallback(true); }
  }
  return <div className="live-invite"><Button type="button" variant="ghost" icon={copied ? Check : Copy} onClick={copy}>{copied ? t("Lien copié") : t("Copier le lien adverse")}</Button>
    {fallback && <TextInput label={t("Lien privé de l’adversaire")} value={link.href} readOnly onFocus={e => e.target.select()} />}
  </div>;
}

function ChampionPicker({ room, onConfirm, pending }) {
  const [query,setQuery] = useState(""), [choice,setChoice] = useState(undefined);
  const [kind] = turns[room.moves.length];
  const options = catalogue.filter(id => !room.moves.includes(id) && championNameKey(championDisplayName(id)).includes(championNameKey(query)));
  return <section className="live-picker" data-side={room.side}>
    <TextInput icon={Search} label={t("Rechercher un champion")} value={query} onChange={setQuery} maxLength={64} />
    <div className="live-catalogue" role="group" aria-label={t("Champions disponibles")}>
      {options.map(id => <button key={id} type="button" aria-label={championDisplayName(id)} aria-pressed={choice === id} disabled={pending} onClick={() => setChoice(id)}>
        <ChampionPortrait champion={id} /><span>{championDisplayName(id)}</span>
      </button>)}
      {!options.length && <p>{t("Aucun champion trouvé.")}</p>}
    </div>
    <div className="live-confirm">
      {kind === "ban" && <Button variant="ghost" type="button" aria-pressed={choice === null} disabled={pending} onClick={() => setChoice(null)}>{t("Passer ce ban")}</Button>}
      <Button type="button" icon={kind === "ban" ? Ban : Check} disabled={pending || choice === undefined} onClick={() => onConfirm(choice)}>
        {choice === null ? t("Confirmer le ban passé") : choice ? t(kind === "ban" ? "Bannir {0}" : "Sélectionner {0}", [championDisplayName(choice)]) : t(kind === "ban" ? "Confirmer le ban" : "Confirmer le pick")}
      </Button>
    </div>
  </section>;
}

export function LiveDraftRoom({ roomId, teamId, invite, matches = [], onBack }) {
  useLanguage();
  const [room,setRoom] = useState(null), [loadError,setLoadError] = useState(""), [actionError,setActionError] = useState("");
  const [pending,setPending] = useState(false), [matchId,setMatchId] = useState("");
  const inFlight = useRef(false);
  const request = useCallback((action, fields = {}, signal) => roomRequest({ action, roomId, ...(invite === undefined ? {teamId} : {invite}), ...fields }, signal), [roomId,teamId,invite]);
  const accept = useCallback(next => setRoom(prev => prev && (prev.moves.length > next.moves.length || (prev.matchId && !next.matchId && prev.moves.length === next.moves.length)) ? prev : next), []);
  const complete = room?.moves.length === turns.length;
  useEffect(() => {
    if (complete) return;
    let active = true, timer;
    const controller = new AbortController();
    async function poll() {
      let again = true;
      try {
        const {room:updated} = await request("read", {}, controller.signal);
        if (active) { accept(updated); setLoadError(""); }
        again = updated.moves.length < turns.length;
      } catch (err) {
        if (active) setLoadError(err.message);
        again = ![400,401,403,404].includes(err.status);
      }
      if (active && again) timer = setTimeout(poll, document.hidden ? 8000 : 2200);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [request, accept, complete]);
  async function mutate(action, fields) {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setActionError("");
    try { const result = await request(action, fields); accept(result.room); setLoadError(""); }
    catch (err) {
      setActionError(err.message);
      try { accept((await request("read")).room); } catch { /* Polling also retries when connectivity returns. */ }
    } finally { inFlight.current = false; setPending(false); }
  }
  const Heading = invite === undefined ? "h2" : "h1";
  const turn = turns[room?.moves.length], myTurn = turn && turn[1] === room.side;
  return <div className="live-room">
    <div className="live-heading"><div>{onBack && <button type="button" className="live-back" onClick={onBack}><ArrowLeft size={16} />{t("Toutes les salles")}</button>}
      <Heading>{t("Salle de draft")}</Heading></div>{room?.invite && !complete && <RoomInvitation room={room} />}</div>
    {loadError && <p role="alert">{t(loadError)}</p>}
    {!room && !loadError && <p role="status">{t("Chargement…")}</p>}
    {room && <>
      <div className="live-turn" data-side={turn?.[1]} role="status" aria-live="polite">
        {turn?.[0] === "ban" ? <Ban aria-hidden="true" /> : <Swords aria-hidden="true" />}
        <div><h3>{complete ? t("Draft terminée") : t(turn[0] === "ban" ? "Ban {0} · {1}" : "Pick {0} · {1}", [turn[2], room[turn[1] + "Name"]])}</h3>
          <p>{complete ? t("Les picks et bans sont enregistrés.") : myTurn ? t("À toi de jouer") : t("Au tour de {0}", [room[turn[1] + "Name"]])}</p></div>
        <strong>{room.moves.length} / {turns.length}</strong>
      </div>
      <div className="live-boards">{["blue","red"].map(side => <TeamBoard key={side} side={side} room={room} />)}</div>
      {actionError && <p role="alert">{t(actionError)}</p>}
      {myTurn && <ChampionPicker key={room.moves.length} room={room} pending={pending} onConfirm={champion => mutate("move", {step:room.moves.length, champion})} />}
      {complete && teamId && <div className="live-finish"><a href={`/tendances?rubrique=drafts&draft=${room.id}`}>{t("Analyser la draft")}</a>
        {room.matchId ? <a href={`/games?match=${room.matchId}`}>{t("Voir la partie liée")}</a> : room.invite && matches.length > 0 && <div className="live-link">
          <SelectInput label={t("Partie jouée")} value={matchId} onChange={setMatchId}><option value="">{t("Choisir une partie")}</option>{matches.map(m => <option key={m.id} value={m.id}>{matchDisplayName(m)} · {m.game_id}</option>)}</SelectInput>
          <Button disabled={pending || !matchId} onClick={() => mutate("link", {matchId})}>{t("Associer à la partie")}</Button></div>}
      </div>}
    </>}
  </div>;
}

export function GuestDraftRoom() {
  const id = new URLSearchParams(window.location.search).get("room");
  const invite = window.location.hash.slice(1);
  return <main className="live-guest"><Surface>{isRoomId(id) && /^[A-Za-z0-9_-]{43}$/.test(invite)
    ? <LiveDraftRoom key={id + invite} roomId={id} invite={invite} /> : <p role="alert">{t("Salle introuvable ou invitation invalide.")}</p>}</Surface></main>;
}

export function DraftRoomWorkspace({ teamId, matches, route, navigate }) {
  useLanguage();
  const id = new URLSearchParams(route.search).get("room");
  const [rooms,setRooms] = useState([]), [editable,setEditable] = useState(null), [error,setError] = useState("");
  const [name,setName] = useState(""), [side,setSide] = useState("blue"), [busy,setBusy] = useState(false), [reload,setReload] = useState(0);
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
    const fields = JSON.stringify([side, name]);
    if (creation.current?.fields !== fields) creation.current = {fields, key:crypto.randomUUID()};
    try {
      const {room} = await roomRequest({action:"create", teamId, side, opponent:name, creationKey:creation.current.key});
      creation.current = null; open(room.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (!teamId) return <Surface><p>{t("Sélectionne une équipe.")}</p></Surface>;
  if (id) return <Surface><LiveDraftRoom key={id} roomId={id} teamId={teamId} matches={matches} onBack={() => navigate("/draft/salle")} /></Surface>;
  return <Surface><div className="live-room"><h2>{t("Salle de draft")}</h2>
    {error && <p role="alert">{t(error)} <button type="button" onClick={() => setReload(n => n+1)}>{t("Réessayer")}</button></p>}
    {editable === null && !error && <p role="status">{t("Chargement…")}</p>}
    {editable && <form onSubmit={create} className="live-create"><p>{t("Choisis ton côté puis partage le lien avec l’équipe adverse. Une salle correspond à une partie.")}</p>
      <div className="live-create-fields"><SelectInput label={t("Notre côté")} value={side} onChange={setSide}><option value="blue">{camp("blue")}</option><option value="red">{camp("red")}</option></SelectInput>
      <TextInput label={t("Adversaire (facultatif)")} value={name} onChange={setName} maxLength={80} /></div>
      <Button type="submit" disabled={busy} icon={Swords}>{t("Créer la salle")}</Button></form>}
    {rooms.length > 0 && <section><h3>{t("Salles récentes")}</h3><ul className="live-history">{rooms.map(r => <li key={r.id}>
      <a href={`/draft/salle?room=${r.id}`}><span>{r.blue_name} · {r.red_name}</span><small>{r.step === turns.length ? t("Draft terminée") : t("{0} choix sur 20", [r.step])}</small></a></li>)}</ul></section>}
    {editable === false && !rooms.length && <p>{t("Aucune salle de draft pour cette équipe.")}</p>}
  </div></Surface>;
}
