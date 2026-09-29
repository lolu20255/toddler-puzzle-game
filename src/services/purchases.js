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
 *
 * Hardening borrowed from libro-ai's `src/services/subscription.js`:
 *   - StoreKit priming via `getCustomerInfo` before `getOfferings`
 *   - `_withTimeout` racing every non-purchase call against a 4 s timeout
 *   - Backoff retry loop for `getOfferings` (the first call after configure()
 *     often returns `current: null` while StoreKit is still loading)
 *   - `addCustomerInfoUpdateListener` so server-side entitlement changes
 *     (cross-device restore, refund, trial expiry, subscription cancel)
 *     update `cachedFullAccess` without an app restart
 */
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { isNativePlatform, isAndroid } from './platform'
import { FORCE_PREMIUM } from '../config'
import { EventBus } from '../game/EventBus'

const API_KEY_IOS = import.meta.env.VITE_REVENUECAT_API_KEY_IOS
const API_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID

export const ENTITLEMENT_ID = 'premium'

// Default timeout for non-purchase RevenueCat calls. Purchase calls have NO
// timeout — the user may be authenticating with Touch ID / Face ID / a
// password prompt for many seconds and we must not race that.
const RC_CALL_TIMEOUT_MS = 4000

// Backoff schedule for the `getOfferings` retry loop. Mirrors libro-ai.
const OFFERINGS_BACKOFFS_MS = [0, 500, 1500, 3000]

// A synthetic CustomerInfo shape returned when `FORCE_PREMIUM` is on, so
// consumers calling `getCustomerInfo()` see the entitlement active without
// having to special-case the dev flag themselves.
const FAKE_PREMIUM_CUSTOMER_INFO = Object.freeze({
  entitlements: Object.freeze({
    active: Object.freeze({ [ENTITLEMENT_ID]: Object.freeze({}) }),
    all: Object.freeze({ [ENTITLEMENT_ID]: Object.freeze({}) }),
  }),
})

class PurchasesService {
  constructor() {
    this.initialized = false
    this._listenerInstalled = false
    // Synchronous cache of the last-known entitlement state. MainMenu reads
    // this when deciding which cards to show with a lock icon — it can't
    // `await hasFullAccess()` on every render. Refreshed by `refreshEntitlement()`
    // at boot, after every purchase/restore, and live by the customerInfo
    // update listener.
    //
    // When `FORCE_PREMIUM` is `true` (src/config.js), we start in the
    // unlocked state so MainMenu's very first card paint sees no locks —
    // no need to wait for an async refresh.
    this.cachedFullAccess = FORCE_PREMIUM
  }

  _apiKey() {
    return isAndroid() ? API_KEY_ANDROID : API_KEY_IOS
  }

  /**
   * Race `promise` against a manual timeout. Used to keep flaky StoreKit
   * sandbox calls from hanging the whole boot sequence — libro-ai pattern.
   *
   * NEVER use this around `purchasePackage()` or `restorePurchases()` —
   * the user may be staring at a Touch ID / Face ID prompt and a timeout
   * would either misreport the result or fight the system dialog.
   */
  _withTimeout(promise, ms = RC_CALL_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`[Purchases] timeout after ${ms}ms`)), ms)
      ),
    ])
  }

  /**
   * Pull the `premium` flag out of a CustomerInfo object. Tolerates the
   * varying shapes the SDK has returned across versions (some return
   * `entitlements.active` keyed by id, some return null/undefined when
   * nothing is owned).
   */
  _isPremiumFromCustomerInfo(customerInfo) {
    try {
      return customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined
    } catch (_) {
      return false
    }
  }

  /**
   * Subscribe to RevenueCat's customerInfo stream so server-side entitlement
   * changes (cross-device restore, refund, trial expiry, sub cancellation)
   * update `cachedFullAccess` live. Without this the app can show "Premium
   * Active" hours after the user has actually been refunded.
   *
   * Only installs once per process. Emits `EventBus.emit('entitlement:updated')`
   * when the boolean state actually flips, so listeners don't fire on every
   * background ping.
   */
  _installCustomerInfoListener() {
    if (this._listenerInstalled) return
    if (FORCE_PREMIUM) {
      // Dev override is on — nothing the SDK reports can change our answer,
      // so don't bother attaching the listener.
      this._listenerInstalled = true
      return
    }
    if (!isNativePlatform()) return
    try {
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        const active = this._isPremiumFromCustomerInfo(customerInfo)
        const changed = active !== this.cachedFullAccess
        this.cachedFullAccess = active
        console.log(`[Purchases] entitlement update: ${active}`)
        if (changed) {
          EventBus.emit('entitlement:updated')
        }
      })
      this._listenerInstalled = true
    } catch (error) {
      console.error('[Purchases] addCustomerInfoUpdateListener error:', error)
    }
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
      // Install the live entitlement-update listener as soon as the SDK is
      // configured — RevenueCat only fires this after `configure()`.
      this._installCustomerInfoListener()
    } catch (error) {
      console.error('[Purchases] init error:', error)
    }
  }

  /** True when the user owns the `premium` entitlement. */
  async hasFullAccess() {
    // Dev override — short-circuits every entitlement check so locked cards
    // act unlocked and the paywall never gates anything. See src/config.js.
    if (FORCE_PREMIUM) {
      this.cachedFullAccess = true
      return true
    }
    if (!isNativePlatform()) return this.cachedFullAccess
    try {
      const { customerInfo } = await this._withTimeout(Purchases.getCustomerInfo())
      const active = this._isPremiumFromCustomerInfo(customerInfo)
      this.cachedFullAccess = active
      return active
    } catch (error) {
      console.error('[Purchases] entitlement check error:', error)
      return this.cachedFullAccess
    }
  }

  /** Fetch entitlement and update the sync cache. Call at boot + after purchase. */
  async refreshEntitlement() {
    return this.hasFullAccess()
  }

  /**
   * Raw CustomerInfo object, wrapped in `_withTimeout` + try/catch. Returns
   * `null` if the call hangs or errors, instead of throwing. Honors
   * `FORCE_PREMIUM` by handing back a frozen synthetic object so consumers
   * see the entitlement as active in dev.
   */
  async getCustomerInfo() {
    if (FORCE_PREMIUM) return FAKE_PREMIUM_CUSTOMER_INFO
    if (!isNativePlatform()) return null
    try {
      const { customerInfo } = await this._withTimeout(Purchases.getCustomerInfo())
      return customerInfo || null
    } catch (error) {
      console.error('[Purchases] getCustomerInfo error:', error)
      return null
    }
  }

  /**
   * The current offering (its `availablePackages` drive the paywall UI).
   *
   * Hardened against the iOS StoreKit sandbox quirk where the very first
   * `getOfferings()` after `Purchases.configure()` returns `current: null`
   * while StoreKit is still loading. We prime StoreKit with a
   * `getCustomerInfo()` call first and then retry with a growing backoff,
   * each attempt racing against `_withTimeout` so a single hang doesn't
   * eat the whole 5-second budget.
   */
  async getOfferings() {
    if (!isNativePlatform()) return null

    // Prime StoreKit via getCustomerInfo. Failure is non-fatal — we still
    // attempt getOfferings; the prime just shortens the first attempt's
    // wait when StoreKit is cold.
    try {
      console.log('[Purchases] Priming StoreKit via getCustomerInfo…')
      await this._withTimeout(Purchases.getCustomerInfo())
    } catch (e) {
      console.warn('[Purchases] StoreKit prime failed (non-fatal):', e?.message || e)
    }

    for (let i = 0; i < OFFERINGS_BACKOFFS_MS.length; i++) {
      if (OFFERINGS_BACKOFFS_MS[i] > 0) {
        await new Promise((resolve) => setTimeout(resolve, OFFERINGS_BACKOFFS_MS[i]))
      }
      console.log(`[Purchases] getOfferings attempt ${i + 1}…`)
      try {
        const result = await this._withTimeout(Purchases.getOfferings())
        const offering = result?.current || (result?.all && result.all.default) || null
        if (offering) {
          console.log(`[Purchases] Offerings loaded on attempt ${i + 1}`)
          return offering
        }
        console.warn(`[Purchases] getOfferings attempt ${i + 1}: no current offering`)
      } catch (error) {
        console.error(
          `[Purchases] getOfferings attempt ${i + 1} error:`,
          error?.message || error
        )
      }
    }
    console.error('[Purchases] getOfferings: all attempts failed, returning null')
    return null
  }

  /**
   * Best-effort classification of a RevenueCat error object into the
   * recognised buckets the Paywall cares about. Strings are matched
   * case-insensitively because the SDK has shipped the same code under
   * different names across versions.
   */
  _classifyError(error) {
    const codeStr = String(error?.code ?? '').toUpperCase()
    const message = String(error?.message ?? '').toUpperCase()

    if (error?.userCancelled || codeStr.includes('CANCEL') || message.includes('CANCEL')) {
      return 'cancelled'
    }
    if (
      codeStr.includes('PURCHASE_NOT_ALLOWED') ||
      codeStr === 'PURCHASE_NOT_ALLOWED_ERROR' ||
      message.includes('NOT ALLOWED') ||
      message.includes('NOT_ALLOWED')
    ) {
      return 'blocked'
    }
    if (
      codeStr.includes('NETWORK') ||
      codeStr === 'NETWORK_ERROR' ||
      message.includes('NETWORK') ||
      message.includes('OFFLINE') ||
      message.includes('CONNECTION')
    ) {
      return 'network'
    }
    return 'other'
  }

  /**
   * Buy a package. `pkg` is one entry from `getOfferings().availablePackages`.
   *
   * NO `_withTimeout` wrap — Apple/Google may keep the user on a Touch ID /
   * Face ID / password prompt for many seconds and we MUST NOT race that.
   *
   * Returns one of:
   *   - `{ success: true, customerInfo }` — entitlement is now active
   *   - `{ success: false }`              — no-op (not on a native platform)
   *   - `{ success: false, cancelled: true }`     — user dismissed the sheet
   *   - `{ success: false, blocked: true, error }` — IAP disabled (parental
   *                                                   controls, restricted
   *                                                   device, etc.)
   *   - `{ success: false, networkError: true, error }` — connectivity issue
   *   - `{ success: false, error }`       — anything else
   */
  async purchasePackage(pkg) {
    if (!isNativePlatform()) return { success: false }
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
      const active = this._isPremiumFromCustomerInfo(customerInfo)
      this.cachedFullAccess = active
      return { success: active, customerInfo }
    } catch (error) {
      const kind = this._classifyError(error)
      if (kind === 'cancelled') return { success: false, cancelled: true }
      if (kind === 'blocked') {
        console.warn('[Purchases] purchase blocked (parental controls / not allowed)')
        return { success: false, blocked: true, error }
      }
      if (kind === 'network') {
        console.warn('[Purchases] purchase network error')
        return { success: false, networkError: true, error }
      }
      console.error('[Purchases] purchase error:', error)
      return { success: false, error }
    }
  }

  /** Restore a previous purchase (required by both stores). */
  async restorePurchases() {
    if (!isNativePlatform()) return { success: false }
    // No `_withTimeout`: restore can take a while on slow networks and the
    // SDK may surface a confirmation dialog on Android.
    try {
      const { customerInfo } = await Purchases.restorePurchases()
      const active = this._isPremiumFromCustomerInfo(customerInfo)
      this.cachedFullAccess = active
      return { success: active, customerInfo }
    } catch (error) {
      const kind = this._classifyError(error)
      if (kind === 'network') {
        console.warn('[Purchases] restore network error')
        return { success: false, networkError: true, error }
      }
      console.error('[Purchases] restore error:', error)
      return { success: false, error }
    }
  }
}

export const purchasesService = new PurchasesService()
