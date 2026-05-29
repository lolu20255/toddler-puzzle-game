import { EventBus } from '../EventBus'
import { Scene } from 'phaser'
import { showCelebration } from '../celebrate'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { addBackButton, addScoreBadge } from '../hud'

// HiDPI multiplier — main.js renders the canvas at innerWidth × DPR for
// crispness; hardcoded pixel constants in this scene get multiplied by DPR
// so they keep their original CSS-pixel visual size on Retina screens.
// Cap kept in sync with main.js (2× — see the memory note in main.js).
const DPR = Math.min(window.devicePixelRatio || 1, 2)

const NUM_OF_CLOUDS = 10
const NUM_OF_BIRDS = 2
const NUM_OF_ANIMALS = 9

export class GameB extends Scene {
  constructor() {
    super('GameB')

    this.emojies = ['🙉', '💩', '🚀', '😇', '🤩', '🥳', '🎸', '🎉', '🤓', '😬']
    this.label = null
    this.clouds = null
    this.animals = null
    this.birds = null
    this.baseShades = {}
    this.animalsNames = {}
    this.animalsShadows = null
    this.animalLabelObj = null
    this.animalsOnBase = new Set()
    this.score = 0
    this.packName = 'mistic_lego'
  }

  preload() {
    console.log('preload')

    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.fontSize = Math.min(this.sWidth, this.sHeight) * 0.04 // Font size proportional to screen dimensions

    for (let i = 0; i < NUM_OF_ANIMALS; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const animalKey = `animal${String.fromCharCode(65 + i)}`

      this.baseShades[animalKey] = {
        x: (this.sWidth / 6) * (col * 2 + 1),
        y: this.sHeight * 0.2 * (row + 1)
      }
    }

    const bgImage = this.add
      .image(this.sWidth / 2, this.sHeight / 2, 'background_a')
      .setOrigin(0.5)
      .setDisplaySize(this.sWidth, this.sHeight)
  }

  addAnimalLabel(animal) {
    const x = this.sWidth / 2
    const y = this.sHeight * 0.8

    this.resetAnimalLabel()

    const textConfig = {
      fontFamily: 'Bruno Ace SC',
      fontSize: 80 * DPR,
      color: '#ffffff'
    }

    // this.labelBackground = this.add.graphics()

    this.animalLabelObj = this.add.text(x, y, animal, textConfig)
    this.animalLabelObj.setPadding(20 * DPR)
    this.animalLabelObj.x = x - this.animalLabelObj.displayWidth / 2
    this.animalLabelObj.text = ''
    this.animalLabelObj.setStroke('#000', 10 * DPR)
    this.animalLabelObj.setShadow(15 * DPR, 18 * DPR, '#000000', 15 * DPR, true, true)

    let index = 0

    this.time.addEvent({
      delay: 200,
      callback: () => {
        this.animalLabelObj.text += animal[index]
        index++

        if (index === animal.length) {
          this.time.removeAllEvents()
        }
      },
      loop: true
    })
  }

  create() {
    console.log('create')

    // Ensure audio context is resumed on user interaction for iOS Safari
    this.input.on('pointerdown', () => {
      if (this.sound.context.state === 'suspended') {
        this.sound.context.resume()
      }
    })
    this.start()
    this.addBirds()
    this.addClouds()

    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)
  }

  start() {
    console.log('start')
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

  randomPosition() {
    return {
      x: Math.floor(Math.random() * (this.sWidth - 100)),
      y: Math.floor(Math.random() * (this.sHeight - 150))
    }
  }

  addBirds() {
    this.birds = this.add.group()

    this.anims.create({
      key: 'bird',
      frames: [{ key: 'frameA' }, { key: 'frameB' }],
      frameRate: 3,
      repeat: -1
    })
    for (let i = 0; i < NUM_OF_BIRDS; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight * 0.4
      const mySprite = this.add.sprite(x, y, 'frameA').setScale(2.5 * DPR).setDepth(1)

      mySprite.play('bird', true)

      let yValue = '-=500'
      let xValue = '+=500'

      this.tweens.add({
        targets: mySprite,
        x: xValue,
        repeat: -1,
        duration: 6000,
        ease: 'Power1',
        yoyo: true,
        flipX: true
      })

      this.birds.add(mySprite)
    }
  }

  addClouds() {
    const cloudTypes = ['cloud-b', 'cloud-c']
    const cloudScales = [
      Math.min(this.sWidth, this.sHeight) * 0.00012,
      Math.min(this.sWidth, this.sHeight) * 0.00016,
      Math.min(this.sWidth, this.sHeight) * 0.0002
    ]

    this.clouds = this.add.group()

    for (let i = 0; i < NUM_OF_CLOUDS; i++) {
      let cloud
      let isOverlapping

      do {
        isOverlapping = false

        const x = Math.random() * this.sWidth
        const y = Math.random() * this.sHeight * 0.4
        const cloudType = cloudTypes[Math.floor(Math.random() * cloudTypes.length)]
        const cloudScaleSize = cloudScales[Math.floor(Math.random() * cloudScales.length)]

        cloud = this.add.image(x, y, cloudType)
        cloud.setScale(cloudScaleSize)
        cloud.setDepth(0)
        cloud.setFlipX(Math.random() < 0.5) // Randomly flip the cloud on the x-axis

        // Check for overlap with existing clouds
        const existingClouds = this.clouds.getChildren()

        for (let j = 0; j < existingClouds.length; j++) {
          const existingCloud = existingClouds[j]

          if (
            Phaser.Geom.Intersects.RectangleToRectangle(
              cloud.getBounds(),
              existingCloud.getBounds()
            )
          ) {
            isOverlapping = true

            cloud.destroy()

            break
          }
        }
      } while (isOverlapping)

      this.clouds.add(cloud)
    }
  }

  addAnimalsShadow(animals) {
    this.animalsShadows = this.add.group()
    // console.log('addAnimalsShadow', animals)
    const scaleSizeShadow = Math.min(this.sWidth, this.sHeight) * 0.00071 // Scale size proportional to screen dimensions

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

    const scaleSize = Math.min(this.sWidth, this.sHeight) * 0.0007 // Scale size proportional to screen dimensions
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
      // console.log('addAnimals', `animal${String.fromCharCode(65 + index)}`)
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
      console.log('dragend')

      if (this.animalsOnBase.has(animalDragged)) {
        // Snap exactly onto the base and lock the piece — toddlers shouldn't
        // be able to drag a correctly-placed piece off again.
        const slot = gameObject.name
        gameObject.x = this.baseShades[slot].x
        gameObject.y = this.baseShades[slot].y
        gameObject.disableInteractive()

        const isFinal = this.animalsOnBase.size === animalObjects.length
        const triggerEnd = isFinal && !this.label
        if (triggerEnd) this.label = 'completing'
        const launchLevelEnd = () =>
          showLevelComplete(this, () =>
            this.scene.start(pickNextSceneExcluding('GameB'))
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
      } else {
        this.resetAnimalLabel()
      }

      if (this.animalsOnBase.size !== animalObjects.length) {
        if (this.label) {
          this.label.destroy()
          this.tweens.killTweensOf(this.label)
          this.label = null
        }
      }
    })
  }

  isAnimalOnBase(animalKey) {
    // console.log('isAnimalOnBase', animalKey)
    const scaleSizeShadowOnBase = Math.min(this.sWidth, this.sHeight) * 0.00073 // Scale size proportional to screen dimensions
    const scaleSizeShadow = Math.min(this.sWidth, this.sHeight) * 0.00071 // Scale size proportional to screen dimensions
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

  addCongratulationsText(scaleSize) {
    const emoji = this.emojies[Math.floor(Math.random() * this.emojies.length)]

    this.label = this.add
      .text(this.sWidth / 2, this.sHeight - this.sHeight / 4, `Ganaste Logan!\n${emoji}`, {
        fontFamily: 'Bruno Ace SC',
        fontSize: `${this.fontSize}px`,
        color: '#ffcc00', // A color that combines well with a typical game background
        stroke: '#000000',
        strokeThickness: 20,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(3)

    this.tweens.add({
      targets: this.label,
      scale: { from: 1, to: 1.4 },
      duration: 2000,
      ease: 'Power2',
      yoyo: true,
      onUpdate: () => {
        this.label.setFontSize(`${this.fontSize * this.label.scaleX}px`)
      },
      onComplete: () => {
        // this.score++
        // this.scoreBoard.text = `SCORE: ${this.score}`
        this.label.destroy()
        this.label = null
        this.input.removeAllListeners()

        this.resetAnimals(scaleSize)
        this.resetClouds()
        this.resetBirds()
        this.resetAnimalLabel()
        // this.resetCounters()
      }
    })
  }

  resetAnimalLabel() {
    if (this.animalLabelObj) {
      this.time.removeAllEvents()
      this.animalLabelObj.text = ''

      // this.labelBackground.destroy()
    }
  }

  resetAnimals() {
    this.animals.clear(true, true)
    this.animalsShadows.clear(true, true)
    this.animalsOnBase.clear()

    this.start()
  }

  resetClouds() {
    this.clouds.clear(true, true)

    this.addClouds()
  }

  resetBirds() {
    this.birds.clear(true, true)

    this.addBirds()
  }

  resetCounters() {
    this.score = 0
    this.scoreBoard.text = `SCORE: ${this.score}`
  }
}

