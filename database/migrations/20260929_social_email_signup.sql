-- No account/identity/session is created before mailbox ownership is proven.
create table if not exists social_signup_emails (
  ticket_hash text primary key references social_auth_tickets(token_hash) on delete cascade,
  token_hash text not null unique,
  email text not null,
  display_name text not null,
  legal_version text not null,
  expires_at timestamptz not null
);

create or replace function complete_social_email_signup(
  mail_hash text, ticket_hash_value text, browser_hash_value text, new_user_id uuid
) returns jsonb
language plpgsql volatile security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare pending social_auth_tickets%rowtype; mail social_signup_emails%rowtype; result jsonb;
begin
  select * into pending from social_auth_tickets
    where token_hash=ticket_hash_value and browser_hash=browser_hash_value
      and purpose='signup' and expires_at>clock_timestamp() for update;
  if not found then return null; end if;
  select * into mail from social_signup_emails
    where ticket_hash=ticket_hash_value and token_hash=mail_hash and expires_at>clock_timestamp() for update;
  if not found then return null; end if;
  -- Never attach to an account that appeared after the email was requested.
  -- A collision consumes this link, but leaves existing users/identities intact.
  begin
    update social_auth_tickets set email=mail.email, email_verified=true where token_hash=ticket_hash_value;
    result := complete_social_signup(ticket_hash_value, browser_hash_value, new_user_id,
      mail.email, mail.display_name, mail.legal_version, null, null);
  exception when unique_violation then
    delete from social_auth_tickets where token_hash=ticket_hash_value;
    return null;
  when raise_exception then
    if sqlerrm not in ('SOCIAL_EXPIRED', 'SOCIAL_EMAIL_EXISTS') then raise; end if;
    delete from social_auth_tickets where token_hash=ticket_hash_value;
    return null;
  end;
  return result;
end;
$$;
