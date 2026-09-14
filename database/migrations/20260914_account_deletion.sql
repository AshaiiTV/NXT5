alter table users add column if not exists deleted_at timestamptz;

create table account_deletion_confirmations (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  session_hash text not null,
  team_plan jsonb not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create index idx_account_deletion_confirmations_user on account_deletion_confirmations(user_id);

-- Receipts contain counts, never the former identity, session, or team IDs.
create table account_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  completed_at timestamptz not null default now(),
  summary jsonb not null
);

create function nxt5_prevent_deleted_account_update() returns trigger as $$
begin
  if old.deleted_at is not null then
    raise exception 'ACCOUNT_DELETED' using errcode = '23514';
  end if;
  return new;
end;
$$ language plpgsql;
create trigger trg_deleted_account_immutable before update on users
for each row execute function nxt5_prevent_deleted_account_update();

-- Serialize new references with deletion, including logins already in flight.
create function nxt5_require_active_account_reference() returns trigger as $$
declare account_id uuid := (to_jsonb(new)->>tg_argv[0])::uuid;
begin
  if account_id is null then return new; end if;
  perform 1 from users where id = account_id and deleted_at is null for share;
  if not found then raise exception 'ACCOUNT_DELETED' using errcode = '23514'; end if;
  return new;
end;
$$ language plpgsql;

do $$
declare item record;
begin
  for item in select * from (values
    ('sessions', 'user_id'), ('password_reset_tokens', 'user_id'),
    ('teams', 'owner_id'), ('team_members', 'user_id'), ('players', 'user_id'),
    ('team_invite_codes', 'created_by'), ('matches', 'created_by'), ('matches', 'reviewed_by'),
    ('match_categories', 'created_by'), ('match_archives', 'created_by'),
    ('reports', 'created_by'), ('composition_types', 'created_by'),
    ('player_availability', 'updated_by'), ('player_goals', 'created_by'),
    ('player_coaching_notes', 'updated_by'), ('access_requests', 'updated_by'),
    ('audit_logs', 'user_id'), ('inactivity_reminder_deliveries', 'user_id'),
    ('account_deletion_confirmations', 'user_id')
  ) as refs(table_name, column_name)
  loop
    execute format('create trigger %I before insert or update of %I on %I for each row execute function nxt5_require_active_account_reference(%L)',
      'trg_active_account_' || item.column_name, item.column_name, item.table_name, item.column_name);
  end loop;
end;
$$;

create function nxt5_delete_account(account_id uuid, expected_password_hash text, session_hash_value text, confirmation_hash text)
returns jsonb as $$
declare
  account users%rowtype;
  confirmation account_deletion_confirmations%rowtype;
  team record;
  successor uuid;
  choice text;
  player_ids uuid[];
  player_count integer;
  session_count integer;
  membership_count integer;
  transferred_count integer := 0;
  deleted_team_count integer := 0;
  receipt account_deletion_receipts%rowtype;
  result_summary jsonb;
begin
  select * into account from users where id = account_id for update;
  if not found or account.deleted_at is not null or account.password_hash <> expected_password_hash then
    raise exception 'ACCOUNT_CHANGED' using errcode = 'P0001';
  end if;
  select * into confirmation from account_deletion_confirmations
    where token_hash = confirmation_hash and user_id = account_id
      and session_hash = session_hash_value and expires_at > now() for update;
  if not found or not exists (select 1 from sessions where user_id = account_id
    and token_hash = session_hash_value and revoked_at is null and expires_at > now()) then
    raise exception 'DELETION_CONFIRMATION_EXPIRED' using errcode = 'P0001';
  end if;

  -- Locks also prevent new members joining an empty team during its deletion.
  perform 1 from teams where owner_id = account_id order by id for update;
  if (select count(*) from teams where owner_id = account_id) <>
     (select count(*) from jsonb_object_keys(confirmation.team_plan)) then
    raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
  end if;
  for team in select id from teams where owner_id = account_id order by id loop
    choice := confirmation.team_plan->>team.id::text;
    if choice is null then raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001'; end if;
    perform 1 from team_members where team_id = team.id order by id for update;
    if choice = 'delete' then
      if exists (select 1 from team_members where team_id = team.id and user_id <> account_id) then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      delete from teams where id = team.id;
      deleted_team_count := deleted_team_count + 1;
    else
      successor := choice::uuid;
      if successor = account_id or not exists (select 1 from team_members where team_id = team.id and user_id = successor) then
        raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001';
      end if;
      perform 1 from users where id = successor and deleted_at is null for share;
      if not found then raise exception 'DELETION_TEAM_CHANGED' using errcode = 'P0001'; end if;
      update teams set owner_id = successor where id = team.id;
      update team_members set role = 'captain' where team_id = team.id and user_id = successor;
      transferred_count := transferred_count + 1;
    end if;
  end loop;

  select coalesce(array_agg(id), '{}'::uuid[]) into player_ids from players where user_id = account_id;
  update match_participants set summoner_name = 'Joueur supprimé', riot_id = null, raw = '{}'::jsonb
    where player_id = any(player_ids);
  -- CASCADE removes pool, availability, goals and coaching notes for these profiles.
  delete from players where id = any(player_ids);
  get diagnostics player_count = row_count;
  delete from team_members where user_id = account_id;
  get diagnostics membership_count = row_count;
  delete from sessions where user_id = account_id;
  get diagnostics session_count = row_count;
  delete from password_reset_tokens where user_id = account_id;
  delete from inactivity_reminder_deliveries where user_id = account_id;
  delete from account_deletion_confirmations where user_id = account_id;

  update team_invite_codes set created_by = null where created_by = account_id;
  update matches set created_by = null where created_by = account_id;
  update matches set reviewed_by = null where reviewed_by = account_id;
  update match_categories set created_by = null where created_by = account_id;
  update match_archives set created_by = null where created_by = account_id;
  update reports set created_by = null where created_by = account_id;
  update composition_types set created_by = null where created_by = account_id;
  update player_availability set updated_by = null where updated_by = account_id;
  update player_goals set created_by = null where created_by = account_id;
  update player_coaching_notes set updated_by = null where updated_by = account_id;
  update access_requests set updated_by = null where updated_by = account_id;
  -- Only a verified address establishes ownership of an unlinked commercial request.
  delete from access_requests where account.email_verified and lower(email) = lower(account.email);
  update audit_logs set user_id = null, entity_id = null, metadata = '{}'::jsonb
    where user_id = account_id or entity_id = account_id
      or metadata::text like '%' || account_id::text || '%';

  update users set deleted_at = now(), account_name = 'deleted-' || id::text,
    name = 'Compte supprimé', email = null, password_hash = '!deleted',
    email_verified = false, email_verify_token = null, email_verify_expires_at = null,
    notif_match = false, notif_report = false, notif_inactivity = false,
    inactivity_notice_pending = false, inactivity_email_sent_at = null,
    inactivity_email_claimed_at = null, last_active_at = now(),
    legal_accepted_at = null, legal_version = null, updated_at = now()
    where id = account_id;

  result_summary := jsonb_build_object('policyVersion', '2026-09-14',
    'profilesPurged', player_count, 'membershipsRemoved', membership_count,
    'sessionsRemoved', session_count, 'teamsTransferred', transferred_count,
    'teamsDeleted', deleted_team_count, 'sharedHistoryRetained', true);
  insert into account_deletion_receipts(token_hash, summary) values (confirmation_hash, result_summary) returning * into receipt;
  insert into audit_logs(id, action, entity_type, metadata)
    values (receipt.id, 'auth.account_deleted', 'user', result_summary);
  return jsonb_build_object('reference', receipt.id, 'completedAt', receipt.completed_at, 'summary', receipt.summary);
end;
$$ language plpgsql;
