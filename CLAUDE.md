# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Session memory

At the **start of every new session**, read every file in `docs/memories/`,
sorted by filename (`YYYY_MM_DD_MEMORY.md`). Newest is most relevant; older
files give historical context. Each file is self-contained — don't assume
earlier work is reflected in current code without reading the entry.

If a memory conflicts with what's in the code, **trust the code and flag the
stale memory** rather than acting on the outdated context.

At the **end of a working session**, append a new file at
`docs/memories/YYYY_MM_DD_MEMORY.md` (today's date) summarising what was
done, the resulting state, gotchas worth remembering, and pending follow-ups.
Update the existing file if one already exists for today.

## Project overview

**Toddler Puzzles** — a browser-based shadow-matching game for 2-4 year-olds,
wrapped with Capacitor for iOS + Android distribution.

- **Stack:** Phaser 3.85 (game engine) + Vue 3.4 (shell) + Vite 5 (bundler).
- **Native shell:** Capacitor 7. `ios/` and `android/` folders committed.
- **TTS backend:** libro-ai (`https://libro-ai.blackboxcode.io`) for
  letter-by-letter pronunciation audio. Provider: ElevenLabs by default.
- **Scenes:** `Boot` → `MainMenu` (with cog → `Settings`) → `GameA/B/C/D` →
  `GameOver`. Four art packs: Toys, Heroes, Faces, Fruits.
- **Languages:** English + Spanish (parent picks in Settings).

## Layout

| Path | What |
|------|------|
| `src/game/scenes/` | Phaser scenes |
| `src/game/celebrate.js` | Match celebration modal + audio orchestration |
| `src/game/itemNames.js` | EN/ES word maps per pack |
| `src/services/` | Capacitor services (platform, storage, settings, haptics, purchases, notifications, native, …) |
| `src/services/libro/` | libro-ai HTTP client + device auth + pronunciation cache |
| `public/assets/` | Game art + audio (icons, fruits, backgrounds, ui sounds) |
| `vite/config.{dev,prod}.mjs` | Vite configs (inject `__APP_VERSION__` from `package.json`) |
| `capacitor.config.json` | Capacitor settings — app id, splash, status bar |
| `scripts/build/` | iOS + Android build scripts |
| `docs/CAPACITOR.md` | Full native build / signing / RevenueCat guide |
| `docs/memories/` | Session memories (this directory) |

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` / `dev-nolog` | Vite dev server (`http://localhost:8080`) |
| `npm run build` / `build-nolog` | Production build into `dist/` |
| `npm run build:ios` / `build:android` | Build + sync + open native IDE |
| `npm run cap:sync` | Re-sync `dist/` into both native projects |
| `npm run cap:assets` | Regenerate icons + splash from `assets/` |

`.env` (gitignored) → local dev URL for libro. `.env.production` (committed,
no secrets) → prod URL.
