import { EventBus } from '../EventBus'
import { Scene } from 'phaser'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { preloadLevelAudio } from '../../services/libro/levelAudio'
import { settings } from '../../services/settings'

// 2×4 grid = 8 cards = 4 pairs. Toddlers 2-4 hit cognitive overload
// somewhere around 6 pairs; 4 is the sweet spot for the first sessions
// and still long enough to feel like a real game (not a 10-second tutorial).
const PAIRS = 4
const NUM_CARDS = PAIRS * 2
const COLS = 2
const ROWS = 4

// Per-pack pools to draw cards from. Each game randomly picks ONE pack and
// then 4 random items from inside it — gives the toddler 7 thematic Memory
// variants for free (Fruits memory, Numbers memory, Heroes memory…) instead
// of needing 7 separate scenes.
const PACK_POOLS = [
  { pack: 'animal_cartoon', letters: 'abcdefghi'.split('') },
  { pack: 'mistic_lego', letters: 'abcdefghi'.split('') },
  { pack: 'emojis_lego', letters: 'abcdefghi'.split('') },
  { pack: 'fruits', letters: 'abcdefghi'.split('') },
  { pack: 'numbers', letters: 'abcdefghi'.split('') },
  { pack: 'letters', letters: 'abcdefghi'.split('') },
  { pack: 'shapes', letters: 'abcdefghi'.split('') }
]

/**
 * Memory Match Pairs — the second mechanic in the app (every other pack uses
 * shadow-matching). 2×4 grid of facedown cards, tap to flip. Find every
 * pair to win.
 *
 *   1. Pick a random pack + 4 random items from it → 4 unique asset keys.
 *   2. Duplicate to make 8 cards, shuffle, lay out in 2×4.
 *   3. Tap-flip with a quick scale-X animation.
 *   4. On second tap: match → both stay up + speak the word + ding.
 *      no match → red flash + shake → both flip back after 700 ms.
 *   5. All 4 pairs found → showLevelComplete + scene transition.
 *
 * Lockout: after the second flip, all input is suspended while we evaluate.
 * Without this a fast toddler can flip a 3rd card mid-evaluation and
 * desynchronise the pair tracker.
 */
export class GameH extends Scene {
  constructor() {
    super('GameH')
    this.cards = [] // [{ sprite, back, face, assetKey, matched, faceUp }]
    this.firstPick = null
    this.locked = false // true during pair-evaluation flip-back window
    this.matchedPairs = 0
    this.completed = false // guard so showLevelComplete only fires once
    this.score = 0
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.drawBackground()
    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    this.dealCards()

    EventBus.emit('current-scene-ready', this)
  }

  // ─── Background ───────────────────────────────────────────────────────
  //
  // Soft indigo→cool-cyan vertical gradient — distinct from every other
  // pack's background. Cool and "thinky" to suggest the memory/focus
  // aspect, but still toddler-friendly via the bright accent colors on
  // the cards themselves.
  drawBackground() {
    const g = this.add.graphics().setDepth(0)
    const top = 0x5e60ce // soft indigo
    const mid = 0x7a8de8 // periwinkle
    const bot = 0xc8d8ff // pale cyan
    g.fillGradientStyle(top, top, bot, mid, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    // A few twinkling sparkles for personality (matches the sky decoration
    // pattern used in Letters/Shapes/MainMenu).
    if (!this.reducedMotion) {
      const spots = [[0.15, 0.06], [0.85, 0.08], [0.5, 0.04], [0.92, 0.5]]
      spots.forEach(([fx, fy], i) => {
        const r = this.minSide * 0.012
        const star = this.add
          .star(this.sWidth * fx, this.sHeight * fy, 5, r * 0.4, r, 0xffffff)
          .setAlpha(0.85)
          .setDepth(0)
        this.tweens.add({
          targets: star,
          scale: 0.3,
          alpha: 0.35,
          duration: 1100 + Math.random() * 500,
          delay: i * 380,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      })
    }
  }

  // ─── Deal ────────────────────────────────────────────────────────────
  dealCards() {
    // Pick a random pack + 4 random items inside it. Same hex shuffle Phaser
    // uses internally so we don't pull in a dep.
    const pool = PACK_POOLS[Math.floor(Math.random() * PACK_POOLS.length)]
    this.activePack = pool.pack
    const chosenLetters = [...pool.letters]
      .sort(() => Math.random() - 0.5)
      .slice(0, PAIRS)
    const assetKeys = chosenLetters.map((l) => `asset_${pool.pack}_${l}`)

    // Pre-fetch the audio for each card so the "speak on match" is instant.
    // Bundled MP3 hit → near-zero latency; API fallback → still kicks off in
    // background so by the time the toddler matches, the file is local.
    const lang = settings.language()
    assetKeys.forEach((k) => preloadLevelAudio(k, lang).catch(() => {}))

    // Duplicate to make pairs, then shuffle.
    const cardKeys = [...assetKeys, ...assetKeys].sort(() => Math.random() - 0.5)

    // Layout: 2 columns × 4 rows, centred horizontally, leaving room at the
    // top for the back button + score pill (~14% of sH).
    const gridTop = this.sHeight * 0.16
    const gridBottom = this.sHeight * 0.95
    const gridH = gridBottom - gridTop
    const gridW = this.sWidth * 0.86
    const cardW = (gridW - this.sWidth * 0.04) / COLS
    const cardH = (gridH - this.sHeight * 0.03 * (ROWS - 1)) / ROWS
    const startX = (this.sWidth - gridW) / 2 + cardW / 2
    const startY = gridTop + cardH / 2

    for (let i = 0; i < NUM_CARDS; i++) {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = startX + col * (cardW + this.sWidth * 0.04)
      const y = startY + row * (cardH + this.sHeight * 0.03)
      this.cards.push(this._buildCard(x, y, cardW, cardH, cardKeys[i]))
    }
  }

  // ─── Card construction ───────────────────────────────────────────────
  //
  // Each card is a Container holding: shadow + lip + face (white) + icon
  // + back (indigo with "?"). `back` and `face` swap visibility on flip.
  // Flip animation: scaleX 1 → 0 (220 ms), swap textures, scaleX 0 → 1.
  _buildCard(cx, cy, w, h, assetKey) {
    const radius = Math.min(w, h) * 0.16
    const container = this.add.container(cx, cy).setDepth(5)

    // 3-D stack — same recipe as the MainMenu cards so cards feel native to
    // the design system.
    const shadow = this.add.graphics()
    shadow.fillStyle(0x000000, 0.22)
    shadow.fillRoundedRect(-w / 2, -h / 2 + h * 0.07, w, h, radius)
    const lip = this.add.graphics()
    lip.fillStyle(0x3a3c8c, 1) // deeper indigo (matches MainMenu Memory card)
    lip.fillRoundedRect(-w / 2, -h / 2 + h * 0.04, w, h, radius)

    // Card back — indigo face with a big "?" glyph.
    const back = this.add.container(0, 0)
    const backFace = this.add.graphics()
    backFace.fillStyle(0x5e60ce, 1)
    backFace.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
    backFace.fillStyle(0xffffff, 0.18) // glossy top highlight
    backFace.fillRoundedRect(-w / 2 + w * 0.06, -h / 2 + h * 0.06, w * 0.88, h * 0.3, radius * 0.7)
    backFace.lineStyle(Math.max(3, w * 0.018), 0x3a3c8c, 1)
    backFace.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
    const q = this.add
      .text(0, 0, '?', {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: `${h * 0.5}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
    q.setStroke('#252660', h * 0.04)
    back.add([backFace, q])

    // Card face — white background with the chosen asset centred.
    const face = this.add.container(0, 0).setVisible(false)
    const faceBg = this.add.graphics()
    faceBg.fillStyle(0xffffff, 1)
    faceBg.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
    faceBg.lineStyle(Math.max(3, w * 0.018), 0x5e60ce, 1)
    faceBg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
    const icon = this.add.image(0, 0, assetKey)
    const iconMaxDim = Math.min(w, h) * 0.7
    const iconScale = iconMaxDim / Math.max(icon.width, icon.height || icon.width)
    icon.setScale(iconScale)
    face.add([faceBg, icon])

    container.add([shadow, lip, back, face])

    // Hit target — a transparent Rectangle layered on top of the container.
    // Container input has been unreliable in this Phaser/iOS WebView combo
    // (same rationale as Settings/MainMenu cog). Rectangle input is rock-solid.
    const hit = this.add
      .rectangle(cx, cy, w, h, 0x000000, 0)
      .setDepth(6)
      .setInteractive({ useHandCursor: true })

    const card = {
      container,
      back,
      face,
      hit,
      assetKey,
      faceUp: false,
      matched: false,
      w,
      h
    }
    hit.on('pointerdown', () => this._onCardTapped(card))
    return card
  }

  // ─── Tap handler ─────────────────────────────────────────────────────
  _onCardTapped(card) {
    if (this.locked || card.matched || card.faceUp) return
    this._flipUp(card)

    if (!this.firstPick) {
      this.firstPick = card
    } else {
      // Second tap — evaluate after the flip animation lands.
      const second = card
      this.locked = true
      this.time.delayedCall(280, () => this._evaluate(this.firstPick, second))
    }
  }

  _evaluate(a, b) {
    if (a.assetKey === b.assetKey) {
      // Match: speak the word, brief pulse, mark as matched, clear firstPick.
      a.matched = true
      b.matched = true
      this.matchedPairs += 1
      this.score += 1
      this.scoreBoard.setScore(this.score)
      this._speakWord(a.assetKey)
      try {
        if (this.cache.audio.exists('ui_match_drop')) {
          this.sound.play('ui_match_drop', { volume: 0.55 })
        }
      } catch {
        /* sound is best-effort */
      }
      this._pulseMatched(a)
      this._pulseMatched(b)
      this.firstPick = null
      this.locked = false

      if (this.matchedPairs >= PAIRS && !this.completed) {
        this.completed = true
        this.input.enabled = false
        // Short pause so the toddler sees the final pair land before the
        // celebration starts.
        this.time.delayedCall(600, () => {
          showLevelComplete(this, () => {
            this.scene.start(pickNextSceneExcluding('GameH'))
          })
        })
      }
    } else {
      // No match: red flash + flip both back after a beat.
      this._flashWrong(a)
      this._flashWrong(b)
      this.time.delayedCall(700, () => {
        this._flipDown(a)
        this._flipDown(b)
        this.firstPick = null
        this.locked = false
      })
    }
  }

  // ─── Flip animations ─────────────────────────────────────────────────
  _flipUp(card) {
    if (card.faceUp) return
    card.faceUp = true
    if (this.reducedMotion) {
      card.back.setVisible(false)
      card.face.setVisible(true)
      return
    }
    this.tweens.add({
      targets: card.container,
      scaleX: 0,
      duration: 110,
      ease: 'Quad.easeIn',
      onComplete: () => {
        card.back.setVisible(false)
        card.face.setVisible(true)
        this.tweens.add({
          targets: card.container,
          scaleX: 1,
          duration: 170,
          ease: 'Back.easeOut'
        })
      }
    })
  }

  _flipDown(card) {
    if (!card.faceUp || card.matched) return
    card.faceUp = false
    if (this.reducedMotion) {
      card.face.setVisible(false)
      card.back.setVisible(true)
      return
    }
    this.tweens.add({
      targets: card.container,
      scaleX: 0,
      duration: 110,
      ease: 'Quad.easeIn',
      onComplete: () => {
        card.face.setVisible(false)
        card.back.setVisible(true)
        this.tweens.add({
          targets: card.container,
          scaleX: 1,
          duration: 170,
          ease: 'Back.easeOut'
        })
      }
    })
  }

  _pulseMatched(card) {
    if (this.reducedMotion) return
    this.tweens.add({
      targets: card.container,
      scale: { from: 1, to: 1.12 },
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut'
    })
  }

  _flashWrong(card) {
    if (this.reducedMotion) return
    // Use a quick translate shake on the container (avoids re-tinting the
    // composite, which would require rebuilding graphics).
    this.tweens.add({
      targets: card.container,
      x: { from: card.container.x - 6, to: card.container.x + 6 },
      duration: 60,
      yoyo: true,
      repeat: 2
    })
  }

  // ─── Audio ───────────────────────────────────────────────────────────
  //
  // Speaks the word for the matched asset (e.g. "BANANA!", "ONE!", "STAR!").
  // Skips the full spelling+celebration modal — Memory is paced faster than
  // the per-piece shadow-match modal. Just plays the bundled MP3.
  _speakWord(assetKey) {
    const lang = settings.language()
    preloadLevelAudio(assetKey, lang)
      .then((audio) => {
        if (!audio) return
        try {
          audio.currentTime = 0
          audio.play().catch(() => {})
        } catch {
          /* audio is best-effort */
        }
      })
      .catch(() => {})
  }
}
