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
  const decodes = [];
  const decode = vi.fn(() => new Promise(resolve => { decodes.push(resolve); }));
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
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
  expect(fetch.mock.calls[0][0]).toContain('voice=Jinx&kind=pick');
  expect(fetch.mock.calls[1][0]).toContain('voice=Ahri&kind=pick');
  act(() => controls.toggle());
  for (const finish of decodes) finish({});
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(start).not.toHaveBeenCalled();
  expect(fetch.mock.calls.every(([, init]) => init.signal.aborted)).toBe(true);
  expect(controls.active).toBe(false);

  act(() => controls.toggle());
  controls.playConfirmed(after, { ...after, gameId: 'second' });
  controls.playConfirmed(after, snapshot([...after.moves, 'Nami']));
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(3));
  decodes[2]({});
  await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
  expect(fetch.mock.calls[2][0]).toContain('voice=Nami&kind=pick');
});

it('silently prepares the selected ban, reuses it at lock and decodes the next lock during playback', async () => {
  const clips = [];
  const decode = vi.fn(async bytes => new TextDecoder().decode(bytes));
  class Context {
    state = 'running';
    createGain() { return { gain: {}, connect() {} }; }
    decodeAudioData = decode;
    createBufferSource() {
      return { connect() {}, disconnect() {}, start() { clips.push(this); }, stop() { this.onended(); } };
    }
    close() { return Promise.resolve(); }
  }
  vi.stubGlobal('window', { AudioContext: Context });
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('navigator', { userActivation: { hasBeenActive: false } });
  const fetch = vi.fn(async url => new Response(new URL(url, 'https://nxt5.test').searchParams.get('voice')));
  vi.stubGlobal('fetch', fetch);
  let controls;
  function Room() { controls = useDraftVoices(true); return null; }
  act(() => { mounted = TestRenderer.create(<Room />); });
  const snapshot = moves => ({ gameId: 'first', firstPick: 'blue', moves });
  act(() => controls.prepareVoice('Jinx', 'ban'));
  act(() => controls.prepareVoice('Ahri', 'ban'));
  act(() => controls.prepareVoice('Ahri', 'ban'));
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
  expect(clips).toEqual([]);
  const first = snapshot(['Ahri']);
  controls.playConfirmed(snapshot([]), first);
  await vi.waitFor(() => expect(clips.map(clip => clip.buffer)).toEqual(['Ahri']));
  expect(fetch).toHaveBeenCalledTimes(2);
  controls.playConfirmed(first, snapshot(['Ahri', 'Nami']));
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
  expect(clips).toHaveLength(1);
  clips[0].onended();
  await vi.waitFor(() => expect(clips.map(clip => clip.buffer)).toEqual(['Ahri', 'Nami']));
  expect(fetch.mock.calls[2][0]).toContain('voice=Nami&kind=ban');
});
