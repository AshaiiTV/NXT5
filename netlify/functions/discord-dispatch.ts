import type { Config } from '@netlify/functions';
import { dispatchPublicationBatch } from './_lib/discord-worker';
import { json, handleError } from './_lib/http';

export default async function handler() {
  try { return json(await dispatchPublicationBatch()); }
  catch (error) { return handleError(error); }
}
export const config: Config = {schedule:'* * * * *'};
