// The film being rendered, as every part and shot reads it: the timed film (engine.ts makeFilm) plus its captures
// (captures.ts). Each composition (TutoImporter, TutoDiscord…) provides it once through TutoFilm.
import { createContext, useContext } from 'react';
import type { Captures } from './captures';
import type { Film } from './engine';

export type FilmRuntime = Film & { caps: Captures };

export const FilmCtx = createContext<FilmRuntime | null>(null);

export const useFilm = (): FilmRuntime => {
  const film = useContext(FilmCtx);
  if (!film) throw new Error('useFilm : aucun film fourni (TutoFilm)');
  return film;
};
