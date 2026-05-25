#!/bin/bash
set -e

# Regenerate native app icons and splash screens from the source art in
# assets/. See assets/README.md for the required image sizes.
#
# Generates for whichever native platforms exist (ios/ and/or android/).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

npx capacitor-assets generate
