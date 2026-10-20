// Composition « TutoDiscord » (1920×1080, 30 fps): YouTube tutorial « Ajouter le bot NXT5 à ton serveur Discord ».
// Storyboard: TUTO-DISCORD.md. The film is data (./script.ts, every frame number lives there), timed by the tutorial
// engine (../tuto/engine.ts) and drawn by TutoFilm; this file only binds it to its captures (captures.json: the site's,
// and the owner's real Discord screenshots, placeholders until delivered), its cue list (cues.json, from
// export-cues.mjs discord) and its sound choices. It has no schematic: Discord is shown by its real captures only.
// Script, camera and framing checks (engine checkScript, camera.ts checkCamera and checkFraming) run at import.
import React from 'react';
import { checkCamera, checkFraming, type CaptureEntry } from '../tuto/camera';
import { makeCaptures } from '../tuto/captures';
import { checkScript, makeFilm } from '../tuto/engine';
import type { FilmRuntime } from '../tuto/FilmContext';
import { TutoFilm } from '../tuto/TutoFilm';
import data from './captures.json';
import cues from './cues.json';
import { FILM } from './script';

export const DISCORD_FILM: FilmRuntime = { ...makeFilm(FILM), caps: makeCaptures(data.captures as unknown as Record<string, CaptureEntry>, FILM.capIds) };

const errors = [...checkScript(DISCORD_FILM), ...checkCamera(DISCORD_FILM, DISCORD_FILM.caps), ...checkFraming(DISCORD_FILM, DISCORD_FILM.caps)];
if (errors.length) throw new Error(`TutoDiscord script:\n${errors.join('\n')}`);

/** Main successes that get a sparkle. */
const SPARKLE = /bot rejoint|« Compte lié » sur NXT5|« Serveur relié » sur NXT5|Salons enregistrés|Test reçu|Diffusion active|Publié sur Discord/;

export const TutoDiscord: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => (
  <TutoFilm film={DISCORD_FILM} views={{}} cues={cues.cues} sparkle={SPARKLE} bgm={bgm} />
);
