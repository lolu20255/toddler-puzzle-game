/**
 * App-level user settings.
 *
 * Prefs:
 *   - `hapticsEnabled`  — whether the `haptics` service fires native taps.
 *   - `language`        — 'en' | 'es', drives celebration audio + word labels.
 *
 * Values are persisted to Capacitor Preferences via `Storage`, but also held
 * in a sync in-memory cache so hot paths (celebration audio phrase build,
 * haptic taps) don't have to `await`. Call `settings.load()` once at boot
 * before reading; everything else is synchronous.
 *
 * `onChange(fn)` lets other services react to a settings change without
 * re-reading from disk — used so `haptics` flips off the moment the toggle
 * is flipped, without a scene restart.
 */
import { Storage } from './storage'

const HAPTICS_ENABLED_KEY = 'hapticsEnabled'
const LANGUAGE_KEY = 'language'
const ONBOARDING_COMPLETE_KEY = 'onboardingComplete'
// Rate-us prompt bookkeeping. The Vue `RateUs.vue` overlay reads these to
// decide whether to actually open after a level completes — see the rules in
// the component's `onCheck` handler (rated? prompt count? days since last
// dismiss? enough puzzles solved?).
const RATE_US_PROMPT_COUNT_KEY = 'rateUsPromptCount'
const RATE_US_RATED_KEY = 'rateUsRated'
const RATE_US_DISMISSED_AT_KEY = 'rateUsDismissedAt'
const PUZZLES_COMPLETED_KEY = 'puzzlesCompleted'

/** Allowed values for `language`. */
export const SUPPORTED_LANGUAGES = ['en', 'es']

const cache = {
  hapticsEnabled: true,
  language: 'en', // 'en' | 'es' — drives the celebration audio + word labels
  // First-launch parent onboarding sentinel. Boot checks this; if false we
  // show the 2-step Vue Onboarding flow (welcome → language) before
  // MainMenu. Resetting it (Settings → Debug, when TESTING_FEATURES is on)
  // lets devs re-run the flow without uninstalling.
  onboardingComplete: false,
  // ── Rate-us tracking ─────────────────────────────────────────────────
  // How many times the in-app rate prompt has been shown. Capped at 3 by
  // the prompt's gating logic so parents who dismiss it aren't nagged.
  rateUsPromptCount: 0,
  // True once the parent has tapped "Rate the app" (we treat this as
  // "rated" — there's no way to know for sure the OS-level dialog landed
  // a review). Suppresses the prompt forever once set.
  rateUsRated: false,
  // Epoch ms of the most recent "Maybe later" / "Don't ask again" tap.
  // Used to enforce a few-day cooldown before re-prompting.
  rateUsDismissedAt: 0,
  // Total level-complete events across the lifetime of the install. The
  // rate prompt skips toddlers who haven't finished at least a handful
  // of puzzles yet (so we don't ask before there's anything to like).
  puzzlesCompleted: 0
}
let loaded = false
const listeners = new Set()

function notify() {
  for (const fn of listeners) {
    try {
      fn({ ...cache })
    } catch (e) {
      console.error('[Settings] listener error:', e)
    }
  }
}

export const settings = {
  /** Hydrate the cache from disk. Idempotent. */
  async load() {
    if (loaded) return
    try {
      const [
        haptics,
        language,
        onboarding,
        rateUsPromptCount,
        rateUsRated,
        rateUsDismissedAt,
        puzzlesCompleted
      ] = await Promise.all([
        Storage.get(HAPTICS_ENABLED_KEY),
        Storage.get(LANGUAGE_KEY),
        Storage.get(ONBOARDING_COMPLETE_KEY),
        Storage.get(RATE_US_PROMPT_COUNT_KEY),
        Storage.get(RATE_US_RATED_KEY),
        Storage.get(RATE_US_DISMISSED_AT_KEY),
        Storage.get(PUZZLES_COMPLETED_KEY)
      ])
      if (haptics != null) cache.hapticsEnabled = haptics !== 'false'
      if (SUPPORTED_LANGUAGES.includes(language)) cache.language = language
      if (onboarding != null) cache.onboardingComplete = onboarding === 'true'
      if (rateUsPromptCount != null) {
        const n = parseInt(rateUsPromptCount, 10)
        if (Number.isFinite(n) && n >= 0) cache.rateUsPromptCount = n
      }
      if (rateUsRated != null) cache.rateUsRated = rateUsRated === 'true'
      if (rateUsDismissedAt != null) {
        const n = parseInt(rateUsDismissedAt, 10)
        if (Number.isFinite(n) && n >= 0) cache.rateUsDismissedAt = n
      }
      if (puzzlesCompleted != null) {
        const n = parseInt(puzzlesCompleted, 10)
        if (Number.isFinite(n) && n >= 0) cache.puzzlesCompleted = n
      }
    } catch (e) {
      console.warn('[Settings] load failed, using defaults:', e?.message || e)
    }
    loaded = true
  },

  hapticsEnabled() {
    return cache.hapticsEnabled
  },

  language() {
    return cache.language
  },

  async setHapticsEnabled(value) {
    cache.hapticsEnabled = !!value
    try {
      await Storage.set(HAPTICS_ENABLED_KEY, String(cache.hapticsEnabled))
    } catch (e) {
      console.warn('[Settings] save haptics failed:', e?.message || e)
    }
    notify()
  },

  async setLanguage(value) {
    if (!SUPPORTED_LANGUAGES.includes(value)) return
    cache.language = value
    try {
      await Storage.set(LANGUAGE_KEY, value)
    } catch (e) {
      console.warn('[Settings] save language failed:', e?.message || e)
    }
    notify()
  },

  onboardingComplete() {
    return cache.onboardingComplete
  },

  async setOnboardingComplete(value) {
    cache.onboardingComplete = !!value
    try {
      await Storage.set(ONBOARDING_COMPLETE_KEY, String(cache.onboardingComplete))
    } catch (e) {
      console.warn('[Settings] save onboarding flag failed:', e?.message || e)
    }
    notify()
  },

  // ── Rate-us ──────────────────────────────────────────────────────────
  rateUsPromptCount() {
    return cache.rateUsPromptCount
  },

  async setRateUsPromptCount(value) {
    const n = parseInt(value, 10)
    cache.rateUsPromptCount = Number.isFinite(n) && n >= 0 ? n : 0
    try {
      await Storage.set(RATE_US_PROMPT_COUNT_KEY, String(cache.rateUsPromptCount))
    } catch (e) {
      console.warn('[Settings] save rateUsPromptCount failed:', e?.message || e)
    }
    notify()
  },

  rateUsRated() {
    return cache.rateUsRated
  },

  async setRateUsRated(value) {
    cache.rateUsRated = !!value
    try {
      await Storage.set(RATE_US_RATED_KEY, String(cache.rateUsRated))
    } catch (e) {
      console.warn('[Settings] save rateUsRated failed:', e?.message || e)
    }
    notify()
  },

  rateUsDismissedAt() {
    return cache.rateUsDismissedAt
  },

  async setRateUsDismissedAt(value) {
    const n = parseInt(value, 10)
    cache.rateUsDismissedAt = Number.isFinite(n) && n >= 0 ? n : 0
    try {
      await Storage.set(RATE_US_DISMISSED_AT_KEY, String(cache.rateUsDismissedAt))
    } catch (e) {
      console.warn('[Settings] save rateUsDismissedAt failed:', e?.message || e)
    }
    notify()
  },

  // ── Puzzles completed ────────────────────────────────────────────────
  puzzlesCompleted() {
    return cache.puzzlesCompleted
  },

  async setPuzzlesCompleted(value) {
    const n = parseInt(value, 10)
    cache.puzzlesCompleted = Number.isFinite(n) && n >= 0 ? n : 0
    try {
      await Storage.set(PUZZLES_COMPLETED_KEY, String(cache.puzzlesCompleted))
    } catch (e) {
      console.warn('[Settings] save puzzlesCompleted failed:', e?.message || e)
    }
    notify()
  },

  /**
   * Bump the lifetime puzzles-completed counter by one and persist. Sync
   * cache update first so callers reading `puzzlesCompleted()` right after
   * this returns see the new value even while the Storage write is in
   * flight.
   */
  async incrementPuzzlesCompleted() {
    cache.puzzlesCompleted += 1
    try {
      await Storage.set(PUZZLES_COMPLETED_KEY, String(cache.puzzlesCompleted))
    } catch (e) {
      console.warn('[Settings] increment puzzlesCompleted failed:', e?.message || e)
    }
    notify()
    return cache.puzzlesCompleted
  },

  /** Subscribe to changes. Returns an unsubscribe function. */
  onChange(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}
