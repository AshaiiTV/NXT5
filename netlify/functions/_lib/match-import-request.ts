import { fetchRiotMatch } from './riot';

export function assertImportRequestActive(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw Object.assign(new Error('Import interrompu avant enregistrement. Réessaie lorsque tu es prêt.'), {
    status: 408, code: 'NXT5_IMPORT_CANCELLED'
  });
}

export async function fetchRequestedRiotMatch(gameId: string, signal: AbortSignal) {
  assertImportRequestActive(signal);
  try {
    const match = await fetchRiotMatch(gameId, { signal });
    assertImportRequestActive(signal);
    return match;
  } catch (error) {
    // Native abort reasons need a stable public status rather than a 500.
    assertImportRequestActive(signal);
    throw error;
  }
}
