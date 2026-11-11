/** One drawing system: the approved historical five is the reference glyph.
 * Coordinates precede the shared 0.24 shear; no font substitution. */
export const BRAND_SHEAR = 0.24;
export const BRAND_CONTOURS = {
  N: [[-1.55,-2.2],[-1.55,2.2],[-.65,2.2],[.62,-.35],[.62,2.2],[1.5,2.2],[1.5,-2.2],[.6,-2.2],[-.66,.35],[-.66,-2.2]],
  X: [[-1.55,2.2],[-.52,2.2],[0,.91],[.52,2.2],[1.55,2.2],[.53,0],[1.55,-2.2],[.52,-2.2],[0,-.91],[-.52,-2.2],[-1.55,-2.2],[-.53,0]],
  T: [[-1.55,2.2],[1.5,2.2],[1.5,1.34],[.44,1.34],[.44,-1.75],[0,-2.2],[-.47,-2.2],[-.47,1.34],[-1.55,1.34]],
  5: [[-1.55,2.2],[1.5,2.2],[1.5,1.34],[-.64,1.34],[-.64,.48],[1.04,.48],[1.48,.04],[1.48,-1.75],[1.03,-2.2],[-1.55,-2.2],[-1.55,-1.31],[.56,-1.31],[.56,-.43],[-1.55,-.43]],
};
export function brandGlyphPath(glyph, offset = 0, scale = 100) {
  return BRAND_CONTOURS[glyph].map(([x,y],i) => `${i ? 'L' : 'M'}${((x+y*BRAND_SHEAR+2.15)*scale+offset).toFixed(2)},${((2.3-y)*scale).toFixed(2)}`).join('')+'Z';
}
