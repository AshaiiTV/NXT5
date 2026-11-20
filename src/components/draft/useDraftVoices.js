import { useCallback, useEffect, useRef, useState } from "react";
import { draftTurns } from "../../../shared/draft-order.js";
import { getLanguage } from "../../i18n/locale.js";

const MUTE_KEY = "nxt5:draft:voices-muted";

function wasMuted() {
  try { return window.localStorage.getItem(MUTE_KEY) === "true"; }
  catch { return false; }
}

// A poll can reveal consecutive locks together. Play their lines in turn on
// one channel, and discard unfinished work when the listener leaves or mutes.
function createVoicePlayer(onActive) {
  let context, gain, source, muted = wasMuted();
  let batch = new AbortController();
  let queue = Promise.resolve();

  function stop() {
    batch.abort();
    batch = new AbortController();
    queue = Promise.resolve();
    source?.stop();
    source = null;
  }

  function unlock() {
    if (muted) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      gain = context.createGain();
      gain.gain.value = 0.5;
      gain.connect(context.destination);
      context.onstatechange = () => onActive(!muted && context.state === "running");
    }
    if (context.state !== "running") void context.resume().catch(() => {});
    onActive(context.state === "running");
  }

  function toggle() {
    muted = !muted && context?.state === "running";
    try { window.localStorage.setItem(MUTE_KEY, String(muted)); } catch { /* Storage is optional. */ }
    if (muted) { stop(); onActive(false); }
    else unlock();
  }

  function enqueue(champion, kind) {
    if (muted || context?.state !== "running") return;
    const params = new URLSearchParams({ voice: champion, kind, lang: getLanguage() });
    const { signal } = batch;
    queue = queue.then(async () => {
      if (signal.aborted) return;
      const response = await fetch("/.netlify/functions/asset-proxy?" + params, { signal });
      if (!response.ok) return;
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (signal.aborted || context.state !== "running") return;
      const clip = context.createBufferSource();
      clip.buffer = buffer;
      clip.connect(gain);
      source = clip;
      await new Promise(resolve => {
        clip.onended = resolve;
        clip.start();
      });
      clip.disconnect();
      if (source === clip) source = null;
    }).catch(() => { /* A missing clip must not interrupt the next turn. */ });
  }

  function close() {
    stop();
    if (context) {
      context.onstatechange = null;
      void context.close().catch(() => {});
    }
  }
  return { unlock, toggle, enqueue, stop, close };
}

export function useDraftVoices(live) {
  const player = useRef(null);
  const toggleButton = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!live) return;
    const audio = createVoicePlayer(setActive);
    player.current = audio;
    function interact(event) {
      if (!toggleButton.current?.contains(event.target)) audio.unlock();
    }
    // Captains already interact to draft. An observer can use the same
    // gesture anywhere in the room, or explicitly enable the speaker.
    if (navigator.userActivation?.hasBeenActive) audio.unlock();
    document.addEventListener("click", interact);
    document.addEventListener("keydown", interact);
    return () => {
      document.removeEventListener("click", interact);
      document.removeEventListener("keydown", interact);
      audio.close();
      player.current = null;
    };
  }, [live]);

  const playConfirmed = useCallback((previous, next) => {
    if (!previous || previous.gameId !== next.gameId) { player.current?.stop(); return; }
    if (!player.current) return;
    const turns = draftTurns(next.firstPick);
    for (let index = previous.moves.length; index < next.moves.length; index++) {
      const champion = next.moves[index];
      if (champion) player.current.enqueue(champion, turns[index][0]);
    }
  }, []);

  return { active, toggleButton, toggle: () => player.current?.toggle(), playConfirmed };
}
