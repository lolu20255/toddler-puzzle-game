import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { preloadLevelAudio, stopAllLevelAudio } from '../../services/libro/levelAudio'
import { settings } from '../../services/settings'

// Visually distinct shape textures (baked in Boot as asset_shapes_<a-i>) used
// to build the patterns: circle, square, triangle, star, heart. Picked for
// strong silhouette + colour contrast so a toddler can tell them apart at a
// glance. Letters index into the `shapes` pack for the spoken name.
const SHAPE_LETTERS = ['a', 'b', 'c', 'e', 'f']

// Each round shows a repeating pattern with the LAST cell hidden behind a "?"
// slot; the toddler taps the choice that comes next. Difficulty grows from a
// 2-symbol AB pattern up to a 3-symbol ABC pattern.
const ROUND_UNITS = [
  [0, 1], // AB
  [0, 1], // AB
  [0, 0, 1], // AAB
  [0, 1, 1], // ABB
  [0, 1, 2], // ABC
  [0, 1, 2] // ABC
]
const ROUNDS = ROUND_UNITS.length

/**
 * Patterns game (GameL) — a sequencing / "what comes next?" mechanic, the
 * first early-logic game in the app.
 *
 * Each round lays out a repeating shape pattern (e.g. ●▲●▲?) with the final
 * cell shown as a "?" slot. The toddler taps the choice tile that continues
 * the pattern. Correct → the answer pops into the slot, its name is spoken,
 * score bumps, and the next (harder) round begins.
 */
export class GameL extends Scene {
  constructor() {
    super('GameL')
    this.round = 0
    this.score = 0
    this.completed = false
    this._answer = null
    this._answered = false
    this._slot = null
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

    this._startRound(1)

    EventBus.emit('current-scene-ready', this)
  }

  // Calm aqua → periwinkle wash with faint dots — a focused "thinky" stage.
  drawBackground() {
    const g = this.add.graphics().setDepth(0)
    const top = 0xbfe9f2 // pale aqua
    const mid = 0xcfe0fb // soft periwinkle
    const bot = 0xeaf6ff // near-white
    g.fillGradientStyle(top, top, bot, mid, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    for (let i = 0; i < 18; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight
      const r = this.minSide * (0.005 + Math.random() * 0.008)
      g.fillStyle(0xffffff, 0.35)
      g.fillCircle(x, y, r)
    }
  }

  _startRound(roundNum) {
    this.round = roundNum
    this._answered = false
    this._roundContainer = this.add.container(0, 0).setDepth(2)

    const unit = ROUND_UNITS[roundNum - 1]
    const symbolCount = Math.max(...unit) + 1
    const symbols = this._pickSymbols(symbolCount)

    // Two full repeats of the unit, then a trailing "?" cell.
    const cellCount = unit.length * 2 + 1
    const sequence = []
    for (let i = 0; i < cellCount; i++) sequence.push(symbols[unit[i % unit.length]])
    const answerLetter = sequence[cellCount - 1]
    this._answer = answerLetter

    this._buildSequenceRow(sequence)
    this._buildChoices(symbols, answerLetter)
  }

  // Pick `n` distinct shape letters at random.
  _pickSymbols(n) {
    const pool = [...SHAPE_LETTERS]
    Phaser.Utils.Array.Shuffle(pool)
    return pool.slice(0, n)
  }

  // The pattern row in the upper-middle, last cell rendered as a dashed "?"
  // slot the answer will pop into.
  _buildSequenceRow(sequence) {
    const count = sequence.length
    const maxRowW = this.sWidth * 0.92
    const cell = Math.min(this.minSide * 0.16, maxRowW / (count + 0.35 * (count - 1)))
    const gap = cell * 0.35
    const totalW = cell * count + gap * (count - 1)
    const startX = (this.sWidth - totalW) / 2 + cell / 2
    const y = this.sHeight * 0.34

    sequence.forEach((letter, i) => {
      const x = startX + i * (cell + gap)
      const isSlot = i === count - 1
      if (isSlot) {
        this._slot = { x, y, size: cell }
        const slotG = this.add.graphics().setDepth(3)
        const r = cell * 0.22
        slotG.fillStyle(0xffffff, 0.6)
        slotG.fillRoundedRect(x - cell / 2, y - cell / 2, cell, cell, r)
        slotG.lineStyle(Math.max(3, cell * 0.06), 0x6c7bd6, 0.8)
        slotG.strokeRoundedRect(x - cell / 2, y - cell / 2, cell, cell, r)
        this._roundContainer.add(slotG)

        const q = this.add
          .text(x, y, '?', {
            fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
            fontSize: `${cell * 0.6}px`,
            color: '#6c7bd6',
            fontStyle: 'bold'
          })
          .setOrigin(0.5)
          .setDepth(4)
        this._slot.q = q
        this._roundContainer.add(q)

        if (!this.reducedMotion) {
          this.tweens.add({
            targets: q,
            scale: 1.18,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut'
          })
        }
      } else {
        const img = this.add.image(x, y, `asset_shapes_${letter}`).setDepth(3)
        img.setScale((cell * 0.92) / Math.max(img.width, img.height || img.width))
        this._roundContainer.add(img)
      }
    })
  }

  // Choice tiles below — one per symbol in the pattern's alphabet, shuffled.
  _buildChoices(symbols, answerLetter) {
    const choices = Phaser.Utils.Array.Shuffle([...symbols])
    const cols = choices.length
    const tileR = this.minSide * Math.min(0.12, 0.4 / cols)
    const gap = tileR * 1.1
    const rowW = cols * tileR * 2 + (cols - 1) * gap
    const startX = (this.sWidth - rowW) / 2 + tileR
    const y = this.sHeight * 0.64

    choices.forEach((letter, i) => {
      const x = startX + i * (tileR * 2 + gap)
      const tile = this.add.image(x, y, `asset_shapes_${letter}`).setDepth(3)
      const scale = (tileR * 2) / Math.max(tile.width, tile.height || tile.width)
      tile.setScale(scale)
      tile.setInteractive({ useHandCursor: true })
      tile._letter = letter
      tile._baseScale = scale
      tile.on('pointerdown', () => this._onChoice(tile, answerLetter))
      this._roundContainer.add(tile)

      if (this.reducedMotion) return
      tile.setScale(0)
      this.tweens.add({
        targets: tile,
        scale,
        duration: 340,
        delay: 150 + i * 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          tile._idleTween = this.tweens.add({
            targets: tile,
            scale: scale * 1.06,
            duration: 820,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
            delay: i * 110
          })
        }
      })
    })
  }

  _onChoice(tile, answerLetter) {
    if (this._answered) return

    if (tile._letter !== answerLetter) {
      this._wobble(tile)
      this._playWrongBlip()
      return
    }

    this._answered = true
    if (tile._idleTween) tile._idleTween.stop()

    // Fade the other choices out so the chosen one is the clear hero.
    this._roundContainer.list.forEach((obj) => {
      if (obj !== tile && obj.texture && obj.input) {
        if (obj._idleTween) obj._idleTween.stop()
        this.tweens.add({ targets: obj, alpha: 0.25, scale: obj._baseScale * 0.85, duration: 260 })
      }
    })

    this._fillSlot(answerLetter)
    this._speakShape(answerLetter)
    try {
      this.sound.play('ui_match_drop', { volume: 0.55 })
    } catch {
      /* best-effort */
    }

    this.score += 1
    this.scoreBoard.setScore(this.score)
    this.time.delayedCall(1000, () => this._advanceRound())
  }

  // Pop the answer shape into the "?" slot, hiding the question mark.
  _fillSlot(letter) {
    if (!this._slot) return
    if (this._slot.q) {
      this.tweens.killTweensOf(this._slot.q)
      this._slot.q.setVisible(false)
    }
    const img = this.add.image(this._slot.x, this._slot.y, `asset_shapes_${letter}`).setDepth(5)
    const target = (this._slot.size * 0.92) / Math.max(img.width, img.height || img.width)
    this._roundContainer.add(img)
    if (this.reducedMotion) {
      img.setScale(target)
    } else {
      img.setScale(0)
      this.tweens.add({ targets: img, scale: target, duration: 320, ease: 'Back.easeOut' })
      this._burstStars(this._slot.x, this._slot.y)
    }
  }

  _wobble(tile) {
    if (this.reducedMotion) return
    this.tweens.killTweensOf(tile)
    const baseX = tile.x
    this.tweens.add({
      targets: tile,
      x: baseX - this.minSide * 0.02,
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.inOut',
      onComplete: () => {
        tile.x = baseX
        if (!this._answered) {
          tile._idleTween = this.tweens.add({
            targets: tile,
            scale: tile._baseScale * 1.06,
            duration: 820,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut'
          })
        }
      }
    })
  }

  _speakShape(letter) {
    stopAllLevelAudio()
    const lang = settings.language()
    preloadLevelAudio(`asset_shapes_${letter}`, lang)
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
        this.sound.play('ui_letter_pop', { volume: 0.35, detune: -500 })
      }
    } catch {
      /* best-effort */
    }
  }

  _burstStars(x, y) {
    if (this.reducedMotion) return
    const tints = [0xffffff, 0xffd23f, 0x8be3ff, 0xb59cff]
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2
      const size = this.minSide * 0.02
      const star = this.add.star(x, y, 5, size * 0.45, size, tints[i % tints.length]).setDepth(6)
      const dist = this.minSide * 0.14
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
        showLevelComplete(this, () => this.scene.start(pickNextSceneExcluding('GameL')))
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
