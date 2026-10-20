// Composition « TutoImporter » (1920×1080, 30 fps): YouTube tutorial « Importer une partie dans NXT5 ».
// Storyboard: TUTO-IMPORTER.md. The film is data (./script.ts, every frame number lives there), timed by the tutorial
// engine (./engine.ts) and drawn by TutoFilm; this file only binds it to its captures (captures.json), its schematics
// (shots/Schematics.tsx), its cue list (cues.json, from export-cues.mjs importer) and its sound choices. Script, camera
// and framing checks (engine checkScript, camera.ts checkCamera and checkFraming) run at import.
import React from 'react';
import { checkCamera, checkFraming, type CaptureEntry } from './camera';
import { makeCaptures } from './captures';
import data from './captures.json';
import cues from './cues.json';
import { checkScript, makeFilm, type CardShot } from './engine';
import type { FilmRuntime } from './FilmContext';
import { FILM, type View } from './script';
import { DownloadSchema, LolHistorySchema, LolOpenSchema, OpenFileSchema, PickFileSchema, SaveJsonSchema, SmartScreenSchema } from './shots/Schematics';
import { TutoFilm } from './TutoFilm';

export const IMPORTER_FILM: FilmRuntime = { ...makeFilm(FILM), caps: makeCaptures(data.captures as unknown as Record<string, CaptureEntry>, FILM.capIds) };

const errors = [...checkScript(IMPORTER_FILM), ...checkCamera(IMPORTER_FILM, IMPORTER_FILM.caps), ...checkFraming(IMPORTER_FILM, IMPORTER_FILM.caps)];
if (errors.length) throw new Error(`TutoImporter script:\n${errors.join('\n')}`);

const VIEWS: Record<Exclude<View, 'title' | 'prereq' | 'recap'>, React.FC<{ shot: CardShot }>> = {
  download: DownloadSchema,
  openFile: OpenFileSchema,
  smartscreen: SmartScreenSchema,
  lolOpen: LolOpenSchema,
  lolHistory: LolHistorySchema,
  saveJson: SaveJsonSchema,
  pickFile: PickFileSchema,
};
/** Main successes that get a sparkle. */
const SPARKLE = /téléchargé|connecté|Ta game est prête|Fichier chargé|Partie importée|nouvelle ligne/;

export const TutoImporter: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => (
  <TutoFilm film={IMPORTER_FILM} views={VIEWS} cues={cues.cues} sparkle={SPARKLE} bgm={bgm} />
);
