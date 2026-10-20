#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP="$(pwd)/TornadT.app"
if [ -d "$APP" ]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  ditto "$APP" "backups/TornadT-$stamp.app"
fi
npm run package:mac
built="release/mac-arm64/TornadT.app"
if [ ! -d "$built" ]; then
  built="release/mac/TornadT.app"
fi
if [ ! -d "$built" ]; then echo "Packaged app not found in release/." >&2; exit 1; fi
rm -rf "$APP"
ditto "$built" "$APP"
echo "Ready: $APP"
