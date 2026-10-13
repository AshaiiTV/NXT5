import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Backdrop, BlurLine } from '../lib/ui';

export const Planning: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BlurLine line="Planning" start={0} size={96} align="center" />
    </AbsoluteFill>
  </AbsoluteFill>
);
