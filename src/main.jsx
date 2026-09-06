import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import NXT5 from './App.jsx';

const root = document.getElementById('root');
const app = (
  <React.StrictMode>
    <NXT5 initialPath={window.location.pathname} />
  </React.StrictMode>
);
if (root.dataset.prerendered) hydrateRoot(root, app);
else createRoot(root).render(app);
