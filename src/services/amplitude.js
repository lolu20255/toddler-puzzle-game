/**
 * Amplitude analytics: DISABLED.
 *
 * This app ships in the App Store Kids Category (ages 5 and under). Apple
 * Guideline 5.1.4 forbids transmitting any device identifier or personally
 * identifiable information to third-party analytics vendors in Kids apps.
 * The previous implementation set the Amplitude user id to the device IDFV,
 * which is exactly what that rule prohibits, so third-party analytics has
 * been removed entirely.
 *
 * This module is now an inert stub. It keeps the same public API surface
 * (`amplitudeService.initialize()`, `track()`, the `trackXxx` helpers) so
 * existing call sites (most importantly `native.js`) keep working without
 * changes, but every method is a no-op. No SDK is imported, no `Device.getId()`
 * is read, and nothing leaves the device.
 *
 * The `@amplitude/analytics-browser` dependency has been removed from
 * package.json so the SDK is not present in the shipped bundle or the native
 * binary that App Review scans.
 *
 * EventBus instrumentation (`scene:view`, `paywall:viewed`, etc.) is still
 * emitted by the rest of the codebase; those emits are simply no longer
 * forwarded anywhere. If a first-party, kid-safe analytics solution is added
 * later, re-wire it here behind these same methods.
 */

class AmplitudeService {
  constructor() {
    this.initialized = false
    this.amp = null
  }

  /** No-op. Third-party analytics is disabled for Kids Category compliance. */
  async initialize() {
    console.log('[Amplitude] disabled (Kids Category: no third-party analytics)')
  }

  /** No-op. */
  track() {}

  /** No-op. */
  identify() {}

  /** No-op. */
  setUserProperty() {}

  // ── Convenience helpers kept as no-ops so call sites stay valid ──────────
  /** No-op. */
  trackAppOpen() {}

  /** No-op. */
  trackSceneView() {}

  /** No-op. */
  trackPaywall() {}

  /** No-op. */
  trackOnboarding() {}

  /** No-op. */
  trackLevel() {}
}

export const amplitudeService = new AmplitudeService()
