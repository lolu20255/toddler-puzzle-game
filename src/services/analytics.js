/**
 * Privacy-safe analytics.
 *
 * This is a children's app, so it must comply with COPPA, GDPR-K, the Apple
 * Kids Category and Google Play Families policy. That rules out the usual
 * analytics SDKs (Firebase, Amplitude, GA), which collect device identifiers.
 *
 * So this is a deliberately minimal abstraction: it records *anonymous,
 * aggregate* gameplay events (no names, no IDs, no ad identifiers) and, by
 * default, only logs them locally. If you ever need remote analytics, send the
 * event from `dispatch()` to a COPPA-compliant, child-directed endpoint — and
 * never add personal data to the payload.
 */
import { getPlatform } from './platform'

const DEBUG = import.meta.env.DEV

class AnalyticsService {
  constructor() {
    this.enabled = true
  }

  /** Record an anonymous event, e.g. logEvent('puzzle_completed', { game: 'A' }). */
  logEvent(name, params = {}) {
    if (!this.enabled) return
    const event = { name, params, platform: getPlatform(), ts: Date.now() }
    if (DEBUG) console.log('[Analytics]', name, params)
    this.dispatch(event)
  }

  /** Convenience wrapper for screen/scene views. */
  trackScreen(screenName) {
    this.logEvent('screen_view', { screen: screenName })
  }

  /**
   * Delivery point. No-op by default. To enable remote analytics, POST
   * `event` to a child-directed, COPPA-compliant endpoint here.
   */
  // eslint-disable-next-line no-unused-vars
  dispatch(event) {
    /* intentionally empty — local-only by default */
  }

  /** Allow users/parents to opt out. */
  setEnabled(value) {
    this.enabled = value
  }
}

export const analytics = new AnalyticsService()
