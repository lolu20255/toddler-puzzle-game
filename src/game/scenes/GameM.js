import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { preloadLevelAudio, stopAllLevelAudio } from '../../services/libro/levelAudio'
import { settings } from '../../services/settings'

// Five rounds of growing length. Each round floats `count` bubbles and asks the
// toddler to pop them IN ORDER (A→B→C… or 1→2→3…). The current target glyph is
// shown + spoken at the top; the matching bubble pulses as a gentle hint.
const ROUND_COUNTS = [3, 4, 5, 6, 7]
const ROUNDS = ROUND_COUNTS.length

// Scatter positions per bubble count, normalised to screen space. Y stays in
// 0.34–0.80 so bubbles never collide with the top target card or the HUD.
const POSITIONS = {
  3: [[0.3, 0.44], [0.7, 0.44], [0.5, 0.68]],
  4: [[0.3, 0.42], [0.7, 0.42], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.5, 0.38], [0.28, 0.56], [0.72, 0.56], [0.36, 0.76], [0.64, 0.76]],
  6: [[0.26, 0.44], [0.5, 0.44], [0.74, 0.44], [0.26, 0.68], [0.5, 0.68], [0.74, 0.68]],
  7: [[0.26, 0.42], [0.5, 0.42], [0.74, 0.42], [0.26, 0.62], [0.5, 0.62], [0.74, 0.62], [0.5, 0.8]]
}

/**
 * Bubble Pop game (GameM) — pop letters or numbers in sequence.
 *
 * Educational goal: alphabet / number ordering + glyph recognition + a satisfying
 * motor "pop". The target glyph is announced at the top (shown + spoken); the
 * toddler finds and pops the matching floating bubble. Pop in order → the round
 * advances target by target until the whole run (e.g. A–E) is cleared.
 *
 * Reuses the procedural glyph packs (asset_letters_<x> / asset_numbers_<x>) and
 * the bundled `letters` + `count` audio — no new art or audio.
 */
export class GameM extends Scene {
  constructor() {
    super('GameM')
    this.round = 0
    this.score = 0
    this.completed = false
    this._mode = 'numbers'
    this._seq = []
    this._nextIndex = 0
    this._bubbles = {}
    this._roundContainer = null
    this._targetGlyph = null
    this._modeStart = 0
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.drawBackground()
    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    // Randomise which mode round 1 uses, then alternate, so a toddler sees
    // both letters and numbers in one session regardless of where it starts.
    this._modeStart = Math.random() < 0.5 ? 0 : 1

    this._startRound(1)
    EventBus.emit('current-scene-ready', this)
  }

  // Under-the-sea wash + slow rising background bubbles.
  drawBackground() {
    const g = this.add.graphics().setDepth(0)
    const top = 0x57c7e8 // bright cyan
    const mid = 0x2f8fc4 // sea blue
    const bot = 0x1f6aa8 // deeper blue
    g.fillGradientStyle(top, top, bot, mid, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    for (let i = 0; i < 16; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight
      const r = this.minSide * (0.01 + Math.random() * 0.025)
      const bubble = this.add.circle(x, y, r, 0xffffff, 0.12).setDepth(0)
      bubble.setStrokeStyle(Math.max(1, r * 0.12), 0xffffff, 0.18)
      if (this.reducedMotion) continue
      this.tweens.add({
        targets: bubble,
        y: y - this.sHeight * (0.3 + Math.random() * 0.3),
        duration: 6000 + Math.random() * 4000,
        repeat: -1,
        delay: Math.random() * 4000,
        ease: 'Sine.inOut',
        onRepeat: () => {
          bubble.y = this.sHeight + r
          bubble.x = Math.random() * this.sWidth
        }
      })
    }
  }

  _startRound(roundNum) {
    this.round = roundNum
    this._nextIndex = 0
    this._bubbles = {}
    this._roundContainer = this.add.container(0, 0).setDepth(2)

    const count = ROUND_COUNTS[roundNum - 1]
    this._mode = (this._modeStart + roundNum) % 2 === 0 ? 'numbers' : 'letters'
    this._seq = Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i))

    // Warm the audio cache for this round's run.
    const lang = settings.language()
    this._seq.forEach((letter) =>
      preloadLevelAudio(this._audioKey(letter), lang).catch(() => {})
    )

    this._buildTargetCard()
    this._buildBubbles(count)
    this._setTarget(0)
  }

  _glyphKey(letter) {
    return this._mode === 'numbers' ? `asset_numbers_${letter}` : `asset_letters_${letter}`
  }

  // Numbers speak the bare count word ("One!"); letters speak the letter ("A!").
  _audioKey(letter) {
    return this._mode === 'numbers' ? `asset_count_${letter}` : `asset_letters_${letter}`
  }

  // A white "goal" disc near the top holding the glyph the toddler must pop next.
  _buildTargetCard() {
    const cx = this.sWidth / 2
    const cy = this.sHeight * 0.18
    const r = this.minSide * 0.12

    const shadow = this.add.circle(cx, cy + r * 0.12, r, 0x000000, 0.18).setDepth(2)
    const disc = this.add.circle(cx, cy, r, 0xffffff, 0.96).setDepth(3)
    disc.setStrokeStyle(Math.max(3, r * 0.08), 0x1f6aa8, 0.5)
    this._roundContainer.add([shadow, disc])

    this._targetGlyph = this.add.image(cx, cy, 'asset_numbers_a').setDepth(4)
    this._roundContainer.add(this._targetGlyph)
    this._targetDisc = disc
  }

  _buildBubbles(count) {
    const layout = POSITIONS[count]
    const order = Phaser.Utils.Array.Shuffle(this._seq.map((_, i) => i))
    const bubbleR = this.minSide * (count <= 4 ? 0.13 : count <= 6 ? 0.11 : 0.1)

    this._seq.forEach((letter, i) => {
      const pos = layout[order[i]]
      const x = this.sWidth * pos[0]
      const y = this.sHeight * pos[1]
      const bubble = this.add.container(x, y).setDepth(3)
      bubble.baseY = y

      const skin = this.add.circle(0, 0, bubbleR, 0xffffff, 0.22)
      skin.setStrokeStyle(Math.max(2, bubbleR * 0.06), 0xffffff, 0.55)
      const gloss = this.add.circle(-bubbleR * 0.32, -bubbleR * 0.34, bubbleR * 0.22, 0xffffff, 0.5)

      const glyph = this.add.image(0, 0, this._glyphKey(letter))
      glyph.setScale((bubbleR * 1.45) / Math.max(glyph.width, glyph.height || glyph.width))
      // The glyph image is the interactive target — its frame rectangle is a
      // generous, reliable tap zone (the decorative circles sit non-interactive
      // behind/over it and never steal the touch).
      glyph.setInteractive({ useHandCursor: true })
      glyph.on('pointerdown', () => this._onPop(letter))

      bubble.add([skin, gloss, glyph])
      bubble._letter = letter
      bubble._radius = bubbleR
      this._bubbles[letter] = bubble
      this._roundContainer.add(bubble)

      if (this.reducedMotion) return
      // Gentle bob so the bubbles feel buoyant without being hard to tap.
      this.tweens.add({
        targets: bubble,
        y: y - this.minSide * 0.02,
        duration: 1600 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
        delay: i * 150
      })
    })
  }

  // Point the goal card at sequence[index], speak it, and pulse the matching
  // bubble as a hint for this age group.
  _setTarget(index) {
    this._nextIndex = index
    const letter = this._seq[index]
    this._targetGlyph.setTexture(this._glyphKey(letter))
    const r = this.minSide * 0.12
    this._targetGlyph.setScale((r * 1.4) / Math.max(this._targetGlyph.width, this._targetGlyph.height || this._targetGlyph.width))

    Object.values(this._bubbles).forEach((b) => {
      if (b._hintTween) {
        b._hintTween.stop()
        b._hintTween = null
        b.setScale(1)
      }
    })
    const next = this._bubbles[letter]
    if (next && !this.reducedMotion) {
      next._hintTween = this.tweens.add({
        targets: next,
        scale: 1.12,
        duration: 560,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }

    this._speak(letter)
  }

  _onPop(letter) {
    if (this.completed) return
    const target = this._seq[this._nextIndex]
    if (letter !== target) {
      this._wobble(this._bubbles[letter])
      this._playWrongBlip()
      return
    }

    const bubble = this._bubbles[letter]
    if (!bubble || bubble._popped) return
    bubble._popped = true
    delete this._bubbles[letter]
    this.tweens.killTweensOf(bubble)

    this._popBubble(bubble)
    this._speak(letter)
    try {
      // Rising pitch across the run gives the sequence a musical staircase.
      const stride = (this._nextIndex + 1) / this._seq.length
      this.sound.play('ui_letter_pop', { volume: 0.5, detune: -100 + stride * 500 })
    } catch {
      /* best-effort */
    }

    this.score += 1
    this.scoreBoard.setScore(this.score)

    const next = this._nextIndex + 1
    if (next >= this._seq.length) {
      this.time.delayedCall(700, () => this._advanceRound())
    } else {
      this._setTarget(next)
    }
  }

  _popBubble(bubble) {
    if (this.reducedMotion) {
      this._burstStars(bubble.x, bubble.y)
      bubble.destroy()
      return
    }
    this._burstStars(bubble.x, bubble.y)
    this.tweens.add({
      targets: bubble,
      scale: 1.3,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => bubble.destroy()
    })
  }

  _wobble(bubble) {
    if (!bubble || this.reducedMotion) return
    const baseX = bubble.x
    this.tweens.add({
      targets: bubble,
      x: baseX - this.minSide * 0.018,
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
      onComplete: () => {
        bubble.x = baseX
      }
    })
  }

  _speak(letter) {
    stopAllLevelAudio()
    const lang = settings.language()
    preloadLevelAudio(this._audioKey(letter), lang)
      .then((audio) => {
        if (!audio) return
        try {
          audio.currentTime = 0
          audio.play().catch(() => {})
        } catch {
          /* best-effort */
        }
      })
      .catch(() => {})
  }

  _playWrongBlip() {
    try {
      if (this.cache.audio.exists('ui_letter_pop')) {
        this.sound.play('ui_letter_pop', { volume: 0.3, detune: -600 })
      }
    } catch {
      /* best-effort */
    }
  }

  _burstStars(x, y) {
    if (this.reducedMotion) return
    const tints = [0xffffff, 0xbdf0ff, 0xffe9a8]
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const size = this.minSide * 0.018
      const drop = this.add.circle(x, y, size, tints[i % tints.length]).setDepth(6)
      const dist = this.minSide * 0.13
      this.tweens.add({
        targets: drop,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        scale: 0,
        alpha: 0,
        duration: 480,
        ease: 'Quad.easeOut',
        onComplete: () => drop.destroy()
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
        showLevelComplete(this, () => this.scene.start(pickNextSceneExcluding('GameM')))
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
