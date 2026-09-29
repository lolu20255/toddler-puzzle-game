/**
 * Compile-time app configuration. Pure constants — never reads from
 * runtime state. Add things here when the value is decided once per
 * build and shouldn't be user-toggleable.
 *
 * For runtime user preferences see `src/services/settings.js`.
 *
 * Pattern borrowed from /Users/mariodiaz/Development/Apps/s3-sync/lib/config.js
 */

export const TESTING_FEATURES = false
export const FORCE_PREMIUM = false
export const CUSTOM_RATE_US_ENABLED = false
