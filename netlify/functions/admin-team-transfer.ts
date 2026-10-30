import type {Context} from '@netlify/functions';
import {sql} from './_lib/db';
import {requirePlatformAdmin} from './_lib/platform-admin';
import {assertTrustedMutation,handleError,json,readJson} from './_lib/http';
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
const uuid=(value:unknown)=>{const id=String(value || '').toLowerCase();if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))throw fail('Identifiant invalide.');return id;};
const version=(value:unknown)=>{const v=String(value || '');if(!/^\d{1,20}$/.test(v))throw fail('Recharge le dossier avant de continuer.');return v;};
export default async function handler(request:Request,context:Context){
  try{
    if(!['GET','POST'].includes(request.method))return json({error:'Méthode refusée.'},405,{Allow:'GET, POST'});
    assertTrustedMutation(request);const admin=await requirePlatformAdmin(request,context);
    if(request.method==='GET'){
      const params=new URL(request.url).searchParams,teamId=uuid(params.get('teamId')),q=String(params.get('q') || '').trim();
      if(q.length>120)throw fail('La recherche est trop longue.');
      if(q.length<2)return json({rows:[]});
      const search='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
      const rows=await sql`select u.id,u.name,u.account_name,u.email,u.xmin::text as revision from users u
        join teams t on t.id=${teamId} where u.id<>t.owner_id and u.suspended_at is null and u.email_verified is true
        and nullif(u.email,'') is not null and concat_ws(' ',u.name,u.account_name,u.email,u.id::text) ilike ${search}
        order by u.name,u.id limit 20`;
      return json({rows});
    }
    const body=await readJson(request,4096),teamId=uuid(body.teamId),oldOwner=uuid(body.expectedOwnerId),newOwner=uuid(body.newOwnerId);
    if(oldOwner===newOwner)throw fail('Ce compte est déjà propriétaire de l’équipe.');
    const revision=version(body.expectedTeamRevision),newRevision=version(body.expectedNewOwnerRevision),name=String(body.confirmName || '');
    if(!name || name.length>80)throw fail('Saisis le nom exact de l’équipe.');
    const sessionId=(admin as typeof admin & {session_id?:string}).session_id;
    if(!sessionId)throw fail('Session administrateur invalide.',403);
    await sql.transaction(tx=>[
      tx`with live as materialized(select s.id from sessions s join users u on u.id=s.user_id where s.id=${sessionId}
        and s.user_id=${admin.id} and s.revoked_at is null and s.expires_at>clock_timestamp() and u.suspended_at is null
        and u.email is not distinct from ${admin.email || null} for update of s,u)
        select (case when exists(select 1 from live) then '1' else 'admin_access_revoked' end)::integer`,
      // Account deletion locks the user before owned teams. Match that ordering
      // so a transfer and deletion cannot remove or resurrect a transferred team.
      tx`select id from users where id in (${oldOwner},${newOwner}) order by id for update`,
      tx`select id from teams where id=${teamId} for update`,
      tx`select 1 / case when count(*)=1 then 1 else 0 end from teams t join users u on u.id=${newOwner}
        join users previous on previous.id=${oldOwner}
        where t.id=${teamId} and t.owner_id=${oldOwner} and t.xmin::text=${revision} and t.name=${name}
        and u.xmin::text=${newRevision} and u.suspended_at is null and u.email_verified is true and nullif(u.email,'') is not null`,
      tx`update teams set owner_id=${newOwner},updated_at=clock_timestamp() where id=${teamId}`,
      tx`insert into team_members(team_id,user_id,role) values(${teamId},${newOwner},'captain')
        on conflict(team_id,user_id) do update set role='captain'`,
      tx`insert into team_members(team_id,user_id,role) values(${teamId},${oldOwner},'player')
        on conflict(team_id,user_id) do update set role='player'`,
      tx`insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values(${admin.id},'admin.team.transfer','team',${teamId},
        jsonb_build_object('previousOwnerId',${oldOwner}::text,'newOwnerId',${newOwner}::text))`
    ]);
    return json({ok:true});
  }catch(error:any){
    if(['22012','40P01'].includes(error.code))return json({error:'L’équipe ou le compte destinataire a changé. Recharge le dossier et sélectionne à nouveau le destinataire.'},409);
    if(error.code==='22P02')return json({error:'La session administrateur a changé. Reconnecte-toi.'},403);
    if(error.code==='23505')return json({error:'Le destinataire possède déjà une équipe portant ce nom. Renomme cette équipe avant de la transférer.'},409);
    return handleError(error);
  }
}
