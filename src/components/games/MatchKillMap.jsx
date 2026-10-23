import React, { useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Crosshair, LoaderCircle, MapPinOff, Swords } from "lucide-react";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { Button } from "../ui/Core.jsx";
import { ChampionPortrait, championDisplayName } from "../../pages/workspace/workspace-shared.jsx";
import { buildMatchKillMap } from "../../utils/match-kill-map.js";
import "./match-kill-map.css";

const clock = (timestamp) => `${Math.floor(timestamp / 60000)}:${String(Math.floor(timestamp / 1000) % 60).padStart(2, "0")}`;
const champion = (row) => row?.champion || row?.championName || row?.raw?.championName;
const championName = (row) => champion(row) ? championDisplayName(champion(row)) : t("Champion inconnu");
const displayName = (value, fallback) => !String(value || "").trim() || ["Notre équipe", "Adversaires", "Adversaire"].includes(value) ? t(fallback) : value;

function KillChampion({ row, execution = false }) {
  return <span className="mkm-champion">
    <span className="mkm-portrait" aria-hidden="true">{champion(row) ? <ChampionPortrait champion={champion(row)} /> : <Swords />}</span>
    <span>{execution ? t("Exécution") : championName(row)}</span>
  </span>;
}

export function MatchKillMap({ match, allyName, enemyName, loading = false, error = "" }) {
  useLanguage();
  const id = useId();
  const plotRef = useRef(null);
  const model = useMemo(() => buildMatchKillMap(match), [match]);
  const [selection, setSelection] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const active = selection?.model === model;
  const selectedIndex = active ? selection.index : 0;
  const selected = active ? model.points[selectedIndex] : null;
  const names = { ALLY: displayName(allyName, "Notre équipe"), ENEMY: displayName(enemyName, "Adversaires"), UNKNOWN: t("Équipe indéterminée") };
  const summary = (point) => t("À {0} : {1} → {2}. {3}.", [clock(point.timestamp), point.killerId === 0 ? t("Exécution") : championName(point.killer), championName(point.victim), names[point.teamKey]]);
  const select = (index, announce = false) => setSelection((current) => current?.model === model && current.index === index && current.announce === announce ? current : { model, index, announce });
  const move = (direction) => select(Math.max(0, Math.min(model.points.length - 1, active ? selectedIndex + direction : 0)), true);
  const inspectKey = (event) => {
    if (event.key === "Escape") { setSelection(null); return; }
    const next = { ArrowLeft: active ? selectedIndex - 1 : 0, ArrowDown: active ? selectedIndex - 1 : 0, ArrowRight: active ? selectedIndex + 1 : 0, ArrowUp: active ? selectedIndex + 1 : 0, Home: 0, End: model.points.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(Math.max(0, Math.min(model.points.length - 1, next)), true);
  };
  const inspectPointer = (event) => {
    // The map is one generous target; nearby dots never steal each other's hit area.
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    let closest = -1;
    let distance = 24 ** 2;
    model.points.forEach((point, index) => {
      const dx = event.clientX - rect.left - point.x * rect.width;
      const dy = event.clientY - rect.top - (1 - point.y) * rect.height;
      const candidate = dx * dx + dy * dy;
      if (candidate < distance) { closest = index; distance = candidate; }
    });
    if (closest >= 0) select(closest);
  };
  const unavailable = loading ? t("Chargement de la carte…") : error ? t("Impossible de charger les éliminations.")
    : model.status === "unsupported" ? t("Carte disponible pour la Faille de l’invocateur.")
      : model.status === "absent" ? t("Chronologie indisponible")
        : model.status === "unavailable" ? t("Positions des éliminations indisponibles") : "";

  return <section className="match-kill-map" aria-labelledby={`${id}-title`} aria-busy={loading || undefined}>
    <header className="mkm-header"><h4 id={`${id}-title`}><Crosshair aria-hidden="true" />{t("Carte des éliminations")}</h4></header>
    {unavailable ? <div className="mkm-empty" role={loading ? "status" : undefined}>
      {loading ? <LoaderCircle className="mkm-loader" aria-hidden="true" /> : <MapPinOff aria-hidden="true" />}<p>{unavailable}</p>
    </div> : <>
      <div className="mkm-legend">
        {["ALLY", "ENEMY", ...(model.counts.UNKNOWN ? ["UNKNOWN"] : [])].map((team) => <span key={team} data-team={team}><i aria-hidden="true" /><span>{names[team]}</span><b>{model.counts[team]}</b></span>)}
      </div>
      <div className="mkm-stage">
        {imageFailed ? <div className="mkm-empty"><MapPinOff aria-hidden="true" /><p>{t("Fond de carte indisponible")}</p></div> : <div className="mkm-plot" ref={plotRef}
          role={model.points.length ? "slider" : "img"} tabIndex={model.points.length ? 0 : undefined}
          aria-label={t("Carte des éliminations")} aria-describedby={model.points.length ? `${id}-keys` : undefined}
          aria-valuemin={model.points.length ? 0 : undefined} aria-valuemax={model.points.length ? model.points.length - 1 : undefined}
          aria-valuenow={model.points.length ? selectedIndex : undefined} aria-valuetext={model.points.length ? summary(model.points[selectedIndex]) : undefined}
          onPointerMove={inspectPointer} onPointerDown={inspectPointer} onKeyDown={inspectKey}
          onFocus={() => { if (model.points.length && !active) select(0); }}>
          <img className="mkm-background" src="/assets/maps/summoners-rift.png" alt="" width="512" height="512" draggable="false" onError={() => setImageFailed(true)} />
          <svg className="mkm-points" viewBox="0 0 512 512" aria-hidden="true">
            {model.points.map((point) => <circle key={point.id} className="mkm-point" data-team={point.teamKey} cx={point.x * 512} cy={(1 - point.y) * 512} r="7.5" vectorEffect="non-scaling-stroke" />)}
            {selected && <g className="mkm-selection" data-team={selected.teamKey}>
              <circle className="mkm-ring" cx={selected.x * 512} cy={(1 - selected.y) * 512} r="15" vectorEffect="non-scaling-stroke" />
              <circle className="mkm-point" data-team={selected.teamKey} cx={selected.x * 512} cy={(1 - selected.y) * 512} r="8" vectorEffect="non-scaling-stroke" />
            </g>}
          </svg>
        </div>}
      </div>
      {model.points.length > 0 ? <>
        <p className="sr-only" id={`${id}-keys`}>{t("Utilisez les flèches pour parcourir les éliminations, Début et Fin pour la première et la dernière.")}</p>
        <span className="sr-only" role="status" aria-live="polite">{selected && selection.announce ? summary(selected) : ""}</span>
        <div className="mkm-navigation">
          <span>{selected ? <><time>{clock(selected.timestamp)}</time><span>{selectedIndex + 1} / {model.points.length}</span></> : model.points.length === 1 ? t("1 élimination localisée") : t("{0} éliminations localisées", [model.points.length])}</span>
          <div><Button variant="ghost" icon={ArrowLeft} aria-label={t("Élimination précédente")} aria-disabled={active && selectedIndex === 0} onClick={() => move(-1)} />
            <Button variant="ghost" icon={ArrowRight} aria-label={t("Élimination suivante")} aria-disabled={active && selectedIndex === model.points.length - 1} onClick={() => move(1)} /></div>
        </div>
        <div className="mkm-readout" data-team={selected?.teamKey}>
          {selected ? <>
            <span className="mkm-event-team">{names[selected.teamKey]}</span>
            <div className="mkm-duel"><KillChampion row={selected.killer} execution={selected.killerId === 0} /><ArrowRight aria-hidden="true" /><KillChampion row={selected.victim} /></div>
            {selected.assistants?.length > 0 && <span className="mkm-assists">{t("Assistances : {0}", [selected.assistants.map(championName).join(", ")])}</span>}
          </> : <p className="mkm-hint">{t("Survolez ou touchez un point.")}</p>}
        </div>
      </> : <p className="mkm-hint">{t("Aucune élimination enregistrée")}</p>}
      {model.unplaced > 0 && <p className="mkm-incomplete">{model.unplaced === 1 ? t("1 élimination non localisable") : t("{0} éliminations non localisables", [model.unplaced])}</p>}
      {model.partial && model.unplaced === 0 && <p className="mkm-incomplete">{t("Événements incomplets")}</p>}
    </>}
  </section>;
}
