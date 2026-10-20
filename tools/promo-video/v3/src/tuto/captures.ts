// Access to a film's real-UI captures (its captures.json, boxes in CSS px of each capture) by the film's aliases. The
// box maths live in camera.ts (makeResolver), shared with the Node QA; this adds the image files for the renderer.
import { staticFile } from 'remotion';
import { makeResolver, type CaptureEntry, type Resolver } from './camera';

/** Resolver (entry, box, pt, rect, size of an alias) plus the URL of each capture's image (public/). */
export type Captures = Resolver & { src: (alias: string) => string };

export const makeCaptures = (entries: Record<string, CaptureEntry>, ids: Record<string, string>): Captures => {
  const r = makeResolver(entries, ids);
  return { ...r, src: (a) => staticFile(r.entry(a).file) };
};
