import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
// Public styles must load with the first HTML, before the application module.
import './components/ui/core.css';
import './components/brand/brand.css';
import './components/layout/app-chrome.css';
import './pages/public/public-information.css';
import './pages/public/public-entry.css';
import './pages/public/features-page.css';
import './pages/public/public-demo.css';
import './pages/public/public-guides.css';
import './components/games/imported-games.css';
import './pages/public/support.css';
import NXT5, { preloadApp } from './App.jsx';
import { isAppPath } from './app/routing.js';
import { installChunkRecovery } from './app/chunk-recovery.js';

const stopChunkRecovery = installChunkRecovery();
if (import.meta.hot) import.meta.hot.dispose(stopChunkRecovery);

const root = document.getElementById('root');
const prerenderPath = root.dataset.prerendered === 'true' ? root.dataset.prerenderPath : null;

function mount(initialApp, initialDemoPage, hydrate = Boolean(prerenderPath)) {
  const application = (
    <React.StrictMode>
      <NXT5 initialApp={initialApp} initialRoute={prerenderPath ? { path: prerenderPath, search: '' } : undefined} initialDemoPage={initialDemoPage} />
    </React.StrictMode>
  );
  if (hydrate) hydrateRoot(root, application);
  else createRoot(root).render(application);
}

// Private routes retain the shared loading screen during the app download.
// Public pages keep their existing DOM as React attaches interactions. The demo
// is preloaded only for its own initial page, matching its rendered Suspense tree.
if (isAppPath(window.location.pathname)) mount();
else Promise.all([
  preloadApp(),
  prerenderPath === '/demo' ? import('./pages/public/DemoPage.jsx') : null,
]).then(([{ default: InitialApp }, demo]) => mount(InitialApp, demo?.DemoPage)).catch(error => {
  // If automatic chunk recovery cannot reload, mount the existing error UI.
  // An error screen intentionally replaces the snapshot and is not hydratable.
  mount(function FailedDownload() { throw error; }, undefined, false);
});
