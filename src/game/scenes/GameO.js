import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { preloadLevelAudio, stopAllLevelAudio } from '../../services/libro/levelAudio'
import { settings } from '../../services/settings'

// Five opposite pairs, keyed to the baked asset_opposites_<a-j> icons and the
// `opposites` audio/name pack: day/night, up/down, happy/sad, hot/cold,
// full/empty.
const PAIRS = [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']]
const ALL_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const ROUNDS = PAIRS.length
const MAX_CHOICES = 4

/**
 * Opposites game (GameO) — "find its partner".
 *
 * Each round shows one item at the top (e.g. the sun / "day"), spoken aloud,
 * and a row of choices below. The toddler taps the item's opposite (the moon /
 * "night"). Correct → the opposite is spoken, it pops, score bumps, and the
 * next pair appears. Teaches paired opposite vocabulary in EN/ES. All icons are
 * procedural (baked in Boot) — no art assets.
 */
export class GameO extends Scene {
  constructor() {
    super('GameO')
  }

  // Runs on every start/restart. Phaser reuses the instance, so per-run
  // state lives here; set in the constructor it would leak into the next visit.
  init() {
    this.round = 0
    this.score = 0
    this.completed = false
    this._answer = null
    this._answered = false
    this._roundContainer = null
    this._pairs = []
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.drawBackground()
    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    const lang = settings.language()
    ALL_LETTERS.forEach((letter) =>
      preloadLevelAudio(`asset_opposites_${letter}`, lang).catch(() => {})
    )

    this._pairs = Phaser.Utils.Array.Shuffle([...PAIRS])
    this._startRound(1)

    EventBus.emit('current-scene-ready', this)
  }

  // Warm → cool diagonal wash, echoing the "two sides" idea of opposites.
  drawBackground() {
    const g = this.add.graphics().setDepth(0)
    g.fillGradientStyle(0xffe1b8, 0xd8c8ff, 0xffd0e0, 0xbcd4ff, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight
      const r = this.minSide * (0.005 + Math.random() * 0.008)
      g.fillStyle(0xffffff, 0.3)
      g.fillCircle(x, y, r)
    }
  }

  _startRound(roundNum) {
    this.round = roundNum
    this._answered = false
    this._roundContainer = this.add.container(0, 0).setDepth(2)

    const pair = this._pairs[roundNum - 1]
    const promptSide = Math.random() < 0.5 ? 0 : 1
    const promptLetter = pair[promptSide]
    const answerLetter = pair[1 - promptSide]
    this._answer = answerLetter

    const choiceCount = Math.min(2 + Math.floor((roundNum - 1) / 2), MAX_CHOICES)
    const distractors = Phaser.Utils.Array.Shuffle(
      ALL_LETTERS.filter((l) => l !== promptLetter && l !== answerLetter)
    ).slice(0, choiceCount - 1)
    const choices = Phaser.Utils.Array.Shuffle([answerLetter, ...distractors])

    this._buildPrompt(promptLetter)
    this._buildChoices(choices, answerLetter)
    this._speak(promptLetter)
  }

  _buildPrompt(letter) {
    const cx = this.sWidth / 2
    const cy = this.sHeight * 0.26
    const ringR = this.minSide * 0.16

    const ring = this.add.circle(cx, cy, ringR, 0xffffff, 0.72).setDepth(2)
    ring.setStrokeStyle(Math.max(3, ringR * 0.06), 0xffffff, 0.9)
    this._roundContainer.add(ring)

    const icon = this.add.image(cx, cy, `asset_opposites_${letter}`).setDepth(3)
    icon.setScale((ringR * 1.45) / Math.max(icon.width, icon.height || icon.width))
    this._roundContainer.add(icon)

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: ring,
        scale: 1.08,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }
  }

  _buildChoices(choices, answerLetter) {
    const cols = Math.min(choices.length, 4)
    const tileR = this.minSide * Math.min(0.12, 0.42 / cols)
    const gap = tileR * 1.0
    const rowW = cols * tileR * 2 + (cols - 1) * gap
    const startX = (this.sWidth - rowW) / 2 + tileR
    const y = this.sHeight * 0.62

    choices.forEach((letter, i) => {
      const x = startX + i * (tileR * 2 + gap)
      const tile = this.add.image(x, y, `asset_opposites_${letter}`).setDepth(3)
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

    this._roundContainer.list.forEach((obj) => {
      if (obj !== tile && obj.texture && obj.input) {
        if (obj._idleTween) obj._idleTween.stop()
        this.tweens.add({ targets: obj, alpha: 0.25, scale: obj._baseScale * 0.85, duration: 260 })
      }
    })

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: tile,
        scale: tile._baseScale * 1.35,
        duration: 300,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => this._burstStars(tile.x, tile.y)
      })
    } else {
      this._burstStars(tile.x, tile.y)
    }

    this._speak(answerLetter)
    try {
      this.sound.play('ui_match_drop', { volume: 0.55 })
    } catch {
      /* best-effort */
    }

    this.score += 1
    this.scoreBoard.setScore(this.score)
    this.time.delayedCall(1000, () => this._advanceRound())
  }

  _wobble(tile) {
    if (this.reducedMotion) return
    this.tweens.killTweensOf(tile)
    if (tile._baseScale) tile.setScale(tile._baseScale) // The killed tween may be the entrance pop.
    const baseX = tile._homeX ?? tile.x
    tile._homeX = baseX // Captured once so a wobble started mid-wobble never drifts the target.
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

  _speak(letter) {
    stopAllLevelAudio()
    const lang = settings.language()
    preloadLevelAudio(`asset_opposites_${letter}`, lang)
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
    const tints = [0xffffff, 0xffd23f, 0xff8fc7, 0x8be3ff]
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2
      const size = this.minSide * 0.02
      const star = this.add.star(x, y, 5, size * 0.45, size, tints[i % tints.length]).setDepth(6)
      const dist = this.minSide * 0.15
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
        showLevelComplete(this, () => this.scene.start(pickNextSceneExcluding('GameO')))
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
