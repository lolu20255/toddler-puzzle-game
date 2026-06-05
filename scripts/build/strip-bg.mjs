#!/usr/bin/env node
/**
 * Strip the background from a PNG by corner-seeded flood fill.
 *
 * Works on any image where:
 *   • the subject doesn't touch the canvas edges
 *   • the background is reasonably uniform (a flat colour, soft gradient,
 *     or vignette — gradients fill fine as long as adjacent pixels are
 *     close in colour, which they always are in AI-generated output)
 *   • the subject has a clear outline OR enough colour contrast vs the bg
 *
 * Used by `swap-hero-characters.mjs`; also runnable directly as a CLI:
 *
 *   node scripts/build/strip-bg.mjs <input.png> [output.png] [--tolerance=90]
 *
 * If output is omitted, writes to <input>-clean.png next to the source.
 * Tolerance is a per-channel sum (0-765); higher = more aggressive removal.
 * 90 works for the AI-generated grey/white/coloured backgrounds we've
 * tested; bump to 130 if the background is unusually close in colour
 * to the subject; drop to 60 if the bg removal eats into the figure.
 */

import { resolve, dirname, basename, extname, join } from 'node:path'
import sharp from 'sharp'

export async function stripBackground(inputPath, outputPath, tolerance = 90) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const pixels = new Uint8ClampedArray(data)
  const total = width * height
  const visited = new Uint8Array(total)

  // Sample bg from the 4 corners (averaged).
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
  ]
  let bgR = 0, bgG = 0, bgB = 0
  let cornerAlpha = 0
  for (const [x, y] of corners) {
    const p = (y * width + x) * 4
    bgR += pixels[p]; bgG += pixels[p + 1]; bgB += pixels[p + 2]
    cornerAlpha += pixels[p + 3]
  }
  bgR /= 4; bgG /= 4; bgB /= 4

  // Short-circuit: if all 4 corners are already transparent the image
  // is already clean — nothing to do.
  if (cornerAlpha === 0) {
    if (inputPath !== outputPath) {
      await sharp(inputPath).toFile(outputPath)
    }
    return { filled: 0, alreadyClean: true }
  }

  // BFS flood fill from each corner. Indexed queue (head pointer) avoids
  // the O(n) cost of plain-array shift() on million-pixel images.
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

    pixels[p + 3] = 0
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

  return { filled, alreadyClean: false }
}

// ─── CLI ─────────────────────────────────────────────────────────────
const isCli = import.meta.url === `file://${process.argv[1]}`
if (isCli) {
  const args = process.argv.slice(2)
  const toleranceArg = args.find(a => a.startsWith('--tolerance='))
  const tolerance = toleranceArg ? parseInt(toleranceArg.split('=')[1], 10) : 90
  const positional = args.filter(a => !a.startsWith('--'))

  if (positional.length < 1) {
    console.error('Usage: node scripts/build/strip-bg.mjs <input.png> [output.png] [--tolerance=90]')
    process.exit(1)
  }

  const input = resolve(positional[0])
  const output = positional[1]
    ? resolve(positional[1])
    : join(dirname(input), `${basename(input, extname(input))}-clean.png`)

  const { filled, alreadyClean } = await stripBackground(input, output, tolerance)
  if (alreadyClean) {
    console.log(`  ✓ ${output}  (already transparent, copied as-is)`)
  } else {
    console.log(`  ✓ ${output}  (cleared ${filled.toLocaleString()} px @ tolerance ${tolerance})`)
  }
}
