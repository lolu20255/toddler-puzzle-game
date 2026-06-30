import Phaser, { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { settings, SUPPORTED_LANGUAGES } from '../../services/settings'
import { purchasesService } from '../../services/purchases'
import { addBackButton } from '../hud'
import { getGrid } from '../layout'
import { RATE_US_ENABLED } from '../../config'

// Provided by Vite `define` in vite/config.*.mjs from package.json#version.
const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'

// TODO: replace with the real App Store listing ID once the build is in
// review. Until then this URL 404s gracefully and the card stays tappable
// so the design surface is testable.
const RATE_APP_URL_IOS =
  'https://apps.apple.com/app/idYOUR_APP_ID?action=write-review'
const MANAGE_SUBSCRIPTION_URL_IOS =
  'itms-apps://apps.apple.com/account/subscriptions'

const DPR = Math.min(window.devicePixelRatio || 1, 2)

/**
 * Parent-facing Settings, reached via the cog top-right of the MainMenu.
 * Consistent rounded-white cards stacked vertically:
 *   1. Learning language — English / Español pill picker
 *   2. Vibration on/off toggle
 *
 * Each card uses the same visual recipe (shadow → body → orange accent border
 * → top highlight + tiny uppercase section label) so the screen reads as a
 * unified settings panel rather than three loose controls floating in the sky.
 *
 * All interactive elements use a separate transparent Phaser.Rectangle as the
 * hit zone — Container input was unreliable in this Phaser/iOS WebView combo,
 * Rectangle input is rock-solid.
 */
export class Settings extends Scene {
  constructor() {
    super('Settings')
  }

  create() {
    this.sWidth = this.cameras.main.width
    this.sHeight = this.cameras.main.height
    this.minSide = Math.min(this.sWidth, this.sHeight)
    this.grid = getGrid(this)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this._domHandles = []
    this._langPills = {}

    this.buildBackground()
    this.buildHeader()
    this.buildContent()
    this.buildVersionBadge()

    this.cameras.main.fadeIn(this.reducedMotion ? 0 : 280, 91, 182, 239)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._cleanup())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this._cleanup())

    EventBus.emit('current-scene-ready', this)
  }

  _cleanup() {
    for (const off of this._domHandles) {
      try {
        off()
      } catch {
        /* ignore */
      }
    }
    this._domHandles.length = 0
  }

  // ─── Background — same gradient sky + hills as the main menu ─────────────
  buildBackground() {
    const g = this.add.graphics().setDepth(0)
    const skyTop = 0x5bb6ef
    const skyBottom = 0xc6ecff
    g.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1)
    g.fillRect(0, 0, this.sWidth, this.sHeight)
    const hillW = this.sWidth * 1.6
    g.fillStyle(0x9bd34f, 1)
    g.fillEllipse(this.sWidth * 0.28, this.sHeight + this.sWidth * 0.18, hillW, this.sWidth * 0.9)
    g.fillStyle(0x7cc242, 1)
    g.fillEllipse(this.sWidth * 0.78, this.sHeight + this.sWidth * 0.24, hillW, this.sWidth * 0.78)
  }

  // ─── Header: iOS-style nav row — back chevron on the left, centred title
  // ───────────────────────────────────────────────────────────────────────
  // Both elements lock to `grid.navY` so the row reads as a single nav bar.
  // The back button comes from the shared HUD helper — pixel-identical to
  // the one used in every game scene.
  buildHeader() {
    addBackButton(this)
    this._buildTitle(this.grid.contentCenter, this.grid.navY)
  }

  _buildTitle(cx, cy) {
    const fontSize = this.minSide * 0.062
    const title = this.add
      .text(cx, cy, 'Settings', {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(15)
    title.setStroke('#e8881c', fontSize * 0.2)
    title.setShadow(0, fontSize * 0.06, 'rgba(0,0,0,0.28)', 3)
  }

  _navigateBack() {
    this.cameras.main.fadeOut(this.reducedMotion ? 0 : 240, 91, 182, 239)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MainMenu'))
  }

  // ─── Stacked setting cards ───────────────────────────────────────────────
  buildContent() {
    const top = this.sHeight * 0.16
    const bottom = this.sHeight * 0.9
    const regionH = bottom - top

    // Cards align to the shared grid — same LEFT edge as the back button,
    // same RIGHT edge as the (notional) cog/score pill in other scenes.
    const cardX = this.grid.contentCenter
    const cardW = this.grid.contentWidth

    // Card list (top to bottom). The rate-us card only appears when the rating
    // feature is enabled — it's off until the app is live, since its review
    // link is a placeholder that reads as an unresponsive button (Apple 2.1(a)).
    // `weight` is the card's height as a fraction of the region; gaps fill the
    // remainder evenly. Premium banner sits first (parents always see it).
    const cards = [
      { weight: 0.22, build: (cx, cy, w, h) => this.buildPremiumCard(cx, cy, w, h) },
      { weight: 0.32, build: (cx, cy, w, h) => this.buildLanguageCard(cx, cy, w, h) },
      { weight: 0.18, build: (cx, cy, w, h) => this.buildVibrationCard(cx, cy, w, h) }
    ]
    if (RATE_US_ENABLED) {
      cards.push({ weight: 0.16, build: (cx, cy, w, h) => this.buildRateUsCard(cx, cy, w, h) })
    }

    const totalCardsH = cards.reduce((sum, c) => sum + c.weight * regionH, 0)
    const gap = (regionH - totalCardsH) / (cards.length - 1)

    let cy = top
    for (const card of cards) {
      const h = card.weight * regionH
      cy += h / 2
      card.build(cardX, cy, cardW, h)
      cy += h / 2 + gap
    }

    // Rebuild the premium card if the parent buys / restores while sitting
    // on this screen (the Vue Paywall sits on top of Settings, not over MainMenu).
    this._onEntitlementUpdated = () => this.scene.restart()
    EventBus.on('entitlement:updated', this._onEntitlementUpdated)
    this.events.once('shutdown', () =>
      EventBus.off('entitlement:updated', this._onEntitlementUpdated)
    )
  }

  // ─── Premium badge (top) — pattern from snapvault Settings ───────────────
  //
  // Two states:
  //   • Not premium → sunshine-yellow card with crown + "Go Premium" + tagline.
  //     Tap → emits `paywall:open` (handled by the Vue Paywall overlay).
  //   • Premium    → same card, "Premium Active" + green ACTIVE pill.
  //     Tap → opens iOS subscription management (no-op on web).
  //
  // Yellow palette is intentionally different from the white-cream of the
  // other settings cards: this card is the SHOWPIECE, parents should glance
  // at it once and know "this is the upsell / membership status."
  buildPremiumCard(cx, cy, w, h) {
    const isPremium = purchasesService.cachedFullAccess
    const radius = Math.min(h * 0.32, this.minSide * 0.06)

    // 3-D card stack: shadow + dark-gold lip + sunshine face + glossy top.
    const g = this.add.graphics().setDepth(4)
    g.fillStyle(0x000000, 0.2)
    g.fillRoundedRect(cx - w / 2, cy - h / 2 + h * 0.07, w, h, radius)
    g.fillStyle(0xc99e00, 1) // dark gold lip
    g.fillRoundedRect(cx - w / 2, cy - h / 2 + h * 0.04, w, h, radius)
    g.fillStyle(0xffd23f, 1) // sunshine yellow face
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, radius)
    g.fillStyle(0xffffff, 0.34)
    g.fillRoundedRect(
      cx - w / 2 + w * 0.04,
      cy - h / 2 + h * 0.08,
      w * 0.92,
      h * 0.28,
      radius * 0.7
    )

    // Crown — emoji 👑 renders crisply on iOS WKWebView and Android WebView,
    // no procedural drawing needed (consistent with the pack icons that use
    // the OS emoji font for the Letters/Numbers icon overlays).
    const iconX = cx - w / 2 + h * 0.52
    const iconY = cy
    const iconR = h * 0.34
    this.add
      .text(iconX, iconY, '👑', { fontSize: `${iconR * 1.4}px` })
      .setOrigin(0.5)
      .setDepth(6)

    // Text block (title + subtitle, left-aligned)
    const textX = iconX + iconR * 1.2
    const titleSize = h * 0.22
    const subSize = h * 0.14
    const title = this.add
      .text(textX, cy - h * 0.13, isPremium ? 'Premium Active' : 'Go Premium', {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${titleSize}px`,
        color: '#4a2c8a',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(6)

    this.add
      .text(
        textX,
        cy + h * 0.14,
        isPremium
          ? 'Tap to manage subscription'
          : 'Unlock all puzzles & games',
        {
          fontFamily: '"Fredoka", sans-serif',
          fontSize: `${subSize}px`,
          color: '#7a4400'
        }
      )
      .setOrigin(0, 0.5)
      .setDepth(6)

    // Right-side accessory: green ACTIVE pill when premium, chevron when not.
    if (isPremium) {
      const pillW = w * 0.2
      const pillH = h * 0.28
      const pillX = cx + w / 2 - pillW / 2 - w * 0.05
      const pillG = this.add.graphics().setDepth(6)
      pillG.fillStyle(0x266b22, 1)
      pillG.fillRoundedRect(
        pillX - pillW / 2,
        cy - pillH / 2 + 2,
        pillW,
        pillH,
        pillH / 2
      )
      pillG.fillStyle(0x5fc34a, 1)
      pillG.fillRoundedRect(
        pillX - pillW / 2,
        cy - pillH / 2,
        pillW,
        pillH,
        pillH / 2
      )
      this.add
        .text(pillX, cy, 'ACTIVE', {
          fontFamily: '"Fredoka", sans-serif',
          fontSize: `${pillH * 0.42}px`,
          color: '#ffffff',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setDepth(7)
    } else {
      this.add
        .text(cx + w / 2 - w * 0.06, cy, '›', {
          fontFamily: '"Fredoka", sans-serif',
          fontSize: `${h * 0.55}px`,
          color: '#7d5d00',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setDepth(6)
    }

    // Hit zone — Rectangle on top because Container input is unreliable in
    // this Phaser/iOS WebView combo (same rationale as the cog button).
    const hit = this.add
      .rectangle(cx, cy, w, h, 0x000000, 0)
      .setDepth(8)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => {
      this.tweens.add({
        targets: [title],
        scale: { from: 1, to: 0.96 },
        duration: 90,
        yoyo: true,
        ease: 'Quad.easeOut'
      })
      if (isPremium) {
        try {
          window.open(MANAGE_SUBSCRIPTION_URL_IOS, '_blank')
        } catch {
          /* ignore */
        }
      } else {
        EventBus.emit('paywall:open')
      }
    })
  }

  // ─── Rate-us card (bottom) — pattern from snapvault RateUsCard ───────────
  //
  // Pink card (matches the Faces pack on MainMenu, intentional callback so
  // the colour reads as "warm / friendly" rather than "warning / alert").
  // Star icon in a yellow bubble + title + subtitle + chevron.
  // Tap → opens the App Store rate page in the system browser.
  buildRateUsCard(cx, cy, w, h) {
    const radius = Math.min(h * 0.32, this.minSide * 0.06)

    const g = this.add.graphics().setDepth(4)
    g.fillStyle(0x000000, 0.2)
    g.fillRoundedRect(cx - w / 2, cy - h / 2 + h * 0.07, w, h, radius)
    g.fillStyle(0xdb3f82, 1) // dark pink lip (matches Faces pack)
    g.fillRoundedRect(cx - w / 2, cy - h / 2 + h * 0.04, w, h, radius)
    g.fillStyle(0xff5da2, 1) // bubblegum pink face
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, radius)
    g.fillStyle(0xffffff, 0.32)
    g.fillRoundedRect(
      cx - w / 2 + w * 0.04,
      cy - h / 2 + h * 0.08,
      w * 0.92,
      h * 0.28,
      radius * 0.7
    )

    // Star icon — yellow disc with star emoji inside (echoes the upgrade
    // card's crown bubble visually so the two end-cards rhyme).
    const iconX = cx - w / 2 + h * 0.52
    const iconY = cy
    const iconR = h * 0.34
    const bubble = this.add.circle(iconX, iconY, iconR, 0xffd23f).setDepth(5)
    bubble.setStrokeStyle(Math.max(2, iconR * 0.12), 0xc99e00, 1)
    this.add
      .text(iconX, iconY + iconR * 0.02, '⭐', { fontSize: `${iconR * 1.05}px` })
      .setOrigin(0.5)
      .setDepth(6)

    // Title + subtitle
    const textX = iconX + iconR * 1.25
    const titleSize = h * 0.22
    const subSize = h * 0.14
    this.add
      .text(textX, cy - h * 0.13, 'Loving Puzzle Pals?', {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${titleSize}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(6)
    this.add
      .text(textX, cy + h * 0.14, 'Drop a star — it really helps!', {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: `${subSize}px`,
        color: '#ffffff'
      })
      .setOrigin(0, 0.5)
      .setDepth(6)
      .setAlpha(0.94)

    // Chevron
    this.add
      .text(cx + w / 2 - w * 0.06, cy, '›', {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: `${h * 0.55}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(6)

    const hit = this.add
      .rectangle(cx, cy, w, h, 0x000000, 0)
      .setDepth(8)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => {
      try {
        window.open(RATE_APP_URL_IOS, '_blank')
      } catch {
        /* ignore */
      }
    })
  }

  /** Shared card background — white pill with shadow + orange accent border. */
  _drawCard(cx, cy, w, h) {
    const radius = Math.min(h * 0.26, this.minSide * 0.05)
    const g = this.add.graphics().setDepth(4)
    g.fillStyle(0x000000, 0.16)
    g.fillRoundedRect(cx - w / 2, cy - h / 2 + h * 0.04, w, h, radius)
    g.fillStyle(0xffffff, 0.97)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, radius)
    g.fillStyle(0xffce3a, 0.14)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h * 0.32, radius)
    g.lineStyle(Math.max(3, h * 0.03), 0xe8881c, 0.55)
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, radius)
    return g
  }

  /** Tiny uppercase section label sitting at the top of a card. */
  _sectionLabel(cx, y, text) {
    const size = this.minSide * 0.03
    const label = this.add
      .text(cx, y, text, {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${size}px`,
        color: '#a85f00',
        fontStyle: 'bold'
      })
      .setOrigin(0.5, 0)
      .setDepth(6)
    label.setLetterSpacing?.(size * 0.08)
    return label
  }

  /** Subtle italic hint sitting at the bottom of a card. */
  _hintLabel(cx, y, text) {
    const size = this.minSide * 0.024
    return this.add
      .text(cx, y, text, {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${size}px`,
        color: '#5a3a1a',
        fontStyle: 'italic',
        align: 'center',
        wordWrap: { width: this.sWidth * 0.78 }
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.7)
      .setDepth(6)
  }

  // ─── Card: learning language ─────────────────────────────────────────────
  buildLanguageCard(cx, cy, w, h) {
    this._drawCard(cx, cy, w, h)
    this._sectionLabel(cx, cy - h / 2 + h * 0.11, 'LEARNING')

    const pillW = w * 0.4
    const pillH = h * 0.34
    const pillGap = w * 0.03
    const pillY = cy - h * 0.04

    const enX = cx - pillW / 2 - pillGap / 2
    const esX = cx + pillW / 2 + pillGap / 2

    this._langPills.en = this._createLangPill(enX, pillY, pillW, pillH, 'English', 'en')
    this._langPills.es = this._createLangPill(esX, pillY, pillW, pillH, 'Español', 'es')
    this._refreshLangPills()

    this._hintLabel(cx, cy + h / 2 - h * 0.08, 'Puzzle audio will be spoken in this language')
  }

  _createLangPill(x, y, w, h, label, code) {
    const visuals = this.add.container(x, y).setDepth(6)
    const g = this.add.graphics()
    visuals.add(g)
    const fontSize = h * 0.4
    const text = this.add
      .text(0, 0, label, {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color: '#5a3a1a'
      })
      .setOrigin(0.5)
    visuals.add(text)
    visuals._g = g
    visuals._text = text
    visuals._w = w
    visuals._h = h

    // Independent Rectangle hit zone — see header note on Container input.
    const hit = this.add
      .rectangle(x, y, w + 20, h + 20, 0x000000, 0)
      .setDepth(7)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => {
      if (settings.language() === code) return
      settings.setLanguage(code)
      this._refreshLangPills()
      this.tweens.add({
        targets: visuals,
        scale: { from: 1.08, to: 1 },
        duration: this.reducedMotion ? 0 : 220,
        ease: 'Back.out'
      })
    })

    return visuals
  }

  _refreshLangPills() {
    const current = settings.language()
    for (const code of SUPPORTED_LANGUAGES) {
      const pill = this._langPills[code]
      if (!pill) continue
      const { _g: g, _text: text, _w: w, _h: h } = pill
      const radius = h / 2
      g.clear()
      const selected = code === current
      if (selected) {
        // Drop shadow under the raised pill
        g.fillStyle(0x000000, 0.22)
        g.fillRoundedRect(-w / 2, -h / 2 + h * 0.1, w, h, radius)
        // Sunny yellow body
        g.fillStyle(0xffce3a, 1)
        g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
        // Glossy top highlight
        g.fillStyle(0xffffff, 0.32)
        g.fillRoundedRect(-w / 2 + w * 0.06, -h / 2 + h * 0.08, w * 0.88, h * 0.32, radius * 0.6)
        // Orange border
        g.lineStyle(Math.max(2, h * 0.05), 0xe8881c, 1)
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
        text.setColor('#5a3a1a')
      } else {
        // Flat, low-emphasis
        g.fillStyle(0xffffff, 0.5)
        g.fillRoundedRect(-w / 2, -h / 2, w, h, radius)
        g.lineStyle(Math.max(2, h * 0.04), 0xa85f00, 0.4)
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius)
        text.setColor('#a85f00')
        text.setAlpha(0.85)
      }
    }
  }

  // ─── Card 3: vibration toggle ────────────────────────────────────────────
  buildVibrationCard(cx, cy, w, h) {
    this._drawCard(cx, cy, w, h)

    const padX = w * 0.07
    const labelSize = this.minSide * 0.045
    this.add
      .text(cx - w / 2 + padX, cy, 'Vibration', {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${labelSize}px`,
        color: '#5a3a1a',
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5)
      .setDepth(6)

    const toggleW = this.minSide * 0.18
    const toggleH = this.minSide * 0.085
    this._createToggle(
      cx + w / 2 - padX - toggleW / 2,
      cy,
      toggleW,
      toggleH,
      settings.hapticsEnabled(),
      (val) => settings.setHapticsEnabled(val)
    )
  }

  _createToggle(x, y, w, h, initialValue, onChange) {
    const visuals = this.add.container(x, y).setDepth(7)
    visuals.value = initialValue

    const track = this.add.graphics()
    const drawTrack = (val) => {
      track.clear()
      track.fillStyle(0x000000, 0.18)
      track.fillRoundedRect(-w / 2, -h / 2 + h * 0.12, w, h, h / 2)
      track.fillStyle(val ? 0x5fc34a : 0xb0b0b0, 1)
      track.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
      track.fillStyle(0xffffff, 0.24)
      track.fillRoundedRect(-w / 2 + w * 0.06, -h / 2 + h * 0.1, w * 0.88, h * 0.36, h * 0.4)
    }
    visuals.add(track)

    const knobR = h * 0.42
    const knobX = (val) => (val ? w / 2 - h / 2 : -w / 2 + h / 2)
    const knob = this.add.circle(knobX(visuals.value), 0, knobR, 0xffffff)
    knob.setStrokeStyle(Math.max(2, knobR * 0.08), 0x000000, 0.18)
    visuals.add(knob)
    drawTrack(visuals.value)

    // Rectangle hit zone with generous padding (toddlers, parents, both).
    const padX = 24
    const padY = 24
    const hit = this.add
      .rectangle(x, y, w + padX * 2, h + padY * 2, 0x000000, 0)
      .setDepth(8)
      .setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => {
      visuals.value = !visuals.value
      drawTrack(visuals.value)
      this.tweens.add({
        targets: knob,
        x: knobX(visuals.value),
        duration: this.reducedMotion ? 0 : 200,
        ease: 'Quad.easeOut'
      })
      onChange(visuals.value)
    })

    return visuals
  }

  // ─── Version badge — small, low-emphasis, bottom-centre ──────────────────
  buildVersionBadge() {
    const cx = this.grid.contentCenter
    const cy = this.sHeight * 0.95
    const fontSize = this.minSide * 0.026
    const text = this.add
      .text(cx, cy, `v ${APP_VERSION}`, {
        fontFamily: '"Fredoka", "Arial Rounded MT Bold", sans-serif',
        fontSize: `${fontSize}px`,
        color: '#5a3a1a',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(5)
    const padX = fontSize * 0.9
    const padY = fontSize * 0.35
    const w = text.displayWidth + padX * 2
    const h = text.displayHeight + padY * 2
    const radius = h / 2
    const g = this.add.graphics().setDepth(4)
    g.fillStyle(0xffffff, 0.6)
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, radius)
    g.lineStyle(1, 0x5a3a1a, 0.22)
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, radius)
  }
}
