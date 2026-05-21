# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Session memory

At the **start of every new session**, read all files in `docs/memories/`. Each file
is named `YYYY_MM_DD_MEMORY.md` and records the context, decisions, and state from a
past working session. Read them newest-first to recover where work left off.

At the **end of a working session**, write a new memory file at
`docs/memories/YYYY_MM_DD_MEMORY.md` (today's date) summarizing what was done,
the repo state, and notes for the next session. Update the existing file if one
already exists for today.

## Project overview

**Toddlers Learning Puzzle** — a browser game for toddlers to learn shapes and colors.

- **Stack:** Phaser 3.85 (game engine) + Vue 3.4 (UI shell) + Vite 5 (bundler).
- **Vue ↔ Phaser bridge:** `src/game/PhaserGame.vue` and `src/game/EventBus.js`.
- **Scenes** (`src/game/scenes/`): `Boot` → `MainMenu` → `GameA` / `GameB` / `GameC` → `GameOver`.
- **Assets:** static files in `public/assets/`.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on `http://localhost:8080` |
| `npm run build` | Production build into `dist/` |
| `npm run dev-nolog` / `npm run build-nolog` | Same, without anonymous template telemetry |
