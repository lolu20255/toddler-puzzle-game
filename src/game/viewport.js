/**
 * Edge-to-edge viewport.
 *
 * On iOS the web view is drawn under the status bar so the Vue overlays (and
 * the launch intro) fill the whole screen. The Phaser canvas itself stays
 * below the status bar (`#game-container` is offset by the safe-area inset in
 * style.css), and the strip above it is painted with the colour at the top of
 * the current scene, so the status bar always blends into the screen instead
 * of showing a fixed sky-blue band. Status bar text flips between dark and
 * light to stay readable on that colour.
 *
 * Android keeps its native, non-overlaid status bar (its WebView reports no
 * safe-area inset for it), so everything here is a no-op there.
 */
import { StatusBar, Style } from '@capacitor/status-bar'
import { isIOS, isNativePlatform } from '../services/platform'

const OVERLAY_SETTLE_MS = 350 // Upper bound for the web view to grow under the status bar.
const LIGHT_TEXT_BELOW_LUMA = 0.6 // Background luminance under which white status bar text reads better.

let overlaysStatusBar = false
let preparePromise = null

/**
 * Switch iOS to edge-to-edge before the game sizes its canvas. The native
 * splash is still up while this runs, so the web view resize is never seen.
 * Memoised: the game and the launch intro both wait on the same switch.
 */
export function prepareViewport() {
  if (!preparePromise) preparePromise = overlayStatusBar()
  return preparePromise
}

async function overlayStatusBar() {
  if (!isNativePlatform() || !isIOS()) return
  try {
    await StatusBar.setOverlaysWebView({ overlay: true })
    overlaysStatusBar = true
    await waitForResize()
  } catch (error) {
    console.warn('[Viewport] edge-to-edge unavailable:', error)
  }
}

function waitForResize() {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, OVERLAY_SETTLE_MS)
    window.addEventListener(
      'resize',
      () => {
        clearTimeout(timer)
        requestAnimationFrame(resolve)
      },
      { once: true }
    )
  })
}

/** CSS-pixel size of the area the canvas occupies (below the status bar). */
export function gameViewportSize() {
  const container = document.getElementById('game-container')
  return {
    width: container?.clientWidth || window.innerWidth,
    height: container?.clientHeight || window.innerHeight
  }
}

/** Repaint the status bar strip whenever a scene starts (and after rotation restarts). */
export function followScenesWithStatusBar(game) {
  if (!overlaysStatusBar) return
  game.scene.scenes.forEach((scene) =>
    scene.events.on('start', () => scene.time.delayedCall(60, () => paintStatusBar(game)))
  )
}

function paintStatusBar(game) {
  const x = Math.floor(game.scale.width / 2)
  game.renderer.snapshotPixel(x, 1, (color) => {
    if (!color) return
    document.body.style.backgroundColor = `rgb(${color.red}, ${color.green}, ${color.blue})`
    const luma = (0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue) / 255
    const style = luma < LIGHT_TEXT_BELOW_LUMA ? Style.Dark : Style.Light
    StatusBar.setStyle({ style }).catch((error) => console.warn('[Viewport] status bar style failed:', error))
  })
}
