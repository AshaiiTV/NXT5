import { isDiscordEnabled } from './discord-config';

/** Optional fast path. Imports remain successful if dispatch is unavailable;
 * the durable outbox and scheduled dispatcher provide the fallback. */
export function wakeDiscordPublications(context: unknown): void {
  if (!isDiscordEnabled()) return;
  const waitUntil=(context as any)?.waitUntil;
  if (typeof waitUntil !== 'function') return;
  waitUntil.call(context,(async () => {
    try {
      const {dispatchPublicationBatch}=await import('./discord-worker');
      await dispatchPublicationBatch({allowSoon:true});
    } catch {
      console.error('[discord-dispatch]',{code:'FAST_WAKE_FAILED',fallback:'scheduled-dispatch'});
    }
  })());
}
