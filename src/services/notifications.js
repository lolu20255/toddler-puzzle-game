/**
 * Notifications — local reminders + remote push.
 *
 * Kids-app note: we **never** touch the PushNotifications plugin from
 * `initialize()`. On a real iOS device, calling `PushNotifications.*` without
 * the "Push Notifications" Xcode capability enabled (the default after
 * `cap add ios`) can kill the WebContent process — the iOS Simulator is much
 * more permissive about this. Everything push-related is deferred until a
 * deliberate opt-in via `requestPushPermission()`.
 *
 * Local notifications need no entitlement and are the safest re-engagement
 * tool for a children's app.
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNativePlatform } from './platform'

const REMINDER_ID = 1001

class NotificationsService {
  constructor() {
    this.pushToken = null
    this._pushListenersAttached = false
  }

  /** Intentionally a no-op. See file header. */
  async initialize() {
    /* deferred — call requestPushPermission() from an opt-in screen */
  }

  async _ensurePushListeners() {
    if (this._pushListenersAttached) return
    this._pushListenersAttached = true
    const { PushNotifications } = await import('@capacitor/push-notifications')
    PushNotifications.addListener('registration', (token) => {
      this.pushToken = token.value
      console.log('[Notifications] push token:', token.value)
    })
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Notifications] push registration error:', err)
    })
    PushNotifications.addListener('pushNotificationReceived', (n) => {
      console.log('[Notifications] push received:', n)
    })
    PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      console.log('[Notifications] push action:', a)
    })
  }

  /**
   * Opt-in for remote push. Call this from a deliberate user action — never
   * on launch, and never until the "Push Notifications" capability has been
   * enabled in Xcode.
   */
  async requestPushPermission() {
    if (!isNativePlatform()) return false
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      await this._ensurePushListeners()
      const perm = await PushNotifications.requestPermissions()
      if (perm.receive === 'granted') {
        await PushNotifications.register()
        return true
      }
    } catch (error) {
      console.error('[Notifications] requestPushPermission error:', error)
    }
    return false
  }

  /** Prompt for local-notification permission. */
  async requestLocalPermission() {
    if (!isNativePlatform()) return false
    try {
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === 'granted'
    } catch (error) {
      console.error('[Notifications] requestLocalPermission error:', error)
      return false
    }
  }

  /**
   * Schedule a single gentle "come back and play" reminder. Re-scheduling
   * replaces the previous one (same id).
   */
  async schedulePlayReminder({
    hoursFromNow = 24,
    title = 'Come play! 🧩',
    body = 'Your puzzles are waiting for you.'
  } = {}) {
    if (!isNativePlatform()) return
    const granted = await this.requestLocalPermission()
    if (!granted) return
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REMINDER_ID,
            title,
            body,
            schedule: { at: new Date(Date.now() + hoursFromNow * 3600 * 1000) }
          }
        ]
      })
    } catch (error) {
      console.error('[Notifications] schedule error:', error)
    }
  }

  /** Cancel any pending local reminders. */
  async cancelReminders() {
    if (!isNativePlatform()) return
    try {
      const pending = await LocalNotifications.getPending()
      if (pending.notifications.length) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id }))
        })
      }
    } catch (error) {
      console.error('[Notifications] cancel error:', error)
    }
  }
}

export const notificationsService = new NotificationsService()
