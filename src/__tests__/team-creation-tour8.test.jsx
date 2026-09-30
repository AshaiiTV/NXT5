import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client.js';
import { useTeamCreation } from '../hooks/useTeamCreation.js';
vi.mock('../api/client.js', () => ({ apiFetch: vi.fn() }));
vi.mock('../app/routing.js', () => ({ openAppPath: vi.fn() }));
const team = { id: 'created', name: 'Équipe' };
const players = [{ name: 'First', riotId: 'First#EUW' }, { name: 'Second', riotId: 'Second#EUW' }];
const duplicate = () => Object.assign(new Error('Ce Riot ID existe déjà dans cette team.'), { status: 409, code: 'PLAYER_RIOT_ID_EXISTS' });
let renderer;
afterEach(() => { act(() => renderer?.unmount()); vi.resetAllMocks(); });
function mount() {
  let current;
  const callbacks = { setSelectedTeamId: vi.fn(), refreshAll: vi.fn(), pushToast: vi.fn() };
  function Host(props) { current = useTeamCreation(props); return null; }
  act(() => { renderer = TestRenderer.create(<Host {...callbacks} />); });
  return { get current() { return current; }, callbacks, rerender: props => act(() => renderer.update(<Host {...(props || callbacks)} />)) };
}
it('R8-02 continues after a lost response followed by the specific duplicate Riot ID conflict', async () => {
  const host = mount();
  apiFetch.mockResolvedValueOnce({ team }).mockRejectedValueOnce(new Error('Réponse perdue'));
  await act(async () => host.current.create({}, players));
  expect(host.current.pending.next).toBe(0);
  apiFetch.mockRejectedValueOnce(duplicate()).mockResolvedValueOnce({ player: { id: 'second' } });
  await act(async () => host.current.create({}, []));
  expect(host.current.pending).toBeNull();
  expect(host.current.completed).toBe(1);
  expect(apiFetch.mock.calls.filter(([path]) => path === 'teams-create')).toHaveLength(1);
  expect(apiFetch.mock.calls.filter(([path]) => path === 'players-create').map(([, options]) => JSON.parse(options.body).riotId)).toEqual(['First#EUW', 'First#EUW', 'Second#EUW']);
});
it.each([
  [403, 'Accès refusé'],
  [409, 'Les accès ont changé. Recharge l’équipe puis réessaie.'],
  [409, 'Un titulaire occupe déjà ce poste. Recharge l’équipe puis réessaie.'],
])('R8-02 keeps %s / %s recoverable and lets abandonment start a fresh operation', async (status, message) => {
  const host = mount();
  const error = Object.assign(new Error(message), { status });
  apiFetch.mockResolvedValueOnce({ team }).mockRejectedValueOnce(error);
  await act(async () => host.current.create({}, players));
  apiFetch.mockRejectedValueOnce(error);
  await act(async () => host.current.create({}, players));
  expect(host.current.pending.next).toBe(0);
  const before = apiFetch.mock.calls.length;
  act(() => expect(host.current.abandon()).toBe(true));
  expect(host.current.pending).toBeNull();
  expect(apiFetch).toHaveBeenCalledTimes(before);
  apiFetch.mockResolvedValueOnce({ team: { id: 'next-team' } });
  await act(async () => host.current.create({ name: 'Nouvelle' }, []));
  expect(apiFetch.mock.calls.filter(([path]) => path === 'teams-create')).toHaveLength(2);
  expect(host.callbacks.setSelectedTeamId).toHaveBeenLastCalledWith('next-team');
});
it('R8-02 blocks abandonment and concurrent submissions while creation or refresh is in flight', async () => {
  const host = mount();
  let resolveCreate, resolveRefresh;
  apiFetch.mockImplementationOnce(() => new Promise(resolve => { resolveCreate = resolve; }));
  host.callbacks.refreshAll.mockImplementationOnce(() => new Promise(resolve => { resolveRefresh = resolve; }));
  let promise;
  act(() => { promise = host.current.create({}, []); });
  act(() => expect(host.current.abandon()).toBe(false));
  await act(async () => host.current.create({}, players));
  expect(apiFetch).toHaveBeenCalledTimes(1);
  await act(async () => resolveCreate({ team }));
  expect(host.current.busy).toBe(true);
  act(() => expect(host.current.abandon()).toBe(false));
  await act(async () => { resolveRefresh(); await promise; });
  expect(host.current.busy).toBe(false);
});
it('R8-04 keeps controller and actions stable on unrelated renders but uses updated callbacks', async () => {
  const host = mount();
  const initial = host.current;
  host.rerender();
  expect(host.current).toBe(initial);
  expect(host.current.create).toBe(initial.create);
  const changed = { ...host.callbacks, pushToast: vi.fn() };
  host.rerender(changed);
  expect(host.current.create).not.toBe(initial.create);
  apiFetch.mockResolvedValueOnce({ team }).mockRejectedValueOnce(new Error('Failed'));
  await act(async () => host.current.create({}, players));
  expect(host.current.pending).toBeTruthy();
  expect(changed.pushToast).toHaveBeenCalled();
  expect(host.callbacks.pushToast).not.toHaveBeenCalled();
  const pending = host.current;
  host.rerender(changed);
  expect(host.current).toBe(pending);
  act(() => host.current.abandon());
  expect(host.current).not.toBe(pending);
  expect(host.current.create).toBe(pending.create);
  expect(host.current.abandon).toBe(initial.abandon);
});
