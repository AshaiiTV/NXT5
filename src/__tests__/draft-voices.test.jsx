import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { useDraftVoices } from '../components/draft/useDraftVoices.js';

let mounted;
afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  mounted = null;
  vi.unstubAllGlobals();
});

it('cancels a pending decode and queued locks on mute, without replaying history or a skipped ban', async () => {
  const start = vi.fn();
  let finishDecode;
  const decode = vi.fn(() => new Promise(resolve => { finishDecode = resolve; }));
  const saved = new Map();
  class Context {
    state = 'running';
    createGain() { return { gain: {}, connect() {} }; }
    decodeAudioData = decode;
    createBufferSource() {
      return { connect() {}, disconnect() {}, start() { start(); queueMicrotask(() => this.onended()); } };
    }
    close() { return Promise.resolve(); }
  }
  vi.stubGlobal('window', { AudioContext: Context, localStorage: {
    getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value),
  } });
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('navigator', { userActivation: { hasBeenActive: true } });
  const fetch = vi.fn(async () => new Response('test audio'));
  vi.stubGlobal('fetch', fetch);
  let controls;
  function Room() { controls = useDraftVoices(true); return null; }
  act(() => { mounted = TestRenderer.create(<Room />); });
  const snapshot = moves => ({ gameId: 'first', firstPick: 'red', moves });
  const before = snapshot([null, 'Gnar', null, null, null]);
  const after = snapshot([...before.moves, null, 'Jinx', 'Ahri']);
  controls.playConfirmed(null, before);
  controls.playConfirmed(before, before);
  expect(fetch).not.toHaveBeenCalled();
  controls.playConfirmed(before, after);
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
  expect(fetch.mock.calls[0][0]).toContain('voice=Jinx&kind=pick');
  act(() => controls.toggle());
  finishDecode({});
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(start).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledOnce();
  expect(controls.active).toBe(false);

  act(() => controls.toggle());
  controls.playConfirmed(after, { ...after, gameId: 'second' });
  controls.playConfirmed(after, snapshot([...after.moves, 'Nami']));
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
  finishDecode({});
  await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
  expect(fetch.mock.calls[1][0]).toContain('voice=Nami&kind=pick');
});
