/**
 * In-app purchases via RevenueCat.
 *
 * RevenueCat abstracts StoreKit (iOS) and Google Play Billing (Android) behind
 * one API, and handles receipt validation, "restore purchases" and the
 * entitlement check for us.
 *
 * A single entitlement, `premium`, gates the paid content (e.g. unlocking all
 * puzzle packs). Sell it as a one-time unlock or a subscription — the store /
 * RevenueCat dashboard decides; this code does not care.
 *
 * IMPORTANT: this is a children's app. Any UI that calls `purchasePackage()`
 * MUST sit behind a parental gate (Apple Kids Category / Google Play Families).
 *
 * Off-device every method is a safe no-op so the browser dev build never
 * crashes.
 */
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { isNativePlatform, isAndroid } from './platform'

const API_KEY_IOS = import.meta.env.VITE_REVENUECAT_API_KEY_IOS
const API_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID

export const ENTITLEMENT_ID = 'premium'

class PurchasesService {
  constructor() {
    this.initialized = false
  }

  _apiKey() {
    return isAndroid() ? API_KEY_ANDROID : API_KEY_IOS
  }

  /** Configure the RevenueCat SDK. Safe to call more than once. */
  async initialize() {
    if (this.initialized || !isNativePlatform()) return

    const apiKey = this._apiKey()
    if (!apiKey) {
      console.warn('[Purchases] No RevenueCat API key configured — purchases disabled')
      return
    }

    try {
      await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR })
      await Purchases.configure({ apiKey })
      this.initialized = true
    } catch (error) {
      console.error('[Purchases] init error:', error)
    }
  }

  /** True when the user owns the `premium` entitlement. */
  async hasFullAccess() {
    if (!isNativePlatform()) return false
    try {
      const { customerInfo } = await Purchases.getCustomerInfo()
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined
    } catch (error) {
      console.error('[Purchases] entitlement check error:', error)
      return false
    }
  }

  /** The current offering (its `availablePackages` drive the paywall UI). */
  async getOfferings() {
    if (!isNativePlatform()) return null
    try {
      const result = await Purchases.getOfferings()
      return result.current || (result.all && result.all.default) || null
    } catch (error) {
      console.error('[Purchases] getOfferings error:', error)
      return null
    }
  }

  /**
   * Buy a package. `pkg` is one entry from `getOfferings().availablePackages`.
   * Returns `{ success, cancelled?, error? }`.
   */
  async purchasePackage(pkg) {
    if (!isNativePlatform()) return { success: false }
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
      return {
        success: customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined,
        customerInfo
      }
    } catch (error) {
      if (error?.userCancelled || String(error?.code).toUpperCase().includes('CANCEL')) {
        return { success: false, cancelled: true }
      }
      console.error('[Purchases] purchase error:', error)
      return { success: false, error }
    }
  }

  /** Restore a previous purchase (required by both stores). */
  async restorePurchases() {
    if (!isNativePlatform()) return { success: false }
    try {
      const { customerInfo } = await Purchases.restorePurchases()
      return {
        success: customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined,
        customerInfo
      }
    } catch (error) {
      console.error('[Purchases] restore error:', error)
      return { success: false, error }
    }
  }
}

export const purchasesService = new PurchasesService()
