import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, RefreshCw, CalendarDays, Trash2, Users } from "lucide-react";
import { PLANNING_DAYS, PLANNING_EVENT_TYPES, PLANNING_TIMES } from "../../app/constants.jsx";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { Badge, Button, EmptyState, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { cx } from "../../app/helpers.js";
import { openAppPath } from "../../app/routing.js";
import { addDays, availabilityEvents, availabilitySlots, dateFromKey, dateKey, formatWeekRange, mondayOfWeek, planningEventKey, planningEventMeta } from "../../utils/planning.js";
import { usePlanningDraft } from "../../hooks/usePlanningDraft.js";
import { aggregatePlanningEvents } from "../../utils/planning-events.js";
import { planningRoleSlots, countAvailablePlanningRoles } from "../../utils/planning-roster.js";
import { sortPlayersByRole, canStaffManage, isGameplayRole, isStaffRole } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";
import "./Planning.css";
import { PlanningAvailabilityGrid } from "../../components/games/PlanningAvailabilityGrid.jsx";
import { DiscordPlanningEvents } from "../../components/discord/DiscordWorkflows.jsx";

const SESSION_LABELS = {
  scrim: { label: "Entraînement", detail: "Scrim d’équipe" },
  match: { label: "Match", detail: "Partie de compétition" },
  review: { label: "Débrief", detail: "Review des parties" },
};

function sessionLabel(event) {
  return SESSION_LABELS[event?.type]?.label || event?.label || "Séance";
}

function sessionGroupLabel(group) {
  return group?.events.map(sessionLabel).join(" · ") || "";
}

function formatPlanningDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function Planning({ data, selectedTeamId, planningStore, currentMember, user, refreshAll }) {
  const gameplayPlayers = useMemo(() => sortPlayersByRole((data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role))), [data.players, selectedTeamId]);
  const roleSlots = useMemo(() => planningRoleSlots(gameplayPlayers), [gameplayPlayers]);
  const representedRoles = roleSlots.filter(({ player }) => player).length;
  const staffProfiles = useMemo(() => (data.players || []).filter((player) => player.team_id === selectedTeamId && isStaffRole(player.role)).sort((a, b) => String(roleLabel(a.role)).localeCompare(String(roleLabel(b.role))) || String(a.name || "").localeCompare(String(b.name || ""))), [data.players, selectedTeamId]);
  const players = useMemo(() => [...gameplayPlayers, ...staffProfiles], [gameplayPlayers, staffProfiles]);
  const planningUnitTotal = representedRoles + (staffProfiles.length ? 1 : 0);
  const baseWeekStart = useMemo(() => mondayOfWeek(), []);
  const weekOptions = useMemo(() => [
    { id: "current", label: "Semaine en cours", start: dateKey(baseWeekStart), range: formatWeekRange(baseWeekStart) },
    { id: "next", label: "Semaine d’après", start: dateKey(addDays(baseWeekStart, 7)), range: formatWeekRange(addDays(baseWeekStart, 7)) },
  ], [baseWeekStart]);
  const [selectedWeekStart, setSelectedWeekStart] = useState(weekOptions[0].start);
  const selectedWeek = useMemo(() => weekOptions.find((week) => week.start === selectedWeekStart) || weekOptions[0], [selectedWeekStart, weekOptions]);
  const weekStartDate = useMemo(() => dateFromKey(selectedWeek.start), [selectedWeek.start]);
  const weekDays = useMemo(() => PLANNING_DAYS.map(([day, label], index) => [day, label, addDays(weekStartDate, index)]), [weekStartDate]);
  const availability = useMemo(() => (data.availability || []).filter((item) => {
    const itemWeek = item.week_start ? String(item.week_start).slice(0, 10) : weekOptions[0].start;
    return item.team_id === selectedTeamId && itemWeek === selectedWeek.start;
  }), [data.availability, selectedTeamId, selectedWeek.start, weekOptions]);
  const playersKey = players.map((player) => `${player.id}:${player.role}:${player.name || ""}:${player.user_id || ""}`).join("|");
  const staffProfilesKey = staffProfiles.map((player) => `${player.id}:${player.role}:${player.name || ""}:${player.user_id || ""}`).join("|");
  const staffProfileIdSet = useMemo(() => new Set(staffProfiles.map((player) => String(player.id))), [staffProfilesKey]);
  const availabilityKey = availability.map((row) => `${row.id}:${row.player_id}:${row.updated_at || ""}`).join("|");
  const planningLookup = useMemo(() => {
    const playerIdsByCell = new Map();
    for (const row of availability) {
      const playerId = String(row.player_id || "");
      const slots = availabilitySlots(row?.slots);
      for (const [day, times] of Object.entries(slots)) {
        for (const time of times || []) {
          const key = planningEventKey(day, time);
          const list = playerIdsByCell.get(key) || [];
          list.push(playerId);
          playerIdsByCell.set(key, list);
        }
      }
    }
    return { playerIdsByCell };
  }, [availabilityKey, playersKey]);
  const linkedGameplayPlayer = gameplayPlayers.find((player) => player.user_id && String(player.user_id) === String(user?.id || ""));
  const linkedStaffProfile = staffProfiles.find((player) => player.user_id && String(player.user_id) === String(user?.id || ""));
  const orderedStaff = [...staffProfiles].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const staffPlanningPlayer = orderedStaff.find((player) => String(player.role || "").toUpperCase() === "COACH") || orderedStaff[0] || null;
  const staffPlanningPlayerId = String(staffPlanningPlayer?.id || "");
  const canManagePlanningStaff = canStaffManage(currentMember?.role);
  const linkedPlayer = linkedGameplayPlayer || (staffPlanningPlayer && (canManagePlanningStaff || linkedStaffProfile) ? staffPlanningPlayer : null) || (currentMember ? { teamOnly: true } : null);
  const [eventMenu, setEventMenu] = useState(null);
  const [editingEvents, setEditingEvents] = useState(false);
  const [refreshingNotes, setRefreshingNotes] = useState(false);
  const eventMenuRef = useRef(null);
  const eventTriggerRef = useRef(null);

  const selectedPlayer = linkedPlayer?.teamOnly ? null : linkedPlayer || null;
  const selectedIsStaff = selectedPlayer ? isStaffRole(selectedPlayer.role) : false;
  const selectedDisplayName = selectedIsStaff ? "Encadrement" : selectedPlayer?.name || "Profil non lié";
  const selectedDisplayRole = selectedIsStaff ? "Encadrement" : selectedPlayer ? roleLabel(selectedPlayer.role) : "Aucun profil";
  const staffPlanningAvailabilityExists = Boolean(staffPlanningPlayerId && availability.some((item) => String(item.player_id || "") === staffPlanningPlayerId));
  const eventStoreRow = availability.find((item) => Object.keys(availabilityEvents(item?.slots)).length);
  const eventStorePlayer = selectedPlayer || players.find((player) => player.id === eventStoreRow?.player_id) || gameplayPlayers[0] || staffProfiles[0] || null;
  const eventStoreAvailability = availability.find((item) => item.player_id === eventStorePlayer?.id) || null;
  const canEditSelected = Boolean(selectedPlayer && (selectedIsStaff ? canManagePlanningStaff : String(selectedPlayer.user_id || "") === String(user?.id || "")));
  const canEditEvents = Boolean(eventStorePlayer && (canEditSelected || canManagePlanningStaff));
  const planningDraft = usePlanningDraft(planningStore, { teamId: selectedTeamId, playerId: eventStorePlayer?.id, weekStart: selectedWeek.start }, eventStoreAvailability);
  const { slots: draftSlots, events: slotEvents, notes, status: saveStatus, saving, setSlots: setDraftSlots, setEvents: setSlotEvents, setNotes } = planningDraft;
  const teamNotes = players.flatMap((player) => {
    const row = availability.find((item) => String(item.player_id) === String(player.id));
    const text = String(row?.notes || "").trim();
    return text ? [{ player, text, sharedStaff: String(player.id) === staffPlanningPlayerId }] : [];
  });

  async function refreshTeamNotes() {
    if (!refreshAll || refreshingNotes) return;
    setRefreshingNotes(true);
    try {
      // Confirm pending edits before loading the team's latest saved notes.
      if (await planningStore.flush()) await refreshAll();
    } finally {
      setRefreshingNotes(false);
    }
  }

  useEffect(() => {
    setEventMenu(null);
    setEditingEvents(false);
  }, [selectedTeamId, eventStorePlayer?.id, selectedWeek.start]);

  useEffect(() => {
    if (!eventMenu) return undefined;
    eventMenuRef.current?.querySelector("button")?.focus();
    function closeMenu() {
      setEventMenu(null);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setEventMenu(null);
        eventTriggerRef.current?.focus();
      }
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [eventMenu]);

  function toggleSlot(day, time) {
    if (!canEditSelected) return;
    setDraftSlots((current) => {
      const list = Array.isArray(current[day]) ? current[day] : [];
      const nextList = list.includes(time) ? list.filter((item) => item !== time) : PLANNING_TIMES.filter((item) => [...list, time].includes(item));
      return { ...current, [day]: nextList };
    });
  }

  function setDaySlots(day, times) {
    if (!canEditSelected) return;
    const nextTimes = PLANNING_TIMES.filter((time) => times.includes(time));
    setDraftSlots((current) => ({ ...current, [day]: nextTimes }));
  }

  function setTimeForWeek(time) {
    if (!canEditSelected) return;
    const allActive = weekDays.every(([day]) => (draftSlots[day] || []).includes(time));
    setDraftSlots((current) => {
      return Object.fromEntries(weekDays.map(([day]) => {
        const list = Array.isArray(current[day]) ? current[day] : [];
        const nextList = allActive ? list.filter((item) => item !== time) : PLANNING_TIMES.filter((item) => [...list, time].includes(item));
        return [day, nextList];
      }));
    });
  }

  function applyAvailabilityPreset(kind) {
    if (!canEditSelected) return;
    const presets = {
      evenings: ["20:00", "21:00", "22:00", "23:00"],
      scrim: ["19:00", "20:00", "21:00", "22:00"],
      weekend: [],
    };
    if (kind === "clear") {
      setDraftSlots({});
      return;
    }
    if (kind === "weekend") {
      const nextSlots = Object.fromEntries(weekDays.map(([day]) => [day, ["20:00", "21:00", "22:00", "23:00"].filter(() => ["SAT", "SUN"].includes(day))]));
      setDraftSlots(nextSlots);
      return;
    }
    const times = presets[kind] || [];
    const nextSlots = Object.fromEntries(weekDays.map(([day]) => [day, PLANNING_TIMES.filter((time) => times.includes(time))]));
    setDraftSlots(nextSlots);
  }

  function openPlanningEventMenu(event, day, time, trigger = event.currentTarget) {
    event.preventDefault();
    event.stopPropagation();
    if (!canEditEvents) return;
    eventTriggerRef.current = trigger;
    const rect = trigger.getBoundingClientRect();
    const pointerX = event.clientX || rect.left;
    const pointerY = event.clientY || rect.bottom;
    setEventMenu({
      day,
      time,
      x: Math.max(8, Math.min(pointerX, window.innerWidth - 236)),
      y: Math.max(8, Math.min(pointerY, window.innerHeight - 308)),
    });
  }

  function applyPlanningEventType(type) {
    if (!eventMenu || !canEditEvents) return;
    const { day, time } = eventMenu;
    const key = planningEventKey(day, time);
    const meta = planningEventMeta(type);
    setSlotEvents((currentEvents) => {
      const next = { ...currentEvents };
      next[key] = { label: meta.label, type };
      return next;
    });
    setEventMenu(null);
    eventTriggerRef.current?.focus();
  }

  function removePlanningEvent() {
    if (!eventMenu || !canEditEvents) return;
    const key = planningEventKey(eventMenu.day, eventMenu.time);
    setSlotEvents((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setEventMenu(null);
    eventTriggerRef.current?.focus();
  }

  const selectedPlayerId = String(selectedPlayer?.id || "");
  const effectivePlayerIdsByCell = useMemo(() => {
    const map = new Map();
    for (const [day] of weekDays) {
      for (const time of PLANNING_TIMES) {
        const key = planningEventKey(day, time);
        const baseIds = planningLookup.playerIdsByCell.get(key) || [];
        const hasStaffBase = staffPlanningAvailabilityExists && baseIds.some((id) => String(id) === staffPlanningPlayerId);
        const ids = new Set(baseIds.filter((id) => {
          const normalizedId = String(id);
          if (selectedPlayerId && normalizedId === selectedPlayerId) return false;
          return !staffProfileIdSet.has(normalizedId);
        }));
        if (!selectedIsStaff && hasStaffBase && staffPlanningPlayerId) ids.add(staffPlanningPlayerId);
        if (selectedPlayerId && (draftSlots[day] || []).includes(time)) ids.add(selectedIsStaff && staffPlanningPlayerId ? staffPlanningPlayerId : selectedPlayerId);
        map.set(key, Array.from(ids));
      }
    }
    return map;
  }, [draftSlots, planningLookup, selectedIsStaff, selectedPlayerId, staffPlanningAvailabilityExists, staffPlanningPlayerId, staffProfileIdSet, weekDays]);
  const planningUnitCountForIds = (ids = []) => {
    const availableIds = new Set(ids.map((id) => String(id)));
    const playerCount = countAvailablePlanningRoles(roleSlots, availableIds);
    const coachingStaffCount = staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId) ? 1 : 0;
    return playerCount + coachingStaffCount;
  };
  const bestCells = useMemo(() => weekDays.flatMap(([day]) => PLANNING_TIMES.map((time, timeIndex) => ({
    day,
    time,
    timeIndex,
    count: planningUnitCountForIds(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []),
  }))).sort((a, b) => b.count - a.count || a.timeIndex - b.timeIndex).slice(0, 4), [effectivePlayerIdsByCell, roleSlots, staffPlanningPlayerId, weekDays]);
  const selectedFilledSlots = useMemo(() => weekDays.reduce((sum, [day]) => sum + (draftSlots[day] || []).length, 0), [draftSlots, weekDays]);
  const selectedFilledDays = useMemo(() => weekDays.filter(([day]) => (draftSlots[day] || []).length).length, [draftSlots, weekDays]);
  const visibleSlotEvents = useMemo(() => aggregatePlanningEvents(availability, {
    playerId: eventStorePlayer?.id, events: slotEvents,
  }), [availability, eventStorePlayer?.id, slotEvents]);
  const selectedEventCount = useMemo(() => Object.values(visibleSlotEvents).reduce((total, group) => total + group.events.length, 0), [visibleSlotEvents]);
  const fullTeamSlots = useMemo(() => {
    const target = representedRoles;
    if (!target) return 0;
    return weekDays.reduce((total, [day]) => total + PLANNING_TIMES.reduce((sum, time) => {
      const availableIds = new Set(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []);
      const playerCount = countAvailablePlanningRoles(roleSlots, availableIds);
      return sum + (playerCount >= target ? 1 : 0);
    }, 0), 0);
  }, [effectivePlayerIdsByCell, roleSlots, representedRoles, weekDays]);
  const staffAvailableSlots = useMemo(() => weekDays.reduce((total, [day]) => total + PLANNING_TIMES.reduce((sum, time) => {
    const availableIds = new Set(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []);
    return sum + (staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId) ? 1 : 0);
  }, 0), 0), [effectivePlayerIdsByCell, staffPlanningPlayerId, weekDays]);
  const eventMenuCurrent = eventMenu ? slotEvents[planningEventKey(eventMenu.day, eventMenu.time)] : null;
  const eventMenuGroup = eventMenu ? visibleSlotEvents[planningEventKey(eventMenu.day, eventMenu.time)] : null;
  const eventMenuDay = eventMenu ? weekDays.find(([day]) => day === eventMenu.day) : null;
  const frameTone = (slotEvent) => {
    if (slotEvent?.conflict) return "bg-slate-500/10 text-slate-100 ring-1 ring-inset ring-slate-300/30";
    if (slotEvent) return planningEventMeta(slotEvent.type).cell;
    return "bg-[var(--nxt5-field)] text-slate-500";
  };
  const saveStatusMeta = saveStatus === "saving"
    ? { tone: "cyan", label: "Enregistrement…" }
    : saveStatus === "dirty"
      ? { tone: "cyan", label: "Modifications en attente" }
      : saveStatus === "error"
        ? { tone: "red", label: "Enregistrement impossible" }
        : saveStatus === "saved"
          ? { tone: "green", label: "Enregistré" }
          : { tone: "slate", label: "Enregistrement automatique" };
  const planningGridRows = useMemo(() => PLANNING_TIMES.map((time) => ({
    time,
    cells: weekDays.map(([day], dayIndex) => {
      const key = planningEventKey(day, time);
      const activeSlot = (draftSlots[day] || []).includes(time);
      const availableIds = new Set(effectivePlayerIdsByCell.get(key) || []);
      const staffLit = Boolean(staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId));
      const availableNames = [
        ...roleSlots.filter(({ player }) => player && availableIds.has(String(player.id))).map(({ role, player }) => `${roleLabel(role)} · ${player.name}`),
        staffLit ? "Encadrement" : null,
      ].filter(Boolean);
      const slotEvent = visibleSlotEvents[key];
      const slotEventLabel = sessionGroupLabel(slotEvent);
      return {
        day,
        dayIndex,
        time,
        key,
        activeSlot,
        slotEvent,
        slotEventLabel,
        title: [slotEventLabel, availableNames.join(" · ") || "Aucune disponibilité renseignée"].filter(Boolean).join(" · "),
        roles: roleSlots.map(({ role, player }) => ({
          role,
          player,
          lit: Boolean(player && availableIds.has(String(player.id))),
          selectedRoleHere: Boolean(player && selectedPlayerId && String(player.id) === selectedPlayerId && activeSlot),
        })),
        staffUnit: staffPlanningPlayerId ? {
          lit: staffLit,
          selectedStaffHere: selectedIsStaff && activeSlot,
          title: staffLit ? "Encadrement disponible" : "Encadrement sans disponibilité renseignée",
        } : null,
      };
    }),
  })), [draftSlots, effectivePlayerIdsByCell, roleSlots, selectedIsStaff, selectedPlayerId, staffPlanningPlayerId, visibleSlotEvents, weekDays]);

  if (!selectedTeamId || !players.length || !linkedPlayer) return <div className="space-y-4"><PageHeader eyebrow="Équipe" title="Planning" subtitle="Indique tes disponibilités pour organiser la prochaine séance." />{selectedTeamId && <DiscordPlanningEvents events={data.botEvents} teamId={selectedTeamId} />}<Surface><EmptyState icon={selectedTeamId ? Users : CalendarDays} title={!selectedTeamId ? "Choisis ton équipe" : !players.length ? "Ajoutez les premiers joueurs" : "Relie ton compte à ton profil"} text={!selectedTeamId ? "Ouvre ton équipe pour retrouver son planning." : !players.length ? "Le responsable ou le staff doit ajouter les profils des joueurs et de l’encadrement avant de remplir le planning." : "Demande au responsable de l’équipe de relier ton compte à ton profil joueur. L’encadrement partage une seule ligne de disponibilité."} /><div className="mt-4 flex justify-center"><Button type="button" variant="ghost" onClick={() => openAppPath("/equipes")}>{selectedTeamId ? "Voir mon équipe" : "Choisir une équipe"}</Button></div></Surface></div>;

  return (
    <div className="nxt5-data-dense nxt5-planning-page min-w-0">
      <PageHeader eyebrow="Équipe" title="Planning de l’équipe" subtitle="Indique quand tu es disponible, puis choisis les séances à organiser ensemble.">
        <div className="flex flex-wrap gap-2">
          {weekOptions.map((week) => (
            <button key={week.id} type="button" onClick={() => setSelectedWeekStart(week.start)} aria-pressed={selectedWeek.start === week.start} className={cx("nxt5-planning-week min-h-11 rounded-[2px] border px-3 py-2 text-left transition", selectedWeek.start === week.start ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/25 hover:text-white")}>
              <span className="block text-xs font-semibold">{week.label}</span>
              <span className="mt-0.5 block text-xs font-semibold opacity-80">{week.range}</span>
            </button>
          ))}
        </div>
      </PageHeader>
      <DiscordPlanningEvents events={data.botEvents} teamId={selectedTeamId} />
      {eventMenu && <div ref={eventMenuRef} role="group" aria-label="Type de séance" onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()} className="nxt5-planning-menu fixed z-[80] w-[228px] border border-cyan-200/22 p-2 text-white" style={{ left: eventMenu.x, top: eventMenu.y }}>
        <div className="px-2 pb-2 pt-1">
          <p className="text-sm font-semibold text-cyan-100">Ajouter une séance</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-300">{eventMenuDay?.[1] || eventMenu.day} · {eventMenu.time}</p>
          {eventMenuGroup && <p className="mt-2 text-sm text-slate-300">Déjà prévu : {sessionGroupLabel(eventMenuGroup)}.</p>}
          <p className="mt-2 text-sm text-slate-300">{selectedIsStaff ? "Tu modifies la séance de l’encadrement." : selectedPlayer ? "Tu modifies ta séance." : `Tu modifies la séance de ${eventStorePlayer?.name || "ce joueur"}.`} Les séances des autres profils sont conservées.</p>
        </div>
        <div className="grid gap-1">
          {PLANNING_EVENT_TYPES.map((item) => <button key={item.id} type="button" onClick={() => applyPlanningEventType(item.id)} className="flex min-h-11 w-full items-center gap-2 rounded-[2px] border border-transparent px-2.5 py-2 text-left transition hover:border-cyan-200/20 hover:bg-white/[0.06]">
            <span className={cx("h-2.5 w-2.5 rounded-full", item.dot)} />
            <span className="nxt5-planning-session-copy"><span>{SESSION_LABELS[item.id]?.label || item.label}</span><small>{SESSION_LABELS[item.id]?.detail}</small></span>
          </button>)}
        </div>
        {eventMenuCurrent && <div className="mt-2 border-t border-white/10 pt-2">
          <button type="button" onClick={removePlanningEvent} className="flex min-h-11 w-full items-center gap-2 rounded-[2px] border border-rose-300/15 bg-rose-500/10 px-2.5 py-2 text-left text-rose-100 transition hover:border-rose-200/35 hover:bg-rose-500/16">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold">Retirer cette séance · {sessionLabel(eventMenuCurrent)}</span>
          </button>
        </div>}
      </div>}

      <div className="space-y-5">
        

        <div className="space-y-5">
          <Surface>
            <section aria-labelledby="planning-team-notes-title">
              <div className="nxt5-planning-notes-heading">
                <div>
                  <h3 id="planning-team-notes-title" className="text-xl font-black text-white">Précisions de l’équipe</h3>
                  <p className="mt-1 text-xs text-slate-400">Notes enregistrées · {selectedWeek.range}</p>
                </div>
                {refreshAll && <Button type="button" variant="ghost" icon={RefreshCw} onClick={refreshTeamNotes} disabled={refreshingNotes}>{refreshingNotes ? "Actualisation…" : "Actualiser les précisions"}</Button>}
              </div>
              <div className={cx("nxt5-planning-notes-content", canEditSelected && "nxt5-planning-notes-editable")}>
                {teamNotes.length ? <ul className="nxt5-planning-notes-list">
                  {teamNotes.map(({ player, text, sharedStaff }) => <li key={player.id}>
                    <div className="nxt5-planning-note-author">
                      <span aria-hidden="true">{isStaffRole(player.role) ? <BookOpen className="h-5 w-5 text-fuchsia-200" /> : <RoleIcon role={player.role} className="h-5 w-5" />}</span>
                      <span>{sharedStaff ? "Encadrement" : player.name || "Joueur"}</span>
                      <span className="nxt5-planning-note-role">{sharedStaff ? "Note partagée du staff" : roleLabel(player.role)}</span>
                    </div>
                    <p className="nxt5-planning-note-text">{text}</p>
                  </li>)}
                </ul> : <p className="nxt5-planning-notes-empty">Aucune précision partagée pour cette semaine.</p>}
                {canEditSelected && <div className="nxt5-planning-note-editor">
                  <label htmlFor="planning-note" className="nxt5-field-label">{selectedIsStaff ? "Précisions de l’encadrement" : "Précisions sur tes disponibilités"}</label>
                  <textarea id="planning-note" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canEditSelected} maxLength={500} aria-describedby="planning-note-help" rows={3} placeholder="Ex. : disponible après 20 h, retard possible le jeudi…" className="nxt5-input-shell nxt5-control mt-2 w-full resize-y rounded-[10px] border border-white/10 bg-black/24 px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35" />
                  <p id="planning-note-help" className="mt-2 text-xs text-slate-400">Ces précisions sont visibles par toute l’équipe une fois enregistrées, pour la semaine affichée. 500 caractères maximum.</p>
                  <div className="nxt5-planning-save mt-3"><Badge tone={saveStatusMeta.tone}>{saveStatusMeta.label}</Badge>{saveStatus === "error" && <Button type="button" variant="ghost" icon={RefreshCw} onClick={planningDraft.save} disabled={saving}>Réessayer l’enregistrement</Button>}</div>
                </div>}
              </div>
            </section>
          </Surface>
          <Surface className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">{editingEvents || (!canEditSelected && canEditEvents) ? "Ajouter ou modifier une séance" : "Mes disponibilités"}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">{editingEvents || (!canEditSelected && canEditEvents) ? "Choisis un créneau, puis un entraînement, un match ou un débrief." : canEditSelected ? "Clique sur tes créneaux disponibles. Clique à nouveau pour les retirer." : "Tu peux consulter les disponibilités de l’équipe."}</p>
              </div>
              <div className="nxt5-planning-save" role="status" aria-live="polite"><Badge tone={saveStatusMeta.tone}>{saveStatusMeta.label}</Badge>{saveStatus === "error" && <Button type="button" variant="ghost" icon={RefreshCw} onClick={planningDraft.save} disabled={saving}>Réessayer</Button>}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {selectedIsStaff ? <span title="Encadrement" className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-fuchsia-200/40 bg-fuchsia-400/10 text-fuchsia-50 "><BookOpen className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rotate-45 rounded-[2px] border border-cyan-100/60 bg-cyan-200 " /></span> : <RoleIcon role={selectedPlayer?.role} className="h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-white">{selectedDisplayName}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{selectedPlayer ? `${selectedDisplayRole} · ${selectedIsStaff ? "disponibilités partagées par le staff" : "profil lié à ton compte"}` : "Demande au staff de relier ton compte à un profil joueur."}</p>
                </div>
              </div>
              <Badge tone={canEditSelected ? "green" : "slate"}>{canEditSelected ? (selectedIsStaff ? "Planning partagé du staff" : "Mon planning") : "Lecture seule"}</Badge>
            </div>
            <div className="nxt5-planning-actions">
              {canEditEvents && canEditSelected && <Button type="button" variant="ghost" icon={CalendarDays} aria-pressed={editingEvents} onClick={() => setEditingEvents((active) => !active)} className={editingEvents ? "border-cyan-200/45 bg-cyan-400/10 text-cyan-100" : ""}>{editingEvents ? "Revenir à mes disponibilités" : "Ajouter une séance"}</Button>}
              <p className="text-sm leading-6 text-slate-300">{selectedFilledSlots} créneaux renseignés sur {selectedFilledDays} jours · {selectedEventCount} séance{selectedEventCount > 1 ? "s" : ""}</p>
            </div>
            <PlanningAvailabilityGrid rows={planningGridRows} weekDays={weekDays} canEditSelected={canEditSelected} canEditEvents={canEditEvents} editingEvents={editingEvents} draftSlots={draftSlots} onDay={setDaySlots} onTime={setTimeForWeek} onToggle={toggleSlot} onEvent={openPlanningEventMenu} frameTone={frameTone} />
            {canEditSelected && !editingEvents && <details className="nxt5-planning-help"><summary>Remplir plusieurs créneaux à la fois</summary><p>Ces raccourcis remplacent tes disponibilités de la semaine affichée. Les séances sont conservées.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => applyAvailabilityPreset("evenings")}>Soirées · 20 h à 23 h</Button><Button type="button" variant="ghost" onClick={() => applyAvailabilityPreset("scrim")}>Entraînement · 19 h à 22 h</Button><Button type="button" variant="ghost" onClick={() => applyAvailabilityPreset("weekend")}>Week-end · 20 h à 23 h</Button><Button type="button" variant="danger" onClick={() => applyAvailabilityPreset("clear")}>Vider mes disponibilités</Button></div></details>}
            <details className="nxt5-planning-help">
              <summary>Lire le planning et les présences de l’équipe</summary>
              <p>Une icône claire signale une disponibilité ; une icône sombre, aucune disponibilité renseignée. Chaque poste représente son titulaire, ou un remplaçant actif si le poste n’a pas de titulaire. Le livre représente l’encadrement, avec une disponibilité partagée.</p>
              <p>Un clic sur un jour remplit ou vide cette journée. Un clic sur une heure fait la même chose pour toute la semaine. Un clic droit sur un créneau ouvre aussi les types de séance.</p>
              <p>Les séances différentes sur un même créneau sont affichées ensemble. Tu peux modifier ou retirer celle que tu as ajoutée ; les séances des autres membres sont conservées.</p>
              <div className="nxt5-planning-legend">{PLANNING_EVENT_TYPES.map((item) => <span key={item.id}><span aria-hidden="true" className={cx("h-2 w-2 rounded-full", item.dot)} />{SESSION_LABELS[item.id]?.label || item.label}</span>)}</div>
              <div className="nxt5-planning-legend">{bestCells[0]?.count > 0 && <Badge tone="cyan">Présences maximum : {bestCells[0].count}/{planningUnitTotal}</Badge>}<Badge tone={fullTeamSlots ? "green" : "slate"}>{fullTeamSlots} créneaux avec {representedRoles} joueurs</Badge>{staffProfiles.length > 0 && <Badge tone={staffAvailableSlots ? "purple" : "slate"}>{staffAvailableSlots} créneaux avec encadrement</Badge>}</div>
            </details>
          </Surface>

        </div>
      </div>
    </div>
  );
}

export { Planning, formatPlanningDate };
