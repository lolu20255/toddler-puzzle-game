#!/usr/bin/env node
/**
 * Generate the 4 source PNGs that @capacitor/assets needs from the
 * Puzzle Buddy SVG design (proposed in docs/icons/proposals.html, Option 3).
 *
 * Outputs (all PNG, all overwritten on each run):
 *   assets/icon.png              1024×1024  full-bleed icon (iOS marketing)
 *   assets/icon-foreground.png   1024×1024  puzzle+face only, scaled into the
 *                                            Android adaptive-icon safe area
 *                                            (~66% of canvas), transparent
 *                                            background so Android can mask
 *                                            to any device shape
 *   assets/icon-background.png   1024×1024  the gradient backdrop on its own
 *                                            (Android adaptive-icon back layer)
 *   assets/splash.png            2732×2732  same gradient bg, puzzle composition
 *                                            scaled down and centred so it
 *                                            reads as "iPhone icon on a wash"
 *
 * Run with:   node scripts/build/generate-icon-assets.mjs
 * Then:       npm run cap:assets   (generates every device-size variant)
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const OUT = resolve(ROOT, 'assets')
const PUBLIC = resolve(ROOT, 'public')

// ─── Background gradient ──────────────────────────────────────────────
// Top-left royal purple → indigo → sky blue. Matches the Puzzle Buddy
// concept exactly (docs/icons/proposals.html). Used full-bleed on the
// icon backdrop AND on the splash; the puzzle composition sits on top.
const BG_GRADIENT = `
  <defs>
    <linearGradient id="puzzleBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"   stop-color="#9b5de5"/>
      <stop offset="0.5" stop-color="#7a8de8"/>
      <stop offset="1"   stop-color="#5bb6ef"/>
    </linearGradient>
  </defs>
`

const bgRect = (w, h) => `<rect width="${w}" height="${h}" fill="url(#puzzleBg)"/>`

// Faint twinkles ONLY on the splash. They distract at small icon sizes.
const splashTwinkles = `
  <g fill="white" opacity="0.55">
    <circle cx="360"  cy="380"  r="14"/>
    <circle cx="2380" cy="460"  r="12"/>
    <circle cx="420"  cy="2360" r="16"/>
    <circle cx="2360" cy="2280" r="14"/>
    <circle cx="1366" cy="240"  r="10"/>
    <circle cx="240"  cy="1366" r="8"/>
    <circle cx="2500" cy="1366" r="10"/>
    <circle cx="1366" cy="2500" r="8"/>
  </g>
`

// ─── The puzzle composition ──────────────────────────────────────────
// Designed to live inside a 1024×1024 viewport. The 4 pieces span
// 112..912 (800px) so they leave a comfortable ~110px gutter on every
// side at the icon size.
//
// Each piece occupies one 340×340 quadrant. Inner edges (facing the
// centre) carry a knob OR a socket at the MID-edge so the four pieces
// form 4 aligned knob/socket pairs around the centre:
//   • TL right-knob  ↔  TR left-socket   (both centred at y=282)
//   • TL bottom-skt  ↔  BL top-knob      (both centred at x=282)
//   • TR bottom-knob ↔  BR top-socket    (both centred at x=742)
//   • BL right-skt   ↔  BR left-knob     (both centred at y=742)
// The pieces don't physically touch (each quadrant ends ~120px short
// of the centre) — the gap is visual breathing room, and the white
// face circle covers the meeting point.
//
// SVG arc sweep rule used throughout:
//   horizontal L→R + sweep=1 ⇒ arc bulges ABOVE the line
//   horizontal R→L + sweep=0 ⇒ arc bulges ABOVE the line
//   vertical   T→B + sweep=1 ⇒ arc bulges RIGHT of the line
//   vertical   B→T + sweep=0 ⇒ arc bulges RIGHT of the line
// (Inverse of each gives the opposite side.)
const puzzleComposition = `
  <g>
    <!-- TOP-LEFT (orange — Toys pack colour)
         Outer TL corner rounded R=80 (icon's outer corner); the other 3
         corners of the piece softened R=24 so nothing reads as sharp.
         right-edge knob → bulges right; bottom-edge socket → bulges up -->
    <path d="
      M 192 112
      L 428 112
      A 24 24 0 0 1 452 136
      L 452 222
      A 60 60 0 0 1 452 342
      L 452 428
      A 24 24 0 0 1 428 452
      L 342 452
      A 60 60 0 0 0 222 452
      L 136 452
      A 24 24 0 0 1 112 428
      L 112 192
      A 80 80 0 0 1 192 112
      Z"
      fill="#ff9f1c" stroke="#a85f00" stroke-width="16" stroke-linejoin="round"/>

    <!-- TOP-RIGHT (pink — Faces pack colour)
         Outer TR corner R=80; inner corners R=24.
         bottom-edge knob → bulges down; left-edge socket → bulges right -->
    <path d="
      M 596 112
      L 832 112
      A 80 80 0 0 1 912 192
      L 912 428
      A 24 24 0 0 1 888 452
      L 802 452
      A 60 60 0 0 1 682 452
      L 596 452
      A 24 24 0 0 1 572 428
      L 572 342
      A 60 60 0 0 0 572 222
      L 572 136
      A 24 24 0 0 1 596 112
      Z"
      fill="#ff5da2" stroke="#b32a63" stroke-width="16" stroke-linejoin="round"/>

    <!-- BOTTOM-LEFT (green — Fruits pack colour)
         Outer BL corner R=80; inner corners R=24.
         Traversed CCW (down → right → up → left) so corner arcs use
         sweep=0 for convex outward; knob/socket arcs flip accordingly.
         top-edge knob → bulges up; right-edge socket → bulges left -->
    <path d="
      M 112 596
      L 112 832
      A 80 80 0 0 0 192 912
      L 428 912
      A 24 24 0 0 0 452 888
      L 452 802
      A 60 60 0 0 1 452 682
      L 452 596
      A 24 24 0 0 0 428 572
      L 342 572
      A 60 60 0 0 0 222 572
      L 136 572
      A 24 24 0 0 0 112 596
      Z"
      fill="#5fc34a" stroke="#266b22" stroke-width="16" stroke-linejoin="round"/>

    <!-- BOTTOM-RIGHT (indigo — Memory pack colour from the app menu)
         Outer BR corner R=80; inner corners R=24.
         top-edge socket → bulges down; left-edge knob → bulges left -->
    <path d="
      M 596 572
      L 682 572
      A 60 60 0 0 0 802 572
      L 888 572
      A 24 24 0 0 1 912 596
      L 912 832
      A 80 80 0 0 1 832 912
      L 596 912
      A 24 24 0 0 1 572 888
      L 572 802
      A 60 60 0 0 1 572 682
      L 572 596
      A 24 24 0 0 1 596 572
      Z"
      fill="#5e60ce" stroke="#3a3c8c" stroke-width="16" stroke-linejoin="round"/>

    <!-- ─── Curriculum cues, one per piece ──────────────────────────
         Each quadrant carries a single educational symbol in the
         centre of its visible outer mass:
           TL · A     → letters / reading
           TR · 1     → numbers
           BL · ball  → shapes / objects
           BR · +     → math / counting
         Shared visual recipe: bold white fill + the piece's matching
         dark stroke + paint-order=stroke-fill for crisp rounded edges. -->
    <g font-family="Fredoka, &quot;Arial Rounded MT Bold&quot;, sans-serif"
       font-weight="700" text-anchor="middle">

      <!-- TL · A -->
      <text x="282" y="354" font-size="200"
            fill="white" stroke="#a85f00" stroke-width="14"
            paint-order="stroke fill">A</text>

      <!-- TR · 1 -->
      <text x="742" y="354" font-size="200"
            fill="white" stroke="#b32a63" stroke-width="14"
            paint-order="stroke fill">1</text>

      <!-- BL · ball  (white disc + 2 globe arcs + tiny highlight dot;
           reads as a sphere at any size without fragile texture). -->
      <g>
        <circle cx="282" cy="742" r="78"
                fill="white" stroke="#266b22" stroke-width="14"/>
        <path d="M 282 666 Q 228 742 282 818"
              stroke="#266b22" stroke-width="7" fill="none"
              stroke-linecap="round" opacity="0.55"/>
        <path d="M 207 742 Q 282 712 357 742"
              stroke="#266b22" stroke-width="7" fill="none"
              stroke-linecap="round" opacity="0.55"/>
        <circle cx="256" cy="712" r="9" fill="white" opacity="0.95"/>
      </g>

      <!-- BR · +  (single continuous path so the outer stroke runs
           unbroken around the plus silhouette; no overlap artefacts). -->
      <path d="
        M 722 658
        L 762 658
        L 762 722
        L 826 722
        L 826 762
        L 762 762
        L 762 826
        L 722 826
        L 722 762
        L 658 762
        L 658 722
        L 722 722
        Z"
        fill="white" stroke="#3a3c8c" stroke-width="14"
        stroke-linejoin="round"/>
    </g>

    <!-- Sunshine-yellow face circle (covers the 4 quadrants' meeting point).
         Yellow + purple features = the universal smiley face read; way more
         iconic than white-with-purple. Drawn LAST so it reads cleanly on
         top of the symbols. -->
    <circle cx="512" cy="512" r="142" fill="#ffd23f" stroke="#4a2c8a" stroke-width="16"/>
    <!-- eyes -->
    <ellipse cx="468" cy="498" rx="18" ry="24" fill="#4a2c8a"/>
    <ellipse cx="556" cy="498" rx="18" ry="24" fill="#4a2c8a"/>
    <circle cx="463" cy="490" r="6" fill="white"/>
    <circle cx="551" cy="490" r="6" fill="white"/>
    <!-- smile -->
    <path d="M 458 548 Q 512 600 566 548"
          stroke="#4a2c8a" stroke-width="14" fill="none"
          stroke-linecap="round"/>
  </g>
`

// ─── SVG builders ─────────────────────────────────────────────────────

// Full-bleed icon: gradient bg + puzzle composition filling the canvas.
function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    ${BG_GRADIENT}
    ${bgRect(1024, 1024)}
    ${puzzleComposition}
  </svg>`
}

// Android adaptive-icon FOREGROUND. The visible/safe region of an adaptive
// icon is ~66% of the source bitmap (the rest may be cropped by any device
// mask: circle, squircle, teardrop, …). Scaling the 800px-wide composition
// to ~0.62 puts it inside that safe zone with a tiny extra margin so the
// circular mask doesn't kiss the puzzle stroke.
function iconForegroundSvg() {
  const scale = 0.62
  const offset = (1 - scale) * 512 // re-centre after scaling about 0,0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <g transform="translate(${offset} ${offset}) scale(${scale})">
      ${puzzleComposition}
    </g>
  </svg>`
}

// Android adaptive-icon BACKGROUND. Just the gradient — no puzzle.
function iconBackgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    ${BG_GRADIENT}
    ${bgRect(1024, 1024)}
  </svg>`
}

// Splash: 2732×2732 (Capacitor's universal source size). Gradient bg
// fills the whole canvas; the puzzle composition is scaled down and
// centred so it reads as "iPhone-sized icon on a coloured wash" rather
// than a giant puzzle that would feel cramped. Adds gentle twinkles
// for visual life since the splash holds for ~1.5s.
function splashSvg() {
  // Puzzle composition is 1024×1024 native. Scale to 1100 wide and
  // place its centre at the canvas centre (1366,1366).
  const target = 1100
  const scale = target / 1024
  const tx = 1366 - (1024 * scale) / 2
  const ty = 1366 - (1024 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
    ${BG_GRADIENT}
    ${bgRect(2732, 2732)}
    ${splashTwinkles}
    <g transform="translate(${tx} ${ty}) scale(${scale})">
      ${puzzleComposition}
    </g>
  </svg>`
}

// ─── Render ───────────────────────────────────────────────────────────

async function renderSvgToPng(svg, outPath, size) {
  const buf = Buffer.from(svg)
  await sharp(buf, { density: 384 }) // high DPI keeps strokes/curves crisp
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath)
  console.log(`  ✓ ${outPath.replace(ROOT + '/', '')}  (${size}×${size})`)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  await mkdir(PUBLIC, { recursive: true })
  console.log('Generating Puzzle Buddy assets')

  await Promise.all([
    // App store + native (consumed by @capacitor/assets)
    renderSvgToPng(iconSvg(),           resolve(OUT, 'icon.png'),                  1024),
    renderSvgToPng(iconForegroundSvg(), resolve(OUT, 'icon-foreground.png'),       1024),
    renderSvgToPng(iconBackgroundSvg(), resolve(OUT, 'icon-background.png'),       1024),
    renderSvgToPng(splashSvg(),         resolve(OUT, 'splash.png'),                2732),

    // Web / PWA — browser tab + Apple "Add to Home Screen" icon. Served
    // straight out of public/ by Vite. Referenced from index.html.
    renderSvgToPng(iconSvg(),           resolve(PUBLIC, 'favicon.png'),             256),
    renderSvgToPng(iconSvg(),           resolve(PUBLIC, 'apple-touch-icon.png'),    180),
  ])

  console.log('\nDone. Next: `npm run cap:assets` to fan the native variants.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
