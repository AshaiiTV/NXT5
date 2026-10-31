import React, { useEffect, useState } from "react";
import { Check, Plus, RefreshCw, Trophy, X } from "lucide-react";
import { Badge, Button, SelectInput, Surface, TextAreaInput, TextInput } from "../../components/ui/Core.jsx";
import { t } from "../../i18n/translate.js";
import { useLanguage } from "../../i18n/useLanguage.js";
import { NexusScheduleActions, NexusSeedFields } from "./NexusTournamentActions.jsx";

export const seasonStatusLabel = status => ({ draft: t("Brouillon"), open: t("Inscriptions ouvertes"), running: t("En cours"), completed: t("Terminée") })[status] || status;
const defaults = { name: "", format: "round_robin", legs: 1, regularBestOf: 1, playoffEnabled: true, playoffFormat: "single_elimination", playoffSize: 4, playoffBestOf: 3, finalBestOf: 5, groupCount: 2, advancePerGroup: 2, swissRounds: 3, doubleVariant: "standard", upperFinalBestOf: 3, resetFinal: true, rulesConfirmed: false, status: "draft" };
const formats = { round_robin: "Championnat", groups: "Poules", single_elimination: "Élimination simple", double_elimination: "Double élimination", swiss: "Rondes suisses", custom: "Calendrier libre" };
const configOf = season => Object.fromEntries(Object.keys(defaults).map(key => [key, season?.[key] ?? defaults[key]]));

function RulesFields({ value, onChange, disabled, locked = false }) {
  const direct = ["single_elimination", "double_elimination"].includes(value.format);
  const hasPlayoffs = direct || value.playoffEnabled;
  const double = value.format === "double_elimination" || (!direct && value.playoffFormat === "double_elimination");
  const nexusVariant = double && value.doubleVariant !== "standard";
  const sizes = double ? value.doubleVariant === "standard" ? [4,8,16] : [6] : [2,4,8,16];
  const inactive = disabled || locked;
  function changeFormat(format) {
    onChange("format", format);
    if (format === "single_elimination" && value.playoffSize === 6) onChange("playoffSize",4);
    if (format === "double_elimination") onChange("playoffSize",value.doubleVariant === "standard" ? 4 : 6);
    if (format === "groups") onChange("playoffEnabled",true);
  }
  return <div className="nexus-form-grid">
    <SelectInput label={t("Type de tournoi")} value={value.format} onChange={changeFormat} disabled={inactive}>{Object.entries(formats).map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</SelectInput>
    {["round_robin","groups"].includes(value.format) && <SelectInput label={t("Saison régulière")} value={value.legs} onChange={v => onChange("legs", Number(v))} disabled={inactive}><option value={1}>{t("Aller simple")}</option><option value={2}>{t("Aller-retour")}</option></SelectInput>}
    {!direct && <SelectInput label={t("Format des rencontres régulières")} value={value.regularBestOf} onChange={v => onChange("regularBestOf", Number(v))} disabled={inactive}>{[1,3,5].map(n => <option key={n} value={n}>BO{n}</option>)}</SelectInput>}
    {value.format === "groups" && <><TextInput type="number" label={t("Nombre de poules")} min={2} max={16} value={value.groupCount} onChange={v=>onChange("groupCount",Number(v))} required disabled={inactive}/>{value.playoffEnabled && <TextInput type="number" label={t("Qualifiés par poule")} min={1} max={8} value={value.advancePerGroup} onChange={v=>onChange("advancePerGroup",Number(v))} required disabled={inactive}/>}</>}
    {value.format === "swiss" && <TextInput type="number" label={t("Nombre de rondes suisses")} min={1} max={16} value={value.swissRounds} onChange={v=>onChange("swissRounds",Number(v))} required disabled={inactive}/>}
    {!direct && <label className="nexus-checkbox"><input type="checkbox" checked={value.playoffEnabled} disabled={inactive} onChange={event=>onChange("playoffEnabled",event.target.checked)}/><span>{t("Ajouter des playoffs après cette phase")}</span></label>}
    {hasPlayoffs && <>{!direct && <SelectInput label={t("Tableau des playoffs")} value={value.playoffFormat} onChange={v => { onChange("playoffFormat", v); onChange("playoffSize", v === "double_elimination" && value.doubleVariant !== "standard" ? 6 : 4); }} disabled={inactive}><option value="single_elimination">{t("Élimination simple")}</option><option value="double_elimination">{t("Double élimination")}</option></SelectInput>}
    {double && <SelectInput label={t("Variante de double élimination")} value={value.doubleVariant} onChange={v=>{onChange("doubleVariant",v);onChange("playoffSize",v === "standard" ? 4 : 6);}} disabled={inactive}><option value="standard">{t("Standard")}</option><option value="nexus_site">{t("Nexus bêta · site · 6 équipes")}</option><option value="nexus_pdf">{t("Nexus bêta · règlement PDF · 6 équipes")}</option></SelectInput>}
    <SelectInput label={t(direct ? "Taille du tableau" : "Équipes qualifiées en playoffs")} value={value.playoffSize} onChange={v => onChange("playoffSize", Number(v))} disabled={inactive}>{sizes.map(n => <option key={n} value={n}>{n}</option>)}</SelectInput>
    {nexusVariant ? <p className="nexus-muted">{t("Les premiers tours de la variante Nexus bêta se jouent en BO3.")}</p> : <SelectInput label={t("Format des playoffs")} value={value.playoffBestOf} onChange={v => onChange("playoffBestOf", Number(v))} disabled={inactive}>{[1,3,5].map(n => <option key={n} value={n}>BO{n}</option>)}</SelectInput>}
    <SelectInput label={t("Format des finales")} value={value.finalBestOf} onChange={v => onChange("finalBestOf", Number(v))} disabled={inactive}>{[1,3,5].map(n => <option key={n} value={n}>BO{n}</option>)}</SelectInput>
    {nexusVariant && <SelectInput label={t("Format de la finale du tableau supérieur")} value={value.upperFinalBestOf} onChange={v=>onChange("upperFinalBestOf",Number(v))} disabled={inactive}>{[1,3,5].map(n=><option key={n} value={n}>BO{n}</option>)}</SelectInput>}
    {double && !nexusVariant && <label className="nexus-checkbox"><input type="checkbox" checked={value.resetFinal} disabled={inactive} onChange={event=>onChange("resetFinal",event.target.checked)}/><span>{t("Rejouer la grande finale si le tableau inférieur gagne")}</span></label>}
    </>}
    <label className="nexus-checkbox nexus-rules-confirm"><input type="checkbox" checked={value.rulesConfirmed} disabled={inactive} onChange={event => onChange("rulesConfirmed",event.target.checked)} /><span>{t("Je confirme les règles choisies pour cette saison avant d’ouvrir ses inscriptions.")}</span></label>
  </div>;
}

function SeasonRules({ season, busy, action, onDirty }) {
  const [form, setForm] = useState(() => configOf(season));
  const dirty = JSON.stringify(form) !== JSON.stringify(configOf(season));
  useEffect(() => { onDirty?.(dirty); return () => onDirty?.(false); }, [dirty, onDirty]);
  useEffect(() => setForm(configOf(season)), [season]);
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  return <form className="nexus-form" onSubmit={event => { event.preventDefault(); action({ action: "updateSeason", seasonId: season.id, ...form }); }}>
    <TextInput label={t("Nom de la saison")} value={form.name} onChange={value => change("name", value)} required maxLength={120} disabled={busy} />
    <SelectInput label={t("État de la saison")} value={form.status} onChange={value => change("status", value)} disabled={busy}>{["draft","open","running","completed"].map(status => <option key={status} value={status} disabled={status !== "draft" && !form.rulesConfirmed}>{seasonStatusLabel(status)}</option>)}</SelectInput>
    <RulesFields value={form} onChange={change} disabled={busy} locked={season.scheduleGenerated} />
    {season.scheduleGenerated && <p className="nexus-muted">{t("Le calendrier existe : les formats sont désormais verrouillés.")}</p>}
    <div><Button type="submit" disabled={busy || !dirty}>{t("Enregistrer les règles")}</Button></div>
  </form>;
}

function SeedPlayoffs({ season, registrations, standings, busy, action, onDirty }) {
  const teams = registrations.filter(row => row.seasonId === season.id && row.status === "approved");
  const ranked = standings?.rows?.filter(row=>season.format !== "groups" || row.groupPosition <= season.advancePerGroup).sort((a,b)=>a.rank-b.rank).map(row => row.teamId).filter(id => teams.some(team => team.teamId === id)) || [];
  const [seeds, setSeeds] = useState(() => Array.from({ length: season.playoffSize }, (_, index) => ranked[index] || ""));
  const [note, setNote] = useState("");
  const [opened, setOpened] = useState(false);
  const [firstOpponent, setFirstOpponent] = useState("");
  const needsFirstChoice = season.playoffFormat === "double_elimination" && ["nexus_site","nexus_pdf"].includes(season.doubleVariant);
  const valid = seeds.length === season.playoffSize && seeds.every(Boolean) && new Set(seeds).size === seeds.length;
  useEffect(() => { onDirty?.(opened && (seeds.some(Boolean) || !!note)); return () => onDirty?.(false); }, [opened, seeds, note, onDirty]);
  return <div className="nexus-seeding"><Button icon={Trophy} variant="ghost" disabled={busy || teams.length < season.playoffSize || !!season.playoffBracket} onClick={() => setOpened(value => !value)}>{t(season.playoffBracket ? "Playoffs déjà générés" : "Préparer les playoffs")}</Button>
    {opened && !season.playoffBracket && <form className="nexus-form" onSubmit={event => { event.preventDefault(); if (!valid || (needsFirstChoice && ![3,4].includes(Number(firstOpponent)))) return; action({ action: "seedPlayoffs", seasonId: season.id, seeds, tieResolutionNote: note, ...(needsFirstChoice ? { firstSeedOpponent: Number(firstOpponent) } : {}) }, () => { setOpened(false); setNote(""); }); }}>
      <p className="nexus-muted">{t("Vérifie l’ordre des qualifiés avant de générer le tableau. Le serveur contrôle que la saison régulière est terminée.")}</p>
      <NexusSeedFields teams={teams} seeds={seeds} setSeeds={setSeeds} busy={busy} needsFirstChoice={needsFirstChoice} firstOpponent={firstOpponent} setFirstOpponent={setFirstOpponent}/>
      <TextAreaInput label={t("Décision de départage")} value={note} onChange={setNote} rows={3} minLength={standings?.ties?.length ? 10 : undefined} maxLength={2000} required={!!standings?.ties?.length} disabled={busy} />
      <p className="nexus-muted">{t("En cas d’égalité, indique le motif du départage validé par le staff.")}</p>
      <div><Button type="submit" disabled={busy || !valid || (!!standings?.ties?.length && note.trim().length < 10) || (needsFirstChoice && ![3,4].includes(Number(firstOpponent)))}>{t("Générer les playoffs")}</Button></div>
    </form>}
  </div>;
}

export function NexusSeasonManager({ data, seasonId, setSeasonId, busy, action, onDirtyChange }) {
  useLanguage();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaults);
  const [rulesDirty, setRulesDirty] = useState(false);
  const [seedsDirty, setSeedsDirty] = useState(false);
  const [calendarDirty, setCalendarDirty] = useState(false);
  const season = data.seasons?.find(item => item.id === seasonId);
  const dirty = rulesDirty || seedsDirty || calendarDirty || (showCreate && JSON.stringify(form) !== JSON.stringify(defaults));
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const registrations = (data.registrations || []).filter(row => row.seasonId === seasonId);
  const accepted = registrations.filter(row => row.status === "approved");
  const seasonStandings = (data.standings || []).filter(row => row.seasonId === seasonId);
  const standings = { rows:seasonStandings.flatMap(group=>group.rows.map((row,index)=>({...row,groupPosition:index+1}))), ties:seasonStandings.flatMap(group=>group.ties || []), qualificationBlocked:seasonStandings.some(group=>group.qualificationBlocked) };
  return <Surface variant="reading" className="nexus-card nexus-season-admin"><div className="nexus-section-title"><h2>{t("Saisons et inscriptions")}</h2><Button icon={Plus} variant="ghost" disabled={busy} onClick={() => setShowCreate(value => !value)}>{t(showCreate ? "Fermer le formulaire" : "Nouvelle saison")}</Button></div>
    {showCreate && <form className="nexus-form nexus-season-form" aria-label={t("Nouvelle saison")} onSubmit={event => { event.preventDefault(); action({ action: "createSeason", ...form }, result => { setForm(defaults); setShowCreate(false); setSeasonId(result.season.id); }); }}>
      <TextInput label={t("Nom de la saison")} value={form.name} onChange={name => setForm(previous => ({ ...previous, name }))} required disabled={busy} maxLength={120} />
      <div><Button variant="ghost" type="button" disabled={busy} onClick={() => setForm(previous => ({ ...previous, format:"round_robin",legs:1,regularBestOf:3,playoffEnabled:true,playoffFormat:"double_elimination",doubleVariant:"nexus_site",playoffSize:6,playoffBestOf:3,upperFinalBestOf:3,finalBestOf:5,resetFinal:false,rulesConfirmed:false }))}>{t("Reprendre le format bêta")}</Button></div>
      <p className="nexus-muted">{t("Le format bêta est un point de départ. Il ne confirme pas les règles de la Saison I.")}</p>
      <RulesFields value={form} onChange={(key,value) => setForm(previous => ({ ...previous, [key]: value }))} disabled={busy} />
      <p className="nexus-muted">{t("La saison sera créée en brouillon. Ouvre ensuite les inscriptions quand ses règles sont prêtes.")}</p>
      <div><Button type="submit" disabled={busy || !form.name.trim()}>{t("Créer le brouillon")}</Button></div>
    </form>}
    {!!data.seasons?.length && <SelectInput label={t("Saison à gérer")} value={seasonId} onChange={setSeasonId} disabled={busy || dirty}>{data.seasons.map(item => <option key={item.id} value={item.id}>{item.name} · {seasonStatusLabel(item.status)}</option>)}</SelectInput>}
    {!data.seasons?.length && <p className="nexus-empty-copy">{t("Crée une saison pour ouvrir les inscriptions des équipes NXT5.")}</p>}
    {season && <><div className="nexus-season-meta"><Badge tone="cyan">{seasonStatusLabel(season.status)}</Badge><span>{t("{0} équipes acceptées", [accepted.length])}</span><span>{t(formats[season.format] || "Championnat")}</span></div>
      <details className="nexus-roster"><summary>{t("Règles et état de la saison")}</summary><SeasonRules key={season.id} season={season} busy={busy} action={action} onDirty={setRulesDirty} /></details>
      <h3>{t("Candidatures des équipes")}</h3>{!registrations.length ? <p className="nexus-muted">{t("Aucune candidature reçue pour cette saison.")}</p> : <ul className="nexus-submissions">{registrations.map(row => <li key={row.id}><div><strong>{row.teamName}</strong><span>{row.status === "approved" ? t("Acceptée") : row.status === "rejected" ? t("Refusée") : t("À examiner")}</span></div>{row.status === "pending" && <><Button icon={Check} variant="ghost" disabled={busy || dirty || season.scheduleGenerated} onClick={() => action({ action: "approveRegistration", registrationId: row.id })}>{t("Accepter")}</Button><Button icon={X} variant="ghost" disabled={busy || dirty || season.scheduleGenerated} onClick={() => action({ action: "rejectRegistration", registrationId: row.id })}>{t("Refuser")}</Button></>}{row.status === "approved" && <Button variant="ghost" icon={RefreshCw} disabled={busy || dirty || season.status === "completed"} onClick={()=>action({action:"refreshRegistrationRoster",registrationId:row.id})}>{t("Actualiser l’effectif NXT5")}</Button>}</li>)}</ul>}
      <NexusScheduleActions key={season.id} season={season} teams={accepted} busy={busy || rulesDirty || seedsDirty} action={action} onDirty={setCalendarDirty}/>
      {season.playoffEnabled !== false && !["single_elimination","double_elimination"].includes(season.format) && <SeedPlayoffs key={`${season.id}:${season.playoffSize}:${!!season.playoffBracket}`} season={season} registrations={registrations} standings={standings} busy={busy || rulesDirty || calendarDirty} action={action} onDirty={setSeedsDirty} />}
    </>}
  </Surface>;
}

export function NexusStandings({ standings, teams = [] }) {
  useLanguage();
  const name = id => teams.find(team => team.id === id || team.teamId === id)?.name || teams.find(team => team.teamId === id)?.teamName || t("Équipe à déterminer");
  if (!standings?.rows?.length) return <Surface variant="reading" className="nexus-card"><p>{t("Le classement apparaîtra après la génération du calendrier.")}</p></Surface>;
  const title=standings.groupId ? t("Poule {0}",[String(standings.groupId).replace(/^group-/,"")]) : t("Classement de la saison régulière");
  const hasByes=standings.rows.some(row=>row.byes>0);
  return <Surface variant="reading" className="nexus-card"><h2>{title}</h2><p className="nexus-muted">{t("Seules les séries terminées à partir de résultats validés comptent au classement.")}</p><div className="nexus-stats" role="region" aria-label={title} tabIndex={0}><table><thead><tr><th scope="col">{t("Rang")}</th><th scope="col">{t("Équipe")}</th><th scope="col">{t("Points")}</th><th scope="col">{t("Séries gagnées")}</th><th scope="col">{t("Séries perdues")}</th><th scope="col">{t("Parties gagnées")}</th><th scope="col">{t("Parties perdues")}</th>{hasByes && <th scope="col">{t("Exemptions")}</th>}</tr></thead><tbody>{standings.rows.map(row => <tr key={row.teamId}><td>{row.rank}{row.tied ? " =" : ""}</td><th scope="row">{row.teamName || name(row.teamId)}</th><td>{row.points}</td><td>{row.seriesWon}</td><td>{row.seriesLost}</td><td>{row.gamesWon}</td><td>{row.gamesLost}</td>{hasByes && <td>{row.byes ?? 0}</td>}</tr>)}</tbody></table></div>{standings.qualificationBlocked && <p className="nexus-message">{t(standings.complete === false ? "Le classement est provisoire : des séries restent à terminer." : standings.ties?.some(tie=>tie.crossesQualification) ? "Des équipes sont à égalité. Le staff doit valider le départage avant les playoffs." : "Les qualifications seront confirmées lorsque toutes les conditions de la saison seront remplies.")}</p>}</Surface>;
}

export function NexusSwissByes({ season, standings = [] }) {
  const entries=(season?.swissState?.rounds || []).filter(round=>round.byes?.length);
  if(season?.format!=="swiss" || !entries.length)return null;
  const teams=standings.flatMap(group=>group.rows || []);
  return <div className="nexus-message nexus-byes"><h2>{t("Exemptions des rondes suisses")}</h2><ul>{entries.flatMap(round=>round.byes.map(id=><li key={`${round.round}:${id}`}>{t("Ronde {0} : {1} exemptée",[round.round,teams.find(team=>team.teamId===id)?.teamName || t("Équipe à déterminer")])}</li>))}</ul><p>{t("Les points d’exemption sont inclus dans le classement.")}</p></div>;
}

export function NexusPlayoffs({ fixtures = [], bracket, teams = [] }) {
  useLanguage();
  const played = fixtures.filter(fixture => fixture.stage === "playoff");
  const names = new Map(teams.map(team=>[team.teamId,team.teamName]));
  fixtures.forEach(fixture=>{if(fixture.teamAId && fixture.teamA)names.set(fixture.teamAId,fixture.teamA);if(fixture.teamBId && fixture.teamB)names.set(fixture.teamBId,fixture.teamB);});
  const matchLabel = key => played.find(fixture=>fixture.fixtureKey===key)?.label || t("Rencontre {0}",[bracket?.matches?.find(match=>match.key===key)?.order || key]);
  const sourceLabel = source => source?.type === "seed" ? names.get(source.teamId) || t("Tête de série {0}",[source.seed]) : source?.type === "winner" ? t("Vainqueur de {0}",[matchLabel(source.matchKey)]) : source?.type === "loser" ? t("Perdant de {0}",[matchLabel(source.matchKey)]) : t("Équipe à déterminer");
  const matches = bracket?.matches?.length ? bracket.matches.filter(match=>match.status!=="skipped").map(match=>{
    const fixture=played.find(item=>item.fixtureKey===match.key);
    return {id:match.key,label:matchLabel(match.key),round:match.round,bestOf:match.bestOf,bracketGroup:match.stage || "main",teamA:fixture?.teamA || names.get(match.teamAId) || sourceLabel(match.sourceA),teamB:fixture?.teamB || names.get(match.teamBId) || sourceLabel(match.sourceB),series:fixture?.series || match.result};
  }) : played;
  if (!matches.length) return <Surface variant="reading" className="nexus-card"><h2>{t("Playoffs")}</h2><p className="nexus-muted">{t("Le tableau sera disponible après la validation des équipes qualifiées.")}</p></Surface>;
  const groups=[...new Set(matches.map(match=>match.bracketGroup || "main"))].sort((a,b)=>["main","upper","lower","final","reset"].indexOf(a)-["main","upper","lower","final","reset"].indexOf(b));
  const labels={main:"Tableau des playoffs",upper:"Tableau supérieur",lower:"Tableau inférieur",final:"Grande finale",reset:"Finale rejouée si nécessaire"};
  return <div className="nexus-bracket-groups">{groups.map(group=><section key={group} aria-label={t(labels[group] || "Playoffs")}><h2>{t(labels[group] || "Playoffs")}</h2><div className="nexus-bracket">{[...new Set(matches.filter(match=>(match.bracketGroup || "main")===group).map(match=>match.round))].sort((a,b)=>a-b).map(round=><div className="nexus-bracket-round" key={round}><h3>{t("Ronde {0}",[round])}</h3>{matches.filter(match=>(match.bracketGroup || "main")===group && match.round===round).map(match=><Surface variant="reading" className="nexus-card" key={match.id}><p className="nexus-eyebrow">{match.label} · BO{match.bestOf}</p><div className="nexus-bracket-team"><strong>{match.teamA || t("Équipe à déterminer")}</strong><span>{match.series?.winsA ?? "—"}</span></div><div className="nexus-bracket-team"><strong>{match.teamB || t("Équipe à déterminer")}</strong><span>{match.series?.winsB ?? "—"}</span></div></Surface>)}</div>)}</div></section>)}</div>;
}
