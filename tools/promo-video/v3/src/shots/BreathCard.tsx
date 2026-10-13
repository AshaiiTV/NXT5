import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Backdrop, BlurLine } from '../lib/ui';

export const BreathCard: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BlurLine line="BreathCard" start={0} size={96} align="center" />
    </AbsoluteFill>
  </AbsoluteFill>
);
