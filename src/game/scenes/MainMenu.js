import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'

/**
 * The three puzzles share one shadow-matching mechanic but use different art
 * packs. Toddlers can't read "Game A/B/C", so each is shown as a big colourful
 * card with a picture of what's inside (a toy, a hero, a face).
 */
const GAMES = [
  {
    label: 'Toys',
    scene: 'GameA',
    color: 0xff9f1c, // sunshine orange
    colorDark: 0xd97e00,
    darkHex: '#a85f00',
    iconKey: 'asset_animal_cartoon_a',
    iconFrame: 7 // teddy bear
  },
  {
    label: 'Heroes',
    scene: 'GameB',
    color: 0x9b5de5, // royal purple
    colorDark: 0x7838c8,
    darkHex: '#5b2a9c',
    iconKey: 'asset_mistic_lego_a',
    iconFrame: 5 // elf hero
  },
  {
    label: 'Faces',
    scene: 'GameC',
    color: 0xff5da2, // bubblegum pink
    colorDark: 0xdb3f82,
    darkHex: '#b32a63',
    iconKey: 'asset_emojis_lego_a',
    iconFrame: 0 // big laughing face
  }
]

export class MainMenu extends Scene {
  constructor() {
    super('MainMenu')
  }

  preload() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.locked = false
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.buildBackground()
    this.addSun()
    this.addClouds()
    this.addTwinkles()
    this.buildTitle()
    this.buildCards()

    this.cameras.main.fadeIn(this.reducedMotion ? 0 : 400, 91, 182, 239)

    EventBus.emit('current-scene-ready', this)
  }

  // ---------------------------------------------------------------- background

  buildBackground() {
    const g = this.add.graphics().setDepth(0)

    // Sky: a soft vertical gradient so the cards (warm colours) pop against it.
    const skyTop = 0x5bb6ef
    const skyBottom = 0xc6ecff
    g.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    // Two rounded grass hills along the bottom edge.
    const hillW = this.sWidth * 1.6
    g.fillStyle(0x9bd34f, 1)
    g.fillEllipse(this.sWidth * 0.28, this.sHeight + this.sWidth * 0.18, hillW, this.sWidth * 0.9)
    g.fillStyle(0x7cc242, 1)
    g.fillEllipse(this.sWidth * 0.78, this.sHeight + this.sWidth * 0.24, hillW, this.sWidth * 0.78)
  }

  addSun() {
    const r = this.minSide * 0.07
    const sun = this.add.container(this.sWidth * 0.13, this.sHeight * 0.11).setDepth(1)

    // Rays drawn around the origin so the graphics object can spin in place.
    const rays = this.add.graphics()
    rays.fillStyle(0xffd23f, 1)
    const rayCount = 9
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2
      const inner = r * 1.15
      const outer = r * 1.75
      rays.fillTriangle(
        Math.cos(a) * outer,
        Math.sin(a) * outer,
        Math.cos(a - 0.22) * inner,
        Math.sin(a - 0.22) * inner,
        Math.cos(a + 0.22) * inner,
        Math.sin(a + 0.22) * inner
      )
    }

    const disc = this.add.circle(0, 0, r, 0xffd23f)
    const glow = this.add.circle(-r * 0.28, -r * 0.28, r * 0.42, 0xffe78a)

    // A friendly smiley face on the sun.
    const face = this.add.graphics()
    face.fillStyle(0xc9821b, 1)
    face.fillCircle(-r * 0.32, -r * 0.08, r * 0.13)
    face.fillCircle(r * 0.32, -r * 0.08, r * 0.13)
    face.lineStyle(r * 0.14, 0xc9821b, 1)
    face.beginPath()
    face.arc(0, r * 0.04, r * 0.48, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155), false)
    face.strokePath()

    sun.add([rays, disc, glow, face])

    if (!this.reducedMotion) {
      this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1, ease: 'Linear' })
      this.tweens.add({
        targets: sun,
        scale: 1.06,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }
  }

  addClouds() {
    const clouds = [
      { y: 0.10, scale: 1.0, duration: 42000 },
      { y: 0.30, scale: 0.65, duration: 58000 },
      { y: 0.22, scale: 0.82, duration: 50000 }
    ]

    clouds.forEach((c, i) => {
      const cloud = this.makeCloud(c.scale * (this.minSide / 720)).setDepth(1)
      cloud.y = this.sHeight * c.y
      const startX = -this.sWidth * 0.2 - i * this.sWidth * 0.45
      cloud.x = this.reducedMotion ? this.sWidth * (0.2 + i * 0.3) : startX

      if (!this.reducedMotion) {
        this.tweens.add({
          targets: cloud,
          x: this.sWidth * 1.25,
          duration: c.duration,
          repeat: -1,
          ease: 'Linear'
        })
      }
    })
  }

  makeCloud(scale) {
    const cloud = this.add.container(0, 0)
    const puffs = [
      [0, 0, 60],
      [48, 14, 44],
      [-46, 16, 40],
      [10, -22, 42]
    ]
    puffs.forEach(([x, y, r]) => {
      cloud.add(this.add.circle(x * scale, y * scale, r * scale, 0xffffff))
    })
    cloud.setAlpha(0.95)
    return cloud
  }

  addTwinkles() {
    const spots = [
      [0.78, 0.10],
      [0.9, 0.22],
      [0.66, 0.05],
      [0.32, 0.16],
      [0.5, 0.07]
    ]
    spots.forEach(([fx, fy], i) => {
      const r = this.minSide * 0.012
      const star = this.add
        .star(this.sWidth * fx, this.sHeight * fy, 4, r * 0.4, r, 0xffffff)
        .setDepth(1)
        .setAlpha(0.85)
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: star,
          scale: 0.3,
          alpha: 0.3,
          duration: 900,
          delay: i * 350,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      }
    })
  }

  // --------------------------------------------------------------------- title

  buildTitle() {
    const cx = this.sWidth / 2
    const cy = this.sHeight * 0.155
    const badge = this.add.container(cx, cy).setDepth(10)

    const fontSize = this.minSide * 0.13
    const text = this.add
      .text(0, 0, 'PUZZLE', {
        fontFamily: 'Fredoka',
        fontSize: `${fontSize}px`,
        color: '#ffffff'
      })
      .setOrigin(0.5)
    text.setStroke('#e8881c', fontSize * 0.16)
    text.setShadow(0, fontSize * 0.07, 'rgba(0,0,0,0.25)', 4)

    const w = text.displayWidth + fontSize * 1.5
    const h = text.displayHeight + fontSize * 0.55
    const radius = h / 2

    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.16)
    g.fillRoundedRect(-w / 2, -h / 2 + h * 0.14, w, h, radius)
    g.fillStyle(0xf0a91c, 1)
    g.fillRoundedRect(-w / 2, -h / 2 + h * 0.1, w, h, radius)
    g.fillStyle(0xffce3a, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
    g.fillStyle(0xffffff, 0.28)
    g.fillRoundedRect(-w / 2 + w * 0.06, -h / 2 + h * 0.12, w * 0.88, h * 0.3, radius * 0.6)
    badge.add(g)

    // A small star dotting each rounded end of the pill.
    const starR = h * 0.2
    ;[-1, 1].forEach((dir) => {
      const star = this.add
        .star(dir * (w / 2 - starR * 0.3), -h * 0.04, 5, starR * 0.45, starR, 0xffffff)
        .setAlpha(0.9)
      badge.add(star)
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: star,
          angle: dir * 360,
          duration: 11000,
          repeat: -1,
          ease: 'Linear'
        })
      }
    })

    badge.add(text)

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: badge,
        y: cy - h * 0.14,
        duration: 1900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }
  }

  // --------------------------------------------------------------------- cards

  buildCards() {
    const landscape = this.sWidth > this.sHeight
    const top = this.sHeight * 0.28
    const bottom = this.sHeight * 0.93
    const regionH = bottom - top

    let cardW, cardH
    const positions = []

    if (landscape) {
      const gap = this.sWidth * 0.04
      cardW = Math.min((this.sWidth * 0.9 - gap * 2) / 3, regionH * 0.82)
      cardH = cardW * 1.18
      const totalW = cardW * 3 + gap * 2
      const startX = this.sWidth / 2 - totalW / 2 + cardW / 2
      const cy = top + regionH / 2
      for (let i = 0; i < 3; i++) positions.push({ x: startX + i * (cardW + gap), y: cy })
    } else {
      const gap = regionH * 0.07
      cardH = (regionH - gap * 2) / 3
      cardW = Math.min(this.sWidth * 0.82, cardH * 3.4)
      const startY = top + cardH / 2
      for (let i = 0; i < 3; i++) positions.push({ x: this.sWidth / 2, y: startY + i * (cardH + gap) })
    }

    GAMES.forEach((game, i) => {
      this.createCard(game, positions[i], cardW, cardH, landscape, i)
    })
  }

  createCard(game, pos, w, h, landscape, index) {
    const card = this.add.container(pos.x, pos.y).setDepth(5)
    card.baseY = pos.y

    const radius = Math.min(w, h) * 0.24

    // Body: stacked layers give a soft drop shadow + a chunky 3D bottom lip.
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.18)
    g.fillRoundedRect(-w / 2, -h / 2 + h * 0.09, w, h, radius)
    g.fillStyle(game.colorDark, 1)
    g.fillRoundedRect(-w / 2, -h / 2 + h * 0.06, w, h, radius)
    g.fillStyle(game.color, 1)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
    g.fillStyle(0xffffff, 0.22)
    g.fillRoundedRect(-w / 2 + w * 0.06, -h / 2 + h * 0.06, w * 0.88, h * 0.28, radius * 0.65)
    g.lineStyle(Math.max(3, w * 0.018), game.colorDark, 1)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
    card.add(g)

    // White "window" circle so the picture pops off the coloured card.
    let winR, iconX, iconY
    if (landscape) {
      winR = w * 0.33
      iconX = 0
      iconY = -h * 0.13
    } else {
      winR = h * 0.34
      iconX = -w / 2 + h * 0.52
      iconY = -h * 0.04
    }
    const win = this.add.circle(iconX, iconY, winR, 0xffffff)
    win.setStrokeStyle(Math.max(3, winR * 0.07), game.colorDark, 0.4)
    card.add(win)

    // Game picture, scaled to sit comfortably inside the window.
    const icon = this.add.image(iconX, iconY, game.iconKey, game.iconFrame)
    const iconScale = (winR * 1.55) / Math.max(icon.width, icon.height || icon.width)
    icon.setScale(iconScale)
    card.add(icon)

    // Small label (mainly for parents — toddlers go by the picture).
    let labelX, labelY, labelSize, labelOrigin
    if (landscape) {
      labelX = 0
      labelY = iconY + winR + h * 0.14
      labelSize = h * 0.13
      labelOrigin = 0.5
    } else {
      labelX = iconX + winR + w * 0.06
      labelY = 0
      labelSize = h * 0.26
      labelOrigin = 0
    }
    const label = this.add
      .text(labelX, labelY, game.label, {
        fontFamily: 'Fredoka',
        fontSize: `${labelSize}px`,
        color: '#ffffff'
      })
      .setOrigin(labelOrigin, 0.5)
    label.setStroke(game.darkHex, labelSize * 0.16)
    card.add(label)

    // Interaction.
    card.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    })
    card.on('pointerover', () => {
      if (!this.locked) this.tweens.add({ targets: card, scale: 1.05, duration: 150 })
    })
    card.on('pointerout', () => {
      if (!this.locked) this.tweens.add({ targets: card, scale: 1, duration: 150 })
    })
    card.on('pointerdown', () => this.pressCard(card, game))

    // Entrance pop + gentle idle bobbing.
    if (this.reducedMotion) {
      card.setScale(1)
    } else {
      card.setScale(0)
      this.tweens.add({
        targets: card,
        scale: 1,
        duration: 420,
        delay: 200 + index * 130,
        ease: 'Back.out',
        onComplete: () => {
          this.tweens.add({
            targets: card,
            y: card.baseY - h * 0.045,
            duration: 1500,
            delay: index * 200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut'
          })
        }
      })
    }
  }

  pressCard(card, game) {
    if (this.locked) return
    this.locked = true

    this.playPressSound()
    this.burstStars(card.x, card.y)

    // Stop idle motion, then a quick squash-and-pop before changing scene.
    this.tweens.killTweensOf(card)
    card.setScale(1)
    this.tweens.add({
      targets: card,
      scale: 0.86,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.cameras.main.fadeOut(this.reducedMotion ? 0 : 260, 91, 182, 239)
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(game.scene))
      }
    })
  }

  burstStars(x, y) {
    if (this.reducedMotion) return
    const colors = [0xffd23f, 0xffffff, 0xff8fc7, 0x8be3ff]
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const size = this.minSide * 0.025
      const star = this.add
        .star(x, y, 5, size * 0.45, size, colors[i % colors.length])
        .setDepth(20)
      const dist = this.minSide * 0.18
      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        angle: 220,
        scale: 0,
        alpha: 0,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy()
      })
    }
  }

  playPressSound() {
    try {
      const ctx = this.sound.context
      if (ctx && ctx.state === 'suspended') ctx.resume()
      if (this.cache.audio.exists('sfx_collect')) {
        this.sound.play('sfx_collect', { volume: 0.5 })
      }
    } catch (e) {
      /* audio is a nice-to-have; never block navigation on it */
    }
  }

  changeScene(sceneName) {
    this.scene.start(sceneName)
  }
}
