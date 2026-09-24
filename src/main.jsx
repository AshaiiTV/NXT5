import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Public styles must load with the first HTML, before the application module.
import './components/ui/core.css';
import './components/brand/brand.css';
import './components/layout/app-chrome.css';
import './pages/public/public-information.css';
import './pages/public/public-entry.css';
import './pages/public/features-page.css';
import './pages/public/support.css';
import NXT5, { preloadApp } from './App.jsx';
import { isAppPath } from './app/routing.js';

function mount(initialApp) {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <NXT5 initialApp={initialApp} />
    </React.StrictMode>
  );
}

// Private routes retain the shared loading screen during the app download.
// Public pages stay visible until the exact same components can mount, avoiding
// an empty Suspense fallback replacing the prerendered content.
if (isAppPath(window.location.pathname)) mount();
else preloadApp().then(({ default: InitialApp }) => mount(InitialApp));
