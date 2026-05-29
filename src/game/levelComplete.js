import { settings } from '../services/settings'

const SCENES = ['GameA', 'GameB', 'GameC', 'GameD', 'GameE']

/**
 * Pick the next pack to play, excluding the one the toddler just finished.
 * Prevents the immediate-repeat that the previous `Math.random() * 5`
 * version could produce. With 5 packs, there are always 4 valid choices.
 */
export function pickNextSceneExcluding(currentKey) {
  const choices = SCENES.filter((k) => k !== currentKey)
  return choices[Math.floor(Math.random() * choices.length)]
}

/**
 * Big end-of-level celebration.
 *
 * Shows when all pieces of a pack are matched. Three layers:
 *   1. A synthesised fanfare (ascending C-major arpeggio → high tonic) +
 *      the existing `ui_celebrate` sample at full volume on top. Synthesis
 *      keeps the asset bundle the same size and gives us a longer, fuller
 *      "level-complete" stinger than any single per-match SFX would.
 *   2. A big bouncy "GREAT JOB <NAME>!" banner that slams in from above and
 *      pulses, with rainbow confetti bursting from three points across the
 *      screen and tumbling down with rotation.
 *   3. A 3-second hold, then the optional `onComplete` callback fires (the
 *      scene transition).
 *
 * Calls `onComplete` after the hold even if any of the visuals or audio fail
 * — the next scene must always come, no matter what.
 */
export function showLevelComplete(scene, onComplete) {
  const sW = scene.sWidth
  const sH = scene.sHeight
  const minSide = Math.min(sW, sH)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Drop the per-pack input so the toddler can't accidentally interact mid-
  // celebration (would queue up taps for the next scene).
  scene.input.enabled = false

  const container = scene.add.container(sW / 2, sH / 2).setDepth(200)

  // Dim backdrop — softer than the per-match modal (this is a moment of joy,
  // not a "look here" overlay).
  const dim = scene.add
    .rectangle(0, 0, sW * 1.2, sH * 1.2, 0x000000, 0.35)
    .setOrigin(0.5)
  container.add(dim)

  // Banner text.
  const name = settings.toddlerName()
  const lang = settings.language()
  const headline = lang === 'es' ? '¡GENIAL!' : 'GREAT JOB!'
  const subline = name ? (lang === 'es' ? `¡${name}!` : `${name}!`) : ''

  const headlineSize = minSide * 0.16
  const headlineText = scene.add
    .text(0, -minSide * 0.05, headline, {
      fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
      fontSize: `${headlineSize}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  headlineText.setStroke('#e8881c', headlineSize * 0.12)
  headlineText.setShadow(0, headlineSize * 0.05, 'rgba(0,0,0,0.35)', 6)
  container.add(headlineText)

  if (subline) {
    const subSize = minSide * 0.12
    const subText = scene.add
      .text(0, minSide * 0.08, subline, {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${subSize}px`,
        color: '#ffce3a',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
    subText.setStroke('#5a3a1a', subSize * 0.13)
    subText.setShadow(0, subSize * 0.05, 'rgba(0,0,0,0.35)', 5)
    container.add(subText)

    if (!reducedMotion) {
      scene.tweens.add({
        targets: subText,
        scale: { from: 0, to: 1 },
        duration: 460,
        delay: 200,
        ease: 'Back.out'
      })
    }
  }

  if (!reducedMotion) {
    // Headline slams in from above with a bounce.
    headlineText.setScale(0)
    headlineText.y -= minSide * 0.3
    scene.tweens.add({
      targets: headlineText,
      scale: 1,
      y: -minSide * 0.05,
      duration: 500,
      ease: 'Back.out'
    })
    // Gentle ongoing pulse so the banner feels alive while it holds.
    scene.tweens.add({
      targets: headlineText,
      scale: 1.08,
      duration: 600,
      delay: 600,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.inOut'
    })
  }

  // ─── Confetti ────────────────────────────────────────────────────────────
  if (!reducedMotion) {
    _burstConfetti(scene, sW * 0.2, sH * 0.25, minSide)
    _burstConfetti(scene, sW * 0.5, sH * 0.2, minSide)
    _burstConfetti(scene, sW * 0.8, sH * 0.25, minSide)
  }

  // ─── Sound ──────────────────────────────────────────────────────────────
  _playFanfare(scene)
  try {
    if (scene.cache.audio.exists('ui_celebrate')) {
      scene.sound.play('ui_celebrate', { volume: 0.9 })
      scene.time.delayedCall(220, () => {
        if (scene.cache.audio.exists('ui_celebrate')) {
          scene.sound.play('ui_celebrate', { volume: 0.75, detune: 400 })
        }
      })
    }
  } catch {
    /* sound is best-effort */
  }

  // ─── Hold then hand control back ────────────────────────────────────────
  scene.time.delayedCall(3000, () => {
    if (!container.scene) return
    scene.tweens.add({
      targets: container,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => {
        container.destroy()
        if (typeof onComplete === 'function') onComplete()
      }
    })
  })
}

/**
 * Synthesised ascending C-major arpeggio (C5 → E5 → G5 → C6) using the
 * Web Audio context that Phaser already owns. Triangle waves give a chunky
 * "horn" tone that reads as celebratory without being too sharp for toddlers.
 * Plays immediately, no asset, no preload.
 */
function _playFanfare(scene) {
  try {
    const ctx = scene.sound?.context
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    const stepMs = 110
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      osc.connect(gain).connect(ctx.destination)
      const t0 = ctx.currentTime + (i * stepMs) / 1000
      const dur = i === notes.length - 1 ? 0.45 : 0.16 // final tonic rings out
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.28, t0 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)
    })
  } catch {
    /* synthesis is best-effort */
  }
}

/** Burst of ~14 confetti rectangles + stars from (x,y), falling with rotation. */
function _burstConfetti(scene, x, y, minSide) {
  const colors = [0xff5d5d, 0xff9f1c, 0xffd23f, 0x5fc34a, 0x3ba4ff, 0x9b5de5, 0xff5da2, 0x29c7b8]
  for (let i = 0; i < 14; i++) {
    const isStar = i % 3 === 0
    const size = minSide * (isStar ? 0.025 : 0.022)
    const color = colors[i % colors.length]
    const piece = isStar
      ? scene.add.star(x, y, 5, size * 0.45, size, color).setDepth(199)
      : scene.add
          .rectangle(x, y, size * 0.6, size * 1.4, color)
          .setDepth(199)
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = minSide * (0.35 + Math.random() * 0.55)
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed
    const fallDist = minSide * (1.2 + Math.random() * 0.8)
    const duration = 1400 + Math.random() * 700
    scene.tweens.add({
      targets: piece,
      x: x + vx,
      y: y + vy + fallDist,
      angle: 360 + Math.random() * 540,
      alpha: { from: 1, to: 0 },
      duration,
      ease: 'Cubic.easeIn',
      onComplete: () => piece.destroy()
    })
  }
}
