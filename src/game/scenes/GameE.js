import { EventBus } from '../EventBus'
import Phaser, { Scene } from 'phaser'
import { showCelebration } from '../celebrate'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { addBackButton, addScoreBadge } from '../hud'
import { dropPieces } from '../pieceDrop'

const NUM_OF_NUMBERS = 9

/**
 * Numbers puzzle — same shadow-matching mechanic as GameA/B/C/D, but the
 * pack is the procedurally-generated `asset_numbers_<a-i>` chips (digits
 * 1-9) drawn over a starry-night cosmos background. Background is rendered
 * in Phaser graphics rather than a bitmap so it stays crisp at every
 * resolution and adds zero bytes to the asset bundle.
 *
 * Shadow tinting is INVERTED here (light shadow on dark sky) because the
 * standard black tint used by the daytime levels would vanish against the
 * indigo background.
 */
export class GameE extends Scene {
  constructor() {
    super('GameE')

    this.label = null
    this.animals = null
    this.baseShades = {}
    this.animalsNames = {}
    this.animalsShadows = null
    this.animalsOnBase = new Set()
    this.score = 0
    this.packName = 'numbers'
  }

  preload() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.fontSize = Math.min(this.sWidth, this.sHeight) * 0.04

    for (let i = 0; i < NUM_OF_NUMBERS; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const animalKey = `animal${String.fromCharCode(65 + i)}`

      this.baseShades[animalKey] = {
        x: (this.sWidth / 6) * (col * 2 + 1),
        y: this.sHeight * 0.2 * (row + 1)
      }
    }

    this.drawStarryBackground()
  }

  create() {
    this.input.on('pointerdown', () => {
      if (this.sound.context.state === 'suspended') {
        this.sound.context.resume()
      }
    })
    this.start()

    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    EventBus.emit('current-scene-ready', this)
  }

  /**
   * Hand-painted starry-night composition. Layered from back to front:
   *  1. Indigo→midnight-purple→soft-pink vertical gradient (deep cosmos)
   *  2. Two large translucent nebula blooms (pink + violet)
   *  3. ~90 small stars scattered above the horizon, varying size + alpha
   *  4. A friendly crescent moon top-right
   *  5. Two dark rolling-hill silhouettes anchoring the bottom edge
   */
  drawStarryBackground() {
    const g = this.add.graphics().setDepth(0)

    const top = 0x0d0a2c // deep midnight indigo
    const mid = 0x2a1a5e // royal cosmos purple
    const horizon = 0x6a3a8c // dusk lavender
    g.fillGradientStyle(top, top, mid, horizon, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    // Nebula glows — large, very soft, two complementary hues so the sky
    // doesn't read as a flat gradient.
    g.fillStyle(0xff7fb5, 0.08)
    g.fillCircle(this.sWidth * 0.28, this.sHeight * 0.42, this.sWidth * 0.5)
    g.fillStyle(0x6c4ad6, 0.1)
    g.fillCircle(this.sWidth * 0.78, this.sHeight * 0.62, this.sWidth * 0.45)

    // Stars — deterministic-ish but with enough randomness that they feel
    // sprinkled. Sized in fractions of minSide so they scale with device.
    const minSide = Math.min(this.sWidth, this.sHeight)
    const starCount = 90
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight * 0.78
      const r = (0.4 + Math.random() * 0.9) * minSide * 0.005
      const a = 0.5 + Math.random() * 0.45
      g.fillStyle(0xffffff, a)
      g.fillCircle(x, y, r)
    }

    // A handful of brighter "4-point" stars for sparkle accents.
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight * 0.6 + this.sHeight * 0.05
      const r = minSide * 0.012
      const star = this.add
        .star(x, y, 4, r * 0.35, r, 0xffffff)
        .setAlpha(0.9)
        .setDepth(0)
      this.tweens.add({
        targets: star,
        scale: 0.4,
        alpha: 0.35,
        duration: 1100 + Math.random() * 600,
        delay: Math.random() * 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }

    // Crescent moon — top-right corner. Drawn as a yellow disc with a
    // background-coloured disc "biting" into its left edge.
    const moonR = minSide * 0.075
    const moonX = this.sWidth - moonR * 1.8
    const moonY = this.sHeight * 0.12
    g.fillStyle(0x000000, 0.25)
    g.fillCircle(moonX + moonR * 0.05, moonY + moonR * 0.12, moonR * 1.02)
    g.fillStyle(0xfff3a0, 1)
    g.fillCircle(moonX, moonY, moonR)
    // Bite — match the upper midnight indigo so the crescent reads cleanly.
    g.fillStyle(top, 1)
    g.fillCircle(moonX - moonR * 0.35, moonY - moonR * 0.05, moonR * 0.92)

    // Rolling hill silhouettes — deep midnight, two layers for depth.
    g.fillStyle(0x1a0a3c, 1)
    g.fillEllipse(
      this.sWidth * 0.3,
      this.sHeight + this.sWidth * 0.18,
      this.sWidth * 1.6,
      this.sWidth * 0.65
    )
    g.fillStyle(0x0d0526, 1)
    g.fillEllipse(
      this.sWidth * 0.78,
      this.sHeight + this.sWidth * 0.25,
      this.sWidth * 1.45,
      this.sWidth * 0.55
    )
  }

  start() {
    this.celebrated = new Set()
    const availableNumbers = [
      `asset_${this.packName}_a`,
      `asset_${this.packName}_b`,
      `asset_${this.packName}_c`,
      `asset_${this.packName}_d`,
      `asset_${this.packName}_e`,
      `asset_${this.packName}_f`,
      `asset_${this.packName}_g`,
      `asset_${this.packName}_h`,
      `asset_${this.packName}_i`
    ]
    // No shuffle — numbers always shown 1→9 in reading order so the spatial
    // layout reinforces sequence learning. (Other packs shuffle for variety;
    // here, predictability is the feature.)
    const numbers = availableNumbers

    for (let index = 0; index < numbers.length; index++) {
      const animalKey = numbers[index]
      const animalName = `animal${String.fromCharCode(65 + index)}`
      this.animalsNames[animalName] = animalKey
    }

    this.addAnimalsShadow(numbers)
    this.addAnimals(numbers)
  }

  addAnimalsShadow(animals) {
    this.animalsShadows = this.add.group()
    // Numbers render bigger than the other packs (20% bump) — the glyph
    // takes less optical space than the chunky 3-D emoji art, so it needs
    // the extra size to read at the same visual weight.
    const scaleSizeShadow = Math.min(this.sWidth, this.sHeight) * 0.0008946

    for (let index = 0; index < animals.length; index++) {
      const animalKey = animals[index]
      const animalShadow = this.add
        .image(
          this.baseShades[`animal${String.fromCharCode(65 + index)}`].x,
          this.baseShades[`animal${String.fromCharCode(65 + index)}`].y,
          animalKey
        )
        .setScale(scaleSizeShadow)
        .setInteractive()
        .setDepth(1)
      // Light tint on dark sky — a soft moonlit "outline" of where each
      // number belongs. Standard black-on-light shadow would disappear here.
      animalShadow.setTint(0xffffff)
      animalShadow.setAlpha(0.18)

      this.animalsShadows.add(animalShadow)
      this[`animal${String.fromCharCode(65 + index)}Shadow`] = animalShadow
    }
  }

  addAnimals(animals) {
    this.animals = this.add.group()

    const scaleSize = Math.min(this.sWidth, this.sHeight) * 0.000882
    const createAnimal = (animalName, index) => {
      const key = `animal${String.fromCharCode(65 + index)}`
      const animal = this.add
        .image(0, 0, animalName)
        .setScale(scaleSize)
        .setInteractive()
        .setDepth(2)
        .setName(key)
      animal.x = Phaser.Math.Clamp(
        Math.random() * this.sWidth,
        animal.displayWidth / 2,
        this.sWidth - animal.displayWidth / 2
      )
      animal.y = Phaser.Math.Clamp(
        Math.random() * this.sHeight,
        animal.displayHeight / 2,
        this.sHeight - animal.displayHeight / 2
      )

      this.animals.add(animal)
      this[key] = animal
      return animal
    }

    const animalObjects = animals.map(createAnimal)
    let animalDragged = null

    this.input.setDraggable(animalObjects)
    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      animalDragged = this.animalsNames[gameObject.name]

      dragX = Phaser.Math.Clamp(
        dragX,
        gameObject.displayWidth / 2,
        this.sWidth - gameObject.displayWidth / 2
      )
      dragY = Phaser.Math.Clamp(
        dragY,
        gameObject.displayHeight / 2,
        this.sHeight - gameObject.displayHeight / 2
      )

      gameObject.x = dragX
      gameObject.y = dragY

      this.isAnimalOnBase(gameObject.name)
    })

    this.input.on('dragend', (pointer, gameObject) => {
      if (this.animalsOnBase.has(animalDragged)) {
        const slot = gameObject.name
        gameObject.x = this.baseShades[slot].x
        gameObject.y = this.baseShades[slot].y
        gameObject.disableInteractive()

        const isFinal = this.animalsOnBase.size === animalObjects.length
        const triggerEnd = isFinal && !this.label
        if (triggerEnd) this.label = 'completing'
        const launchLevelEnd = () =>
          showLevelComplete(this, () =>
            this.scene.start(pickNextSceneExcluding('GameE'))
          )

        if (!this.celebrated.has(animalDragged)) {
          this.celebrated.add(animalDragged)
          // On the final match, chain level celebration to fire AFTER the
          // per-match spelling modal auto-dismisses — never on top of it.
          const modal = showCelebration(
            this,
            animalDragged,
            triggerEnd ? launchLevelEnd : null
          )
          if (triggerEnd && !modal) launchLevelEnd()
        } else if (triggerEnd) {
          this.time.delayedCall(800, launchLevelEnd)
        }

        this.sound.play('ui_match_drop', { volume: 0.55 })
        this.score++
        this.scoreBoard.setScore(this.score)
      }
    })

    dropPieces(this, animalObjects)
  }

  isAnimalOnBase(animalKey) {
    const scaleSizeShadowOnBase = Math.min(this.sWidth, this.sHeight) * 0.0009198
    const scaleSizeShadow = Math.min(this.sWidth, this.sHeight) * 0.0008946
    const isOnBase =
      Math.abs(this[animalKey].x - this.baseShades[animalKey].x) < 10 &&
      Math.abs(this[animalKey].y - this.baseShades[animalKey].y) < 10

    if (isOnBase) {
      // Matched: shadow blooms bright yellow (matches the moon) — clearly
      // visible against the starry sky and thematically "lit up".
      this[`${animalKey}Shadow`].setTint(0xfff3a0)
      this[`${animalKey}Shadow`].setTintFill(0xfff3a0)
      this[`${animalKey}Shadow`].setAlpha(1)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadowOnBase)
      this.animalsOnBase.add(this.animalsNames[animalKey])
    } else {
      this[`${animalKey}Shadow`].setTint(0xffffff)
      this[`${animalKey}Shadow`].setAlpha(0.18)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadow)
      this.animalsOnBase.delete(this.animalsNames[animalKey])
    }

    return isOnBase
  }
}
