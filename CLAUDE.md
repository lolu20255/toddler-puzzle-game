# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session memory

At the **start of every new session**, read every file in `docs/memories/`,
sorted by filename (`YYYY_MM_DD_MEMORY.md`). Newest is most relevant; older
files give historical context. Each file is self-contained, so don't assume
earlier work is reflected in current code without checking.

If a memory conflicts with what's in the code, **trust the code and flag the
stale memory** rather than acting on the outdated context.

At the **end of a working session**, write `docs/memories/YYYY_MM_DD_MEMORY.md`
(today's date) summarising what was done, the resulting state, gotchas worth
remembering, and pending follow-ups. Update the file if one already exists for
today.

## Project

**ABC Kids Puzzle Pals** (`com.blackboxcode.toddlerpuzzle`): 16 learning games
for 2-4 year-olds. Phaser 3.85 (game) inside a Vue 3 shell, bundled by Vite 5,
wrapped with Capacitor 7 (`ios/` and `android/` are committed). English and
Spanish. Monetised with a RevenueCat lifetime unlock (entitlement `premium`).

**Apple Kids Category (5 and under) is a hard constraint.** No third-party
analytics or ad SDKs (Amplitude was removed; `src/services/amplitude.js` is an
inert stub kept for its API). Every purchase and every outbound link must sit
behind the typed parental gate in `src/components/Paywall.vue`. Fonts are
bundled with `@fontsource` so the app makes no third-party requests.

## Commands

| Command                               | Description                                                                                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev-nolog`                   | Vite dev server on `http://localhost:8080`                                                                                                                                                                                          |
| `npm run build-nolog`                 | Production build into `dist/`                                                                                                                                                                                                       |
| `npm run ios`                         | iOS simulator with live reload: Vite dev server + `cap run ios -l` (booted simulator, or `IOS_SIM=<udid>`). Leaves the native config pointing at `localhost`, so run `npm run build-nolog && npx cap sync` before any release build |
| `npm run build:ios` / `build:android` | Clean, build, sync, open Xcode / Android Studio (`-s` skip build, `-n` no open, `-d` iOS device, `-a`/`-b` Android APK/AAB)                                                                                                         |
| `npm run cap:sync`                    | Copy `dist/` into both native projects (required after every web build you want on a device)                                                                                                                                        |
| `npm run cap:assets`                  | Regenerate native icons + splash from `assets/`                                                                                                                                                                                     |
| `npm run generate:audio`              | Bundle TTS MP3s into `public/audio/levels/<lang>/<pack>/` via the libro API; skips existing files unless `FORCE=1`                                                                                                                  |
| `npx eslint src`                      | Lint (no npm script; Prettier config in `.prettierrc.json`)                                                                                                                                                                         |

The plain `dev` / `build` scripts also run `log.js`, which pings Phaser's
template telemetry host; prefer the `-nolog` variants.

There is no test suite. Verify with `npm run build-nolog`, then run the app:
serve `dist/` (`python3 -m http.server 8123` inside it), set
`localStorage['CapacitorStorage.onboardingComplete']='true'` to skip onboarding,
and drive scenes through `window.__phaserGame.scene.getScenes(true)[0].scene.start('GameX')`
(exposed by `src/game/PhaserGame.vue`). Headless Chrome throttles rAF, so check
state via JS rather than waiting on Phaser timers. For native, `xcodebuild` the
`ios/App/App.xcworkspace` `App` scheme against a simulator.

`.env` (gitignored) holds the local libro URL; `.env.production` (committed, no
secrets) holds prod. `src/config.js` holds build-time switches:
`FORCE_PREMIUM` **must be `false` in any release build** (it once shipped
`true`, unlocking everything), plus `TESTING_FEATURES` and `CUSTOM_RATE_US_ENABLED`.

## Architecture

**Shell.** `src/App.vue` mounts the Phaser game (`PhaserGame.vue`) plus Vue
overlays that sit above the canvas: `SplashIntro`, `Onboarding`, `Paywall`,
`RateUs`. Phaser and Vue talk only through `src/game/EventBus.js` (e.g.
`paywall:open`, `onboarding:open`/`onboarding:complete`, `rate-us:check`,
`entitlement:updated`, `current-scene-ready`). Phaser input uses
`windowEvents: false` so taps on overlays never reach game objects underneath.

**Boot sequence.** `src/main.js` calls `initNative()` (`src/services/native.js`),
which loads settings, starts RevenueCat and libro auth, and installs the app
lifecycle handler (backgrounding stops speech and pauses music). The native
splash is a flat `#6a5ae0` fill; `SplashIntro.vue` hides it after its own first
frame, animates, and leaves once the menu or onboarding is ready. The colour
must match in `capacitor.config.json`, `assets/splash*.png` and `SplashIntro.vue`,
or the hand-off flashes. Phaser's `Boot` scene loads assets, waits for fonts and
`settings.load()`, bakes procedural textures (glyph packs, card icons), then
starts `MainMenu` or opens onboarding.

**Canvas and layout.** `src/game/main.js` renders at CSS size × DPR (DPR capped
at 2; 3 OOM-kills WKWebView on device) with `Scale.NONE` and `zoom: 1/DPR`.
Size comes from `#game-container` (`src/game/viewport.js`), which on iOS sits
below the status bar while the web view runs edge to edge; the status bar strip
is recoloured per scene. `src/game/responsive.js` resizes and restarts the live
scene only on a true portrait/landscape flip. Scenes lay out proportionally from
`cameras.main` and the grid in `src/game/layout.js`.

**Scenes.** `GameA`…`GameP` are the games (`GameA`-`G` and `P` share the
shadow-matching mechanic with Matter.js falling pieces from `pieceDrop.js`).
Phaser reuses scene instances across `start`/`restart`, so **per-run state must
be reset in `init()`**, never only in the constructor. `this.input`, `this.time`
and `this.tweens` listeners are cleared on shutdown; `scene.events` listeners
are not. Shared HUD (back button, score pill) lives in `src/game/hud.js`.
`FREE_SCENES` and `isScenePlayable()` in `src/game/levelComplete.js` are the
single source for premium gating (MainMenu locks and the post-level
auto-rotation both use them).

**Audio.** Three separate paths:

- Word audio is bundled MP3s, loaded as HTMLAudio by
  `src/services/libro/levelAudio.js` (bundle first, libro API fallback). The
  per-match flow (spelling, then praise, with letter reveal timed to the audio
  duration) is in `src/game/celebrate.js`. `stopAllSpeech()` runs on every
  scene shutdown.
- UI sound effects are Phaser WebAudio (keys `ui_*`, loaded in `Boot`).
- Menu music (`src/services/music.js`) streams HTMLAudio through a gain node on
  Phaser's AudioContext, plays only on `MainMenu`/`Settings`, and follows the
  `musicEnabled` setting. Credits are in `public/assets/audio/music/README.md`.

Asset keys follow `asset_<pack>_<letter>` with letters `a`-`j`, so a pack holds
at most 10 items. The pack name must match both `ITEM_NAMES` in
`src/game/itemNames.js` and the audio folder name.

**Services** (`src/services/`) are singletons that guard native calls with
`isNativePlatform()`. `settings.js` keeps a synchronous in-memory cache backed
by Capacitor Preferences, with an `onChange()` subscription.

## Adding a game

1. `src/game/scenes/GameX.js`, with per-run state in `init()`.
2. Register it in the `scene` array in `src/game/main.js`.
3. Add it to `SCENES` (and `FREE_SCENES` if free) in `src/game/levelComplete.js`.
4. Add a `GAMES` entry in `src/game/scenes/MainMenu.js`.
5. Load its art, or bake a procedural icon, in `src/game/scenes/Boot.js`.
6. Add the words to `ITEM_NAMES.en` and `.es` in `src/game/itemNames.js`
   (`WORD_ONLY_PACKS` if the word shouldn't be spelled out).
7. `npm run generate:audio`.

## iOS WebView gotchas

- Use a transparent `Phaser.Rectangle` as the hit target; Container input is
  unreliable in WKWebView.
- Keep interactive elements away from the very top edge of the canvas.
- Keep `PushNotifications` lazy-imported and uncalled at launch; a missing push
  entitlement crashes the WebContent process.
- Register `App.addListener('backButton')` on Android only.
- Emoji glyphs can render as empty boxes; draw icons as SVG or Phaser graphics.

