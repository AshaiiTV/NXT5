import { fetchRiotMatch } from './riot';
import { logFailure } from './safe-log';

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

/** Runs a follow-up step once the match is saved. Its failure is only logged
 * (`[scope] label failed after match persistence.`): the import has succeeded. */
export async function runAfterMatchPersistence(scope: string, label: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (err) {
    logFailure(`[${scope}] ${label} failed after match persistence.`, err);
  }
}
