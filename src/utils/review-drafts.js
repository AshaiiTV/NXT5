export const emptyReviewDraft = () => ({ id: null, title: "", content: "", matchIds: [] });
const copyDraft = (draft) => ({ id: draft?.id || null, title: draft?.title || "", content: draft?.content || "", matchIds: [...(draft?.matchIds || [])] });
export const reviewDraftChanged = (draft, baseline = emptyReviewDraft()) => JSON.stringify(copyDraft(draft)) !== JSON.stringify(copyDraft(baseline));

/** Session memory only: no team notes are written to browser storage. */
export function createReviewDraftStore(getWindow = () => typeof window === "undefined" ? null : window) {
  const drafts = new Map();
  let listeningWindow = null;
  const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
  const syncWarning = () => {
    if (drafts.size && !listeningWindow) { listeningWindow = getWindow(); listeningWindow?.addEventListener("beforeunload", warn); }
    if (!drafts.size && listeningWindow) { listeningWindow.removeEventListener("beforeunload", warn); listeningWindow = null; }
  };
  const key = (userId, teamId) => JSON.stringify([String(userId || ""), String(teamId || "")]);
  return {
    hasDrafts() { return drafts.size > 0; },
    read(userId, teamId) { return copyDraft(drafts.get(key(userId, teamId))?.form); },
    readBaseline(userId, teamId) { return copyDraft(drafts.get(key(userId, teamId))?.baseline); },
    write(userId, teamId, draft, baseline = emptyReviewDraft()) {
      if (!userId || !teamId) return;
      if (reviewDraftChanged(draft, baseline)) drafts.set(key(userId, teamId), { form: copyDraft(draft), baseline: copyDraft(baseline) });
      else drafts.delete(key(userId, teamId));
      syncWarning();
    },
    clear() { drafts.clear(); syncWarning(); },
  };
}

export const reviewDrafts = createReviewDraftStore();
