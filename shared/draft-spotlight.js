// Source: https://universe-meeps.leagueoflegends.com/v1/en_us/champion-browse/index.json
// Each base-skin row stores an immutable Riot Universe asset path
// and its verified face centre in percent. Optional entries set the framing
// height for duos and the face centre in Riot’s 1280 × 720 recomposition.
import catalogue from './draft-spotlights.json' with { type: 'json' };

export function draftSpotlight(champion, frameWidth = 0, preferCentered = false) {
  if (!Object.hasOwn(catalogue, champion)) return null;
  const [asset, x, y, visible = 38, centered] = catalogue[champion];
  const [, width, height] = /-(\d+)x(\d+)\./.exec(asset);
  if (centered && (preferCentered || frameWidth >= Number(width))) {
    return { asset: 'centered/' + champion + '_0.jpg', centered: true, width: 1280, height: 720,
      visibleHeight: visible/100, x: centered[0]/100, y: centered[1]/100 };
  }
  return { asset, visibleHeight: visible / 100, x: x / 100, y: y / 100, width: Number(width), height: Number(height) };
}

export function spotlightWidths(art) {
  if (art.centered) return [art.width];
  const max = Math.min(3840, art.width);
  return [...[480, 768, 1200, 1920, 2560].filter(w => w < max), max];
}
