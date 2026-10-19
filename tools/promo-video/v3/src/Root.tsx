import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import React from 'react';
import { Composition, Still } from 'remotion';
import { Main } from './Main';
import { DURATION, FPS } from './timeline';
import { Thumbnail } from './Thumbnail';
import { TutoImporter } from './tuto/TutoImporter';
import { DURATION as TUTO_DURATION, FPS as TUTO_FPS } from './tuto/script';

export const Root: React.FC = () => (
  <>
    <Composition id="Nxt5Promo" component={Main} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
    <Composition id="TutoImporter" component={TutoImporter} durationInFrames={TUTO_DURATION} fps={TUTO_FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
  </>
);
