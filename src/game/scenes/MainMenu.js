import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { getGrid } from '../layout'
import { purchasesService } from '../../services/purchases'

/**
 * The four puzzles share one shadow-matching mechanic but use different art
 * packs. Toddlers can't read "Game A/B/C/D", so each is shown as a big colourful
 * card with a picture of what's inside (a toy, a hero, a face, a fruit).
 *
 * Colours form a balanced quartet — warm orange, cool purple, warm pink, cool
 * green — so the 2×2 grid in portrait reads as a satisfying complementary
 * pattern rather than four random colours.
 */
// `free: true` packs are always playable. Premium packs show a lock badge
// until the toddler's parent unlocks all puzzles via the Paywall scene.
// Picked: Toys (cartoon taste) + Numbers (educational taste). Heroes,
// Faces, Fruits, Letters are the "more variety" upsell.
const GAMES = [
  {
    label: 'Toys',
    scene: 'GameA',
    color: 0xff9f1c, // sunshine orange
    colorDark: 0xd97e00,
    darkHex: '#a85f00',
    iconKey: 'asset_animal_cartoon_a',
    iconFrame: 7, // teddy bear
    free: true
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
    iconFrame: 0,
    free: true
  },
  {
    label: 'Letters',
    scene: 'GameF',
    color: 0xffd23f, // sunshine yellow — alphabet-blocks vibe, only primary not yet used
    colorDark: 0xc99e00,
    darkHex: '#7d5d00',
    iconKey: 'asset_letters_a', // the letter "A" — instantly tells the toddler what's inside
    iconFrame: 0
  },
  {
    label: 'Shapes',
    scene: 'GameG',
    color: 0x29c7b8, // teal — last primary not yet on the menu
    colorDark: 0x127a70,
    darkHex: '#0b5b54',
    iconKey: 'asset_shapes_card_icon', // composite of triangle + circle + square (baked in Boot)
    iconFrame: 0
  },
  {
    label: 'Memory',
    scene: 'GameH',
    color: 0x5e60ce, // indigo — fresh primary, signals "thinky" / focus
    colorDark: 0x3a3c8c,
    darkHex: '#252660',
    iconKey: 'asset_memory_icon', // baked 🧠 emoji texture from Boot
    iconFrame: 0
  },
  {
    label: 'Sort',
    scene: 'GameI',
    color: 0xff6b4a, // warm coral — fresh primary, distinct from Faces pink
    colorDark: 0xb43e22,
    darkHex: '#6e2511',
    iconKey: 'asset_sort_icon', // baked tri-circle (red/blue/yellow) from Boot
    iconFrame: 0
  },
  {
    label: 'Count',
    scene: 'GameJ',
    color: 0x84cc16, // vibrant lime — distinct from Fruits' leaf green
    colorDark: 0x4d7c0f,
    darkHex: '#2e470a',
    iconKey: 'asset_count_icon', // baked 🔢 keycap-numbers emoji from Boot
    iconFrame: 0
  }
]

// Vertical scroll list — 2 cards per row, rows stack downward. Toddler
// flicks up/down to browse; any pack count works without paging chrome.
const CARDS_PER_ROW = 2
// Pointer must travel this many pixels vertically before we count it as a
// scroll instead of a tap. Toddlers are jittery; under 10px we keep the tap.
const SCROLL_THRESHOLD = 10

// Fisher-Yates. Returns a new array so the source GAMES constant stays put.
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
    // Landscape uses horizontal swipe scrolling (toddlers hold the phone
    // sideways on a couch). Portrait keeps the existing vertical scroll.
    // Decoration builders read this flag to pin themselves to the viewport
    // in landscape so they don't drift sideways with the cards.
    this.landscape = this.sWidth > this.sHeight
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

    // Rebuild the scene after a successful purchase / restore so the lock
    // icons disappear and the shuffle pool grows to include the now-unlocked
    // packs. Emitted by the Vue Paywall component.
    this._onEntitlementUpdated = () => this.scene.restart()
    EventBus.on('entitlement:updated', this._onEntitlementUpdated)
    this.events.once('shutdown', () => {
      EventBus.off('entitlement:updated', this._onEntitlementUpdated)
    })

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
    // down, like the hero image on a normal webpage. In landscape the page
    // scrolls sideways, so we pin the sun to the viewport instead — it
    // would be jarring to watch a fixed-position mascot drift left with
    // every swipe.
    const sun = this.add.container(this.sWidth * 0.2, this.sHeight * 0.135).setDepth(1)
    if (this.landscape) sun.setScrollFactor(0)

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
      if (this.landscape) cloud.setScrollFactor(0)
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
      if (this.landscape) star.setScrollFactor(0)
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
    // Landscape lifts the pill 15% of screen height higher so it clears the
    // single-row cards completely and sits up near the sky instead of
    // hovering over the icons.
    const cy = this.sHeight * (this.landscape ? 0.155 : 0.255)
    // Pill scrolls at full speed with the cards in portrait — like a
    // regular webpage hero header that leaves the viewport when you scroll
    // past it. In landscape the page scrolls sideways and the pill pins to
    // the viewport so it doesn't slide off with every swipe.
    // Depth lower than the cards (5) so the pill renders BEHIND any card
    // that overlaps it during the scroll — otherwise the pill would mount
    // on top of the cards mid-flick.
    const badge = this.add.container(cx, cy).setDepth(2)
    if (this.landscape) badge.setScrollFactor(0)

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
    this.cardsTop = this.sHeight * 0.31 // first row sits below the title pill
    const contentW = this.grid.contentWidth

    // Shuffle on every mount so the menu feels fresh each time the toddler
    // returns. Two regimes:
    //   • Premium: shuffle the full pack list (everything is playable).
    //   • Free:    shuffle ONLY the free packs and keep them at the top, so
    //              the toddler never has to scroll past locks to reach
    //              something they can actually play. Locked packs keep their
    //              original by-theme order underneath as a stable upsell row.
    const orderedGames = purchasesService.cachedFullAccess
      ? shuffle(GAMES)
      : [...shuffle(GAMES.filter((g) => g.free)), ...GAMES.filter((g) => !g.free)]

    const gapX = this.sWidth * 0.04
    const gapY = this.sHeight * 0.03

    if (this.landscape) {
      // Single horizontal row. ~4 cards fit on screen; the toddler swipes
      // left/right to reach the rest. Card dimensions match the visible-4
      // layout that was already there, just extended off-screen to the
      // right so the world is wider than the viewport.
      const visibleCols = Math.min(orderedGames.length, 4)
      const cardW = (contentW - gapX * (visibleCols - 1)) / visibleCols
      const cardH = this.sHeight * 0.65
      const startX = this.grid.contentLeft + cardW / 2
      const cy = this.cardsTop + cardH / 2

      for (let i = 0; i < orderedGames.length; i++) {
        const pos = { x: startX + i * (cardW + gapX), y: cy }
        this.createCard(orderedGames[i], pos, cardW, cardH, true, i)
      }

      // Mirror the grid's left padding on the right edge so the last card
      // doesn't slam against the camera bound at full scroll.
      const totalCardsW = cardW * orderedGames.length + gapX * (orderedGames.length - 1)
      const sidePadding = this.grid.contentLeft
      this.worldWidth = sidePadding * 2 + totalCardsW
      this.worldHeight = this.sHeight
      this.maxScrollX = Math.max(0, this.worldWidth - this.sWidth)
      this.maxScrollY = 0

      this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight)
    } else {
      // Portrait: 2-column vertical grid that scrolls down. Unchanged.
      const cols = CARDS_PER_ROW
      const rows = Math.ceil(orderedGames.length / cols)
      const visibleRows = 2
      const visibleH = this.sHeight * 0.67
      const cardW = (contentW - gapX * (cols - 1)) / cols
      const cardH = (visibleH - gapY * (visibleRows - 1)) / visibleRows
      const startX = this.grid.contentLeft + cardW / 2

      for (let i = 0; i < orderedGames.length; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const isOrphanLast = i === orderedGames.length - 1 && i % cols === 0
        const pos = isOrphanLast
          ? {
              x: this.sWidth / 2,
              y: this.cardsTop + cardH / 2 + row * (cardH + gapY)
            }
          : {
              x: startX + col * (cardW + gapX),
              y: this.cardsTop + cardH / 2 + row * (cardH + gapY)
            }
        this.createCard(orderedGames[i], pos, cardW, cardH, true, i)
      }

      // World height = bottom of last card + a touch of breathing room above
      // the home-indicator safe area. The camera scrolls within [0, worldH-vp].
      const totalCardsH = cardH * rows + gapY * (rows - 1)
      this.worldWidth = this.sWidth
      this.worldHeight = this.cardsTop + totalCardsH + this.sHeight * 0.04
      this.maxScrollX = 0
      this.maxScrollY = Math.max(0, this.worldHeight - this.sHeight)

      this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight)
    }

    if (this.maxScrollX > 0 || this.maxScrollY > 0) {
      this.installScrollGestures()
    }
  }

  // ────────────────────────────────────────────────────── scroll gestures
  //
  // Scene-level pointer handlers do scroll-vs-tap disambiguation:
  //   • Pointer movement < SCROLL_THRESHOLD on the scroll axis → still a tap
  //   • Pointer movement ≥ threshold → toddler is scrolling; tap is cancelled
  //
  // The scroll axis is decided by which `maxScroll*` is non-zero: landscape
  // scrolls horizontally (axis = 'x'), portrait vertically (axis = 'y').
  //
  // Card press uses `pointerup` (not pointerdown), so a finger can rest on
  // a card while the grid drag-scrolls without launching that level.
  installScrollGestures() {
    const horizontal = this.maxScrollX > 0
    const axis = horizontal ? 'x' : 'y'
    const camAxis = horizontal ? 'scrollX' : 'scrollY'
    const maxScroll = horizontal ? this.maxScrollX : this.maxScrollY

    let start = 0
    let startScroll = 0
    let last = 0
    let lastTime = 0
    let velocity = 0
    this.isScrolling = false
    const cam = this.cameras.main

    this.input.on('pointerdown', (pointer) => {
      start = pointer[axis]
      last = start
      lastTime = pointer.event.timeStamp || Date.now()
      startScroll = cam[camAxis]
      velocity = 0
      this.isScrolling = false
    })

    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return
      const cur = pointer[axis]
      const delta = cur - start
      if (!this.isScrolling && Math.abs(delta) >= SCROLL_THRESHOLD) {
        this.isScrolling = true
        this.tweens.killTweensOf(cam)
      }
      if (this.isScrolling) {
        // Finger pulled toward origin (delta < 0) → camera scrolls AWAY
        // from origin (reveal later content). setBounds clamps for us.
        cam[camAxis] = startScroll - delta

        const now = pointer.event.timeStamp || Date.now()
        const dt = Math.max(1, now - lastTime)
        // Negate so positive velocity = scrolling forward through the world.
        velocity = -(cur - last) / dt
        last = cur
        lastTime = now
      }
    })

    this.input.on('pointerup', () => {
      if (!this.isScrolling) return
      const flingPx = velocity * 240 // ~240ms of coast at release velocity
      const target = Phaser.Math.Clamp(cam[camAxis] + flingPx, 0, maxScroll)
      this.tweens.add({
        targets: cam,
        [camAxis]: target,
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

    // Lock badge — drawn LAST so it sits on top of the icon/label. Premium
    // packs get a small gold circle with a lock glyph in the upper-right
    // corner of the card. Hidden once the user owns the `premium`
    // entitlement (cached at boot in purchasesService).
    const isLocked = !game.free && !purchasesService.cachedFullAccess
    card.isLocked = isLocked
    if (isLocked) {
      const lockR = Math.min(w, h) * 0.14
      const lockX = w / 2 - lockR * 0.95
      const lockY = -h / 2 + lockR * 0.95
      const lockShadow = this.add.circle(lockX, lockY + lockR * 0.18, lockR, 0x000000, 0.22)
      const lockDisc = this.add.circle(lockX, lockY, lockR, 0xffffff, 0.97)
      lockDisc.setStrokeStyle(Math.max(2, lockR * 0.12), game.colorDark, 1)
      const lockGlyph = this.add
        .text(lockX, lockY + lockR * 0.05, '🔒', {
          fontSize: `${lockR * 1.1}px`
        })
        .setOrigin(0.5)
      card.add([lockShadow, lockDisc, lockGlyph])
    }

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

    // EventBus → Amplitude. Captures both locked + unlocked taps so the
    // funnel "card tapped → paywall opened" can be measured. The amplitude
    // service translates this to a `scene_view` event.
    EventBus.emit('scene:view', {
      scene: game.scene,
      label: game.label,
      locked: !!card.isLocked
    })

    // Locked premium pack → open the Vue paywall overlay (which lives above
    // the Phaser canvas). We DON'T start a Phaser scene — MainMenu stays
    // mounted underneath. When the parent closes or completes the purchase,
    // the Paywall emits 'entitlement:updated' and we rebuild this scene to
    // pick up the new lock state.
    if (card.isLocked) {
      console.log('[MainMenu] locked card pressed → emit paywall:open', game.label)
      this.playPressSound()
      this.burstStars(card.x, card.y)
      this.tweens.killTweensOf(card)
      card.setScale(1)
      this.tweens.add({
        targets: card,
        scale: 0.96,
        duration: 110,
        yoyo: true,
        ease: 'Quad.easeOut'
      })
      EventBus.emit('paywall:open')
      return
    }

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
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start(game.scene)
        )
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
