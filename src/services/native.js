/**
 * Native bootstrap.
 *
 * Single entry point that wires up every Capacitor feature when the app
 * starts. Called once from `src/main.js`. A no-op (beyond launch counting) in
 * a plain browser, so the Vite dev server keeps working unchanged.
 *
 * Each native plugin call is wrapped in its own try/catch and is logged so
 * that, if any one of them kills the WebContent process on a real device, the
 * Xcode console pinpoints which one — and the rest still try to run.
 */
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App } from '@capacitor/app'
import { isNativePlatform, isAndroid } from './platform'
import { Storage } from './storage'
import { purchasesService } from './purchases'
import { notificationsService } from './notifications'
import { appReview } from './appReview'
import { analytics } from './analytics'
import { libroAuth } from './libro/auth'
import { settings } from './settings'
import { EventBus } from '../game/EventBus'

const REVIEW_PROMPT_EVERY = 5

/** Run an async step, log start + end, swallow any error. */
async function step(name, fn) {
  console.log(`[Native] ${name}…`)
  try {
    await fn()
    console.log(`[Native] ${name} ✓`)
  } catch (error) {
    console.error(`[Native] ${name} ✗`, error)
  }
}

export async function initNative() {
  // 0. Hydrate user settings (toddler name + haptics flag) into the in-memory
  //    cache so every other service / scene can read them synchronously.
  await settings.load()

  // 1. Count launches (works everywhere).
  let opens = 1
  try {
    opens = ((await Storage.getJSON('appOpenings', 0)) || 0) + 1
    await Storage.set('appOpenings', opens)
  } catch (e) {
    console.error('[Native] launch counter error', e)
  }
  analytics.logEvent('app_open', { count: opens })

  if (!isNativePlatform()) {
    console.log('[Native] Browser build — native features disabled')
    return
  }

  // 2. Native plugins — each isolated.
  await step('StatusBar.setStyle', () =>
    StatusBar.setStyle({ style: Style.Light })
  )

  await step('Purchases.initialize', () => purchasesService.initialize())

  await step('Notifications.initialize', () =>
    notificationsService.initialize()
  )

  // Install the 401-refresh-retry interceptor BEFORE anything fires a
  // libro-ai request — it has to be hooked up so the first stale-token
  // hit gets refreshed + replayed instead of bubbling up as a failure.
  await step('LibroAuth.setupInterceptor', () => {
    libroAuth.setupInterceptor()
  })

  // Then warm up authentication so the first pronunciation request after a
  // successful match doesn't have to wait on the auth dance. Runs in the
  // background — never blocks the boot sequence.
  step('LibroAuth.ensureAuthenticated', () =>
    libroAuth.ensureAuthenticated()
  )

  // backButton is an Android-only event. Calling addListener on iOS works in
  // some Capacitor versions and crashes the WebContent process in others —
  // skip it entirely off Android.
  if (isAndroid()) {
    await step('App.backButton listener', () => {
      App.addListener('backButton', () => {
        EventBus.emit('app:backButton')
      })
    })
  }

  if (opens % REVIEW_PROMPT_EVERY === 0) {
    setTimeout(() => appReview.requestReview(), 4000)
  }

  // 3. Reveal the game. Phaser's Boot scene shows its own loading bar.
  requestAnimationFrame(() => {
    SplashScreen.hide().catch(() => {})
  })
}
