/**
 * Unified key/value storage.
 *
 * Backed by `@capacitor/preferences`, which uses native storage on device and
 * localStorage in the browser — so the same API works everywhere with no
 * platform branching.
 */
import { Preferences } from '@capacitor/preferences'

export const Storage = {
  /** Returns the raw string value, or null. */
  async get(key) {
    const { value } = await Preferences.get({ key })
    return value
  },

  /** Returns a parsed JSON value, or `fallback` if missing/invalid. */
  async getJSON(key, fallback = null) {
    const value = await this.get(key)
    if (value == null) return fallback
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  },

  /** Stores a value. Objects are JSON-stringified automatically. */
  async set(key, value) {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await Preferences.set({ key, value: serialized })
  },

  async remove(key) {
    await Preferences.remove({ key })
  },

  async clear() {
    await Preferences.clear()
  }
}
