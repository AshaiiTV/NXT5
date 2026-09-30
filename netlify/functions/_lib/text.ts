/** Trimmed text capped at `max` characters. Falsy values (null, undefined, 0, '') become ''. */
export function cleanText(value: unknown, max: number): string {
  return String(value || '').trim().slice(0, max);
}

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for HTML e-mail bodies and attributes. Falsy values become ''. */
export function escapeHtml(value: unknown): string {
  return String(value || '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}
