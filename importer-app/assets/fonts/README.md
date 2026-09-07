# Bundled Inter typeface

These original, unmodified WOFF2 assets are served locally, so the importer does
not contact Google Fonts at runtime. The two font files total 133,704 bytes.
Latin and Latin Extended subsets cover French accents and ligatures, including
the uppercase Ÿ. Each subset is variable; no separate file per weight is needed.

| Family | Weights | Source version | License |
| --- | --- | --- | --- |
| Inter | 100–900, upright | Google Fonts v20 | [SIL OFL 1.1](Inter-OFL.txt) |

Retrieved 2026-09-06 from Google Fonts. Exact download URLs are retained below.
Authoritative upstream metadata and license source:
[Inter in Google Fonts](https://github.com/google/fonts/tree/main/ofl/inter).

## Original asset URLs

- `inter-latin-variable.woff2`: https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2
- `inter-latin-ext-variable.woff2`: https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2

## CSS integration

Use `font-family: "Inter", sans-serif` for body copy and headings. Declare both subsets
with the same family and weight range; retain their unicode ranges so the browser
selects the right glyphs. Paths below are relative to `src/styles.css`.

```css
@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("../assets/fonts/inter-latin-ext-variable.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}

@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("../assets/fonts/inter-latin-variable.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

```
