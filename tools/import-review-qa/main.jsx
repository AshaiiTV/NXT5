// Production import review with fictitious data; never connects to a user account.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
await import('../../src/index.css');
const roles=['TOP','JGL','MID','ADC','SUP'];
const champions={BLUE:['Aatrox','LeeSin','Ahri','Jinx','Lulu'],RED:['Garen','Vi','Lux','Ashe','Leona']};
const recognized=!location.search.includes('unknown');
const match={gameId:'EUW1_7000000001',teams:['BLUE','RED'].map((side,s)=>({side,win:side==='BLUE',participants:roles.map((role,i)=>({participantId:s*5+i+1,teamPosition:role,champion:champions[side][i],riotId:side==='BLUE'?`Joueur fictif ${i+1}#EUW`:`Adversaire ${i+1}#EUW`,summonerName:''}))}))};
// Stub network: preview upload (XHR) and JSON API calls (fetch).
class FakeXHR{constructor(){this.upload={};}open(m,u){this.url=u;}setRequestHeader(){}send(){setTimeout(()=>{this.status=200;this.responseText=JSON.stringify({match});this.onload?.();},50);}abort(){}}
window.XMLHttpRequest=FakeXHR;
window.fetch=async()=>new Response(JSON.stringify({opponents:[{id:'o1',name:'Otters'}],data:{}}),{status:200,headers:{'Content-Type':'application/json'}});
const {ImportGameFlow,GameOperationDialog}=await import('../../src/pages/workspace/GameOperations.jsx');
await import('../../src/pages/workspace/games-workspace.css');
const {DEFAULT_DATA}=await import('../../src/app/constants.jsx');
const team={id:'qa',name:'Équipe fictive'};
const user={id:'u',name:'Compte fictif'};
const players=roles.map((role,i)=>({id:'p'+i,team_id:team.id,role,name:'Joueur fictif '+(i+1),riot_id:recognized?`Joueur fictif ${i+1}#EUW`:''}));
const data={...DEFAULT_DATA,players,teams:[team],teamMembers:[{team_id:team.id,user_id:user.id,role:'OWNER'}],matchCategories:[{id:'c1',team_id:team.id,name:'Scrim',color:'cyan',is_default:true},{id:'c2',team_id:team.id,name:'Ligue',color:'violet'}]};
function QA(){const [received]=useState({payload:{label:'Scrim contre Otters · Partie 1',metadata:{}},submission:null});return <main className="nxt5-workspace-main"><GameOperationDialog className="game-import-dialog" title="Importer une partie" onClose={()=>{}}><ImportGameFlow data={data} selectedTeamId={team.id} refreshAll={async()=>{}} pushToast={()=>{}} currentMember={{role:'OWNER',team_id:team.id,user_id:user.id}} user={user} onImported={()=>{}} receivedImport={received} onReceivedImportConsumed={()=>{}}/></GameOperationDialog></main>;}
createRoot(document.getElementById('root')).render(<QA/>);
