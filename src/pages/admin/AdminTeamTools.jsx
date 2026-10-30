import React, { useEffect, useRef, useState } from "react";

import { ArrowLeft, ArrowRight, Pencil, RefreshCw, Trash2 } from "lucide-react";

import { apiFetch } from "../../api/client.js";

import { Badge, Button, PageHeader, ReadingDetails, SelectInput, SkeletonRows, Surface, TextInput } from "../../components/ui/Core.jsx";

import { useAdminNavigationGuard } from "../../components/admin/AdminNavigationContext.jsx";

import { useLanguage } from "../../i18n/useLanguage.js";

import { t } from "../../i18n/translate.js";

import { getLocale } from "../../i18n/locale.js";

import "./admin-team-tools.css";



const endpoint="admin-team-tools";

const teamPath=id=>`/admin/equipes?teamId=${encodeURIComponent(id)}`;

const profilePath=id=>`/admin/comptes?profileId=${encodeURIComponent(id)}`;

const accountPath=id=>`/admin/comptes?userId=${encodeURIComponent(id)}`;

const date=value=>value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(getLocale(),{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"—";

const tabs=[["profiles","Profils"],["members","Membres et accès"],["matches","Parties"],["reports","Débriefs"],["compositions","Compositions"],["planning","Séances"],["goals","Objectifs"],["drafts","Drafts"]];

const memberRoles=[["captain","Capitaine"],["coach","Coach"],["assistant","Assistant coach"],["analyst","Analyste"],["manager","Manager"],["board","Direction"],["player","Joueur"],["viewer","Lecture seule"],["member","Membre"]];

const roleLabel=role=>t(role==="owner" ? "Responsable":memberRoles.find(([id])=>id===role)?.[1] || role);

const rosterLabel=value=>t({MAIN:"Titulaire",SUB:"Remplaçant",INACTIVE:"Inactif"}[value] || value);

const countLabels={members:"Accès membres",profiles:"Profils",matches:"Parties",reports:"Débriefs",compositions:"Compositions",planning:"Séances",goals:"Objectifs",drafts:"Drafts",archives:"Archives"};

function Panel({title,children,className=""}) {return <Surface variant="reading" className={`admin-directory-panel ${className}`}><h3>{t(title)}</h3>{children}</Surface>;}

function Notice({error,message,reload,busy}) {return <>{error && <div role="alert" className="admin-directory-error">{t(error)} <Button variant="ghost" disabled={busy} onClick={reload}>{t("Recharger le dossier")}</Button></div>}{message && <p role="status" className="admin-directory-success">{t(message)}</p>}</>;}

function Pagination({data,page,setPage,disabled}) {const total=data?.pagination.total || 0;return <div className="admin-directory-pagination"><span role="status">{t("{0} résultat(s)",[total])} · {t("Page {0} sur {1}",[page,Math.max(1,Math.ceil(total/20))])}</span><div><Button variant="ghost" disabled={disabled || page<=1} onClick={()=>setPage(page-1)}>{t("Précédente")}</Button><Button variant="ghost" disabled={disabled || page*20>=total} onClick={()=>setPage(page+1)}>{t("Suivante")}</Button></div></div>;}

function useResource(query,revision,validate) {

  const [state,setState]=useState({data:null,error:"",loading:true});

  useEffect(()=>{if(query===null)return;const controller=new AbortController();setState(previous=>({...previous,error:"",loading:true}));

    const timer=setTimeout(()=>apiFetch(`${endpoint}?${query}`,{signal:controller.signal}).then(data=>{

      if(!validate(data))throw new Error(t("Le dossier reçu est incomplet. Recharge-le."));

      if(!controller.signal.aborted)setState({data,error:"",loading:false});

    }).catch(error=>{if(!controller.signal.aborted)setState({data:null,error:error.message,loading:false});}),150);

    return()=>{clearTimeout(timer);controller.abort();};

  // Validation belongs to the resource type, not the changing render closure.

  },[query,revision]);

  return state;

}

function useMutation(onSuccess) {

  const [state,setState]=useState({busy:false,error:"",message:"",uncertain:false});

  const pending=useRef(false),mounted=useRef(true);

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);

  async function mutate(body) {

    if(pending.current || state.uncertain)return;

    pending.current=true;setState({busy:true,error:"",message:"",uncertain:false});

    try {const result=await apiFetch(endpoint,{method:"POST",body:JSON.stringify(body)});

      if(result.ok!==true)throw new Error(t("Résultat incertain. Recharge le dossier avant une nouvelle action."));

      if(mounted.current){setState({busy:false,error:"",message:"Action enregistrée.",uncertain:false});onSuccess(body.action);}

    } catch(error){if(mounted.current)setState({busy:false,error:error.message,message:"",uncertain:true});}

    finally{pending.current=false;}

  }

  return {...state,mutate,clear:()=>setState({busy:false,error:"",message:"",uncertain:false})};

}

function Impact({counts}) {return <dl className="admin-team-impact">{Object.entries(counts || {}).map(([key,value])=><div key={key}><dt>{t(countLabels[key] || key)}</dt><dd>{value}</dd></div>)}</dl>;}

function Confirmation({title,name,onConfirm,onCancel,busy,disabled,children}) {

  const [value,setValue]=useState("");const heading=useRef(null);

  useEffect(()=>{const source=document.activeElement;heading.current?.focus();return()=>{if(source?.isConnected)source.focus?.();};},[]);

  return <div className="admin-team-danger" role="region" aria-label={t(title)}><h3 tabIndex={-1} ref={heading}>{t(title)}</h3>{children}

    {name!==undefined && <TextInput label={t("Saisis le nom exact pour confirmer")} value={value} onChange={setValue} disabled={busy} autoComplete="off" />}

    <div className="admin-team-actions"><Button variant="danger" disabled={busy || disabled || (name!==undefined && value!==name)} onClick={()=>onConfirm(value)}>{busy ? t("Enregistrement…"):t("Confirmer cette action")}</Button><Button variant="ghost" disabled={busy} onClick={onCancel}>{t("Annuler")}</Button></div>

  </div>;

}



function TeamRows({view,rows,navigate,edit,busy}) {

  if(!rows.length)return <p className="admin-empty-copy">{t("Aucun élément pour ces filtres.")}</p>;

  return <ul className="admin-team-records">{rows.map(row=><li key={row.id}>

    {view==="profiles" ? <><div><strong>{row.name}</strong><p>{row.role} · {rosterLabel(row.roster_status)} · {row.riot_id || "—"}</p><p>{row.account_name || t("Sans compte lié")}</p></div><Button variant="ghost" disabled={busy} onClick={()=>navigate(profilePath(row.id))}>{t("Ouvrir le profil")}</Button></>

    :view==="members" ? <><div><strong>{row.name}</strong><p>{row.email}</p><Badge tone={row.role==="owner" ? "cyan":"slate"}>{roleLabel(row.role)}</Badge></div><div className="admin-team-actions"><Button variant="ghost" disabled={busy} onClick={()=>navigate(accountPath(row.id))}>{t("Voir le compte")}</Button>{row.role!=="owner" && <><Button variant="ghost" disabled={busy} onClick={()=>edit({action:"member-role",target:row,role:row.role})}>{t("Modifier les droits")}</Button><Button variant="ghost" disabled={busy} onClick={()=>edit({action:"member-remove",target:row})}>{t("Retirer l’accès")}</Button></>}</div></>

    :view==="matches" ? <ReadingDetails title={`${row.opponent || row.game_id} · ${row.result || "—"}`} description={`${row.game_id} · ${row.patch || "—"} · ${date(row.created_at)}`}><ul className="admin-team-participants">{(row.participants || []).map((p,index)=><li key={index}><strong>{p.name || "—"}</strong><span>{p.champion} · {p.role} · {p.side==="ALLY" ? t("Alliés"):t("Ennemis")} · {p.kills}/{p.deaths}/{p.assists}</span></li>)}</ul></ReadingDetails>

    :view==="reports" ? <ReadingDetails title={row.title} description={date(row.created_at)}><pre className="admin-team-copy">{row.content}</pre>{row.truncated && <p>{t("Aperçu limité aux 20 000 premiers caractères.")}</p>}</ReadingDetails>

    :view==="compositions" ? <ReadingDetails title={row.title} description={date(row.created_at)}><p className="admin-team-copy">{row.notes}</p><ul className="admin-team-participants">{(row.positions || []).map(slot=><li key={slot.role}><strong>{slot.role}</strong><span>{slot.player || "—"} · {slot.champion || "—"}</span></li>)}</ul></ReadingDetails>

    :view==="planning" ? <ReadingDetails title={row.title} description={`${date(row.starts_at)} · ${row.duration_minutes} min · ${row.status}`}><p className="admin-team-copy">{row.details}</p></ReadingDetails>

    :view==="goals" ? <div><strong>{row.title}</strong><p>{row.player_name} · {row.status} · {row.metric} : {row.target_value}</p></div>

    :<ReadingDetails title={`${row.source_id} · ${t("Partie")} ${row.game_number}`} description={date(row.imported_at)}>{[["Picks bleus",row.blue_picks],["Picks rouges",row.red_picks],["Bans bleus",row.blue_bans],["Bans rouges",row.red_bans]].map(([label,values])=><p key={label}><strong>{t(label)} : </strong>{Array.isArray(values) ? values.map(value=>typeof value==="string" ? value:"—").join(", "):"—"}</p>)}</ReadingDetails>}

  </li>)}</ul>;

}



function TeamDossier({id,navigate}) {

  const [deleted,setDeleted]=useState(false);

  const [view,setView]=useState("profiles"),[q,setQ]=useState(""),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[editor,setEditor]=useState(null);

  const resource=useResource(new URLSearchParams({teamId:id,view,q,page:String(page)}).toString(),revision,data=>data.team?.id===id && data.counts && Array.isArray(data.rows) && Number.isSafeInteger(data.pagination?.total));

  const {data,loading}=resource,team=data?.team;

  const mutation=useMutation(action=>{setEditor(null);if(action==="team-delete")setDeleted(true);else setRevision(value=>value+1);});

  const heading=useRef(null);useEffect(()=>{heading.current?.focus();},[id]);

  useAdminNavigationGuard({dirty:Boolean(editor),disabled:mutation.busy});

  const reload=()=>{setEditor(null);mutation.clear();setRevision(value=>value+1);};

  const submit=extra=>mutation.mutate({action:editor.action,teamId:id,expectedTeamRevision:team.revision,userId:editor.target?.id,expectedRevision:editor.target?.revision,...extra});

  const edit=value=>{setEditor(value);};

  if(deleted)return <Panel title="Équipe supprimée"><p role="status">{t("L’équipe et ses contenus ont été supprimés.")}</p><Button variant="ghost" onClick={()=>navigate("/admin/equipes")}>{t("Retour aux équipes")}</Button></Panel>;

  return <div className="admin-directory-stack admin-team-tools"><Button variant="ghost" icon={ArrowLeft} disabled={mutation.busy || Boolean(editor)} onClick={()=>navigate("/admin/equipes")}>{t("Retour aux équipes")}</Button>

    <PageHeader title={<span ref={heading} tabIndex={-1}>{team?.name || t("Dossier d’équipe")}</span>} subtitle={team ? `${team.tag} · ${team.region} · ${t("Responsable")} : ${team.owner_name}`:t("Contenu et administration de l’équipe.")}><Button icon={RefreshCw} variant="ghost" disabled={mutation.busy || Boolean(editor)} onClick={reload}>{t("Actualiser")}</Button></PageHeader>

    <Notice error={mutation.error || resource.error} message={mutation.message} reload={reload} busy={mutation.busy} />

    {!data && loading ? <SkeletonRows count={4} />:data && <>

      <Panel title="Contenu de l’équipe"><Impact counts={data.counts} /><p className="admin-caption">{t("Identifiant de l’équipe")} : {id}</p><div className="admin-team-actions"><Button variant="ghost" icon={Pencil} disabled={loading || Boolean(editor)} onClick={()=>edit({action:"team-update",name:team.name,tag:team.tag,region:team.region})}>{t("Modifier l’équipe")}</Button><Button variant="danger" icon={Trash2} disabled={loading || Boolean(editor)} onClick={()=>edit({action:"team-delete"})}>{t("Supprimer l’équipe")}</Button></div></Panel>

      {editor && <Panel title="Intervention administrateur">

        {editor.action==="team-update" ? <form onSubmit={event=>{event.preventDefault();void submit({name:editor.name,tag:editor.tag,region:editor.region});}} className="admin-team-form"><TextInput label={t("Nom de l’équipe")} value={editor.name} onChange={value=>setEditor({...editor,name:value})} minLength={2} maxLength={80} required disabled={mutation.busy} /><TextInput label={t("Tag")} value={editor.tag} onChange={value=>setEditor({...editor,tag:value})} maxLength={12} required disabled={mutation.busy} /><SelectInput label={t("Région")} value={editor.region} onChange={value=>setEditor({...editor,region:value})} disabled={mutation.busy}>{[...new Set([editor.region,"EUW","EUNE","NA","KR","BR","LAN","LAS","JP","OCE","TR","RU","SEA","TW","VN"])].map(region=><option key={region}>{region}</option>)}</SelectInput><div className="admin-team-actions"><Button type="submit" disabled={mutation.busy || mutation.uncertain}>{t("Enregistrer")}</Button><Button type="button" variant="ghost" disabled={mutation.busy} onClick={()=>setEditor(null)}>{t("Annuler")}</Button></div></form>

        :editor.action==="member-role" ? <form onSubmit={event=>{event.preventDefault();void submit({role:editor.role});}} className="admin-team-form"><h4>{editor.target.name}</h4><SelectInput label={t("Droits dans l’équipe")} value={editor.role} onChange={value=>setEditor({...editor,role:value})} disabled={mutation.busy}>{memberRoles.map(([role,label])=><option key={role} value={role}>{t(label)}</option>)}</SelectInput><p>{t("Ces droits contrôlent l’accès au contenu et aux outils de l’équipe.")}</p><div className="admin-team-actions"><Button type="submit" disabled={mutation.busy || mutation.uncertain}>{t("Enregistrer les droits")}</Button><Button type="button" variant="ghost" disabled={mutation.busy} onClick={()=>setEditor(null)}>{t("Annuler")}</Button></div></form>

        :<Confirmation key={editor.action} title={editor.action==="team-delete" ? "Supprimer définitivement cette équipe":"Retirer cet accès à l’équipe"} name={editor.action==="team-delete" ? team.name:undefined} busy={mutation.busy} disabled={mutation.uncertain} onCancel={()=>setEditor(null)} onConfirm={confirmName=>submit({confirmName,expectedCounts:data.counts})}>{editor.action==="team-delete" ? <><p>{t("Cette suppression est définitive. Tous les contenus de cette équipe, les profils, les accès et ses configurations seront supprimés. Les comptes utilisateurs sont conservés.")}</p><Impact counts={data.counts} /><p>{t("Les messages déjà publiés sur Discord restent sur Discord.")}</p></>:<p>{t("{0} perdra son accès à cette équipe. Ses profils seront déliés du compte et conservés dans l’effectif.",[editor.target.name])}</p>}</Confirmation>}

      </Panel>}

      <Panel title="Explorer l’équipe"><div className="admin-team-tabs" role="group" aria-label={t("Contenu de l’équipe")}>{tabs.map(([key,label])=><button type="button" key={key} disabled={mutation.busy || Boolean(editor)} aria-pressed={view===key} onClick={()=>{setView(key);setPage(1);setQ("");}}>{t(label)}</button>)}</div><TextInput label={t("Rechercher dans cette rubrique")} type="search" value={q} onChange={value=>{setQ(value);setPage(1);}} maxLength={120} disabled={mutation.busy || Boolean(editor)} />{loading ? <SkeletonRows count={3} />:<TeamRows view={view} rows={data.rows} navigate={navigate} edit={edit} busy={mutation.busy || Boolean(editor)} />}<Pagination data={data} page={page} setPage={setPage} disabled={loading || mutation.busy || Boolean(editor)} /></Panel>

    </>}

  </div>;

}



export function AdminProfileDetail({id,navigate}) {

  useLanguage();

  const [deleted,setDeleted]=useState(false);

  const [revision,setRevision]=useState(0),[form,setForm]=useState(null),[confirm,setConfirm]=useState("");

  const resource=useResource(`profileId=${encodeURIComponent(id)}`,revision,data=>data.profile?.id===id && [data.pool,data.goals,data.matches].every(Array.isArray));

  const profile=resource.data?.profile,heading=useRef(null);

  const mutation=useMutation(action=>{setConfirm("");if(action==="profile-delete")setDeleted(true);else{setForm(null);setRevision(value=>value+1);}});

  useEffect(()=>{if(profile)setForm({name:profile.name,riotId:profile.riot_id || "",role:profile.role,rosterStatus:profile.roster_status});},[profile]);

  useEffect(()=>{heading.current?.focus();},[id]);

  const dirty=Boolean(profile && form && (form.name!==profile.name || form.riotId!==(profile.riot_id || "") || form.role!==profile.role || form.rosterStatus!==profile.roster_status));

  useAdminNavigationGuard({dirty:!deleted && (dirty || Boolean(confirm)),disabled:mutation.busy});

  const reload=()=>{setConfirm("");mutation.clear();setRevision(value=>value+1);};

  const submit=(action,confirmName)=>mutation.mutate({action,teamId:profile.team_id,profileId:id,expectedTeamRevision:profile.team_revision,expectedRevision:profile.revision,...form,confirmName});

  if(deleted)return <Panel title="Profil supprimé"><p role="status">{t("Le profil et ses données associées ont été supprimés.")}</p><Button variant="ghost" onClick={()=>navigate(teamPath(profile.team_id))}>{t("Retour à l’équipe")}</Button></Panel>;

  return <div className="admin-directory-stack admin-team-tools"><Button variant="ghost" disabled={mutation.busy} icon={ArrowLeft} onClick={()=>navigate("/admin/comptes?view=profiles")}>{t("Retour aux profils")}</Button>

    <PageHeader title={<span tabIndex={-1} ref={heading}>{profile?.name || t("Dossier du profil")}</span>} subtitle={profile ? `${profile.role} · ${profile.team_name}`:t("Identité, équipe et données du profil.")} />

    <Notice error={mutation.error || resource.error} message={mutation.message} reload={reload} busy={mutation.busy} />

    {resource.loading ? <SkeletonRows count={3} />:profile && form && <>

      <div className="admin-account-columns"><Panel title="Modifier le profil"><form className="admin-team-form" onSubmit={event=>{event.preventDefault();void submit("profile-update");}}><TextInput label={t("Nom du profil")} value={form.name} onChange={value=>setForm({...form,name:value})} minLength={2} maxLength={80} disabled={mutation.busy} required /><TextInput label={t("Riot ID")} value={form.riotId} onChange={value=>setForm({...form,riotId:value})} maxLength={100} disabled={mutation.busy} /><SelectInput label={t("Poste ou fonction")} value={form.role} onChange={value=>setForm({...form,role:value})} disabled={mutation.busy}>{["TOP","JGL","MID","ADC","SUP","SUB","COACH","ASSISTANT","ANALYST","MANAGER","BOARD"].map(role=><option key={role}>{role}</option>)}</SelectInput><SelectInput label={t("Statut d’effectif")} value={form.rosterStatus} onChange={value=>setForm({...form,rosterStatus:value})} disabled={mutation.busy}>{["MAIN","SUB","INACTIVE"].map(status=><option key={status} value={status}>{rosterLabel(status)}</option>)}</SelectInput><p className="admin-caption">{t("Un staff est enregistré comme inactif et sans Riot ID. Un poste SUB reste remplaçant. Un titulaire déjà en place ne sera pas remplacé automatiquement.")}</p><Button type="submit" disabled={!dirty || mutation.busy || mutation.uncertain || Boolean(confirm)}>{t("Enregistrer le profil")}</Button></form></Panel>

        <Panel title="Équipe et compte lié"><h4>{profile.team_name}</h4><Button variant="ghost" disabled={mutation.busy} onClick={()=>navigate(teamPath(profile.team_id))}>{t("Explorer l’équipe")}</Button><p>{profile.account_name || t("Sans compte lié")}</p><p>{profile.email}</p>{profile.user_id && <div className="admin-team-actions"><Button variant="ghost" disabled={mutation.busy} onClick={()=>navigate(accountPath(profile.user_id))}>{t("Voir le compte")}</Button><Button variant="ghost" disabled={mutation.busy || dirty || Boolean(confirm)} onClick={()=>setConfirm("profile-unlink")}>{t("Délier le compte")}</Button></div>}<p className="admin-caption">{t("Créé le {0}",[date(profile.created_at)])}</p><p className="admin-record-id">{id}</p></Panel></div>

      {confirm && <Confirmation key={confirm} title={confirm==="profile-delete" ? "Supprimer définitivement ce profil":"Délier ce profil du compte"} name={confirm==="profile-delete" ? profile.name:undefined} busy={mutation.busy} disabled={mutation.uncertain} onCancel={()=>setConfirm("")} onConfirm={value=>submit(confirm,value)}><p>{t(confirm==="profile-delete" ? "Le profil, ses objectifs, ses disponibilités, son pool et ses notes seront supprimés. Les parties et le compte restent conservés ; les participants des parties seront déliés du profil.":"Le profil et ses données restent dans l’équipe. Le compte garde ses droits de membre, mais ne contrôle plus ce profil.")}</p></Confirmation>}

      <Panel title="Champions déclarés"><p className="admin-caption">{t("50 entrées maximum, classées par nombre de parties.")}</p><ul className="admin-team-records">{resource.data.pool.map(row=><li key={row.champion}><strong>{row.champion}</strong><span>{t("{0} parties · {1} victoires",[row.games,row.wins])}</span></li>)}</ul>{!resource.data.pool.length && <p>{t("Aucune donnée enregistrée.")}</p>}</Panel>

      <Panel title="Objectifs du profil"><p className="admin-caption">{t("50 derniers objectifs enregistrés.")}</p><TeamRows view="goals" rows={resource.data.goals} /></Panel>

      <Panel title="Dernières parties du profil"><p className="admin-caption">{t("20 dernières parties reliées à ce profil.")}</p><ul className="admin-team-records">{resource.data.matches.map(row=><li key={row.id}><div><strong>{row.opponent || row.game_id} · {row.result}</strong><p>{row.champion} · {row.role} · {row.kills}/{row.deaths}/{row.assists} · {date(row.created_at)}</p></div></li>)}</ul>{!resource.data.matches.length && <p>{t("Aucune donnée enregistrée.")}</p>}</Panel>

      <Panel title="Suppression du profil" className="admin-team-danger"><p>{t("Cette action supprime les données liées au profil dans cette équipe.")}</p><Button variant="danger" icon={Trash2} disabled={mutation.busy || dirty || Boolean(confirm)} onClick={()=>setConfirm("profile-delete")}>{t("Supprimer ce profil")}</Button></Panel>

    </>}

  </div>;

}



export default function AdminTeamTools({route,navigate}) {

  useLanguage();

  const params=new URLSearchParams(route.search),id=params.get("teamId");

  const [q,setQ]=useState(""),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[filter,setFilter]=useState(params.get("filtre") || "all");

  useEffect(()=>{setFilter(new URLSearchParams(route.search).get("filtre") || "all");setPage(1);},[route.search]);

  const resource=useResource(id ? null:new URLSearchParams({q,filter,page:String(page)}).toString(),revision,data=>Array.isArray(data.rows) && Number.isSafeInteger(data.pagination?.total));

  if(id)return <TeamDossier key={id} id={id} navigate={navigate} />;

  return <div className="admin-directory-stack admin-team-tools"><PageHeader title={t("Équipes")} subtitle={t("Retrouve une équipe, explore son contenu et gère ses accès.")}><Button variant="ghost" icon={RefreshCw} disabled={resource.loading} onClick={()=>setRevision(value=>value+1)}>{t("Actualiser")}</Button></PageHeader><Notice error={resource.error} reload={()=>setRevision(value=>value+1)} /><Panel title="Répertoire des équipes"><TextInput label={t("Rechercher une équipe")} placeholder={t("Nom, tag, région ou responsable…")} value={q} type="search" onChange={value=>{setQ(value);setPage(1);}} maxLength={120} /><SelectInput label={t("Filtrer les équipes")} value={filter} onChange={value=>{setFilter(value);setPage(1);}}>{[["all","Toutes"],["recent","Import récent"],["quiet","Sans import depuis 30 j"],["never","Aucun import"],["empty","Sans profils"]].map(([key,label])=><option key={key} value={key}>{t(label)}</option>)}</SelectInput>{resource.loading ? <SkeletonRows count={4} />:resource.data && <><ul className="admin-team-records">{resource.data.rows.map(row=><li key={row.id}><div><strong>{row.name} [{row.tag}]</strong><p>{row.region} · {row.owner_name}</p><p>{t("{0} profils · {1} parties",[row.profiles,row.matches])}</p></div><Button variant="ghost" icon={ArrowRight} onClick={()=>navigate(teamPath(row.id))}>{t("Explorer")}</Button></li>)}</ul>{!resource.data.rows.length && <p>{t("Aucun résultat")}</p>}<Pagination data={resource.data} page={page} setPage={setPage} /></>}</Panel></div>;

}

