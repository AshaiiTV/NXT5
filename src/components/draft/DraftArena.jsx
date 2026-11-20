import React, { useEffect, useState } from "react";
import { Ban, Check, ChevronDown, Clock3, Crosshair, EyeOff, LockKeyhole, Search, Swords } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { ChampionPortrait, championMatchesLane, championSplashUrl } from "../../pages/workspace/workspace-shared.jsx";
import { Button, TextInput } from "../ui/Core.jsx";
import { championDisplayName, championNameKey } from "../../../shared/champions.js";
import { draftTurns } from "../../../shared/draft-order.js";
import { ROLES } from "../../../shared/roles.js";
import championIds from "../../../shared/riot-champion-ids.json";

export const camp = side => side === "blue" ? t("Côté bleu") : t("Côté rouge");
const catalogue = championIds.map(([,name]) => name).sort((a,b) => championDisplayName(a).localeCompare(championDisplayName(b)));
const phaseEnds = [6,12,16,20];

function TeamBoard({ side, room, turns, recent, choice }) {
  const [expanded,setExpanded] = useState(false);
  const name = room[side + "Name"];
  return <section className="live-team" data-expanded={expanded} data-side={side} data-active={turns[room.moves.length]?.[1] === side} aria-label={camp(side)}>
    <header className="live-team-heading"><span>{camp(side)}</span><h3 title={name}>{name}</h3>
      <button type="button" className="live-team-toggle" aria-label={t("Composition de {0}",[name])} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><ChevronDown size={14} aria-hidden="true"/></button></header>
    {["ban","pick"].map(kind => <div className={"live-roster roster-" + kind} key={kind}>
      <h4>{kind === "ban" ? t("Bans") : t("Picks")}</h4>
      <ol>{turns.map(([type,team,slot], i) => {
        if (type !== kind || team !== side) return null;
        const current = i === room.moves.length, preview = current && choice !== undefined;
        const id = preview ? choice : room.moves[i];
        const name = id ? championDisplayName(id) : id === null ? t("Ban non utilisé") : t("À venir");
        return <li key={i} data-current={current} data-preview={preview} data-filled={Boolean(id)} data-reveal={i === recent}
          aria-current={current ? "step" : undefined} title={name}>
          <span className="live-slot" aria-hidden="true">{id ? <ChampionPortrait champion={id} /> : id === null ? "—" : slot}</span>
          <span className="live-slot-name">{name}</span>
          {preview && <EyeOff size={13} className="live-private-mark" aria-hidden="true" />}
          {kind === "ban" && id && !preview && <Ban size={12} aria-hidden="true" className="live-slot-ban" />}
        </li>;
      })}</ol>
    </div>)}
  </section>;
}

function Spotlight({ room, choice, recent, turns }) {
  const step = room.moves.length, previous = step - 1, preview = choice !== undefined;
  const id = preview ? choice : room.moves[previous];
  const source = preview ? turns[step] : turns[previous];
  const [broken,setBroken] = useState("");
  const label = preview ? t("Présélection privée") : source?.[0] === "ban" ? t("Dernier ban") : t("Dernier pick");
  const Icon = preview ? Crosshair : source?.[0] === "ban" ? Ban : LockKeyhole;
  const name = id ? championDisplayName(id) : id === null ? t("Ban non utilisé") : t("Faille de l’invocateur");
  const art = id && broken !== id ? championSplashUrl(id) : "";
  return <div className="live-spotlight" data-side={source?.[1]} data-state={preview ? "preview" : "locked"}>
    <div key={(preview ? "p" : "l") + step + id} className="live-spotlight-frame" data-enter={preview || recent === previous && previous >= 0}>
      {id ? <>
        <div aria-hidden="true" className="live-splash live-fallback"><ChampionPortrait champion={id} /></div>
        {art && <img className="live-splash live-art" src={art} alt="" onError={() => setBroken(id)} onLoad={e => { e.currentTarget.dataset.ready = "true"; }} />}
      </> : <div className="live-map" />}
      <div className="live-art-caption"><span><Icon size={14} aria-hidden="true" />{source ? label : t("Draft de tournoi")}</span><strong>{name}</strong></div>
    </div>
  </div>;
}

function TurnClock({room}) {
  const remainingAtSync = Date.parse(room.turnStartedAt) + room.turnSeconds * 1000 - room.serverTime;
  const [seconds,setSeconds] = useState(() => Math.ceil(remainingAtSync/1000));
  useEffect(() => {
    const deadline = performance.now() + remainingAtSync;
    const tick = () => setSeconds(Math.ceil((deadline-performance.now())/1000));
    tick();
    const timer = setInterval(tick,250);
    return () => clearInterval(timer);
  },[remainingAtSync]);
  const value = Math.abs(seconds);
  return <div className="live-clock" role="timer" aria-live="off" aria-label={t("Temps de réflexion par tour")} data-urgent={seconds <= 10}>
    <Clock3 size={15} aria-hidden="true" />{seconds < 0 && "+"}{Math.floor(value/60)}:{String(value%60).padStart(2,"0")}
  </div>;
}

export function DraftArena({room, pending, recent, onMove, onStart}) {
  const turns = draftTurns(room.firstPick), step = room.moves.length, turn = turns[step];
  const waiting = room.turnSeconds > 0 && !room.turnStartedAt;
  const mine = Boolean(turn && turn[1] === room.side && !waiting);
  const [selection,setSelection] = useState(null), [query,setQuery] = useState(""), [lane,setLane] = useState("ALL");
  const choice = mine && selection?.step === step ? selection.champion : undefined;
  const setChoice = champion => setSelection({champion, step});
  const options = catalogue.filter(id => !room.moves.includes(id) && !room.blocked.includes(id) && championMatchesLane(id,lane)
    && championNameKey(championDisplayName(id)).includes(championNameKey(query)));
  const phase = phaseEnds.findIndex(end => step < end);
  const PhaseIcon = !turn ? Check : turn[0] === "ban" ? Ban : Swords;
  return <>
    <div className="live-turn" data-side={turn?.[1]}>
      <PhaseIcon aria-hidden="true" /><div role="status"><h3>{!turn ? t("Draft terminée") : t(turn[0] === "ban" ? "Ban {0} · {1}" : "Pick {0} · {1}", [turn[2],room[turn[1]+"Name"]])}</h3>
      <p>{!turn ? t("Les picks et bans sont enregistrés.") : waiting ? (room.canStart ? t("Confirme que ton équipe est prête.") : t("En attente du capitaine adverse.")) : mine ? t("À toi de jouer") : t("Au tour de {0}", [room[turn[1]+"Name"]])}</p></div>
      {waiting && room.canStart && <Button disabled={pending} icon={Check} onClick={onStart}>{t("Prêt à drafter")}</Button>}
      {turn && room.turnSeconds > 0 && !waiting && <TurnClock key={step} room={room}/>}
      <div className="live-progress"><strong>{step} / 20</strong><div aria-hidden="true">{phaseEnds.map((end,i) => <i key={end} data-done={step >= end} data-active={phase === i} />)}</div></div>
    </div>
    <div className="live-arena" data-complete={!turn}>
      {["blue","red"].map(side => <TeamBoard key={side} {...{side,room,turns,recent,choice}} />)}
      <div className="live-center">
        <Spotlight {...{room,choice,recent,turns}} />
        {turn && <div className="live-picker" data-side={turn[1]}>
          <TextInput icon={Search} label={t("Rechercher un champion")} value={query} onChange={setQuery} maxLength={64} />
          <div className="live-lanes" role="group" aria-label={t("Filtrer par rôle")}>{["ALL",...ROLES].map(role => <button type="button" key={role}
            aria-pressed={lane === role} onClick={() => setLane(role)}>{role === "ALL" ? t("Tous") : role}</button>)}</div>
          <div className="live-catalogue" role="group" aria-label={t("Champions disponibles")}>
            {options.map(id => <button key={id} type="button" disabled={!mine || pending} aria-pressed={choice === id}
              title={championDisplayName(id)} aria-label={championDisplayName(id)} onClick={() => setChoice(id)}><span aria-hidden="true" data-initials={championDisplayName(id).slice(0,2)}><ChampionPortrait champion={id} /></span><b>{championDisplayName(id)}</b></button>)}
            {!options.length && <p>{t("Aucun champion trouvé.")}</p>}
          </div>
          {mine && <div className="live-confirm">
            {turn[0] === "ban" && <Button variant="ghost" type="button" aria-pressed={choice === null} disabled={pending} onClick={() => setChoice(null)}>{t("Passer ce ban")}</Button>}
            <Button type="button" icon={turn[0] === "ban" ? Ban : LockKeyhole} disabled={pending || choice === undefined} onClick={() => {
              onMove(choice); setQuery("");
            }}>{choice === null ? t("Confirmer le ban passé") : choice ? t(turn[0] === "ban" ? "Bannir {0}" : "Verrouiller {0}", [championDisplayName(choice)]) : t(turn[0] === "ban" ? "Confirmer le ban" : "Confirmer le pick")}</Button>
          </div>}
        </div>}
      </div>
    </div>
    {room.blocked.length > 0 && <details className="live-lockouts"><summary>{t("Champions bloqués en Fearless ({0})",[room.blocked.length])}</summary><ul>{room.blocked.map(id => <li key={id}><ChampionPortrait champion={id} />{championDisplayName(id)}</li>)}</ul></details>}
  </>;
}
