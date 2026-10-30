import type { Context } from '@netlify/functions';
import { sql } from './_lib/db';
import { requirePlatformAdmin } from './_lib/platform-admin';
import { assertTrustedMutation, handleError, json, readJson } from './_lib/http';

const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
const uuid = (value: unknown) => {
  const id = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw fail('Identifiant invalide.');
  return id;
};

async function accountDetail(id: string) {
  const [accounts, teams, profiles, activity] = await sql.transaction(tx => [
    tx`select u.id, u.name, u.account_name, u.email, u.email_verified, u.created_at, u.last_active_at,
      u.xmin::text as revision,
      (select count(*)::int from sessions s where s.user_id=u.id and s.revoked_at is null and s.expires_at>now()) as active_sessions
      from users u where u.id=${id}`,
    tx`select t.id, t.name, t.tag, case when t.owner_id=${id} then 'owner' else tm.role end as role
      from teams t left join team_members tm on tm.team_id=t.id and tm.user_id=${id}
      where t.owner_id=${id} or tm.user_id=${id} order by t.name,t.id`,
    tx`select p.id,p.name,p.role,p.riot_id,p.team_id,t.name as team_name from players p
      join teams t on t.id=p.team_id where p.user_id=${id} order by t.name,p.name,p.id`,
    tx`select a.id,a.action,a.entity_type,a.created_at,u.name as actor_name
      from audit_logs a left join users u on u.id=a.user_id
      where a.user_id=${id} or (a.entity_type='user' and a.entity_id=${id})
      order by a.created_at desc,a.id desc limit 15`
  ], { isolationLevel: 'RepeatableRead', readOnly: true });
  if (!accounts.length) throw fail('Compte introuvable.', 404);
  return { account: accounts[0], teams, profiles, activity };
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  try {
    if (!['GET','POST'].includes(request.method)) return json({ error: 'Méthode refusée.' },405,{ Allow:'GET, POST' });
    assertTrustedMutation(request);
    const admin = await requirePlatformAdmin(request,context);
    if (request.method === 'POST') {
      const body = await readJson(request,4096);
      const id = uuid(body.userId);
      if (!['rename','revoke-sessions'].includes(body.action)) throw fail('Action inconnue.');
      if (body.action === 'revoke-sessions' && id === admin.id) throw fail('Utilise les paramètres de ton compte pour gérer ta propre session.');
      const name = String(body.name || '').trim();
      if (body.action === 'rename' && (name.length < 2 || name.length > 80 || /[\x00-\x1f\x7f]/.test(name))) throw fail('Le nom doit contenir entre 2 et 80 caractères.');
      const revision = String(body.expectedRevision || '');
      if (!/^\d{1,20}$/.test(revision)) throw fail('Recharge la fiche avant de modifier le compte.');
      const sessionId = (admin as typeof admin & { session_id?: string }).session_id;
      if (!sessionId) throw fail('Session administrateur invalide.',403);
      // The session lock serializes this action against concurrent revocation.
      // The account version prevents stale edits and duplicate retries. Mutation
      // and audit are one statement: either both persist or neither does.
      const [result] = await sql`
        with valid_admin as materialized (
          select s.id from sessions s join users u on u.id=s.user_id where s.id=${sessionId} and s.user_id=${admin.id}
          and s.revoked_at is null and s.expires_at>clock_timestamp() and u.email is not distinct from ${admin.email || null} for update of s,u
        ), changed as (
          update users set name=case when ${body.action}='rename' then ${name} else name end,
            updated_at=clock_timestamp()
          where id=${id} and xmin::text=${revision} and exists(select 1 from valid_admin)
          returning id
        ), revoked as (
          update sessions set revoked_at=clock_timestamp()
          where user_id in (select id from changed) and ${body.action}='revoke-sessions'
            and revoked_at is null and expires_at>clock_timestamp() returning id
        ), logged as (
          insert into audit_logs(user_id,action,entity_type,entity_id,metadata)
          select ${admin.id},case when ${body.action}='rename' then 'admin.account.rename' else 'admin.sessions.revoke' end,
            'user',id,jsonb_build_object('sessionCount',(select count(*) from revoked))
          from changed where ${body.action}='rename' or exists(select 1 from revoked) returning id
        ) select exists(select 1 from valid_admin) as authorized,exists(select 1 from changed) as changed,
          (select count(*)::int from revoked) as revoked, (select count(*) from logged) as logged`;
      if (!result.authorized) throw fail('La session administrateur a été révoquée. Reconnecte-toi.',403);
      if (!result.changed) throw fail('Ce compte a changé. Recharge sa fiche avant de réessayer.',409);
      return json({ ok:true, revoked:result.revoked });
    }
    const url = new URL(request.url);
    if (url.searchParams.has('userId')) return json(await accountDetail(uuid(url.searchParams.get('userId'))));
    const view = url.searchParams.get('view') || 'accounts';
    if (!['accounts','profiles','journal'].includes(view)) throw fail('Vue inconnue.');
    const rawSearch = String(url.searchParams.get('q') || '').trim();
    if (rawSearch.length > 120) throw fail('La recherche est trop longue.');
    const search = '%' + rawSearch.replace(/[\\%_]/g,'\\$&') + '%';
    const page = Number(url.searchParams.get('page') || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw fail('Page invalide.');
    const filter = url.searchParams.get('filter') || 'all';
    if (!['all','verified','unverified','no-team','unlinked','staff'].includes(filter)) throw fail('Filtre invalide.');
    const limit = 20, offset = (page-1)*limit;
    let rows: any[], counts: any[];
    if (view === 'profiles') {
      [rows, counts] = await sql.transaction(tx => [
        tx`select p.id,p.name,p.role,p.riot_id,p.user_id,p.team_id,t.name as team_name,u.email,u.account_name
          from players p join teams t on t.id=p.team_id left join users u on u.id=p.user_id
          where concat_ws(' ',p.id::text,p.name,p.riot_id,t.name,t.tag,u.email,u.account_name) ilike ${search}
            and (${filter}<>'unlinked' or p.user_id is null)
            and (${filter}<>'staff' or upper(p.role) in ('COACH','ASSISTANT','ANALYST','MANAGER','BOARD'))
          order by p.name,p.id limit ${limit} offset ${offset}`,
        tx`select count(*)::int as total from players p join teams t on t.id=p.team_id left join users u on u.id=p.user_id
          where concat_ws(' ',p.id::text,p.name,p.riot_id,t.name,t.tag,u.email,u.account_name) ilike ${search}
            and (${filter}<>'unlinked' or p.user_id is null)
            and (${filter}<>'staff' or upper(p.role) in ('COACH','ASSISTANT','ANALYST','MANAGER','BOARD'))`
      ], { isolationLevel:'RepeatableRead', readOnly:true });
    } else if (view === 'journal') {
      [rows,counts] = await sql.transaction(tx => [
        tx`select a.id,a.action,a.entity_type,a.entity_id,a.created_at,u.id as user_id,u.name as actor_name
          from audit_logs a left join users u on u.id=a.user_id
          where concat_ws(' ',a.action,a.entity_type,a.entity_id::text,u.name,u.account_name) ilike ${search}
          order by a.created_at desc,a.id desc limit ${limit} offset ${offset}`,
        tx`select count(*)::int as total from audit_logs a left join users u on u.id=a.user_id
          where concat_ws(' ',a.action,a.entity_type,a.entity_id::text,u.name,u.account_name) ilike ${search}`
      ], { isolationLevel:'RepeatableRead',readOnly:true });
    } else {
      [rows,counts] = await sql.transaction(tx => [
        tx`select u.id,u.name,u.account_name,u.email,u.email_verified,u.created_at,u.last_active_at,
          (select count(*)::int from teams t where t.owner_id=u.id or exists(select 1 from team_members m where m.team_id=t.id and m.user_id=u.id)) as team_count,
          (select count(*)::int from players p where p.user_id=u.id) as profile_count
          from users u where (concat_ws(' ',u.id::text,u.name,u.account_name,u.email) ilike ${search}
            or exists(select 1 from players p join teams t on t.id=p.team_id where p.user_id=u.id and concat_ws(' ',p.name,p.riot_id,t.name,t.tag) ilike ${search}))
            and (${filter}<>'verified' or u.email_verified is true)
            and (${filter}<>'unverified' or u.email_verified is not true)
            and (${filter}<>'no-team' or not exists(select 1 from teams t where t.owner_id=u.id or exists(select 1 from team_members m where m.team_id=t.id and m.user_id=u.id)))
          order by u.created_at desc,u.id desc limit ${limit} offset ${offset}`,
        tx`select count(*)::int as total from users u where (concat_ws(' ',u.id::text,u.name,u.account_name,u.email) ilike ${search}
            or exists(select 1 from players p join teams t on t.id=p.team_id where p.user_id=u.id and concat_ws(' ',p.name,p.riot_id,t.name,t.tag) ilike ${search}))
            and (${filter}<>'verified' or u.email_verified is true)
            and (${filter}<>'unverified' or u.email_verified is not true)
            and (${filter}<>'no-team' or not exists(select 1 from teams t where t.owner_id=u.id or exists(select 1 from team_members m where m.team_id=t.id and m.user_id=u.id)))`
      ], { isolationLevel:'RepeatableRead', readOnly:true });
    }
    return json({ rows, pagination:{ page,pageSize:limit,total:Number(counts[0]?.total || 0) } });
  } catch(error) { return handleError(error); }
}
