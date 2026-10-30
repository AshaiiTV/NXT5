import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const output=path.resolve('artifacts/admin-redesign');
await fs.mkdir(output,{recursive:true});
const id='00000000-0000-4000-8000-000000000002';
const now='2026-10-30T12:00:00Z';
const account={id,name:'Camille Martin',account_name:'camille',email:'camille@example.test',email_verified:true,created_at:'2026-09-01',last_active_at:now,active_sessions:3,revision:'1',team_count:2,profile_count:1};
const names=['Ahri','Jinx','Vi','Ornn','Rakan','Azir','Ashe','Lux','Sona','Zed'];
const played=names.map((name,index)=>({champion:name,name,picks:140-index*11,wins:70-index*5,knownResults:130-index*10,rate:15-index,winRate:54+index/2}));
const totalSelections=played.reduce((sum,row)=>sum+row.picks,0);played.forEach(row=>{row.rate=row.picks/totalSelections*100;row.winRate=row.wins/row.knownResults*100;});
const stats={played,picks:played.map((row,index)=>({...row,count:100-index*8,rate:72-index*5})),bans:played.map((row,index)=>({...row,count:90-index*7,rate:65-index*5})),gameBans:played.map((row,index)=>({...row,count:90-index*7,rate:65-index*5})),coverage:{banGames:136,games:153,imports:178,selections:totalSelections,pickDrafts:139,banDrafts:125,totalDrafts:146,unknownSelections:0,excludedDrafts:7},period:{from:'2026-09-30T12:00:00Z',to:now,days:30,patch:'',role:'ALL'},patches:['16.15','16.14']};
const fixture=`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';import AdministrationPage from '/src/pages/admin/AdministrationPage.jsx';
function View(){const [route,setRoute]=React.useState({path:new URLSearchParams(location.search).get('page')||'/admin/comptes',search:new URLSearchParams(location.search).get('query')||''});return React.createElement(AdministrationPage,{route,navigate:path=>{const u=new URL(path,location.origin);setRoute({path:u.pathname,search:u.search});},user:{id:'admin',name:'Sacha',is_platform_admin:true},onLogout:()=>{}});}createRoot(document.getElementById('root')).render(React.createElement(View));`;
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{
  name:'admin-review-fixture',resolveId(id){if(id==='/__admin-review.js')return '\0admin-review';},load(id){if(id==='\0admin-review')return fixture;},
  configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,'http://localhost');
    const send=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    if(url.pathname==='/__admin-review.html'){res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,'<!doctype html><html lang="fr"><head><!--seo:start--><!--seo:end--><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__admin-review.js"></script></body></html>'));return;}
    if(url.pathname.endsWith('/admin-global-stats')){send(stats);return;}
    if(url.pathname.endsWith('/admin-directory')){
      if(req.method==='POST'){send({ok:true,revoked:3});return;}
      if(url.searchParams.has('userId')){send({account,teams:[{id:'team',name:'Équipe Orion',tag:'ORN',role:'captain'}],profiles:[{id:'profile',name:'Camille',role:'MID',riot_id:'Camille#TEST',team_name:'Équipe Orion'}],activity:[{id:'event',action:'admin.account.rename',created_at:now,actor_name:'Sacha',entity_type:'user'}]});return;}
      if(url.searchParams.get('view')==='journal'){send({rows:Array.from({length:8},(_,i)=>({id:i,action:i%2?'admin.sessions.revoke':'admin.account.rename',actor_name:'Sacha',entity_type:'user',created_at:now,user_id:id})),pagination:{total:8}});return;}
      const profiles=url.searchParams.get('view')==='profiles';send({rows:Array.from({length:8},(_,i)=>profiles?{id:'profile-'+i,user_id:id,name:['Camille','Julien','Nadia','Thomas'][i%4],role:['MID','TOP','JGL','COACH'][i%4],riot_id:'Profil#TEST',team_name:['Orion','Nova'][i%2],email:'profil@example.test'}:{...account,id:i ? 'account-'+i:id,name:['Camille Martin','Julien Moreau','Nadia Leroy','Thomas Bernard'][i%4],email_verified:i%3!==0,email:['camille','julien','nadia','thomas'][i%4]+'@example.test'}),pagination:{total:46}});return;
    }
    if(url.pathname.endsWith('/admin-dashboard')){send({generatedAt:now,totals:{users:248,teams:42,players:237,matches:1530},activity:{activeUsers7d:64,activeUsers30d:182,activeTeams30d:28},growth:{days30:{users:38,teams:7,matches:153}},adoption:{matches:35,reports:28},teamDirectory:[],daily:Array.from({length:30},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,matches:(i*7)%21,users:i%4,teams:i%3})),inactivityReminders:{},accountFunnel:{verified:213,usersInTeam:186}});return;}
    next();
  });}
}]});
let browser;
try {
  await server.listen();browser=await chromium.launch({headless:true});
  const checks=[];
  for(const width of [320,390,768,1440,1920])for(const [label,pagePath,query] of [['overview','/admin',''],['accounts','/admin/comptes',''],['account','/admin/comptes','?userId='+id],['stats','/admin/stats-globales',''],['journal','/admin/journal','']]){
    const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]+'__admin-review.html?'+new URLSearchParams({page:pagePath,query}));
    await page.locator('.administration-page .nxt5-page-title').waitFor();
    if(label==='stats')await page.locator('.global-stats-rank').first().waitFor();
    if(label==='accounts')await page.locator('.admin-directory-table tbody tr').first().waitFor();
    if(label==='account')await page.locator('.admin-account-banner').waitFor();
    if(label==='journal')await page.locator('.admin-activity-list li').first().waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,links:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href'))}));
    assert(geometry.scrollWidth<=width+1,`${label} overflows at ${width}: ${geometry.scrollWidth}`);
    assert(!geometry.links.some(link=>/calendrier|abonnements|achats|tarifs|preparer-vente|demandes-acces/.test(link||'')));
    assert.deepEqual(errors,[],`${label}: browser errors`);
    await page.locator('.administration-skip').focus();await page.keyboard.press('Enter');assert(await page.evaluate(()=>document.activeElement?.id==='administration-content'));
    if([390,1440].includes(width))await page.screenshot({path:path.join(output,`${label}-${width}.png`),fullPage:true});
    if(label==='stats' && width===1440){
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger le PNG'}).click();await (await download).saveAs(path.join(output,'global-stats-portrait.png'));
      await page.getByLabel('Format du visuel').selectOption('story');const story=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger le PNG'}).click();await (await story).saveAs(path.join(output,'global-stats-story.png'));
      const csv=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger le CSV'}).click();await (await csv).saveAs(path.join(output,'global-stats.csv'));
    }
    checks.push({label,width,...geometry});await page.close();
  }
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(checks,null,2));
  console.log('Admin: 25 responsive checks passed; screenshots, PNG and CSV exports verified.');
}finally{await browser?.close();await server.close();}
