import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { TrendContractsDialog, TrendSourcesDialog } from '../components/trends/TrendsDialogs.jsx';
import { ToastStack } from '../components/ui/Core.jsx';
import { getTopDialog } from '../components/ui/dialog-registry.js';
const portals = vi.hoisted(() => ({ targets: [] }));
vi.mock('react-dom', async original => ({ ...await original(), createPortal: (children, target) => { portals.targets.push(target); return children; } }));
let renderer;
const nodeText = node => typeof node === 'string' ? node : (node?.children || []).map(nodeText).join('');
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.unstubAllGlobals(); portals.targets.length = 0; });

it('shows only the measured evidence for playstyle sources and opens the original game', () => {
  vi.stubGlobal('document', { body: { style: {} } });
  const game = { id: 'source-1', title: 'Partie mesurée', result: 'Victoire', duration: '30:00', side: 'Blue', patch: '26.1',
    playstyleEvidence: [{ label: 'Écart d’or à 10 min', value: '+250' }], playstyleRead: 'Une avance observée à 10 minutes.',
    topRoleLabel: 'Unmeasured legacy contribution', goldDiff: 0 };
  const signals = vi.fn(() => [{ label: 'Or', value: '0' }]);
  const read = vi.fn(() => 'Unmeasured legacy conclusion');
  const onOpenGame = vi.fn();
  const dialog = { showModal: vi.fn(), close: vi.fn() };
  act(() => { renderer = TestRenderer.create(<TrendSourcesDialog source={{ title: 'Sources', playstyle: true, games: [game] }} signals={signals} read={read} onOpenGame={onOpenGame} />, { createNodeMock: node => node.type === 'dialog' ? dialog : null }); });
  const output = JSON.stringify(renderer.toJSON());
  expect(output).toContain('+250');
  expect(output).toContain('Une avance observée à 10 minutes.');
  expect(output).not.toContain('Unmeasured legacy');
  expect(signals).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
  act(() => renderer.root.findAllByType('button').find(node => nodeText(node).includes('Ouvrir la partie')).props.onClick());
  expect(onOpenGame).toHaveBeenCalledWith(game);
});

it.each(['sources', 'contracts'])('R4-V5 routes toasts into the open trends %s dialog', type => {
  vi.stubGlobal('document', { body: { style: {} } });
  const dialog = { showModal: vi.fn(), close: vi.fn() };
  act(() => { renderer = TestRenderer.create(<>
    {type === 'sources' ? <TrendSourcesDialog source={{ title: 'Sources', games: [] }} /> : <TrendContractsDialog objectives={[]} />}
    <ToastStack toasts={[{ id: 'error', title: 'Échec', type: 'red' }]} removeToast={vi.fn()} />
  </>, { createNodeMock: node => node.type === 'dialog' ? dialog : null }); });
  expect(getTopDialog()).toBe(dialog);
  expect(portals.targets.at(-1)).toBe(dialog);
  act(() => renderer.unmount()); renderer = null;
  expect(getTopDialog()).toBeNull();
});
