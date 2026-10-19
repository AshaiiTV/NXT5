#!/usr/bin/env bash
# Regenerates every real-UI capture of the tutorial « Importer une partie dans NXT5 »:
#   public/tuto/importer-*.png, public/tuto/site-*.png and src/tuto/captures.json (boxes in CSS px).
# Needs: Playwright + its Chromium (see lib.cjs), the site's node_modules (see run-site.sh, SITE_ROOT=…), curl and
# network access to ddragon.leagueoflegends.com the first time (champion portraits are cached in .asset-cache/).
# Cross-check against the real Electron app (optional): see check-importer-electron.cjs.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
node "$HERE/fixtures/game.cjs"
node "$HERE/capture-importer.cjs"
"$HERE/run-site.sh"
