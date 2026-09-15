-- Purchase snapshots are independent from access requests and the current tariff.
-- This ledger is populated by the order source; an access request is not an order.
create table purchases (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique check (length(btrim(order_reference)) between 1 and 160),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 200),
  team_name text not null default '',
  plan_code text not null,
  plan_label text not null check (length(btrim(plan_label)) between 1 and 200),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  quantity integer not null default 1 check (quantity > 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  ordered_at timestamptz not null,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('paid', 'refunded') or paid_at is not null),
  check (status <> 'refunded' or refunded_at is not null),
  check (paid_at is null or paid_at >= ordered_at),
  check (refunded_at is null or (paid_at is not null and refunded_at >= paid_at))
);

create index purchases_ordered_at_idx on purchases (ordered_at desc, id desc);
create index purchases_status_ordered_at_idx on purchases (status, ordered_at desc, id desc);
create index purchases_paid_at_idx on purchases (paid_at) where status = 'paid';
