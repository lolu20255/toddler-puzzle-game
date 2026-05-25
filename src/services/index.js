/**
 * Services barrel.
 *
 * Import native capabilities from one place, e.g.:
 *   import { haptics, purchasesService, isNativePlatform } from '@/services'
 */
export * from './platform'
export { Storage } from './storage'
export { haptics } from './haptics'
export { purchasesService, ENTITLEMENT_ID } from './purchases'
export { notificationsService } from './notifications'
export { appReview } from './appReview'
export { analytics } from './analytics'
export { initNative } from './native'
