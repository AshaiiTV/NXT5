// SFX pin table (filled in stage 6, once the picture is locked). Every `from` is relative to SHOTS / beatF.
export type Sfx = { from: number; src: string; volume: number; duration?: number; note: string };
export const SFX: Sfx[] = [];
