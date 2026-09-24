import type { Config } from '@netlify/functions';
import { withDiscordRuntime } from './_lib/discord-runtime';
import { dispatchPublicationBatch } from './_lib/discord-worker';
import { json, handleError } from './_lib/http';

async function handler() {
  try { return json(await dispatchPublicationBatch()); }
  catch (error) { return handleError(error); }
}
export default withDiscordRuntime(handler);
export const config: Config = {schedule:'* * * * *'};
