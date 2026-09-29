/**
 * libro-ai integration — barrel.
 */
import { stopAllPronunciations } from './pronunciation'
import { stopAllLevelAudio } from './levelAudio'

export { HTTP as libroHttp } from './http'
export { libroAuth } from './auth'
export { speak, preload, preloadMany, stopAllPronunciations } from './pronunciation'
export { stopAllLevelAudio } from './levelAudio'

/**
 * Silence every TTS audio currently playing across both caches. Called from
 * the game scene's shutdown hook and the back button press so the
 * celebration voice doesn't trail into the next scene.
 */
export function stopAllSpeech() {
  stopAllPronunciations()
  stopAllLevelAudio()
}
