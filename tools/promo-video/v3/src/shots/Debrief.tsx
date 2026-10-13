import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Backdrop, BlurLine } from '../lib/ui';

export const Debrief: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BlurLine line="Debrief" start={0} size={96} align="center" />
    </AbsoluteFill>
  </AbsoluteFill>
);
