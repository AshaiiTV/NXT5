import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button, SelectInput, TextInput } from "../../components/ui/Core.jsx";
import { t } from "../../i18n/translate.js";

export function NexusSeedFields({ teams, seeds, setSeeds, busy, needsFirstChoice, firstOpponent, setFirstOpponent }) {
  return <><div className="nexus-form-grid">{seeds.map((id,index) => <SelectInput key={index} label={t("Tête de série {0}", [index + 1])} value={id} required disabled={busy} onChange={value => setSeeds(previous => previous.map((current,i) => i === index ? value : current))}><option value="">{t("Choisir une équipe")}</option>{teams.map(team => <option key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</SelectInput>)}</div>
    {needsFirstChoice && <SelectInput label={t("Adversaire choisi par la tête de série 1")} value={firstOpponent} required disabled={busy} onChange={setFirstOpponent}><option value="">{t("Choisir entre les têtes de série 3 et 4")}</option>{[3,4].map(seed=><option key={seed} value={seed}>{t("Tête de série {0}",[seed])} · {teams.find(team=>team.teamId===seeds[seed-1])?.teamName || "—"}</option>)}</SelectInput>}
  </>;
}

function ManualFixture({ season, teams, busy, action, onDirty }) {
  const [teamAId,setTeamA]=useState("");
  const [teamBId,setTeamB]=useState("");
  const [label,setLabel]=useState("");
  const [round,setRound]=useState(1);
  const [bestOf,setBestOf]=useState(season.regularBestOf);
  const requestId=useRef(null);
  const dirty=!!(teamAId || teamBId || label);
  const valid=teamAId && teamBId && teamAId!==teamBId && label.trim() && Number.isInteger(round) && round>0 && round<=100;
  useEffect(()=>{onDirty?.(dirty);return()=>onDirty?.(false);},[dirty,onDirty]);
  return <form className="nexus-form nexus-manual-form" aria-label={t("Ajouter une rencontre")} onSubmit={event=>{event.preventDefault();if(!valid)return;const body={action:"createManualFixture",seasonId:season.id,teamAId,teamBId,round,bestOf,label:label.trim()};const key=JSON.stringify(body);if(requestId.current?.key!==key)requestId.current={key,id:crypto.randomUUID()};action({...body,requestId:requestId.current.id},()=>{requestId.current=null;setTeamA("");setTeamB("");setLabel("");});}}>
    <h3>{t("Ajouter une rencontre")}</h3><div className="nexus-form-grid">{[["Équipe A",teamAId,setTeamA],["Équipe B",teamBId,setTeamB]].map(([name,id,change])=><SelectInput key={name} label={t(name)} value={id} required onChange={change} disabled={busy}><option value="">{t("Choisir une équipe")}</option>{teams.map(team=><option key={team.teamId} value={team.teamId}>{team.teamName}</option>)}</SelectInput>)}<TextInput type="number" min={1} max={100} label={t("Ronde")} value={round} onChange={value=>setRound(Number(value))} disabled={busy} required/><SelectInput label={t("Format de la rencontre")} value={bestOf} onChange={value=>setBestOf(Number(value))} disabled={busy}>{[1,3,5].map(n=><option key={n} value={n}>BO{n}</option>)}</SelectInput></div>
    <TextInput label={t("Libellé de la rencontre")} value={label} onChange={setLabel} disabled={busy} required maxLength={120}/>
    {teamAId && teamAId===teamBId && <p className="nexus-error" role="alert">{t("Choisis deux équipes différentes.")}</p>}
    <div><Button type="submit" icon={Plus} disabled={busy || !valid}>{t("Ajouter au calendrier")}</Button></div>
  </form>;
}

export function NexusScheduleActions({ season, teams, busy, action, onDirty }) {
  const direct=["single_elimination","double_elimination"].includes(season.format);
  const [opened,setOpened]=useState(false);
  const [seeds,setSeeds]=useState([]);
  const [firstOpponent,setFirstOpponent]=useState("");
  const [manualDirty,setManualDirty]=useState(false);
  const needsFirstChoice=season.format==="double_elimination" && ["nexus_site","nexus_pdf"].includes(season.doubleVariant);
  const valid=seeds.length===season.playoffSize && seeds.length===teams.length && seeds.every(Boolean) && new Set(seeds).size===seeds.length && (!needsFirstChoice || [3,4].includes(Number(firstOpponent)));
  useEffect(()=>{onDirty?.(manualDirty || opened);return()=>onDirty?.(false);},[manualDirty,opened,onDirty]);
  const rounds=season.swissState?.rounds || [];
  const nextRound=rounds.length ? Math.max(...rounds.map(row=>row.round))+1 : 1;
  const swissDone=nextRound>season.swissRounds;
  return <>
    <div className="nexus-actions"><Button icon={CalendarDays} disabled={busy || teams.length<2 || season.scheduleGenerated} onClick={()=>{if(direct){setSeeds(teams.map(team=>team.teamId));setOpened(true);}else action({action:"generateSchedule",seasonId:season.id});}}>{t(season.scheduleGenerated ? "Calendrier généré" : season.format==="custom" ? "Initialiser le calendrier" : "Générer le calendrier")}</Button></div>
    {direct && opened && !season.scheduleGenerated && <form className="nexus-form" aria-label={t("Ordre du tableau initial")} onSubmit={event=>{event.preventDefault();if(valid)action({action:"generateSchedule",seasonId:season.id,seeds,...(needsFirstChoice?{firstSeedOpponent:Number(firstOpponent)}:{})},()=>setOpened(false));}}>
      <p className="nexus-muted">{t("Classe toutes les équipes acceptées dans l’ordre du tableau. Leur nombre doit correspondre à la taille choisie.")}</p>
      <NexusSeedFields teams={teams} seeds={seeds} setSeeds={setSeeds} busy={busy} needsFirstChoice={needsFirstChoice} firstOpponent={firstOpponent} setFirstOpponent={setFirstOpponent}/>
      <div className="nexus-actions"><Button type="submit" disabled={busy || !valid}>{t("Confirmer le tableau initial")}</Button><Button variant="ghost" disabled={busy} onClick={()=>setOpened(false)}>{t("Annuler")}</Button></div>
    </form>}
    {season.format==="custom" && season.scheduleGenerated && <ManualFixture season={season} teams={teams} busy={busy} action={action} onDirty={setManualDirty}/>}
    {season.format==="swiss" && season.scheduleGenerated && <div className="nexus-swiss"><p className="nexus-muted">{t("La prochaine ronde devient disponible après validation de toutes les séries de la ronde précédente.")}</p><Button variant="ghost" disabled={busy || swissDone} onClick={()=>action({action:"advanceSwissRound",seasonId:season.id,round:nextRound})}>{swissDone?t("Toutes les rondes sont générées"):t("Générer la ronde {0}",[nextRound])}</Button></div>}
    <p className="nexus-muted">{t("Le calendrier utilise les équipes acceptées. Programme ensuite chaque rencontre et sélectionne ses cinq joueurs par équipe.")}</p>
  </>;
}
