import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { preloadLevelAudio, stopAllLevelAudio } from '../../services/libro/levelAudio'
import { settings } from '../../services/settings'

const ANIMAL_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']

// Nine slots on a 3×3 organic grid (normalised). Y stays in 0.28–0.72 so the
// animals never collide with the HUD row or the bottom safe area.
const SLOTS = [
  [0.22, 0.30], [0.5, 0.28], [0.78, 0.30],
  [0.2, 0.5], [0.5, 0.5], [0.8, 0.5],
  [0.24, 0.71], [0.5, 0.73], [0.76, 0.71]
]

/**
 * Animals & Sounds game (GameN) — a tap-to-explore farm board.
 *
 * Every animal is tappable: tapping wiggles it, plays its sound ("Moo!",
 * "Woof!") and then speaks its name ("Cow"), in the parent-selected language.
 * The first tap on each animal marks it "found" with a star and bumps the
 * score; once all nine are found the level celebration plays and the rotation
 * continues. Re-tapping a found animal simply replays its sound for fun.
 *
 * Sounds are TTS onomatopoeia (the `animal_sounds` pack), so the whole game
 * rides the existing bundled-audio pipeline — no external sound files.
 */
export class GameN extends Scene {
  constructor() {
    super('GameN')
    this.score = 0
    this.completed = false
    this._found = new Set()
    this._animals = {}
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.add
      .image(this.sWidth / 2, this.sHeight / 2, 'background_a')
      .setOrigin(0.5)
      .setDisplaySize(this.sWidth, this.sHeight)
      .setDepth(0)

    // Unlock the audio context on first touch (iOS Safari requirement).
    this.input.on('pointerdown', () => {
      if (this.sound.context.state === 'suspended') this.sound.context.resume()
    })

    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    // Warm both audio caches (sounds + names) for a snappy first tap.
    const lang = settings.language()
    ANIMAL_LETTERS.forEach((letter) => {
      preloadLevelAudio(`asset_animal_sounds_${letter}`, lang).catch(() => {})
      preloadLevelAudio(`asset_animals_${letter}`, lang).catch(() => {})
    })

    this._buildBoard()

    EventBus.emit('current-scene-ready', this)
  }

  _buildBoard() {
    const order = Phaser.Utils.Array.Shuffle([...ANIMAL_LETTERS])
    const targetSize = this.minSide * 0.26

    order.forEach((letter, i) => {
      const [fx, fy] = SLOTS[i]
      const x = this.sWidth * fx
      const y = this.sHeight * fy

      const animal = this.add.image(x, y, `asset_animals_${letter}`).setDepth(3)
      animal.setScale(targetSize / Math.max(animal.width, animal.height || animal.width))
      animal._baseScale = animal.scaleX
      animal._letter = letter
      animal._homeY = y
      animal.setInteractive({ useHandCursor: true })
      animal.on('pointerdown', () => this._onTap(animal))
      this._animals[letter] = animal

      if (this.reducedMotion) return
      // Gentle idle bob so the board feels alive.
      animal._idleTween = this.tweens.add({
        targets: animal,
        y: y - this.minSide * 0.012,
        duration: 1600 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
        delay: i * 120
      })
    })
  }

  _onTap(animal) {
    if (this.completed) return
    this._wiggle(animal)
    this._playAnimal(animal._letter)

    if (this._found.has(animal._letter)) return
    this._found.add(animal._letter)
    this._addFoundStar(animal)
    this._burstStars(animal.x, animal.y - animal.displayHeight * 0.3)

    this.score += 1
    this.scoreBoard.setScore(this.score)

    if (this._found.size >= ANIMAL_LETTERS.length) {
      this.completed = true
      this.time.delayedCall(1100, () => {
        this.input.enabled = false
        showLevelComplete(this, () => this.scene.start(pickNextSceneExcluding('GameN')))
      })
    }
  }

  // Happy squash + rock so the animal reacts to the toddler's touch.
  _wiggle(animal) {
    if (this.reducedMotion) return
    const base = animal._baseScale
    this.tweens.killTweensOf(animal)
    this.tweens.add({
      targets: animal,
      scaleX: base * 1.16,
      scaleY: base * 1.16,
      angle: { from: -7, to: 7 },
      duration: 90,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.inOut',
      onComplete: () => {
        animal.angle = 0
        animal.setScale(base)
        animal.y = animal._homeY
        if (!this.reducedMotion) {
          animal._idleTween = this.tweens.add({
            targets: animal,
            y: animal._homeY - this.minSide * 0.012,
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut'
          })
        }
      }
    })
  }

  // A small gold star badge marking the animal as "found".
  _addFoundStar(animal) {
    const r = animal.displayWidth * 0.18
    const sx = animal.x + animal.displayWidth * 0.32
    const sy = animal.y - animal.displayHeight * 0.34
    const star = this.add.star(sx, sy, 5, r * 0.45, r, 0xffd23f).setDepth(6)
    star.setStrokeStyle(Math.max(2, r * 0.12), 0xc99400, 1)
    if (this.reducedMotion) return
    star.setScale(0)
    this.tweens.add({ targets: star, scale: 1, duration: 320, ease: 'Back.easeOut' })
  }

  // Play the animal's SOUND, then chain its NAME once the sound finishes.
  _playAnimal(letter) {
    stopAllLevelAudio()
    const lang = settings.language()
    preloadLevelAudio(`asset_animal_sounds_${letter}`, lang)
      .then((sound) => {
        const playName = () => {
          preloadLevelAudio(`asset_animals_${letter}`, lang)
            .then((name) => {
              if (!name) return
              try {
                name.currentTime = 0
                name.play().catch(() => {})
              } catch {
                /* best-effort */
              }
            })
            .catch(() => {})
        }
        if (!sound) {
          playName()
          return
        }
        try {
          sound.currentTime = 0
          sound.addEventListener('ended', playName, { once: true })
          // Safety net: if 'ended' never fires, still speak the name.
          this.time.delayedCall(1600, playName)
          sound.play().catch(() => playName())
        } catch {
          playName()
        }
      })
      .catch(() => {})
  }

  _burstStars(x, y) {
    if (this.reducedMotion) return
    const tints = [0xffffff, 0xffd23f, 0xff8fc7, 0x8be3ff]
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2
      const size = this.minSide * 0.02
      const star = this.add.star(x, y, 5, size * 0.45, size, tints[i % tints.length]).setDepth(7)
      const dist = this.minSide * 0.14
      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        angle: 200,
        scale: 0,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy()
      })
    }
  }
}
