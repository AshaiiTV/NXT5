#!/usr/bin/env bash
# Starts a local Vite server on the site sources of this repository, then runs capture-site.cjs.
# Usage: tools/promo-video/v3/capture/tuto/run-site.sh
#   SITE_ROOT=<dir>  directory with the site's node_modules (default: repository root, after `npm ci`).
#                    If it is not the repository, the site sources (src, shared, public, index.html, configs,
#                    tools/seo-build.mjs) are copied into it first so that the capture always reflects the repository.
#   PORT=5199        Vite port.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../../.." && pwd)"
SITE_ROOT="$(cd "${SITE_ROOT:-$REPO}" && pwd)"
PORT="${PORT:-5199}"
if [ ! -d "$SITE_ROOT/node_modules/vite" ]; then
  echo "Vite introuvable dans $SITE_ROOT/node_modules : lance « npm ci » à la racine du dépôt, ou indique SITE_ROOT=<copie du site avec node_modules>." >&2
  exit 1
fi
if [ "$SITE_ROOT" != "$REPO" ]; then
  for d in src shared public; do rm -rf "${SITE_ROOT:?}/$d"; cp -a "$REPO/$d" "$SITE_ROOT/$d"; done
  cp "$REPO"/index.html "$REPO"/vite.config.js "$REPO"/tailwind.config.js "$REPO"/postcss.config.js "$REPO"/package.json "$SITE_ROOT/"
  mkdir -p "$SITE_ROOT/tools" && cp "$REPO/tools/seo-build.mjs" "$SITE_ROOT/tools/"
fi
mkdir -p "$HERE/.logs"
(cd "$SITE_ROOT" && exec node node_modules/vite/bin/vite.js --host 127.0.0.1 --port "$PORT" --strictPort) > "$HERE/.logs/vite.log" 2>&1 &
VITE_PID=$!
trap 'kill $VITE_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done
curl -sf -o /dev/null "http://127.0.0.1:$PORT/" || { echo "Vite ne répond pas (voir .logs/vite.log)" >&2; exit 1; }
SITE="http://127.0.0.1:$PORT" node "$HERE/capture-site.cjs"
