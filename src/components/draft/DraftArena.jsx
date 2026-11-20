import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Ban, Check, ChevronDown, Clock3, Crosshair, EyeOff, LockKeyhole, Search, Swords } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { ChampionPortrait, championMatchesLane } from "../../pages/workspace/workspace-shared.jsx";
import { Button, TextInput } from "../ui/Core.jsx";
import { championDisplayName, championNameKey } from "../../../shared/champions.js";
import { assetProxyUrl } from "../../utils/matches.js";
import { draftSpotlight, spotlightWidths } from "../../../shared/draft-spotlight.js";
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

// Keep the face on the centre line, including when the original ends on one
// side of the frame. The image edge fades into the stage at those sizes.
function frameArtwork(art, frame) {
  const scale = Math.min(1, Math.max(frame.width / art.width, frame.height / (art.height * art.visibleHeight)));
  const width = Math.round(art.width * scale), height = Math.round(art.height * scale);
  const left = Math.round(frame.width / 2 - art.x * width);
  const top = Math.round(Math.min(0, Math.max(frame.height - height, frame.height * .46 - art.y * height)));
  const feather = Math.round(Math.min(frame.width * .15, width * .17));
  return { width, height, left, top,
    "--soft-top": Math.max(0,Math.min(feather, art.y * height * .5, top + feather)) + "px",
    "--soft-bottom": Math.max(0,Math.min(feather,frame.height-top-height+feather)) + "px",
    "--soft-left": Math.max(0,Math.min(feather,left+feather)) + "px",
    "--soft-right": Math.max(0,Math.min(feather,frame.width-left-width+feather)) + "px" };
}

// Fill the periphery with the same light and colours as the illustration.
// Only this small backdrop is softened. The foreground keeps its native detail.
function paintArtBackdrop(canvas, image, art, frame) {
  if (!canvas || !image?.naturalWidth || !frame?.width || !art) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  canvas.width = 96;
  canvas.height = Math.max(1, Math.round(96 * frame.height / frame.width));
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
  const x = Math.max(canvas.width-width, Math.min(0, canvas.width/2-art.x*width));
  const y = Math.max(canvas.height-height, Math.min(0, canvas.height*.46-art.y*height));
  context.drawImage(image, x, y, width, height);
}

function Spotlight({ room, choice, recent, turns }) {
  const step = room.moves.length, previous = step - 1, preview = choice !== undefined;
  const id = preview ? choice : room.moves[previous];
  const source = preview ? turns[step] : turns[previous];
  const [broken,setBroken] = useState(""), [frame,setFrame] = useState(null);
  const stage = useRef(null), ambience = useRef(null), artwork = useRef(null);
  useLayoutEffect(() => {
    const node = stage.current;
    const measure = () => {
      const width = node.clientWidth, height = node.clientHeight;
      setFrame(last => last?.width === width && last?.height === height ? last : {width,height});
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const label = preview ? t("Présélection privée") : source?.[0] === "ban" ? t("Dernier ban") : t("Dernier pick");
  const Icon = preview ? Crosshair : source?.[0] === "ban" ? Ban : LockKeyhole;
  const name = id ? championDisplayName(id) : id === null ? t("Ban non utilisé") : t("Faille de l’invocateur");
  const art = id && broken !== id ? draftSpotlight(id,frame?.width) : null;
  const layout = art && frame?.width && frame.height ? frameArtwork(art,frame) : null;
  const url = w => art.centered
    ? assetProxyUrl("https://ddragon.leagueoflegends.com/cdn/img/champion/" + art.asset)
    : "/.netlify/functions/asset-proxy?spotlight=" + encodeURIComponent(id) + "&w=" + w;
  const revision = (preview ? "p" : "l") + step + id + (art?.asset || "");
  const widths = art ? spotlightWidths(art) : [];
  useLayoutEffect(() => {
    if (artwork.current?.complete) paintArtBackdrop(ambience.current, artwork.current, art, frame);
  }, [id, frame, revision]);
  function reveal(event) {
    paintArtBackdrop(ambience.current, event.currentTarget, art, frame);
    event.currentTarget.dataset.ready = "true";
  }
  return <div className="live-spotlight" data-side={source?.[1]} data-state={preview ? "preview" : "locked"}>
    <div className="live-spotlight-frame" data-enter={preview || recent === previous && previous >= 0}>
      <div ref={stage} className="live-art-window">
        {id ? <>
          <canvas key={id} className="live-art-ambience" ref={ambience} width={8} height={4} aria-hidden="true" />
          <div aria-hidden="true" className="live-fallback"><ChampionPortrait champion={id} /></div>
          {layout && <div key={revision} className="live-art-placement" style={layout}>
            <img ref={artwork} className="live-art" alt="" src={url(widths[0])}
              srcSet={widths.map(w => url(w) + " " + w + "w").join(", ")} sizes={layout.width + "px"}
              onError={() => setBroken(id)} onLoad={reveal} />
          </div>}
        </> : <div className="live-map" />}
      </div>
      <div key={revision} className="live-art-caption"><span><Icon size={14} aria-hidden="true" />{source ? label : t("Draft de tournoi")}</span><strong>{name}</strong></div>
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
