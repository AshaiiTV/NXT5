# League of Legends minimap

The desktop draft room uses the Summoner’s Rift landscape illustration from Riot’s [How to Play guide](https://www.leagueoflegends.com/fr-fr/how-to-play/). The 1920-pixel WebP is served locally as `summoners-rift-landscape.webp`. [Original illustration](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/ffe8f50201af51a0956875d2aeeb9e662eb0b228-3840x2160.png)

`summoners-rift.png` is the unmodified Summoner's Rift (`mapId: 11`) minimap from Riot Games Data Dragon 16.21.1, downloaded on 2026-10-23. It is served locally, without a third-party image request.

- Source: https://ddragon.leagueoflegends.com/cdn/16.21.1/img/map/map11.png
- Official minimap documentation: https://developer.riotgames.com/docs/lol#data-dragon_other
- Format: PNG, 512 × 512 pixels, 70,985 bytes.
- SHA-256: `5b446777c3e8491c1ab1860bc8fd448ad58f46cf3630d909f74dd3dc3dda8cd1`.

League of Legends assets belong to Riot Games. Data Dragon assets are covered by Riot's developer policies, not by the application's source-code license. Retain the site's Riot non-endorsement notice. Policy: https://developer.riotgames.com/policies/general

## Coordinates

Keep the image square and uncropped: the blue-side base is at the bottom left and the red-side base at the top right. World `x` increases rightward; world `y` increases upward, so the display's vertical coordinate is inverted. Team-relative point colors must not rotate or mirror this background.

The community-authored [Hextechdocs map data](https://hextechdocs.dev/map-data/) documents Summoner's Rift image bounds of `x: −120…14870`, `y: −120…14980`. These are useful projection references, not an official Riot precision guarantee: `(x + 120) / 14990` horizontally and `(14980 − y) / 15100` vertically. A plain `0…15000` projection is only an approximation. Preserve each recorded event position; do not infer missing coordinates or move out-of-bounds events onto the map edge.

This is a static schematic supplied by Data Dragon. Its terrain does not reproduce every patch, elemental transformation or map variation; use it for location context, not collision or pathfinding accuracy.
