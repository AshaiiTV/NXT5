export const ACCESS_REQUEST_CONSENT_VERSION = 'access-request-2026-09-08';
export const ACCESS_REQUEST_MAX_BYTES = 12 * 1024;
export const ACCESS_REQUEST_STATUSES = ['new', 'contacted', 'confirmed', 'declined'] as const;

const PUBLIC_FIELDS = new Set(['contactName', 'email', 'teamName', 'role', 'planCode', 'payer', 'purchaseIntent', 'message', 'consent', 'website']);

export function invalidAccessRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400, code: 'INVALID_ACCESS_REQUEST' });
}

function textField(value: unknown, label: string, min: number, max: number, multiline = false): string {
  if (typeof value !== 'string') invalidAccessRequest(`${label} invalide.`);
  const text = multiline ? value.trim() : value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  // Match PostgreSQL char_length instead of counting UTF-16 code units.
  const length = [...text].length;
  if (length < min || length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    invalidAccessRequest(`${label} doit contenir entre ${min} et ${max} caractères.`);
  }
  return text;
}

function choice(value: unknown, values: readonly string[], label: string): string {
  if (typeof value !== 'string' || !values.includes(value)) invalidAccessRequest(`${label} invalide.`);
  return value;
}

export function validateAccessRequest(body: Record<string, unknown>) {
  if (Object.keys(body).some(key => !PUBLIC_FIELDS.has(key))) invalidAccessRequest('Champ de demande inconnu.');
  const website = body.website === undefined ? '' : textField(body.website, 'Site web', 0, 200);
  // Bots receive the same confirmation, without storing the submission.
  if (website) return null;
  if (body.consent !== true) invalidAccessRequest('Ton accord est nécessaire pour être recontacté au sujet de cette demande.');
  const contactName = textField(body.contactName, 'Le nom de contact', 2, 80);
  const emailInput = textField(body.email, 'L’adresse e-mail', 3, 160);
  // Lowercasing can expand Unicode characters; check the exact stored values.
  const email = textField(emailInput.toLowerCase(), 'L’adresse e-mail', 3, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalidAccessRequest('Adresse e-mail invalide.');
  const teamName = textField(body.teamName, 'Le nom de l’équipe', 2, 100);
  const teamKey = textField(teamName.toLowerCase(), 'Le nom de l’équipe', 2, 100);
  return {
    contactName,
    email,
    teamName,
    teamKey,
    role: choice(body.role, ['captain', 'manager', 'coach', 'player', 'other'], 'Rôle'),
    planCode: choice(body.planCode, ['free', 'team_monthly', 'team_season', 'structure'], 'Offre'),
    payer: choice(body.payer, ['self', 'team', 'association', 'unknown'], 'Payeur'),
    purchaseIntent: choice(body.purchaseIntent, ['yes', 'maybe', 'discover'], 'Intention'),
    message: body.message === undefined ? '' : textField(body.message, 'Le message', 0, 2000, true)
  };
}

export function validateAccessRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    invalidAccessRequest('Identifiant de demande invalide.');
  }
  return value;
}

export function validateAccessRequestStatus(value: unknown): string {
  return choice(value, ACCESS_REQUEST_STATUSES, 'Statut');
}

export function validateAccessRequestNote(value: unknown): string {
  return textField(value, 'La note de suivi', 0, 4000, true);
}

export function serializeAccessRequest(row: Record<string, any>) {
  return {
    id: row.id,
    contactName: row.contact_name,
    email: row.email,
    teamName: row.team_name,
    role: row.role,
    planCode: row.plan_code,
    payer: row.payer,
    purchaseIntent: row.purchase_intent,
    message: row.message,
    consentVersion: row.consent_version,
    consentedAt: row.consented_at,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
