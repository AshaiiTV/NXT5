import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AppLoadingScreen from '../components/loading/AppLoadingScreen.jsx';

describe('Prisme loading identity', () => {
  it('keeps the selected static symbol available without a canvas or browser API', () => {
    const html=renderToStaticMarkup(<AppLoadingScreen phase="app" />);
    expect(html).toContain('/assets/brand/prisme/nxt5-prisme-5-512.webp');
    expect(html).toContain('/assets/brand/prisme/nxt5-prisme-mono-blanc.svg');
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('/assets/home-motion/glass-poster');
    expect(html).not.toContain('aria-valuenow');
  });
  it('uses actual progress while keeping the same signature through phases', () => {
    const html=renderToStaticMarkup(<AppLoadingScreen phase="bootstrap" progress={{loaded:3,total:8}} />);
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-valuemax="8"');
    expect(html).toContain('Synchronisation en cours');
    expect(html).toContain('/assets/brand/prisme/nxt5-prisme-5-512.webp');
  });
});
