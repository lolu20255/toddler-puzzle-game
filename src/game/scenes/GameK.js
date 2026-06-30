import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { preloadLevelAudio, stopAllLevelAudio } from '../../services/libro/levelAudio'
import { settings } from '../../services/settings'

// Seven colours, keyed a-g to line up with the baked `asset_colors_<letter>`
// textures (Boot.generateColorTextures) and the `colors` audio/name pack
// (itemNames.js). Order is rainbow so the palette reads cleanly anywhere the
// full set is shown (prompt swatch, menu icon).
const COLOR_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

// One round per growing difficulty step. Each round shows ONE target colour
// at the top and a row of choice "gumballs" below; the toddler taps the one
// whose colour matches. Choices grow 3 → 6 across the session.
const ROUNDS = 6
const MAX_CHOICES = 6

/**
 * Colours game (GameK) — a colour-recognition mechanic, distinct from the
 * shadow-matching / counting / sorting games already shipped.
 *
 * Educational goal: map a spoken colour word + a colour swatch to the matching
 * object. Three reinforcing channels per round:
 *   1. The big target swatch at the top (visual)
 *   2. The spoken colour name in the parent-selected language (audio)
 *   3. The toddler's own tap on the matching gumball (motor + choice)
 *
 * Correct tap → the gumball pops, the colour word replays, score bumps, and
 * the round advances. Wrong tap → a gentle wobble, no penalty, try again.
 */
export class GameK extends Scene {
  constructor() {
    super('GameK')
    this.round = 0
    this.score = 0
    this.completed = false
    this._lastTarget = null
    this._target = null
    this._answered = false
    this._roundContainer = null
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.drawBackground()
    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    // Warm the colour-word cache so the first prompt speaks instantly.
    const lang = settings.language()
    COLOR_LETTERS.forEach((letter) =>
      preloadLevelAudio(`asset_colors_${letter}`, lang).catch(() => {})
    )

    this._startRound(1)

    EventBus.emit('current-scene-ready', this)
  }

  // ─── Background ─────────────────────────────────────────────────────
  //
  // Soft lavender → blush → cream wash, sprinkled with faint rainbow dots —
  // a neutral-but-playful stage that lets the saturated choice gumballs pop.
  drawBackground() {
    const g = this.add.graphics().setDepth(0)
    const top = 0xe8defb // pale lavender
    const mid = 0xfbe4f1 // blush pink
    const bot = 0xfff4e6 // warm cream
    g.fillGradientStyle(top, top, bot, mid, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    const dotColors = [0xff5d5d, 0xff9f1c, 0xffd23f, 0x5fc34a, 0x3ba4ff, 0x9b5de5, 0xff7fc4]
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight
      const r = this.minSide * (0.006 + Math.random() * 0.01)
      g.fillStyle(dotColors[i % dotColors.length], 0.16)
      g.fillCircle(x, y, r)
    }
  }

  // ─── Round lifecycle ────────────────────────────────────────────────
  _startRound(roundNum) {
    this.round = roundNum
    this._answered = false
    this._roundContainer = this.add.container(0, 0).setDepth(2)

    const target = this._pickTarget()
    this._target = target
    const choiceCount = Math.min(2 + roundNum, MAX_CHOICES)
    const choices = this._buildChoices(target, choiceCount)

    this._buildPrompt(target)
    this._buildChoiceGumballs(choices)
    this._speakColor(target)
  }

  // Random target colour, never the same one twice in a row.
  _pickTarget() {
    let letter
    do {
      letter = COLOR_LETTERS[Math.floor(Math.random() * COLOR_LETTERS.length)]
    } while (letter === this._lastTarget && COLOR_LETTERS.length > 1)
    this._lastTarget = letter
    return letter
  }

  // Target + (n-1) distinct distractors, shuffled.
  _buildChoices(target, count) {
    const others = COLOR_LETTERS.filter((l) => l !== target)
    Phaser.Utils.Array.Shuffle(others)
    const choices = [target, ...others.slice(0, count - 1)]
    return Phaser.Utils.Array.Shuffle(choices)
  }

  // Big target swatch near the top, inside a soft white ring that pulses to
  // draw the eye. This is the "find THIS colour" cue.
  _buildPrompt(target) {
    const cx = this.sWidth / 2
    const cy = this.sHeight * 0.24
    const ringR = this.minSide * 0.16

    const ring = this.add.circle(cx, cy, ringR, 0xffffff, 0.7).setDepth(2)
    ring.setStrokeStyle(Math.max(3, ringR * 0.06), 0xffffff, 0.9)
    this._roundContainer.add(ring)

    const swatch = this.add.image(cx, cy, `asset_colors_${target}`).setDepth(3)
    const scale = (ringR * 1.5) / Math.max(swatch.width, swatch.height || swatch.width)
    swatch.setScale(scale)
    this._roundContainer.add(swatch)

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: [ring],
        scale: 1.08,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
      this.tweens.add({
        targets: swatch,
        y: cy - this.minSide * 0.012,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }
  }

  // A centred grid of choice gumballs in the lower half. Up to 3 per row.
  _buildChoiceGumballs(choices) {
    const cols = Math.min(choices.length, 3)
    const rows = Math.ceil(choices.length / cols)
    const gumballR = this.minSide * Math.min(0.11, 0.42 / cols)
    const gapX = gumballR * 0.9
    const gapY = gumballR * 1.1
    const rowW = cols * gumballR * 2 + (cols - 1) * gapX
    const startX = (this.sWidth - rowW) / 2 + gumballR
    const gridTop = this.sHeight * 0.5

    choices.forEach((letter, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      // Last row may be short — centre it under the full rows.
      const itemsThisRow = row === rows - 1 ? choices.length - row * cols : cols
      const rowOffset = ((cols - itemsThisRow) * (gumballR * 2 + gapX)) / 2
      const x = startX + rowOffset + col * (gumballR * 2 + gapX)
      const y = gridTop + row * (gumballR * 2 + gapY)

      const gumball = this.add.image(x, y, `asset_colors_${letter}`).setDepth(3)
      const scale = (gumballR * 2) / Math.max(gumball.width, gumball.height || gumball.width)
      gumball.setScale(scale)
      gumball.setInteractive({ useHandCursor: true })
      gumball._letter = letter
      gumball._baseScale = scale
      gumball.on('pointerdown', () => this._onChoice(gumball))
      this._roundContainer.add(gumball)

      if (this.reducedMotion) return
      gumball.setScale(0)
      this.tweens.add({
        targets: gumball,
        scale,
        duration: 360,
        delay: 120 + i * 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          gumball._idleTween = this.tweens.add({
            targets: gumball,
            scale: scale * 1.06,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
            delay: i * 120
          })
        }
      })
    })
  }

  _onChoice(gumball) {
    if (this._answered) return

    if (gumball._letter !== this._target) {
      this._wobble(gumball)
      this._playWrongBlip()
      return
    }

    // Correct.
    this._answered = true
    if (gumball._idleTween) gumball._idleTween.stop()

    // Fade the wrong choices back so the chosen one is the clear hero. Stop
    // each one's idle pulse first so it doesn't fight the fade on the scale.
    this._roundContainer.list.forEach((obj) => {
      if (obj !== gumball && obj.texture && obj.input) {
        if (obj._idleTween) obj._idleTween.stop()
        this.tweens.add({ targets: obj, alpha: 0.25, scale: obj._baseScale * 0.85, duration: 260 })
      }
    })

    if (this.reducedMotion) {
      this._burstStars(gumball.x, gumball.y, gumball._letter)
    } else {
      this.tweens.add({
        targets: gumball,
        scale: gumball._baseScale * 1.4,
        duration: 320,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => this._burstStars(gumball.x, gumball.y, gumball._letter)
      })
    }

    this._speakColor(this._target)
    try {
      this.sound.play('ui_match_drop', { volume: 0.55 })
    } catch {
      /* best-effort */
    }

    this.score += 1
    this.scoreBoard.setScore(this.score)

    this.time.delayedCall(900, () => this._advanceRound())
  }

  // Gentle left-right wobble for a wrong tap — never a harsh buzzer.
  _wobble(gumball) {
    if (this.reducedMotion) return
    this.tweens.killTweensOf(gumball)
    const baseX = gumball.x
    this.tweens.add({
      targets: gumball,
      x: baseX - this.minSide * 0.02,
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
      onComplete: () => {
        gumball.x = baseX
        if (!this._answered && !this.reducedMotion) {
          gumball._idleTween = this.tweens.add({
            targets: gumball,
            scale: gumball._baseScale * 1.06,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut'
          })
        }
      }
    })
  }

  _speakColor(letter) {
    stopAllLevelAudio()
    const lang = settings.language()
    preloadLevelAudio(`asset_colors_${letter}`, lang)
      .then((audio) => {
        if (!audio) return
        try {
          audio.currentTime = 0
          audio.play().catch(() => {})
        } catch {
          /* audio is best-effort */
        }
      })
      .catch(() => {})
  }

  _playWrongBlip() {
    try {
      if (this.cache.audio.exists('ui_letter_pop')) {
        this.sound.play('ui_letter_pop', { volume: 0.35, detune: -500 })
      }
    } catch {
      /* best-effort */
    }
  }

  _burstStars(x, y, letter) {
    if (this.reducedMotion) return
    const tints = [0xffffff, 0xffd23f, 0xff7fc4, 0x8be3ff]
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2
      const size = this.minSide * 0.022
      const star = this.add
        .star(x, y, 5, size * 0.45, size, tints[i % tints.length])
        .setDepth(6)
      const dist = this.minSide * 0.16
      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        angle: 200,
        scale: 0,
        alpha: 0,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy()
      })
    }
  }

  _advanceRound() {
    const next = this.round + 1
    const finalize = () => {
      if (this._roundContainer) {
        this._roundContainer.destroy()
        this._roundContainer = null
      }
      if (next > ROUNDS) {
        if (this.completed) return
        this.completed = true
        this.input.enabled = false
        showLevelComplete(this, () => this.scene.start(pickNextSceneExcluding('GameK')))
      } else {
        this._startRound(next)
      }
    }
    if (this.reducedMotion) {
      finalize()
    } else {
      this.tweens.add({
        targets: this._roundContainer,
        alpha: 0,
        duration: 220,
        ease: 'Quad.easeIn',
        onComplete: finalize
      })
    }
  }
}
