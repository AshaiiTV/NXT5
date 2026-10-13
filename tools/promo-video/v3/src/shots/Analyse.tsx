import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Backdrop, BlurLine } from '../lib/ui';

export const Analyse: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BlurLine line="Analyse" start={0} size={96} align="center" />
    </AbsoluteFill>
  </AbsoluteFill>
);
