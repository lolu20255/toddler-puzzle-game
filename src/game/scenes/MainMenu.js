import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { getGrid } from '../layout'

/**
 * The four puzzles share one shadow-matching mechanic but use different art
 * packs. Toddlers can't read "Game A/B/C/D", so each is shown as a big colourful
 * card with a picture of what's inside (a toy, a hero, a face, a fruit).
 *
 * Colours form a balanced quartet — warm orange, cool purple, warm pink, cool
 * green — so the 2×2 grid in portrait reads as a satisfying complementary
 * pattern rather than four random colours.
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
  },
  {
    label: 'Fruits',
    scene: 'GameD',
    color: 0x5fc34a, // fresh leaf green
    colorDark: 0x3d8c2f,
    darkHex: '#266b22',
    iconKey: 'asset_fruits_b', // banana — iconic, instantly recognisable, secretly hilarious
    iconFrame: 0 // ignored — fruits are loaded as individual images
  },
  {
    label: 'Numbers',
    scene: 'GameE',
    color: 0x3ba4ff, // vibrant sky blue — distinct from the warm 4 above
    colorDark: 0x1769b8,
    darkHex: '#0e4b85',
    iconKey: 'asset_numbers_a', // the digit "1" — instantly tells the toddler what's inside
    iconFrame: 0
  }
]

// Vertical scroll list — 2 cards per row, rows stack downward. Toddler
// flicks up/down to browse; any pack count works without paging chrome.
const CARDS_PER_ROW = 2
// Pointer must travel this many pixels vertically before we count it as a
// scroll instead of a tap. Toddlers are jittery; under 10px we keep the tap.
const SCROLL_THRESHOLD = 10

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
    this.grid = getGrid(this)
    this.locked = false
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.buildBackground()
    this.addSun()
    this.addClouds()
    this.addTwinkles()
    this.buildTitle()
    this.buildCards()
    this.buildSettingsButton()

    this.cameras.main.fadeIn(this.reducedMotion ? 0 : 400, 91, 182, 239)

    EventBus.emit('current-scene-ready', this)
  }

  buildBackground() {
    // Sky + grass stay pinned to the viewport (`scrollFactor: 0`) so the
    // background never "runs out" no matter how far the camera scrolls
    // through the cards. Without this, scrolling past the original viewport
    // height would reveal Phaser's clear-colour underneath.
    const g = this.add.graphics().setDepth(0).setScrollFactor(0)

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
    // With the wordmark removed, the sun is the sole branding/personality
    // element above the cards — so it grows from decoration to mascot.
    // Sized so the ray-tips never bleed off the left/top edges of the canvas.
    const r = this.minSide * 0.095
    // Sun scrolls at full speed with the rest of the page — it sits at the
    // top of the world and exits the viewport when the toddler scrolls
    // down, like the hero image on a normal webpage.
    const sun = this.add.container(this.sWidth * 0.2, this.sHeight * 0.135).setDepth(1)

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
  //
  // Lavender candy pill, deliberately on the opposite side of the colour wheel
  // from the warm-yellow sun so the two read as different "characters" instead
  // of fighting each other. Placement sits BELOW the sun's ray-tips so the
  // pill never overlaps the mascot. Same 3-D card-stack treatment as the game
  // tiles — keeps the visual language consistent across the menu.
  buildTitle() {
    const cx = this.sWidth / 2
    const cy = this.sHeight * 0.255
    // Pill scrolls at full speed with the cards — like a regular webpage
    // hero header that leaves the viewport when you scroll past it.
    // Depth lower than the cards (5) so the pill renders BEHIND any card
    // that overlaps it during the scroll — otherwise the pill would mount
    // on top of the cards mid-flick.
    const badge = this.add.container(cx, cy).setDepth(2)

    const fontSize = this.minSide * 0.075
    const text = this.add
      .text(0, 0, 'PUZZLE', {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", "Helvetica Rounded", sans-serif',
        fontSize: `${fontSize}px`,
        color: '#ffffff'
      })
      .setOrigin(0.5)
    text.setStroke('#4d2c8a', fontSize * 0.18)
    text.setShadow(0, fontSize * 0.06, 'rgba(0,0,0,0.22)', 3)

    const w = text.displayWidth + fontSize * 1.5
    const h = text.displayHeight + fontSize * 0.55
    const radius = h / 2

    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.18)
    g.fillRoundedRect(-w / 2, -h / 2 + h * 0.14, w, h, radius)
    g.fillStyle(0x7a55c8, 1) // deep purple — the 3-D lip
    g.fillRoundedRect(-w / 2, -h / 2 + h * 0.1, w, h, radius)
    g.fillStyle(0xb594ff, 1) // lavender — the top face
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
    g.fillStyle(0xffffff, 0.3) // glossy top highlight strip
    g.fillRoundedRect(-w / 2 + w * 0.06, -h / 2 + h * 0.12, w * 0.88, h * 0.3, radius * 0.6)
    badge.add(g)

    // A small pink heart bookending each side — colour-distinct from the
    // yellow sun's existing twinkles, ties to Faces (pink) on the cards.
    const heartR = h * 0.18
    ;[-1, 1].forEach((dir) => {
      const heart = this.add.graphics()
      const hx = dir * (w / 2 - heartR * 0.5)
      const hy = -h * 0.02
      heart.fillStyle(0xff7fb5, 1)
      heart.fillCircle(hx - heartR * 0.35, hy - heartR * 0.2, heartR * 0.45)
      heart.fillCircle(hx + heartR * 0.35, hy - heartR * 0.2, heartR * 0.45)
      heart.fillTriangle(
        hx - heartR * 0.78, hy - heartR * 0.05,
        hx + heartR * 0.78, hy - heartR * 0.05,
        hx, hy + heartR * 0.85
      )
      badge.add(heart)
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: heart,
          scale: 1.18,
          duration: 900,
          delay: dir === -1 ? 0 : 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      }
    })

    badge.add(text)

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: badge,
        y: cy - h * 0.12,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }
  }

  // --------------------------------------------------------------------- cards
  //
  // Cards live directly in the scene at world coordinates. The CAMERA scrolls
  // through the world (instead of moving a container with a mask) — that's
  // the canonical Phaser 3 pattern for menus and it brings two big wins:
  //
  //   1. `setScrollFactor` parallax — the title pill, sun, and clouds can
  //      drift at different rates as the toddler scrolls, giving the menu a
  //      continuous-page feel instead of a fixed-header-over-list look.
  //   2. No mask hacks — masks affect rendering but NOT hit-testing, so a
  //      masked-out card scrolled above the title was still tappable from
  //      the empty title area. With camera scroll the input system already
  //      uses screen coords; off-screen cards correctly receive no input.

  buildCards() {
    const landscape = this.sWidth > this.sHeight
    this.cardsTop = this.sHeight * 0.31 // first row sits below the title pill
    const contentW = this.grid.contentWidth

    const cols = landscape ? Math.min(GAMES.length, 4) : CARDS_PER_ROW
    const rows = Math.ceil(GAMES.length / cols)
    const gapX = this.sWidth * 0.04
    const gapY = this.sHeight * 0.03

    const visibleRows = landscape ? 1 : 2
    const visibleH = this.sHeight * 0.67
    const cardW = (contentW - gapX * (cols - 1)) / cols
    const cardH = (visibleH - gapY * (visibleRows - 1)) / visibleRows

    const startX = this.grid.contentLeft + cardW / 2

    for (let i = 0; i < GAMES.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const isOrphanLast = i === GAMES.length - 1 && i % cols === 0
      const pos = isOrphanLast
        ? {
            x: this.sWidth / 2,
            y: this.cardsTop + cardH / 2 + row * (cardH + gapY)
          }
        : {
            x: startX + col * (cardW + gapX),
            y: this.cardsTop + cardH / 2 + row * (cardH + gapY)
          }
      this.createCard(GAMES[i], pos, cardW, cardH, true, i)
    }

    // World height = bottom of last card + a touch of breathing room above
    // the home-indicator safe area. The camera scrolls within [0, worldH-vp].
    const totalCardsH = cardH * rows + gapY * (rows - 1)
    this.worldHeight = this.cardsTop + totalCardsH + this.sHeight * 0.04
    this.maxScrollY = Math.max(0, this.worldHeight - this.sHeight)

    // Lock the camera horizontally + clamp scrollY to the world bounds.
    this.cameras.main.setBounds(0, 0, this.sWidth, this.worldHeight)

    if (this.maxScrollY > 0) {
      this.installScrollGestures()
    }
  }

  // ────────────────────────────────────────────────────── scroll gestures
  //
  // Scene-level pointer handlers do scroll-vs-tap disambiguation:
  //   • Pointer movement < SCROLL_THRESHOLD on the Y axis → still a tap
  //   • Pointer movement ≥ threshold → toddler is scrolling; tap is cancelled
  //
  // Card press uses `pointerup` (not pointerdown), so a finger can rest on
  // a card while the grid drag-scrolls without launching that level.
  installScrollGestures() {
    let startY = 0
    let startScrollY = 0
    let lastY = 0
    let lastTime = 0
    let velocity = 0
    this.isScrolling = false
    const cam = this.cameras.main

    this.input.on('pointerdown', (pointer) => {
      startY = pointer.y
      lastY = pointer.y
      lastTime = pointer.event.timeStamp || Date.now()
      startScrollY = cam.scrollY
      velocity = 0
      this.isScrolling = false
    })

    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return
      const dy = pointer.y - startY
      if (!this.isScrolling && Math.abs(dy) >= SCROLL_THRESHOLD) {
        this.isScrolling = true
        this.tweens.killTweensOf(cam)
      }
      if (this.isScrolling) {
        // Finger pulled UP (dy < 0) → camera scrolls DOWN (reveal lower
        // content). camera.scrollY = how far down the world we are.
        cam.scrollY = startScrollY - dy
        // setBounds clamps cam.scrollY for us — no manual clamp needed.

        const now = pointer.event.timeStamp || Date.now()
        const dt = Math.max(1, now - lastTime)
        // Negate so positive velocity = scrolling down (camera scrollY up).
        velocity = -(pointer.y - lastY) / dt
        lastY = pointer.y
        lastTime = now
      }
    })

    this.input.on('pointerup', () => {
      if (!this.isScrolling) return
      const flingPx = velocity * 240 // ~240ms of coast at release velocity
      const targetY = Phaser.Math.Clamp(
        cam.scrollY + flingPx,
        0,
        this.maxScrollY
      )
      this.tweens.add({
        targets: cam,
        scrollY: targetY,
        duration: this.reducedMotion ? 0 : 360,
        ease: 'Quad.easeOut'
      })
      // Keep `isScrolling` true for one more frame so a card pointerup that
      // also fired during this gesture sees the flag and skips the press.
      this.time.delayedCall(50, () => { this.isScrolling = false })
    })
  }

  // ──────────────────────────────────────────────────────────── settings cog
  //
  // Gear icon in the top-right — iOS/Android convention for "secondary
  // settings" so parents find it instinctively.
  //
  // Implementation note: the visible gear lives in a Container (so it can be
  // animated as a unit) but the INTERACTIVE element is a separate
  // transparent Phaser Rectangle layered on top. Container input has been
  // unreliable in this Phaser/iOS WebView combination — taps near the top
  // of the canvas occasionally never fire `pointerdown`, even though
  // `input.hitTestPointer` finds the container. A flat `Rectangle` is
  // Phaser's most battle-tested interactive primitive and always receives
  // touch events. The Rectangle also lets us push the hit area well beyond
  // the visible gear without distorting the icon's hover animations.
  buildSettingsButton() {
    // Lock to the shared grid so the cog mirrors the back button used in
    // Settings + every game scene — same radius, same y, same edge alignment.
    const haloR = this.grid.iconR
    const gearR = haloR * 0.62
    const hitR = haloR * 1.6
    const cx = this.grid.contentRight - haloR // right edge of cog at contentRight
    const cy = this.grid.navY

    // ── Visuals (animated, NOT interactive). Sticky to viewport via
    // scrollFactor 0 so the cog is always accessible even after scrolling.
    const visuals = this.add.container(cx, cy).setDepth(20).setScrollFactor(0)

    const shadow = this.add.circle(0, haloR * 0.14, haloR, 0x000000, 0.18)
    visuals.add(shadow)

    const halo = this.add.circle(0, 0, haloR, 0xffffff, 0.95)
    halo.setStrokeStyle(Math.max(2, haloR * 0.09), 0xe8881c, 0.8)
    visuals.add(halo)

    const g = this.add.graphics()
    const teeth = 8
    const innerR = gearR * 0.72
    const outerR = gearR
    const halfAngle = (Math.PI * 2 / teeth) * 0.28
    g.fillStyle(0x5a3a1a, 1)
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2
      const p1 = { x: Math.cos(a - halfAngle) * innerR, y: Math.sin(a - halfAngle) * innerR }
      const p2 = { x: Math.cos(a + halfAngle) * innerR, y: Math.sin(a + halfAngle) * innerR }
      const p3 = { x: Math.cos(a + halfAngle * 0.7) * outerR, y: Math.sin(a + halfAngle * 0.7) * outerR }
      const p4 = { x: Math.cos(a - halfAngle * 0.7) * outerR, y: Math.sin(a - halfAngle * 0.7) * outerR }
      g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
      g.fillTriangle(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y)
    }
    g.fillCircle(0, 0, innerR)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(0, 0, gearR * 0.32)
    visuals.add(g)

    // ── Hit zone (a transparent Rectangle on top — the only interactive bit)
    const hit = this.add
      .rectangle(cx, cy, hitR * 2, hitR * 2, 0x000000, 0)
      .setDepth(21)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })

    hit.on('pointerover', () => {
      if (!this.locked) this.tweens.add({ targets: visuals, scale: 1.06, duration: 140 })
    })
    hit.on('pointerout', () => {
      if (!this.locked) this.tweens.add({ targets: visuals, scale: 1, duration: 140 })
    })
    hit.on('pointerdown', () => {
      if (this.locked) return
      this.locked = true
      this.tweens.add({
        targets: g,
        angle: 90,
        duration: 220,
        ease: 'Quad.easeOut'
      })
      this.tweens.add({
        targets: visuals,
        scale: 0.9,
        duration: 110,
        yoyo: true,
        ease: 'Quad.easeOut'
      })
      this.cameras.main.fadeOut(this.reducedMotion ? 0 : 220, 91, 182, 239)
      this.cameras.main.once('camerafadeoutcomplete', () =>
        this.scene.start('Settings')
      )
    })
  }

  createCard(game, pos, w, h, landscape, index) {
    // Cards live directly in the scene at world coordinates. The camera
    // (scrollFactor 1 by default) handles scrolling — no parent container,
    // no mask needed.
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
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", "Helvetica Rounded", sans-serif',
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
    // Use pointerup (not pointerdown) so the toddler can rest a finger on
    // a card and still drag-scroll the grid without launching that level.
    // With camera scroll, off-screen cards correctly receive no input
    // (Phaser hit-tests in screen space, not world space), so no viewport
    // check is needed — just the scroll-vs-tap disambiguation.
    card.on('pointerup', () => {
      if (this.isScrolling) return
      this.pressCard(card, game)
    })

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
        this.sound.play('ui_menu_tap', { volume: 0.6 })
      }
    } catch (e) {
      /* audio is a nice-to-have; never block navigation on it */
    }
  }

  changeScene(sceneName) {
    this.scene.start(sceneName)
  }
}
