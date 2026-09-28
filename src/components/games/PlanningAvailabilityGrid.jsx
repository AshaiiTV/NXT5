import React, { useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { RoleIcon } from "../brand/BrandAssets.jsx";
import { Button } from "../ui/Core.jsx";
import { cx } from "../../app/helpers.js";
import { roleLabel } from "../../pages/workspace/shell-shared.jsx";

export function PlanningAvailabilityGrid({ rows, weekDays, canEditSelected, canEditEvents, editingEvents, draftSlots, onDay, onTime, onToggle, onEvent, frameTone }) {
  const [dayIndex, setDayIndex] = useState(0);
  const [activeCell, setActiveCell] = useState("0:1");
  const [activeHour, setActiveHour] = useState(0);
  const grid = useRef(null);
  const daily = useRef(null);
  const interactive = canEditSelected || canEditEvents;
  const cellLabel = (cell) => `${weekDays[cell.dayIndex]?.[1]} ${cell.time} · ${cell.title}${canEditSelected ? (cell.activeSlot ? " · Disponible" : " · Indisponible") : ""}`;
  function selectCell(event, cell) {
    if (editingEvents || !canEditSelected) onEvent(event, cell.day, cell.time);
    else onToggle(cell.day, cell.time);
  }
  function gridKeys(event) {
    const button = event.target.closest?.("button[data-position]");
    if (!button) return;
    const [row, column] = button.dataset.position.split(":").map(Number);
    let nextRow = row, nextColumn = column;
    if (event.key === "ArrowDown") nextRow++;
    else if (event.key === "ArrowUp") nextRow--;
    else if (event.key === "ArrowRight") nextColumn++;
    else if (event.key === "ArrowLeft") nextColumn--;
    else if (event.key === "Home") { nextColumn = row === 0 || !canEditSelected ? 1 : 0; if (event.ctrlKey) nextRow = canEditSelected ? 0 : 1; }
    else if (event.key === "End") { nextColumn = 7; if (event.ctrlKey) nextRow = rows.length; }
    else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      if (row > 0 && column > 0) onEvent(event, weekDays[column - 1][0], rows[row - 1].time);
      return;
    } else return;
    event.preventDefault();
    nextRow = Math.max(canEditSelected ? 0 : 1, Math.min(rows.length, nextRow));
    nextColumn = Math.max(nextRow === 0 || !canEditSelected ? 1 : 0, Math.min(7, nextColumn));
    const key = `${nextRow}:${nextColumn}`;
    setActiveCell(key);
    grid.current?.querySelector(`[data-position="${key}"]`)?.focus();
  }
  const gridPosition = (row, column) => {
    const key = `${row}:${column}`;
    const [activeRow, activeColumn] = activeCell.split(":").map(Number);
    const effective = canEditSelected ? activeCell : `${Math.max(1, activeRow)}:${Math.max(1, activeColumn)}`;
    return { "data-position": key, tabIndex: key === effective ? 0 : -1, onFocus: () => setActiveCell(key) };
  };
  function dailyKeys(event, hour) {
    let next = hour;
    if (event.key === "ArrowDown") next++;
    else if (event.key === "ArrowUp") next--;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = rows.length - 1;
    else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { onEvent(event, weekDays[dayIndex][0], rows[hour].time); return; }
    else return;
    event.preventDefault();
    next = Math.max(0, Math.min(rows.length - 1, next));
    setActiveHour(next);
    daily.current?.querySelector(`[data-hour="${next}"]`)?.focus();
  }
  const icons = (cell) => <div className="nxt5-planning-cell-icons flex items-center justify-center gap-1">
    {cell.roles.map(({ role, player, lit, selectedRoleHere }) => <span key={role} title={player ? `${roleLabel(role)} · ${player.name}` : `${roleLabel(role)} · non lié`} className={cx("inline-flex items-center justify-center", lit ? "nxt5-planning-role-lit" : "nxt5-planning-role-dim", selectedRoleHere && "nxt5-planning-role-selected")}><RoleIcon role={role} lightweight className="h-4 w-4 shrink-0" /></span>)}
    {cell.staffUnit && <span title={cell.staffUnit.title} className={cx("nxt5-planning-staff-unit relative inline-flex items-center justify-center rounded-md border", cell.staffUnit.lit ? "border-fuchsia-200/55 bg-fuchsia-400/20 text-fuchsia-50" : "border-white/5 bg-black/12 text-slate-700 opacity-35 grayscale", cell.staffUnit.selectedStaffHere && "border-white/70 bg-white/20 text-white opacity-100 grayscale-0")}><BookOpen className="h-4 w-4 shrink-0" /></span>}
  </div>;
  return <>
    <div className="nxt5-planning-daily">
      <label className="nxt5-field"><span className="nxt5-field-label">Jour à afficher</span><select className="nxt5-input-shell" value={dayIndex} onChange={event => setDayIndex(Number(event.target.value))}>{weekDays.map(([,label,date], index) => <option key={index} value={index}>{label} {date.toLocaleDateString("fr-FR", {day:"2-digit",month:"2-digit"})}</option>)}</select></label>
      {canEditSelected && <Button variant="ghost" onClick={() => onDay(weekDays[dayIndex][0], (draftSlots[weekDays[dayIndex][0]] || []).length ? [] : rows.map(row => row.time))}>{(draftSlots[weekDays[dayIndex][0]] || []).length ? "Vider cette journée" : "Disponible toute la journée"}</Button>}
      <p className="text-sm text-slate-300">Flèches haut et bas pour parcourir les heures. Entrée pour modifier le créneau.</p>
      <div ref={daily} role="group" aria-label={`Créneaux du ${weekDays[dayIndex][1]}`} className="nxt5-planning-daily-slots">{rows.map((row, hour) => {
        const cell = row.cells[dayIndex];
        return <button type="button" key={row.time} data-hour={hour} disabled={!interactive} tabIndex={hour === activeHour ? 0 : -1} onFocus={() => setActiveHour(hour)} onKeyDown={event => dailyKeys(event, hour)} onClick={event => selectCell(event, cell)} onContextMenu={event => onEvent(event, cell.day, cell.time)} aria-label={cellLabel(cell)} aria-pressed={canEditSelected && !editingEvents ? cell.activeSlot : undefined} className={cx("nxt5-planning-daily-slot", frameTone(cell.slotEvent))}>
          <strong>{row.time}</strong><span>{cell.slotEventLabel || (cell.activeSlot ? "Disponible" : "Non renseigné")}</span>{icons(cell)}
        </button>;
      })}</div>
    </div>
    <div className="nxt5-planning-weekly">
      <p className="mt-4 text-sm text-slate-300">Au clavier : flèches pour parcourir la grille, Entrée pour modifier. Maj + F10 ouvre les séances.</p>
      <div className="nxt5-planning-scroll -mx-4 mt-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="region" aria-label="Planning hebdomadaire, défilement horizontal">
        <div className="nxt5-planning-frame"><div ref={grid} onKeyDown={gridKeys} role="group" aria-label="Disponibilités de la semaine" className="nxt5-keep-grid nxt5-planning-grid grid overflow-hidden rounded-lg border border-cyan-200/22">
          <div className="nxt5-planning-corner" />
          {weekDays.map(([day, label, date], index) => <button type="button" key={day} {...gridPosition(0,index + 1)} disabled={!canEditSelected} onClick={() => onDay(day, (draftSlots[day] || []).length ? [] : rows.map(row => row.time))} title={(draftSlots[day] || []).length ? "Vider la journée" : "Remplir la journée"} className="nxt5-planning-day-header px-1.5 py-1 text-center text-slate-300"><span className="block">{label}</span>{date.toLocaleDateString("fr-FR", {day:"2-digit",month:"2-digit"})}</button>)}
          {rows.map((row, rowIndex) => <React.Fragment key={row.time}>
            <button type="button" {...gridPosition(rowIndex + 1,0)} disabled={!canEditSelected} onClick={() => onTime(row.time)} title="Basculer cette heure sur toute la semaine" className="nxt5-planning-time text-white">{row.time}</button>
            {row.cells.map((cell, column) => <button type="button" key={cell.key} {...gridPosition(rowIndex + 1,column + 1)} disabled={!interactive} onClick={event => selectCell(event, cell)} onContextMenu={event => onEvent(event, cell.day, cell.time)} aria-label={cellLabel(cell)} aria-pressed={canEditSelected && !editingEvents ? cell.activeSlot : undefined} className={cx("nxt5-planning-cell relative min-h-14 overflow-hidden px-1 py-1 text-left", frameTone(cell.slotEvent), cell.dayIndex % 2 ? "nxt5-planning-day-alt" : "nxt5-planning-day-base")}>
              {cell.slotEvent && <span className="nxt5-planning-event-label">{cell.slotEventLabel}</span>}{icons(cell)}
            </button>)}
          </React.Fragment>)}
        </div></div>
      </div>
    </div>
  </>;
}
