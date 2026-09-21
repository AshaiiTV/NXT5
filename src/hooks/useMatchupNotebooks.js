import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client.js";

// Drafts survive navigation inside the app, stay in memory and are scoped to the account.
const drafts = new Map();
let unloadTarget;
const warnBeforeUnload = (event) => {
  if (!drafts.size) return;
  event.preventDefault();
  event.returnValue = "";
};
function storeDraft(key, draft) {
  if (draft) drafts.set(key, draft);
  else drafts.delete(key);
  if (typeof window === "undefined") return;
  if (drafts.size && !unloadTarget) {
    window.addEventListener("beforeunload", warnBeforeUnload);
    unloadTarget = window;
  } else if (!drafts.size && unloadTarget) {
    unloadTarget.removeEventListener("beforeunload", warnBeforeUnload);
    unloadTarget = undefined;
  }
}
export const emptyNotebook = () => ({ plan: { lanePlan: "", vigilance: "", toKeep: "" }, experiments: [] });
const editable = (notebook) => ({ plan: { ...emptyNotebook().plan, ...notebook?.plan }, experiments: notebook?.experiments || [] });

export function useMatchupNotebooks(teamId, playerId, champion, version = "") {
  const key = teamId && playerId && champion ? `${teamId}|${playerId}|${champion}` : "";
  const activeKey = useRef(key);
  const loadGeneration = useRef(0);
  activeKey.current = key;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: "", notebooks: [], canEdit: false, loading: false, error: "" });
  useEffect(() => {
    loadGeneration.current += 1;
    if (!key) return;
    const controller = new AbortController();
    let current = true;
    setState({ key, notebooks: [], canEdit: false, loading: true, error: "" });
    apiFetch("player-matchups", { method: "POST", signal: controller.signal, body: JSON.stringify({ action: "list", teamId, playerId, champion }) })
      .then((payload) => {
        if (!Array.isArray(payload?.notebooks) || typeof payload?.canEdit !== "boolean") throw new Error("Réponse du carnet incomplète.");
        if (current) setState({ key, ...payload, loading: false, error: "" });
      })
      .catch((error) => { if (current) setState({ key, notebooks: [], canEdit: false, loading: false, error: error.message }); });
    return () => { current = false; controller.abort(); };
  }, [key, teamId, playerId, champion, version, attempt]);
  const save = useCallback(async (identity, draft, expectedRevision) => {
    const requestKey = key;
    const generation = loadGeneration.current;
    const payload = await apiFetch("player-matchups", { method: "POST", body: JSON.stringify({ action: "save", teamId, playerId, champion, ...identity, ...draft, expectedRevision }) });
    if (!payload?.notebook || !Number.isInteger(payload.notebook.revision)) throw new Error("La sauvegarde n’a pas pu être confirmée. Recharge le carnet avant de réessayer.");
    if (activeKey.current === requestKey && loadGeneration.current === generation) setState((previous) => {
      const matches = (item) => item.opponentChampion === payload.notebook.opponentChampion && item.role === payload.notebook.role;
      if (previous.key !== requestKey || previous.notebooks.some((item) => matches(item) && item.revision > payload.notebook.revision)) return previous;
      return { ...previous, notebooks: [...previous.notebooks.filter((item) => !matches(item)), payload.notebook] };
    });
    return payload.notebook;
  }, [key, teamId, playerId, champion]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...(state.key === key ? state : { notebooks: [], canEdit: false, loading: !!key, error: "" }), save, retry };
}

export function useNotebookDraft(key, notebook, save) {
  const [state, setState] = useState(() => drafts.get(key) || { value: editable(notebook), revision: notebook?.revision || 0, dirty: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const scope = useRef({ key });
  const submitting = useRef(null);
  if (scope.current.key !== key) { scope.current = { key }; submitting.current = null; }
  useEffect(() => {
    const restored = drafts.get(key);
    setState(restored || { value: editable(notebook), revision: notebook?.revision || 0, dirty: false });
    setError("");
  }, [key, notebook?.revision]);
  useEffect(() => { setBusy(false); setSaved(false); }, [key]);
  const change = (value) => {
    const next = { value, revision: state.revision, dirty: true };
    storeDraft(key, next);
    setState(next);
    setSaved(false);
  };
  const discard = () => {
    storeDraft(key, null);
    setState({ value: editable(notebook), revision: notebook?.revision || 0, dirty: false });
    setError("");
  };
  const submit = async () => {
    if (submitting.current || !state.dirty) return false;
    const submission = {};
    submitting.current = submission;
    const submittedScope = scope.current;
    const submittedKey = key;
    const submittedValue = state.value;
    setBusy(true);
    setError("");
    try {
      const result = await save(state.value, state.revision);
      // Another mounted view may have edited this draft while this request was pending.
      const newerDraft = drafts.get(submittedKey)?.value !== submittedValue && drafts.has(submittedKey);
      if (!newerDraft) storeDraft(submittedKey, null);
      if (scope.current === submittedScope && !newerDraft) {
        setState({ value: editable(result), revision: result.revision, dirty: false });
        setSaved(true);
      }
      return true;
    } catch (failure) {
      if (scope.current === submittedScope) setError(failure.code === "NOTEBOOK_REVISION_CONFLICT"
        ? "Ce carnet a été modifié par une autre personne. Ton brouillon est conservé. Copie-le avant de recharger la version enregistrée."
        : failure.message || "Impossible d’enregistrer le carnet. Ton brouillon est conservé.");
      return false;
    } finally {
      if (submitting.current === submission) submitting.current = null;
      if (scope.current === submittedScope) setBusy(false);
    }
  };
  return { ...state, change, discard, submit, busy, error, saved };
}

function slimMatch(match) {
  let raw = match.raw || {};
  if (typeof raw === "string") { try { raw = JSON.parse(raw) || {}; } catch { raw = {}; } }
  const candidates = [raw.timeline?.info?.frames, raw.metadata?.timeline?.info?.frames, raw.timeline?.frames,
    raw.timeline?.timeline?.info?.frames, raw.timeline?.timeline?.frames, raw.timelineFrames, raw.info?.timeline?.frames, raw.frames];
  const frames = (candidates.find((items) => Array.isArray(items) && items.length) || []).slice().sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const wanted = [...new Set([10, 15, 20].map((minute) => frames.find((frame) => Number(frame.timestamp) >= minute * 60000 && Number(frame.timestamp) <= (minute + 1) * 60000)).filter(Boolean))];
  // Preserve the distinction between no timeline and a timeline with missing milestones.
  if (frames.length && !wanted.length) wanted.push({ timestamp: 0, participantFrames: {} });
  return { ...match, raw: { info: { gameDuration: raw.info?.gameDuration }, nxt5: { timelineSummary: raw.nxt5?.timelineSummary }, timeline: { info: { frames: wanted.map((frame) => ({ timestamp: frame.timestamp, participantFrames: Object.fromEntries(Object.entries(frame.participantFrames || {}).map(([id, player]) => [id, {
    participantId: player.participantId, totalGold: player.totalGold, xp: player.xp, minionsKilled: player.minionsKilled, jungleMinionsKilled: player.jungleMinionsKilled,
  }])) })) } } } };
}

export function useMatchupStatRows(teamId, rows, version = "") {
  const ids = [...new Set(rows.map((row) => row.match?.id).filter(Boolean))];
  const key = `${teamId || ""}|${ids.join(",")}|${version}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: "", details: new Map(), loading: false, error: "" });
  useEffect(() => {
    if (!teamId || !ids.length) return;
    let current = true;
    const controller = new AbortController();
    setState({ key, details: new Map(), loading: true, error: "" });
    (async () => {
      const details = new Map();
      for (let start = 0; start < ids.length; start += 5) {
        const batch = ids.slice(start, start + 5);
        const payload = await apiFetch("match-details", { method: "POST", signal: controller.signal, body: JSON.stringify({ teamId, matchIds: batch }) });
        if (!current) return;
        if (!Array.isArray(payload?.matches)) throw new Error("Réponse des statistiques incomplète.");
        for (const match of payload.matches) {
          if (batch.includes(match.id) && String(match.team_id) === String(teamId)) details.set(match.id, slimMatch(match));
        }
        if (batch.some((id) => !details.has(id))) throw new Error("Certaines games ne sont plus disponibles. Actualise le profil.");
        setState({ key, details: new Map(details), loading: start + 5 < ids.length, error: "" });
      }
    })().catch((error) => { if (current) setState((previous) => ({ ...previous, loading: false, error: error.message })); });
    return () => { current = false; controller.abort(); };
  }, [key, attempt]);
  const active = state.key === key ? state : { details: new Map(), loading: !!teamId && !!ids.length, error: "" };
  return { rows: rows.map((row) => {
    const detail = active.details.get(row.match?.id);
    if (!detail) return row;
    const participantId = row.raw?.participantId || row.participantId;
    const participant = detail.participants?.find((item) => (row.id && item.id === row.id) || (participantId && Number(item.raw?.participantId || item.participantId) === Number(participantId)));
    return { ...row, ...participant, match: { ...row.match, ...detail } };
  }), loading: active.loading, error: active.error, loaded: active.details.size, total: ids.length, retry: () => setAttempt((value) => value + 1) };
}
