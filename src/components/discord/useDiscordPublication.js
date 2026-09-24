import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../api/client.js";
import { discordPost, discordQuery } from "./discord-shared.jsx";

const pending = new Set(["queued", "preparing", "sending", "retry_wait"]);
const interrupted = new Set(["cancelled", "superseded", "withdrawn", "deleted"]);

function pause(signal) {
  return new Promise((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, 1500);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

// Only the current click is shown. The durable server receipt survives a lost
// HTTP response; verifying it never sends a second publication request.
export function useDiscordPublication() {
  const active = useRef(null);
  const attempt = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState({ busy: false, receipt: null, error: "", needsVerification: false });
  useEffect(() => () => active.current?.abort(), []);

  function accept(receipt, controller) {
    if (!receipt || controller.signal.aborted) return false;
    const status = receipt.status;
    if (pending.has(status)) {
      setState({ busy: true, receipt, error: "", needsVerification: false });
      return false;
    }
    if (status === "succeeded") {
      setState({ busy: false, receipt, error: "", needsVerification: false });
    } else if (status === "uncertain") {
      setState({ busy: false, receipt, error: "La confirmation Discord manque. Vérifie cet envoi avant de réessayer.", needsVerification: true });
    } else {
      const error = interrupted.has(status)
        ? "La partie ou les réglages ont changé. Actualise l’aperçu avant de publier."
        : receipt.lastError || "Discord n’a pas accepté cet envoi. Réessaie avec le bouton Publier.";
      setState({ busy: false, receipt, error, needsVerification: false });
    }
    return true;
  }

  async function track(controller) {
    const current = attempt.current;
    const until = Date.now() + 60_000;
    while (!controller.signal.aborted && Date.now() < until) {
      try {
        const data = await apiFetch(discordQuery("team-discord-deliveries", { teamId: current.body.teamId, matchId: current.body.matchId, requestId: current.body.requestId }), { signal: controller.signal });
        const receipt = data?.deliveries?.find((item) => current.ids?.length
          ? current.ids.includes(item.id)
          : item.channelId === current.channelId && item.routeId === current.body.routeId
            && String(item.configVersion) === String(current.configVersion)
            && Number(item.revision) >= current.body.snapshotRevision);
        if (accept(receipt, controller)) return;
      } catch { /* Keep checking the same request after a transient read failure. */ }
      await pause(controller.signal);
    }
    if (!controller.signal.aborted) setState((previous) => ({ ...previous, busy: false,
      error: previous.receipt ? "L’envoi n’est pas encore confirmé. Vérifie son résultat ici dans un instant."
        : "La demande n’a pas pu être confirmée. Clique sur Publier pour réessayer.", needsVerification: Boolean(previous.receipt) }));
  }

  async function send(body, context) {
    if (active.current || state.needsVerification) return;
    const controller = new AbortController();
    active.current = controller;
    // Each explicit click has fresh correlation. Server publication/revision
    // locks provide idempotence, including when the previous response was lost.
    const requestBody = { ...body, requestId: crypto.randomUUID() };
    attempt.current = { body: requestBody, ...context, ids: null };
    setSubmitting(true);
    setState({ busy: true, receipt: null, error: "", needsVerification: false });
    try {
      let result;
      try {
        result = await apiFetch("team-discord-publish", { ...discordPost(requestBody), signal: controller.signal, timeoutMs: 60_000 });
      } finally {
        // Closing must not abort the initial submission; subsequent reads may be stopped.
        if (!controller.signal.aborted) setSubmitting(false);
      }
      if (controller.signal.aborted) return;
      attempt.current.ids = result?.jobs?.map((job) => job.id).filter(Boolean) || [];
      if (!accept(result?.jobs?.[0], controller)) await track(controller);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status && error.status < 500) setState({ busy: false, receipt: null, error: error.message, needsVerification: false });
      else await track(controller);
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  async function verify() {
    if (active.current || !attempt.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState((previous) => ({ ...previous, busy: true, error: "", needsVerification: false }));
    try { await track(controller); }
    finally { if (active.current === controller) active.current = null; }
  }

  function clear() {
    if (active.current) return;
    attempt.current = null;
    setState({ busy: false, receipt: null, error: "", needsVerification: false });
  }
  return { ...state, submitting, send, verify, clear };
}
