import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Backdrop, BlurLine } from '../lib/ui';

export const Hook: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BlurLine line="Hook" start={0} size={96} align="center" />
    </AbsoluteFill>
  </AbsoluteFill>
);
