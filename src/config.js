/**
 * Compile-time app configuration. Pure constants — never reads from
 * runtime state. Add things here when the value is decided once per
 * build and shouldn't be user-toggleable.
 *
 * For runtime user preferences see `src/services/settings.js`.
 *
 * Pattern borrowed from /Users/mariodiaz/Development/Apps/s3-sync/lib/config.js
 */

/**
 * Master switch for in-development debug surfaces. When `true`, dev-only
 * UI (planned: Settings → ABOUT diagnostics, "skip celebration" / "force
 * complete" buttons, sandbox-state inspectors, etc.) is exposed.
 *
 * Flip to `false` before shipping a release build to hide them.
 */
export const TESTING_FEATURES = false

/**
 * Local override for the RevenueCat-backed premium entitlement. When
 * `true`, `purchasesService.hasFullAccess()` short-circuits to `true`
 * regardless of the real RevenueCat status — useful for exercising
 * premium-gated paths (locked-card unlocking, paywall bypass, original
 * by-theme card order) without running through a StoreKit sandbox
 * purchase every time.
 *
 * MUST be `false` in production builds. The check is wired into
 * `purchases.js` so MainMenu's card-build also picks it up synchronously.
 */
export const FORCE_PREMIUM = true

/**
 * Master switch for the "rate the app" feature (the RateUs.vue overlay AND the
 * rate card in the Settings scene). Disabled for the initial submission: the
 * app has no live App Store listing yet, so `InAppReview.requestReview()` shows
 * nothing and the Settings card's review URL is a placeholder — both read as
 * "unresponsive" to a reviewer (Apple Guideline 2.1(a)).
 *
 * To re-enable after the app is live: set this to `true` and replace the
 * placeholder `RATE_APP_URL_IOS` in `src/game/scenes/Settings.js` with the real
 * `https://apps.apple.com/app/id<APP_ID>?action=write-review` link.
 */
export const RATE_US_ENABLED = false
