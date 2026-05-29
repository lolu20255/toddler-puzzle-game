/**
 * App-level user settings.
 *
 * Two prefs today:
 *   - `toddlerName`     — the name the celebration audio uses ("Good job
 *                          <name>!"). Empty string ⇒ "Good job!" (no name).
 *   - `hapticsEnabled`  — whether the `haptics` service fires native taps.
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

const TODDLER_NAME_KEY = 'toddlerName'
const HAPTICS_ENABLED_KEY = 'hapticsEnabled'
const LANGUAGE_KEY = 'language'

/** Allowed values for `language`. */
export const SUPPORTED_LANGUAGES = ['en', 'es']

const cache = {
  toddlerName: '',
  hapticsEnabled: true,
  language: 'en' // 'en' | 'es' — drives the celebration audio + word labels
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
      const [name, haptics, language] = await Promise.all([
        Storage.get(TODDLER_NAME_KEY),
        Storage.get(HAPTICS_ENABLED_KEY),
        Storage.get(LANGUAGE_KEY)
      ])
      if (name != null) cache.toddlerName = String(name)
      if (haptics != null) cache.hapticsEnabled = haptics !== 'false'
      if (SUPPORTED_LANGUAGES.includes(language)) cache.language = language
    } catch (e) {
      console.warn('[Settings] load failed, using defaults:', e?.message || e)
    }
    loaded = true
  },

  toddlerName() {
    return cache.toddlerName
  },

  hapticsEnabled() {
    return cache.hapticsEnabled
  },

  language() {
    return cache.language
  },

  async setToddlerName(name) {
    cache.toddlerName = String(name || '').trim().slice(0, 20)
    try {
      await Storage.set(TODDLER_NAME_KEY, cache.toddlerName)
    } catch (e) {
      console.warn('[Settings] save name failed:', e?.message || e)
    }
    notify()
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

  /** Subscribe to changes. Returns an unsubscribe function. */
  onChange(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}
