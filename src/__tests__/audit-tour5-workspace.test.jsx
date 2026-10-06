import React, { Suspense } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MainApp } from '../AppContent.jsx';
import { Teams } from '../pages/workspace/Teams.jsx';
import { Button } from '../components/ui/Core.jsx';
import { apiFetch } from '../api/client.js';

const crash = vi.hoisted(() => ({ enabled: false }));
vi.mock('../api/client.js', () => ({ apiFetch: vi.fn(), API_BASE: '/.netlify/functions' }));
vi.mock('../components/assistant/AssistantPanel.jsx', () => ({ default: () => null }));
vi.mock('../NextPhase.jsx', () => ({ TeamDataHealthPanel: () => null }));
vi.mock('../pages/workspace/DraftWorkspace.jsx', () => ({ DraftWorkspace: () => {
  if (crash.enabled) throw new Error('Private implementation detail');
  return <p>Draft disponible</p>;
} }));
vi.mock('../pages/GuidePage.jsx', () => ({ default: () => <p>Guide disponible</p> }));
vi.mock('../components/layout/AppChrome.jsx', () => ({
  AmbientBackground: () => null, ApiBanner: () => null, BeginnerCompass: () => null,
  Sidebar: () => <nav>Menu conservé</nav>, Topbar: () => <header>Équipe</header>,
}));

const team = { id: 'team', owner_id: 'user', name: 'Otters', tag: 'OTT', region: 'EUW' };
const snapshot = { teams: [], players: [], matches: [], selectedTeamId: null, pagination: { total: 0, hasMore: false } };
const props = { user: { id: 'user', email: 'user@nxt5.test', email_verified: true }, onLogout: vi.fn(), onUserUpdate: vi.fn(), pushToast: vi.fn(), navigate: vi.fn() };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let renderer;
const view = (path = '/equipes', search = '?create=1') => <Suspense fallback={null}><MainApp {...props} route={{ path, search }} /></Suspense>;
const creationForm = () => renderer.root.findAllByType('form').find(form => form.findAllByType(Button).some(button => ['Créer l’équipe', 'Reprendre les joueurs manquants', 'Création en cours…'].includes(button.props.children)));
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => {
  crash.enabled = false;
  vi.stubGlobal('window', {
    location: { search: '?create=1', reload: vi.fn() },
    localStorage: { getItem: () => null }, setInterval, clearInterval,
    history: { pushState: vi.fn() }, dispatchEvent: vi.fn(), scrollTo: vi.fn(),
  });
  vi.stubGlobal('document', { querySelector: () => null, getElementById: () => null });
  apiFetch.mockReset();
});
afterEach(() => {
  act(() => renderer?.unmount()); renderer = undefined;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each([false, true])('T5-01 resumes after bootstrap unmounts, with existing team = %s, without duplicate creation', async existing => {
  const secondPlayer = deferred();
  const bootstraps = [];
  let initial = true;
  let playerCalls = 0;
  const old = { ...team, id: 'old', name: 'Old' };
  apiFetch.mockImplementation((endpoint) => {
    if (endpoint.startsWith('bootstrap?')) {
      if (initial) { initial = false; return Promise.resolve({ ...snapshot, teams: existing ? [old] : [], selectedTeamId: existing ? old.id : null }); }
      const request = deferred(); bootstraps.push(request); return request.promise;
    }
    if (endpoint === 'teams-create') return Promise.resolve({ team });
    if (endpoint === 'players-create') {
      playerCalls++;
      return playerCalls === 2 ? secondPlayer.promise : Promise.resolve({ player: {} });
    }
    throw new Error(endpoint);
  });
  await act(async () => { renderer = TestRenderer.create(view()); });
  act(() => renderer.root.findByProps({ label: 'Nom de l’équipe' }).props.onChange('Otters'));
  act(() => renderer.root.findByProps({ label: 'Joueurs à ajouter (facultatif)' }).props.onChange('One#EUW, Two#EUW, Three#EUW'));
  let creating;
  await act(async () => { creating = creationForm().props.onSubmit({ preventDefault() {} }); });
  expect(renderer.root.findAllByType(Teams)).toHaveLength(0);
  expect(bootstraps).toHaveLength(1);
  const loaded = { ...snapshot, teams: [team], selectedTeamId: team.id };
  await act(async () => bootstraps[0].resolve(loaded));
  const form = creationForm();
  expect(form).toBeTruthy();
  expect(form.findAllByType(Button).find(b => b.props.type === 'submit').props.disabled).toBe(true);
  await act(async () => form.props.onSubmit({ preventDefault() {} }));
  expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === 'teams-create')).toHaveLength(1);
  await act(async () => secondPlayer.reject(new Error('Second joueur indisponible')));
  expect(bootstraps).toHaveLength(2);
  await act(async () => { bootstraps[1].resolve(loaded); await creating; });
  expect(text()).toContain('Reprendre les joueurs manquants');
  expect(text()).toContain('Two#EUW, Three#EUW');
  let resumed;
  await act(async () => { resumed = creationForm().props.onSubmit({ preventDefault() {} }); });
  await act(async () => { bootstraps[2].resolve(loaded); await resumed; });
  const createdPlayers = apiFetch.mock.calls.filter(([endpoint]) => endpoint === 'players-create').map(([, options]) => JSON.parse(options.body).riotId);
  expect(createdPlayers).toEqual(['One#EUW', 'Two#EUW', 'Two#EUW', 'Three#EUW']);
  expect(apiFetch.mock.calls.filter(([endpoint]) => endpoint === 'teams-create')).toHaveLength(1);
  expect(text()).not.toContain('Reprendre les joueurs manquants');
});

it('N5-01 contains rendering errors, focuses the fallback, reloads and recovers on another section', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  apiFetch.mockResolvedValue({ ...snapshot, teams: [team], selectedTeamId: team.id });
  const focus = vi.fn();
  crash.enabled = true;
  await act(async () => {
    renderer = TestRenderer.create(view('/draft/compositions', ''), { createNodeMock: element => element.type === 'h2' ? { focus } : null });
  });
  expect(text()).toContain('Cette rubrique n’a pas pu s’afficher.');
  expect(text()).toContain('Menu conservé');
  expect(text()).not.toContain('Private implementation detail');
  expect(focus).toHaveBeenCalledOnce();
  act(() => renderer.root.findAllByType(Button).find(b => b.props.children === 'Recharger').props.onClick());
  expect(window.location.reload).toHaveBeenCalledOnce();
  await act(async () => renderer.update(view('/guide', '')));
  expect(text()).toContain('Guide disponible');
  expect(text()).not.toContain('Cette rubrique n’a pas pu s’afficher.');
  crash.enabled = false;
  await act(async () => renderer.update(view('/draft/compositions', '')));
  expect(text()).toContain('Draft disponible');
});
