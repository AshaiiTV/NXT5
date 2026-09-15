import { sql } from './db';

export const PURCHASES_SCHEMA_VERSION = 'administration-purchases-20260914-v1';
export const PURCHASE_STATUSES = ['pending', 'paid', 'cancelled', 'refunded'];

export function purchaseFilters(params: URLSearchParams) {
  const status = params.get('status') || '';
  if (status && !PURCHASE_STATUSES.includes(status)) {
    throw Object.assign(new Error('Statut d’achat invalide.'), { status: 400 });
  }
  const q = (params.get('q') || '').trim();
  if (q.length > 160) throw Object.assign(new Error('Recherche trop longue (160 caractères maximum).'), { status: 400 });
  const integer = (key: string, fallback: number, max: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) {
      throw Object.assign(new Error('Pagination invalide.'), { status: 400 });
    }
    return value;
  };
  return { status, q, page: integer('page', 1, 1_000_000), pageSize: integer('pageSize', 10, 100) };
}

export async function assertPurchasesReady() {
  const rows = await sql`select migration_key from app_schema_migrations where migration_key = ${PURCHASES_SCHEMA_VERSION}`;
  if (!rows.length) throw Object.assign(new Error('Purchase migration required'), {
    status: 503, code: 'SCHEMA_MIGRATION_REQUIRED',
    publicMessage: 'L’historique des achats est en cours de préparation. Réessaie plus tard.'
  });
}

export function serializePurchase(row: Record<string, any>) {
  return {
    id: row.id, reference: row.order_reference, customerName: row.customer_name,
    teamName: row.team_name, planCode: row.plan_code, planLabel: row.plan_label,
    unitAmountCents: Number(row.unit_amount_cents), quantity: Number(row.quantity),
    amountCents: Number(row.amount_cents), currency: row.currency, status: row.status,
    orderedAt: row.ordered_at, paidAt: row.paid_at, refundedAt: row.refunded_at,
  };
}

export async function loadPurchases(params: URLSearchParams) {
  const { status, q, page: requestedPage, pageSize } = purchaseFilters(params);
  // strpos treats %, _ and backslashes as literal search characters.
  const [count] = await sql`
    select count(*)::int as total from purchases
    where (${status} = '' or status = ${status})
      and (${q} = '' or strpos(lower(concat_ws(' ', order_reference, customer_name, team_name, plan_label)), lower(${q})) > 0)
  `;
  const total = Number(count.total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const rows = await sql`
    select * from purchases
    where (${status} = '' or status = ${status})
      and (${q} = '' or strpos(lower(concat_ws(' ', order_reference, customer_name, team_name, plan_label)), lower(${q})) > 0)
    order by ordered_at desc, id desc limit ${pageSize} offset ${(page - 1) * pageSize}
  `;
  return { purchases: rows.map(serializePurchase), pagination: { page, pageSize, total, totalPages } };
}

export async function loadPurchaseOverview() {
  // One cutoff shared by all aggregates, independent from history filters/paging.
  const asOf = new Date().toISOString();
  const [totals, monthly] = await Promise.all([
    sql`
      select count(*)::int as orders,
        count(*) filter (where status = 'paid')::int as paid,
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where status = 'refunded')::int as refunded,
        count(*) filter (where status = 'cancelled')::int as cancelled,
        coalesce(sum(amount_cents) filter (where status = 'paid'), 0) as paid_cents,
        coalesce(avg(amount_cents) filter (where status = 'paid'), 0) as average_cents,
        count(*) filter (where status = 'paid' and paid_at >= ${asOf}::timestamptz - interval '30 days')::int as paid_30d,
        count(*) filter (where status = 'paid' and paid_at >= ${asOf}::timestamptz - interval '60 days'
          and paid_at < ${asOf}::timestamptz - interval '30 days')::int as paid_previous_30d
      from purchases where ordered_at <= ${asOf}::timestamptz
        and (paid_at is null or paid_at <= ${asOf}::timestamptz)
    `,
    sql`
      with months as (
        select generate_series(date_trunc('month', ${asOf}::timestamptz at time zone 'UTC') - interval '11 months',
          date_trunc('month', ${asOf}::timestamptz at time zone 'UTC'), interval '1 month') as month
      ), payments as (
        select date_trunc('month', paid_at at time zone 'UTC') as month,
          count(*)::int as count, sum(amount_cents) as amount_cents
        from purchases where status = 'paid' and paid_at <= ${asOf}::timestamptz
          and paid_at >= (date_trunc('month', ${asOf}::timestamptz at time zone 'UTC') - interval '11 months') at time zone 'UTC'
        group by 1
      )
      select to_char(months.month, 'YYYY-MM-DD') as date,
        coalesce(payments.count, 0)::int as count, coalesce(payments.amount_cents, 0) as amount_cents
      from months left join payments using (month) order by months.month
    `,
  ]);
  const row = totals[0];
  return { generatedAt: asOf, currency: 'EUR', totals: {
    orders: Number(row.orders), paid: Number(row.paid), pending: Number(row.pending),
    refunded: Number(row.refunded), cancelled: Number(row.cancelled),
    paidCents: Number(row.paid_cents), averageCents: Number(row.average_cents),
    paid30d: Number(row.paid_30d), paidPrevious30d: Number(row.paid_previous_30d),
    frequency30d: Number(row.paid_30d) / 30,
  }, monthly: monthly.map(month => ({ date: month.date, count: Number(month.count), amountCents: Number(month.amount_cents) })) };
}
