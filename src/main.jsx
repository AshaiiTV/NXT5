import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import NXT5 from './App.jsx';
import { installChunkRecovery } from './app/chunk-recovery.js';

const stopChunkRecovery = installChunkRecovery();
if (import.meta.hot) import.meta.hot.dispose(stopChunkRecovery);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NXT5 />
  </React.StrictMode>
);
