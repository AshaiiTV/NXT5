import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { assertTrustedMutation,handleError,json,readJson } from './_lib/http';
import { assertMatchSourceMutationEnvironment } from './_lib/match-source-environment';

const invalid=(message:string,status=400)=>Object.assign(new Error(message),{status});
const uuid=(value:unknown)=>{const id=String(value || '');if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))throw invalid('Identifiant invalide.');return id.toLowerCase();};
export default async function handler(request:Request,context:Context) {
  try {
    if(!['GET','POST'].includes(request.method))return json({error:'Méthode refusée.'},405,{Allow:'GET, POST'});
    assertTrustedMutation(request);
    const admin=await requirePlatformAdmin(request,context);
    const body=request.method==='POST' ? await readJson(request,16384):null;
    const id=uuid(body?.userId || new URL(request.url).searchParams.get('userId'));
    if(id===String(admin.id).toLowerCase())throw invalid('Ton propre compte administrateur est protégé.',403);
    if(!body) {
      const [users,teams]=await sql.transaction(tx=>[
        tx`select id,account_name,name,suspended_at,xmin::text as revision from users where id=${id}`,
        tx`select t.id,t.name,t.xmin::text as revision,(select count(*)::int from players p where p.team_id=t.id) as profiles,
          (select count(*)::int from matches m where m.team_id=t.id) as matches from teams t where t.owner_id=${id} order by t.id`
      ],{isolationLevel:'RepeatableRead',readOnly:true});
      if(!users[0])throw invalid('Compte introuvable.',404);
      return json({account:users[0],ownedTeams:teams});
    }
    const action=String(body.action),revision=String(body.expectedRevision || '');
    if(!['suspend','resume','delete'].includes(action) || !/^\d{1,20}$/.test(revision))throw invalid('Action ou révision invalide.');
    if(action==='delete')assertMatchSourceMutationEnvironment(context);
    if(String(body.confirmAccount || '')==='')throw invalid('Saisis l’identifiant du compte pour confirmer.');
    const sessionId=(admin as typeof admin & {session_id?:string}).session_id;
    if(!sessionId)throw invalid('Session administrateur invalide.',403);
    await sql.transaction(tx=>[
      tx`with live as materialized(select s.id from sessions s join users u on u.id=s.user_id where s.id=${sessionId}
        and s.user_id=${admin.id} and s.revoked_at is null and s.expires_at>clock_timestamp()
        and u.suspended_at is null and u.email is not distinct from ${admin.email || null} for update of s,u)
        select (case when exists(select 1 from live) then '1' else 'admin_access_revoked' end)::integer`,
      tx`select id from users where id=${id} for update`,
      tx`select 1 / case when count(*)=1 then 1 else 0 end from users where id=${id} and xmin::text=${revision}
        and account_name=${String(body.confirmAccount)} and (${action}<>'suspend' or suspended_at is null)
        and (${action}<>'resume' or suspended_at is not null)`,
      ...(action==='delete' ? [tx`select id from teams where owner_id=${id} order by id for update`,
        tx`select 1 / case when ${JSON.stringify(body.expectedOwnedTeams || [])}::jsonb = coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'revision',t.xmin::text,
          'profiles',(select count(*)::int from players p where p.team_id=t.id),'matches',(select count(*)::int from matches m where m.team_id=t.id)) order by t.id) from teams t where t.owner_id=${id}),'[]'::jsonb) then 1 else 0 end`,
        tx`delete from users where id=${id}`] : [
        tx`update users set suspended_at=case when ${action}='suspend' then clock_timestamp() else null end,updated_at=clock_timestamp() where id=${id}`,
        // The user lock also serializes against the session-creation trigger.
        tx`update sessions set revoked_at=clock_timestamp() where user_id=${id} and revoked_at is null`
      ]),
      tx`insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values(${admin.id},${'admin.account.'+action},'user',${id},'{}'::jsonb)`
    ]);
    return json({ok:true});
  }catch(error:any){
    if(error.code==='22012')return json({error:'Le compte ou ses équipes ont changé. Recharge le dossier.'},409);
    if(error.code==='22P02')return json({error:'La session administrateur a changé. Reconnecte-toi.'},403);
    return handleError(error);
  }
}
