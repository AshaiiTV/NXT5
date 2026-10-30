import type { Context } from '@netlify/functions';

import { sql } from './_lib/db';

import { requirePlatformAdmin } from './_lib/platform-admin';

import { assertTrustedMutation, handleError, json, readJson } from './_lib/http';

import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';



const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});

const id=(value:unknown)=>{const valueId=String(value || '');if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(valueId))throw fail('Identifiant invalide.');return valueId;};

const version=(value:unknown)=>{const result=String(value || '');if(!/^\d{1,20}$/.test(result))throw fail('Recharge le dossier avant de continuer.');return result;};

const text=(value:unknown,min:number,max:number)=>{const result=String(value || '').trim();if(result.length<min || result.length>max || /[\x00-\x1f\x7f]/.test(result))throw fail('Texte invalide ou trop long.');return result;};

const roles=['captain','coach','assistant','analyst','manager','board','player','viewer','member'];

const playerRoles=['TOP','JGL','MID','ADC','SUP','SUB','COACH','ASSISTANT','ANALYST','MANAGER','BOARD'];

const staff=['COACH','ASSISTANT','ANALYST','MANAGER','BOARD'];



function counts(tx:any,teamId:string) {

  return tx`select jsonb_build_object(

    'members',(select count(*) from team_members where team_id=${teamId}),

    'profiles',(select count(*) from players where team_id=${teamId}),

    'matches',(select count(*) from matches where team_id=${teamId}),

    'reports',(select count(*) from reports where team_id=${teamId}),

    'compositions',(select count(*) from composition_types where team_id=${teamId}),

    'planning',(select count(*) from discord_team_events where team_id=${teamId}),

    'goals',(select count(*) from player_goals where team_id=${teamId}),

    'drafts',(select count(*) from opponent_drafts where team_id=${teamId}),

    'archives',(select count(*) from match_archives where team_id=${teamId})

  ) as counts`;

}



async function profileDetail(profileId:string) {

  const [profiles,pool,goals,matches]=await sql.transaction(tx=>[

    tx`select p.id,p.team_id,p.user_id,p.name,p.role,p.roster_status,p.riot_id,p.created_at,p.updated_at,p.xmin::text as revision,

      t.name as team_name,t.xmin::text as team_revision,u.name as account_name,u.email

      from players p join teams t on t.id=p.team_id left join users u on u.id=p.user_id where p.id=${profileId}`,

    tx`select champion,games,wins,losses,winrate from champion_pool where player_id=${profileId} order by games desc,champion limit 50`,

    tx`select id,title,metric,target_value,status from player_goals where player_id=${profileId} order by created_at desc,id limit 50`,

    tx`select m.id,m.game_id,m.opponent,m.result,m.created_at,p.champion,p.role,p.kills,p.deaths,p.assists

      from match_participants p join matches m on m.id=p.match_id join players profile on profile.id=${profileId} and profile.team_id=m.team_id

      where p.player_id=profile.id order by m.created_at desc,m.id limit 20`

  ],{isolationLevel:'RepeatableRead',readOnly:true});

  if(!profiles[0])throw fail('Profil introuvable.',404);

  return {profile:profiles[0],pool,goals,matches};

}



async function read(request:Request) {

  const params=new URL(request.url).searchParams;

  if(params.has('profileId'))return profileDetail(id(params.get('profileId')));

  const page=Number(params.get('page') || 1),q=text(params.get('q'),0,120);

  if(!Number.isSafeInteger(page) || page<1 || page>100000)throw fail('Page invalide.');

  const limit=20,offset=(page-1)*limit,search='%'+q.replace(/[\\%_]/g,'\\$&')+'%';

  if(!params.has('teamId')) {

    const filter=params.get('filter') || 'all';

    if(!['all','recent','quiet','never','empty'].includes(filter))throw fail('Filtre invalide.');

    const [rows,total]=await sql.transaction(tx=>[

      tx`select t.id,t.name,t.tag,t.region,t.created_at,u.name as owner_name,

        (select count(*)::int from players p where p.team_id=t.id) as profiles,

        (select count(*)::int from matches m where m.team_id=t.id) as matches

        from teams t join users u on u.id=t.owner_id

        where concat_ws(' ',t.id::text,t.name,t.tag,t.region,u.name,u.email) ilike ${search} and (${filter}<>'empty' or not exists(select 1 from players p where p.team_id=t.id))

        and (${filter}<>'never' or not exists(select 1 from matches m where m.team_id=t.id))

        and (${filter}<>'recent' or exists(select 1 from matches m where m.team_id=t.id and m.created_at>=now()-interval '30 days'))

        and (${filter}<>'quiet' or (exists(select 1 from matches m where m.team_id=t.id) and not exists(select 1 from matches m where m.team_id=t.id and m.created_at>=now()-interval '30 days')))

        order by t.created_at desc,t.id limit ${limit} offset ${offset}`,

      tx`select count(*)::int as total from teams t join users u on u.id=t.owner_id

        where concat_ws(' ',t.id::text,t.name,t.tag,t.region,u.name,u.email) ilike ${search} and (${filter}<>'empty' or not exists(select 1 from players p where p.team_id=t.id))

        and (${filter}<>'never' or not exists(select 1 from matches m where m.team_id=t.id))

        and (${filter}<>'recent' or exists(select 1 from matches m where m.team_id=t.id and m.created_at>=now()-interval '30 days'))

        and (${filter}<>'quiet' or (exists(select 1 from matches m where m.team_id=t.id) and not exists(select 1 from matches m where m.team_id=t.id and m.created_at>=now()-interval '30 days')))`

    ],{isolationLevel:'RepeatableRead',readOnly:true});

    return {rows,pagination:{page,pageSize:limit,total:total[0].total}};

  }

  const teamId=id(params.get('teamId')),view=params.get('view') || 'profiles';

  if(!['profiles','members','matches','reports','compositions','planning','goals','drafts'].includes(view))throw fail('Vue inconnue.');

  const [teams,totals,rows,total]=await sql.transaction(tx=>{

    let listing:any,count:any;

    if(view==='profiles') {

      listing=tx`select p.id,p.name,p.role,p.roster_status,p.riot_id,p.user_id,p.xmin::text as revision,u.name as account_name

        from players p left join users u on u.id=p.user_id where p.team_id=${teamId}

        and concat_ws(' ',p.name,p.riot_id,p.role,u.name) ilike ${search} order by p.name,p.id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from players p left join users u on u.id=p.user_id where p.team_id=${teamId} and concat_ws(' ',p.name,p.riot_id,p.role,u.name) ilike ${search}`;

    } else if(view==='members') {

      listing=tx`select u.id,u.name,u.email,case when u.id=t.owner_id then 'owner' else m.role end as role,m.xmin::text as revision

        from teams t join users u on u.id=t.owner_id or exists(select 1 from team_members x where x.team_id=t.id and x.user_id=u.id)

        left join team_members m on m.team_id=t.id and m.user_id=u.id where t.id=${teamId}

        and concat_ws(' ',u.name,u.email,m.role) ilike ${search} order by u.name,u.id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from teams t join users u on u.id=t.owner_id or exists(select 1 from team_members x where x.team_id=t.id and x.user_id=u.id)

        left join team_members m on m.team_id=t.id and m.user_id=u.id where t.id=${teamId} and concat_ws(' ',u.name,u.email,m.role) ilike ${search}`;

    } else if(view==='matches') {

      listing=tx`select m.id,m.game_id,m.opponent,m.result,m.patch,m.duration,m.created_at,

        (select jsonb_agg(jsonb_build_object('name',p.summoner_name,'champion',p.champion,'role',p.role,'side',p.team_key,'kills',p.kills,'deaths',p.deaths,'assists',p.assists)) from match_participants p where p.match_id=m.id) as participants

        from matches m where m.team_id=${teamId} and concat_ws(' ',m.game_id,m.opponent,m.patch) ilike ${search} order by m.created_at desc,m.id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from matches where team_id=${teamId} and concat_ws(' ',game_id,opponent,patch) ilike ${search}`;

    } else if(view==='reports') {

      listing=tx`select id,title,left(content,20000) as content,length(content)>20000 as truncated,created_at from reports where team_id=${teamId} and title ilike ${search} order by created_at desc,id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from reports where team_id=${teamId} and title ilike ${search}`;

    } else if(view==='compositions') {

      listing=tx`select c.id,c.title,c.notes,c.created_at,
        (select jsonb_agg(jsonb_build_object('role',s.key,'player',p.name,'champion',pool.champion) order by s.key)
         from jsonb_each(case when jsonb_typeof(c.slots)='object' then c.slots else '{}'::jsonb end) s
         left join players p on p.id::text=s.value->>'playerId' and p.team_id=c.team_id
         left join champion_pool pool on pool.id::text=s.value->>'poolId' and pool.team_id=c.team_id
         where s.key in ('TOP','JGL','MID','ADC','SUP')) as positions
        from composition_types c where c.team_id=${teamId} and c.title ilike ${search} order by c.created_at desc,c.id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from composition_types where team_id=${teamId} and title ilike ${search}`;

    } else if(view==='planning') {

      listing=tx`select id,title,event_type,starts_at,duration_minutes,details,status from discord_team_events where team_id=${teamId} and title ilike ${search} order by starts_at desc,id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from discord_team_events where team_id=${teamId} and title ilike ${search}`;

    } else if(view==='goals') {

      listing=tx`select g.id,g.title,g.metric,g.target_value,g.status,p.name as player_name from player_goals g join players p on p.id=g.player_id where g.team_id=${teamId} and concat_ws(' ',g.title,p.name) ilike ${search} order by g.created_at desc,g.id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from player_goals g join players p on p.id=g.player_id where g.team_id=${teamId} and concat_ws(' ',g.title,p.name) ilike ${search}`;

    } else {

      listing=tx`select id,source_id,game_number,imported_at,snapshot->'bluePicks' as blue_picks,snapshot->'redPicks' as red_picks,snapshot->'blueBans' as blue_bans,snapshot->'redBans' as red_bans from opponent_drafts where team_id=${teamId} and source_id ilike ${search} order by imported_at desc,id limit ${limit} offset ${offset}`;

      count=tx`select count(*)::int as total from opponent_drafts where team_id=${teamId} and source_id ilike ${search}`;

    }

    return [tx`select t.id,t.name,t.tag,t.region,t.owner_id,t.created_at,t.xmin::text as revision,u.name as owner_name from teams t join users u on u.id=t.owner_id where t.id=${teamId}`,counts(tx,teamId),listing,count];

  },{isolationLevel:'RepeatableRead',readOnly:true});

  if(!teams[0])throw fail('Équipe introuvable.',404);

  return {team:teams[0],counts:totals[0].counts,rows,pagination:{page,pageSize:limit,total:total[0].total}};

}



export default async function handler(request:Request,context:Context):Promise<Response> {

  try {

    if(!['GET','POST'].includes(request.method))return json({error:'Méthode refusée.'},405,{Allow:'GET, POST'});

    assertTrustedMutation(request);

    const admin=await requirePlatformAdmin(request,context);

    if(request.method==='GET')return json(await read(request));

    const body=await readJson(request,8192),teamId=id(body.teamId),revision=version(body.expectedTeamRevision),action=String(body.action);

    if(!['team-update','team-delete','member-role','member-remove','profile-update','profile-unlink','profile-delete'].includes(action))throw fail('Action inconnue.');

    if(['team-delete','profile-delete'].includes(action))assertMatchSourceMutationEnvironment(context);

    const sessionId=(admin as typeof admin & {session_id?:string}).session_id;

    if(!sessionId)throw fail('Session administrateur invalide.',403);

    let targetId=teamId,targetRevision='',name='',tag='',region='',role='',riotId:string|null=null,rosterStatus='';

    if(action==='team-update'){name=text(body.name,2,80);tag=text(body.tag,1,12).toUpperCase();region=text(body.region,2,20).toUpperCase();}

    if(action.startsWith('member-')){targetId=id(body.userId);targetRevision=version(body.expectedRevision);if(targetId===admin.id)throw fail('Tu ne peux pas modifier tes propres accès depuis cet outil.');if(action==='member-role'){role=String(body.role);if(!roles.includes(role))throw fail('Statut de membre invalide.');}}

    if(action.startsWith('profile-')){targetId=id(body.profileId);targetRevision=version(body.expectedRevision);}

    if(action==='profile-update') {

      name=text(body.name,2,80);role=String(body.role);rosterStatus=String(body.rosterStatus);

      if(!playerRoles.includes(role) || !['MAIN','SUB','INACTIVE'].includes(rosterStatus))throw fail('Poste ou statut invalide.');

      riotId=text(body.riotId,0,100) || null;

      if(staff.includes(role)){riotId=null;rosterStatus='INACTIVE';}else if(role==='SUB')rosterStatus='SUB';

      else if(!riotId)throw fail('Riot ID requis pour un joueur.');

    }

    if(action.endsWith('delete'))name=text(body.confirmName,1,80);

    // Ordered locks are shared with existing team mutation handlers. The live

    // admin session/account are checked again inside the atomic transaction.

    await sql.transaction(tx=>[

      tx`with live as materialized (select s.id from sessions s join users u on u.id=s.user_id

        where s.id=${sessionId} and s.user_id=${admin.id} and s.revoked_at is null and s.expires_at>clock_timestamp()

        and u.email is not distinct from ${admin.email || null} for update of s,u)

        select (case when exists(select 1 from live) then '1' else 'admin_access_revoked' end)::integer`,

      tx`select id from teams where id=${teamId} for update`,

      tx`select 1 / case when count(*)=1 then 1 else 0 end from teams where id=${teamId} and xmin::text=${revision}`,

      ...(action.startsWith('member-') ? [tx`select 1 / case when count(*)=1 then 1 else 0 end from team_members m join teams t on t.id=m.team_id

        where m.team_id=${teamId} and m.user_id=${targetId} and m.xmin::text=${targetRevision} and t.owner_id<>m.user_id and m.role<>'owner'`] : []),

      ...(action.startsWith('profile-') ? [tx`select 1 / case when count(*)=1 then 1 else 0 end from players where team_id=${teamId} and id=${targetId} and xmin::text=${targetRevision}

        and (${action}<>'profile-delete' or name=${name})`] : []),

      ...(action==='team-delete' ? [tx`select 1 / case when t.name=${name} and ${JSON.stringify(body.expectedCounts || {})}::jsonb=jsonb_build_object(

        'members',(select count(*) from team_members where team_id=t.id),'profiles',(select count(*) from players where team_id=t.id),

        'matches',(select count(*) from matches where team_id=t.id),'reports',(select count(*) from reports where team_id=t.id),

        'compositions',(select count(*) from composition_types where team_id=t.id),'planning',(select count(*) from discord_team_events where team_id=t.id),

        'goals',(select count(*) from player_goals where team_id=t.id),'drafts',(select count(*) from opponent_drafts where team_id=t.id),

        'archives',(select count(*) from match_archives where team_id=t.id)) then 1 else 0 end from teams t where t.id=${teamId}`,

        tx`delete from teams where id=${teamId}`] : []),

      ...(action==='team-update' ? [tx`update teams set name=${name},tag=${tag},region=${region} where id=${teamId}`] : []),

      ...(action==='member-role' ? [tx`update team_members set role=${role} where team_id=${teamId} and user_id=${targetId}`] : []),

      ...(action==='member-remove' ? [tx`update players set user_id=null,updated_at=clock_timestamp() where team_id=${teamId} and user_id=${targetId}`,

        tx`delete from team_members where team_id=${teamId} and user_id=${targetId}`] : []),

      ...(action==='profile-update' ? [tx`update players set name=${name},role=${role},roster_status=${rosterStatus},

        most_played=case when riot_id is distinct from ${riotId} then '[]'::jsonb else most_played end,

        performance_score=case when riot_id is distinct from ${riotId} then null else performance_score end,

        status=case when riot_id is distinct from ${riotId} then 'À synchroniser' else status end,

        opgg_url=case when riot_id is distinct from ${riotId} then null else opgg_url end,

        riot_id=${riotId},updated_at=clock_timestamp() where team_id=${teamId} and id=${targetId}`,

        tx`update champion_pool set player_name=${name} where team_id=${teamId} and player_id=${targetId}`] : []),

      ...(action==='profile-unlink' ? [tx`update players set user_id=null,updated_at=clock_timestamp() where team_id=${teamId} and id=${targetId}`] : []),

      ...(action==='profile-delete' ? [tx`delete from players where team_id=${teamId} and id=${targetId}`] : []),

      ...(action!=='team-delete' ? [tx`update teams set updated_at=clock_timestamp() where id=${teamId}`] : []),

      tx`insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values(${admin.id},${'admin.'+action.replace('-','.')},

        ${action.startsWith('profile-') ? 'player':'team'},${action.startsWith('profile-') ? targetId:teamId},

        ${JSON.stringify({teamId,targetId,...(action==='member-role' ? {role}:{}),...(action==='team-delete' ? {name,counts:body.expectedCounts}:{})})}::jsonb)`

    ]);

    return json({ok:true,teamId});

  } catch(error:any) {

    if(error.code==='22P02')return json({error:'La session administrateur a changé. Reconnecte-toi.'},403);

    if(error.code==='22012')return json({error:'Le dossier ou son contenu a changé. Recharge-le avant de réessayer.'},409);

    if(error.code==='23505')return json({error:'Ce nom, ce Riot ID ou ce poste titulaire est déjà utilisé.'},409);

    return handleError(error);

  }

}

