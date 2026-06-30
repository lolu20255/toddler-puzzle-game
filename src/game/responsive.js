// ──────────────────────────────────────────────────────────────────────────
// Orientation / rotation responsiveness
//
// The game canvas is created with `Phaser.Scale.NONE` at a fixed size in
// physical pixels (innerWidth × DPR), so Phaser does NOT track the viewport or
// react to rotation on its own. Without this module, rotating the device leaves
// the portrait-sized canvas untouched and the layout looks squished/cropped in
// landscape (and vice-versa).
//
// Strategy: when the device flips between portrait and landscape, resize the
// canvas to the new viewport and restart the live scene. Every scene lays its
// content out proportionally from `cameras.main.width/height` (read fresh in
// each scene's preload()/create()), and `pieceDrop.js` re-sets the Matter world
// bounds from `scene.sWidth/sHeight` on every run — so a restart reflows the
// whole scene, decorations, grids and physics included, at the new dimensions.
// This keeps the carefully-tuned retina DPR/zoom setup from main.js intact
// (Scale.RESIZE would break it — see the note there).
//
// We react ONLY to an actual portrait↔landscape flip, never to in-orientation
// size changes. The important case: focusing the parental-gate number <input>
// in the paywall opens the soft keyboard, which shrinks innerHeight without
// changing orientation. Restarting there would bounce the keyboard and wipe the
// field, so those resizes must be ignored.
//
// Tradeoff: rotating mid-puzzle restarts that puzzle (the live scene is rebuilt
// from scratch). For a 2–4 year-old shadow-matching game with no score/lives to
// lose, a fresh board on rotation is harmless and far simpler/safer than
// serialising and rehydrating per-scene state across 14 scenes.
// ──────────────────────────────────────────────────────────────────────────

// Match main.js: cap DPR at 2 so the backing store stays within WKWebView's
// memory budget on real devices.
const DPR = Math.min(window.devicePixelRatio || 1, 2)

// Debounce: rotation fires a burst of resize/orientationchange events, and on
// some devices innerWidth/innerHeight lag a frame behind the rotation. Wait for
// the dimensions to settle before reading them.
const SETTLE_MS = 220

export function installResponsive(game) {
  let lastLandscape = window.innerWidth > window.innerHeight
  let timer = null

  const apply = () => {
    timer = null
    const w = window.innerWidth
    const h = window.innerHeight
    const landscape = w > h

    // Ignore everything that is not a true orientation flip (notably the soft
    // keyboard shrinking innerHeight while staying portrait/landscape).
    if (landscape === lastLandscape) return
    lastLandscape = landscape

    // Resize the backing store to the new viewport in physical pixels. resize()
    // preserves the config `zoom` (1/DPR) and re-applies autoCenter, so the
    // canvas still displays 1:1 at innerWidth × innerHeight CSS pixels.
    game.scale.resize(Math.floor(w * DPR), Math.floor(h * DPR))

    // Rebuild the live scene(s) at the new size. Transitions always use
    // scene.start(), so in practice exactly one scene is active; restarting it
    // re-runs preload()/create() against the freshly-sized camera.
    game.scene.getScenes(true).forEach((scene) => scene.scene.restart())
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(apply, SETTLE_MS)
  }

  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
}
