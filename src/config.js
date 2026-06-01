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
