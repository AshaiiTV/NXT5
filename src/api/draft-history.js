import { apiFetch } from "./client.js";

export async function loadDraftHistory(teamId, signal) {
  const page = after => apiFetch("opponents-drafts", { method: "POST", body: JSON.stringify({action:"list", teamId, ...(after ? {after} : {})}), signal });
  const first = await page();
  if (!first.nextDraftPage) return first;
  const drafts = [...first.drafts];
  let after = first.nextDraftPage;
  while (after) {
    const more = await page(after);
    drafts.push(...more.drafts);
    after = more.nextDraftPage;
  }
  return { ...first, drafts, nextDraftPage: null };
}
