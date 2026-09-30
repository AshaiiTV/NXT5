-- Reserve durably before the external send. A lost acknowledgement is ambiguous,
-- never proof that the mail was not sent; 'sending' requires manual reconciliation.
create table if not exists inactivity_reminder_pending (
  user_id uuid primary key references users(id) on delete cascade,
  recipient_email text not null,
  inactive_since_at timestamptz not null,
  state text not null check (state in ('sending', 'sent_pending')),
  sent_at timestamptz
);
