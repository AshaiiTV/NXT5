import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
// Global styles load with the first HTML, before the application module. The
// order is the cascade order: shared component styles first, then index.css
// (Tailwind utilities and historical overrides), then public page styles.
import './components/ui/core.css';
import './components/brand/brand.css';
import './components/layout/app-chrome.css';
import './pages/public/public-information.css';
import './pages/public/public-entry.css';
import './pages/public/public-demo.css';
import './components/brand/glass-scene.css';
import './index.css';
import './pages/public/features-page.css';
import './pages/public/public-guides.css';
import './pages/public/support.css';
import NXT5, { preloadApp } from './App.jsx';
import { isAppPath, pageFromPath } from './app/routing.js';
import { preloadPublicPage } from './app/public-pages.jsx';
import { preloadPrivateApp } from './app/private-app.js';
import { prefetchWorkspacePage } from './app/workspace-pages.js';
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

// Private routes retain the shared loading screen during the app download. The
// router, the private shell and the requested page start downloading together
// instead of one after another (each lazy boundary reuses the same request).
// Public pages keep their existing DOM as React attaches interactions. The demo
// and the other lazily loaded public pages are preloaded only for their own
// prerendered page, so the hydrated tree renders them without suspending.
if (isAppPath(window.location.pathname)) {
  const ignore = () => {};
  preloadApp().catch(ignore);
  preloadPrivateApp().catch(ignore);
  prefetchWorkspacePage(pageFromPath(window.location.pathname));
  mount();
} else Promise.all([
  preloadApp(),
  prerenderPath === '/demo' ? import('./pages/public/DemoPage.jsx') : null,
  prerenderPath ? preloadPublicPage(prerenderPath) : null,
]).then(([{ default: InitialApp }, demo]) => mount(InitialApp, demo?.DemoPage)).catch(error => {
  // If automatic chunk recovery cannot reload, mount the existing error UI.
  // An error screen intentionally replaces the snapshot and is not hydratable.
  mount(function FailedDownload() { throw error; }, undefined, false);
});

import './pages/home/home-motion.css';
import './pages/home/product-story.css';
