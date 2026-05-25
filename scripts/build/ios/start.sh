#!/bin/bash
set -e

# ============================================================
#   Toddler Puzzles — iOS build
#   Builds the web app and syncs it into the native iOS project.
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_BUILD=false
SKIP_OPEN=false
RUN_DEVICE=false

usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -s, --skip-build    Reuse the existing dist/ (skip the web build)"
  echo "  -n, --no-open       Don't open Xcode after syncing"
  echo "  -d, --device        Run on a connected device instead of opening Xcode"
  echo "  -h, --help          Show this help"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--skip-build) SKIP_BUILD=true; shift ;;
    -n|--no-open) SKIP_OPEN=true; shift ;;
    -d|--device) RUN_DEVICE=true; shift ;;
    -h|--help) usage ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; usage ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Toddler Puzzles — iOS Build${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Clean
echo -e "${YELLOW}[1/5]${NC} Cleaning build artifacts..."
rm -rf dist node_modules/.cache
echo -e "${GREEN}✓${NC} Cleaned"
echo ""

# Step 2: Build the web app
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${YELLOW}[2/5]${NC} Building web app..."
  npm run build
  echo -e "${GREEN}✓${NC} Build complete"
else
  echo -e "${YELLOW}[2/5]${NC} Skipping web build (using existing dist/)"
fi
echo ""

# Step 3: Ensure the iOS platform exists
echo -e "${YELLOW}[3/5]${NC} Checking iOS platform..."
if [ ! -d "ios" ]; then
  echo -e "${YELLOW}iOS platform not found. Adding...${NC}"
  npx cap add ios
fi
echo -e "${GREEN}✓${NC} iOS platform ready"
echo ""

# Step 4: Generate app icons & splash (needs real art in assets/ — non-fatal)
echo -e "${YELLOW}[4/5]${NC} Generating app icons & splash..."
if [ -f "assets/icon.png" ]; then
  npx capacitor-assets generate --ios || echo -e "${YELLOW}! Asset generation skipped${NC}"
else
  echo -e "${YELLOW}! No assets/icon.png — using default icons (see assets/README.md)${NC}"
fi
echo ""

# Step 5: Sync
echo -e "${YELLOW}[5/5]${NC} Syncing with Capacitor..."
npx cap sync ios
echo -e "${GREEN}✓${NC} Sync complete"
echo ""

# Open or run
if [ "$RUN_DEVICE" = true ]; then
  echo -e "${BLUE}Running on device...${NC}"
  npx cap run ios
elif [ "$SKIP_OPEN" = false ]; then
  echo -e "${BLUE}Opening Xcode...${NC}"
  npx cap open ios
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Done!${NC}"
echo -e "${GREEN}========================================${NC}"
