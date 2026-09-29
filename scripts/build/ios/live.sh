#!/bin/bash
set -e

# ============================================================
#   ABC Kids Puzzle Pals — iOS simulator with live reload
#   Starts the Vite dev server and runs the native app pointed
#   at it, so saving a file reloads the simulator instantly.
#
#   Usage: npm run ios                  (booted simulator, else an iPhone)
#          IOS_SIM=<udid> npm run ios   (a specific simulator)
#
#   Live reload rewrites the synced native config to the dev URL.
#   Before any release build run: npm run build-nolog && npx cap sync
# ============================================================

DEV_PORT=8080 # Must match server.port in vite/config.dev.mjs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

pick_simulator() {
  if [ -n "$IOS_SIM" ]; then
    echo "$IOS_SIM"
    return
  fi
  local booted
  booted="$(xcrun simctl list devices booted | grep -Eo '[0-9A-F-]{36}' | head -1)"
  if [ -n "$booted" ]; then
    echo "$booted"
    return
  fi
  xcrun simctl list devices available | grep -E '^\s+iPhone' | grep -Eo '[0-9A-F-]{36}' | tail -1
}

TARGET="$(pick_simulator)"
if [ -z "$TARGET" ]; then
  echo "No iOS simulator found. Create one in Xcode, or set IOS_SIM=<udid>."
  exit 1
fi
echo "Simulator: $TARGET"

# The dev server runs in the background and dies with this script (Ctrl+C).
npx vite --config vite/config.dev.mjs --port "$DEV_PORT" --strictPort &
VITE_PID=$!
trap 'kill $VITE_PID 2>/dev/null' EXIT INT TERM

open -a Simulator
npx cap run ios --live-reload --host localhost --port "$DEV_PORT" --target "$TARGET"

echo "App running with live reload. Press Ctrl+C to stop the dev server."
wait $VITE_PID
