import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import RiftBoard from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RiftBoard />
  </React.StrictMode>
);
