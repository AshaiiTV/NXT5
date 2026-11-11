// Production components with fictitious data; never connects to a user account.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
if (!location.search.includes('reset-last')) await import('../../src/index.css');
const {Sidebar,Topbar}=await import('../../src/components/layout/AppChrome.jsx');
const {Surface,PageHeader,TextInput,SelectInput,TextAreaInput,Button}=await import('../../src/components/ui/Core.jsx');
const {PlayerUltimateProfile}=await import('../../src/pages/workspace/PlayerUltimateProfile.jsx');
const {AccountSettings}=await import('../../src/pages/workspace/AccountSettings.jsx');
const {Planning}=await import('../../src/pages/workspace/Planning.jsx');
const {createPlanningStore}=await import('../../src/utils/planning-store.js');
const {DEFAULT_DATA}=await import('../../src/app/constants.jsx');
if (location.search.includes('reset-last')) await import('../../src/index.css');
const team={id:'geometry',name:'Équipe fictive au nom particulièrement long'};
const user={id:'fixture-user',name:'Compte fictif',email:'joueur@example.test',email_verified:true};
const players=['TOP','JGL','MID','ADC','SUP'].map((role,i)=>({id:'p'+i,team_id:team.id,role,name:i===0?'Joueur fictif au nom particulièrement long':'Joueur fictif '+i,riot_id:'Fictif#EUW',user_id:i===0?user.id:undefined}));
const matches=Array.from({length:8},(_,i)=>({id:'m'+i,team_id:team.id,result:i%3?'Victoire':'Défaite',game_date:`2026-10-0${i+1}T12:00:00Z`,duration_seconds:1800,participants:[{player_id:'p0',team_key:'ALLY',role:'TOP',champion:'Jhin',kills:6+i,deaths:2,assists:5,cs_per_min:7+i/5,kill_participation:.69,damage:23000,gold:13000}]}));
const data={...DEFAULT_DATA,players,matches,teams:[team]};
const store=createPlanningStore({save:async body=>body});
function QA(){const [active,setActive]=useState(new URLSearchParams(location.search).get('view')||'controls'),[open,setOpen]=useState(false),[collapsed,setCollapsed]=useState(false),[value,setValue]=useState('');return <><Sidebar active={active} setActive={setActive} open={open} setOpen={setOpen} collapsed={collapsed} setCollapsed={setCollapsed} user={user} onLogout={()=>{}} currentMember={{role:'OWNER'}} currentTeamId={team.id}/><div className="nxt5-app-shell" style={{'--nxt5-sidebar-space':collapsed?'5rem':'16.5rem'}}><Topbar active={active} setOpen={setOpen} currentTeam={team} teams={[team]} onSelectTeam={()=>{}} onCreateTeam={()=>{}} onManageTeam={()=>{}} onHelp={()=>{}}/><main className="nxt5-workspace-main">
{active==='profile'?<PlayerUltimateProfile data={data} selectedTeamId={team.id} user={user} route={{path:'/mon-profil',search:'?player=p0'}} navigate={()=>{}}/>:active==='account-settings'?<AccountSettings user={user}/>:active==='planning'?<Planning data={data} selectedTeamId={team.id} user={user} currentMember={{role:'OWNER'}} planningStore={store} refreshAll={async()=>{}}/>:<><PageHeader title="Contrôles et alignements" subtitle="Exemple fictif avec les composants de production."/><Surface><div className="grid items-end gap-4 md:grid-cols-3" data-framing-row><TextInput label="Nom du joueur" value={value} onChange={setValue}/><SelectInput label="Catégorie" value="all" onChange={()=>{}}><option value="all">Toutes les parties</option></SelectInput><Button data-framing-action>Enregistrer</Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><TextInput label="Mot de passe" value={value} onChange={setValue} type="password"/><TextAreaInput label="Notes" value={value} onChange={setValue}/></div><div className="mt-6"><Button data-framing-long>Enregistrer les disponibilités de la prochaine session et prévenir les autres joueurs</Button></div></Surface></>}
</main></div></>}
createRoot(document.getElementById('root')).render(<QA/>);
