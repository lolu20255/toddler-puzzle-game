/**
 * Amplitude analytics.
 *
 * Tracks anonymous-ish gameplay engagement for funnel analysis (onboarding
 * drop-off, paywall view → purchase, replay frequency). Off-device every
 * method is a safe no-op so the browser dev build never crashes; on-device
 * every call is wrapped in try/catch so a bad event never breaks a game flow.
 *
 * EventBus-driven instrumentation
 * ───────────────────────────────
 * Phaser scenes + Vue components emit small `EventBus` events at points
 * of interest (`scene:view`, `level:completed`, `paywall:viewed`, etc.).
 * `initialize()` registers translation listeners that forward each event
 * to the right `trackXxx` convenience method here — this keeps gameplay
 * code completely decoupled from the analytics module: it never imports
 * `amplitudeService` directly.
 *
 * Configuration
 * ─────────────
 * Reads `VITE_AMPLITUDE_API_KEY` from `import.meta.env`. If unset, every
 * call is a logged no-op — fine for dev / a release without analytics.
 * Mirrors the env-var convention used by `purchases.js`.
 *
 * Event-naming convention
 * ───────────────────────
 * snake_case event names (Amplitude norm), camelCase property keys.
 * Event taxonomy mirrors libro-ai-app's amplitude service where possible
 * (e.g. `paywall_opened`, `onboarding_step_*`, `subscription`) so the
 * dashboards stay consistent across the developer's two apps.
 */
import { Device } from '@capacitor/device'
import { EventBus } from '../game/EventBus'
import { settings } from './settings'
import { getPlatform } from './platform'
import { TESTING_FEATURES } from '../config'

const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY || ''

class AmplitudeService {
  constructor() {
    this.initialized = false
    this.amp = null // populated by `initialize()` — null when API key unset
    this._listenersInstalled = false
  }

  /**
   * Initialise the SDK + set user properties + install EventBus listeners.
   *
   * Idempotent — safe to call from multiple places. If `VITE_AMPLITUDE_API_KEY`
   * is unset, logs a single warning and returns; every subsequent `track()`
   * call is a silent no-op. The EventBus listeners are still installed
   * either way so future calls don't have to re-check the init state.
   */
  async initialize() {
    if (this.initialized) return

    // Always wire up the EventBus translation listeners — even when the
    // API key is missing, so a flick of `VITE_AMPLITUDE_API_KEY` doesn't
    // require a code change to start collecting events.
    this._installEventBusListeners()

    if (!AMPLITUDE_API_KEY) {
      console.log('[Amplitude] No API key configured — analytics disabled')
      return
    }

    try {
      // Lazy import keeps the SDK out of the critical-path bundle on dev
      // builds where the env var is unset.
      const amp = await import('@amplitude/analytics-browser')
      this.amp = amp

      amp.init(AMPLITUDE_API_KEY, {
        // `defaultTracking: true` is the deprecated-but-still-supported
        // shortcut for sessions + pageViews. The newer `autocapture` shape
        // gives us finer control going forward; passing both is harmless.
        defaultTracking: true,
        autocapture: {
          sessions: true,
          pageViews: true
        }
      })

      this.initialized = true

      // Identify the install. Device.getId() returns a stable per-install
      // identifier on iOS/Android (the IDFV on iOS, an Android ID variant on
      // Android); on web we fall back to whatever Amplitude generates.
      try {
        const { identifier } = await Device.getId()
        if (identifier) {
          amp.setUserId(identifier)
        }
      } catch (e) {
        console.warn('[Amplitude] Device.getId failed:', e?.message || e)
      }

      // Set identifying user properties so dashboards can slice by platform /
      // app version / language without joining events.
      this._setInitialUserProperties()

      console.log('[Amplitude] Initialised')
    } catch (error) {
      console.error('[Amplitude] init error:', error)
    }
  }

  _setInitialUserProperties() {
    if (!this.initialized) return
    try {
      const identify = new this.amp.Identify()
      identify.set('platform', getPlatform())
      try {
        // Injected by Vite `define` at build time.
        // eslint-disable-next-line no-undef
        identify.set('appVersion', __APP_VERSION__)
      } catch {
        /* __APP_VERSION__ not defined — fine */
      }
      identify.set('language', settings.language())
      this.amp.identify(identify)
    } catch (e) {
      console.warn('[Amplitude] setInitialUserProperties failed:', e?.message || e)
    }
  }

  /**
   * Send a custom event. Safe no-op when not initialised. Every failure is
   * swallowed — analytics must NEVER break the game.
   *
   * `TESTING_FEATURES` echoes events to the console for sanity-checking the
   * EventBus → Amplitude pipeline in dev.
   */
  track(eventName, properties = {}) {
    if (TESTING_FEATURES) {
      console.log(`[Amplitude] event: ${eventName}`, properties)
    }
    if (!this.initialized || !this.amp) return
    try {
      this.amp.track(eventName, properties)
    } catch (error) {
      console.error(`[Amplitude] track(${eventName}) failed:`, error)
    }
  }

  /** Update the user id + a batch of user properties at once. */
  identify(userId, properties = {}) {
    if (!this.initialized || !this.amp) return
    try {
      if (userId) this.amp.setUserId(userId)
      const id = new this.amp.Identify()
      for (const [k, v] of Object.entries(properties)) id.set(k, v)
      this.amp.identify(id)
    } catch (error) {
      console.error('[Amplitude] identify failed:', error)
    }
  }

  /** Convenience — update a single user property. */
  setUserProperty(key, value) {
    if (!this.initialized || !this.amp) return
    try {
      const id = new this.amp.Identify()
      id.set(key, value)
      this.amp.identify(id)
    } catch (error) {
      console.error(`[Amplitude] setUserProperty(${key}) failed:`, error)
    }
  }

  // ────────────────────────────────────────────────────────── convenience
  //
  // Pre-defined methods so event names + property shapes stay consistent
  // across the codebase (and matchable in dashboards across the developer's
  // other apps that share the same taxonomy).

  /** App opened — bumps each launch. Mirrors the existing `analytics.logEvent('app_open', …)`. */
  trackAppOpen({ count } = {}) {
    this.track('app_open', { count })
  }

  /** Phaser scene viewed (or a locked card was tapped — `locked: true`). */
  trackSceneView(sceneKey, properties = {}) {
    this.track('scene_view', { scene: sceneKey, ...properties })
  }

  /**
   * Paywall + IAP funnel.
   * action ∈ {view, purchase_started, purchase_completed, purchase_cancelled,
   *           purchase_failed, restore_started, restore_completed,
   *           restore_no_purchases, restore_failed}
   */
  trackPaywall(action, properties = {}) {
    // Use the same `paywall_*` event-family naming libro uses
    // (`paywall_opened`, `subscription`) so dashboards generalise.
    if (action === 'view') {
      this.track('paywall_opened', properties)
      return
    }
    this.track('subscription', { action, ...properties })
  }

  /** Onboarding step transitions. step ∈ {welcome, name, language, complete} */
  trackOnboarding(step, properties = {}) {
    if (step === 'complete') {
      this.track('onboarding_completed', properties)
      return
    }
    this.track('onboarding_step_viewed', { step, ...properties })
  }

  /** Per-level lifecycle. action ∈ {started, piece_matched, completed} */
  trackLevel(action, properties = {}) {
    this.track(`level_${action}`, properties)
  }

  // ─────────────────────────────────────────────── EventBus → tracker
  //
  // Phaser scenes + Vue components emit small EventBus events; this layer
  // translates each one to an amplitude call. Keeps the call sites simple
  // (just `EventBus.emit(...)`, no amplitude import) and means we can rename
  // / extend event taxonomy here without touching the rest of the codebase.

  _installEventBusListeners() {
    if (this._listenersInstalled) return
    this._listenersInstalled = true

    EventBus.on('app:open', (payload = {}) => {
      this.trackAppOpen({ count: payload.count })
    })

    EventBus.on('scene:view', (payload = {}) => {
      const { scene, ...rest } = payload
      this.trackSceneView(scene, rest)
    })

    EventBus.on('level:started', (payload = {}) => {
      this.trackLevel('started', payload)
    })
    EventBus.on('level:completed', (payload = {}) => {
      this.trackLevel('completed', payload)
    })
    EventBus.on('puzzle:matched', (payload = {}) => {
      this.trackLevel('piece_matched', payload)
    })

    // ── Paywall funnel ─────────────────────────────────────────────────
    EventBus.on('paywall:viewed', (payload = {}) => {
      this.trackPaywall('view', payload)
    })
    EventBus.on('paywall:purchase_started', (payload = {}) => {
      this.trackPaywall('purchase_started', payload)
    })
    EventBus.on('paywall:purchase_completed', (payload = {}) => {
      this.trackPaywall('purchase_completed', payload)
    })
    EventBus.on('paywall:purchase_cancelled', (payload = {}) => {
      this.trackPaywall('purchase_cancelled', payload)
    })
    EventBus.on('paywall:purchase_failed', (payload = {}) => {
      this.trackPaywall('purchase_failed', payload)
    })
    EventBus.on('paywall:restore_started', (payload = {}) => {
      this.trackPaywall('restore_started', payload)
    })
    EventBus.on('paywall:restore_completed', (payload = {}) => {
      this.trackPaywall('restore_completed', payload)
    })
    EventBus.on('paywall:restore_no_purchases', (payload = {}) => {
      this.trackPaywall('restore_no_purchases', payload)
    })
    EventBus.on('paywall:restore_failed', (payload = {}) => {
      this.trackPaywall('restore_failed', payload)
    })

    // ── Onboarding funnel ──────────────────────────────────────────────
    EventBus.on('onboarding:step', (payload = {}) => {
      const { step, ...rest } = payload
      this.trackOnboarding(step, rest)
    })
    EventBus.on('onboarding:complete', (payload = {}) => {
      this.trackOnboarding('complete', payload)
    })
  }
}

export const amplitudeService = new AmplitudeService()
