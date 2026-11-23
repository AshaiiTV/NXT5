-- Email change confirmation (see docs/securite-comptes-2026-11-23.md).
-- A requested address is kept aside until its owner opens the link sent to it
-- from a browser signed in to the account. The unique address index only
-- covers users.email: a pending address reserves nothing. Idempotent.
alter table users add column if not exists pending_email text default null;
alter table users add column if not exists pending_email_token text default null;
alter table users add column if not exists pending_email_expires_at timestamptz default null;
create index if not exists idx_users_pending_email_token
  on users(pending_email_token) where pending_email_token is not null;
