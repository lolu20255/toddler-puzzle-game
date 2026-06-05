import { EventBus } from '../EventBus'
import Phaser, { Scene } from 'phaser'
import { showCelebration } from '../celebrate'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { addBackButton, addScoreBadge } from '../hud'
import { dropPieces } from '../pieceDrop'

const NUM_OF_LETTERS = 9

/**
 * Letters puzzle — same shadow-matching mechanic as GameA-E, with the
 * procedural `asset_letters_<a-i>` chips (A-I) drawn over a pastel-dawn
 * sky with a rainbow arc and soft clouds.
 *
 * Visual identity:
 *   - Numbers (GameE) = starry night cosmos (deep, dreamy)
 *   - Letters (GameF) = pastel dawn rainbow (soft, hopeful)
 *   Both pure procedural — zero asset bytes added, perfectly resolution-
 *   independent on any device.
 *
 * Shadow tinting uses a soft warm peach (not the dark-grey of the daytime
 * packs) so it reads cleanly against the warm-pink dawn gradient without
 * the harsh contrast that would feel out of place in this palette.
 */
export class GameF extends Scene {
  constructor() {
    super('GameF')

    this.label = null
    this.animals = null
    this.baseShades = {}
    this.animalsNames = {}
    this.animalsShadows = null
    this.animalsOnBase = new Set()
    this.score = 0
    this.packName = 'letters'
  }

  preload() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.fontSize = Math.min(this.sWidth, this.sHeight) * 0.04

    for (let i = 0; i < NUM_OF_LETTERS; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const animalKey = `animal${String.fromCharCode(65 + i)}`

      this.baseShades[animalKey] = {
        x: (this.sWidth / 6) * (col * 2 + 1),
        y: this.sHeight * 0.2 * (row + 1)
      }
    }

    this.drawDawnBackground()
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
   * Pastel-dawn composition, layered back to front:
   *   1. Vertical gradient: peach → soft pink → lavender → sky blue.
   *   2. A wide rainbow arc spanning the lower-middle of the screen.
   *   3. 4-5 fluffy white clouds at varying heights and sizes.
   *   4. A soft pastel hill silhouette at the bottom edge to anchor the
   *      composition (mirrors the grass in the daytime levels without
   *      reusing the same hue).
   */
  drawDawnBackground() {
    const sW = this.sWidth
    const sH = this.sHeight
    const minSide = Math.min(sW, sH)
    const g = this.add.graphics().setDepth(0)

    // Sky gradient — warm at the horizon, cool at the top, with a touch of
    // pink in the middle band. Reads as "the moment just after sunrise".
    const top = 0xffd5c8 // peach
    const upperMid = 0xffbed4 // pastel pink
    const lowerMid = 0xd5c8ff // lavender
    const bottom = 0xb8e0ff // soft blue
    g.fillGradientStyle(top, top, lowerMid, upperMid, 1)
    g.fillRect(0, 0, sW, sH * 0.5)
    g.fillGradientStyle(lowerMid, upperMid, bottom, bottom, 1)
    g.fillRect(0, sH * 0.5, sW, sH * 0.5)

    // Rainbow arc — 7 concentric stroked arcs, ROYGBIV. Centred below the
    // visible area so only the top of the arc shows, like a half-rainbow.
    const cx = sW / 2
    const cy = sH * 0.95
    const outerR = sW * 0.7
    const bandThickness = Math.max(8, minSide * 0.018)
    const bandGap = 0
    const colors = [
      0xff5d5d, // red
      0xff9f1c, // orange
      0xffd23f, // yellow
      0x5fc34a, // green
      0x3ba4ff, // blue
      0x6c4ad6, // indigo
      0x9b5de5  // violet
    ]
    colors.forEach((color, i) => {
      const r = outerR - i * (bandThickness + bandGap)
      g.lineStyle(bandThickness, color, 0.85)
      g.beginPath()
      g.arc(cx, cy, r, Math.PI, 0, false)
      g.strokePath()
    })

    // Pastel rolling hill silhouette at the bottom — slightly different
    // from the grass hills on the daytime levels so the dawn palette
    // stays consistent.
    g.fillStyle(0xa8d8c8, 1) // muted mint
    g.fillEllipse(sW * 0.3, sH + sW * 0.18, sW * 1.7, sW * 0.6)
    g.fillStyle(0x8ec9b6, 1) // slightly darker mint
    g.fillEllipse(sW * 0.78, sH + sW * 0.25, sW * 1.55, sW * 0.5)

    // Fluffy white clouds drifting at three altitudes. Each cloud is a
    // cluster of 4 overlapping circles for that classic cartoon-puff shape.
    const clouds = [
      { x: sW * 0.18, y: sH * 0.12, scale: 1.0 },
      { x: sW * 0.78, y: sH * 0.07, scale: 0.7 },
      { x: sW * 0.55, y: sH * 0.22, scale: 0.85 },
      { x: sW * 0.1, y: sH * 0.35, scale: 0.55 }
    ]
    const baseR = minSide * 0.06
    clouds.forEach((c) => {
      const r = baseR * c.scale
      g.fillStyle(0xffffff, 0.92)
      g.fillCircle(c.x, c.y, r)
      g.fillCircle(c.x + r * 0.85, c.y + r * 0.2, r * 0.78)
      g.fillCircle(c.x - r * 0.85, c.y + r * 0.25, r * 0.7)
      g.fillCircle(c.x + r * 0.2, c.y - r * 0.45, r * 0.65)
    })

    // A handful of tiny twinkles for extra magic — staggered tween so they
    // pulse independently.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const twinkleSpots = [
        [0.35, 0.08],
        [0.65, 0.18],
        [0.45, 0.3]
      ]
      twinkleSpots.forEach(([fx, fy], i) => {
        const r = minSide * 0.01
        const star = this.add
          .star(sW * fx, sH * fy, 5, r * 0.4, r, 0xffffff)
          .setAlpha(0.85)
          .setDepth(0)
        this.tweens.add({
          targets: star,
          scale: 0.3,
          alpha: 0.4,
          duration: 1100 + Math.random() * 500,
          delay: i * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      })
    }
  }

  start() {
    this.celebrated = new Set()
    const availableLetters = [
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
    // No shuffle — letters always shown A→I in reading order so the spatial
    // layout reinforces alphabet sequence learning.
    const letters = availableLetters

    for (let index = 0; index < letters.length; index++) {
      const animalKey = letters[index]
      const animalName = `animal${String.fromCharCode(65 + index)}`
      this.animalsNames[animalName] = animalKey
    }

    this.addAnimalsShadow(letters)
    this.addAnimals(letters)
  }

  addAnimalsShadow(animals) {
    this.animalsShadows = this.add.group()
    // Slightly larger than the daytime packs (20% bump, same as numbers) so
    // the chunky glyphs read at the same visual weight as the 3-D emoji art.
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
      // Warm peach tint at low alpha — visible on the dawn gradient
      // without the harshness of pure black.
      animalShadow.setTint(0xffe0c4)
      animalShadow.setAlpha(0.5)

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
            this.scene.start(pickNextSceneExcluding('GameF'))
          )

        if (!this.celebrated.has(animalDragged)) {
          this.celebrated.add(animalDragged)
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
      // Matched: shadow blooms warm yellow (matches the rainbow's yellow band)
      // — clearly visible against the pastel sky and thematically "lit up".
      this[`${animalKey}Shadow`].setTint(0xffd23f)
      this[`${animalKey}Shadow`].setTintFill(0xffd23f)
      this[`${animalKey}Shadow`].setAlpha(1)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadowOnBase)
      this.animalsOnBase.add(this.animalsNames[animalKey])
    } else {
      this[`${animalKey}Shadow`].setTint(0xffe0c4)
      this[`${animalKey}Shadow`].setAlpha(0.5)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadow)
      this.animalsOnBase.delete(this.animalsNames[animalKey])
    }

    return isOnBase
  }
}
