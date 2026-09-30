-- Suppression de compte en libre-service (30 septembre 2026).
-- La ligne users n'est jamais supprimée : elle est anonymisée et marquée
-- deleted_at. Aucune cascade vers teams, team_members ou les données des
-- autres membres. Chaque clé étrangère vers users reçoit un traitement
-- explicite dans nxt5_delete_account ; l'inventaire est documenté dans
-- docs/suppression-compte-2026-09-30.md et vérifié par les tests.

alter table users add column if not exists deleted_at timestamptz;

-- Réauthentification d'un compte sans mot de passe par un fournisseur déjà
-- associé. Le parcours « reauth » est lié au compte, à la session et à la
-- révision des associations, comme l'association « link ».
do $$
declare item record;
begin
  for item in select conrelid::regclass as table_name, conname from pg_constraint
    where conrelid in ('social_auth_flows'::regclass, 'social_auth_tickets'::regclass)
      and contype = 'c' and pg_get_constraintdef(oid) like '%flow%'
  loop
    execute format('alter table %s drop constraint %I', item.table_name, item.conname);
  end loop;
end $$;
alter table social_auth_flows add constraint social_auth_flows_flow_check
  check (flow in ('login', 'register', 'link', 'reauth'));
alter table social_auth_flows add constraint social_auth_flows_check check (
  (flow in ('link', 'reauth') and user_id is not null and session_hash is not null and link_revision is not null)
  or (flow in ('login', 'register') and user_id is null and session_hash is null and link_revision is null));
alter table social_auth_tickets add constraint social_auth_tickets_flow_check
  check (flow in ('login', 'register', 'link', 'reauth'));
alter table social_auth_tickets add constraint social_auth_tickets_check check (
  (flow in ('link', 'reauth') and user_id is not null and session_hash is not null and link_revision is not null and purpose = 'callback')
  or (flow in ('login', 'register') and user_id is null and session_hash is null and link_revision is null));

-- Preuve de reconnexion valable dix minutes pour une seule session.
create table account_reauthentications (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'discord', 'apple', 'riot')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create index idx_account_reauthentications_user on account_reauthentications(user_id);
create index idx_account_reauthentications_expiry on account_reauthentications(expires_at);

-- Première confirmation : choix pour chaque équipe possédée, lié à la session.
create table account_deletion_confirmations (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null check (session_hash ~ '^[0-9a-f]{64}$'),
  team_plan jsonb not null check (jsonb_typeof(team_plan) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index idx_account_deletion_confirmations_user on account_deletion_confirmations(user_id);
create index idx_account_deletion_confirmations_expiry on account_deletion_confirmations(expires_at);

-- Les reçus contiennent des nombres, jamais l'identifiant, le nom, l'e-mail ou la session.
create table account_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz not null default now(),
  summary jsonb not null
);
create index idx_account_deletion_receipts_completed on account_deletion_receipts(completed_at);

-- Un retrait de référence d'auteur n'est pas une modification du contenu :
-- la suppression de compte conserve les dates de modification des équipes.
create or replace function set_updated_at()
returns trigger as $$
begin
  if coalesce(current_setting('nxt5.preserve_updated_at', true), '') = 'on' then
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Un compte supprimé ne peut plus être modifié ni réactivé.
create function nxt5_deleted_account_immutable() returns trigger language plpgsql as $$
begin
  if old.deleted_at is not null then
    raise exception 'ACCOUNT_DELETED' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_deleted_account_immutable before update on users
  for each row execute function nxt5_deleted_account_immutable();

-- Filet de sécurité : teams.owner_id est en ON DELETE CASCADE. Un DELETE
-- manuel du propriétaire d'une équipe partagée effacerait l'équipe et les
-- données des autres membres ; il est refusé.
create function nxt5_guard_account_delete() returns trigger language plpgsql as $$
begin
  if exists (select 1 from teams where teams.owner_id = old.id and exists (
    select 1 from team_members where team_members.team_id = teams.id and team_members.user_id <> old.id))
  then
    raise exception 'ACCOUNT_OWNS_SHARED_TEAM' using errcode = '23503',
      hint = 'Utiliser nxt5_delete_account : ce DELETE supprimerait les équipes partagées et les données des autres membres.';
  end if;
  return old;
end $$;
create trigger trg_guard_account_delete before delete on users
  for each row execute function nxt5_guard_account_delete();

-- Les liens qui donnent un accès ou rattachent une personne refusent un compte
-- supprimé, y compris une requête déjà en cours : le verrou est celui de la clé
-- étrangère, qui attend la suppression puis relit la ligne. Un compte inexistant
-- reste signalé par la clé étrangère elle-même (23503).
create function nxt5_require_active_account() returns trigger language plpgsql as $$
declare
  account_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  removed_at timestamptz;
begin
  if account_id is null then return new; end if;
  select deleted_at into removed_at from users where id = account_id for key share;
  if removed_at is not null then raise exception 'ACCOUNT_DELETED' using errcode = '23514'; end if;
  return new;
end $$;

do $$
declare item record;
begin
  for item in select * from (values
    ('sessions', 'user_id'), ('password_reset_tokens', 'user_id'),
    ('social_identities', 'user_id'), ('social_auth_flows', 'user_id'), ('social_auth_tickets', 'user_id'),
    ('account_reauthentications', 'user_id'), ('account_deletion_confirmations', 'user_id'),
    ('teams', 'owner_id'), ('team_members', 'user_id'), ('players', 'user_id'),
    ('account_subscriptions', 'user_id'), ('discord_user_links', 'user_id'),
    ('discord_account_link_requests', 'user_id'), ('discord_event_responses', 'user_id'),
    ('discord_review_recipients', 'user_id'), ('discord_review_reads', 'user_id'),
    ('inactivity_reminder_pending', 'user_id'), ('inactivity_reminder_deliveries', 'user_id')
  ) as refs(table_name, column_name)
  loop
    execute format('create trigger %I before insert or update of %I on %I for each row execute function nxt5_require_active_account(%L)',
      'trg_active_account_' || item.column_name, item.column_name, item.table_name, item.column_name);
  end loop;
end $$;

create function nxt5_delete_account(
  account_id uuid, expected_password_hash text, session_hash_value text, confirmation_hash text
) returns jsonb
language plpgsql volatile security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  account users%rowtype;
  confirmation account_deletion_confirmations%rowtype;
  team record;
  choice text;
  successor uuid;
  player_ids uuid[];
  discord_ids text[];
  affected integer;
  teams_transferred integer := 0;
  teams_deleted integer := 0;
  memberships_removed integer;
  profiles_purged integer;
  participants_anonymized integer;
  sessions_closed integer;
  connections_removed integer;
  discord_links_removed integer;
  receipt account_deletion_receipts%rowtype;
  result_summary jsonb;
begin
  -- Même ordre de verrous que la connexion sociale, la dissociation et la réinitialisation.
  select * into account from users where id = account_id for update;
  if not found or account.deleted_at is not null then
    raise exception 'ACCOUNT_CHANGED' using errcode = 'P0001';
  end if;
  if nullif(btrim(account.password_hash), '') is not null then
    if expected_password_hash is null or account.password_hash <> expected_password_hash then
      raise exception 'ACCOUNT_CHANGED' using errcode = 'P0001';
    end if;
  else
    -- Compte sans mot de passe : reconnexion récente, sur cette session, avec un fournisseur encore associé.
    delete from account_reauthentications proof
      where proof.user_id = account_id and proof.session_hash = session_hash_value
        and proof.expires_at > clock_timestamp()
        and exists (select 1 from social_identities identity
          where identity.user_id = account_id and identity.provider = proof.provider);
    get diagnostics affected = row_count;
    if affected = 0 then raise exception 'DELETION_REAUTH_REQUIRED' using errcode = 'P0001'; end if;
  end if;

  select * into confirmation from account_deletion_confirmations
    where token_hash = confirmation_hash and user_id = account_id
      and session_hash = session_hash_value and expires_at > clock_timestamp() for update;
  if not found or not exists (select 1 from sessions where user_id = account_id
    and token_hash = session_hash_value and revoked_at is null and expires_at > clock_timestamp()) then
    raise exception 'DELETION_CONFIRMATION_EXPIRED' using errcode = 'P0001';
  end if;

  -- teams.owner_id : transfert au membre choisi, ou suppression d'une équipe sans
  -- autre membre avec l'accord explicite de la première confirmation.
  perform 1 from teams where owner_id = account_id order by id for update;
  if (select count(*) from teams where owner_id = account_id) <>
     (select count(*) from jsonb_object_keys(confirmation.team_plan)) then
    raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
  end if;
  for team in select id from teams where owner_id = account_id order by id loop
    choice := confirmation.team_plan ->> team.id::text;
    if choice is null then raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001'; end if;
    perform 1 from team_members where team_id = team.id order by id for update;
    if choice = 'delete' then
      if exists (select 1 from team_members where team_id = team.id and user_id <> account_id) then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      delete from teams where id = team.id;
      teams_deleted := teams_deleted + 1;
    else
      if choice !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      successor := choice::uuid;
      if successor = account_id or not exists (select 1 from team_members
        where team_id = team.id and user_id = successor) then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      perform 1 from users where id = successor and deleted_at is null for key share;
      if not found then raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001'; end if;
      update teams set owner_id = successor where id = team.id;
      update team_members set role = 'captain' where team_id = team.id and user_id = successor and role <> 'owner';
      teams_transferred := teams_transferred + 1;
    end if;
  end loop;

  -- players.user_id : profils joueur liés supprimés (cascade sur pool, disponibilités,
  -- objectifs, notes de coaching, carnets de matchups et objectifs Discord du joueur).
  -- Les participations restent dans l'historique de l'équipe, sans identifiant Riot.
  select coalesce(array_agg(id), '{}'::uuid[]) into player_ids from players where user_id = account_id;
  update match_participants set summoner_name = 'Joueur supprimé', riot_id = null,
    raw = case when jsonb_typeof(raw) = 'object' then raw - array['puuid', 'summonerName', 'summonerId',
      'riotIdGameName', 'riotIdTagline', 'riotIdName', 'profileIcon', 'summonerLevel'] else raw end
    where player_id = any(player_ids);
  get diagnostics participants_anonymized = row_count;
  delete from players where id = any(player_ids);
  get diagnostics profiles_purged = row_count;

  -- Liaisons Discord : suppression (cascade sur les choix d'équipe et commandes en attente)
  -- et des traces rattachées aux mêmes identifiants Discord.
  select coalesce(array_agg(discord_user_id), '{}'::text[]) into discord_ids
    from discord_user_links where user_id = account_id;
  delete from discord_user_links where user_id = account_id;
  get diagnostics discord_links_removed = row_count;
  delete from discord_account_link_requests where user_id = account_id or discord_user_id = any(discord_ids);
  delete from discord_interaction_receipts where discord_user_id = any(discord_ids);
  delete from discord_event_responses where user_id = account_id;
  delete from discord_review_reads where user_id = account_id;
  delete from discord_review_recipients where user_id = account_id;
  delete from discord_link_codes where created_by = account_id and consumed_at is null;

  -- Accès, connexions et données propres au compte : suppression physique.
  delete from team_members where user_id = account_id;
  get diagnostics memberships_removed = row_count;
  delete from sessions where user_id = account_id;
  get diagnostics sessions_closed = row_count;
  delete from password_reset_tokens where user_id = account_id;
  delete from social_identities where user_id = account_id;
  get diagnostics connections_removed = row_count;
  delete from social_auth_flows where user_id = account_id;
  delete from social_auth_tickets where user_id = account_id;
  delete from account_reauthentications where user_id = account_id;
  delete from inactivity_reminder_pending where user_id = account_id;
  delete from inactivity_reminder_deliveries where user_id = account_id;
  delete from account_subscriptions where user_id = account_id;
  delete from account_deletion_confirmations where user_id = account_id;
  -- Seule une adresse vérifiée établit que l'ancienne demande commerciale appartient au compte.
  if account.email_verified and account.email is not null then
    delete from access_requests where lower(email) = lower(account.email);
  end if;

  -- Contenus partagés conservés, auteur retiré (référence nulle).
  perform set_config('nxt5.preserve_updated_at', 'on', true);
  update discord_link_codes set created_by = null where created_by = account_id;
  update team_invite_codes set created_by = null where created_by = account_id;
  update matches set created_by = null where created_by = account_id;
  update matches set reviewed_by = null where reviewed_by = account_id;
  update match_categories set created_by = null where created_by = account_id;
  update match_archives set created_by = null where created_by = account_id;
  update reports set created_by = null where created_by = account_id;
  update composition_types set created_by = null where created_by = account_id;
  update player_goals set created_by = null where created_by = account_id;
  update player_availability set updated_by = null where updated_by = account_id;
  update player_coaching_notes set updated_by = null where updated_by = account_id;
  update player_matchup_notebooks set updated_by = null where updated_by = account_id;
  update discord_connections set created_by = null where created_by = account_id;
  update discord_connection_tests set created_by = null where created_by = account_id;
  update discord_routes set created_by = null where created_by = account_id;
  update discord_group_exports set created_by = null where created_by = account_id;
  update discord_team_events set created_by = null where created_by = account_id;
  update discord_team_goals set created_by = null where created_by = account_id;
  update discord_draft_notes set author_id = null where author_id = account_id;
  update discord_goal_updates set user_id = null where user_id = account_id;
  update discord_player_goal_updates set user_id = null where user_id = account_id;
  update discord_community_announcements set created_by = null where created_by = account_id;
  update discord_community_settings set updated_by = null where updated_by = account_id;
  update account_subscriptions set updated_by = null where updated_by = account_id;
  update access_requests set updated_by = null where updated_by = account_id;
  perform set_config('nxt5.preserve_updated_at', 'off', true);

  -- Journaux : auteur, cible et métadonnées retirés lorsqu'ils désignent le compte.
  update audit_logs set user_id = null,
    entity_id = case when entity_id = account_id then null else entity_id end,
    metadata = '{}'::jsonb
    where user_id = account_id or entity_id = account_id
      or strpos(metadata::text, account_id::text) > 0
      or (account.email is not null and strpos(lower(metadata::text), lower(account.email)) > 0)
      or exists (select 1 from unnest(discord_ids) as discord_id where strpos(metadata::text, discord_id) > 0);

  update users set deleted_at = now(), account_name = 'deleted-' || id::text,
    name = 'Compte supprimé', email = null, password_hash = '!deleted',
    email_verified = false, email_verify_token = null, email_verify_expires_at = null,
    notif_match = false, notif_report = false, notif_inactivity = false,
    inactivity_notice_pending = false, inactivity_email_sent_at = null,
    inactivity_email_claimed_at = null, legal_accepted_at = null, legal_version = null,
    social_link_revision = social_link_revision + 1
    where id = account_id;

  result_summary := jsonb_build_object('policyVersion', '2026-09-30',
    'teamsTransferred', teams_transferred, 'teamsDeleted', teams_deleted,
    'membershipsRemoved', memberships_removed, 'profilesPurged', profiles_purged,
    'participantsAnonymized', participants_anonymized, 'sessionsClosed', sessions_closed,
    'externalConnectionsRemoved', connections_removed, 'discordLinksRemoved', discord_links_removed,
    'sharedHistoryRetained', true);
  insert into account_deletion_receipts(token_hash, summary) values (confirmation_hash, result_summary)
    returning * into receipt;
  insert into audit_logs(id, action, entity_type, metadata)
    values (receipt.id, 'auth.account_deleted', 'user', result_summary);
  return jsonb_build_object('reference', receipt.id, 'completedAt', receipt.completed_at, 'summary', receipt.summary);
end;
$$;
