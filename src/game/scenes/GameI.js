import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'

// Three bins, two items per colour. Six total drags = ~30 seconds of play,
// the sweet spot for a 2-3yo's attention before they want a new mechanic
// (Memory + Sort cycle into each other via the scene rotation).
const ITEMS_PER_COLOR = 2
const COLOR_BINS = [
  { name: 'red', fill: 0xff5d5d, lip: 0x9c2c2c },
  { name: 'blue', fill: 0x3ba4ff, lip: 0x1769b8 },
  { name: 'yellow', fill: 0xffd23f, lip: 0xc99e00 }
]
const NUM_ITEMS = COLOR_BINS.length * ITEMS_PER_COLOR

/**
 * Color Sorting puzzle (GameI) — the third mechanic in the app, sitting
 * alongside shadow-matching (GameA-G) and memory pairs (GameH).
 *
 *   1. Scatter NUM_ITEMS coloured circles across the top 2/3 of the screen.
 *   2. Three matching coloured bins anchor the bottom row.
 *   3. Toddler drags each item into its colour-matching bin.
 *   4. Correct drop → fly into bin + ding + pulse + score++.
 *      Wrong drop  → bounce back to origin + shake (no penalty, no scolding).
 *   5. All items sorted → showLevelComplete + scene rotation.
 *
 * Educationally targets categorisation (2-3yo); the simplest cognitive
 * step above pure matching. Lovevery's curriculum puts it at the start of
 * the matching-and-sorting stage.
 */
export class GameI extends Scene {
  constructor() {
    super('GameI')
    this.items = []
    this.bins = []
    this.score = 0
    this.sortedCount = 0
    this.completed = false
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.drawBackground()
    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    this.buildBins()
    this.spawnItems()

    EventBus.emit('current-scene-ready', this)
  }

  // ─── Background ─────────────────────────────────────────────────────
  //
  // Soft coral-peach → cream gradient. Warm, friendly, doesn't compete
  // with the saturated bins or items. Distinct from every other pack's
  // background (which run cool: sky blue, cosmos, mint, indigo).
  drawBackground() {
    const g = this.add.graphics().setDepth(0)
    const top = 0xffd9c4 // pale coral
    const mid = 0xfff1d6 // warm cream
    const bot = 0xffece0 // soft peach
    g.fillGradientStyle(top, top, bot, mid, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    // Ambient blobs in the bin colours so the toddler's eye reads the page
    // as "this is a colourful sorting world".
    g.fillStyle(0xff5d5d, 0.07)
    g.fillCircle(this.sWidth * 0.15, this.sHeight * 0.2, this.minSide * 0.3)
    g.fillStyle(0x3ba4ff, 0.07)
    g.fillCircle(this.sWidth * 0.85, this.sHeight * 0.5, this.minSide * 0.28)
    g.fillStyle(0xffd23f, 0.1)
    g.fillCircle(this.sWidth * 0.5, this.sHeight * 0.95, this.minSide * 0.35)
  }

  // ─── Bins ───────────────────────────────────────────────────────────
  //
  // Three buckets along the bottom. Each rendered as a wide rounded-square
  // with a 3-D lip + slightly lighter inner area to suggest an "opening".
  // Hit-test uses the bounding rectangle (Phaser's Rectangle, drawn on top
  // with zero alpha) — same reliability pattern used everywhere else in
  // this app.
  buildBins() {
    const binCount = COLOR_BINS.length
    const binAreaTop = this.sHeight * 0.66
    const binAreaBottom = this.sHeight * 0.93
    const binAreaH = binAreaBottom - binAreaTop
    const binH = binAreaH * 0.86
    const gap = this.sWidth * 0.03
    const binW = (this.sWidth * 0.92 - gap * (binCount - 1)) / binCount
    const startX = (this.sWidth - this.sWidth * 0.92) / 2 + binW / 2
    const cy = binAreaTop + binAreaH / 2
    const radius = binH * 0.22

    COLOR_BINS.forEach((spec, i) => {
      const cx = startX + i * (binW + gap)
      const g = this.add.graphics().setDepth(2)
      // shadow
      g.fillStyle(0x000000, 0.22)
      g.fillRoundedRect(cx - binW / 2, cy - binH / 2 + binH * 0.08, binW, binH, radius)
      // dark lip
      g.fillStyle(spec.lip, 1)
      g.fillRoundedRect(cx - binW / 2, cy - binH / 2 + binH * 0.04, binW, binH, radius)
      // top face
      g.fillStyle(spec.fill, 1)
      g.fillRoundedRect(cx - binW / 2, cy - binH / 2, binW, binH, radius)
      // inner "opening" — slightly darker top strip suggests depth
      g.fillStyle(spec.lip, 0.45)
      g.fillRoundedRect(
        cx - binW / 2 + binW * 0.06,
        cy - binH / 2 + binH * 0.08,
        binW * 0.88,
        binH * 0.22,
        radius * 0.7
      )

      this.bins.push({
        spec,
        cx,
        cy,
        w: binW,
        h: binH,
        bounds: new Phaser.Geom.Rectangle(cx - binW / 2, cy - binH / 2, binW, binH)
      })
    })
  }

  // ─── Items ──────────────────────────────────────────────────────────
  //
  // Items are circles drawn via `add.circle` (built-in Phaser Shape — comes
  // with `setInteractive` and `setDraggable` out of the box, no texture
  // baking needed). Two per bin colour, scattered in the top area.
  spawnItems() {
    const colors = []
    COLOR_BINS.forEach((b) => {
      for (let i = 0; i < ITEMS_PER_COLOR; i++) colors.push(b)
    })
    colors.sort(() => Math.random() - 0.5)

    const itemR = this.minSide * 0.07
    const margin = itemR * 1.3
    const topY = this.sHeight * 0.16
    const bottomY = this.sHeight * 0.55
    const leftX = margin
    const rightX = this.sWidth - margin
    // Grid the spawn region into 6 cells, jitter each placement so they
    // don't sit in stiff rows.
    const cols = 3
    const rows = Math.ceil(NUM_ITEMS / cols)
    const cellW = (rightX - leftX) / cols
    const cellH = (bottomY - topY) / rows
    const positions = []
    for (let i = 0; i < NUM_ITEMS; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const jitterX = (Math.random() - 0.5) * cellW * 0.4
      const jitterY = (Math.random() - 0.5) * cellH * 0.4
      positions.push({
        x: leftX + cellW * (col + 0.5) + jitterX,
        y: topY + cellH * (row + 0.5) + jitterY
      })
    }

    colors.forEach((spec, i) => {
      const { x, y } = positions[i]
      // Drop-shadow disc + body + light-gloss highlight (subtle 3-D feel).
      const shadow = this.add.circle(x, y + itemR * 0.18, itemR, 0x000000, 0.22).setDepth(3)
      const body = this.add
        .circle(x, y, itemR, spec.fill)
        .setStrokeStyle(Math.max(3, itemR * 0.1), spec.lip, 1)
        .setDepth(4)
        .setInteractive({ useHandCursor: true, draggable: true })
      const gloss = this.add
        .circle(x - itemR * 0.32, y - itemR * 0.32, itemR * 0.32, 0xffffff, 0.35)
        .setDepth(5)

      const item = {
        body,
        shadow,
        gloss,
        spec,
        homeX: x,
        homeY: y,
        sorted: false
      }
      this.items.push(item)

      body.on('drag', (pointer, dragX, dragY) => {
        if (item.sorted) return
        body.x = dragX
        body.y = dragY
        shadow.x = dragX
        shadow.y = dragY + itemR * 0.18
        gloss.x = dragX - itemR * 0.32
        gloss.y = dragY - itemR * 0.32
      })

      body.on('dragend', () => {
        if (item.sorted) return
        const matched = this._findBinUnder(body.x, body.y)
        if (matched && matched.spec.name === item.spec.name) {
          this._onCorrect(item, matched)
        } else if (matched) {
          // Dropped in a bin but the wrong one — bounce back.
          this._onWrong(item)
        } else {
          // Dropped somewhere unrelated — bounce back, no error feedback.
          this._returnHome(item)
        }
      })
    })
  }

  _findBinUnder(x, y) {
    for (const b of this.bins) {
      if (Phaser.Geom.Rectangle.Contains(b.bounds, x, y)) return b
    }
    return null
  }

  // ─── Outcomes ───────────────────────────────────────────────────────
  _onCorrect(item, bin) {
    item.sorted = true
    item.body.disableInteractive()
    this.score += 1
    this.scoreBoard.setScore(this.score)
    try {
      if (this.cache.audio.exists('ui_match_drop')) {
        this.sound.play('ui_match_drop', { volume: 0.55 })
      }
    } catch {
      /* sound is best-effort */
    }
    // Fly into bin, shrink + fade.
    this.tweens.add({
      targets: [item.body, item.shadow, item.gloss],
      x: bin.cx,
      y: bin.cy,
      scale: 0.2,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeIn',
      onComplete: () => {
        item.body.destroy()
        item.shadow.destroy()
        item.gloss.destroy()
      }
    })
    // Brief celebratory pulse on the bin.
    if (!this.reducedMotion) {
      // Find the bin's rendered graphics object via position — simpler to
      // tween the bin's logical centre and let the visual sit static; here
      // we just animate the score badge as a substitute for a richer pulse.
      this.tweens.add({
        targets: this.scoreBoard,
        scale: { from: 1.15, to: 1 },
        duration: 200,
        ease: 'Back.out'
      })
    }

    this.sortedCount += 1
    if (this.sortedCount >= NUM_ITEMS && !this.completed) {
      this.completed = true
      this.input.enabled = false
      this.time.delayedCall(500, () => {
        showLevelComplete(this, () =>
          this.scene.start(pickNextSceneExcluding('GameI'))
        )
      })
    }
  }

  _onWrong(item) {
    // Shake → bounce back to origin. No "wrong!" buzzer; this is a kids
    // app, gentle redirect is the right pattern.
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: [item.body, item.shadow, item.gloss],
        x: { from: item.body.x - 6, to: item.body.x + 6 },
        duration: 50,
        yoyo: true,
        repeat: 2,
        onComplete: () => this._returnHome(item)
      })
    } else {
      this._returnHome(item)
    }
  }

  _returnHome(item) {
    const itemR = item.body.radius
    this.tweens.add({
      targets: item.body,
      x: item.homeX,
      y: item.homeY,
      duration: 220,
      ease: 'Back.easeOut'
    })
    this.tweens.add({
      targets: item.shadow,
      x: item.homeX,
      y: item.homeY + itemR * 0.18,
      duration: 220,
      ease: 'Back.easeOut'
    })
    this.tweens.add({
      targets: item.gloss,
      x: item.homeX - itemR * 0.32,
      y: item.homeY - itemR * 0.32,
      duration: 220,
      ease: 'Back.easeOut'
    })
  }
}
