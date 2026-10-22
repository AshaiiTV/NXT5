// Composition « TutoDiscord » (1920×1080, 30 fps): YouTube tutorial « Ajouter le bot NXT5 à ton serveur Discord ».
// Storyboard: TUTO-DISCORD.md. The film is data (./script.ts, every frame number lives there), timed by the tutorial
// engine (../tuto/engine.ts) and drawn by TutoFilm; this file only binds it to its captures (captures.json: the site's;
// its Discord slots are unused placeholders), its schematics (./Schematics.tsx: the Discord beats, as illustrations in
// the NXT5 charte), its cue list (cues.json, from export-cues.mjs discord) and its sound choices. Script, camera,
// framing and cue-list checks (engine checkScript and buildCues, camera.ts checkCamera and checkFraming) run at import
// and are thrown by the composition.
import React from 'react';
import { checkCamera, checkFraming, type CaptureEntry } from '../tuto/camera';
import { makeCaptures } from '../tuto/captures';
import { buildCues, checkScript, makeFilm, type CardShot } from '../tuto/engine';
import type { FilmRuntime } from '../tuto/FilmContext';
import { TutoFilm } from '../tuto/TutoFilm';
import data from './captures.json';
import cues from './cues.json';
import { ConnectSchema, LierSchema, OauthSchema, PublishedSchema, TestMsgSchema, VerifySchema, VisualSchema } from './Schematics';
import { FILM, type View } from './script';

export const DISCORD_FILM: FilmRuntime = { ...makeFilm(FILM), caps: makeCaptures(data.captures as unknown as Record<string, CaptureEntry>, FILM.capIds) };

const errors = [...checkScript(DISCORD_FILM), ...checkCamera(DISCORD_FILM, DISCORD_FILM.caps), ...checkFraming(DISCORD_FILM, DISCORD_FILM.caps)];
// The foley is pinned on cues.json: it must be the cue list of this script (export-cues.mjs discord --write).
if (JSON.stringify(buildCues(DISCORD_FILM)) !== JSON.stringify(cues.cues)) errors.push('cues.json périmé : node src/tuto/export-cues.mjs discord --write');

const VIEWS: Record<Exclude<View, 'title' | 'prereq' | 'recap'>, React.FC<{ shot: CardShot }>> = {
  oauth: OauthSchema,
  lier: LierSchema,
  verify: VerifySchema,
  connect: ConnectSchema,
  testMsg: TestMsgSchema,
  published: PublishedSchema,
  visual: VisualSchema,
};
/** Main successes that get a sparkle. */
const SPARKLE = /bot rejoint|« Compte lié » sur NXT5|« Serveur relié » sur NXT5|Salons enregistrés|Test reçu|Diffusion active|Publié sur Discord/;

/** `allowPlaceholders`: see TutoFilm (a render that shows placeholder captures fails without it; the film shows none
 * today). */
export const TutoDiscord: React.FC<{ bgm?: boolean; allowPlaceholders?: boolean }> = ({ bgm = true, allowPlaceholders = false }) => {
  // Thrown when this composition is shown or rendered, not at import: an error in this film must not block the other
  // compositions of Root.tsx (the Importer, the promo).
  if (errors.length) throw new Error(`TutoDiscord script:\n${errors.join('\n')}`);
  return <TutoFilm film={DISCORD_FILM} views={VIEWS} cues={cues.cues} sparkle={SPARKLE} bgm={bgm} allowPlaceholders={allowPlaceholders} />;
};
