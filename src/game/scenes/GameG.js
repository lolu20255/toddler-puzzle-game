import { EventBus } from '../EventBus'
import Phaser, { Scene } from 'phaser'
import { showCelebration } from '../celebrate'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { addBackButton, addScoreBadge } from '../hud'
import { dropPieces } from '../pieceDrop'

const NUM_OF_SHAPES = 9

/**
 * Shapes puzzle — same shadow-matching mechanic as GameA-F, with the
 * procedural `asset_shapes_<a-i>` pieces (Circle / Square / Triangle /
 * Rectangle / Star / Heart / Diamond / Hexagon / Oval) drawn over a
 * pastel mint→lavender "geometric playground" background.
 *
 * Visual identity (one per pack, deliberately distinct):
 *   - GameA-D = bright daytime sky + grass (cartoon emoji art)
 *   - GameE (Numbers) = starry night cosmos (deep, dreamy)
 *   - GameF (Letters) = pastel dawn rainbow (soft, hopeful)
 *   - GameG (Shapes) = pastel mint→lavender geometric playground (calm,
 *     mathy — large outlined shape silhouettes drift in the background)
 *
 * Shadow tint uses a soft lavender (`0xb594ff` α 0.32) so it reads cleanly
 * on the cool mint-to-lavender gradient. The matched-state bloom is a
 * vibrant violet matching the lavender accents.
 */
export class GameG extends Scene {
  constructor() {
    super('GameG')

    this.label = null
    this.animals = null
    this.baseShades = {}
    this.animalsNames = {}
    this.animalsShadows = null
    this.animalsOnBase = new Set()
    this.score = 0
    this.packName = 'shapes'
  }

  preload() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.fontSize = Math.min(this.sWidth, this.sHeight) * 0.04

    for (let i = 0; i < NUM_OF_SHAPES; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const animalKey = `animal${String.fromCharCode(65 + i)}`

      this.baseShades[animalKey] = {
        x: (this.sWidth / 6) * (col * 2 + 1),
        y: this.sHeight * 0.2 * (row + 1)
      }
    }

    this.drawGeometricPlaygroundBackground()
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
   * Pastel "geometric playground" composition, back to front:
   *   1. Mint-cream → lavender vertical gradient (calm, neutral, doesn't
   *      compete with the colourful shape tiles).
   *   2. A handful of LARGE outlined shape silhouettes drifting in the
   *      background at very low alpha — same shape vocabulary the toddler
   *      is matching, peeking through the canvas as ambient decoration.
   *   3. A soft cream horizon strip at the bottom (anchors the scene the
   *      same way grass does on the daytime scenes, without reusing green).
   *   4. A few tiny twinkling sparkles for personality.
   */
  drawGeometricPlaygroundBackground() {
    const sW = this.sWidth
    const sH = this.sHeight
    const minSide = Math.min(sW, sH)
    const g = this.add.graphics().setDepth(0)

    // Sky gradient — pastel mint at the top, soft lavender at the bottom.
    // Both colours are low-saturation so the bright shape tiles read crisp
    // when they're dropped onto their silhouettes.
    const top = 0xd6f0e3 // pastel mint
    const upperMid = 0xe0e8f2 // misty blue
    const lowerMid = 0xe8dcff // soft lavender
    const bottom = 0xf0e5ff // cool lavender wash
    g.fillGradientStyle(top, top, lowerMid, upperMid, 1)
    g.fillRect(0, 0, sW, sH * 0.55)
    g.fillGradientStyle(lowerMid, upperMid, bottom, bottom, 1)
    g.fillRect(0, sH * 0.55, sW, sH * 0.45)

    // Cream horizon strip — softens the bottom edge without reusing the
    // green grass silhouette from MainMenu / daytime packs.
    g.fillStyle(0xfff8e7, 0.6)
    g.fillEllipse(sW * 0.5, sH + sW * 0.15, sW * 1.7, sW * 0.4)

    // ── Background shape silhouettes — large, outline-only, very low alpha.
    // Same shape vocabulary the toddler is matching, but here as ambient
    // decoration. Outline colours pull from the same rainbow palette so
    // they feel related to the foreground tiles without being distracting.
    const bgShapes = [
      { type: 'circle', x: sW * 0.15, y: sH * 0.18, r: minSide * 0.13, color: 0xff5d5d },
      { type: 'triangle', x: sW * 0.85, y: sH * 0.12, r: minSide * 0.12, color: 0xffd23f },
      { type: 'hexagon', x: sW * 0.92, y: sH * 0.42, r: minSide * 0.12, color: 0x9b5de5 },
      { type: 'star', x: sW * 0.08, y: sH * 0.65, r: minSide * 0.11, color: 0xff9f1c },
      { type: 'diamond', x: sW * 0.85, y: sH * 0.78, r: minSide * 0.11, color: 0x29c7b8 },
      { type: 'heart', x: sW * 0.18, y: sH * 0.95, r: minSide * 0.1, color: 0xff5da2 },
      { type: 'square', x: sW * 0.5, y: sH * 0.92, r: minSide * 0.1, color: 0x3ba4ff }
    ]
    const strokeW = Math.max(3, minSide * 0.012)
    bgShapes.forEach((s) => {
      g.lineStyle(strokeW, s.color, 0.18)
      this._strokeBgShape(g, s.type, s.x, s.y, s.r)
    })

    // ── Tiny twinkling sparkles for personality — same animated treatment
    // as MainMenu's sky decoration.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const twinkles = [
        [0.3, 0.08],
        [0.7, 0.25],
        [0.45, 0.5]
      ]
      twinkles.forEach(([fx, fy], i) => {
        const r = minSide * 0.012
        const star = this.add
          .star(sW * fx, sH * fy, 5, r * 0.4, r, 0xffffff)
          .setAlpha(0.85)
          .setDepth(0)
        this.tweens.add({
          targets: star,
          scale: 0.3,
          alpha: 0.4,
          duration: 1100 + Math.random() * 500,
          delay: i * 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      })
    }
  }

  /** Outline-only version of `_drawShape` used for the ambient background. */
  _strokeBgShape(g, shape, cx, cy, r) {
    switch (shape) {
      case 'circle':
        g.strokeCircle(cx, cy, r)
        break
      case 'square': {
        const s = r * 1.7
        g.strokeRoundedRect(cx - s / 2, cy - s / 2, s, s, s * 0.08)
        break
      }
      case 'rectangle': {
        const w = r * 2
        const h = r * 1.25
        g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, h * 0.1)
        break
      }
      case 'triangle': {
        const h = r * 1.7
        const w = h * 1.15
        this._strokePath(g, [
          { x: cx, y: cy - h / 1.7 },
          { x: cx + w / 2, y: cy + h / 2.4 },
          { x: cx - w / 2, y: cy + h / 2.4 }
        ])
        break
      }
      case 'star': {
        const outerR = r * 1.05
        const innerR = r * 0.45
        const pts = []
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const rr = i % 2 === 0 ? outerR : innerR
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
        }
        this._strokePath(g, pts)
        break
      }
      case 'heart': {
        const segments = 60
        const pts = []
        const k = r / 17
        for (let i = 0; i <= segments; i++) {
          const t = (i / segments) * Math.PI * 2 - Math.PI / 2
          const x = 16 * Math.pow(Math.sin(t), 3)
          const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
          pts.push({ x: cx + x * k, y: cy - y * k })
        }
        this._strokePath(g, pts)
        break
      }
      case 'diamond': {
        const w = r * 1.4
        const h = r * 1.9
        this._strokePath(g, [
          { x: cx, y: cy - h / 2 },
          { x: cx + w / 2, y: cy },
          { x: cx, y: cy + h / 2 },
          { x: cx - w / 2, y: cy }
        ])
        break
      }
      case 'hexagon': {
        const pts = []
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i
          pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
        }
        this._strokePath(g, pts)
        break
      }
      case 'oval':
        g.strokeEllipse(cx, cy, r * 2.2, r * 1.5)
        break
    }
  }

  _strokePath(g, pts) {
    g.beginPath()
    g.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
    g.closePath()
    g.strokePath()
  }

  start() {
    this.celebrated = new Set()
    const availableShapes = [
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
    // No shuffle — shapes always shown in the same order so the layout
    // becomes a familiar geometry grid the toddler can memorise. (Numbers/
    // Letters do the same for sequence learning.)
    const shapes = availableShapes

    for (let index = 0; index < shapes.length; index++) {
      const animalKey = shapes[index]
      const animalName = `animal${String.fromCharCode(65 + index)}`
      this.animalsNames[animalName] = animalKey
    }

    this.addAnimalsShadow(shapes)
    this.addAnimals(shapes)
  }

  addAnimalsShadow(animals) {
    this.animalsShadows = this.add.group()
    // Same 20% bump as Numbers/Letters so the procedural shapes read at the
    // same visual weight as the 3-D emoji art in the daytime packs.
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
      // Soft lavender tint on the cool pastel background — readable without
      // the harshness of a dark-grey shadow.
      animalShadow.setTint(0xb594ff)
      animalShadow.setAlpha(0.32)

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
            this.scene.start(pickNextSceneExcluding('GameG'))
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
      // Matched: shadow blooms vibrant violet — same hue family as the
      // background lavender accents, so it reads as "lit up" not "alarming".
      this[`${animalKey}Shadow`].setTint(0x9b5de5)
      this[`${animalKey}Shadow`].setTintFill(0x9b5de5)
      this[`${animalKey}Shadow`].setAlpha(1)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadowOnBase)
      this.animalsOnBase.add(this.animalsNames[animalKey])
    } else {
      this[`${animalKey}Shadow`].setTint(0xb594ff)
      this[`${animalKey}Shadow`].setAlpha(0.32)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadow)
      this.animalsOnBase.delete(this.animalsNames[animalKey])
    }

    return isOnBase
  }
}
