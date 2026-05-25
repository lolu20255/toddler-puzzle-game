import { nameForAssetKey } from './itemNames'
import { speak } from '../services/libro/pronunciation'

/**
 * Pop a celebratory modal when a toddler matches a piece.
 *
 * Shows a yellow rounded card centred on screen with the matched piece's
 * picture in a white window, and types its name out **one letter at a time**
 * (C → CA → CAR) so the toddler associates the picture with the word. Each
 * letter "pops" with a sparkle and a soft tick sound.
 *
 * Auto-dismisses after the typing finishes plus a short linger. Only one
 * celebration shows at a time — a new match replaces an older one.
 *
 * Does NOT block input — gameplay continues underneath the dimmed backdrop.
 */
export function showCelebration(scene, assetKey) {
  const name = nameForAssetKey(assetKey)
  if (!name) return null

  // Replace any in-flight celebration so two matches in a row don't pile up.
  if (scene._celebrationModal) {
    scene._celebrationModal.destroy()
    scene._celebrationModal = null
  }

  const sW = scene.sWidth
  const sH = scene.sHeight
  const minSide = Math.min(sW, sH)

  const modal = scene.add.container(sW / 2, sH / 2).setDepth(100)
  scene._celebrationModal = modal

  // Dimmed backdrop — not interactive so the game keeps responding to drags.
  const dim = scene.add
    .rectangle(0, 0, sW * 1.2, sH * 1.2, 0x000000, 0.45)
    .setOrigin(0.5)
  modal.add(dim)

  // Card body — sunny yellow, with a 3-D lip and soft drop shadow.
  const cardW = Math.min(sW * 0.85, minSide * 1.05)
  const cardH = cardW * 0.85
  const radius = cardH * 0.13

  const g = scene.add.graphics()
  g.fillStyle(0x000000, 0.3)
  g.fillRoundedRect(-cardW / 2, -cardH / 2 + cardH * 0.06, cardW, cardH, radius)
  g.fillStyle(0xe8881c, 1)
  g.fillRoundedRect(-cardW / 2, -cardH / 2 + cardH * 0.04, cardW, cardH, radius)
  g.fillStyle(0xffce3a, 1)
  g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, radius)
  g.fillStyle(0xffffff, 0.3)
  g.fillRoundedRect(
    -cardW / 2 + cardW * 0.06,
    -cardH / 2 + cardH * 0.06,
    cardW * 0.88,
    cardH * 0.27,
    radius * 0.7
  )
  modal.add(g)

  // White window with the matched piece's picture.
  const winR = cardH * 0.21
  const iconY = -cardH * 0.18
  const win = scene.add
    .circle(0, iconY, winR, 0xffffff)
    .setStrokeStyle(Math.max(3, winR * 0.07), 0xe8881c, 0.5)
  modal.add(win)

  const icon = scene.add.image(0, iconY, assetKey)
  const iconScale = (winR * 1.5) / Math.max(icon.width, icon.height || icon.width)
  icon.setScale(iconScale)
  modal.add(icon)

  // The word — empty to start, filled one letter at a time.
  const letterSize = Math.min(
    cardH * 0.27,
    (cardW * 0.82) / Math.max(name.length * 0.55, 2.2)
  )
  const word = scene.add
    .text(0, cardH * 0.2, '', {
      fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
      fontSize: `${letterSize}px`,
      color: '#5a3a1a',
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
  word.setStroke('#ffffff', letterSize * 0.16)
  modal.add(word)

  // Entrance bounce.
  modal.setScale(0)
  scene.tweens.add({
    targets: modal,
    scale: 1,
    duration: 350,
    ease: 'Back.out'
  })

  // Speak the word out loud (best-effort — silent failure if offline or the
  // libro-ai API rejects). Audio plays alongside the letter-by-letter reveal.
  speak(`${name} -- Good Job Logan!`).catch(() => {})

  // Type letter by letter with a pop + sparkle + tick.
  const perLetter = 280
  for (let i = 0; i < name.length; i++) {
    scene.time.delayedCall(360 + i * perLetter, () => {
      if (!word.scene) return
      word.setText(name.substring(0, i + 1))
      scene.tweens.add({
        targets: word,
        scale: { from: 1.22, to: 1 },
        duration: 200,
        ease: 'Back.out'
      })
      _sparkle(scene, modal, 0, cardH * 0.2, minSide)
      try {
        if (scene.cache.audio.exists('sfx_collect')) {
          scene.sound.play('sfx_collect', { volume: 0.35 })
        }
      } catch {
        /* audio is best-effort */
      }
    })
  }

  // Auto-dismiss after the last letter has had time to land.
  const lingerMs = 360 + name.length * perLetter + 1200
  scene.time.delayedCall(lingerMs, () => {
    if (!modal.scene) return
    scene.tweens.add({
      targets: modal,
      scale: 0,
      alpha: 0,
      duration: 280,
      ease: 'Back.in',
      onComplete: () => {
        modal.destroy()
        if (scene._celebrationModal === modal) scene._celebrationModal = null
      }
    })
  })

  return modal
}

function _sparkle(scene, parent, x, y, minSide) {
  const colors = [0xffd23f, 0xffffff, 0xff8fc7, 0x8be3ff]
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3
    const size = minSide * 0.018
    const star = scene.add.star(
      x,
      y,
      5,
      size * 0.45,
      size,
      colors[i % colors.length]
    )
    parent.add(star)
    const dist = minSide * 0.08
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      angle: 200,
      scale: 0,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => star.destroy()
    })
  }
}
