import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context } from '@netlify/functions';

type InvocationState = { deployContext: string };
const invocation = new AsyncLocalStorage<InvocationState>();
const KNOWN_CONTEXTS = new Set(['production', 'deploy-preview', 'branch-deploy', 'dev']);

function hostedRuntime() {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.SITE_ID);
}
function localContextFallback() {
  // CONTEXT is a build variable, not a reliable hosted Functions variable.
  // Direct local tools/tests may still explicitly select their context.
  if (hostedRuntime()) return 'unknown';
  const value = String(process.env.CONTEXT || '').trim();
  return KNOWN_CONTEXTS.has(value) ? value : value ? 'unknown' : 'dev';
}
function invocationContext(context: unknown) {
  const supplied = context as Partial<Context> | undefined;
  if (supplied?.deploy) {
    const value = String(supplied.deploy.context || '').trim();
    return KNOWN_CONTEXTS.has(value) ? value : 'unknown';
  }
  if (supplied?.site?.id || supplied?.requestId || hostedRuntime()) return 'unknown';
  return localContextFallback();
}

export function getDiscordDeployContext() {
  return invocation.getStore()?.deployContext ?? localContextFallback();
}
export function isDiscordIsolatedContext() {
  return ['deploy-preview', 'branch-deploy', 'unknown'].includes(getDiscordDeployContext());
}

export function withDiscordContext<Result>(context: unknown, run: () => Result): Result {
  // Never mutate a process-global context: waitUntil work and concurrent
  // requests retain their own deployment metadata through async boundaries.
  return invocation.run({ deployContext: invocationContext(context) }, run);
}

export function withDiscordRuntime<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
  return (...args: Args): Result => withDiscordContext(args[1], () => handler(...args));
}
