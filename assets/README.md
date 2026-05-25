# App store art

Source images for `npx capacitor-assets generate` (run via `npm run cap:assets`
or automatically by the build scripts). All are square PNGs.

| File | Size | Purpose |
|------|------|---------|
| `icon.png` | 1024×1024 | App icon (iOS + Android) |
| `icon-foreground.png` | 1024×1024 | Android adaptive-icon foreground (with safe padding) |
| `icon-background.png` | 1024×1024 | Android adaptive-icon background (solid colour or simple art) |
| `splash.png` | 2732×2732 | Launch splash, light mode (keep content centred) |
| `splash-dark.png` | 2732×2732 | Launch splash, dark mode (optional) |

Until real art is added, the build scripts skip asset generation and the apps
use Capacitor's default icons — fine for testing, but **replace before release**.

Tips:
- Keep important content within the centre ~66% of the splash — edges get cropped.
- The adaptive-icon foreground needs ~25% padding; Android masks it to various shapes.
- The splash background colour is also set in `capacitor.config.json` (`#5bb6ef`).
