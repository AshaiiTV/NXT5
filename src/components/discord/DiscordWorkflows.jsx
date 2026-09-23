import React from "react";
import { Badge, Surface } from "../ui/Core.jsx";

export function DiscordPlanningEvents({ events = [], teamId }) {
  const rows = events.filter(event => event.team_id === teamId);
  if (!rows.length) return null;
  return <Surface><section aria-label="Sessions de l’équipe">
    <h3 className="text-lg font-bold text-white">Sessions de l’équipe</h3>
    <p className="mt-1 text-sm leading-6 text-slate-300">Horaires et confirmations renseignés avec le bot Discord. Les disponibilités restent distinctes d’une confirmation de présence.</p>
    <ul className="mt-3 divide-y divide-white/10">
      {rows.map(event => <li key={event.id} className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0 flex-1 basis-60 break-words">
          <h4 className="font-semibold text-white">{event.title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-300"><time dateTime={event.starts_at}>{new Date(event.starts_at).toLocaleString("fr-FR", { timeZone: event.timezone || "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</time> · {event.duration_minutes} min · {event.timezone || "Europe/Paris"}</p>
          {event.details && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{event.details}</p>}
          {event.status === "cancelled" && event.cancellation_reason && <p className="mt-1 text-sm text-rose-200">{event.cancellation_reason}</p>}
        </div>
        <Badge tone={event.status === "cancelled" ? "red" : event.my_response === "present" ? "green" : "cyan"}>{event.status === "cancelled" ? "Annulée" : event.my_response === "present" ? "Présent" : event.my_response === "absent" ? "Absent" : event.my_response === "retard" ? `Retard · ${event.my_delay_minutes} min` : "Sans réponse"}</Badge>
      </li>)}
    </ul>
    <p className="mt-2 text-xs leading-5 text-slate-400">Pour modifier une session ou confirmer ta présence, utilise les commandes Événement et Présence du bot.</p>
  </section></Surface>;
}

export function DiscordProgressionGoals({ goals = [], teamId, playerId }) {
  const rows = goals.filter(goal => goal.team_id === teamId && (!goal.player_id || goal.player_id === playerId));
  if (!rows.length) return null;
  return <Surface><section aria-label="Objectifs définis par le staff">
    <h3 className="text-lg font-bold text-white">Consignes et objectifs du staff</h3>
    <ul className="mt-3 divide-y divide-white/10">{rows.map(goal => <li key={goal.id} className="min-w-0 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="min-w-0 flex-1 basis-48 break-words font-semibold text-white">{goal.title}</h4><Badge tone={goal.status === "completed" ? "green" : "purple"}>{goal.status === "completed" ? "Clôturé" : "En cours"}</Badge></div>
      <p className="mt-1 text-sm leading-6 text-slate-300">{goal.player_id ? "Objectif individuel" : "Objectif collectif"}{goal.due_at ? ` · Échéance : ${new Date(goal.due_at).toLocaleDateString("fr-FR")}` : ""}{goal.created_by_name ? ` · ${goal.created_by_name}` : ""}</p>
    </li>)}</ul>
    <p className="mt-2 text-xs leading-5 text-slate-400">Le suivi et la clôture de ces objectifs se font avec les commandes Objectifs du bot.</p>
  </section></Surface>;
}
