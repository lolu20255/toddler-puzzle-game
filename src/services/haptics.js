/**
 * Haptic feedback.
 *
 * Small tactile cues make the game feel responsive for toddlers. Every method
 * is a safe no-op off-device, and never throws — haptics are a nice-to-have
 * and must never block gameplay.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNativePlatform } from './platform'
import { settings } from './settings'

/** True when haptics should fire — native + user has it enabled in Settings. */
function allowed() {
  return isNativePlatform() && settings.hapticsEnabled()
}

export const haptics = {
  /** Light tick — use for picking up / tapping a piece. */
  async tap() {
    if (!allowed()) return
    try {
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {
      /* ignore */
    }
  },

  /** Firmer bump — use for dropping a piece onto a slot. */
  async medium() {
    if (!allowed()) return
    try {
      await Haptics.impact({ style: ImpactStyle.Medium })
    } catch {
      /* ignore */
    }
  },

  /** Celebratory pattern — use when a puzzle is solved. */
  async success() {
    if (!allowed()) return
    try {
      await Haptics.notification({ type: NotificationType.Success })
    } catch {
      /* ignore */
    }
  },

  /** Subtle change — use when a selection moves between options. */
  async selection() {
    if (!allowed()) return
    try {
      await Haptics.selectionChanged()
    } catch {
      /* ignore */
    }
  }
}
