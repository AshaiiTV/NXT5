import { getDiscordDeployContext, isDiscordIsolatedContext, withDiscordContext } from './discord-runtime';

/** Match writes run deferred SQL triggers even when the preview worker is off.
 * Guard their source before any DB access, including deletes cascading from
 * teams, players or categories. Read-only import previews do not call this. */
export function assertMatchSourceMutationEnvironment(context: unknown): void {
  withDiscordContext(context, () => {
    if (!isDiscordIsolatedContext()) return;
    const unknown = getDiscordDeployContext() === 'unknown';
    throw Object.assign(new Error(unknown
      ? 'Le contexte de déploiement doit être vérifié avant de modifier les données des games.'
      : 'Les modifications de games et les suppressions qui les affectent sont désactivées sur cet aperçu. Utilise NXT5 en production ou un site de test dédié.'), {
      status: 409,
      code: unknown ? 'MATCH_SOURCE_DEPLOY_CONTEXT_UNAVAILABLE' : 'MATCH_SOURCE_DEPLOY_PREVIEW_DISABLED',
    });
  });
}
