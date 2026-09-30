import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { TrendContractsDialog, TrendSourcesDialog } from '../components/trends/TrendsDialogs.jsx';
import { ToastStack } from '../components/ui/Core.jsx';
import { getTopDialog } from '../components/ui/dialog-registry.js';
const portals = vi.hoisted(() => ({ targets: [] }));
vi.mock('react-dom', async original => ({ ...await original(), createPortal: (children, target) => { portals.targets.push(target); return children; } }));
let renderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; vi.unstubAllGlobals(); portals.targets.length = 0; });
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
