export const ACCOUNT_SUBSCRIPTION_PLANS = ['free', 'team_monthly', 'team_season', 'structure'] as const;
type PlanCode = typeof ACCOUNT_SUBSCRIPTION_PLANS[number];
type Mutation = {
  action: 'assign' | 'revoke'; userId: string; expectedRevision: number;
  planCode: PlanCode; startsAt: string | null; endsAt: string | null; note: string | null;
};

export function invalidSubscription(message: string): never {
  throw Object.assign(new Error(message), { status: 400, code: 'INVALID_ACCOUNT_SUBSCRIPTION' });
}

export function subscriptionUserId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    invalidSubscription('Identifiant de compte invalide.');
  }
  return value.toLowerCase();
}

function dateInput(value: unknown, label: string): string {
  if (typeof value !== 'string') invalidSubscription(`${label} invalide.`);
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/);
  if (!parts) invalidSubscription(`${label} doit préciser la date, l’heure et le fuseau horaire.`);
  const [, yearValue, monthValue, dayValue, hour, minute, second = '0', , offsetHour = '0', offsetMinute = '0'] = parts;
  const year = Number(yearValue), month = Number(monthValue), day = Number(dayValue);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
  const timestamp = Date.parse(value);
  if (year < 1 || day < 1 || day > days || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || Number(offsetHour) > 23 || Number(offsetMinute) > 59 || !Number.isFinite(timestamp)) invalidSubscription(`${label} invalide.`);
  return new Date(timestamp).toISOString();
}

function noteInput(value: unknown): string {
  if (typeof value !== 'string' || value.includes('\0') || [...value.trim()].length > 1000) invalidSubscription('La note doit contenir au maximum 1 000 caractères.');
  return value.trim();
}

export function validateSubscriptionMutation(body: Record<string, unknown>, now = Date.now()): Mutation {
  if (body.action !== 'assign' && body.action !== 'revoke') invalidSubscription('Action invalide.');
  const allowed = body.action === 'assign'
    ? ['action', 'userId', 'planCode', 'startsAt', 'endsAt', 'note', 'expectedRevision']
    : ['action', 'userId', 'note', 'expectedRevision'];
  if (Object.keys(body).some(key => !allowed.includes(key))) invalidSubscription('Champ d’abonnement inconnu.');
  const userId = subscriptionUserId(body.userId);
  if (typeof body.expectedRevision !== 'number' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= 2147483647) {
    invalidSubscription('Révision du compte invalide. Recharge la liste.');
  }
  const note = body.note === undefined ? (body.action === 'revoke' ? null : '') : noteInput(body.note);
  if (body.action === 'revoke') return { action: 'revoke', userId, expectedRevision: body.expectedRevision, planCode: 'free', startsAt: null, endsAt: null, note };
  if (!ACCOUNT_SUBSCRIPTION_PLANS.includes(body.planCode as PlanCode)) invalidSubscription('Offre invalide.');
  const planCode = body.planCode as PlanCode;
  if (planCode === 'free') {
    if (body.startsAt != null || body.endsAt != null) invalidSubscription('Découverte ne nécessite pas de dates de validité.');
    return { action: 'assign', userId, expectedRevision: body.expectedRevision, planCode, startsAt: null, endsAt: null, note };
  }
  const startsAt = body.startsAt == null ? new Date(now).toISOString() : dateInput(body.startsAt, 'Le début');
  const endsAt = body.endsAt == null ? null : dateInput(body.endsAt, 'La fin');
  if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) invalidSubscription('La fin doit être strictement postérieure au début.');
  return { action: 'assign', userId, expectedRevision: body.expectedRevision, planCode, startsAt, endsAt, note };
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  return new Date(value as string).toISOString();
}

export function serializeAccountSubscription(row: Record<string, any> | null | undefined, admin = false, now = Date.now()) {
  const planCode: PlanCode = row?.plan_code || 'free';
  const startsAt = iso(row?.starts_at), endsAt = iso(row?.ends_at), revokedAt = iso(row?.revoked_at);
  const status = !row ? 'none' : revokedAt ? 'revoked'
    : startsAt && Date.parse(startsAt) > now ? 'scheduled'
    : endsAt && Date.parse(endsAt) <= now ? 'expired' : 'active';
  return {
    planCode, effectivePlanCode: status === 'active' ? planCode : 'free', status,
    startsAt, endsAt, revokedAt, updatedAt: iso(row?.updated_at), revision: Number(row?.revision || 0),
    ...(admin ? { note: row?.note || '' } : {})
  };
}

export function serializeSubscriptionAccount(row: Record<string, any>) {
  return {
    id: row.id, name: row.name || row.account_name, accountName: row.account_name,
    email: row.email || '', subscription: serializeAccountSubscription(row.subscription, true)
  };
}

export function serializeSubscriptionHistory(row: Record<string, any>) {
  const metadata = row.metadata || {};
  return {
    id: row.id, action: row.action === 'account_subscription.revoke' ? 'revoke' : 'assign',
    actorName: row.actor_name || 'Administrateur supprimé', planCode: metadata.planCode,
    startsAt: iso(metadata.startsAt), endsAt: iso(metadata.endsAt), note: metadata.note || '', createdAt: iso(row.created_at)
  };
}

export function subscriptionPage(value: string | null, fallback: number, maximum: number): number {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) invalidSubscription('Pagination invalide.');
  return Number(value);
}

export function subscriptionSearch(value: string | null): string {
  const query = (value || '').normalize('NFKC').trim();
  if ([...query].length > 100 || query.includes('\0')) invalidSubscription('Recherche invalide.');
  return `%${query.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}
