import React, { useId, useMemo, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Flag, RotateCcw, Shield, Swords } from "lucide-react";
import { draftOrder, draftSlotState } from "../../../shared/draft-order.js";
import { canonicalChampion, championDisplayName } from "../../../shared/champions.js";
import { assetProxyUrl } from "../../utils/matches.js";
import { ChampionPortrait } from "../../pages/workspace/workspace-shared.jsx";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button } from "../ui/Core.jsx";
import "./draft-board.css";

const PHASES = [
  { kind: "ban", phase: 1, start: 0, end: 6, title: "Bans · phase 1" },
  { kind: "pick", phase: 1, start: 6, end: 12, title: "Picks · phase 1" },
  { kind: "ban", phase: 2, start: 12, end: 16, title: "Bans · phase 2" },
  { kind: "pick", phase: 2, start: 16, end: 20, title: "Picks · phase 2" },
];
const slotKey = (side, kind, slot) => `${side}:${kind}:${slot}`;
const sideLabel = (side) => t(side === "blue" ? "Côté bleu" : "Côté rouge");
const slotValue = (slot) => slot.champion ? championDisplayName(slot.champion) : t(slot.valueStatus === "skipped" ? "Ban non utilisé" : "Non renseigné");

function PickArt({ champion }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="draft-board-art draft-board-art-fallback" aria-hidden="true"><ChampionPortrait champion={champion} /></span>;
  const url = assetProxyUrl(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${canonicalChampion(champion)}_0.jpg`);
  return <img className="draft-board-art" src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function DraftSlot({ slot, step, ordered, onStep }) {
  const visible = !ordered || slot.order <= step;
  const active = ordered && slot.order === step;
  const value = visible ? slotValue(slot) : t("À révéler");
  const isBan = slot.kind === "ban";
  const label = ordered ? slot.label : t(isBan ? "Ban {0}" : "Pick {0}", [slot.slot]);
  const content = <>
    {!isBan && visible && slot.champion && <PickArt key={slot.champion} champion={slot.champion} />}
    {isBan && <span className="draft-board-ban-art" aria-hidden="true">
      {visible && slot.champion ? <ChampionPortrait champion={slot.champion} /> : <span>{visible ? slot.valueStatus === "skipped" ? "—" : "?" : "·"}</span>}
      {visible && slot.champion && <Ban size={22} />}
    </span>}
    <span className="draft-board-slot-copy">
      <span className="draft-board-slot-meta"><b>{label}</b>{ordered && <span>{isBan ? t("Phase {0}", [slot.phase]) : t("Rota {0}", [slot.rotation])}</span>}</span>
      <strong>{value}</strong>
    </span>
    {!isBan && !visible && <Swords className="draft-board-pending" aria-hidden="true" />}
    {!isBan && active && <span className="draft-board-current-mark" aria-hidden="true" />}
  </>;
  return <li className={`draft-board-slot draft-board-${slot.kind}`} data-side={slot.side} data-revealed={visible} data-current={active}>
    {ordered ? <button type="button" onClick={() => onStep(slot.order)} aria-current={active ? "step" : undefined}
      aria-label={t("Étape {0} : {1} · {2}", [slot.order, label, value])}>{content}</button> : <div className="draft-board-static-slot">{content}</div>}
  </li>;
}

function DraftBoardView({ snapshot, allySide }) {
  useLanguage();
  const id = useId();
  const order = useMemo(() => draftOrder(snapshot), [snapshot]);
  const ordered = order.status === "known";
  const [step, setStep] = useState(20);
  const slots = useMemo(() => {
    const indexed = new Map();
    const rotations = { blue: 0, red: 0 };
    let previous;
    for (const event of order.events) {
      if (event.kind === "pick" && (previous?.kind !== "pick" || previous.side !== event.side || previous.phase !== event.phase)) rotations[event.side] += 1;
      indexed.set(slotKey(event.side, event.kind, event.slot), { ...event, champion: event.valueStatus === "selected" ? event.champion : null, rotation: rotations[event.side] });
      previous = event;
    }
    for (const side of ["blue", "red"]) for (const kind of ["pick", "ban"]) for (let slot = 1; slot <= 5; slot += 1) {
      const key = slotKey(side, kind, slot);
      if (!indexed.has(key)) {
        const valueStatus = draftSlotState(snapshot, side, kind, slot);
        indexed.set(key, { side, kind, slot, valueStatus, champion: valueStatus === "selected" ? snapshot[`${side}${kind === "pick" ? "Picks" : "Bans"}`][slot - 1] : null });
      }
    }
    return indexed;
  }, [snapshot, order]);
  const current = order.events[step - 1];
  const currentSlot = current && slots.get(slotKey(current.side, current.kind, current.slot));
  const status = !ordered || step === 20 ? t("Draft finale") : step === 0 ? t("Avant le premier ban") : t("Étape {0} sur 20", [step]);
  const phase = PHASES.find((group) => step > group.start && step <= group.end) || PHASES[0];
  const currentDescription = currentSlot ? t("{0} · {1} : {2}", [snapshot[`${current.side}Name`] || sideLabel(current.side), t(current.kind === "ban" ? "Ban {0}" : "Pick {0}", [current.slot]), slotValue(currentSlot)]) : t("Les deux équipes ont encore tous leurs choix à faire.");

  return <section className="draft-board" aria-labelledby={`${id}-title`}>
    <header className="draft-board-heading"><div><span className="draft-board-eyebrow">DRAFT ROOM</span><h4 id={`${id}-title`}>{t("Tableau de draft")}</h4></div><span className="draft-board-status">{status}</span></header>
    {ordered && <div className="draft-board-playback">
      <div className="draft-board-actions">
        <Button type="button" variant="ghost" icon={RotateCcw} title={t("Revoir depuis le début")} onClick={() => setStep(0)} disabled={step === 0}><span>{t("Revoir depuis le début")}</span></Button>
        <div className="draft-board-step-buttons">
          <Button type="button" variant="ghost" icon={ChevronLeft} aria-label={t("Étape précédente")} onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} />
          <span aria-hidden="true">{step}<span> / 20</span></span>
          <Button type="button" variant="ghost" icon={ChevronRight} aria-label={t("Étape suivante")} onClick={() => setStep((value) => Math.min(20, value + 1))} disabled={step === 20} />
        </div>
        <Button type="button" variant="ghost" icon={Flag} title={t("Voir la draft finale")} onClick={() => setStep(20)} disabled={step === 20}><span>{t("Voir la draft finale")}</span></Button>
      </div>
      <label className="draft-board-scrubber"><span className="sr-only">{t("Étape de la draft")}</span><input type="range" min="0" max="20" step="1" value={step} aria-valuetext={`${status}. ${currentDescription}`} onChange={(event) => setStep(Math.max(0, Math.min(20, Number(event.target.value))))} /></label>
      <div className="draft-board-live" role="status" aria-live="polite" aria-atomic="true" data-side={current?.side}>
        {current?.kind === "ban" ? <Ban size={18} aria-hidden="true" /> : <Swords size={18} aria-hidden="true" />}<div><strong>{step === 0 ? t("Avant le premier ban") : t(phase.title)}</strong><span>{currentDescription}</span></div>
      </div>
    </div>}
    <div className="draft-board-arena">
      {["blue", "red"].map((side) => <section key={side} className="draft-board-team" data-side={side} aria-label={sideLabel(side)}>
        <header className="draft-board-team-heading"><div className="draft-board-team-side"><span>{sideLabel(side)}</span>{allySide && <span>{t(side === allySide ? "Notre équipe" : "Adversaire")}</span>}</div><h5>{snapshot[`${side}Name`] || t("Équipe sans nom")}</h5><div className="draft-board-team-position">{ordered ? <>{order.events.find((event) => event.kind === "pick").side === side ? <><Flag size={14} aria-hidden="true" />{t("Premier pick")}</> : <><Shield size={14} aria-hidden="true" />{t("Réponse au premier pick")}</>}</> : t("Ordre non vérifié")}</div></header>
        <ol className="draft-board-picks" aria-label={t("Picks de {0}", [snapshot[`${side}Name`] || sideLabel(side)])}>{[1, 2, 3, 4, 5].map((slot) => <DraftSlot key={slot} slot={slots.get(slotKey(side, "pick", slot))} step={step} ordered={ordered} onStep={setStep} />)}</ol>
        <div className="draft-board-bans-heading"><Ban size={15} aria-hidden="true" /><h6>{t("Bans")}</h6></div>
        <ol className="draft-board-bans" aria-label={t("Bans de {0}", [snapshot[`${side}Name`] || sideLabel(side)])}>{[1, 2, 3, 4, 5].map((slot) => <DraftSlot key={slot} slot={slots.get(slotKey(side, "ban", slot))} step={step} ordered={ordered} onStep={setStep} />)}</ol>
      </section>)}
    </div>
    {ordered ? <>
      <div className="draft-board-timeline" aria-label={t("Accès direct aux étapes de la draft")}>{PHASES.map((group) => <section key={group.title} className="draft-board-phase"><h5>{t(group.title)}</h5><ol>{order.events.filter((event) => event.phase === group.phase && event.kind === group.kind).map((event) => {
        const slot = slots.get(slotKey(event.side, event.kind, event.slot));
        return <li key={event.order}><button type="button" data-side={event.side} data-revealed={event.order <= step} aria-current={event.order === step ? "step" : undefined} onClick={() => setStep(event.order)} aria-label={t("Étape {0} : {1} · {2}", [event.order, event.label, event.order <= step ? slotValue(slot) : t("À révéler")])}><span>{event.order}</span><b>{event.label}</b></button></li>;
      })}</ol></section>)}</div>
      <p className="draft-board-note">{t("Clique sur un choix ou avance dans les étapes. B et R désignent les camps bleu et rouge ; une rota regroupe les picks consécutifs d’un camp, pas les rôles joués.")}</p>
      <details className="draft-board-provenance"><summary>{t("Comment cet ordre est-il reconstitué ?")}</summary><p>{t(order.message)}</p></details>
    </> : <div className="draft-board-unavailable"><strong>{t("Ordre de sélection indisponible pour cet import.")}</strong><p>{t(order.message)}</p></div>}
  </section>;
}

export default function DraftBoard({ snapshot, allySide }) {
  // Replacing a source (including a refreshed import of the same draft) restores
  // its final board without briefly showing the previous source's replay step.
  return <DraftBoardView key={JSON.stringify(snapshot)} snapshot={snapshot} allySide={allySide} />;
}
