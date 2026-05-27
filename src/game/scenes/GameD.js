import { EventBus } from '../EventBus'
import { Scene } from 'phaser'
import { showCelebration } from '../celebrate'
import { addBackButton, addScoreBadge } from '../hud'

// HiDPI multiplier — main.js renders the canvas at innerWidth × DPR for
// crispness; hardcoded pixel constants in this scene get multiplied by DPR
// so they keep their original CSS-pixel visual size on Retina screens.
// Cap kept in sync with main.js (2× — see the memory note in main.js).
const DPR = Math.min(window.devicePixelRatio || 1, 2)

const NUM_OF_ANIMALS = 9

/**
 * Fruits puzzle — same shadow-matching mechanic as GameA/B/C, drawn over
 * the grass+sky background_a so the Fluent Emoji 3D fruits feel like
 * they're scattered in a sunny field.
 */
export class GameD extends Scene {
  constructor() {
    super('GameD')

    this.label = null
    this.animals = null
    this.baseShades = {}
    this.animalsNames = {}
    this.animalsShadows = null
    this.animalLabelObj = null
    this.animalsOnBase = new Set()
    this.score = 0
    this.packName = 'fruits'
  }

  preload() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.fontSize = Math.min(this.sWidth, this.sHeight) * 0.04

    for (let i = 0; i < NUM_OF_ANIMALS; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const animalKey = `animal${String.fromCharCode(65 + i)}`

      this.baseShades[animalKey] = {
        x: (this.sWidth / 6) * (col * 2 + 1),
        y: this.sHeight * 0.2 * (row + 1)
      }
    }

    this.add
      .image(this.sWidth / 2, this.sHeight / 2, 'background_a')
      .setOrigin(0.5)
      .setDisplaySize(this.sWidth, this.sHeight)
  }

  create() {
    // Unlock the audio context on the first touch (iOS Safari requirement).
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

  start() {
    this.celebrated = new Set()
    const availableAnimals = [
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
    const shuffledAnimals = availableAnimals
      .sort(() => Math.random() - 0.5)
      .slice(0, NUM_OF_ANIMALS)

    for (let index = 0; index < shuffledAnimals.length; index++) {
      const animalKey = shuffledAnimals[index]
      const animalName = `animal${String.fromCharCode(65 + index)}`
      this.animalsNames[animalName] = animalKey
    }

    this.addAnimalsShadow(shuffledAnimals)
    this.addAnimals(shuffledAnimals)
  }

  addAnimalsShadow(animals) {
    this.animalsShadows = this.add.group()
    const scaleSizeShadow = Math.min(this.sWidth, this.sHeight) * 0.00071

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
      animalShadow.setTint(0x000)
      animalShadow.setAlpha(0.7)

      this.animalsShadows.add(animalShadow)
      this[`animal${String.fromCharCode(65 + index)}Shadow`] = animalShadow
    }
  }

  addAnimals(animals) {
    this.animals = this.add.group()

    const scaleSize = Math.min(this.sWidth, this.sHeight) * 0.0007
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
        // Snap exactly onto the base and lock the piece — toddlers shouldn't
        // be able to drag a correctly-placed piece off again.
        const slot = gameObject.name
        gameObject.x = this.baseShades[slot].x
        gameObject.y = this.baseShades[slot].y
        gameObject.disableInteractive()

        if (!this.celebrated.has(animalDragged)) {
          this.celebrated.add(animalDragged)
          showCelebration(this, animalDragged)
        }

        this.sound.play('ui_match_drop', { volume: 0.55 })
        this.score++
        this.scoreBoard.setScore(this.score)
      }

      if (this.animalsOnBase.size === animalObjects.length) {
        if (!this.label) {
          const nextScene = ['GameA', 'GameB', 'GameC', 'GameD'][
            Math.floor(Math.random() * 4)
          ]
          setTimeout(() => {
            this.scene.start(nextScene)
          }, 2000)
        }
      }
    })
  }

  isAnimalOnBase(animalKey) {
    const scaleSizeShadowOnBase = Math.min(this.sWidth, this.sHeight) * 0.00073
    const scaleSizeShadow = Math.min(this.sWidth, this.sHeight) * 0.00071
    const isOnBase =
      Math.abs(this[animalKey].x - this.baseShades[animalKey].x) < 10 &&
      Math.abs(this[animalKey].y - this.baseShades[animalKey].y) < 10

    if (isOnBase) {
      this[`${animalKey}Shadow`].setTint(0x00ff00)
      this[`${animalKey}Shadow`].setTintFill(0x00ff00)
      this[`${animalKey}Shadow`].setAlpha(1)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadowOnBase)
      this.animalsOnBase.add(this.animalsNames[animalKey])
    } else {
      this[`${animalKey}Shadow`].setTint(0x000)
      this[`${animalKey}Shadow`].setAlpha(0.7)
      this[`${animalKey}Shadow`].setScale(scaleSizeShadow)
      this.animalsOnBase.delete(this.animalsNames[animalKey])
    }

    return isOnBase
  }
}
