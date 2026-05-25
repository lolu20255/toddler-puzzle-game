#!/bin/bash
set -e

# ============================================================
#   Toddler Puzzles — Android build
#   Builds the web app and syncs it into the native Android project.
# ============================================================

# Capacitor's Android build needs a modern JDK. Prefer Homebrew OpenJDK.
if [ -d "/opt/homebrew/opt/openjdk@21" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
  export PATH="$JAVA_HOME/bin:$PATH"
elif [ -d "/opt/homebrew/opt/openjdk@17" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_BUILD=false
SKIP_OPEN=false
RUN_DEVICE=false
BUILD_APK=false
BUILD_BUNDLE=false

usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -s, --skip-build    Reuse the existing dist/ (skip the web build)"
  echo "  -n, --no-open       Don't open Android Studio after syncing"
  echo "  -d, --device        Run on a connected device"
  echo "  -a, --apk           Build a debug APK after syncing"
  echo "  -b, --bundle        Build a release bundle (AAB) after syncing"
  echo "  -h, --help          Show this help"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--skip-build) SKIP_BUILD=true; shift ;;
    -n|--no-open) SKIP_OPEN=true; shift ;;
    -d|--device) RUN_DEVICE=true; shift ;;
    -a|--apk) BUILD_APK=true; shift ;;
    -b|--bundle) BUILD_BUNDLE=true; shift ;;
    -h|--help) usage ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; usage ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

# Version code management (auto-incremented after each release bundle).
VERSION_CODE_FILE="$SCRIPT_DIR/version_code.txt"
if [ -f "$VERSION_CODE_FILE" ]; then
  VERSION_CODE=$(cat "$VERSION_CODE_FILE")
else
  VERSION_CODE=1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Toddler Puzzles — Android Build${NC}"
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

# Step 3: Ensure the Android platform exists
echo -e "${YELLOW}[3/5]${NC} Checking Android platform..."
if [ ! -d "android" ]; then
  echo -e "${YELLOW}Android platform not found. Adding...${NC}"
  npx cap add android
fi
echo -e "${GREEN}✓${NC} Android platform ready"
echo ""

# Step 4: Generate app icons & splash (needs real art in assets/ — non-fatal)
echo -e "${YELLOW}[4/5]${NC} Generating app icons & splash..."
if [ -f "assets/icon.png" ]; then
  npx capacitor-assets generate --android || echo -e "${YELLOW}! Asset generation skipped${NC}"
else
  echo -e "${YELLOW}! No assets/icon.png — using default icons (see assets/README.md)${NC}"
fi
echo ""

# Step 5: Sync
echo -e "${YELLOW}[5/5]${NC} Syncing with Capacitor..."
npx cap sync android
echo -e "${GREEN}✓${NC} Sync complete"
echo ""

# Optional: debug APK
if [ "$BUILD_APK" = true ]; then
  echo -e "${BLUE}Building debug APK...${NC}"
  (cd android && ./gradlew assembleDebug)
  APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
  [ -f "$APK_PATH" ] && echo -e "${GREEN}✓${NC} APK: $APK_PATH ($(du -h "$APK_PATH" | cut -f1))"
  echo ""
fi

# Optional: release bundle (AAB)
if [ "$BUILD_BUNDLE" = true ]; then
  echo -e "${BLUE}Building release bundle — versionCode $VERSION_CODE${NC}"
  echo -e "${YELLOW}Note: requires release signing configured in android/app/build.gradle${NC}"
  (cd android && ./gradlew bundleRelease -PversionCode="$VERSION_CODE")
  AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
  if [ -f "$AAB_PATH" ]; then
    echo -e "${GREEN}✓${NC} AAB: $AAB_PATH ($(du -h "$AAB_PATH" | cut -f1))"
    echo "$((VERSION_CODE + 1))" > "$VERSION_CODE_FILE"
    echo -e "${GREEN}✓${NC} Version code bumped to $((VERSION_CODE + 1)) for next build"
  fi
  echo ""
fi

# Open or run
if [ "$RUN_DEVICE" = true ]; then
  echo -e "${BLUE}Running on device...${NC}"
  npx cap run android
elif [ "$SKIP_OPEN" = false ] && [ "$BUILD_APK" = false ] && [ "$BUILD_BUNDLE" = false ]; then
  echo -e "${BLUE}Opening Android Studio...${NC}"
  npx cap open android
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Done!${NC}"
echo -e "${GREEN}========================================${NC}"
