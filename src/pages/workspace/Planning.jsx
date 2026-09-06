import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, RefreshCw, CalendarDays, Trash2, Users } from "lucide-react";
import { PLANNING_DAYS, PLANNING_EVENT_TYPES, PLANNING_TIMES } from "../../app/constants.jsx";
import { RoleIcon } from "../../components/brand/BrandAssets.jsx";
import { Badge, Button, EmptyState, PageHeader, Surface } from "../../components/ui/Core.jsx";
import { cx, tone } from "../../app/helpers.js";
import { addDays, availabilityEvents, availabilitySlots, dateFromKey, dateKey, formatWeekRange, mondayOfWeek, planningEventKey, planningEventMeta } from "../../utils/planning.js";
import { usePlanningDraft } from "../../hooks/usePlanningDraft.js";
import { COMP_ROLES, sortPlayersByRole, canStaffManage, isGameplayRole, isStaffRole, normalizeProfileRole } from "./workspace-shared.jsx";
import { roleLabel } from "./shell-shared.jsx";

function formatPlanningDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function Planning({ data, selectedTeamId, planningStore, currentMember, user }) {
  const gameplayPlayers = useMemo(() => sortPlayersByRole((data.players || []).filter((player) => player.team_id === selectedTeamId && isGameplayRole(player.role))), [data.players, selectedTeamId]);
  const staffProfiles = useMemo(() => (data.players || []).filter((player) => player.team_id === selectedTeamId && isStaffRole(player.role)).sort((a, b) => String(roleLabel(a.role)).localeCompare(String(roleLabel(b.role))) || String(a.name || "").localeCompare(String(b.name || ""))), [data.players, selectedTeamId]);
  const players = useMemo(() => [...gameplayPlayers, ...staffProfiles], [gameplayPlayers, staffProfiles]);
  const planningUnitTotal = gameplayPlayers.length + (staffProfiles.length ? 1 : 0);
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
  const gameplayPlayersKey = gameplayPlayers.map((player) => `${player.id}:${player.role}:${player.name || ""}:${player.user_id || ""}`).join("|");
  const staffProfilesKey = staffProfiles.map((player) => `${player.id}:${player.role}:${player.name || ""}:${player.user_id || ""}`).join("|");
  const staffProfileIdSet = useMemo(() => new Set(staffProfiles.map((player) => String(player.id))), [staffProfilesKey]);
  const availabilityKey = availability.map((row) => `${row.id}:${row.player_id}:${row.updated_at || ""}`).join("|");
  const planningLookup = useMemo(() => {
    const slotsByPlayer = new Map();
    const playerIdsByCell = new Map();
    const events = {};
    for (const row of availability) {
      const playerId = String(row.player_id || "");
      const slots = availabilitySlots(row?.slots);
      slotsByPlayer.set(playerId, slots);
      for (const [day, times] of Object.entries(slots)) {
        for (const time of times || []) {
          const key = planningEventKey(day, time);
          const list = playerIdsByCell.get(key) || [];
          list.push(playerId);
          playerIdsByCell.set(key, list);
        }
      }
      for (const [key, event] of Object.entries(availabilityEvents(row?.slots))) {
        if (event?.label && !events[key]) events[key] = { ...event, playerId: row.player_id };
      }
    }
    return { slotsByPlayer, playerIdsByCell, events };
  }, [availabilityKey, playersKey]);
  const linkedGameplayPlayer = gameplayPlayers.find((player) => player.user_id && String(player.user_id) === String(user?.id || ""));
  const linkedStaffProfile = staffProfiles.find((player) => player.user_id && String(player.user_id) === String(user?.id || ""));
  const staffPlanningPlayer = linkedStaffProfile || staffProfiles.find((player) => String(player.role || "").toUpperCase() === "COACH") || staffProfiles[0] || null;
  const staffPlanningPlayerId = String(staffPlanningPlayer?.id || "");
  const canManagePlanningStaff = canStaffManage(currentMember?.role);
  const linkedPlayer = linkedGameplayPlayer || (staffPlanningPlayer && canManagePlanningStaff ? staffPlanningPlayer : linkedStaffProfile) || (currentMember ? { teamOnly: true } : null);
  const [eventMenu, setEventMenu] = useState(null);

  const selectedPlayer = linkedPlayer?.teamOnly ? null : linkedPlayer || null;
  const selectedIsStaff = selectedPlayer ? isStaffRole(selectedPlayer.role) : false;
  const selectedDisplayName = selectedIsStaff ? "Coaching Staff" : selectedPlayer?.name || "Profil non lié";
  const selectedDisplayRole = selectedIsStaff ? "Coaching Staff" : selectedPlayer ? roleLabel(selectedPlayer.role) : "Aucun profil";
  const staffPlanningAvailabilityExists = Boolean(staffPlanningPlayerId && availability.some((item) => String(item.player_id || "") === staffPlanningPlayerId));
  const eventStoreRow = availability.find((item) => Object.keys(availabilityEvents(item?.slots)).length);
  const eventStorePlayer = selectedPlayer || players.find((player) => player.id === eventStoreRow?.player_id) || gameplayPlayers[0] || staffProfiles[0] || null;
  const eventStoreAvailability = availability.find((item) => item.player_id === eventStorePlayer?.id) || null;
  const canEditSelected = Boolean(selectedPlayer && (String(selectedPlayer.user_id || "") === String(user?.id || "") || (selectedIsStaff && canManagePlanningStaff)));
  const canEditEvents = Boolean(currentMember && eventStorePlayer);
  const planningDraft = usePlanningDraft(planningStore, { teamId: selectedTeamId, playerId: eventStorePlayer?.id, weekStart: selectedWeek.start }, eventStoreAvailability);
  const { slots: draftSlots, events: slotEvents, notes, status: saveStatus, saving, setSlots: setDraftSlots, setEvents: setSlotEvents, setNotes } = planningDraft;

  useEffect(() => {
    setEventMenu(null);
  }, [selectedTeamId, eventStorePlayer?.id, selectedWeek.start]);

  useEffect(() => {
    if (!eventMenu) return undefined;
    function closeMenu() {
      setEventMenu(null);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setEventMenu(null);
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [eventMenu]);

  function slotList(playerId, day) {
    return planningLookup.slotsByPlayer.get(String(playerId || ""))?.[day] || [];
  }

  function toggleSlot(day, time) {
    if (!canEditSelected) return;
    setDraftSlots((current) => {
      const list = Array.isArray(current[day]) ? current[day] : [];
      const nextList = list.includes(time) ? list.filter((item) => item !== time) : PLANNING_TIMES.filter((item) => [...list, time].includes(item));
      return { ...current, [day]: nextList };
    });
    if ((draftSlots[day] || []).includes(time)) {
      setSlotEvents((current) => {
        const next = { ...current };
        delete next[planningEventKey(day, time)];
        return next;
      });
    }
  }

  function setDaySlots(day, times) {
    if (!canEditSelected) return;
    const nextTimes = PLANNING_TIMES.filter((time) => times.includes(time));
    setDraftSlots((current) => ({ ...current, [day]: nextTimes }));
    setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
      const [eventDay, eventTime] = key.split("|");
      return eventDay !== day || nextTimes.includes(eventTime);
    })));
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
    if (allActive) {
      setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key.split("|")[1] !== time)));
    }
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
      setSlotEvents({});
      return;
    }
    if (kind === "weekend") {
      const nextSlots = Object.fromEntries(weekDays.map(([day]) => [day, ["20:00", "21:00", "22:00", "23:00"].filter(() => ["SAT", "SUN"].includes(day))]));
      setDraftSlots(nextSlots);
      setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
        const [day, time] = key.split("|");
        return (nextSlots[day] || []).includes(time);
      })));
      return;
    }
    const times = presets[kind] || [];
    const nextSlots = Object.fromEntries(weekDays.map(([day]) => [day, PLANNING_TIMES.filter((time) => times.includes(time))]));
    setDraftSlots(nextSlots);
    setSlotEvents((current) => Object.fromEntries(Object.entries(current).filter(([key]) => {
      const [day, time] = key.split("|");
      return (nextSlots[day] || []).includes(time);
    })));
  }

  function openPlanningEventMenu(event, day, time) {
    event.preventDefault();
    if (!canEditEvents) return;
    setEventMenu({
      day,
      time,
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 260),
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
  }

  function teamEventFor(day, time) {
    const key = planningEventKey(day, time);
    return availability.map((row) => {
      const event = availabilityEvents(row?.slots)[key];
      return event?.label ? { ...event, playerId: row.player_id } : null;
    }).find(Boolean) || null;
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
    const playerCount = gameplayPlayers.filter((player) => availableIds.has(String(player.id))).length;
    const coachingStaffCount = staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId) ? 1 : 0;
    return playerCount + coachingStaffCount;
  };
  const bestCells = useMemo(() => weekDays.flatMap(([day]) => PLANNING_TIMES.map((time, timeIndex) => ({
    day,
    time,
    timeIndex,
    count: planningUnitCountForIds(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []),
  }))).sort((a, b) => b.count - a.count || a.timeIndex - b.timeIndex).slice(0, 4), [effectivePlayerIdsByCell, gameplayPlayers, staffProfiles, weekDays]);
  const selectedFilledSlots = useMemo(() => weekDays.reduce((sum, [day]) => sum + (draftSlots[day] || []).length, 0), [draftSlots, weekDays]);
  const selectedFilledDays = useMemo(() => weekDays.filter(([day]) => (draftSlots[day] || []).length).length, [draftSlots, weekDays]);
  const teamEvents = planningLookup.events;
  const visibleSlotEvents = useMemo(() => ({ ...teamEvents, ...slotEvents }), [teamEvents, slotEvents]);
  const selectedEventCount = useMemo(() => Object.keys(visibleSlotEvents).length, [visibleSlotEvents]);
  const fullTeamSlots = useMemo(() => {
    const target = Math.min(5, gameplayPlayers.length);
    if (!target) return 0;
    return weekDays.reduce((total, [day]) => total + PLANNING_TIMES.reduce((sum, time) => {
      const availableIds = new Set(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []);
      const playerCount = gameplayPlayers.filter((player) => availableIds.has(String(player.id))).length;
      return sum + (playerCount >= target ? 1 : 0);
    }, 0), 0);
  }, [effectivePlayerIdsByCell, gameplayPlayers, weekDays]);
  const staffAvailableSlots = useMemo(() => weekDays.reduce((total, [day]) => total + PLANNING_TIMES.reduce((sum, time) => {
    const availableIds = new Set(effectivePlayerIdsByCell.get(planningEventKey(day, time)) || []);
    return sum + (staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId) ? 1 : 0);
  }, 0), 0), [effectivePlayerIdsByCell, staffPlanningPlayerId, weekDays]);
  const eventMenuCurrent = eventMenu ? slotEvents[planningEventKey(eventMenu.day, eventMenu.time)] : null;
  const eventMenuDay = eventMenu ? weekDays.find(([day]) => day === eventMenu.day) : null;
  const roleSlots = useMemo(() => COMP_ROLES.map((role) => ({ role, player: gameplayPlayers.find((player) => normalizeProfileRole(player.role) === role) })), [gameplayPlayersKey]);
  const selectedRole = selectedIsStaff ? "" : normalizeProfileRole(selectedPlayer?.role);
  const selectedRoleLabel = selectedPlayer ? `${selectedDisplayRole} · ${selectedDisplayName}` : "Aucun profil";
  const frameTone = (slotEvent) => {
    if (slotEvent) return planningEventMeta(slotEvent.type).cell;
    return "bg-[#050914] text-slate-500";
  };
  const saveStatusMeta = saveStatus === "saving"
    ? { tone: "yellow", label: "Sauvegarde..." }
    : saveStatus === "dirty"
      ? { tone: "cyan", label: "Modification locale" }
      : saveStatus === "error"
        ? { tone: "red", label: "Erreur sauvegarde" }
        : saveStatus === "saved"
          ? { tone: "green", label: "Synchronisé" }
          : { tone: "slate", label: "Sauvegarde auto" };
  const planningGridRows = useMemo(() => PLANNING_TIMES.map((time) => ({
    time,
    cells: weekDays.map(([day], dayIndex) => {
      const key = planningEventKey(day, time);
      const activeSlot = (draftSlots[day] || []).includes(time);
      const availableIds = new Set(effectivePlayerIdsByCell.get(key) || []);
      const staffLit = Boolean(staffPlanningPlayerId && availableIds.has(staffPlanningPlayerId));
      const availableNames = [
        ...roleSlots.filter(({ player }) => player && availableIds.has(String(player.id))).map(({ role, player }) => `${roleLabel(role)} · ${player.name}`),
        staffLit ? "Coaching Staff" : null,
      ].filter(Boolean);
      const slotEvent = visibleSlotEvents[key];
      const slotEventLabel = slotEvent ? planningEventMeta(slotEvent.type).label : "";
      return {
        day,
        dayIndex,
        time,
        key,
        activeSlot,
        slotEvent,
        slotEventLabel,
        title: [slotEventLabel, availableNames.join(" · ") || "Aucun profil allumé"].filter(Boolean).join(" · "),
        roles: roleSlots.map(({ role, player }) => ({
          role,
          player,
          lit: Boolean(player && availableIds.has(String(player.id))),
          selectedRoleHere: selectedRole === role && activeSlot,
        })),
        staffUnit: staffPlanningPlayerId ? {
          lit: staffLit,
          selectedStaffHere: selectedIsStaff && activeSlot,
          title: staffLit ? "Coaching Staff disponible" : "Coaching Staff indisponible",
        } : null,
      };
    }),
  })), [draftSlots, effectivePlayerIdsByCell, roleSlots, selectedIsStaff, selectedRole, staffPlanningPlayerId, visibleSlotEvents, weekDays]);

  if (!selectedTeamId) return <EmptyState icon={CalendarDays} title="Aucune équipe sélectionnée" text="Choisis une équipe pour configurer les disponibilités." />;
  if (!players.length) return <EmptyState icon={Users} title="Aucun profil" text="Ajoute des joueurs ou du coaching staff pour construire le planning de team." />;
  if (!linkedPlayer) return <EmptyState icon={Users} title="Aucun profil lié" text="Les joueurs doivent être liés à un compte pour renseigner leurs disponibilités. Le coaching staff utilise désormais une seule entrée partagée dans le planning." />;

  return (
    <div>
      <PageHeader eyebrow="Équipe" title="Planning" subtitle="Disponibilités des joueurs, du coach et du staff.">
        <div className="flex flex-wrap gap-2">
          {weekOptions.map((week) => (
            <button key={week.id} type="button" onClick={() => setSelectedWeekStart(week.start)} className={cx("rounded-lg border px-2.5 py-1.5 text-left transition", selectedWeek.start === week.start ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/25 hover:text-white")}>
              <span className="block text-[0.62rem] font-black uppercase tracking-[0.14em]">{week.label}</span>
              <span className="mt-0.5 block text-xs font-semibold opacity-80">{week.range}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {bestCells[0]?.count > 0 && <Badge tone="cyan">Top créneau : {bestCells[0].count}/{planningUnitTotal}</Badge>}
          <Badge tone={fullTeamSlots ? "green" : "slate"}>{fullTeamSlots} slots 5 joueurs</Badge>
          {staffProfiles.length > 0 && <Badge tone={staffAvailableSlots ? "purple" : "slate"}>{staffAvailableSlots} slots CS</Badge>}
        </div>
      </PageHeader>
      {eventMenu && <div onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()} className="fixed z-[80] w-[210px] overflow-hidden rounded-2xl border border-cyan-200/22 bg-[#050814]/98 p-2 text-white shadow-[0_24px_70px_rgba(0,0,0,.70),0_0_34px_rgba(34,211,238,.16)] ring-1 ring-white/10 backdrop-blur-xl" style={{ left: eventMenu.x, top: eventMenu.y }}>
        <div className="px-2 pb-2 pt-1">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-cyan-100/80">Choisir un type</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-300">{eventMenuDay?.[1] || eventMenu.day} · {eventMenu.time}</p>
        </div>
        <div className="grid gap-1">
          {PLANNING_EVENT_TYPES.map((item) => <button key={item.id} type="button" onClick={() => applyPlanningEventType(item.id)} className="flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-cyan-200/20 hover:bg-white/[0.06]">
            <span className={cx("h-2.5 w-2.5 rounded-full", item.dot)} />
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-100">{item.label}</span>
          </button>)}
        </div>
        {eventMenuCurrent && <div className="mt-2 border-t border-white/10 pt-2">
          <button type="button" onClick={removePlanningEvent} className="flex w-full items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-500/10 px-2.5 py-2 text-left text-rose-100 transition hover:border-rose-200/35 hover:bg-rose-500/16">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-xs font-black uppercase tracking-[0.12em]">Supprimer</span>
          </button>
        </div>}
      </div>}

      <div className="space-y-5">
        

        <div className="space-y-5">
          <Surface glow className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-black text-white">Planning team</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{canEditSelected ? "Clique un créneau pour indiquer ta dispo. Clic droit = Scrim, Match ou Review." : "Lecture seule."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPlayer && <Badge tone={selectedIsStaff ? "purple" : "blue"}>{selectedDisplayRole}</Badge>}
                {staffProfiles.length > 0 && <Badge tone={staffAvailableSlots ? "purple" : "slate"}>{staffAvailableSlots} CS</Badge>}
                <Badge tone={selectedFilledSlots ? "cyan" : "slate"}>{selectedFilledSlots} slots</Badge>
                <Badge tone={selectedFilledDays >= 4 ? "green" : selectedFilledDays ? "purple" : "slate"}>{selectedFilledDays}/7 jours</Badge>
                <Badge tone={selectedEventCount ? "purple" : "slate"}>{selectedEventCount} event</Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/18 p-3">
              <div className="flex min-w-0 items-center gap-3">
                {selectedIsStaff ? <span title="Coaching Staff" className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-fuchsia-200/40 bg-gradient-to-br from-fuchsia-400/20 via-cyan-400/12 to-black/20 text-fuchsia-50 shadow-[0_0_18px_rgba(217,70,239,.16)]"><BookOpen className="h-4 w-4" /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rotate-45 rounded-[2px] border border-cyan-100/60 bg-cyan-200 shadow-[0_0_10px_rgba(125,211,252,.75)]" /></span> : <RoleIcon role={selectedPlayer?.role} className="h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{selectedDisplayName}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{selectedPlayer ? `${selectedDisplayRole} · ${selectedIsStaff ? "présence staff groupée" : "compte lié"}` : "Lie ton compte à un profil dans Gestion."}</p>
                </div>
              </div>
              <Badge tone={canEditSelected ? "green" : "slate"}>{canEditSelected ? (selectedIsStaff ? "Planning CS" : "Mon planning") : "Lecture seule"}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("evenings")} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50">Soirées</button>
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("scrim")} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50">Bloc scrim</button>
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("weekend")} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50">Week-end</button>
              <button type="button" disabled={!canEditSelected} onClick={() => applyAvailabilityPreset("clear")} className="rounded-lg border border-rose-300/15 bg-rose-500/10 px-2.5 py-1.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-rose-100 transition hover:border-rose-200/35 disabled:cursor-not-allowed disabled:opacity-50">Vider</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-300">Type de créneau</span>
              {PLANNING_EVENT_TYPES.map((item) => <span key={item.id} className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.1em] text-slate-100">{item.label}</span>)}
              <span className="ml-auto text-[0.62rem] font-black uppercase tracking-[0.14em] text-cyan-100">{selectedRoleLabel}</span>
            </div>
            <div className="nxt5-planning-scroll -mx-4 mt-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              <div className="nxt5-planning-frame">
                <div className="nxt5-keep-grid nxt5-planning-grid grid overflow-hidden rounded-lg border border-cyan-200/22 bg-cyan-300/18 shadow-[inset_0_0_0_1px_rgba(255,255,255,.045)] [contain:layout_paint]">
                  <div className="nxt5-planning-corner" />
                  {weekDays.map(([day, label, date], dayIndex) => {
                    const dayActive = (draftSlots[day] || []).length;
                    return <button key={day} type="button" disabled={!canEditSelected} onClick={() => setDaySlots(day, dayActive ? [] : PLANNING_TIMES)} title={dayActive ? "Vider la journée" : "Remplir la journée"} className={cx("nxt5-planning-day-header px-1.5 py-1 text-center text-[0.54rem] font-black uppercase tracking-[0.08em] transition", dayIndex % 2 ? "nxt5-planning-day-alt" : "nxt5-planning-day-base", dayActive ? "nxt5-planning-day-active text-cyan-50" : "text-slate-300 hover:text-white", !canEditSelected && "cursor-not-allowed opacity-70")} ><span className="block">{label}</span><span className="block text-[0.52rem] text-cyan-100/70">{formatPlanningDate(date)}</span></button>;
                  })}
                  {planningGridRows.map(({ time, cells }) => (
                    <React.Fragment key={time}>
                      <button type="button" disabled={!canEditSelected} onClick={() => setTimeForWeek(time)} title="Basculer cette heure sur toute la semaine" className="nxt5-planning-time flex items-center justify-center bg-[#08111f] px-1.5 py-0.5 text-[0.7rem] font-black text-white transition hover:bg-[#101b2d] disabled:cursor-not-allowed disabled:opacity-70">{time}</button>
                      {cells.map((cell) => {
                        const day = cell.day;
                        return <button key={cell.key} type="button" disabled={!canEditSelected && !canEditEvents} onClick={() => toggleSlot(day, time)} onContextMenu={(event) => openPlanningEventMenu(event, day, time)} title={cell.title} className={cx("nxt5-planning-cell relative min-h-[2.55rem] overflow-hidden px-1 py-1 text-left transition", cell.dayIndex % 2 ? "nxt5-planning-day-alt" : "nxt5-planning-day-base", frameTone(cell.slotEvent), !cell.slotEvent && "hover:bg-cyan-300/[0.055]", !canEditSelected && "cursor-context-menu opacity-90", !canEditSelected && !canEditEvents && "cursor-not-allowed opacity-70")} >
                          {cell.slotEvent && <span className="absolute left-1 top-0.5 text-[0.44rem] font-black uppercase tracking-[0.09em] opacity-75">{cell.slotEventLabel}</span>}
                          <div className="flex h-full flex-col items-center justify-center gap-1">
                            <div className="nxt5-planning-cell-icons flex items-center justify-center gap-1">
                              {cell.roles.map(({ role, player, lit, selectedRoleHere }) => {
                                return <span key={role} title={player ? `${roleLabel(role)} · ${player.name}` : `${roleLabel(role)} · non lié`} className={cx("inline-flex items-center justify-center transition", lit ? "nxt5-planning-role-lit" : "nxt5-planning-role-dim", selectedRoleHere && "nxt5-planning-role-selected")}>
                                  <RoleIcon role={role} lightweight className="h-4 w-4" />
                                </span>;
                              })}
                              {cell.staffUnit && <span title={cell.staffUnit.title} className={cx("nxt5-planning-staff-unit relative inline-flex items-center justify-center rounded-md border transition", cell.staffUnit.lit ? "border-fuchsia-200/55 bg-gradient-to-br from-fuchsia-400/30 via-cyan-400/14 to-black/10 text-fuchsia-50 shadow-[0_0_8px_rgba(217,70,239,.18)]" : "border-white/5 bg-black/12 text-slate-700 opacity-35 grayscale", cell.staffUnit.selectedStaffHere && "border-white/70 bg-white/20 text-white opacity-100 grayscale-0 shadow-[0_0_10px_rgba(255,255,255,.12)]")}><span className="nxt5-planning-staff-icon"><BookOpen /></span>{cell.staffUnit.lit && <span className="absolute right-0 top-0 h-1.5 w-1.5 rotate-45 rounded-[1px] bg-cyan-200 shadow-[0_0_5px_rgba(125,211,252,.72)]" />}</span>}
                            </div>
                          </div>
                        </button>;
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Note planning</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canEditSelected} rows={2} placeholder="Contraintes, retard possible, préférence de scrim..." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/24 px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35 disabled:cursor-not-allowed disabled:opacity-60" />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-400">Chaque clic est sauvegardé automatiquement. Clic droit sur un créneau = type de session.</p>
              <div className="flex items-center gap-2"><Badge tone={saveStatusMeta.tone}>{saveStatusMeta.label}</Badge>{saveStatus === "error" && <Button type="button" variant="ghost" icon={RefreshCw} onClick={planningDraft.save} disabled={saving}>Réessayer</Button>}</div>
            </div>
          </Surface>

          {false && null}
        </div>
      </div>
    </div>
  );
}

export { Planning, formatPlanningDate };
