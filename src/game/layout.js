/**
 * Shared layout grid for every scene.
 *
 * Every pinned UI element — back button, cog, score pill, cards, title
 * pills, version badge — must align to these anchors so the screen reads
 * as a single composed page instead of "controls floating at slightly
 * different margins".
 *
 * Anchors:
 *   - `contentLeft` / `contentRight` — the vertical gridlines content snaps to.
 *     Back-button LEFT edge, card LEFT edge, hint-text edge → `contentLeft`.
 *     Cog RIGHT edge, score-pill RIGHT edge, card RIGHT edge → `contentRight`.
 *   - `contentCenter` — horizontal centreline for titles + centred labels.
 *   - `navY` — y-coordinate for top-bar controls (back button, cog, score pill,
 *     Settings title). Locking to this makes the row read as a single nav bar.
 *   - `iconR` — standard circular-button radius shared by back button + cog
 *     so they're pixel-identical.
 *   - `gutter` — horizontal page margin from the screen edge.
 *
 * Call `getGrid(scene)` inside `create()` (after `sWidth`/`sHeight` are set).
 */
export function getGrid(scene) {
  const sW = scene.sWidth
  const sH = scene.sHeight
  const minSide = Math.min(sW, sH)
  const gutter = sW * 0.06

  return {
    sW,
    sH,
    minSide,
    gutter,
    contentLeft: gutter,
    contentRight: sW - gutter,
    contentWidth: sW - gutter * 2,
    contentCenter: sW / 2,
    navY: minSide * 0.085,
    iconR: minSide * 0.055
  }
}
