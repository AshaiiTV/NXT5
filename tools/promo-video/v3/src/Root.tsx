import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { DURATION, FPS } from './timeline';

export const Root: React.FC = () => (
  <Composition id="Nxt5Promo" component={Main} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
);
