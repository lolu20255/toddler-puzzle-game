import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { settings } from '../../services/settings'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Build the loading screen from procedural graphics ONLY (no images,
    // no loaded textures), since this paints BEFORE preload assets arrive.
    // The visual language matches MainMenu so the load feels like an
    // anteroom of the actual game, not a separate splash.
    this.cameras.main.setBackgroundColor('#5bb6ef')
    this._buildLoaderBackground()
    this._buildLoaderClouds()
    this._buildLoaderTwinkles()
    this._buildLoaderSun()
    this._buildLoaderTitle()
    this._buildLoaderBar()

    // Load every game asset here in preload, unconditionally.
    //
    // The original Boot.js gated `loadGameAssets()` behind WebFont's `active`
    // callback. On a real iOS device / simulator the Google Fonts CDN often
    // fires `inactive` instead (cold network, ATS, timeout), and the assets
    // were never queued at all — leaving every scene with Phaser's __MISSING
    // texture (the green-outlined diagonal-line square).
    this.loadGameAssets()
  }

  // ────────────────────────────────────────────────────── loader visuals
  //
  // Every helper below draws with Phaser primitives only so the loader is
  // ready on the first frame, before any image/font has finished downloading.
  // Reduced-motion guards strip the looping tweens.

  _buildLoaderBackground() {
    const g = this.add.graphics().setDepth(0)
    // Soft vertical sky gradient (same hues as MainMenu).
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

  _buildLoaderClouds() {
    // Three puffy clouds that gently sway in place. Full drift across the
    // viewport would be over-the-top for a 1 to 2 second load.
    const clouds = [
      { x: 0.18, y: 0.16, scale: 0.85, delay: 0 },
      { x: 0.78, y: 0.24, scale: 0.65, delay: 300 },
      { x: 0.55, y: 0.10, scale: 1.0, delay: 600 }
    ]
    clouds.forEach((c) => {
      const cloud = this._makeLoaderCloud(c.scale * (this.minSide / 720)).setDepth(1)
      cloud.x = this.sWidth * c.x
      cloud.y = this.sHeight * c.y
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: cloud,
          x: cloud.x + this.sWidth * 0.04,
          duration: 3600,
          delay: c.delay,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      }
    })
  }

  _makeLoaderCloud(scale) {
    const cloud = this.add.container(0, 0)
    const puffs = [[0, 0, 60], [48, 14, 44], [-46, 16, 40], [10, -22, 42]]
    puffs.forEach(([x, y, r]) => {
      cloud.add(this.add.circle(x * scale, y * scale, r * scale, 0xffffff))
    })
    cloud.setAlpha(0.95)
    return cloud
  }

  _buildLoaderTwinkles() {
    const spots = [[0.86, 0.13], [0.30, 0.08], [0.68, 0.20], [0.12, 0.28]]
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
          delay: i * 280,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      }
    })
  }

  _buildLoaderSun() {
    // Same procedural mascot as MainMenu, scaled smaller and centered above
    // the bar so the toddler sees a familiar face the moment the app opens.
    const r = this.minSide * 0.085
    const sun = this.add.container(this.sWidth / 2, this.sHeight * 0.32).setDepth(2)

    const rays = this.add.graphics()
    rays.fillStyle(0xffd23f, 1)
    const rayCount = 9
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2
      const inner = r * 1.15
      const outer = r * 1.75
      rays.fillTriangle(
        Math.cos(a) * outer, Math.sin(a) * outer,
        Math.cos(a - 0.22) * inner, Math.sin(a - 0.22) * inner,
        Math.cos(a + 0.22) * inner, Math.sin(a + 0.22) * inner
      )
    }
    const disc = this.add.circle(0, 0, r, 0xffd23f)
    const glow = this.add.circle(-r * 0.28, -r * 0.28, r * 0.42, 0xffe78a)
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
      this.tweens.add({ targets: rays, angle: 360, duration: 30000, repeat: -1, ease: 'Linear' })
      this.tweens.add({
        targets: sun,
        scale: 1.06,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }
  }

  _buildLoaderTitle() {
    // "LOADING" wordmark + three bouncing dots. Fredoka may still be in
    // flight on first ever launch; the system fallback (Arial Rounded MT
    // Bold / Helvetica Rounded) reads cleanly enough for the brief wait.
    const cx = this.sWidth / 2
    const cy = this.sHeight * 0.5
    const fontSize = this.minSide * 0.075
    const label = this.add
      .text(cx, cy, 'LOADING', {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", "Helvetica Rounded", sans-serif',
        fontSize: `${fontSize}px`,
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setDepth(3)
    label.setStroke('#4d2c8a', fontSize * 0.18)
    label.setShadow(0, fontSize * 0.07, 'rgba(0,0,0,0.22)', 3)

    const dotR = fontSize * 0.13
    const dotsStartX = label.x + label.displayWidth / 2 + dotR * 2
    const dotBaseY = cy + fontSize * 0.05
    for (let i = 0; i < 3; i++) {
      const dot = this.add
        .circle(dotsStartX + i * dotR * 3, dotBaseY, dotR, 0xffffff)
        .setDepth(3)
      dot.setStrokeStyle(Math.max(1, dotR * 0.25), 0x4d2c8a, 1)
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: dot,
          y: dotBaseY - dotR * 2.2,
          duration: 420,
          delay: i * 140,
          yoyo: true,
          repeat: -1,
          ease: 'Quad.easeInOut'
        })
      }
    }
  }

  _buildLoaderBar() {
    // Claymorphic 3D progress pill: shadow + dark lip + lavender face +
    // recessed channel + warm-yellow fill with a glossy highlight strip.
    // Mirrors the PUZZLE title pill so the loader and menu share an identity.
    const barW = this.sWidth * 0.7
    const barH = Math.max(22, this.minSide * 0.055)
    const cx = this.sWidth / 2
    const cy = this.sHeight * 0.62
    const radius = barH / 2

    const track = this.add.graphics().setDepth(2)
    track.fillStyle(0x000000, 0.18)
    track.fillRoundedRect(cx - barW / 2, cy - barH / 2 + barH * 0.18, barW, barH, radius)
    track.fillStyle(0x4d2c8a, 1) // dark purple lip
    track.fillRoundedRect(cx - barW / 2, cy - barH / 2 + barH * 0.12, barW, barH, radius)
    track.fillStyle(0x7a55c8, 1) // lavender face
    track.fillRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, radius)
    track.fillStyle(0x4d2c8a, 0.55) // recessed channel
    track.fillRoundedRect(
      cx - barW / 2 + barH * 0.15,
      cy - barH / 2 + barH * 0.18,
      barW - barH * 0.3,
      barH * 0.72,
      radius * 0.7
    )

    // Fill bar drawn dynamically on every `progress` event.
    const fillInsetX = barH * 0.15
    const fillInsetY = barH * 0.2
    const fillMaxW = barW - fillInsetX * 2
    const fillH = barH * 0.7
    const fillRadius = fillH / 2
    const fillStartX = cx - barW / 2 + fillInsetX
    const fillY = cy - barH / 2 + fillInsetY

    const fill = this.add.graphics().setDepth(3)
    const redrawFill = (p) => {
      fill.clear()
      if (p <= 0) return
      const w = Math.max(fillH, fillMaxW * p)
      // soft inner shadow under the fill for depth
      fill.fillStyle(0xb45309, 0.4)
      fill.fillRoundedRect(fillStartX, fillY + fillH * 0.1, w, fillH, fillRadius)
      // main warm orange fill
      fill.fillStyle(0xff9f1c, 1)
      fill.fillRoundedRect(fillStartX, fillY, w, fillH, fillRadius)
      // glossy yellow highlight strip on top
      fill.fillStyle(0xffd23f, 0.9)
      fill.fillRoundedRect(
        fillStartX + fillH * 0.18,
        fillY + fillH * 0.12,
        Math.max(0, w - fillH * 0.36),
        fillH * 0.35,
        fillRadius * 0.7
      )
    }
    redrawFill(0)
    this.load.on('progress', redrawFill)
  }

  create() {
    // Fonts are loaded via <link rel="stylesheet"> in index.html (standard
    // browser font loading, no WebFont.js). Wait briefly for them to arrive
    // so Phaser bakes them into text textures correctly — but never sit on
    // the Boot scene longer than 2s if the CDN is unreachable.
    const proceed = () => {
      // Generate the procedural packs (numbers + letters + shapes) NOW,
      // after fonts are ready, so the baked-in glyphs use Fredoka — not the
      // system fallback that would render them with whatever sans-serif
      // happens to be available. Shapes don't need fonts but bake here too
      // for consistency.
      this.generateNumberTextures()
      this.generateLetterTextures()
      this.generateShapeTextures()
      this.generateShapesCardIcon()
      this.generateMemoryIcon()
      this.generateSortIcon()
      this.generateCountIcon()

      // First-launch parent onboarding gate. If the parent hasn't completed
      // the welcome → name → language flow yet, hold here, let the Vue
      // Onboarding overlay render (it lives in App.vue and listens for
      // `onboarding:open`), then move to MainMenu when it signals done.
      if (!settings.onboardingComplete()) {
        EventBus.once('onboarding:complete', () => this.scene.start('MainMenu'))
        EventBus.emit('onboarding:open')
        return
      }

      this.scene.start('MainMenu')
    }
    const fontsReady =
      typeof document !== 'undefined' && document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve()
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2000))]).then(
      proceed
    )
  }

  // Rainbow palette + matching dark strokes shared by both procedural glyph
  // packs (numbers + letters). 1→7 follow rainbow order, then pink + teal
  // for slots 8 + 9.
  static GLYPH_FILLS = [
    '#ff5d5d', '#ff9f1c', '#ffd23f', '#5fc34a', '#3ba4ff',
    '#6c4ad6', '#9b5de5', '#ff5da2', '#29c7b8'
  ]
  static GLYPH_STROKES = [
    '#7a1f1f', '#7a4400', '#856100', '#1a4f17', '#0e4b85',
    '#2a1a70', '#421e7a', '#871a4a', '#0b5b54'
  ]

  /**
   * Bake nine `asset_<pack>_<a-i>` textures — chunky cookie-cutter glyphs,
   * no background chip. Each glyph IS the shape so a toddler learns to
   * recognise the silhouette of "1", "A", "B"… and the matching shadow on
   * the level scene is the same silhouette ghosted out behind the drop slot.
   *
   * Shared by `generateNumberTextures()` and `generateLetterTextures()` so
   * the two packs render with identical visual treatment.
   */
  _generateGlyphPack(packKey, glyphs) {
    const size = 240
    const fontSize = Math.round(size * 0.88)
    const fills = Boot.GLYPH_FILLS
    const strokes = Boot.GLYPH_STROKES

    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i]
      const letter = String.fromCharCode(97 + i)
      const key = `asset_${packKey}_${letter}`
      if (this.textures.exists(key)) continue

      const rt = this.add.renderTexture(0, 0, size, size).setVisible(false)

      // Pass 1 — drop shadow. A black-tinted version of the glyph nudged
      // down a few pixels gives the glyph physical weight on screen.
      const shadow = this.make.text({
        x: 0, y: 0,
        text: glyph,
        style: {
          fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: 'rgba(0,0,0,0.32)',
          stroke: 'rgba(0,0,0,0.32)',
          strokeThickness: Math.round(size * 0.12)
        }
      })
      shadow.setOrigin(0.5)
      rt.draw(shadow, size / 2, size / 2 + size * 0.05)
      shadow.destroy()

      // Pass 2 — the glyph itself. Bright fill + darker stroke = readable
      // and chunky enough for a toddler to recognise from across the room.
      const text = this.make.text({
        x: 0, y: 0,
        text: glyph,
        style: {
          fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: fills[i],
          stroke: strokes[i],
          strokeThickness: Math.round(size * 0.1)
        }
      })
      text.setOrigin(0.5)
      rt.draw(text, size / 2, size / 2)
      text.destroy()

      rt.saveTexture(key)
      rt.destroy()
    }
  }

  generateNumberTextures() {
    this._generateGlyphPack('numbers', ['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  }

  generateLetterTextures() {
    this._generateGlyphPack('letters', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  }

  /**
   * Bake nine `asset_shapes_<a-i>` textures — basic geometric shapes drawn
   * with Phaser graphics primitives. Each shape gets its own colour from the
   * shared rainbow palette (matches Numbers/Letters identity) with a darker
   * stroke for the chunky cookie-cutter feel.
   *
   * Procedural rather than imported SVG/PNG because:
   *   - mathematically perfect at any device resolution
   *   - recolourable per slot without an asset pipeline
   *   - zero bytes added to the bundle
   *   - consistent visual language with the other procedural packs
   */
  generateShapeTextures() {
    const SHAPES = ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart', 'diamond', 'hexagon', 'oval']
    const fills = Boot.GLYPH_FILLS // shared palette — same hues as digits/letters
    const strokes = Boot.GLYPH_STROKES
    const size = 240
    const cx = size / 2
    const cy = size / 2

    for (let i = 0; i < SHAPES.length; i++) {
      const shape = SHAPES[i]
      const letter = String.fromCharCode(97 + i)
      const key = `asset_shapes_${letter}`
      if (this.textures.exists(key)) continue

      const fillInt = parseInt(fills[i].slice(1), 16)
      const strokeInt = parseInt(strokes[i].slice(1), 16)
      const strokeW = Math.max(6, size * 0.045)

      const rt = this.add.renderTexture(0, 0, size, size).setVisible(false)
      const g = this.make.graphics({ x: 0, y: 0 }, false)

      // Pass 1 — drop shadow. Same trick as the glyph packs: black, low
      // alpha, slightly nudged down → reads as physical weight.
      g.fillStyle(0x000000, 0.32)
      this._drawShape(g, shape, cx, cy + size * 0.035, size * 0.42)
      // (no stroke on shadow — keeps it as a soft blob, not a doubled outline)
      g.fillPath?.() // ensure path-based shapes commit; circle/rect already filled

      // Pass 2 — coloured shape + dark stroke
      g.fillStyle(fillInt, 1)
      g.lineStyle(strokeW, strokeInt, 1)
      this._drawShape(g, shape, cx, cy, size * 0.4)

      rt.draw(g, 0, 0)
      g.destroy()
      rt.saveTexture(key)
      rt.destroy()
    }
  }

  /**
   * Draw one shape into the given `graphics` instance at (cx, cy) sized to
   * `r` (think "radius" of the bounding box). Strokes the outline if a
   * `lineStyle` has been set on `g` before calling. Caller is responsible
   * for fillStyle.
   */
  _drawShape(g, shape, cx, cy, r) {
    switch (shape) {
      case 'circle': {
        g.fillCircle(cx, cy, r)
        g.strokeCircle(cx, cy, r)
        break
      }
      case 'square': {
        const s = r * 1.7
        g.fillRoundedRect(cx - s / 2, cy - s / 2, s, s, s * 0.08)
        g.strokeRoundedRect(cx - s / 2, cy - s / 2, s, s, s * 0.08)
        break
      }
      case 'rectangle': {
        const w = r * 2
        const h = r * 1.25
        g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, h * 0.1)
        g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, h * 0.1)
        break
      }
      case 'triangle': {
        // Equilateral, point up, optical centre adjusted slightly
        const h = r * 1.7
        const w = h * 1.15
        const top = { x: cx, y: cy - h / 1.7 }
        const bl = { x: cx - w / 2, y: cy + h / 2.4 }
        const br = { x: cx + w / 2, y: cy + h / 2.4 }
        this._pathPolygon(g, [top, br, bl])
        break
      }
      case 'star': {
        // 5-point star — 10 alternating outer/inner vertices
        const outerR = r * 1.05
        const innerR = r * 0.45
        const pts = []
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const rr = i % 2 === 0 ? outerR : innerR
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
        }
        this._pathPolygon(g, pts)
        break
      }
      case 'heart': {
        // Parametric heart curve (smoother than two-circles-plus-triangle).
        // x = 16 sin³(t), y = 13 cos(t) − 5 cos(2t) − 2 cos(3t) − cos(4t)
        // Scaled to fit within radius r.
        const segments = 80
        const pts = []
        const k = r / 17
        for (let i = 0; i <= segments; i++) {
          const t = (i / segments) * Math.PI * 2 - Math.PI / 2
          const x = 16 * Math.pow(Math.sin(t), 3)
          const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
          pts.push({ x: cx + x * k, y: cy - y * k })
        }
        this._pathPolygon(g, pts)
        break
      }
      case 'diamond': {
        // 4-point rhombus, taller than wide
        const w = r * 1.4
        const h = r * 1.9
        this._pathPolygon(g, [
          { x: cx, y: cy - h / 2 },
          { x: cx + w / 2, y: cy },
          { x: cx, y: cy + h / 2 },
          { x: cx - w / 2, y: cy }
        ])
        break
      }
      case 'hexagon': {
        // Regular hexagon, flat-top orientation
        const pts = []
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i
          pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
        }
        this._pathPolygon(g, pts)
        break
      }
      case 'oval': {
        const w = r * 2.2
        const h = r * 1.5
        g.fillEllipse(cx, cy, w, h)
        g.strokeEllipse(cx, cy, w, h)
        break
      }
    }
  }

  /** Trace a closed polygon, fill it, then stroke the outline. */
  _pathPolygon(g, points) {
    g.beginPath()
    g.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
    g.closePath()
    g.fillPath()
    g.strokePath()
  }

  /**
   * Bake `asset_shapes_card_icon` — a composite of three mini-shapes
   * (triangle + circle + square) in a triangular layout, all in the
   * rainbow palette. Used on the MainMenu's Shapes card so the toddler
   * sees "lots of shapes" at a glance instead of just a single circle.
   *
   * Shares the `_drawShape` helper with the in-game Shapes pack so the
   * visual treatment is identical (drop shadow + dark stroke).
   */
  generateShapesCardIcon() {
    if (this.textures.exists('asset_shapes_card_icon')) return
    const size = 240
    const rt = this.add.renderTexture(0, 0, size, size).setVisible(false)
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const stroke = Math.max(5, size * 0.035)
    const r = size * 0.16
    const shadowOffset = size * 0.025

    const drawMini = (shape, cx, cy, fill, strokeColor) => {
      // shadow pass — lineStyle 0 disables stroking so the shadow stays solid
      g.fillStyle(0x000000, 0.22)
      g.lineStyle(0, 0, 0)
      this._drawShape(g, shape, cx, cy + shadowOffset, r)
      // main pass — coloured fill + dark stroke (cookie-cutter look)
      g.fillStyle(fill, 1)
      g.lineStyle(stroke, strokeColor, 1)
      this._drawShape(g, shape, cx, cy, r)
    }

    // Triangle (red) top-centre, circle (blue) bottom-left, square (yellow) bottom-right.
    // Triangular composition reads as "multiple shapes" without feeling cluttered.
    drawMini('triangle', size * 0.5, size * 0.3, 0xff5d5d, 0x7a1f1f)
    drawMini('circle', size * 0.3, size * 0.68, 0x3ba4ff, 0x0e4b85)
    drawMini('square', size * 0.7, size * 0.68, 0xffd23f, 0x856100)

    rt.draw(g, 0, 0)
    g.destroy()
    rt.saveTexture('asset_shapes_card_icon')
    rt.destroy()
  }

  /**
   * Bake `asset_memory_icon` — two overlapping cards (indigo "?" back +
   * white front showing a gold star). Replaces the emoji-rendered 🧠
   * which looked off against the rest of the procedural icon set.
   *
   * The two-cards composition reads as "match these" at a glance —
   * the exact mechanic the Memory pack uses.
   */
  generateMemoryIcon() {
    if (this.textures.exists('asset_memory_icon')) return
    const size = 240
    const rt = this.add.renderTexture(0, 0, size, size).setVisible(false)
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const cardW = size * 0.42
    const cardH = size * 0.6
    const radius = cardW * 0.16
    const stroke = Math.max(4, size * 0.022)

    // ── Back card: indigo with "?" — sits behind, offset down-left.
    const back = { x: size * 0.18, y: size * 0.22 }
    g.fillStyle(0x000000, 0.25)
    g.fillRoundedRect(back.x + 2, back.y + size * 0.018, cardW, cardH, radius)
    g.fillStyle(0x3a3c8c, 1) // lip
    g.fillRoundedRect(back.x, back.y + size * 0.012, cardW, cardH, radius)
    g.fillStyle(0x5e60ce, 1) // face
    g.fillRoundedRect(back.x, back.y, cardW, cardH, radius)
    // glossy top highlight strip
    g.fillStyle(0xffffff, 0.22)
    g.fillRoundedRect(back.x + cardW * 0.08, back.y + cardH * 0.08, cardW * 0.84, cardH * 0.28, radius * 0.6)
    g.lineStyle(stroke, 0x252660, 1)
    g.strokeRoundedRect(back.x, back.y, cardW, cardH, radius)

    // ── Front card: white with star — sits in front, offset up-right.
    const front = { x: size * 0.42, y: size * 0.18 }
    g.fillStyle(0x000000, 0.28)
    g.fillRoundedRect(front.x + 2, front.y + size * 0.018, cardW, cardH, radius)
    g.fillStyle(0x3a3c8c, 0.85)
    g.fillRoundedRect(front.x, front.y + size * 0.012, cardW, cardH, radius)
    g.fillStyle(0xffffff, 1)
    g.fillRoundedRect(front.x, front.y, cardW, cardH, radius)
    g.lineStyle(stroke, 0x5e60ce, 1)
    g.strokeRoundedRect(front.x, front.y, cardW, cardH, radius)

    rt.draw(g, 0, 0)
    g.destroy()

    // ── "?" glyph centered on the back card
    const q = this.make.text({
      x: 0, y: 0,
      text: '?',
      style: {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: `${cardH * 0.55}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#252660',
        strokeThickness: cardH * 0.05
      }
    })
    q.setOrigin(0.5)
    rt.draw(q, back.x + cardW / 2, back.y + cardH / 2)
    q.destroy()

    // ── 5-point gold star centered on the front card
    const starG = this.make.graphics({ x: 0, y: 0 }, false)
    const starCx = front.x + cardW / 2
    const starCy = front.y + cardH / 2
    const starOuter = cardW * 0.32
    const starInner = starOuter * 0.45
    const starPts = []
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2
      const rr = i % 2 === 0 ? starOuter : starInner
      starPts.push({ x: starCx + Math.cos(a) * rr, y: starCy + Math.sin(a) * rr })
    }
    // star shadow
    starG.fillStyle(0x000000, 0.22)
    starG.beginPath()
    starG.moveTo(starPts[0].x, starPts[0].y + size * 0.012)
    for (let i = 1; i < starPts.length; i++) starG.lineTo(starPts[i].x, starPts[i].y + size * 0.012)
    starG.closePath()
    starG.fillPath()
    // star body
    starG.fillStyle(0xffd23f, 1)
    starG.lineStyle(stroke, 0x856100, 1)
    starG.beginPath()
    starG.moveTo(starPts[0].x, starPts[0].y)
    for (let i = 1; i < starPts.length; i++) starG.lineTo(starPts[i].x, starPts[i].y)
    starG.closePath()
    starG.fillPath()
    starG.strokePath()
    rt.draw(starG, 0, 0)
    starG.destroy()

    rt.saveTexture('asset_memory_icon')
    rt.destroy()
  }

  /**
   * Bake `asset_sort_icon` — 3 colour-coded bins at the bottom + 3 matching
   * coloured items hovering above. Reads as "drop these into the right bins"
   * at a glance, which is exactly what the GameI Sort scene does.
   *
   * Replaces the earlier 3-dots-in-a-row design (which read more as
   * "ellipsis / loading" than as sorting).
   */
  generateSortIcon() {
    if (this.textures.exists('asset_sort_icon')) return
    const size = 240
    const rt = this.add.renderTexture(0, 0, size, size).setVisible(false)
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    const stroke = Math.max(4, size * 0.028)
    const shadowOffset = size * 0.018

    const binCount = 3
    const binW = size * 0.22
    const binH = size * 0.28
    const binGap = size * 0.035
    const rowW = binW * binCount + binGap * (binCount - 1)
    const binStartX = (size - rowW) / 2 + binW / 2
    const binCy = size * 0.72
    const binRadius = binH * 0.2

    const itemR = size * 0.085
    const itemCy = size * 0.3

    const colors = [
      { fill: 0xff5d5d, lip: 0x9c2c2c },
      { fill: 0x3ba4ff, lip: 0x1769b8 },
      { fill: 0xffd23f, lip: 0xc99e00 }
    ]

    // ── Bins along the bottom (3-D stack: shadow + lip + face)
    colors.forEach((c, i) => {
      const cx = binStartX + i * (binW + binGap)
      g.fillStyle(0x000000, 0.22)
      g.fillRoundedRect(cx - binW / 2, binCy - binH / 2 + shadowOffset, binW, binH, binRadius)
      g.fillStyle(c.lip, 1)
      g.fillRoundedRect(cx - binW / 2, binCy - binH / 2 + size * 0.012, binW, binH, binRadius)
      g.fillStyle(c.fill, 1)
      g.fillRoundedRect(cx - binW / 2, binCy - binH / 2, binW, binH, binRadius)
      // darker inner "opening" strip suggests depth
      g.fillStyle(c.lip, 0.4)
      g.fillRoundedRect(
        cx - binW / 2 + binW * 0.08,
        binCy - binH / 2 + binH * 0.1,
        binW * 0.84,
        binH * 0.22,
        binRadius * 0.6
      )
    })

    // ── Floating items above each bin (the "drop me" hint)
    colors.forEach((c, i) => {
      const cx = binStartX + i * (binW + binGap)
      g.fillStyle(0x000000, 0.22)
      g.fillCircle(cx, itemCy + shadowOffset, itemR)
      g.fillStyle(c.fill, 1)
      g.lineStyle(stroke, c.lip, 1)
      g.fillCircle(cx, itemCy, itemR)
      g.strokeCircle(cx, itemCy, itemR)
    })

    rt.draw(g, 0, 0)
    g.destroy()
    rt.saveTexture('asset_sort_icon')
    rt.destroy()
  }

  /**
   * Bake `asset_count_icon` — composites the existing baked digit textures
   * "1", "2", "3" (asset_numbers_a/b/c) in a horizontal row. Reuses the
   * same chunky cookie-cutter glyphs the in-game Numbers pack uses, so the
   * icon reads as native to the same family (vs the system-rendered 🔢
   * emoji it replaces, which clashed with the procedural icon set).
   *
   * Must run AFTER `generateNumberTextures()` — Boot.create() schedules
   * them in the correct order.
   */
  generateCountIcon() {
    if (this.textures.exists('asset_count_icon')) return
    const size = 240
    const rt = this.add.renderTexture(0, 0, size, size).setVisible(false)

    // Each digit texture is 240x240 with the glyph at ~88% of frame. Scale
    // to ~33% so three digits fit comfortably across the 240px width with
    // some breathing room between them.
    const scale = 0.34
    const xs = [size * 0.2, size * 0.5, size * 0.8]
    const cy = size * 0.5
    xs.forEach((x, i) => {
      const key = `asset_numbers_${String.fromCharCode(97 + i)}` // 'a'/'b'/'c' → 1/2/3
      if (!this.textures.exists(key)) return
      const img = this.add.image(0, 0, key).setScale(scale).setVisible(false)
      rt.draw(img, x, cy)
      img.destroy()
    })

    rt.saveTexture('asset_count_icon')
    rt.destroy()
  }

  loadGameAssets() {
    // BUTTONS
    this.load.image('button_back', 'assets/buttons/back.png')

    // BACKGROUNDS
    this.load.image('background_a', 'assets/backgrounds/A.png')
    this.load.image('background_b', 'assets/backgrounds/B.png')
    this.load.image('background_c', 'assets/backgrounds/C.png')
    this.load.image('background_d', 'assets/backgrounds/D.png')
    this.load.image('background_e', 'assets/backgrounds/E.png')
    this.load.image('background_f', 'assets/backgrounds/F.png')

    // TOYS-CARTOON
    const animalCartoonPackName = 'animal_cartoon'
    const animalCartoonPath = 'A.png'
    const animalCartoonWidth = 310
    for (let i = 0; i <= 8; i++) {
      this.load.spritesheet(
        `asset_${animalCartoonPackName}_${String.fromCharCode(97 + i)}`,
        `assets/emojis-pack/${animalCartoonPath}`,
        {
          frameWidth: animalCartoonWidth,
          startFrame: i === 0 ? undefined : i
        }
      )
    }

    // MISTIC-LEGO
    const misticLegoPackName = 'mistic_lego'
    const misticLegoPath = 'B.png'
    const misticLegoWidth = 310
    for (let i = 0; i <= 8; i++) {
      this.load.spritesheet(
        `asset_${misticLegoPackName}_${String.fromCharCode(97 + i)}`,
        `assets/emojis-pack/${misticLegoPath}`,
        {
          frameWidth: misticLegoWidth,
          startFrame: i === 0 ? undefined : i
        }
      )
    }

    // EMOJIS-LEGO
    const emojisLegoPackName = 'emojis_lego'
    const emojisLegoPath = 'C.png'
    const emojisLegoWidth = 310
    for (let i = 0; i <= 8; i++) {
      this.load.spritesheet(
        `asset_${emojisLegoPackName}_${String.fromCharCode(97 + i)}`,
        `assets/emojis-pack/${emojisLegoPath}`,
        {
          frameWidth: emojisLegoWidth,
          startFrame: i === 0 ? undefined : i
        }
      )
    }

    // FRUITS — individual Fluent Emoji 3D PNGs (MIT). See public/assets/fruits/README.md.
    const fruitFiles = {
      a: 'red_apple',
      b: 'banana',
      c: 'tangerine',
      d: 'grapes',
      e: 'strawberry',
      f: 'watermelon',
      g: 'pineapple',
      h: 'cherries',
      i: 'pear'
    }
    for (const [letter, name] of Object.entries(fruitFiles)) {
      this.load.image(`asset_fruits_${letter}`, `assets/fruits/${letter}_${name}.png`)
    }

    // AUDIO — Kenney UI Audio (CC0). See public/assets/audio/ui/README.md
    // for the mapping of each file to where it plays.
    this.load.audio('ui_letter_pop', 'assets/audio/ui/click5.wav')
    this.load.audio('ui_match_drop', 'assets/audio/ui/switch7.wav')
    this.load.audio('ui_celebrate', 'assets/audio/ui/switch33.wav')
    this.load.audio('ui_menu_tap', 'assets/audio/ui/rollover3.wav')

    // Legacy aliases — kept so the old crateboy keys still resolve while the
    // codebase migrates. Points at the new Kenney files, not the crateboy WAVs.
    this.load.audio('collect', 'assets/audio/ui/switch7.wav')
    this.load.audio('sfx_collect', 'assets/audio/ui/click5.wav')

    // ELEMENTS
    this.load.image('cloud-b', 'assets/clouds/cloud-computing.png')
    this.load.image('cloud-c', 'assets/clouds/cloud.png')
    this.load.image('sky', 'assets/elements/sky.png')
    this.load.image('ground', 'assets/elements/platform.png')
    this.load.image('star', 'assets/elements/star.png')
    this.load.image('bomb', 'assets/elements/bomb.png')
    this.load.image('brick', 'assets/elements/brick.png')
    this.load.image('frameA', 'assets/crateboy/_ART/birds/spr_bird1_0.png')
    this.load.image('frameB', 'assets/crateboy/_ART/birds/spr_bird1_1.png')
    this.load.image('wall', 'assets/crateboy/_ART/Wall tiles/wall3.png')
  }
}
