/**
 * App-store ratings.
 *
 * Two ways to ask:
 *  - `requestReview()` — the OS-controlled native prompt. The system decides
 *    whether to actually show it, and rate-limits it. Best for a "happy
 *    moment" trigger (e.g. after solving several puzzles).
 *  - `openStoreReview()` — deep-links straight to the store's review page.
 *    Use this for an explicit "Rate us" button.
 *
 * Both resolve silently on any failure.
 */
import { InAppReview } from '@capacitor-community/in-app-review'
import { isNativePlatform, isAndroid, isIOS } from './platform'

const IOS_LINK = import.meta.env.VITE_PROD_IOS_LINK
const ANDROID_LINK = import.meta.env.VITE_PROD_ANDROID_LINK

export const appReview = {
  /** OS-controlled native review prompt. */
  async requestReview() {
    if (!isNativePlatform()) return
    try {
      await InAppReview.requestReview()
    } catch (error) {
      console.error('[appReview] requestReview error:', error)
    }
  },

  /** Deep-link to the store listing's "write a review" surface. */
  openStoreReview() {
    try {
      if (isAndroid()) {
        if (!ANDROID_LINK) return
        window.location.href = ANDROID_LINK
        return
      }
      if (!IOS_LINK) return
      const reviewUrl = `${IOS_LINK}?action=write-review`
      // itms-apps:// jumps straight into the App Store app.
      window.location.href =
        isIOS() && isNativePlatform()
          ? reviewUrl.replace('https://', 'itms-apps://')
          : reviewUrl
    } catch (error) {
      console.error('[appReview] openStoreReview error:', error)
    }
  }
}
