/**
 * Shared HUD primitives for the puzzle scenes (GameA/B/C/D) and any other
 * scene that needs a back button or a score badge.
 *
 * The visual language matches the MainMenu cog and the Settings back button
 * (white circle + orange border + soft drop shadow) so every navigation
 * surface across the app feels like a sibling.
 *
 * All positioning comes from the shared layout grid (`src/game/layout.js`)
 * — back-button LEFT edge sits at `grid.contentLeft`, score-pill RIGHT edge
 * sits at `grid.contentRight`, both anchored to `grid.navY`. Cards and
 * other pinned controls in other scenes use the same gridlines, so
 * everything stacks to clean vertical alignment.
 *
 * Interactive elements use a separate transparent `Phaser.Rectangle` as
 * the hit zone — Container input has been flaky in this Phaser/iOS
 * WebView combination; Rectangle input is rock-solid.
 */
import { getGrid } from './layout'
import { stopAllSpeech } from '../services/libro'

/**
 * Modern white-circle chevron back button, top-left.
 * On press, fades out and starts the MainMenu scene.
 *
 * @param {Phaser.Scene} scene  scene with `sWidth`/`sHeight` already computed
 * @returns {{ halo, arrow, hit }} the visible parts + the hit Rectangle
 */
export function addBackButton(scene) {
  const grid = getGrid(scene)
  const r = grid.iconR
  const cx = grid.contentLeft + r // left edge of button sits AT contentLeft
  const cy = grid.navY
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Drop shadow
  scene.add.circle(cx, cy + r * 0.14, r, 0x000000, 0.18).setDepth(14)

  // White halo
  const halo = scene.add.circle(cx, cy, r, 0xffffff, 0.95).setDepth(15)
  halo.setStrokeStyle(Math.max(2, r * 0.09), 0xe8881c, 0.8)

  // Left-facing chevron
  const arrow = scene.add.graphics().setDepth(16)
  arrow.lineStyle(Math.max(3, r * 0.16), 0x5a3a1a, 1)
  arrow.beginPath()
  arrow.moveTo(cx + r * 0.18, cy - r * 0.34)
  arrow.lineTo(cx - r * 0.22, cy)
  arrow.lineTo(cx + r * 0.18, cy + r * 0.34)
  arrow.strokePath()

  // Generous Rectangle hit zone
  const hitR = r * 1.55
  const hit = scene.add
    .rectangle(cx, cy, hitR * 2, hitR * 2, 0x000000, 0)
    .setDepth(17)
    .setInteractive({ useHandCursor: true })

  hit.on('pointerover', () => {
    scene.tweens.add({ targets: [halo, arrow], scale: 1.06, duration: 140 })
  })
  hit.on('pointerout', () => {
    scene.tweens.add({ targets: [halo, arrow], scale: 1, duration: 140 })
  })
  hit.on('pointerdown', () => {
    // Silence any TTS celebration audio immediately, before the 240ms
    // fade-out — otherwise "Good job Logan!" would trail into MainMenu.
    stopAllSpeech()
    scene.tweens.add({
      targets: [halo, arrow],
      scale: { from: 0.92, to: 1 },
      duration: 160,
      ease: 'Back.out'
    })
    scene.cameras.main.fadeOut(reducedMotion ? 0 : 240, 91, 182, 239)
    scene.cameras.main.once('camerafadeoutcomplete', () =>
      scene.scene.start('MainMenu')
    )
  })

  return { halo, arrow, hit }
}

/**
 * Yellow rounded score pill, top-right (mirrors the back button position).
 *
 * Returns the Phaser Text object with a `setScore(n)` method patched on —
 * call it to update the displayed score AND get a Back-out scale pop for
 * free. The text-only `.text = ...` write also still works (no pop).
 *
 * Sized for single-digit scores (toddler puzzles cap at 9 matches per game).
 *
 * @param {Phaser.Scene} scene
 * @param {number} initialScore
 */
export function addScoreBadge(scene, initialScore = 0) {
  const grid = getGrid(scene)
  const cy = grid.navY
  const fontSize = grid.minSide * 0.04

  const text = scene.add
    .text(0, 0, `SCORE: ${initialScore}`, {
      fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
      fontSize: `${fontSize}px`,
      color: '#5a3a1a',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
    .setDepth(11)

  const padX = fontSize * 0.9
  const padY = fontSize * 0.4
  const pillW = text.displayWidth + padX * 2
  const pillH = text.displayHeight + padY * 2
  const radius = pillH / 2
  // Pill RIGHT edge sits at contentRight (mirror of the back button's left).
  const cx = grid.contentRight - pillW / 2

  text.setPosition(cx, cy)

  // Pill background — same yellow + orange border + glossy highlight family
  // as the Settings LEARNING selected pill, so the visual language is unified.
  const g = scene.add.graphics().setDepth(10)
  g.fillStyle(0x000000, 0.18)
  g.fillRoundedRect(cx - pillW / 2, cy - pillH / 2 + pillH * 0.12, pillW, pillH, radius)
  g.fillStyle(0xffce3a, 1)
  g.fillRoundedRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, radius)
  g.fillStyle(0xffffff, 0.3)
  g.fillRoundedRect(
    cx - pillW / 2 + pillW * 0.06,
    cy - pillH / 2 + pillH * 0.12,
    pillW * 0.88,
    pillH * 0.32,
    radius * 0.6
  )
  g.lineStyle(Math.max(2, pillH * 0.04), 0xe8881c, 0.7)
  g.strokeRoundedRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, radius)

  text.setScore = (value) => {
    text.text = `SCORE: ${value}`
    scene.tweens.add({
      targets: text,
      scale: { from: 1.2, to: 1 },
      duration: 260,
      ease: 'Back.out'
    })
  }

  return text
}
