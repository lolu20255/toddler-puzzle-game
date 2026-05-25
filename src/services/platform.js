/**
 * Platform detection.
 *
 * Thin wrapper around Capacitor's runtime checks so the rest of the app never
 * imports `@capacitor/core` directly just to ask "are we native?".
 */
import { Capacitor } from '@capacitor/core'

/** True inside the iOS/Android Capacitor shell. */
export const isNativePlatform = () => Capacitor.isNativePlatform()

/** Alias kept for readability at call sites. */
export const isMobileApp = () => Capacitor.isNativePlatform()

/** True in a plain web browser (dev server, or a future web build). */
export const isBrowser = () => !Capacitor.isNativePlatform()

/** 'ios' | 'android' | 'web' */
export const getPlatform = () => Capacitor.getPlatform()

export const isIOS = () => Capacitor.getPlatform() === 'ios'

export const isAndroid = () => Capacitor.getPlatform() === 'android'
