// Typed access to the real-UI captures (src/tuto/captures.json, boxes in CSS px of each capture). The box maths live
// in camera.ts (makeResolver), shared with the Node QA.
import { staticFile } from 'remotion';
import data from './captures.json';
import { CAP_IDS, type CapAlias, type CamKey, type Rect } from './script';
import { camAt as camAtRaw, makeResolver, type App, type CaptureEntry } from './camera';

type Entry = CaptureEntry & { gameIdInputText?: GameIdText };
export type GameIdText = { fontSize: string; fontWeight: string; color: string; textX: number; centerY: number };

const CAPS = data.captures as unknown as Record<string, Entry>;
export const RESOLVER = makeResolver(CAPS, CAP_IDS);

export const cap = (a: CapAlias): Entry => {
  const c = CAPS[CAP_IDS[a]];
  if (!c) throw new Error(`capture inconnue ${a}`);
  return c;
};
export const capSrc = (a: CapAlias) => staticFile(cap(a).file);
export const capSize = (a: CapAlias) => cap(a).css;

/** « ALIAS.boxKey » → box (CSS px). The visible part is used when the box runs under a sticky bar. */
export const box = RESOLVER.box;
export const resolvePt = RESOLVER.pt;
export const resolveRect = RESOLVER.rect;

/** Framed camera of a capture shot at frame f (camera.ts). */
export const camAt = (keys: CamKey[], f: number, app: App, size: { w: number; h: number }) => camAtRaw(keys, f, app, size, resolvePt);

/** Scroll offset (px) of the import dialog content in a site capture (0 when the dialog is at its top). */
export const dialogScroll = (a: CapAlias) => {
  const c = cap(a).boxes.dialogContent;
  if (!c) throw new Error(`${a} : pas de dialogContent`);
  return 94 - c.y;
};
/** The import dialog's scrolling band, between its sticky header and sticky footer (identical in S05 → S08). */
export const DIALOG_BAND: Rect = { x: 181, y: 94, w: 1078, h: 711 };
