import type { Config } from '@netlify/functions';
import { reconcilePublications } from './_lib/discord-worker';
import { json, handleError } from './_lib/http';

export default async function handler() {
  try { return json(await reconcilePublications()); }
  catch (error) { return handleError(error); }
}
export const config: Config = {schedule:'*/5 * * * *'};
