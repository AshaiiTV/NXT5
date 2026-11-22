import { useCallback, useEffect, useRef, useState } from "react";
import { draftTurns } from "../../../shared/draft-order.js";
import { getLanguage } from "../../i18n/locale.js";

const MUTE_KEY = "nxt5:draft:voices-muted";

function wasMuted() {
  try { return window.localStorage.getItem(MUTE_KEY) === "true"; }
  catch { return false; }
}

function createVoicePlayer(onActive) {
  let context, gain, source, muted = wasMuted();
  let preview = null;
  let queue = Promise.resolve();
  const pending = new Set();

  function stop() {
    preview?.controller.abort();
    preview = null;
    for (const line of pending) line.controller.abort();
    pending.clear();
    queue = Promise.resolve();
    source?.stop();
    source = null;
  }

  function unlock() {
    if (muted) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio({ latencyHint: "interactive" });
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

  function voiceUrl(champion, kind) {
    return "/.netlify/functions/asset-proxy?" + new URLSearchParams({ voice: champion, kind, lang: getLanguage() });
  }

  function load(url) {
    const controller = new AbortController();
    const buffer = fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      return controller.signal.aborted ? null : context.decodeAudioData(bytes);
    }).catch(() => null);
    return { url, controller, buffer };
  }

  function prepare(champion, kind) {
    // The first tap in a guest room may also be the gesture that enables audio.
    unlock();
    if (muted || !context) return;
    const url = champion && voiceUrl(champion, kind);
    if (preview?.url === url) return;
    preview?.controller.abort();
    preview = url ? load(url) : null;
    const candidate = preview;
    candidate?.buffer.then(buffer => {
      if (!buffer && preview === candidate) preview = null;
    });
  }

  function enqueue(champion, kind) {
    if (muted || !context) return;
    const url = voiceUrl(champion, kind);
    if (preview?.url !== url) preview?.controller.abort();
    const line = preview?.url === url ? preview : load(url);
    preview = null;
    pending.add(line);
    // Fetch and decode immediately. Only the voices themselves share a queue.
    queue = queue.then(async () => {
      const buffer = await line.buffer;
      if (!buffer || line.controller.signal.aborted || context.state !== "running") return;
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
    }).catch(() => { /* Audio errors must not block later locks. */ })
      .finally(() => pending.delete(line));
  }

  function close() {
    stop();
    if (context) {
      context.onstatechange = null;
      void context.close().catch(() => {});
    }
  }
  return { unlock, toggle, prepare, enqueue, stop, close };
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

  return { active, toggleButton, toggle: () => player.current?.toggle(), playConfirmed,
    prepareVoice: (champion, kind) => player.current?.prepare(champion, kind) };
}
