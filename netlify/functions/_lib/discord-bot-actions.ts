import { randomUUID } from 'node:crypto';
import { sql } from './db';
import { assertDiscordArtifactEnvironment, discordError, uuid } from './discord-access';
import { getDiscordGuild } from './discord-client';
import { isDiscordId } from './discord-config';
import { assertSubjectRateLimit } from './rate-limit';
import { sendDiscordConnectionTest } from './discord-test';
import { botMessage, botText, botConfirmation, assertBotStaff, botLink, type BotContext } from './discord-bot-common';
import { botSettings, botDestination, queueBotMessage, localDateTime, localParts, nextWeeklyRun, validateTimezone, eventBotMessage } from './discord-bot-schedule';

const asText=(value:any,max=1000)=>String(value??'').trim().slice(0,max);
function required(value:any,label:string,max=1000){const result=asText(value,max);if(!result)throw discordError(`${label} requis.`);return result;}
function integer(value:any,min:number,max:number,label:string){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw discordError(`${label} : nombre entier entre ${min} et ${max}.`);return n;}
const modal=(command:string,options:any,title:string,fields:any[])=>({modal:{title,command,options,fields}});
const stamp=(value:any)=>`<t:${Math.floor(new Date(value).getTime()/1000)}:F>`;
async function eventFor(ctx:BotContext,id:any,allowCancelled=false){
  const rows=await sql('select * from discord_team_events where team_id=$1 and id=$2',[ctx.teamId,uuid(id,'Événement')]);
  if(!rows[0]||(!allowCancelled&&rows[0].status!=='scheduled'))throw discordError('Événement introuvable ou annulé.',404);
  return rows[0];
}
async function goalFor(ctx:BotContext,id:any){
  const rows=await sql(`select id,team_id,player_id,title,status,'team' as source from discord_team_goals where team_id=$1 and id=$2
    union all select id,team_id,player_id,title,status,'player' as source from player_goals where team_id=$1 and id=$2`,[ctx.teamId,uuid(id,'Objectif')]);
  const goal=rows[0];if(!goal||(!ctx.canStaff&&goal.player_id&&!ctx.playerIds.includes(goal.player_id)))throw discordError('Objectif introuvable ou non accessible.',404);
  return goal;
}
async function reportFor(ctx:BotContext,id:any){
  const rows=await sql('select * from reports where team_id=$1 and id=$2',[ctx.teamId,uuid(id,'Review')]);
  const report=rows[0];if(!report||(!ctx.canStaff&&report.discord_status!=='published'))throw discordError('Review introuvable ou non accessible.',404);
  return report;
}
async function audit(ctx:BotContext,command:string,id:string,metadata:any={}){
  await sql("insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values($1,$2,'discord_workflow',$3,$4::jsonb)",[ctx.userId,'discord.'+command.replace(/ /g,'.'),id,JSON.stringify({teamId:ctx.teamId,...metadata})]);
}
async function saveSetting(ctx:BotContext,column:string,value:any){
  const allowed=['timezone','channels','reminders_enabled','reminder_minutes','weekly_enabled','weekly_day','weekly_hour'];
  if(!allowed.includes(column))throw discordError('Réglage invalide.');
  await sql(`insert into discord_bot_settings(team_id,${column}) values($1,$2${column==='channels'?'::jsonb':''}) on conflict(team_id) do update set ${column}=excluded.${column},updated_at=now()`,[ctx.teamId,column==='channels'?JSON.stringify(value):value]);
}
async function participants(ctx:BotContext,eventId:string){
  return sql(`select p.user_id,min(p.name) as name,r.status,r.delay_minutes from players p
    join teams t on t.id=p.team_id left join team_members m on m.team_id=p.team_id and m.user_id=p.user_id
    left join discord_event_responses r on r.event_id=$2 and r.user_id=p.user_id
    where p.team_id=$1 and p.user_id is not null and p.roster_status<>'INACTIVE' and p.role in ('TOP','JGL','MID','ADC','SUP','SUB')
      and (m.user_id is not null or t.owner_id=p.user_id)
    group by p.user_id,r.status,r.delay_minutes order by min(p.name)`,[ctx.teamId,eventId]);
}
async function queueEventUpdate(ctx:BotContext,event:any,description:string){
  const settings=await botSettings(ctx.teamId);if(!settings.channels?.planning)return;
  const connection=(await sql("select config_version from discord_connections where team_id=$1 and guild_id=$2 and status='active'",[ctx.teamId,ctx.guildId]))[0];
  if(!connection)return;
  await queueBotMessage({teamId:ctx.teamId,guildId:ctx.guildId,channelId:settings.channels.planning,channelKind:'planning',kind:'event_update',key:`event:${event.id}:${event.revision}`,
    payload:{embeds:[{title:botText(`${ctx.teamName} · ${event.title}`,256),description,url:botLink('/planning?team='+ctx.teamId),color:0x67e8f9}]},configVersion:connection.config_version,eventId:event.id,eventRevision:event.revision});
}
export async function executeDiscordAction(ctx:BotContext,rawCommand:string,options:Record<string,any>,confirmed=false):Promise<any|null>{
  const command=rawCommand.replace(/^nxt[ .]/,'').replace(/\./g,' ').trim();
  const actions=new Set(['objectifs definir','objectifs terminer','objectifs point','draft notes','evenement creer','evenement modifier','evenement annuler','presence repondre','presence liste','presence relancer','disponibilites definir','review creer','review partager','review lire','reglages canal','reglages rappels','reglages fuseau','reglages bilan','diffusion test']);
  if(!actions.has(command))return null;
  assertDiscordArtifactEnvironment();
  if(command.startsWith('reglages ')||command==='diffusion test')assertBotStaff(ctx,true);
  if(['objectifs definir','objectifs terminer','draft notes','evenement creer','evenement modifier','evenement annuler','presence liste','presence relancer','review creer','review partager'].includes(command))assertBotStaff(ctx);

  if(command==='objectifs definir'){
    const title=required(options.objectif,'Objectif',240);
    let playerId:string|null=null;
    if(options.joueur){
      const selected=required(options.joueur,'Joueur',160);
      const players=await sql('select id from players where team_id=$1 and (lower(id::text)=lower($2) or lower(name)=lower($2)) order by id limit 2',[ctx.teamId,selected]);
      if(!players.length)throw discordError('Joueur introuvable dans cette équipe.');
      if(players.length>1)throw discordError('Plusieurs joueurs portent ce nom. Utilise son identifiant NXT5.');
      playerId=players[0].id;
    }
    const due=options.echeance?localDateTime(options.echeance,'23:00',ctx.timezone):null;
    if(!confirmed)return botConfirmation(ctx,command,{...options,joueur:playerId||undefined},`Créer « ${botText(title)} » pour ${playerId?'le joueur sélectionné':'toute l’équipe'}${due?' · échéance '+stamp(due):''}.`);
    const [goal]=await sql('insert into discord_team_goals(team_id,player_id,title,due_at,created_by) values($1,$2,$3,$4,$5) returning *',[ctx.teamId,playerId,title,due?.toISOString()||null,ctx.userId]);
    await audit(ctx,command,goal.id);return botMessage('Objectif créé',`${botText(title)}\nIdentifiant : \`${goal.id}\``);
  }
  if(command==='objectifs terminer'||command==='objectifs point'){
    const goal=await goalFor(ctx,options.objectif);if(goal.status!=='active')throw discordError('Cet objectif est déjà clôturé.');
    const note=command==='objectifs point'?required(options.note,'Point de suivi',1500):asText(options.commentaire,1500)||'Objectif clôturé par le staff.';
    if(command==='objectifs terminer'&&!confirmed)return botConfirmation(ctx,command,options,`Clôturer « ${botText(goal.title)} » ?\n${botText(note)}`);
    const goalTable=goal.source==='player'?'player_goals':'discord_team_goals',historyTable=goal.source==='player'?'discord_player_goal_updates':'discord_goal_updates';
    await sql.transaction([
      ...(command==='objectifs terminer'?[sql(`update ${goalTable} set status='completed',updated_at=now() where id=$1 and team_id=$2 and status='active'`,[goal.id,ctx.teamId])]:[]),
      sql(`insert into ${historyTable}(team_id,goal_id,user_id,note) values($1,$2,$3,$4)`,[ctx.teamId,goal.id,ctx.userId,note]),
    ]);
    await audit(ctx,command,goal.id);return botMessage(command==='objectifs point'?'Point de suivi ajouté':'Objectif clôturé',botText(goal.title));
  }
  if(command==='draft notes'){
    const event=await eventFor(ctx,options.evenement),note=required(options.texte,'Consigne',1800);
    await sql('insert into discord_draft_notes(team_id,event_id,author_id,note) values($1,$2,$3,$4)',[ctx.teamId,event.id,ctx.userId,note]);
    await audit(ctx,command,event.id);return botMessage('Consigne enregistrée',`${botText(event.title)}\n${botText(note)}`);
  }
  if(command==='evenement creer'||command==='evenement modifier'){
    if(options._timezone&&options._timezone!==ctx.timezone)throw discordError('Le fuseau de l’équipe a changé. Recommence pour vérifier l’horaire.');
    const existing=command==='evenement modifier'?await eventFor(ctx,options.evenement):null;
    const oldLocal=existing?localParts(new Date(existing.starts_at),ctx.timezone):null;
    if(existing&&!['date','heure','duree','titre','details'].some(key=>options[key]!==undefined))return modal(command,options,'Modifier l’événement',[
      {id:'titre',label:'Titre',value:existing.title,max_length:140},{id:'date',label:'Date AAAA-MM-JJ',value:oldLocal!.date,max_length:10},{id:'heure',label:'Heure HH:MM',value:oldLocal!.time,max_length:5},{id:'duree',label:'Durée en minutes',value:String(existing.duration_minutes),max_length:4},{id:'details',label:'Détails',value:existing.details||'',required:false,style:2,max_length:1500},
    ]);
    const type=asText(options.type||existing?.event_type,16);if(!['scrim','match','review'].includes(type))throw discordError('Type attendu : scrim, match ou review.');
    const starts=localDateTime(options.date||oldLocal?.date,options.heure||oldLocal?.time,ctx.timezone);
    if(starts.getTime()<=Date.now())throw discordError('Choisis une date future.');
    const duration=integer(options.duree??existing?.duration_minutes,1,1440,'Durée'),title=asText(options.titre||existing?.title||type,140),details=asText(options.details??existing?.details,1500);
    if(options._revision&&existing&&Number(options._revision)!==Number(existing.revision))throw discordError('L’événement a changé. Recommence pour vérifier la version actuelle.');
    const collisions=await sql(`select title,starts_at from discord_team_events where team_id=$1 and status='scheduled' and ($4::uuid is null or id<>$4)
      and starts_at<$3::timestamptz and starts_at+(duration_minutes*interval '1 minute')>$2::timestamptz limit 3`,[ctx.teamId,starts.toISOString(),new Date(starts.getTime()+duration*60000).toISOString(),existing?.id||null]);
    if(!confirmed)return botConfirmation(ctx,command,{...options,_revision:existing?.revision,_timezone:ctx.timezone},`${existing?'Modifier':'Créer'} ${botText(title)} · ${stamp(starts)} · ${duration} min\nFuseau : ${ctx.timezone}\n${details?botText(details)+'\n':''}${collisions.length?'Chevauchement avec : '+collisions.map(e=>botText(e.title)).join(', '):'Aucun chevauchement détecté.'}`);
    const rows=existing?await sql(`update discord_team_events set title=$3,starts_at=$4,duration_minutes=$5,details=$6,revision=revision+1,updated_at=now()
      where team_id=$1 and id=$2 and revision=$7 and status='scheduled' returning *`,[ctx.teamId,existing.id,title,starts.toISOString(),duration,details,existing.revision]):
      await sql('insert into discord_team_events(team_id,title,event_type,starts_at,duration_minutes,details,created_by) values($1,$2,$3,$4,$5,$6,$7) returning *',[ctx.teamId,title,type,starts.toISOString(),duration,details,ctx.userId]);
    const event=rows[0];if(!event)throw discordError('L’événement a changé. Recommence.');
    if(existing){await sql("update discord_bot_outbox set state='cancelled',updated_at=now() where team_id=$1 and event_id=$2 and state='queued'",[ctx.teamId,event.id]);await queueEventUpdate(ctx,event,`Horaire modifié : ${stamp(starts)} · ${duration} min. Les réponses de présence existantes sont conservées ; vérifie ton statut.`);}
    await audit(ctx,command,event.id,{revision:event.revision});return botMessage(existing?'Événement modifié':'Événement créé',`${botText(title)} · ${stamp(starts)}\n${duration} min · ${ctx.timezone}\nIdentifiant : \`${event.id}\``);
  }
  if(command==='evenement annuler'){
    const event=await eventFor(ctx,options.evenement),reason=asText(options.motif,500)||'Annulé par le staff.';
    if(options._revision&&Number(options._revision)!==Number(event.revision))throw discordError('L’événement a changé. Vérifie-le avant de l’annuler.');
    if(!confirmed)return botConfirmation(ctx,command,{...options,_revision:event.revision},`Annuler ${botText(event.title)} du ${stamp(event.starts_at)} ?\n${botText(reason)}`);
    const rows=await sql("update discord_team_events set status='cancelled',cancellation_reason=$3,revision=revision+1,updated_at=now() where team_id=$1 and id=$2 and revision=$4 and status='scheduled' returning *",[ctx.teamId,event.id,reason,event.revision]);
    if(!rows[0])throw discordError('L’événement a changé. Recommence.');
    await sql("update discord_bot_outbox set state='cancelled',updated_at=now() where team_id=$1 and event_id=$2 and state='queued'",[ctx.teamId,event.id]);
    await queueEventUpdate(ctx,rows[0],`Événement annulé.\n${botText(reason)}\nLes rappels sont désactivés.`);
    await audit(ctx,command,event.id,{reason});return botMessage('Événement annulé',`${botText(event.title)}\nLes rappels en attente sont annulés.`);
  }
  if(command==='presence repondre'){
    const event=await eventFor(ctx,options.evenement),status=asText(options.statut,10);
    if(!['present','absent','retard'].includes(status))throw discordError('Statut attendu : present, absent ou retard.');
    if(new Date(event.starts_at).getTime()+event.duration_minutes*60000<Date.now())throw discordError('Cet événement est terminé.');
    if(status==='retard'&&options.retard===undefined)return modal(command,options,'Préciser le retard',[{id:'retard',label:'Retard prévu en minutes',max_length:4}]);
    const delay=status==='retard'?integer(options.retard,1,1440,'Retard'):0;
    const recorded=await sql(`insert into discord_event_responses(event_id,user_id,status,delay_minutes) select id,$3,$4,$5 from discord_team_events where team_id=$1 and id=$2 and status='scheduled'
      on conflict(event_id,user_id) do update set status=excluded.status,delay_minutes=excluded.delay_minutes,updated_at=now() returning event_id`,[ctx.teamId,event.id,ctx.userId,status,delay]);
    if(!recorded.length)throw discordError('Cet événement a changé ou a été annulé. Actualise le planning.');
    return botMessage('Présence enregistrée',`${botText(event.title)} : ${status}${delay?' · '+delay+' min':''}.`);
  }
  if(command==='presence liste'||command==='presence relancer'){
    const event=await eventFor(ctx,options.evenement),people=await participants(ctx,event.id),pending=people.filter(p=>!p.status&&(!confirmed||!Array.isArray(options._participantIds)||options._participantIds.includes(p.user_id)));
    if(command==='presence liste')return botMessage('Présences · '+botText(event.title),`${people.length} joueurs attendus · ${pending.length} sans réponse`,['present','absent','retard','pending'].map(status=>({name:{present:'Présents',absent:'Absents',retard:'En retard',pending:'Sans réponse'}[status],value:people.filter(p=>status==='pending'?!p.status:p.status===status).map(p=>botText(p.name)+(status==='retard'?' · '+p.delay_minutes+' min':'')).join('\n')||'Aucun'})));
    if(!pending.length)return botMessage('Aucune relance nécessaire','Tous les participants attendus ont répondu.');
    const destination=await botDestination(ctx.teamId,ctx.guildId,'planning');
    if((options._channelId&&options._channelId!==destination.channelId)||(options._eventRevision&&Number(options._eventRevision)!==Number(event.revision)))throw discordError('La destination ou l’événement a changé. Recommence pour vérifier la relance.');
    if(!confirmed)return botConfirmation(ctx,command,{...options,_channelId:destination.channelId,_eventRevision:event.revision,_participantIds:pending.map(p=>p.user_id)},`Publier une relance dans <#${destination.channelId}> pour : ${pending.map(p=>botText(p.name)).join(', ')}. Les noms seront affichés, sans mention globale.`);
    await assertSubjectRateLimit('discord-presence-reminder',ctx.teamId+':'+event.id,{limit:1,windowSeconds:1800});
    const payload=eventBotMessage(event,ctx.teamName);payload.embeds[0].description+='\nSans réponse : '+pending.map(p=>botText(p.name)).join(', ');
    await queueBotMessage({teamId:ctx.teamId,guildId:ctx.guildId,channelId:destination.channelId,channelKind:'planning',kind:'presence',key:`presence:${event.id}:${Math.floor(Date.now()/1800000)}`,payload,configVersion:destination.configVersion,eventId:event.id,eventRevision:event.revision});
    return botMessage('Relance mise en file',`La relance des ${pending.length} joueurs sans réponse sera envoyée dans <#${destination.channelId}> lors du prochain passage du bot (environ 5 minutes).`);
  }
  if(command==='disponibilites definir'){
    if(!ctx.playerIds.length)throw discordError('Lie ton compte NXT5 à un profil joueur pour saisir tes disponibilités.');
    const date=required(options.date,'Date',10),begin=required(options.debut,'Début',5),end=required(options.fin,'Fin',5);
    localDateTime(date,begin,ctx.timezone);localDateTime(date,end,ctx.timezone);
    if(!/^\d{2}:00$/.test(begin)||!/^\d{2}:00$/.test(end))throw discordError('Le planning NXT5 utilise des heures entières, par exemple 19:00–22:00.');
    const startHour=Number(begin.slice(0,2)),endHour=Number(end.slice(0,2));if(startHour===endHour)throw discordError('Le début et la fin doivent être différents.');
    const duration=(endHour-startHour+24)%24;
    const slotsByWeek=new Map<string,Record<string,string[]>>();
    const days=['SUN','MON','TUE','WED','THU','FRI','SAT'];
    for(let offset=0;offset<duration;offset++){
      const hour=(startHour+offset)%24;
      if(hour>0&&hour<10)throw discordError('Le planning existant accepte uniquement 10:00 à 00:00. Ce créneau inclut une heure non prise en charge.');
      const day=new Date(date+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+Math.floor((startHour+offset)/24));
      const key=days[day.getUTCDay()],monday=new Date(day);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
      const week=monday.toISOString().slice(0,10),slots=slotsByWeek.get(week)||{};
      slots[key]=[...(slots[key]||[]),String(hour).padStart(2,'0')+':00'];slotsByWeek.set(week,slots);
    }
    const statements:any[]=[];
    for(const playerId of ctx.playerIds)for(const[week,slots]of slotsByWeek){
      // Merge only supplied days/hours; preserve other weekdays and legacy _events atomically.
      statements.push(sql(`insert into player_availability(team_id,player_id,week_start,slots,updated_by)
        select $1,p.id,$3::date,$4::jsonb,$5 from players p where p.team_id=$1 and p.id=$2 and p.user_id=$5
        on conflict(team_id,player_id,week_start) do update set slots=player_availability.slots ||
          (select jsonb_object_agg(k,(select jsonb_agg(distinct h order by h) from jsonb_array_elements_text(coalesce(player_availability.slots->k,'[]'::jsonb)||v) as x(h))) from jsonb_each(excluded.slots) as entries(k,v)),
          updated_by=$5,updated_at=now()`,[ctx.teamId,playerId,week,JSON.stringify(slots),ctx.userId]));
    }
    await sql.transaction(statements);await audit(ctx,command,ctx.teamId,{date,begin,end});
    return botMessage('Disponibilité enregistrée',`${date} · ${begin} → ${end}${endHour<startHour?' (lendemain)':''} · ${ctx.timezone}. Les autres créneaux sont conservés.`);
  }
  if(command==='review creer'){
    const gameId=uuid(options.game,'Game'),title=required(options.titre,'Titre',140);
    if(!(await sql('select id from matches where team_id=$1 and id=$2',[ctx.teamId,gameId])).length)throw discordError('Game introuvable dans cette équipe.');
    if(!options.resume)return modal(command,options,'Brouillon de review',[{id:'resume',label:'Résumé validable',style:2,max_length:1200},{id:'corrections',label:'Points à corriger',style:2,max_length:1000},{id:'actions',label:'Actions de suivi',style:2,max_length:1000}]);
    const summary=required(options.resume,'Résumé',1200),corrections=asText(options.corrections,1000),actions=asText(options.actions,1000);
    const content=`${summary}\n\nPoints à corriger\n${corrections||'Non renseignés'}\n\nActions de suivi\n${actions||'Non renseignées'}`;
    if(!confirmed)return botConfirmation(ctx,command,options,`Enregistrer le brouillon « ${botText(title)} » ? Aucun partage automatique.\n${botText(content,3200)}`);
    const [report]=await sql("insert into reports(team_id,match_id,match_ids,created_by,title,content,discord_summary,discord_status) values($1,$2,$3::jsonb,$4,$5,$6,$6,'draft') returning *",[ctx.teamId,gameId,JSON.stringify([gameId]),ctx.userId,title,content]);
    await audit(ctx,command,report.id);return botMessage('Brouillon enregistré',`${botText(title)}\nPrivé au staff jusqu’au partage. Identifiant : \`${report.id}\``);
  }
  if(command==='review partager'){
    const report=await reportFor(ctx,options.review),destination=await botDestination(ctx.teamId,ctx.guildId,'reviews',options.canal);
    if(!options.resume&&(!report.discord_summary||report.discord_summary_stale))return modal(command,options,'Résumé à vérifier et partager',[{id:'resume',label:'Consignes validées visibles dans le salon',value:report.discord_summary?.slice(0,3200)||'',style:2,max_length:3200}]);
    const summary=required(options.resume||report.discord_summary,'Résumé public',3200);
    if(options._version&&Number(options._version)!==Number(report.discord_version))throw discordError('Cette review a changé. Recommence pour prévisualiser la bonne version.');
    if(!confirmed)return botConfirmation(ctx,command,{...options,_version:report.discord_version,resume:summary},`Partager « ${botText(report.title)} » dans <#${destination.channelId}> ? Toute personne ayant accès à ce salon pourra lire ces consignes.\n\n${botText(summary,3200)}`);
    const updated=await sql("update reports set discord_status='published',discord_summary=$3,discord_summary_stale=false,updated_at=now() where team_id=$1 and id=$2 and discord_version=$4 returning *",[ctx.teamId,report.id,summary,report.discord_version]);
    if(!updated[0])throw discordError('Cette review a changé. Recommence.');
    const version=updated[0].discord_version;
    await sql(`insert into discord_review_recipients(team_id,report_id,user_id,report_version)
      select p.team_id,$2,p.user_id,$3 from players p join teams t on t.id=p.team_id left join team_members m on m.team_id=p.team_id and m.user_id=p.user_id
      where p.team_id=$1 and p.user_id is not null and p.roster_status<>'INACTIVE' and (m.user_id is not null or t.owner_id=p.user_id) on conflict do nothing`,[ctx.teamId,report.id,version]);
    const reportUrl=botLink('/rapports?team='+ctx.teamId+'&report='+report.id);
    const payload={embeds:[{title:botText(report.title,256),description:botText(summary,3200),url:reportUrl,color:0x67e8f9}],components:[{type:1,components:[{type:2,style:1,label:'Lu',custom_id:`nxt:review:read:${report.id}:${version}`},{type:2,style:5,label:'Voir sur NXT5',url:reportUrl}]}]};
    await queueBotMessage({teamId:ctx.teamId,guildId:ctx.guildId,channelId:destination.channelId,channelKind:'reviews',kind:'review',key:`review:${report.id}:${version}:${destination.channelId}`,payload,configVersion:destination.configVersion,reportId:report.id,reportVersion:version});
    await audit(ctx,command,report.id,{version,channelId:destination.channelId});return botMessage('Review validée · partage en file',`Version ${version} · <#${destination.channelId}>. Envoi prévu au prochain passage du bot (environ 5 minutes).`);
  }
  if(command==='review lire'){
    const report=await reportFor(ctx,options.review);if(report.discord_status!=='published')throw discordError('Cette review n’est pas encore partagée.');
    if(report.discord_summary_stale)throw discordError('Cette review a été modifiée. Le staff doit vérifier et partager ses nouvelles consignes avant la confirmation de lecture.');
    if(options.version&&Number(options.version)!==Number(report.discord_version))throw discordError('Cette review a été modifiée. Consulte la version actuelle avant de confirmer sa lecture.');
    await sql('insert into discord_review_reads(team_id,report_id,user_id,report_version) values($1,$2,$3,$4) on conflict(report_id,user_id,report_version) do update set read_at=now()',[ctx.teamId,report.id,ctx.userId,report.discord_version]);
    return botMessage('Lecture enregistrée',`${botText(report.title)} · version ${report.discord_version}. Cette confirmation ne valide pas le contenu.`);
  }
  if(command==='reglages canal'){
    const kind=asText(options.type,20),channel=asText(options.canal,20);if(!['games','planning','reviews','bilans'].includes(kind)||!isDiscordId(channel))throw discordError('Type de publication ou salon invalide.');
    const live=await getDiscordGuild(ctx.guildId),chosen=live.channels.find(c=>c.id===channel&&c.canSend);if(!chosen)throw discordError('Ce salon est indisponible ou le bot ne peut pas y envoyer.');
    if(!confirmed)return botConfirmation(ctx,command,options,`Utiliser <#${channel}> pour les ${kind} de ${botText(ctx.teamName)} ? Vérifie que les personnes ayant accès à ce salon sont autorisées à lire ces publications. Les données partagées y seront visibles.`);
    if(kind==='games'){
      const routes=await sql('select id,channel_id from discord_routes where team_id=$1 and enabled',[ctx.teamId]);
      if(!routes.some(r=>r.channel_id===channel)&&routes.length>=10)throw discordError('La limite de dix destinations est atteinte.');
      await sql(`insert into discord_routes(team_id,guild_id,channel_id,channel_name,created_by,automatic) values($1,$2,$3,$4,$5,false)
        on conflict(team_id,channel_id,publication_kind) do update set guild_id=excluded.guild_id,channel_name=excluded.channel_name,enabled=true,updated_at=now()`,[ctx.teamId,ctx.guildId,channel,chosen.name,ctx.userId]);
    }
    // JSON merge in SQL prevents concurrent category updates from overwriting each other.
    await sql(`insert into discord_bot_settings(team_id,channels) values($1,jsonb_build_object($2::text,$3::text)) on conflict(team_id)
      do update set channels=discord_bot_settings.channels||excluded.channels,updated_at=now()`,[ctx.teamId,kind,channel]);
    await audit(ctx,command,ctx.teamId,{kind,channel});return botMessage('Salon enregistré',`${kind} → <#${channel}>${kind==='games'?'\nDestination manuelle ; les filtres et l’activation automatique se règlent dans NXT5.':''}`);
  }
  if(command==='reglages fuseau'){
    const timezone=validateTimezone(options.fuseau);if(!confirmed)return botConfirmation(ctx,command,options,`Définir ${timezone} pour l’équipe ? Les événements existants conservent leur instant ; les prochains horaires saisis utilisent ce fuseau.`);
    await saveSetting(ctx,'timezone',timezone);await audit(ctx,command,ctx.teamId,{timezone});
    const settings=await botSettings(ctx.teamId);return botMessage('Fuseau enregistré',`${timezone}. Les événements existants conservent leur instant.${settings.weekly_enabled?'\nProchain bilan : '+stamp(nextWeeklyRun(timezone,settings.weekly_day,settings.weekly_hour)):''}`);
  }
  if(command==='reglages rappels'){
    if(typeof options.actif!=='boolean')throw discordError('Indique si les rappels doivent être actifs.');
    const settings=await botSettings(ctx.teamId),delay=integer(options.delai??settings.reminder_minutes,0,10080,'Délai');
    if(options.actif&&!settings.channels?.planning)throw discordError('Configure le salon planning avant d’activer les rappels.');
    await sql(`insert into discord_bot_settings(team_id,reminders_enabled,reminder_minutes) values($1,$2,$3) on conflict(team_id)
      do update set reminders_enabled=excluded.reminders_enabled,reminder_minutes=excluded.reminder_minutes,updated_at=now()`,[ctx.teamId,options.actif,delay]);
    if(!options.actif)await sql("update discord_bot_outbox set state='cancelled',updated_at=now() where team_id=$1 and kind='reminder' and state='queued'",[ctx.teamId]);
    await audit(ctx,command,ctx.teamId,{active:options.actif,delay});return botMessage('Rappels configurés',options.actif?`${delay} min avant chaque événement, dans <#${settings.channels.planning}>. Précision de la planification : environ 5 minutes.`:'Rappels désactivés.');
  }
  if(command==='reglages bilan'){
    if(typeof options.actif!=='boolean')throw discordError('Indique si le bilan doit être actif.');
    const settings=await botSettings(ctx.teamId),days=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const day=options.jour===undefined?Number(settings.weekly_day):days.indexOf(asText(options.jour).toLowerCase());if(day<0)throw discordError('Jour invalide.');
    const hour=asText(options.heure||settings.weekly_hour);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))throw discordError('Utilise une heure HH:MM.');
    if(options.actif&&!settings.channels?.bilans)throw discordError('Configure le salon bilans avant d’activer cette publication.');
    await sql(`insert into discord_bot_settings(team_id,weekly_enabled,weekly_day,weekly_hour) values($1,$2,$3,$4) on conflict(team_id)
      do update set weekly_enabled=excluded.weekly_enabled,weekly_day=excluded.weekly_day,weekly_hour=excluded.weekly_hour,updated_at=now()`,[ctx.teamId,options.actif,day,hour]);
    if(!options.actif)await sql("update discord_bot_outbox set state='cancelled',updated_at=now() where team_id=$1 and kind='weekly' and state='queued'",[ctx.teamId]);
    await audit(ctx,command,ctx.teamId,{active:options.actif,day,hour});return botMessage('Bilan hebdomadaire configuré',options.actif?`Prochain bilan : ${stamp(nextWeeklyRun(settings.timezone,day,hour))} (${settings.timezone}).\nToutes catégories, 7 jours précédents. Sans game, un message le précisera.`:'Bilan automatique désactivé.');
  }
  if(command==='diffusion test'){
    const settings=await botSettings(ctx.teamId),rows=await sql('select id,channel_id from discord_routes where team_id=$1 and guild_id=$2 and enabled order by created_at limit 10',[ctx.teamId,ctx.guildId]);
    const route=rows.find(r=>r.channel_id===settings.channels?.games)||rows[0];if(!route)throw discordError('Configure un salon games dans NXT5 avant le test.');
    if((options._routeId&&options._routeId!==route.id)||(options._channelId&&options._channelId!==route.channel_id))throw discordError('Le salon de test a changé. Recommence pour vérifier sa destination.');
    if(!confirmed)return botConfirmation(ctx,command,{...options,_requestId:randomUUID(),_routeId:route.id,_channelId:route.channel_id},`Envoyer un embed et une image de test fictifs dans <#${route.channel_id}> ?`);
    const result=await sendDiscordConnectionTest({teamId:ctx.teamId,routeId:route.id,requestId:uuid(options._requestId,'Test'),userId:ctx.userId});
    if(!result)throw discordError('Le résultat du test doit être vérifié.');
    return botMessage(result.status==='succeeded'?'Test envoyé':'Test à vérifier',result.status==='succeeded'?`Le test a été envoyé. ${result.messageUrl||''}`:`État : ${result.status}. Aucun nouvel envoi automatique ; consulte la page Bot Discord pour vérifier le résultat.`);
  }
  return null;
}
