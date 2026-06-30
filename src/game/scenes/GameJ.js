import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { addBackButton, addScoreBadge } from '../hud'
import { showLevelComplete, pickNextSceneExcluding } from '../levelComplete'
import { preloadLevelAudio, stopAllLevelAudio } from '../../services/libro/levelAudio'
import { settings } from '../../services/settings'

// Each game session walks the toddler through five counting rounds, each
// with one MORE item than the last (1 → 2 → 3 → 4 → 5). This reinforces
// the COUNT SEQUENCE alongside one-to-one correspondence (tap an item →
// hear the next number → see the next digit fill into the slot row).
const MAX_COUNT = 10

// Asset pools we draw the "thing to count" from. Numbers/Letters/Shapes
// excluded — they read as digits/glyphs, which would confuse the counting
// frame ("how many '3's are there? 3."). The emoji-art packs read as
// concrete objects: "three bears", "three bananas".
const COUNTABLE_POOLS = [
  { pack: 'animal_cartoon', letters: 'abcdefghi'.split('') },
  { pack: 'mistic_lego', letters: 'abcdefghi'.split('') },
  { pack: 'emojis_lego', letters: 'abcdefghi'.split('') },
  { pack: 'fruits', letters: 'abcdefghi'.split('') }
]

// Pre-resolved arrangements for each count — keeps the items visually
// balanced no matter how many are on screen (vs random scatter, which can
// look lopsided with 3 items in the same corner).
//
// Coordinates are in NORMALISED screen space ([0, 1]) so the same layout
// works on every device. The Y values stay in the upper 60 % to leave the
// digit slot row at the bottom 25 % unobscured.
const ITEM_POSITIONS = {
  1: [[0.5, 0.36]],
  2: [[0.32, 0.36], [0.68, 0.36]],
  3: [[0.5, 0.26], [0.3, 0.46], [0.7, 0.46]],
  4: [[0.3, 0.28], [0.7, 0.28], [0.3, 0.5], [0.7, 0.5]],
  5: [[0.3, 0.26], [0.7, 0.26], [0.5, 0.4], [0.3, 0.54], [0.7, 0.54]],
  6: [[0.28, 0.30], [0.5, 0.30], [0.72, 0.30], [0.28, 0.52], [0.5, 0.52], [0.72, 0.52]],
  7: [[0.3, 0.27], [0.5, 0.27], [0.7, 0.27], [0.22, 0.50], [0.41, 0.50], [0.59, 0.50], [0.78, 0.50]],
  8: [[0.22, 0.30], [0.41, 0.30], [0.59, 0.30], [0.78, 0.30], [0.22, 0.52], [0.41, 0.52], [0.59, 0.52], [0.78, 0.52]],
  9: [[0.28, 0.24], [0.5, 0.24], [0.72, 0.24], [0.28, 0.42], [0.5, 0.42], [0.72, 0.42], [0.28, 0.60], [0.5, 0.60], [0.72, 0.60]],
  10: [[0.15, 0.30], [0.325, 0.30], [0.5, 0.30], [0.675, 0.30], [0.85, 0.30], [0.15, 0.52], [0.325, 0.52], [0.5, 0.52], [0.675, 0.52], [0.85, 0.52]]
}

/**
 * Counting puzzle (GameJ) — the fourth mechanic, after shadow-matching,
 * memory pairs, and sorting. Educational goal: one-to-one correspondence
 * + number sequence + symbol→quantity mapping.
 *
 *   Round 1: 1 item appears + 1 empty digit slot at the bottom.
 *            Toddler taps the item → it pops, the audio plays "ONE!", and
 *            the "1" texture fills in the slot.
 *   Round 2: 2 items + 2 slots → "ONE!" "TWO!" → 1, 2 appear.
 *   …
 *   Round 5: 5 items, 5 slots, "ONE…FIVE".
 *
 *   After round 5, showLevelComplete runs and the scene rotation continues
 *   to a random other pack.
 *
 * The "digit fills into the slot as you tap" pattern is the killer
 * educational moment — toddler watches the SYMBOL (1, 2, 3) appear at the
 * exact moment they hear the spoken word, while also touching the
 * concrete object. Three simultaneous channels reinforcing the same
 * concept.
 */
export class GameJ extends Scene {
  constructor() {
    super('GameJ')
    this.round = 0 // 0-indexed; rounds 0..MAX_COUNT-1
    this.score = 0
    this.completed = false
    // Per-round transient state — reset in `_startRound`.
    this._roundCount = 0 // how many items the round needs
    this._tappedSoFar = 0 // how many the toddler has tapped this round
    this._items = [] // sprite refs
    this._slots = [] // digit-slot graphics refs
    this._roundContainer = null // parent for everything that gets cleared per round
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.drawBackground()
    addBackButton(this)
    this.scoreBoard = addScoreBadge(this, this.score)

    // Warm the count-audio cache (1..5) so the first tap doesn't pay a
    // file-fetch latency. All five are bundled MP3s in production.
    const lang = settings.language()
    for (let n = 1; n <= MAX_COUNT; n++) {
      // `count` audio = bare spoken number ("One!") with no spelling, unlike
      // the `numbers` pack ("O, N, E. ONE!") used by the Numbers shadow game.
      preloadLevelAudio(`asset_count_${String.fromCharCode(96 + n)}`, lang).catch(() => {})
    }

    this._startRound(1)

    EventBus.emit('current-scene-ready', this)
  }

  // ─── Background ─────────────────────────────────────────────────────
  //
  // Soft lime → mint gradient — fresh, energetic, distinct from every
  // other pack's palette (which run blue / cosmos / pastel / warm coral).
  drawBackground() {
    const g = this.add.graphics().setDepth(0)
    const top = 0xd3f0a2 // pale lime
    const mid = 0xc7eecf // mint
    const bot = 0xe2f7d4 // cool cream
    g.fillGradientStyle(top, top, bot, mid, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)

    // Sprinkled background dots — read as confetti / pollen / something
    // small and countable, in keeping with the theme.
    const dotCount = 24
    for (let i = 0; i < dotCount; i++) {
      const x = Math.random() * this.sWidth
      const y = Math.random() * this.sHeight
      const r = this.minSide * (0.005 + Math.random() * 0.008)
      const color = [0xff5d5d, 0xff9f1c, 0x5fc34a, 0x3ba4ff, 0x9b5de5][i % 5]
      g.fillStyle(color, 0.18)
      g.fillCircle(x, y, r)
    }
  }

  // ─── Round lifecycle ────────────────────────────────────────────────
  _startRound(count) {
    this._roundCount = count
    this._tappedSoFar = 0
    this._items = []
    this._slots = []

    // One container so a single `destroy()` clears the previous round.
    this._roundContainer = this.add.container(0, 0).setDepth(2)

    // Pick a random pack + a single asset from it. One asset for the whole
    // round so the toddler is counting copies of THE SAME thing (cognitively
    // simpler than "count the mixed bears and balls").
    const pool = COUNTABLE_POOLS[Math.floor(Math.random() * COUNTABLE_POOLS.length)]
    const letter = pool.letters[Math.floor(Math.random() * pool.letters.length)]
    const assetKey = `asset_${pool.pack}_${letter}`

    // ── Items ────────────────────────────────────────────────────────
    // Item radius shrinks as the count grows so 6-10 copies don't overlap.
    // Capped at 0.085 so the small rounds (1-5) look exactly as before.
    const positions = ITEM_POSITIONS[count]
    const itemR = this.minSide * Math.min(0.085, 0.45 / count)
    positions.forEach((p, i) => {
      const x = this.sWidth * p[0]
      const y = this.sHeight * p[1]
      const sprite = this.add.image(x, y, assetKey).setDepth(3)
      const scale = (itemR * 2) / Math.max(sprite.width, sprite.height || sprite.width)
      sprite.setScale(scale)
      sprite.setInteractive({ useHandCursor: true })
      sprite.tappedIndex = i
      sprite.on('pointerdown', () => this._onItemTapped(sprite))
      this._roundContainer.add(sprite)
      this._items.push(sprite)

      // Gentle pulse to invite the tap. Stops once the item is tapped.
      if (!this.reducedMotion) {
        sprite._pulseTween = this.tweens.add({
          targets: sprite,
          scale: { from: scale, to: scale * 1.08 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
          delay: i * 120
        })
      }
    })

    // ── Digit slots row at the bottom ───────────────────────────────
    // Empty slots = how many items there are. Each slot fills with the
    // corresponding digit texture (asset_numbers_a..e) when the toddler
    // taps an item in sequence.
    const slotY = this.sHeight * 0.82
    // Slot size shrinks to keep the whole row inside 94% of the width once the
    // count climbs (10 slots at the old 0.13 size would overflow). The 0.13 cap
    // and 0.3 gap-ratio keep rounds 1-5 identical to before.
    const maxRowW = this.sWidth * 0.94
    const slotSize = Math.min(this.minSide * 0.13, maxRowW / (count + 0.3 * (count - 1)))
    const slotGap = slotSize * 0.3
    const totalW = slotSize * count + slotGap * (count - 1)
    const startX = (this.sWidth - totalW) / 2 + slotSize / 2
    for (let i = 0; i < count; i++) {
      const x = startX + i * (slotSize + slotGap)
      // Empty slot — a dashed-feeling cream square.
      const slotG = this.add.graphics().setDepth(3)
      const r = slotSize * 0.2
      slotG.fillStyle(0xffffff, 0.55)
      slotG.fillRoundedRect(x - slotSize / 2, slotY - slotSize / 2, slotSize, slotSize, r)
      slotG.lineStyle(Math.max(3, slotSize * 0.05), 0x4a2c8a, 0.5)
      slotG.strokeRoundedRect(x - slotSize / 2, slotY - slotSize / 2, slotSize, slotSize, r)
      this._roundContainer.add(slotG)

      this._slots.push({ x, y: slotY, size: slotSize, filled: false })
    }
  }

  _onItemTapped(sprite) {
    if (sprite.disabled) return
    sprite.disabled = true
    sprite.disableInteractive()
    if (sprite._pulseTween) sprite._pulseTween.stop()

    this._tappedSoFar += 1
    const count = this._tappedSoFar

    // 1. Pop animation + fade.
    if (!this.reducedMotion) {
      this.tweens.add({
        targets: sprite,
        scale: sprite.scaleX * 1.25,
        alpha: 0,
        duration: 360,
        ease: 'Back.easeOut',
        onComplete: () => sprite.destroy()
      })
    } else {
      sprite.destroy()
    }

    // 2. Play the spoken number ("ONE!", "TWO!"…). Reuses the bundled
    // `/audio/levels/{lang}/numbers/{letter}.mp3` library — instant playback
    // because they're loaded as static assets, not API calls.
    //
    // Silence any number still playing first: a toddler tapping fast would
    // otherwise hear "one" and "two" overlap. stopAllLevelAudio() pauses +
    // rewinds every cached clip (including the one we're about to replay).
    stopAllLevelAudio()
    const lang = settings.language()
    const letter = String.fromCharCode(96 + count) // 1→'a', 2→'b'...
    // Spoken count word only ("One!"), via the `count` pack — NOT the spelled
    // `numbers` audio. The digit-glyph texture below still uses `asset_numbers`.
    preloadLevelAudio(`asset_count_${letter}`, lang)
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

    // 3. Fill the next digit slot with the corresponding number texture.
    const slot = this._slots[count - 1]
    if (slot && !slot.filled) {
      slot.filled = true
      const digit = this.add
        .image(slot.x, slot.y, `asset_numbers_${letter}`)
        .setDepth(4)
        .setScale(0)
      const targetScale = (slot.size * 0.85) / Math.max(digit.width, digit.height || digit.width)
      this._roundContainer.add(digit)
      if (this.reducedMotion) {
        digit.setScale(targetScale)
      } else {
        this.tweens.add({
          targets: digit,
          scale: targetScale,
          duration: 280,
          ease: 'Back.easeOut'
        })
      }
    }

    // 4. Match-drop ding for tactile feedback.
    try {
      if (this.cache.audio.exists('ui_letter_pop')) {
        // Slight pitch-up per count gives the count sequence a musical
        // staircase feel — same trick celebrate.js uses for letter reveals.
        const stride = count / MAX_COUNT
        const detune = -100 + stride * 400
        this.sound.play('ui_letter_pop', { volume: 0.5, detune })
      }
    } catch {
      /* audio is best-effort */
    }

    this.score += 1
    this.scoreBoard.setScore(this.score)

    // 5. Round complete?
    if (this._tappedSoFar >= this._roundCount) {
      this.time.delayedCall(700, () => this._advanceRound())
    }
  }

  _advanceRound() {
    // Brief fade-out of the round container, then start the next round (or
    // hand off to level-complete if we just finished round MAX_COUNT).
    const next = this._roundCount + 1
    const finalize = () => {
      if (this._roundContainer) {
        this._roundContainer.destroy()
        this._roundContainer = null
      }
      if (next > MAX_COUNT) {
        if (this.completed) return
        this.completed = true
        this.input.enabled = false
        showLevelComplete(this, () =>
          this.scene.start(pickNextSceneExcluding('GameJ'))
        )
      } else {
        this._startRound(next)
      }
    }
    if (this.reducedMotion) {
      finalize()
    } else {
      this.tweens.add({
        targets: this._roundContainer,
        alpha: 0,
        duration: 220,
        ease: 'Quad.easeIn',
        onComplete: finalize
      })
    }
  }
}
