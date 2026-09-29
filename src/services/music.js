/**
 * Menu background music.
 *
 * One looping track plays on the menu screens (MainMenu, Settings) and fades
 * out when a game starts, so the spoken words in each game stay clear. When
 * the child comes back to the menu it resumes where it left off instead of
 * restarting, which keeps the loop from getting repetitive.
 *
 * The track streams through an HTMLAudioElement rather than being decoded by
 * Phaser: a 2-minute decoded stereo buffer is ~50 MB of PCM, which is enough
 * to get the WKWebView content process killed on older iPhones. iOS ignores
 * `HTMLMediaElement.volume`, so the element is routed through a WebAudio gain
 * node for fades. It shares Phaser's AudioContext, so Phaser's
 * pause-on-blur also silences it.
 */
import { settings } from './settings'

const MUSIC_URL = 'assets/audio/music/menu_theme.m4a' // "Yippee !" by Loyalty Freak Music, CC0 (see the folder README).
const MUSIC_SCENES = ['MainMenu', 'Settings']
const MUSIC_VOLUME = 0.32 // Well under SFX and voice, per kids-app mixing practice.
const FADE_IN_S = 1.6
const FADE_OUT_S = 0.6

let audioContext = null
let element = null
let gain = null
let inMusicScene = false
let appActive = true
let pauseTimer = null
let waitingForGesture = false

/** Wire the service to the game's AudioContext. Call once after boot. */
function attach(game) {
  audioContext = game.sound?.context || null
  settings.onChange(() => refresh())
}

/** Tell the service which scene is now showing. */
function setScene(sceneKey) {
  inMusicScene = MUSIC_SCENES.includes(sceneKey)
  refresh()
}

/** App went to the background or came back (Capacitor appStateChange). */
function setAppActive(isActive) {
  appActive = isActive
  refresh()
}

function shouldPlay() {
  return inMusicScene && appActive && settings.musicEnabled()
}

// Runs inside Phaser's scene-start emit: an audio failure must never break
// the scene transition, so it is logged and contained here.
function refresh() {
  try {
    if (shouldPlay()) fadeIn()
    else fadeOut()
  } catch (error) {
    console.warn('[Music] playback update failed:', error)
  }
}

function ensureElement() {
  if (element) return true
  if (!audioContext) return false
  element = new Audio(MUSIC_URL)
  element.loop = true
  element.preload = 'auto'
  gain = audioContext.createGain()
  gain.gain.value = 0
  audioContext.createMediaElementSource(element).connect(gain)
  gain.connect(audioContext.destination)
  return true
}

function fadeIn() {
  if (!ensureElement()) return
  clearTimeout(pauseTimer)
  const now = audioContext.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + FADE_IN_S)
  if (!element.paused) return
  audioContext.resume().catch((error) => console.warn('[Music] resume failed:', error))
  element.play().catch(() => retryOnFirstGesture())
}

function fadeOut() {
  if (!element || element.paused) return
  const now = audioContext.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S)
  clearTimeout(pauseTimer)
  pauseTimer = setTimeout(() => element.pause(), FADE_OUT_S * 1000 + 50)
}

// Browsers (not the native shells) block playback until the first touch.
function retryOnFirstGesture() {
  if (waitingForGesture) return
  waitingForGesture = true
  const retry = () => {
    waitingForGesture = false
    refresh()
  }
  window.addEventListener('pointerdown', retry, { once: true, capture: true })
}

export const music = { attach, setScene, setAppActive }
