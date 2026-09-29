#!/usr/bin/env node
/**
 * Replace the SKULL (frame 2) and DEMON (frame 7) entries in the Heroes
 * spritesheet (public/assets/emojis-pack/B.png) with PIRATE and FAIRY.
 *
 * Pipeline:
 *   1. Strip the background from assets/heroes/fairy-raw.png by flood-filling
 *      from the 4 corners. The figure is bounded by a thick black outline
 *      that naturally stops the fill. Result → assets/heroes/fairy.png.
 *   2. Resize both heroes to the per-frame size (310 × 320, fit-contain so
 *      aspect ratio is preserved and the figure is padded with transparency).
 *   3. Rebuild B.png by stitching:
 *        keep frames 0–1  (WIZARD, VIKING)
 *        new   frame  2   (PIRATE)
 *        keep frames 3–6  (KNIGHT, ORC, ELF, MAGE)
 *        new   frame  7   (FAIRY)
 *        keep frame  8    (ANGEL)
 *
 * Re-runnable: only the input PNGs in assets/heroes/ need to change for the
 * output to update.
 */

import { readFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

const SHEET    = resolve(ROOT, 'public/assets/emojis-pack/B.png')
const PIRATE   = resolve(ROOT, 'assets/heroes/pirate.png')
const FAIRY_IN = resolve(ROOT, 'assets/heroes/fairy-raw.png')
const FAIRY    = resolve(ROOT, 'assets/heroes/fairy.png')

const FRAME_W = 310
const FRAME_H = 320
const FRAMES  = 9
const SHEET_W = 2800
const PIRATE_FRAME = 2  // SKULL → PIRATE
const FAIRY_FRAME  = 7  // DEMON → FAIRY

// ─── Background removal via corner-seeded flood fill ──────────────────
// Works for any figure that doesn't touch the canvas edges and has a
// reasonable colour distance from its background. The thick black
// outline around the LEGO-minifig figures is the perfect stop signal.
async function stripBackground(inputPath, outputPath, tolerance = 90) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  if (channels !== 4) throw new Error(`expected 4 channels, got ${channels}`)

  const pixels = new Uint8ClampedArray(data)
  const total  = width * height
  const visited = new Uint8Array(total)

  // Sample background colour from the 4 corners (averaged).
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
  ]
  let bgR = 0, bgG = 0, bgB = 0
  for (const [x, y] of corners) {
    const p = (y * width + x) * 4
    bgR += pixels[p]; bgG += pixels[p + 1]; bgB += pixels[p + 2]
  }
  bgR /= 4; bgG /= 4; bgB /= 4

  // BFS flood fill from each corner seed. Indexed queue (head pointer)
  // avoids the O(n) shift() cost of a plain array queue.
  const queue = []
  let head = 0
  for (const [x, y] of corners) queue.push(y * width + x)

  let filled = 0
  while (head < queue.length) {
    const idx = queue[head++]
    if (visited[idx]) continue
    visited[idx] = 1

    const p = idx * 4
    const dist = Math.abs(pixels[p]     - bgR)
               + Math.abs(pixels[p + 1] - bgG)
               + Math.abs(pixels[p + 2] - bgB)
    if (dist > tolerance * 3) continue

    pixels[p + 3] = 0  // mark transparent
    filled++

    const x = idx % width
    const y = (idx - x) / width
    if (x > 0          && !visited[idx - 1])     queue.push(idx - 1)
    if (x < width - 1  && !visited[idx + 1])     queue.push(idx + 1)
    if (y > 0          && !visited[idx - width]) queue.push(idx - width)
    if (y < height - 1 && !visited[idx + width]) queue.push(idx + width)
  }

  await sharp(Buffer.from(pixels.buffer), {
    raw: { width, height, channels: 4 }
  }).png().toFile(outputPath)

  console.log(`  ✓ ${outputPath.replace(ROOT + '/', '')}  (cleared ${filled.toLocaleString()} px)`)
}

// ─── Resize a hero source PNG to a single frame, on a transparent canvas ─
// trim() first so the figure fills the frame regardless of how much
// transparent padding the AI generator left around it. Otherwise a
// figure that occupies, say, 60% of its 1024px source ends up ~60% the
// height of its neighbours in the sheet (the fairy problem from v1).
async function frameBuffer(srcPath) {
  return sharp(srcPath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .resize(FRAME_W, FRAME_H, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer()
}

// ─── Slice a horizontal range out of the existing sheet (for kept frames) ─
async function sheetSlice(left, width) {
  return sharp(SHEET)
    .extract({ left, top: 0, width, height: FRAME_H })
    .png()
    .toBuffer()
}

async function main() {
  await mkdir(resolve(ROOT, 'assets/heroes'), { recursive: true })

  console.log('1) Stripping background from fairy-raw.png …')
  await stripBackground(FAIRY_IN, FAIRY)

  console.log('2) Resizing heroes to frame size …')
  const [pirateFrame, fairyFrame] = await Promise.all([
    frameBuffer(PIRATE),
    frameBuffer(FAIRY)
  ])

  console.log('3) Extracting kept frames from existing B.png …')
  // Slice each "kept" run as a single buffer so we composite 3 chunks
  // (frames 0-1, frames 3-6, frame 8) instead of 7 individual ones.
  const keepLeft   = await sheetSlice(0,                       FRAME_W * 2)  // 0-1
  const keepMid    = await sheetSlice(FRAME_W * 3,             FRAME_W * 4)  // 3-6
  const keepRight  = await sheetSlice(FRAME_W * 8,             FRAME_W)      // 8 (last 310px; the extra 10px is padding)

  console.log('4) Compositing new B.png …')
  await sharp({
    create: {
      width: SHEET_W,
      height: FRAME_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: keepLeft,    left: 0,                       top: 0 },
      { input: pirateFrame, left: FRAME_W * PIRATE_FRAME,  top: 0 },
      { input: keepMid,     left: FRAME_W * 3,             top: 0 },
      { input: fairyFrame,  left: FRAME_W * FAIRY_FRAME,   top: 0 },
      { input: keepRight,   left: FRAME_W * 8,             top: 0 }
    ])
    .png()
    .toFile(SHEET)

  console.log(`\n  ✓ ${SHEET.replace(ROOT + '/', '')}  rebuilt`)
  console.log('\nDone. Next: update itemNames.js + npm run generate:audio.')
}

main().catch((e) => { console.error(e); process.exit(1) })
